#include "led.h"
#include "pet_data.h"
#include "lvgl.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

typedef struct { float r, g, b; } rgbf_t;

static inline rgbf_t rgb_of(uint32_t hex) { return (rgbf_t){ (float)((hex >> 16) & 0xFF), (float)((hex >> 8) & 0xFF), (float)(hex & 0xFF) }; }
static inline uint16_t to565(rgbf_t c)
{
    int r = (int)(c.r + 0.5f), g = (int)(c.g + 0.5f), b = (int)(c.b + 0.5f);
    if (r > 255) r = 255;
    if (g > 255) g = 255;
    if (b > 255) b = 255;
    return (uint16_t)(((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3));
}
static inline rgbf_t from565(uint16_t v)
{
    return (rgbf_t){ (float)(((v >> 11) & 0x1F) * 255 / 31), (float)(((v >> 5) & 0x3F) * 255 / 63), (float)((v & 0x1F) * 255 / 31) };
}
static inline rgbf_t mix(rgbf_t a, rgbf_t b, float k)
{
    return (rgbf_t){ a.r + (b.r - a.r) * k, a.g + (b.g - a.g) * k, a.b + (b.b - a.b) * k };
}
static rgbf_t dimmed(rgbf_t c, uint8_t dim)
{
    float k = (255 - dim) / 255.0f;
    return (rgbf_t){ c.r * k, c.g * k, c.b * k };
}

/* Richer colour: brighter (value lifted to base + value x gain) and more saturated
 * (saturation x sat), hue kept. */
static rgbf_t vivid(rgbf_t c, float base, float gain, float sat)
{
    float mx = fmaxf(c.r, fmaxf(c.g, c.b)), mn = fminf(c.r, fminf(c.g, c.b));
    if (mx <= 0) return c;
    float v = mx / 255.0f, s = (mx - mn) / mx;
    float v2 = fminf(1.0f, base + v * gain), s2 = fminf(1.0f, s * sat);
    /* scale each channel's distance from the max, then the whole colour to the new value */
    float k = s > 0 ? s2 / s : 0;
    rgbf_t o = { mx - (mx - c.r) * k, mx - (mx - c.g) * k, mx - (mx - c.b) * k };
    float m = v2 * 255.0f / mx;
    return (rgbf_t){ o.r * m, o.g * m, o.b * m };
}

/* How the room is lit. Brighter and richer than the plain Field Kit field (which read too dark):
 * the walls and floors are lifted most, and every lit LED sits on a soft panel of its own
 * colour, so the room glows between the dots instead of showing black. */
#define WALL_BASE 0.22f
#define WALL_GAIN 1.75f
#define WALL_SAT 1.3f
#define FEATURE_BASE 0.08f
#define FEATURE_GAIN 1.3f
#define FEATURE_SAT 1.2f
#define PANEL_RIM 0.20f      /* the panel's brightness (of its dot's) at the rim ... */
#define PANEL_MIDDLE 0.42f   /* ... and in the middle */

static const uint32_t *pal;   /* the palette of the render under way */
static rgbf_t wall_colour(uint8_t i) { return vivid(rgb_of(pal[i]), WALL_BASE, WALL_GAIN, WALL_SAT); }
static rgbf_t feature_colour(uint8_t i) { return vivid(rgb_of(pal[i]), FEATURE_BASE, FEATURE_GAIN, FEATURE_SAT); }

void led_blit(uint8_t *grid, int gw, int gh, uint16_t sprite, int dx, int dy)
{
    if (!sprite) return;
    const uint8_t *s = pet_blob + pet_sprite_offset[sprite];
    while (s[0] != 0xFF) {
        int y = s[0] + dy, x = s[1] + dx, n = s[2];
        const uint8_t *c = s + 3;
        s += 3 + n;
        if (y < 0 || y >= gh) continue;
        for (int k = 0; k < n; k++)
            if (x + k >= 0 && x + k < gw) grid[y * gw + x + k] = c[k];
    }
}

enum { K_UNLIT, K_WALL, K_ROOM, K_FX, K_SOLID, K_NONE = 0xFF };

/* Scratch for one render at a time (renders never overlap: everything runs on the LVGL thread). */
static uint8_t *kind, *col;
static float *rad;
static int cap;

/* A round dot, its edge blended into what's already drawn under it. */
static void disc(const led_args_t *a, float cx, float cy, float r, rgbf_t c)
{
    int x0 = (int)floorf(cx - r - 1), x1 = (int)ceilf(cx + r + 1);
    int y0 = (int)floorf(cy - r - 1), y1 = (int)ceilf(cy + r + 1);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > a->d) x1 = a->d;
    if (y1 > a->d) y1 = a->d;
    uint16_t c565 = to565(c);
    for (int y = y0; y < y1; y++) {
        float dy = (float)y + 0.5f - cy;
        for (int x = x0; x < x1; x++) {
            float dx = (float)x + 0.5f - cx;
            float cov = r + 0.5f - sqrtf(dx * dx + dy * dy);
            if (cov <= 0) continue;
            uint16_t *px = &a->buf[y * a->d + x];
            *px = cov >= 1 ? c565 : to565(mix(from565(*px), c, cov));
        }
    }
}

/* Where LED i's square starts: R + (i - 1/2) x pitch, rounded. A square runs from its own start to
 * the next LED's, so neighbours always meet (rounding each square's two sides separately could
 * leave a 1 px gap, which shows as a dark line through the scene). */
static inline int cell_start(float R, float P, int i) { return (int)floorf(R + (i - 0.5f) * P + 0.5f); }

/* The LED's square, cut to the circle `edge` with a soft rim. */
static void square(const led_args_t *a, int i, int j, float P, float edge, rgbf_t c, rgbf_t bg)
{
    const float R = a->d / 2.0f, X = R + i * P, Y = R + j * P;
    int x0 = cell_start(R, P, i), x1 = cell_start(R, P, i + 1);
    int y0 = cell_start(R, P, j), y1 = cell_start(R, P, j + 1);
    if (x0 < 0) x0 = 0;
    if (y0 < 0) y0 = 0;
    if (x1 > a->d) x1 = a->d;
    if (y1 > a->d) y1 = a->d;
    bool rim = sqrtf((X - R) * (X - R) + (Y - R) * (Y - R)) + P * 0.75f > edge;
    uint16_t c565 = to565(c);
    for (int y = y0; y < y1; y++) {
        for (int x = x0; x < x1; x++) {
            if (!rim) { a->buf[y * a->d + x] = c565; continue; }
            float dx = x + 0.5f - R, dy = y + 0.5f - R;
            float cov = edge + 0.5f - sqrtf(dx * dx + dy * dy);
            if (cov <= 0) continue;
            a->buf[y * a->d + x] = cov >= 1 ? c565 : to565(mix(bg, c, cov));
        }
    }
}

void led_render(const led_args_t *a)
{
    const float P = a->pitch, R = a->d / 2.0f;
    const int n = (int)ceilf(R / P), side = 2 * n + 1;
    if (side * side > cap) {
        lv_free(kind); lv_free(col); lv_free(rad);
        cap = side * side;
        kind = lv_malloc((size_t)cap);
        col = lv_malloc((size_t)cap);
        rad = lv_malloc((size_t)cap * sizeof(float));
        if (!kind || !col || !rad) { cap = 0; return; }
    }
    pal = a->palette ? a->palette : pet_palette;
    const rgbf_t bg = rgb_of(a->bg);
    const uint16_t bg565 = to565(bg);
    for (int k = 0; k < a->d * a->d; k++) a->buf[k] = bg565;
    const float edge = R - P * 0.15f;   /* the panels stop here */

    /* what each LED shows; the room's LEDs light their square first, softer towards the rim */
    for (int j = -n; j <= n; j++) {
        for (int i = -n; i <= n; i++) {
            int li = (j + n) * side + (i + n);
            float X = i * P, Y = j * P;
            float dist = sqrtf(X * X + Y * Y);
            if (dist > R - P * 0.55f) { kind[li] = K_NONE; continue; }
            float t = 1.0f - dist / R;
            int gx = a->cx + i, gy = a->cy + j;
            uint8_t b = 0, f = 0, r = 0, w = 0;
            if (gx >= 0 && gy >= 0 && gx < a->gw && gy < a->gh) {
                int c = gy * a->gw + gx;
                b = a->body ? a->body[c] : 0;
                f = a->fx ? a->fx[c] : 0;
                r = a->room ? a->room[c] : 0;
                w = a->walls ? a->walls[c] : 0;
            } else if (a->extend) {
                /* past the grid: the room's edge cells carry on (a wide strip, or the whole circle) */
                int ex = gx < 0 ? 0 : gx >= a->gw ? a->gw - 1 : gx, ey = gy < 0 ? 0 : gy >= a->gh ? a->gh - 1 : gy;
                int c = ey * a->gw + ex;
                r = a->room ? a->room[c] : 0;
                w = a->walls ? a->walls[c] : 0;
                if (!w && r) { w = r; r = 0; }
            }
            if (a->room_off) { r = 0; w = 0; }
            if (!b && (r || w)) {
                float k = PANEL_RIM + (PANEL_MIDDLE - PANEL_RIM) * t;
                square(a, i, j, P, edge, dimmed(mix(bg, r ? feature_colour(r) : wall_colour(w), k), a->dim), bg);
            }
            if (b) {
                kind[li] = K_SOLID; col[li] = b;
            } else if (f) {
                kind[li] = K_FX; col[li] = f; rad[li] = P * 0.42f;
            } else if (r) {
                kind[li] = K_ROOM; col[li] = r; rad[li] = P * (0.28f + 0.14f * t);
            } else if (w) {
                kind[li] = K_WALL; col[li] = w; rad[li] = P * (0.27f + 0.13f * t);
            } else {
                kind[li] = a->room_off ? K_NONE : K_UNLIT; rad[li] = P * (0.19f + 0.1f * t);
            }
        }
    }

    const rgbf_t unlit = dimmed(rgb_of(0x1B2721), a->dim);
    for (int j = -n; j <= n; j++) {
        for (int i = -n; i <= n; i++) {
            int li = (j + n) * side + (i + n);
            uint8_t k = kind[li];
            if (k == K_NONE) continue;
            float X = R + i * P, Y = R + j * P;
            if (k == K_SOLID) {
                uint16_t c565 = to565(dimmed(rgb_of(pal[col[li]]), a->dim));
                int x0 = cell_start(R, P, i), x1 = cell_start(R, P, i + 1);
                int y0 = cell_start(R, P, j), y1 = cell_start(R, P, j + 1);
                if (x0 < 0) x0 = 0;
                if (y0 < 0) y0 = 0;
                if (x1 > a->d) x1 = a->d;
                if (y1 > a->d) y1 = a->d;
                for (int y = y0; y < y1; y++) for (int x = x0; x < x1; x++) a->buf[y * a->d + x] = c565;
                continue;
            }
            rgbf_t c = k == K_UNLIT ? unlit
                     : k == K_WALL ? dimmed(wall_colour(col[li]), a->dim)
                     : dimmed(k == K_FX ? rgb_of(pal[col[li]]) : feature_colour(col[li]), a->dim);
            disc(a, X, Y, rad[li], c);
        }
    }

    /* Celebrate: five lime plus-shaped sparkles that twinkle */
    if (a->sparkles >= 0) {
        static const int8_t SPARK[5][2] = { { -15, -16 }, { 14, -18 }, { 0, -23 }, { -18, -4 }, { 17, -2 } };
        static const int8_t PLUS[5][2] = { { 0, 0 }, { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } };
        rgbf_t lime = dimmed(rgb_of(0xDCEF70), a->dim);
        for (int s = 0; s < 5; s++) {
            bool big = ((a->sparkles / 3) + s) % 4 != 0;
            for (int q = 0; q < (big ? 5 : 1); q++) {
                int i = SPARK[s][0] + PLUS[q][0], j = SPARK[s][1] + PLUS[q][1];
                if (i < -n || i > n || j < -n || j > n) continue;
                disc(a, R + i * P, R + j * P, P * 0.42f, lime);
            }
        }
    }
}
