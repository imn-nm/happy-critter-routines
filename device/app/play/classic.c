#include "classic.h"
#include "../ui/theme.h"
#include "../ui/icons.h"
#include "../ui/fx.h"
#include "../hal.h"
#include "../motion.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* The classic games (Figma "13 · Classic games"). Each draws itself on one full-display surface
 * and redraws only what moved, so the board keeps up. Coordinates are the display's (466 x 466,
 * centre 233, 233). */

#define PI_F 3.14159265f
#define DEG (PI_F / 180.0f)
#define FRAME_MS 30

/* Figma's colours beyond the MyToki 2 tokens */
#define K_YELLOW 0xFFCD4D     /* a brick row, a puff, the cookie in Snack Drop */
#define K_COOKIE 0xE6BA4D     /* Snack Trail's treats, Maze Munch's big snacks */
#define K_CHIP 0x545155       /* the chocolate chips on them */
#define K_APPLE 0xFF5C5F
#define K_STREAK 0x383C4A     /* the line a falling snack leaves */
#define K_WALL C_NIGHT        /* the mazes' walls */
#define K_PUFF_MINT 0x9CDCBF
#define K_MATCHED 0x2C5450    /* Pet Pairs: a pair found */

enum { ST_READY, ST_PLAY, ST_OVER };
#define AGAIN_MS 700          /* after a game ends, a tap starts the next only this much later */

static const char *const BEST_KEY[CL_COUNT] = { "best-trail", "best-maze", "best-bricks", "best-pairs", "best-drop", "best-roll" };

static struct {
    lv_obj_t *obj;
    lv_timer_t *timer;
    classic_id_t id;
    bool running;
    int state;
    int score, best;
    bool new_best;
    uint32_t last_ms;
    float t;                  /* ms into this game */
    float over_at;
    bool down, dragged;
    lv_point_t anchor, last;
    float want_x, want_y;     /* Maze Munch: the way the child wants to go (a swipe or a tilt) */
    char msg[32];             /* a word in the middle for a moment (Maze Munch: "2 lives left") */
    float msg_until;
    bool again;               /* "Tap to play again" is showing */
} cl;

/* ---------------------------------------------------------------- small helpers */
static int rand_int(int n) { return n > 0 ? (int)(hal_random_u32() % (uint32_t)n) : 0; }
static float frand01(void) { return (hal_random_u32() % 10000) / 10000.0f; }
static float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
static float norm360(float a) { a = fmodf(a, 360.0f); return a < 0 ? a + 360.0f : a; }
static float adiff(float a, float b) { float d = norm360(a - b); return d > 180.0f ? d - 360.0f : d; }   /* a - b, -180..180 */

static int best_load(classic_id_t id) { char b[16]; return hal_store_get(BEST_KEY[id], b, sizeof b) ? atoi(b) : 0; }

/* A finished game: its best kept (Pet Pairs: fewest flips; the rest: most). */
static void game_over(void)
{
    cl.state = ST_OVER;
    cl.over_at = cl.t;
    cl.again = false;
    bool lower = cl.id == CL_PAIRS || cl.id == CL_ROLL;   /* fewest flips, fastest time */
    int least = cl.id == CL_TRAIL ? 4 : 0;   /* Snack Trail starts 4 long: no best for eating nothing */
    cl.new_best = cl.score > least && (!cl.best || (lower ? cl.score < cl.best : cl.score > cl.best));
    if (cl.new_best) {
        cl.best = cl.score;
        char b[16];
        snprintf(b, sizeof b, "%d", cl.best);
        hal_store_set(BEST_KEY[cl.id], b);
    }
}

/* ---------------------------------------------------------------- drawing */
static lv_layer_t *L;
static int32_t OX, OY;        /* the surface's top left on screen (it slides in with Playtime) */
static lv_area_t clip;

static void origin(void)
{
    lv_area_t a;
    lv_obj_get_coords(cl.obj, &a);
    OX = a.x1;
    OY = a.y1;
}

static void inv(float x0, float y0, float x1, float y1)
{
    if (!cl.obj) return;
    origin();
    lv_area_t a = { OX + (int32_t)floorf(x0) - 2, OY + (int32_t)floorf(y0) - 2, OX + (int32_t)ceilf(x1) + 2, OY + (int32_t)ceilf(y1) + 2 };
    lv_obj_invalidate_area(cl.obj, &a);
}
static void inv_box(float cx, float cy, float r) { inv(cx - r, cy - r, cx + r, cy + r); }
static void inv_all(void) { if (cl.obj) lv_obj_invalidate(cl.obj); }

#define AGAIN_Y 250

/* only what touches the part being drawn is drawn */
static bool seen(float x0, float y0, float x1, float y1)
{
    return !(OX + x1 < clip.x1 || OX + x0 > clip.x2 || OY + y1 < clip.y1 || OY + y0 > clip.y2);
}

static void box(float x0, float y0, float x1, float y1, uint32_t col, int32_t radius, lv_opa_t opa, uint32_t border, int bw)
{
    if (!seen(x0, y0, x1, y1)) return;
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = COL(col);
    d.bg_opa = opa;
    d.radius = radius;
    if (bw) {
        d.border_color = COL(border);
        d.border_width = bw;
        d.border_opa = LV_OPA_COVER;
    }
    lv_area_t a = { OX + lroundf(x0), OY + lroundf(y0), OX + lroundf(x1) - 1, OY + lroundf(y1) - 1 };
    lv_draw_rect(L, &d, &a);
}

static void disc(float cx, float cy, float r, uint32_t col) { box(cx - r, cy - r, cx + r, cy + r, col, LV_RADIUS_CIRCLE, LV_OPA_COVER, 0, 0); }

static void outline(float cx, float cy, float r, uint32_t col, int w, uint32_t fill, lv_opa_t fill_opa)
{
    box(cx - r, cy - r, cx + r, cy + r, fill, LV_RADIUS_CIRCLE, fill_opa, col, w);
}

/* a ring and nothing inside it, fading as opa drops */
static void ring(float cx, float cy, float r, int w, uint32_t col, lv_opa_t opa)
{
    if (!seen(cx - r, cy - r, cx + r, cy + r)) return;
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_opa = LV_OPA_TRANSP;
    d.radius = LV_RADIUS_CIRCLE;
    d.border_color = COL(col);
    d.border_width = w;
    d.border_opa = opa;
    lv_area_t a = { OX + lroundf(cx - r), OY + lroundf(cy - r), OX + lroundf(cx + r) - 1, OY + lroundf(cy + r) - 1 };
    lv_draw_rect(L, &d, &a);
}

/* an arc centred on radius r, w wide; angles in degrees, 0 = 3 o'clock, clockwise */
static void arc(float cx, float cy, float r, int w, float a0, float a1, uint32_t col, bool round)
{
    if (a1 - a0 >= 359.9f) {   /* a whole ring: as two halves (0 to 360 would draw nothing) */
        arc(cx, cy, r, w, 0, 180, col, false);
        arc(cx, cy, r, w, 180, 360 - 0.01f, col, false);
        return;
    }
    float R = r + w / 2.0f;
    if (!seen(cx - R, cy - R, cx + R, cy + R)) return;
    lv_draw_arc_dsc_t a;
    lv_draw_arc_dsc_init(&a);
    a.center.x = OX + lroundf(cx);
    a.center.y = OY + lroundf(cy);
    a.radius = (uint16_t)lroundf(R);
    a.width = w;
    a.color = COL(col);
    a.opa = LV_OPA_COVER;
    a.rounded = round;
    a.start_angle = norm360(a0);
    a.end_angle = norm360(a1);
    lv_draw_arc(L, &a);
}

static void seg(float x0, float y0, float x1, float y1, int w, uint32_t col, lv_opa_t opa)
{
    if (!seen(fminf(x0, x1) - w, fminf(y0, y1) - w, fmaxf(x0, x1) + w, fmaxf(y0, y1) + w)) return;
    lv_draw_line_dsc_t d;
    lv_draw_line_dsc_init(&d);
    d.p1.x = OX + x0;
    d.p1.y = OY + y0;
    d.p2.x = OX + x1;
    d.p2.y = OY + y1;
    d.width = w;
    d.color = COL(col);
    d.opa = opa;
    d.round_start = d.round_end = 1;
    lv_draw_line(L, &d);
}

static void icon_at(const char *name, int size, float cx, float cy, uint32_t col)
{
    const lv_image_dsc_t *src = icon_find(name, size);
    if (!src) return;
    int32_t w = src->header.w, h = src->header.h;
    if (!seen(cx - w / 2.0f, cy - h / 2.0f, cx + w / 2.0f, cy + h / 2.0f)) return;
    lv_draw_image_dsc_t im;
    lv_draw_image_dsc_init(&im);
    im.src = src;
    im.recolor = COL(col);
    im.recolor_opa = LV_OPA_COVER;
    int32_t x0 = OX + lroundf(cx) - w / 2, y0 = OY + lroundf(cy) - h / 2;
    lv_area_t a = { x0, y0, x0 + w - 1, y0 + h - 1 };
    lv_draw_image(L, &im, &a);
}

static void text_at(const char *t, const lv_font_t *f, uint32_t col, float cx, float cy)
{
    lv_point_t sz;
    lv_text_get_size(&sz, t, f, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    if (!seen(cx - sz.x / 2.0f, cy - sz.y / 2.0f, cx + sz.x / 2.0f, cy + sz.y / 2.0f)) return;
    lv_draw_label_dsc_t d;
    lv_draw_label_dsc_init(&d);
    d.text = t;
    d.text_local = 1;   /* t is gone by the time it's drawn */
    d.font = f;
    d.color = COL(col);
    int32_t x0 = OX + lroundf(cx) - sz.x / 2, y0 = OY + lroundf(cy) - sz.y / 2;
    lv_area_t a = { x0, y0, x0 + sz.x, y0 + sz.y };
    lv_draw_label(L, &d, &a);
}

/* The end of a game: a lime pill in the middle (a tap anywhere starts the next) */
static void again_pill(void)
{
    static const char *const t = "Tap to play again";
    lv_point_t sz;
    lv_text_get_size(&sz, t, F_PILL, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    float w = 18 + 24 + 8 + sz.x + 20, x0 = 233 - w / 2;
    box(x0, AGAIN_Y - 24, x0 + w, AGAIN_Y + 24, C_ACTION, LV_RADIUS_CIRCLE, LV_OPA_COVER, 0, 0);
    icon_at("retry", 24, x0 + 18 + 12, AGAIN_Y, C_ON_COLOR);
    text_at(t, F_PILL, C_ON_COLOR, x0 + 18 + 24 + 8 + sz.x / 2.0f, AGAIN_Y + 1);
}

/* Snack Trail's treat and Maze Munch's big snack: a round cookie with three chips */
static void cookie(float cx, float cy, float r)
{
    disc(cx, cy, r, K_COOKIE);
    float k = r / 11.0f;
    disc(cx - 4 * k, cy - 3 * k, 1.8f * k, K_CHIP);
    disc(cx + 3.5f * k, cy - 2.5f * k, 1.8f * k, K_CHIP);
    disc(cx + 0.5f * k, cy + 4 * k, 1.8f * k, K_CHIP);
}

/* ================================================================ Snack Trail */
/* Figma "Snack Trail · Grid": a 15 x 9 grid of dots, 26 apart (its end columns rounded off), the trail
 * in 22 px mint squares with a lime head, two cookies to eat. Swipe to steer; it speeds up with every
 * cookie. The edges let it through to the other side and biting its own tail only cuts the tail off:
 * only a chili ends it ("Too spicy!"), and there are more of them the longer it gets. */
#define TR_COLS 15
#define TR_ROWS 9
#define TR_X0 51
#define TR_Y0 139
#define TR_STEP 26
#define TR_MAX (TR_COLS * TR_ROWS)
#define TR_START_MS 330      /* a step every 330 ms at first */
#define TR_FAST_MS 175       /* never quicker than this */
#define TR_FASTER_MS 5       /* each cookie takes this off */
#define TR_CHILIES 8         /* 2 at first, one more every 2 cookies, up to this */

static const int8_t DX4[4] = { 1, 0, -1, 0 }, DY4[4] = { 0, 1, 0, -1 };   /* right, down, left, up */

static struct {
    int8_t x[TR_MAX], y[TR_MAX];
    int len, grow, dir, q[2], nq, peak, eaten;
    bool held;               /* it stopped one step short of a chili, for a late turn */
    int8_t tx[2], ty[2];
    int8_t hx_[TR_CHILIES], hy_[TR_CHILIES];
    int chilies;
    float acc, bit_t;        /* bit_t: when it last bit its tail (the cut flashes) */
    int every;
} tr;

static bool tr_ok(int i, int j)
{
    return i >= 0 && i < TR_COLS && j >= 0 && j < TR_ROWS && ((i >= 1 && i <= TR_COLS - 2) || (j >= 1 && j <= TR_ROWS - 3));
}
static float tr_cx(int i) { return TR_X0 + TR_STEP * i; }
static float tr_cy(int j) { return TR_Y0 + TR_STEP * j; }
static int tr_body_at(int i, int j, int upto)
{
    for (int k = 0; k < upto; k++) if (tr.x[k] == i && tr.y[k] == j) return k;
    return -1;
}
static int tr_chili_at(int i, int j)
{
    for (int k = 0; k < tr.chilies; k++) if (tr.hx_[k] == i && tr.hy_[k] == j) return k;
    return -1;
}
static bool tr_cookie_at(int i, int j) { return (tr.tx[0] == i && tr.ty[0] == j) || (tr.tx[1] == i && tr.ty[1] == j); }
static void tr_inv(int i, int j) { inv_box(tr_cx(i), tr_cy(j), 15); }

/* a free spot: on the grid, not on the trail, a cookie or a chili; `room` steps clear of the head */
static bool tr_spot(int *pi, int *pj, int room)
{
    for (int tries = 0; tries < 500; tries++) {
        int i = rand_int(TR_COLS), j = rand_int(TR_ROWS);
        if (!tr_ok(i, j) || tr_body_at(i, j, tr.len) >= 0 || tr_cookie_at(i, j) || tr_chili_at(i, j) >= 0) continue;
        if (abs(i - tr.x[0]) + abs(j - tr.y[0]) < room) continue;
        *pi = i;
        *pj = j;
        return true;
    }
    return false;
}

static void tr_treat(int n)
{
    int i, j;
    tr.tx[n] = tr.ty[n] = -1;
    if (!tr_spot(&i, &j, 2)) return;
    tr.tx[n] = (int8_t)i;
    tr.ty[n] = (int8_t)j;
    tr_inv(i, j);
}

/* a new chili, never right in front of it */
static void tr_add_chili(void)
{
    int i, j;
    if (tr.chilies >= TR_CHILIES || !tr_spot(&i, &j, 4)) return;
    tr.hx_[tr.chilies] = (int8_t)i;
    tr.hy_[tr.chilies] = (int8_t)j;
    tr.chilies++;
    tr_inv(i, j);
}

static void tr_reset(void)
{
    cl.again = false;
    memset(&tr, 0, sizeof tr);
    tr.len = tr.peak = 4;
    tr.every = TR_START_MS;
    tr.bit_t = -1000;
    for (int k = 0; k < tr.len; k++) { tr.x[k] = (int8_t)(7 - k); tr.y[k] = 4; }
    tr.tx[0] = tr.tx[1] = tr.ty[0] = tr.ty[1] = -1;
    tr_treat(0);
    tr_treat(1);
    tr_add_chili();
    tr_add_chili();
    cl.score = tr.len;
    inv_all();
}

static void tr_turn(int d)
{
    int last = tr.nq ? tr.q[tr.nq - 1] : tr.dir;
    if (d == last || (d + 2) % 4 == last || tr.nq >= 2) return;
    tr.q[tr.nq++] = d;
}

/* off an edge: in again from the other side of the same row or column */
static void tr_wrap(int *i, int *j, int dir)
{
    if (tr_ok(*i, *j)) return;
    if (DX4[dir]) for (*i = DX4[dir] > 0 ? 0 : TR_COLS - 1; !tr_ok(*i, *j); *i += DX4[dir]) {}
    else for (*j = DY4[dir] > 0 ? 0 : TR_ROWS - 1; !tr_ok(*i, *j); *j += DY4[dir]) {}
}

static void tr_move(void)
{
    if (tr.nq) { tr.dir = tr.q[0]; tr.q[0] = tr.q[1]; tr.nq--; }
    int hx = tr.x[0] + DX4[tr.dir], hy = tr.y[0] + DY4[tr.dir];
    tr_wrap(&hx, &hy, tr.dir);
    int spicy = tr_chili_at(hx, hy);
    /* one step's grace before a chili: a turn swiped a moment late still saves it */
    if (spicy >= 0 && !tr.held) { tr.held = true; return; }
    tr.held = false;
    bool grows = tr.grow > 0 && spicy < 0;
    int bite = spicy >= 0 ? -1 : tr_body_at(hx, hy, grows ? tr.len : tr.len - 1);
    if (bite >= 1) {
        /* it bit its own tail: the tail from there comes off */
        for (int k = bite; k < tr.len; k++) tr_inv(tr.x[k], tr.y[k]);
        tr.len = bite < 2 ? 2 : bite;
        tr.grow = 0;
        grows = false;
        tr.bit_t = cl.t;
        hal_play(HAL_SOUND_MISS);
    }
    int tail_x = tr.x[tr.len - 1], tail_y = tr.y[tr.len - 1];
    if (grows) { tr.len++; tr.grow--; }
    for (int k = tr.len - 1; k > 0; k--) { tr.x[k] = tr.x[k - 1]; tr.y[k] = tr.y[k - 1]; }
    tr.x[0] = (int8_t)hx;
    tr.y[0] = (int8_t)hy;
    tr_inv(tail_x, tail_y);
    tr_inv(tr.x[1], tr.y[1]);
    tr_inv(hx, hy);
    if (spicy >= 0) {   /* it ate a chili: too spicy */
        cl.score = tr.peak;
        game_over();
        hal_play(HAL_SOUND_LOSE);
        inv_all();
        return;
    }
    for (int n = 0; n < 2; n++) {
        if (tr.tx[n] != hx || tr.ty[n] != hy) continue;
        tr.grow++;
        tr.every = tr.every - TR_FASTER_MS < TR_FAST_MS ? TR_FAST_MS : tr.every - TR_FASTER_MS;
        hal_play(HAL_SOUND_EAT);
        tr_treat(n);
        if (++tr.eaten % 2 == 0) tr_add_chili();
    }
    cl.score = tr.len + tr.grow;
    if (cl.score > tr.peak) tr.peak = cl.score;
}

static void tr_update(float dt)
{
    if (cl.state == ST_OVER && cl.t - cl.over_at < 1200) inv_all();   /* the bite flashes */
    if (cl.t - tr.bit_t < 450) for (int k = 0; k < tr.len; k++) tr_inv(tr.x[k], tr.y[k]);
    if (cl.state != ST_PLAY) return;
    tr.acc += dt;
    while (tr.acc >= tr.every && cl.state == ST_PLAY) {
        tr.acc -= tr.every;
        tr_move();
    }
}

/* the one thing not to eat: a red chili with a green stalk */
static void chili(float x, float y)
{
    disc(x - 5, y - 3, 5.5f, K_APPLE);
    disc(x, y + 1, 5.5f, K_APPLE);
    disc(x + 5, y + 5, 4.5f, K_APPLE);
    disc(x + 8.5f, y + 8, 2.8f, K_APPLE);
    seg(x - 8, y - 6, x - 11, y - 11, 3, C_DONE, LV_OPA_COVER);
    disc(x - 8, y - 6, 3, C_DONE);
}

static void tr_draw(void)
{
    static uint8_t occ[TR_MAX];
    memset(occ, 0, sizeof occ);
    for (int k = 0; k < tr.len; k++) occ[tr.y[k] * TR_COLS + tr.x[k]] = 1;
    for (int n = 0; n < 2; n++) if (tr.tx[n] >= 0) occ[tr.ty[n] * TR_COLS + tr.tx[n]] = 2;
    for (int k = 0; k < tr.chilies; k++) occ[tr.hy_[k] * TR_COLS + tr.hx_[k]] = 3;
    for (int j = 0; j < TR_ROWS; j++)
        for (int i = 0; i < TR_COLS; i++)
            if (tr_ok(i, j) && !occ[j * TR_COLS + i]) disc(tr_cx(i), tr_cy(j), 2, C_HILL_LINE);
    for (int n = 0; n < 2; n++) if (tr.tx[n] >= 0) cookie(tr_cx(tr.tx[n]), tr_cy(tr.ty[n]), 11.5f);
    bool over = cl.state == ST_OVER;
    for (int k = 0; k < tr.chilies; k++)
        if (!over || tr.hx_[k] != tr.x[0] || tr.hy_[k] != tr.y[0]) chili(tr_cx(tr.hx_[k]), tr_cy(tr.hy_[k]));
    bool flash = over && cl.t - cl.over_at < 1200 && ((int)((cl.t - cl.over_at) / 150) % 2 == 0);
    bool bit = cl.t - tr.bit_t < 450 && ((int)((cl.t - tr.bit_t) / 150) % 2 == 0);
    for (int k = tr.len - 1; k >= 1; k--) {
        float x = tr_cx(tr.x[k]), y = tr_cy(tr.y[k]);
        box(x - 11, y - 11, x + 11, y + 11, flash || bit ? C_LATE : C_DONE, 6, LV_OPA_COVER, 0, 0);
    }
    float hx = tr_cx(tr.x[0]), hy = tr_cy(tr.y[0]);
    box(hx - 12, hy - 12, hx + 12, hy + 12, flash ? C_LATE : C_ACTION, 7, LV_OPA_COVER, 0, 0);
    int d = tr.nq ? tr.q[0] : tr.dir;
    float fx = DX4[d], fy = DY4[d], lx = -fy, ly = fx;
    disc(hx + fx * 4 + lx * 5, hy + fy * 4 + ly * 5, 2.4f, C_ON_COLOR);
    disc(hx + fx * 4 - lx * 5, hy + fy * 4 - ly * 5, 2.4f, C_ON_COLOR);
}

static void tr_swipe(int d)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; tr.acc = 0; }
    if (cl.state == ST_PLAY) tr_turn(d);
}

static void tr_tap(void)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; tr.acc = 0; return; }
    if (cl.state == ST_OVER && cl.t - cl.over_at > AGAIN_MS) { tr_reset(); cl.state = ST_PLAY; }
}

/* ================================================================ Pet Pairs */
/* Figma "Pet Pairs · Hard": twelve 60 x 68 cards in 4 x 3, face down with a sparkle; turn two, keep a
 * pair, the rest turn back. Fewest turns wins. (An easier six-card game for younger children can
 * come later.) */
#define PP_N 12
#define PP_W 60
#define PP_H 68
#define PP_SHOW_MS 900

static const char *const PP_ICON[PP_N / 2] = { "star", "heart", "fish", "volume", "music", "moon" };

static struct {
    int8_t face[PP_N];
    uint8_t up[PP_N];          /* 0 down, 1 up, 2 found */
    int a, b;
    float hide_at;
    int pairs;
    float pop[PP_N];           /* when it was turned: it pops a little */
} pp;

static float pp_x(int k) { return 98 + 70 * (k % 4); }
static float pp_y(int k) { return 132 + 78 * (k / 4); }
static void pp_inv(int k) { inv(pp_x(k) - 5, pp_y(k) - 5, pp_x(k) + PP_W + 5, pp_y(k) + PP_H + 5); }

static void pp_reset(void)
{
    cl.again = false;
    memset(&pp, 0, sizeof pp);
    pp.a = pp.b = -1;
    for (int k = 0; k < PP_N; k++) pp.face[k] = (int8_t)(k / 2);
    for (int k = PP_N - 1; k > 0; k--) {
        int r = rand_int(k + 1);
        int8_t t = pp.face[k];
        pp.face[k] = pp.face[r];
        pp.face[r] = t;
    }
    for (int k = 0; k < PP_N; k++) pp.pop[k] = -1000;
    cl.score = 0;
    cl.state = ST_PLAY;
    inv_all();
}

static void pp_hide(void)
{
    if (pp.a < 0 || pp.b < 0) return;
    pp.up[pp.a] = pp.up[pp.b] = 0;
    pp_inv(pp.a);
    pp_inv(pp.b);
    pp.a = pp.b = -1;
    pp.hide_at = 0;
}

static void pp_tap(float x, float y)
{
    if (cl.state == ST_OVER) { if (cl.t - cl.over_at > AGAIN_MS) pp_reset(); return; }
    int k = -1;
    for (int i = 0; i < PP_N; i++)
        if (x >= pp_x(i) - 5 && x <= pp_x(i) + PP_W + 5 && y >= pp_y(i) - 5 && y <= pp_y(i) + PP_H + 5) k = i;
    if (k < 0 || pp.up[k]) return;
    if (pp.hide_at) pp_hide();   /* two still showing: they turn back first */
    pp.up[k] = 1;
    pp.pop[k] = cl.t;
    cl.score++;
    pp_inv(k);
    if (pp.a < 0) { pp.a = k; hal_play(HAL_SOUND_FLIP); return; }
    pp.b = k;
    if (pp.face[pp.a] != pp.face[pp.b]) { pp.hide_at = cl.t + PP_SHOW_MS; hal_play(HAL_SOUND_MISS); return; }
    pp.up[pp.a] = pp.up[pp.b] = 2;
    pp_inv(pp.a);
    pp_inv(pp.b);
    pp.a = pp.b = -1;
    if (++pp.pairs < PP_N / 2) { hal_play(HAL_SOUND_EAT); return; }
    game_over();
    hal_play(HAL_SOUND_DONE);
    fx_confetti(lv_obj_get_parent(cl.obj), CENTER, 240, 22, FX_PARTY, 6, 140);
}

static void pp_update(float dt)
{
    (void)dt;
    if (pp.hide_at && cl.t >= pp.hide_at) pp_hide();
    for (int k = 0; k < PP_N; k++) if (cl.t - pp.pop[k] < 200) pp_inv(k);
}

static void pp_draw(void)
{
    for (int k = 0; k < PP_N; k++) {
        float age = cl.t - pp.pop[k], g = age >= 0 && age < 200 ? 4 * sinf(age / 200 * PI_F) : 0;
        float x0 = pp_x(k) - g, y0 = pp_y(k) - g, x1 = pp_x(k) + PP_W + g, y1 = pp_y(k) + PP_H + g;
        float cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        if (pp.up[k] == 0) {
            box(x0, y0, x1, y1, C_CHIP, 12, LV_OPA_COVER, C_HILL_LINE, 1);
            icon_at("sparkles", 22, cx, cy, C_HILL_LINE);
        } else if (pp.up[k] == 1) {
            box(x0, y0, x1, y1, C_RAISED, 12, LV_OPA_COVER, C_SYSTEM, 2);
            icon_at(PP_ICON[pp.face[k]], 30, cx, cy, C_TEXT);
        } else {
            box(x0, y0, x1, y1, K_MATCHED, 12, LV_OPA_COVER, 0, 0);
            icon_at(PP_ICON[pp.face[k]], 30, cx, cy, C_DONE);
        }
    }
}

/* ================================================================ Snack Drop */
/* Figma "Snack Drop · Easy": apples, cookies and berries fall; the pill at the bottom ("Tap" and the
 * snack's picture) says which to tap. A right one counts; a wrong tap, or a right one dropping past,
 * costs one of three hearts. They fall faster as it goes well, and the snack to tap changes every 5
 * caught or 9 seconds ("Now tap the cookies!"). */
#define DR_MAX 8
#define DR_FLOOR 372
enum { SN_APPLE, SN_COOKIE, SN_BERRY, SN_KINDS };
static const char *const SN_PLURAL[SN_KINDS] = { "apples", "cookies", "berries" };

#define DR_SPEED 135.0f       /* px a second at first */
#define DR_SWITCH_MS 9000.0f  /* the snack to tap changes this often... */
#define DR_SWITCH_N 5         /* ...or after this many caught, whichever comes first */
#define DR_CALL_MS 1400.0f    /* "Tap the cookies!" in the middle for this long */
#define DR_EVERY 900.0f       /* a new snack about this often at first */

typedef struct { bool on; uint8_t kind; float x, y, vy; } drop_t;
static struct {
    drop_t d[DR_MAX];
    int target, lives;
    float spawn_in, every, speed;
    float pace;               /* how well it's going: up with every catch (more for a quick one), down a lot for a slip */
    float switch_in, call_t;  /* the snack to tap changes in this long; when it last did (it's called out) */
    int since;                /* caught since it last changed */
    float ring_x, ring_y, ring_t;   /* the last tap: a ring that grows and fades, the snack shrinking in it */
    bool ring_good;
    uint8_t ring_kind;
    float hurt_t;
} dr;

static float sn_r(int kind) { return kind == SN_BERRY ? 17.0f : 25.0f; }

static void snack(int kind, float x, float y, float s)
{
    float r = sn_r(kind) * s;
    if (kind == SN_APPLE) {
        disc(x, y + 1 * s, r, K_APPLE);
        seg(x, y - r + 2 * s, x + 1.5f * s, y - r - 4 * s, (int)fmaxf(2, 2.5f * s), 0x6B4A3A, LV_OPA_COVER);
        box(x + 2 * s, y - r - 5 * s, x + 11 * s, y - r + 1 * s, C_DONE, LV_RADIUS_CIRCLE, LV_OPA_COVER, 0, 0);
    } else if (kind == SN_COOKIE) {
        disc(x, y, r, K_YELLOW);
        static const int8_t CH[5][2] = { { -9, -7 }, { 6, -10 }, { 10, 4 }, { -3, 9 }, { -1, -1 } };
        for (int i = 0; i < 5; i++) disc(x + CH[i][0] * s * r / 25, y + CH[i][1] * s * r / 25, 2.8f * s, C_CHIP);
    } else {
        disc(x, y, r, C_SYSTEM);
        disc(x - r * 0.35f, y - r * 0.35f, r * 0.25f, 0xC9C0FA);
    }
}

static void dr_inv_pill(void) { inv(50, 376, 416, 430); }
static void dr_inv(const drop_t *d) { float r = sn_r(d->kind); inv(d->x - r - 4, d->y - r - 48, d->x + r + 14, d->y + r + 4); }

static void dr_reset(void)
{
    cl.again = false;
    memset(&dr, 0, sizeof dr);
    dr.target = SN_APPLE;
    dr.lives = 3;
    dr.pace = 0;
    dr.every = DR_EVERY;
    dr.speed = DR_SPEED;
    dr.spawn_in = 300;
    dr.switch_in = DR_SWITCH_MS;
    dr.call_t = -1000;
    dr.ring_t = dr.hurt_t = -1000;
    cl.score = 0;
    inv_all();
}

static void dr_spawn(void)
{
    for (int i = 0; i < DR_MAX; i++) {
        if (dr.d[i].on) continue;
        drop_t *d = &dr.d[i];
        d->on = true;
        /* the better it goes, the more of them are the wrong snack */
        float right = fmaxf(0.32f, 0.45f - dr.pace * 0.005f);
        d->kind = (uint8_t)(frand01() < right ? dr.target : (dr.target + 1 + rand_int(SN_KINDS - 1)) % SN_KINDS);
        /* across the top, clear of the last one */
        float x = 96;
        for (int tries = 0; tries < 8; tries++) {
            x = 96 + frand01() * 274;
            bool clear = true;
            for (int j = 0; j < DR_MAX; j++) if (j != i && dr.d[j].on && dr.d[j].y < 160 && fabsf(dr.d[j].x - x) < 56) clear = false;
            if (clear) break;
        }
        d->x = x;
        d->y = 78;
        d->vy = dr.speed * (0.85f + frand01() * 0.3f);
        dr_inv(d);
        return;
    }
}

/* faster and quicker to come as the pace goes up, easing off after a slip */
static void dr_set_pace(float pace)
{
    dr.pace = fmaxf(0, pace);
    dr.speed = fminf(340, DR_SPEED + dr.pace * 8);
    dr.every = fmaxf(360, DR_EVERY - dr.pace * 25);
}

static void dr_hurt(void)
{
    dr_set_pace(dr.pace - 4);
    dr.hurt_t = cl.t;
    dr_inv_pill();
    if (--dr.lives <= 0) {
        for (int i = 0; i < DR_MAX; i++) dr.d[i].on = false;
        game_over();
        hal_play(HAL_SOUND_LOSE);
        inv_all();
        return;
    }
    hal_play(HAL_SOUND_MISS);
    dr_inv_pill();
}

/* the next snack to tap: called out in the middle, the ring at the bottom shows it */
static void dr_switch(void)
{
    dr.target = (dr.target + 1) % SN_KINDS;
    dr.since = 0;
    dr.switch_in = DR_SWITCH_MS;
    dr.call_t = cl.t;
    hal_play(HAL_SOUND_CHIME);
    dr_inv_pill();
}

static void dr_update(float dt)
{
    if (cl.t - dr.call_t < DR_CALL_MS + 100) { inv(30, 216, 436, 284); dr_inv_pill(); }
    if (cl.t - dr.ring_t < 320) inv_box(dr.ring_x, dr.ring_y, 50);
    if (cl.t - dr.hurt_t < 500) dr_inv_pill();
    if (cl.state != ST_PLAY) return;
    if ((dr.switch_in -= dt) <= 0) dr_switch();
    if ((dr.spawn_in -= dt) <= 0) { dr_spawn(); dr.spawn_in = dr.every * (0.8f + frand01() * 0.4f); }
    for (int i = 0; i < DR_MAX; i++) {
        drop_t *d = &dr.d[i];
        if (!d->on) continue;
        dr_inv(d);
        d->y += d->vy * dt / 1000.0f;
        dr_inv(d);
        if (d->y - sn_r(d->kind) > DR_FLOOR) {
            d->on = false;
            if (d->kind == dr.target) { dr_hurt(); if (cl.state != ST_PLAY) return; }
        }
    }
}

static void dr_tap(float x, float y)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; return; }
    if (cl.state == ST_OVER) { if (cl.t - cl.over_at > AGAIN_MS) { dr_reset(); cl.state = ST_PLAY; } return; }
    int hit = -1;
    float best = 1e9f;
    for (int i = 0; i < DR_MAX; i++) {
        drop_t *d = &dr.d[i];
        if (!d->on) continue;
        float dx = x - d->x, dy = y - d->y, dd = dx * dx + dy * dy, r = sn_r(d->kind) + 12;
        if (dd > r * r) continue;
        if (d->kind == dr.target) dd -= 400;   /* a right one under the finger wins over a wrong one */
        if (dd < best) { best = dd; hit = i; }
    }
    if (hit < 0) return;
    drop_t *d = &dr.d[hit];
    dr.ring_x = d->x;
    dr.ring_y = d->y;
    dr.ring_t = cl.t;
    dr.ring_good = d->kind == dr.target;
    dr.ring_kind = d->kind;
    d->on = false;
    dr_inv(d);
    if (!dr.ring_good) { dr_hurt(); return; }
    cl.score++;
    dr_set_pace(dr.pace + (dr.ring_y < 230 ? 1.6f : 1));   /* caught high up: a quick one */
    hal_play(HAL_SOUND_POP);
    if (++dr.since >= DR_SWITCH_N) dr_switch();   /* a new snack to catch */
    dr_inv_pill();
}

static void dr_draw(void)
{
    for (int i = 0; i < DR_MAX; i++) {
        const drop_t *d = &dr.d[i];
        if (!d->on) continue;
        float r = sn_r(d->kind);
        seg(d->x, d->y - r - 40, d->x, d->y - r - 8, 2, K_STREAK, LV_OPA_COVER);
        snack(d->kind, d->x, d->y, 1);
    }
    float age = cl.t - dr.ring_t;
    if (age >= 0 && age < 300) {
        float k = age / 300;
        if (age < 200) snack(dr.ring_kind, dr.ring_x, dr.ring_y, 1 - age / 200);
        ring(dr.ring_x, dr.ring_y, 30 + 14 * k, 3, dr.ring_good ? C_ACTION : C_LATE, (lv_opa_t)(255 * (1 - k)));
    }
    /* the pill at the bottom: "Tap" and the snack to tap (its picture, not its name), then the count
     * and the hearts; at the end, the count and the best */
    bool hurt = cl.t - dr.hurt_t < 500;
    float called = cl.t - dr.call_t, pulse = called >= 0 && called < DR_CALL_MS ? fabsf(sinf(called / 140)) : 0;
    bool tap = cl.state != ST_OVER, hearts = cl.state == ST_PLAY;
    char rest[24];
    rest[0] = 0;
    if (cl.state == ST_OVER) snprintf(rest, sizeof rest, cl.new_best ? "New best %d!" : cl.best ? "%d \xC2\xB7 best %d" : "%d", cl.score, cl.best);
    else if (cl.state == ST_PLAY) snprintf(rest, sizeof rest, "\xC2\xB7  %d", cl.score);
    else if (cl.best) snprintf(rest, sizeof rest, "\xC2\xB7  best %d", cl.best);
    lv_point_t tw = { 0, 0 }, rw = { 0, 0 };
    if (tap) lv_text_get_size(&tw, "Tap", F_PILL, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    if (rest[0]) lv_text_get_size(&rw, rest, F_PILL, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    float w = 18 + (tap ? tw.x + 8 + 30 : 0) + (rest[0] ? (tap ? 10 : 0) + rw.x : 0) + (hearts ? 8 + 3 * 22 : 0) + 16;
    float x = 233 - w / 2;
    box(x, 382, x + w, 424, C_RAISED, LV_RADIUS_CIRCLE, LV_OPA_COVER, hurt ? C_LATE : C_ACTION, hurt || pulse > 0 ? 2 : 0);
    x += 18;
    if (tap) {
        text_at("Tap", F_PILL, C_CALM, x + tw.x / 2.0f, 403);
        x += tw.x + 8;
        snack(dr.target, x + 15, 404, (dr.target == SN_BERRY ? 0.82f : 0.56f) * (1 + 0.15f * pulse));
        x += 30 + (rest[0] ? 10 : 0);
    }
    if (rest[0]) { text_at(rest, F_PILL, C_CALM, x + rw.x / 2.0f, 403); x += rw.x; }
    if (hearts) for (int i = 0; i < 3; i++) icon_at("heart", 20, x + 8 + 11 + i * 22, 403, i < dr.lives ? C_LATE : C_CHIP);
    /* a new snack to tap: called out in the middle */
    if (called >= 0 && called < DR_CALL_MS) {
        char ct[24];
        snprintf(ct, sizeof ct, "Now tap the %s!", SN_PLURAL[dr.target]);
        lv_point_t cs;
        lv_text_get_size(&cs, ct, F_PILL, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
        float w = 16 + 36 + 8 + cs.x + 18, x0 = 233 - w / 2;
        box(x0, 226, x0 + w, 274, C_SYSTEM, LV_RADIUS_CIRCLE, LV_OPA_COVER, 0, 0);
        snack(dr.target, x0 + 16 + 18, 250, dr.target == SN_BERRY ? 0.9f : 0.7f);
        text_at(ct, F_PILL, C_ON_COLOR, x0 + 16 + 36 + 8 + cs.x / 2.0f, 251);
    }
}

/* ================================================================ Brick Bounce */
/* Figma "Brick Bounce · Bottom paddle": four rows of seven bricks, a lime paddle on a track round the
 * bottom of the screen, a ball. Slide a finger (or tip MyToki) to move the paddle; where the ball hits
 * it sends it that way. Three balls; every cleared wall comes back faster, its top row tougher. */
#define BB_COLS 7
#define BB_ROWS 4
#define BB_R 200.0f
#define BB_BALL 8.0f
#define BB_PAD 32.0f
#define BB_T0 30.0f
#define BB_T1 150.0f
#define BB_TRAIL 6

static const uint32_t BB_ROW_COL[BB_ROWS] = { C_LATE, K_YELLOW, C_DONE, C_SYSTEM };

static struct {
    uint8_t hit[BB_ROWS][BB_COLS];
    float x, y, vx, vy, speed, pad;
    bool served;
    int lives, level, left;
    float tx[BB_TRAIL], ty[BB_TRAIL];
    float trail_acc;
} bb;

static float bb_bx(int c) { return 71 + 47 * c; }
static float bb_by(int r) { return 132 + 24 * r; }

static void bb_inv_pad(float pad)
{
    float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f;
    for (int i = 0; i <= 4; i++) {
        float a = (pad - BB_PAD / 2 + BB_PAD * i / 4) * DEG;
        for (int k = -1; k <= 1; k += 2) {
            float r = BB_R + k * 7, x = 233 + r * cosf(a), y = 233 + r * sinf(a);
            x0 = fminf(x0, x); y0 = fminf(y0, y); x1 = fmaxf(x1, x); y1 = fmaxf(y1, y);
        }
    }
    inv(x0 - 3, y0 - 3, x1 + 3, y1 + 3);
}

static void bb_wall(void)
{
    bb.left = 0;
    for (int r = 0; r < BB_ROWS; r++)
        for (int c = 0; c < BB_COLS; c++) {
            bb.hit[r][c] = (uint8_t)(r == 0 && bb.level >= 2 ? 2 : 1);
            bb.left++;
        }
    inv(60, 126, 410, 230);
}

static void bb_place(void)
{
    float a = bb.pad * DEG, r = BB_R - 7 - BB_BALL - 2;
    bb.x = 233 + r * cosf(a);
    bb.y = 233 + r * sinf(a);
    for (int i = 0; i < BB_TRAIL; i++) { bb.tx[i] = bb.x; bb.ty[i] = bb.y; }
}

static void bb_reset(void)
{
    cl.again = false;
    memset(&bb, 0, sizeof bb);
    bb.lives = 3;
    bb.level = 1;
    bb.pad = 90;
    bb_wall();
    bb_place();
    cl.score = 0;
    inv_all();
}

static void bb_serve(void)
{
    bb.served = true;
    float a = (bb.pad + 180 + (frand01() * 40 - 20)) * DEG;
    bb.vx = cosf(a);
    bb.vy = sinf(a);
    bb.speed = 250 + 30 * (bb.level - 1);
    hal_play(HAL_SOUND_FLIP);
}

static void bb_hit_bricks(void)
{
    for (int r = 0; r < BB_ROWS; r++)
        for (int c = 0; c < BB_COLS; c++) {
            if (!bb.hit[r][c]) continue;
            float x0 = bb_bx(c), y0 = bb_by(r), x1 = x0 + 42, y1 = y0 + 18;
            float qx = clampf(bb.x, x0, x1), qy = clampf(bb.y, y0, y1), dx = bb.x - qx, dy = bb.y - qy;
            if (dx * dx + dy * dy > BB_BALL * BB_BALL) continue;
            if (fabsf(dx) > fabsf(dy)) { if (dx * bb.vx < 0 || dx == 0) bb.vx = -bb.vx; }
            else if (dy * bb.vy < 0 || dy == 0) bb.vy = -bb.vy;
            inv(x0 - 2, y0 - 2, x1 + 2, y1 + 2);
            cl.score += 10 * (BB_ROWS - r) + 10 * (bb.level - 1);
            if (--bb.hit[r][c]) { hal_play(HAL_SOUND_POP); return; }
            hal_play(HAL_SOUND_POP);
            if (--bb.left == 0) {   /* the wall's gone: the next, faster */
                bb.level++;
                bb.served = false;
                bb_wall();
                bb_inv_pad(bb.pad);
                inv_box(bb.x, bb.y, 14);
                bb_place();
                snprintf(cl.msg, sizeof cl.msg, "Wall %d", bb.level);
                cl.msg_until = cl.t + 1400;
                hal_play(HAL_SOUND_WIN);
                inv_all();
            }
            return;
        }
}

static void bb_lose(void)
{
    bb.served = false;
    inv_all();
    if (--bb.lives <= 0) { game_over(); hal_play(HAL_SOUND_LOSE); return; }
    hal_play(HAL_SOUND_MISS);
    bb_place();
}

static void bb_move_pad(float to)
{
    to = clampf(to, BB_T0 + BB_PAD / 2, BB_T1 - BB_PAD / 2);
    if (fabsf(to - bb.pad) < 0.05f) return;
    bb_inv_pad(bb.pad);
    bb.pad = to;
    bb_inv_pad(bb.pad);
    if (!bb.served) { inv_box(bb.x, bb.y, 14); bb_place(); inv_box(bb.x, bb.y, 14); }
}

static void bb_update(float dt)
{
    if (cl.state == ST_OVER) return;
    /* a tip moves it too, when no finger is on it */
    if (!cl.down) {
        float tx, ty;
        motion_tilt(&tx, &ty);
        if (fabsf(tx) > 0.12f) bb_move_pad(bb.pad - tx * 150.0f * dt / 1000.0f);
    }
    if (!bb.served || cl.state != ST_PLAY) return;
    for (int i = 0; i < BB_TRAIL; i++) inv_box(bb.tx[i], bb.ty[i], 4);
    inv_box(bb.x, bb.y, BB_BALL + 3);
    float dist = bb.speed * dt / 1000.0f;
    int n = (int)ceilf(dist / 4.0f);
    float s = dist / (n ? n : 1);
    for (int i = 0; i < n && bb.served && cl.state == ST_PLAY; i++) {
        bb.x += bb.vx * s;
        bb.y += bb.vy * s;
        bb_hit_bricks();
        if (!bb.served) break;
        float dx = bb.x - 233, dy = bb.y - 233, d = sqrtf(dx * dx + dy * dy);
        if (d + BB_BALL < BB_R - 7) continue;
        float nx = dx / d, ny = dy / d, out = bb.vx * nx + bb.vy * ny, th = norm360(atan2f(dy, dx) / DEG);
        if (th >= BB_T0 && th <= BB_T1) {
            float off = adiff(th, bb.pad);
            if (fabsf(off) <= BB_PAD / 2 + 3 && out > 0 && d < BB_R + 4) {
                /* the paddle: where it hits sends it that way */
                float h = clampf(off / (BB_PAD / 2), -1, 1), ang = (th + 180 - h * 55) * DEG;
                bb.vx = cosf(ang);
                bb.vy = sinf(ang);
                float r = BB_R - 7 - BB_BALL;
                bb.x = 233 + nx * r;
                bb.y = 233 + ny * r;
                bb.speed = fminf(bb.speed + 4, 420);
                hal_play(HAL_SOUND_BOUNCE);
            } else if (d - BB_BALL > BB_R + 10) {
                bb_lose();
                break;
            }
        } else if (out > 0) {
            /* the rim sends it back */
            bb.vx -= 2 * out * nx;
            bb.vy -= 2 * out * ny;
            float r = BB_R - 7 - BB_BALL;
            bb.x = 233 + nx * r;
            bb.y = 233 + ny * r;
        }
        /* never nearly flat: it would take forever to come back */
        if (fabsf(bb.vy) < 0.22f) {
            bb.vy = bb.vy < 0 ? -0.22f : 0.22f;
            float k = sqrtf(1 - bb.vy * bb.vy);
            bb.vx = bb.vx < 0 ? -k : k;
        }
    }
    if ((bb.trail_acc += dt) >= 45) {
        bb.trail_acc = 0;
        memmove(&bb.tx[1], &bb.tx[0], sizeof(float) * (BB_TRAIL - 1));
        memmove(&bb.ty[1], &bb.ty[0], sizeof(float) * (BB_TRAIL - 1));
        bb.tx[0] = bb.x;
        bb.ty[0] = bb.y;
    }
    for (int i = 0; i < BB_TRAIL; i++) inv_box(bb.tx[i], bb.ty[i], 4);
    inv_box(bb.x, bb.y, BB_BALL + 3);
}

static void bb_draw(void)
{
    for (int r = 0; r < BB_ROWS; r++)
        for (int c = 0; c < BB_COLS; c++) {
            if (!bb.hit[r][c]) continue;
            float x0 = bb_bx(c), y0 = bb_by(r);
            box(x0, y0, x0 + 42, y0 + 18, BB_ROW_COL[r], 5, LV_OPA_COVER, 0, 0);
            if (bb.hit[r][c] > 1) seg(x0 + 9, y0 + 9, x0 + 33, y0 + 9, 2, C_ON_COLOR, 120);   /* a tough one: hit twice */
        }
    arc(233, 233, BB_R, 8, BB_T0, BB_T1, C_RAISED, true);
    arc(233, 233, BB_R, 10, bb.pad - BB_PAD / 2, bb.pad + BB_PAD / 2, C_ACTION, true);
    if (bb.served) for (int i = 1; i < BB_TRAIL; i++) disc(bb.tx[i], bb.ty[i], 1.6f, C_HILL_LINE);
    if (cl.state != ST_OVER) disc(bb.x, bb.y, BB_BALL, C_TEXT);
}

static void bb_tap(void)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; bb_serve(); return; }
    if (cl.state == ST_OVER) { if (cl.t - cl.over_at > AGAIN_MS) { bb_reset(); cl.state = ST_PLAY; } return; }
    if (!bb.served) bb_serve();
}

/* ================================================================ Maze Munch */
/* Figma "Maze Munch · Round maze": four rings of wall round a little home, with openings, and spokes
 * across some of the paths; snacks along the paths, a big cookie on each side, three puffs. Steer by
 * tipping MyToki or swiping the way to go; the muncher takes the first turn that way. A big cookie
 * makes the puffs run (and you can catch them); a puff catching you costs one of three lives. Every
 * cleared maze comes back faster. */
#define MZ_CX 233.0f
#define MZ_CY 238.0f
#define MZ_PUFFS 3
#define MZ_SNACKS 24
#define MZ_SCARED_MS 8000.0f
#define MZ_ME_SPEED 82.0f       /* px a second */
#define MZ_PUFF_SPEED 50.0f
#define MZ_SCARED_SPEED 38.0f
#define MZ_CATCH 16.0f          /* how near a puff must come */
/* the puffs rest (wander) for 7 s, then hunt for 13, over and over, starting with a rest */
#define MZ_REST_MS 7000.0f
#define MZ_ROUND_MS 20000.0f

static const float MZ_WALL[4] = { 49, 91, 133, 175 };
static const float MZ_COR[3] = { 70, 112, 154 };
static const int16_t MZ_GAPS[3][3] = { { 270, -1, -1 }, { 90, 200, 340 }, { 45, 135, 270 } };   /* in walls 0 (home), 1, 2 */
static const int16_t MZ_SPOKES[3][3] = { { -1, -1, -1 }, { 20, 150, -1 }, { 330, 90, 210 } };  /* across paths 0, 1, 2 */
static const int MZ_NSNACK[3] = { 12, 18, 24 };
static const uint32_t MZ_PUFF_COL[MZ_PUFFS] = { K_PUFF_MINT, K_YELLOW, C_PINK };

typedef struct {
    float r, a;          /* where (from the middle; degrees, 0 = 3 o'clock, clockwise) */
    int ring;            /* the path it's on (0..2), -1 home */
    int mode;            /* 0 along the path, 1 through an opening */
    int dir;             /* along: +1 clockwise, -1 the other way, 0 still; through: +1 out, -1 in */
    int from, to;        /* through: the path (or -1 home) it left and the one it's heading for */
    float fx, fy;        /* the way it last moved, for the eyes and the mouth */
} mz_mover_t;

static struct {
    mz_mover_t me, puff[MZ_PUFFS];
    float release[MZ_PUFFS];      /* when each puff leaves home */
    bool out[MZ_PUFFS];
    uint8_t eaten[3][MZ_SNACKS];
    float snack_a[3][MZ_SNACKS];
    bool big[2];
    int left, lives, level;
    float scared_until, pause_until, mouth;
    float round0;                 /* when the puffs' rest-and-hunt rounds began */
    bool started;                 /* play has begun (puffs leave home counting from then) */
} mz;

static float mz_x(const mz_mover_t *m) { return MZ_CX + m->r * cosf(m->a * DEG); }
static float mz_y(const mz_mover_t *m) { return MZ_CY + m->r * sinf(m->a * DEG); }
static void mz_inv(const mz_mover_t *m) { inv_box(mz_x(m), mz_y(m), 19); }
static float mz_margin(int ring) { return 13.0f / MZ_COR[ring] / DEG; }   /* a spoke: stop this far short */

/* the move vectors here: 0 clockwise, 1 the other way, 2 out, 3 in */
static void mz_vec(const mz_mover_t *m, int k, float *x, float *y)
{
    float c = cosf(m->a * DEG), s = sinf(m->a * DEG);
    switch (k) {
    case 0: *x = -s; *y = c; break;
    case 1: *x = s; *y = -c; break;
    case 2: *x = c; *y = s; break;
    default: *x = -c; *y = -s; break;
    }
}

static bool mz_at_gap(int wall, float a)
{
    if (wall < 0 || wall > 2) return false;
    for (int i = 0; i < 3; i++) if (MZ_GAPS[wall][i] >= 0 && fabsf(adiff(a, MZ_GAPS[wall][i])) < 0.6f) return true;
    return false;
}

static bool mz_blocked(int ring, float a, int dir)
{
    for (int i = 0; i < 3; i++) {
        int sp = MZ_SPOKES[ring][i];
        if (sp < 0) continue;
        float d = dir > 0 ? norm360(sp - a) : norm360(a - sp);
        if (d <= mz_margin(ring) + 0.05f) return true;
    }
    return false;
}

static void mz_open(const mz_mover_t *m, bool puff, bool open[4])
{
    open[0] = !mz_blocked(m->ring, m->a, 1);
    open[1] = !mz_blocked(m->ring, m->a, -1);
    open[2] = m->ring < 2 && mz_at_gap(m->ring + 1, m->a);
    open[3] = m->ring > 0 && mz_at_gap(m->ring, m->a);   /* home is only for puffs leaving it */
    (void)puff;
}

static void mz_take(mz_mover_t *m, int k)
{
    if (k <= 1) { m->mode = 0; m->dir = k == 0 ? 1 : -1; }
    else { m->mode = 1; m->dir = k == 2 ? 1 : -1; m->from = m->ring; m->to = m->ring + (k == 2 ? 1 : -1); }
    mz_vec(m, k, &m->fx, &m->fy);
}

/* The puffs find their way: every path cut into 5-degree steps, and how many steps each is from the
 * muncher (walls, spokes and openings as they are), worked out again every frame. */
#define MZ_BINS 72
static uint8_t mz_dist[3][MZ_BINS];
static const float MZ_WANDER[MZ_PUFFS] = { 0.25f, 0.45f, 0.65f };   /* mint hunts, pink mostly wanders */

static int mz_bin(float a) { return ((int)floorf(norm360(a) / 5.0f)) % MZ_BINS; }

static bool mz_has(const int16_t list[3], int deg)
{
    for (int i = 0; i < 3; i++) if (list[i] == deg) return true;
    return false;
}

static void mz_paths(void)
{
    memset(mz_dist, 255, sizeof mz_dist);
    int q[3 * MZ_BINS], head = 0, n = 0;
    int r0 = mz.me.mode == 1 ? mz.me.from : mz.me.ring, b0 = mz_bin(mz.me.a);
    if (r0 < 0) return;
    mz_dist[r0][b0] = 0;
    q[n++] = r0 * MZ_BINS + b0;
    while (head < n) {
        int v = q[head++], r = v / MZ_BINS, b = v % MZ_BINS, d = mz_dist[r][b] + 1, nr[4], nb[4], k = 0;
        if (!mz_has(MZ_SPOKES[r], (b + 1) % MZ_BINS * 5)) { nr[k] = r; nb[k++] = (b + 1) % MZ_BINS; }
        if (!mz_has(MZ_SPOKES[r], b * 5)) { nr[k] = r; nb[k++] = (b + MZ_BINS - 1) % MZ_BINS; }
        if (r < 2 && mz_has(MZ_GAPS[r + 1], b * 5)) { nr[k] = r + 1; nb[k++] = b; }
        if (r > 0 && mz_has(MZ_GAPS[r], b * 5)) { nr[k] = r - 1; nb[k++] = b; }
        for (int i = 0; i < k; i++) {
            if (mz_dist[nr[i]][nb[i]] != 255) continue;
            mz_dist[nr[i]][nb[i]] = (uint8_t)d;
            q[n++] = nr[i] * MZ_BINS + nb[i];
        }
    }
}

/* how far from the muncher a move leads */
static int mz_far(const mz_mover_t *m, int k)
{
    switch (k) {
    case 0: return mz_dist[m->ring][mz_bin(m->a + 2.6f)];
    case 1: return mz_dist[m->ring][mz_bin(m->a - 2.6f)];
    case 2: return m->ring < 2 ? mz_dist[m->ring + 1][mz_bin(m->a)] : 255;
    default: return m->ring > 0 ? mz_dist[m->ring - 1][mz_bin(m->a)] : 255;
    }
}

/* At a turn. A puff takes the way that leads to the muncher (away from it while scared), now and
 * then a random one, and never turns straight back unless it must. The muncher takes the open move
 * most like (wx, wy), and keeps going unless a turn is clearly the way. Returns false if nothing
 * suits (it stays still). */
static bool mz_choose(mz_mover_t *m, int puff, float wx, float wy)
{
    bool open[4];
    mz_open(m, puff >= 0, open);
    int cur = m->mode == 0 && m->dir ? (m->dir > 0 ? 0 : 1) : -1, rev = cur < 0 ? -1 : cur ^ 1;
    if (puff >= 0) {
        int n = 0, opts[4];
        for (int k = 0; k < 4; k++) if (open[k] && k != rev) opts[n++] = k;
        if (!n && rev >= 0 && open[rev]) opts[n++] = rev;
        if (!n) { m->dir = 0; return false; }
        bool scared = cl.t < mz.scared_until, rest = fmodf(cl.t - mz.round0, MZ_ROUND_MS) < MZ_REST_MS;
        int pick = opts[0];
        if (frand01() < (scared ? 0.3f : rest ? 0.85f : MZ_WANDER[puff])) pick = opts[rand_int(n)];
        else
            for (int i = 1; i < n; i++) {
                int a = mz_far(m, opts[i]), b = mz_far(m, pick);
                if (scared ? a > b && a != 255 : a < b) pick = opts[i];
            }
        mz_take(m, pick);
        return true;
    }
    float len = sqrtf(wx * wx + wy * wy);
    if (len < 0.01f) { if (cur >= 0 && open[cur]) return true; m->dir = 0; return false; }
    wx /= len; wy /= len;
    int pick = -1;
    float best = 0.3f;
    for (int k = 0; k < 4; k++) {
        if (!open[k] || k == rev) continue;   /* turning back is the child's call (mz_advance) */
        float x, y;
        mz_vec(m, k, &x, &y);
        float d = x * wx + y * wy + (k == cur ? 0.25f : 0);
        if (d > best) { best = d; pick = k; }
    }
    if (pick < 0) { if (cur >= 0 && open[cur]) return true; m->dir = 0; return false; }
    mz_take(m, pick);
    return true;
}

/* move m along the paths by s px */
static void mz_advance(mz_mover_t *m, float s, int puff)
{
    for (int guard = 0; guard < 8 && s > 0.01f; guard++) {
        float wx = cl.want_x, wy = cl.want_y;
        if (puff < 0 && m->dir) {
            /* the muncher turns straight back the moment the child asks */
            float vx, vy;
            mz_vec(m, m->mode == 0 ? (m->dir > 0 ? 0 : 1) : (m->dir > 0 ? 2 : 3), &vx, &vy);
            if (vx * wx + vy * wy < -0.6f * sqrtf(wx * wx + wy * wy)) {
                m->dir = -m->dir;
                if (m->mode == 1) { int t = m->from; m->from = m->to; m->to = t; }
                m->fx = -vx;
                m->fy = -vy;
            }
        }
        if (m->mode == 1) {
            float target = m->to < 0 ? 0 : MZ_COR[m->to], d = target - m->r, step = fminf(fabsf(d), s);
            m->r += d > 0 ? step : -step;
            s -= step;
            if (fabsf(target - m->r) > 0.01f) continue;
            m->r = target;
            m->ring = m->to;
            m->mode = 0;
            m->dir = 0;
            if (m->ring < 0) return;
            if (!mz_choose(m, puff, wx, wy)) return;
            continue;
        }
        if (m->dir == 0 && !mz_choose(m, puff, wx, wy)) return;
        if (m->mode == 1) continue;
        float r = MZ_COR[m->ring], left = s / r / DEG, next = left, gap = -1;
        bool spoke = false;
        for (int i = 0; i < 3; i++) {
            int sp = MZ_SPOKES[m->ring][i];
            if (sp < 0) continue;
            float d = (m->dir > 0 ? norm360(sp - m->a) : norm360(m->a - sp)) - mz_margin(m->ring);
            if (d >= 0 && d < next) { next = d; spoke = true; gap = -1; }
        }
        for (int w = m->ring; w <= m->ring + 1 && w <= 2; w++)
            for (int i = 0; i < 3; i++) {
                int g = MZ_GAPS[w][i];
                if (g < 0 || w == 0) continue;   /* home's opening is only for puffs leaving it */
                float d = m->dir > 0 ? norm360(g - m->a) : norm360(m->a - g);
                if (d > 0.01f && d < next) { next = d; gap = g; spoke = false; }
            }
        m->a = norm360(m->a + m->dir * next);
        s -= next * DEG * r;
        if (spoke) {
            m->dir = 0;
            if (puff >= 0) continue;
            /* the muncher waits at a wall for the next swipe (a tip held keeps it going) */
            cl.want_x = cl.want_y = 0;
            return;
        }
        if (gap >= 0) { m->a = gap; mz_choose(m, puff, wx, wy); continue; }
        break;
    }
}

static void mz_snacks(void)
{
    mz.left = 0;
    for (int k = 0; k < 3; k++)
        for (int i = 0; i < MZ_SNACKS; i++) {
            mz.eaten[k][i] = 1;
            if (i >= MZ_NSNACK[k]) continue;
            float a = norm360((i + 0.5f) * 360.0f / MZ_NSNACK[k] - 90);
            bool clear = true;
            for (int j = 0; j < 3; j++) if (MZ_SPOKES[k][j] >= 0 && fabsf(adiff(a, MZ_SPOKES[k][j])) < mz_margin(k) + 5) clear = false;
            if (k == 2 && (fabsf(adiff(a, 0)) < 8 || fabsf(adiff(a, 180)) < 8)) clear = false;   /* the big cookies */
            if (!clear) continue;
            mz.snack_a[k][i] = a;
            mz.eaten[k][i] = 0;
            mz.left++;
        }
    mz.big[0] = mz.big[1] = true;
    mz.left += 2;
}

static void mz_places(void)
{
    mz.me = (mz_mover_t){ .r = MZ_COR[2], .a = 45, .ring = 2, .fx = 1, .fy = 0 };   /* Figma: bottom right */
    for (int i = 0; i < MZ_PUFFS; i++) {
        mz.puff[i] = (mz_mover_t){ .r = 15.0f * (i - 1), .a = 0, .ring = -1, .fx = 0, .fy = -1 };
        mz.out[i] = false;
        mz.release[i] = cl.t + 2500 + i * 4500 - (mz.level - 1) * 300;
    }
    mz.scared_until = 0;
}

static void mz_reset(void)
{
    cl.again = false;
    memset(&mz, 0, sizeof mz);
    mz.lives = 3;
    mz.level = 1;
    cl.score = 0;
    mz_snacks();
    mz_places();
    inv_all();
}

static void mz_say(const char *t, float ms)
{
    snprintf(cl.msg, sizeof cl.msg, "%s", t);
    cl.msg_until = cl.t + ms;
    inv_box(MZ_CX, MZ_CY, 46);
}

static void mz_eat(void)
{
    if (mz.me.mode != 0) return;
    int k = mz.me.ring;
    for (int i = 0; i < MZ_NSNACK[k]; i++) {
        if (mz.eaten[k][i] || fabsf(adiff(mz.me.a, mz.snack_a[k][i])) > 5.5f) continue;
        mz.eaten[k][i] = 1;
        mz.left--;
        cl.score += 10;
        hal_play(HAL_SOUND_FLIP);
    }
    if (k == 2)
        for (int b = 0; b < 2; b++) {
            if (!mz.big[b] || fabsf(adiff(mz.me.a, b ? 180 : 0)) > 6) continue;
            mz.big[b] = false;
            mz.left--;
            cl.score += 50;
            mz.scared_until = cl.t + MZ_SCARED_MS;
            hal_play(HAL_SOUND_POWER);
        }
    if (mz.left <= 0) {   /* the maze cleared: the next, faster */
        mz.level++;
        char t[16];
        snprintf(t, sizeof t, "Maze %d", mz.level);
        mz_snacks();
        mz_places();
        mz.pause_until = cl.t + 1400;
        mz_say(t, 1400);
        hal_play(HAL_SOUND_WIN);
        inv_all();
    }
}

static void mz_update(float dt)
{
    mz.mouth += dt;
    if (cl.msg[0] && cl.t >= cl.msg_until) { cl.msg[0] = 0; inv_box(MZ_CX, MZ_CY, 46); }
    /* the way to go: a tip, when there is one, else the last swipe (a tip starts it too) */
    float tx, ty;
    motion_tilt(&tx, &ty);
    if (tx * tx + ty * ty > 0.09f && cl.state != ST_OVER) {
        cl.want_x = tx;
        cl.want_y = ty;
        if (cl.state == ST_READY) cl.state = ST_PLAY;
    }
    if (cl.state != ST_PLAY || cl.t < mz.pause_until) { mz_inv(&mz.me); return; }
    /* puffs still at home wait from when play really starts */
    if (cl.t - dt < mz.pause_until || !mz.started) {
        mz.started = true;
        mz.round0 = cl.t;
        for (int i = 0; i < MZ_PUFFS; i++) if (!mz.out[i]) mz.release[i] = fmaxf(mz.release[i], cl.t + 2500 + i * 4500 - (mz.level - 1) * 300);
    }
    float lv = 1 + 0.06f * (mz.level - 1), sec = dt / 1000.0f;
    mz_inv(&mz.me);
    mz_advance(&mz.me, MZ_ME_SPEED * lv * sec, -1);
    mz_inv(&mz.me);
    mz_eat();
    if (cl.state != ST_PLAY) return;
    mz_paths();
    bool scared = cl.t < mz.scared_until;
    for (int i = 0; i < MZ_PUFFS; i++) {
        mz_mover_t *p = &mz.puff[i];
        mz_inv(p);
        if (!mz.out[i]) {
            if (cl.t >= mz.release[i]) { mz.out[i] = true; p->mode = 1; p->dir = 1; p->from = -1; p->to = 0; p->r = 0; p->a = 270; }
            else { mz_inv(p); continue; }
        }
        mz_advance(p, (scared ? MZ_SCARED_SPEED : MZ_PUFF_SPEED) * lv * sec, i);
        mz_inv(p);
        float dx = mz_x(p) - mz_x(&mz.me), dy = mz_y(p) - mz_y(&mz.me);
        if (dx * dx + dy * dy > MZ_CATCH * MZ_CATCH) continue;
        if (scared) {   /* caught a puff: home it goes */
            cl.score += 200;
            *p = (mz_mover_t){ .r = 15.0f * (i - 1), .a = 0, .ring = -1, .fx = 0, .fy = -1 };
            mz.out[i] = false;
            mz.release[i] = cl.t + 2500;
            hal_play(HAL_SOUND_EAT);
            continue;
        }
        /* a puff caught the muncher */
        if (--mz.lives <= 0) { game_over(); hal_play(HAL_SOUND_LOSE); inv_all(); return; }
        hal_play(HAL_SOUND_MISS);
        char t[16];
        snprintf(t, sizeof t, mz.lives == 1 ? "Last life!" : "%d lives left", mz.lives);
        mz_places();
        mz.pause_until = cl.t + 1300;
        mz_say(t, 1300);
        inv_all();
        return;
    }
}

static void mz_puff_draw(const mz_mover_t *p, uint32_t col, bool scared, bool blink)
{
    float x = mz_x(p), y = mz_y(p);
    uint32_t c = scared ? (blink ? C_TEXT : C_HILL_LINE) : col;
    disc(x, y - 2, 11, c);
    box(x - 11, y - 2, x + 11, y + 8, c, 0, LV_OPA_COVER, 0, 0);
    for (int k = -1; k <= 1; k++) disc(x + k * 7.3f, y + 8, 3.7f, c);
    if (scared) { disc(x - 4, y - 3, 1.8f, C_TEXT); disc(x + 4, y - 3, 1.8f, C_TEXT); return; }
    float ex = p->fx * 1.6f, ey = p->fy * 1.6f;
    disc(x - 4.5f, y - 3, 3.4f, C_TEXT);
    disc(x + 4.5f, y - 3, 3.4f, C_TEXT);
    disc(x - 4.5f + ex, y - 3 + ey, 1.7f, C_ON_COLOR);
    disc(x + 4.5f + ex, y - 3 + ey, 1.7f, C_ON_COLOR);
}

static void mz_draw(void)
{
    /* the walls: each ring broken at its openings (16 px each side), the spokes across the paths */
    for (int w = 0; w < 4; w++) {
        float r = MZ_WALL[w], half = 16.0f / r / DEG;
        int g[3], n = 0;
        if (w < 3) for (int i = 0; i < 3; i++) if (MZ_GAPS[w][i] >= 0) g[n++] = MZ_GAPS[w][i];
        if (!n) { arc(MZ_CX, MZ_CY, r, 4, 0, 360, K_WALL, false); continue; }
        for (int i = 0; i < n; i++) for (int j = i + 1; j < n; j++) if (g[j] < g[i]) { int t = g[i]; g[i] = g[j]; g[j] = t; }
        for (int i = 0; i < n; i++) {
            float a0 = g[i] + half, a1 = g[(i + 1) % n] - half + (i + 1 == n ? 360 : 0);
            if (n == 1) a1 = g[0] - half + 360;
            arc(MZ_CX, MZ_CY, r, 4, a0, a1, K_WALL, true);
        }
    }
    for (int k = 0; k < 3; k++)
        for (int i = 0; i < 3; i++) {
            int sp = MZ_SPOKES[k][i];
            if (sp < 0) continue;
            float c = cosf(sp * DEG), s = sinf(sp * DEG);
            seg(MZ_CX + MZ_WALL[k] * c, MZ_CY + MZ_WALL[k] * s, MZ_CX + MZ_WALL[k + 1] * c, MZ_CY + MZ_WALL[k + 1] * s, 4, K_WALL, LV_OPA_COVER);
        }
    /* the snacks and the two big cookies */
    for (int k = 0; k < 3; k++)
        for (int i = 0; i < MZ_NSNACK[k]; i++) {
            if (mz.eaten[k][i]) continue;
            float a = mz.snack_a[k][i] * DEG;
            disc(MZ_CX + MZ_COR[k] * cosf(a), MZ_CY + MZ_COR[k] * sinf(a), 3, C_TEXT);
        }
    for (int b = 0; b < 2; b++) if (mz.big[b]) cookie(MZ_CX + (b ? -MZ_COR[2] : MZ_COR[2]), MZ_CY, 11);
    /* the puffs, then the muncher */
    bool scared = cl.t < mz.scared_until, blink = scared && mz.scared_until - cl.t < 1500 && ((int)(cl.t / 180) % 2);
    for (int i = 0; i < MZ_PUFFS; i++) mz_puff_draw(&mz.puff[i], MZ_PUFF_COL[i], scared && mz.out[i], blink);
    if (cl.state != ST_OVER) {
        float x = mz_x(&mz.me), y = mz_y(&mz.me), face = atan2f(mz.me.fy, mz.me.fx) / DEG;
        float open = cl.state == ST_PLAY && mz.me.dir ? 6 + 34 * fabsf(sinf(mz.mouth / 110.0f)) : 26;
        lv_draw_arc_dsc_t a;
        if (seen(x - 14, y - 14, x + 14, y + 14)) {
            lv_draw_arc_dsc_init(&a);
            a.center.x = OX + lroundf(x);
            a.center.y = OY + lroundf(y);
            a.radius = 13;
            a.width = 13;
            a.color = COL(C_ACTION);
            a.opa = LV_OPA_COVER;
            a.start_angle = norm360(face + open);
            a.end_angle = norm360(face - open);
            lv_draw_arc(L, &a);
        }
    }
    if (cl.msg[0]) text_at(cl.msg, F_DETAIL, C_TEXT, MZ_CX, MZ_CY);
}

static void mz_swipe(int dx, int dy)
{
    if (cl.state == ST_READY) cl.state = ST_PLAY;
    float l = sqrtf((float)(dx * dx + dy * dy));
    if (l > 0) { cl.want_x = dx / l; cl.want_y = dy / l; }
}

static void mz_tap(void)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; return; }
    if (cl.state == ST_OVER && cl.t - cl.over_at > AGAIN_MS) { mz_reset(); cl.state = ST_PLAY; }
}

/* ================================================================ Roll home */
/* A marble maze: tip MyToki and the ball rolls that way, as if MyToki were a board in the hand (it
 * gathers speed, keeps rolling, bounces off the walls). Five rings of wall with openings, spokes that
 * close a path off, and holes: roll over one and the ball drops in and starts the maze again (the
 * clock keeps going). A hole to one side of a path can be passed by hugging the other wall; one in
 * the middle can't. Three mazes, each harder; the time for all three is the score, and the best is
 * the fastest. */
#define RL_CX 233.0f
#define RL_CY 233.0f         /* in the middle of the display (the header is the clock alone) */
#define RL_WALLS 6
#define RL_PATHS 5
static const float RL_WALL[RL_WALLS] = { 36, 63, 90, 117, 144, 171 };
static const float RL_COR[RL_PATHS] = { 49.5f, 76.5f, 103.5f, 130.5f, 157.5f };
#define RL_BALL 7.0f
#define RL_G 700.0f          /* px/s² at a full tip */
#define RL_DAMP 0.4f         /* how fast it slows by itself, per second: a heavy ball keeps rolling */
#define RL_VMAX 300.0f
#define RL_BOUNCE 0.4f       /* how much of its speed a wall gives back */
#define RL_GAP 13.0f         /* half an opening, px */
#define RL_HOME 20.0f        /* nearer the middle than this: home */
#define RL_HOLE 8.0f         /* a hole's size */
#define RL_DROP 5.5f         /* the ball's middle this near a hole's: in it goes */
#define RL_HOLE_OFF 5.0f     /* a hole to one side sits this far off the path's middle */
#define RL_FALL_MS 380.0f
#define RL_MAZES 3
#define RL_HOLES 10
#define RL_SEGS 560

/* a hole: which path, at what angle, which side (1 the outer wall's, -1 the inner's, 0 the middle) */
typedef struct { int8_t path, side; int16_t at; } rl_hole_t;
/* openings in walls 0 (home) to 4 and spokes across paths 0 to 4 (degrees, 0 = 3 o'clock,
 * clockwise; -1 none); where it starts on the outer path; the holes (path -1: none) */
typedef struct { int16_t gaps[RL_WALLS - 1][2], spokes[RL_PATHS][2], start; rl_hole_t hole[RL_HOLES]; } rl_maze_t;
#define NO_HOLE { -1, 0, 0 }
static const rl_maze_t RL_MAZE[RL_MAZES] = {
    /* in at the bottom, the top, the bottom...; spokes say which way round; holes to steer round */
    { { { 90, -1 }, { 270, -1 }, { 90, -1 }, { 270, -1 }, { 90, -1 } },
      { { 0, -1 }, { 180, -1 }, { 0, -1 }, { 180, -1 }, { -1, -1 } }, 270,
      { { 4, 0, 180 }, { 3, 1, 0 }, { 2, -1, 180 }, { 1, 1, 0 }, NO_HOLE, NO_HOLE, NO_HOLE, NO_HOLE, NO_HOLE, NO_HOLE } },
    /* a way in that's a dead end with a hole in it; the long way round, hugging one wall then the other */
    { { { 300, -1 }, { 100, -1 }, { 200, -1 }, { 60, -1 }, { 180, 300 } },
      { { 60, -1 }, { 230, -1 }, { 120, -1 }, { 240, 330 }, { -1, -1 } }, 0,
      { { 4, 0, 90 }, { 3, 0, 270 }, { 2, 1, 330 }, { 2, -1, 260 }, { 1, 1, 150 }, { 0, 1, 200 }, NO_HOLE, NO_HOLE, NO_HOLE, NO_HOLE } },
    /* holes on both sides of the outer path, holes just past openings for a ball that rolls too far */
    { { { 300, -1 }, { 200, -1 }, { 90, -1 }, { 120, -1 }, { 0, -1 } },
      { { 240, -1 }, { 120, -1 }, { 150, 60 }, { 30, -1 }, { -1, -1 } }, 180,
      { { 4, 1, 270 }, { 4, -1, 90 }, { 3, -1, 270 }, { 3, 1, 180 }, { 3, 0, 100 }, { 1, 1, 30 }, { 1, -1, 300 }, { 1, 0, 170 }, { 0, 1, 90 }, NO_HOLE } },
};

typedef struct { float x0, y0, x1, y1, r; } rl_seg_t;   /* r: the wall's radius (0 for a spoke), to skip far ones */
static rl_seg_t rl_seg[RL_SEGS];
static int rl_nseg;

static struct {
    int maze;
    float x, y, vx, vy;           /* where, how fast */
    float time;                   /* ms, all the mazes so far */
    float pause_until, bump_at;
    float fall_t, fall_x, fall_y; /* dropping into a hole: when, and the hole */
} rl;

static void rl_hole_xy(const rl_hole_t *h, float *x, float *y)
{
    float r = RL_COR[h->path] + h->side * RL_HOLE_OFF, a = h->at * DEG;
    *x = RL_CX + r * cosf(a);
    *y = RL_CY + r * sinf(a);
}

/* the solid parts of wall w between its openings, as [a0, a1] spans in degrees (a1 may pass 360) */
static int rl_spans(const rl_maze_t *m, int w, float span[3][2])
{
    float R = RL_WALL[w], half = RL_GAP / R / DEG;
    int g[2], n = 0;
    if (w < RL_WALLS - 1) for (int i = 0; i < 2; i++) if (m->gaps[w][i] >= 0) g[n++] = m->gaps[w][i];
    if (!n) { span[0][0] = 0; span[0][1] = 360; return 1; }
    if (n == 2 && g[1] < g[0]) { int t = g[0]; g[0] = g[1]; g[1] = t; }
    for (int i = 0; i < n; i++) {
        span[i][0] = g[i] + half;
        span[i][1] = (i + 1 < n ? g[i + 1] : g[0] + 360) - half;
    }
    return n;
}

static void rl_start_spot(void)
{
    float a = RL_MAZE[rl.maze].start * DEG;
    rl.x = RL_CX + RL_COR[RL_PATHS - 1] * cosf(a);
    rl.y = RL_CY + RL_COR[RL_PATHS - 1] * sinf(a);
    rl.vx = rl.vy = 0;
}

static void rl_build(void)
{
    const rl_maze_t *m = &RL_MAZE[rl.maze];
    rl_nseg = 0;
    for (int w = 0; w < RL_WALLS; w++) {
        float span[3][2], R = RL_WALL[w];
        int n = rl_spans(m, w, span);
        for (int i = 0; i < n; i++) {
            int steps = (int)ceilf((span[i][1] - span[i][0]) / 4.0f);
            for (int k = 0; k < steps && rl_nseg < RL_SEGS; k++) {
                float a0 = (span[i][0] + (span[i][1] - span[i][0]) * k / steps) * DEG;
                float a1 = (span[i][0] + (span[i][1] - span[i][0]) * (k + 1) / steps) * DEG;
                rl_seg[rl_nseg++] = (rl_seg_t){ RL_CX + R * cosf(a0), RL_CY + R * sinf(a0), RL_CX + R * cosf(a1), RL_CY + R * sinf(a1), R };
            }
        }
    }
    for (int k = 0; k < RL_PATHS; k++)
        for (int i = 0; i < 2; i++) {
            int sp = m->spokes[k][i];
            if (sp < 0 || rl_nseg >= RL_SEGS) continue;
            float c = cosf(sp * DEG), s = sinf(sp * DEG);
            rl_seg[rl_nseg++] = (rl_seg_t){ RL_CX + RL_WALL[k] * c, RL_CY + RL_WALL[k] * s, RL_CX + RL_WALL[k + 1] * c, RL_CY + RL_WALL[k + 1] * s, 0 };
        }
    rl_start_spot();
    inv_all();
}

static void rl_reset(void)
{
    cl.again = false;
    memset(&rl, 0, sizeof rl);
    rl.bump_at = rl.fall_t = -1000;
    cl.score = 0;
    rl_build();
}

static void rl_inv(void) { inv_box(rl.x, rl.y, RL_BALL + 6); }
static void rl_inv_clock(void) { inv(RL_CX - 32, RL_CY - 24, RL_CX + 32, RL_CY + 24); }

static void rl_home(void)
{
    hal_play(HAL_SOUND_WIN);
    if (rl.maze + 1 >= RL_MAZES) {
        cl.score = (int)rl.time;
        game_over();
        hal_play(HAL_SOUND_DONE);
        fx_confetti(lv_obj_get_parent(cl.obj), (int32_t)RL_CX, (int32_t)RL_CY, 18, FX_PARTY, 6, 120);
        inv_all();
        return;
    }
    rl.maze++;
    rl_build();
    snprintf(cl.msg, sizeof cl.msg, "Maze %d", rl.maze + 1);
    cl.msg_until = rl.pause_until = cl.t + 1300;
}

/* into a hole: it drops away, then waits at the start */
static void rl_fall(float hx, float hy)
{
    rl_inv();
    rl.fall_t = cl.t;
    rl.fall_x = hx;
    rl.fall_y = hy;
    rl.vx = rl.vy = 0;
    rl.pause_until = cl.t + RL_FALL_MS + 500;
    hal_play(HAL_SOUND_MISS);
}

static void rl_update(float dt)
{
    if (cl.msg[0] && cl.t >= cl.msg_until) { cl.msg[0] = 0; rl_inv_clock(); }
    /* the drop: once it's gone, back to the start */
    if (rl.fall_t >= 0 && cl.t - rl.fall_t < RL_FALL_MS + 40) inv_box(rl.fall_x, rl.fall_y, RL_HOLE + 2);
    if (rl.fall_t >= 0 && cl.t - rl.fall_t >= RL_FALL_MS) {
        rl.fall_t = -1000;
        rl_start_spot();
        snprintf(cl.msg, sizeof cl.msg, "Again!");
        cl.msg_until = cl.t + 700;
        rl_inv_clock();
    }
    float tx, ty;
    motion_tilt(&tx, &ty);
    if (cl.state == ST_READY && tx * tx + ty * ty > 0.06f) cl.state = ST_PLAY;   /* a tip starts it */
    if (cl.state != ST_PLAY) { rl_inv(); return; }
    rl.time += dt;
    if ((int)(rl.time / 100) != (int)((rl.time - dt) / 100)) rl_inv_clock();
    if (cl.t < rl.pause_until || rl.fall_t >= 0) { rl_inv(); return; }
    rl_inv();
    const rl_maze_t *m = &RL_MAZE[rl.maze];
    const float rr = RL_BALL + 2;
    for (int step = 0; step < 3; step++) {
        float h = dt / 3000.0f;
        rl.vx += RL_G * tx * h;
        rl.vy += RL_G * ty * h;
        float damp = expf(-RL_DAMP * h);
        rl.vx *= damp;
        rl.vy *= damp;
        float sp = sqrtf(rl.vx * rl.vx + rl.vy * rl.vy);
        if (sp > RL_VMAX) { rl.vx *= RL_VMAX / sp; rl.vy *= RL_VMAX / sp; }
        rl.x += rl.vx * h;
        rl.y += rl.vy * h;
        float d = hypotf(rl.x - RL_CX, rl.y - RL_CY), hit = 0;
        for (int pass = 0; pass < 2; pass++)
            for (int i = 0; i < rl_nseg; i++) {
                const rl_seg_t *g = &rl_seg[i];
                if (g->r > 0 && fabsf(d - g->r) > rr + 6) continue;
                float ex = g->x1 - g->x0, ey = g->y1 - g->y0, l2 = ex * ex + ey * ey;
                float t = l2 > 0 ? clampf(((rl.x - g->x0) * ex + (rl.y - g->y0) * ey) / l2, 0, 1) : 0;
                float qx = g->x0 + ex * t, qy = g->y0 + ey * t, nx = rl.x - qx, ny = rl.y - qy, dd = sqrtf(nx * nx + ny * ny);
                if (dd >= rr || dd < 0.001f) continue;
                nx /= dd;
                ny /= dd;
                rl.x = qx + nx * rr;
                rl.y = qy + ny * rr;
                float vn = rl.vx * nx + rl.vy * ny;
                if (vn < 0) {
                    rl.vx -= (1 + RL_BOUNCE) * vn * nx;
                    rl.vy -= (1 + RL_BOUNCE) * vn * ny;
                    if (-vn > hit) hit = -vn;
                }
                d = hypotf(rl.x - RL_CX, rl.y - RL_CY);
            }
        if (hit > 110 && cl.t - rl.bump_at > 150) { hal_play(HAL_SOUND_BOUNCE); rl.bump_at = cl.t; }
        if (d < RL_HOME) { rl_home(); return; }
        for (int i = 0; i < RL_HOLES; i++) {
            if (m->hole[i].path < 0) continue;
            float hx, hy;
            rl_hole_xy(&m->hole[i], &hx, &hy);
            if (hypotf(hx - rl.x, hy - rl.y) < RL_DROP) { rl_fall(hx, hy); return; }
        }
    }
    rl_inv();
}

/* the ball: shaded like a marble, light from the top left */
static void rl_ball(float x, float y, float r)
{
    if (r < 0.5f) return;
    disc(x, y, r, 0xB9B3A0);
    disc(x - r * 0.18f, y - r * 0.18f, r * 0.78f, 0xDCD6C2);
    disc(x - r * 0.3f, y - r * 0.3f, r * 0.5f, C_TEXT);
    disc(x - r * 0.4f, y - r * 0.4f, r * 0.2f, 0xFFFFFF);
}

static void rl_draw(void)
{
    const rl_maze_t *m = &RL_MAZE[rl.maze];
    for (int w = 0; w < RL_WALLS; w++) {
        float span[3][2];
        int n = rl_spans(m, w, span);
        for (int i = 0; i < n; i++) arc(RL_CX, RL_CY, RL_WALL[w], 4, span[i][0], span[i][1], K_WALL, span[i][1] - span[i][0] < 360);
    }
    for (int k = 0; k < RL_PATHS; k++)
        for (int i = 0; i < 2; i++) {
            int sp = m->spokes[k][i];
            if (sp < 0) continue;
            float c = cosf(sp * DEG), s = sinf(sp * DEG);
            seg(RL_CX + RL_WALL[k] * c, RL_CY + RL_WALL[k] * s, RL_CX + RL_WALL[k + 1] * c, RL_CY + RL_WALL[k + 1] * s, 4, K_WALL, LV_OPA_COVER);
        }
    /* the holes: dark, with a thin rim */
    for (int i = 0; i < RL_HOLES; i++) {
        if (m->hole[i].path < 0) continue;
        float hx, hy;
        rl_hole_xy(&m->hole[i], &hx, &hy);
        outline(hx, hy, RL_HOLE, C_HILL_LINE, 2, 0x03050B, LV_OPA_COVER);
    }
    /* home: the house and the time so far (or a word for a moment) */
    if (cl.msg[0]) text_at(cl.msg, F_DETAIL, C_TEXT, RL_CX, RL_CY);
    else {
        char t[16];
        int ms = (int)rl.time;
        snprintf(t, sizeof t, "%d:%02d.%d", ms / 60000, ms / 1000 % 60, ms / 100 % 10);
        icon_at("home", 16, RL_CX, RL_CY - 10, C_ACTION);
        text_at(t, F_DETAIL, C_TEXT, RL_CX, RL_CY + 10);
    }
    if (cl.state == ST_OVER) return;
    if (rl.fall_t >= 0) {   /* dropping in: it shrinks into the hole */
        float k = clampf((cl.t - rl.fall_t) / RL_FALL_MS, 0, 1);
        rl_ball(rl.fall_x + (rl.x - rl.fall_x) * (1 - k), rl.fall_y + (rl.y - rl.fall_y) * (1 - k), RL_BALL * (1 - k));
        return;
    }
    rl_ball(rl.x, rl.y, RL_BALL);
}

static void rl_tap(void)
{
    if (cl.state == ST_READY) { cl.state = ST_PLAY; return; }
    if (cl.state == ST_OVER && cl.t - cl.over_at > AGAIN_MS) { rl_reset(); cl.state = ST_PLAY; }
}

/* ================================================================ the surface */
static void on_draw(lv_event_t *e)
{
    L = lv_event_get_layer(e);
    clip = L->_clip_area;
    origin();
    /* the field (Figma "Field", a navy disc the size of the display): square, so each small redraw
     * doesn't work out a 233 px round corner; the corners are off the round screen anyway */
    box(0, 0, SCREEN_W, SCREEN_H, C_HILL, 0, LV_OPA_COVER, 0, 0);
    switch (cl.id) {
    case CL_TRAIL: tr_draw(); break;
    case CL_MAZE: mz_draw(); break;
    case CL_BRICKS: bb_draw(); break;
    case CL_PAIRS: pp_draw(); break;
    case CL_DROP: dr_draw(); break;
    case CL_ROLL: rl_draw(); break;
    default: break;
    }
    if (cl.msg[0] && cl.id == CL_BRICKS) text_at(cl.msg, F_PILL, C_TEXT, 233, 268);
    if (cl.again) again_pill();
}

/* a swipe, read while the finger is still down: a turn the moment it has gone far enough */
static void swiped(int dx, int dy)
{
    if (cl.id == CL_TRAIL) tr_swipe(abs(dx) > abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3));
    else if (cl.id == CL_MAZE) mz_swipe(dx, dy);
}

static void on_touch(lv_event_t *e)
{
    lv_event_code_t c = lv_event_get_code(e);
    lv_indev_t *in = lv_indev_active();
    if (!in || !cl.running) return;
    lv_point_t p;
    lv_indev_get_point(in, &p);
    origin();
    p.x -= OX;
    p.y -= OY;
    if (c == LV_EVENT_PRESSED) {
        cl.down = true;
        cl.dragged = false;
        cl.anchor = cl.last = p;
    } else if (c == LV_EVENT_PRESSING && cl.down) {
        int dx = p.x - cl.anchor.x, dy = p.y - cl.anchor.y;
        if (cl.id == CL_BRICKS) {
            /* the paddle follows the finger sideways (right at the bottom is the smaller angle) */
            if (abs(p.x - cl.anchor.x) > 6) cl.dragged = true;
            if (cl.state != ST_OVER) bb_move_pad(bb.pad - (p.x - cl.last.x) / BB_R / DEG);
        } else if (dx * dx + dy * dy > 24 * 24) {
            cl.dragged = true;
            swiped(dx, dy);
            cl.anchor = p;
        }
        cl.last = p;
    } else if (c == LV_EVENT_RELEASED || c == LV_EVENT_PRESS_LOST) {
        bool tap = cl.down && !cl.dragged && c == LV_EVENT_RELEASED;
        cl.down = false;
        if (!tap) return;
        switch (cl.id) {
        case CL_TRAIL: tr_tap(); break;
        case CL_MAZE: mz_tap(); break;
        case CL_BRICKS: bb_tap(); break;
        case CL_PAIRS: pp_tap(p.x, p.y); break;
        case CL_DROP: dr_tap(p.x, p.y); break;
        case CL_ROLL: rl_tap(); break;
        default: break;
        }
    }
}

static void tick(lv_timer_t *t)
{
    (void)t;
    if (!cl.running) return;
    uint32_t now = lv_tick_get();
    float dt = (float)lv_tick_diff(now, cl.last_ms);
    cl.last_ms = now;
    if (dt > 60) dt = 60;   /* a slow frame doesn't send things through walls */
    cl.t += dt;
    switch (cl.id) {
    case CL_TRAIL: tr_update(dt); break;
    case CL_MAZE: mz_update(dt); break;
    case CL_BRICKS: bb_update(dt); break;
    case CL_PAIRS: pp_update(dt); break;
    case CL_DROP: dr_update(dt); break;
    case CL_ROLL: rl_update(dt); break;
    default: break;
    }
    if (cl.msg[0] && cl.id == CL_BRICKS && cl.t >= cl.msg_until) { cl.msg[0] = 0; inv(120, 250, 346, 290); }
    if (cl.state == ST_OVER && !cl.again && cl.t - cl.over_at >= AGAIN_MS) { cl.again = true; inv(40, AGAIN_Y - 30, 426, AGAIN_Y + 30); }
}

/* Playtime went (or its goodbye cleared it): the game goes with its surface. */
static void on_delete(lv_event_t *e)
{
    (void)e;
    if (cl.timer) { lv_timer_delete(cl.timer); cl.timer = NULL; }
    cl.running = false;
    cl.obj = NULL;
}

lv_obj_t *classic_create(lv_obj_t *parent)
{
    memset(&cl, 0, sizeof cl);
    cl.obj = lv_obj_create(parent);
    lv_obj_remove_style_all(cl.obj);
    lv_obj_set_size(cl.obj, SCREEN_W, SCREEN_H);
    lv_obj_set_pos(cl.obj, 0, 0);
    lv_obj_remove_flag(cl.obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(cl.obj, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(cl.obj, on_draw, LV_EVENT_DRAW_MAIN, NULL);
    lv_obj_remove_flag(cl.obj, LV_OBJ_FLAG_SCROLL_CHAIN_HOR | LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_add_event_cb(cl.obj, on_touch, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(cl.obj, on_delete, LV_EVENT_DELETE, NULL);
    return cl.obj;
}

void classic_start(classic_id_t id)
{
    if (!cl.obj) return;
    classic_stop();
    cl.id = id;
    cl.running = true;
    cl.state = ST_READY;
    cl.t = 0;
    cl.msg[0] = 0;
    cl.again = false;
    cl.want_x = cl.want_y = 0;
    cl.best = best_load(id);
    cl.new_best = false;
    cl.last_ms = lv_tick_get();
    motion_level();   /* however it's held now is level */
    switch (id) {
    case CL_TRAIL: tr_reset(); break;
    case CL_MAZE: mz_reset(); break;
    case CL_BRICKS: bb_reset(); break;
    case CL_PAIRS: pp_reset(); break;   /* the cards are dealt: a tap turns one */
    case CL_DROP: dr_reset(); break;
    case CL_ROLL: rl_reset(); break;
    default: break;
    }
    lv_obj_remove_flag(cl.obj, LV_OBJ_FLAG_HIDDEN);
    cl.timer = lv_timer_create(tick, FRAME_MS, NULL);
    inv_all();
}

void classic_stop(void)
{
    if (cl.timer) { lv_timer_delete(cl.timer); cl.timer = NULL; }
    cl.running = false;
    cl.down = false;
    if (cl.obj) lv_obj_add_flag(cl.obj, LV_OBJ_FLAG_HIDDEN);
}

void classic_set_paused(bool paused)
{
    if (!cl.timer) return;
    if (paused) { lv_timer_pause(cl.timer); return; }
    cl.last_ms = lv_tick_get();   /* the dark doesn't count as a frame */
    lv_timer_resume(cl.timer);
}

bool classic_running(void) { return cl.running; }
classic_id_t classic_current(void) { return cl.id; }
bool classic_wide(void) { return cl.running && (cl.id == CL_MAZE || cl.id == CL_ROLL); }

bool classic_status(char *icon, size_t icon_n, char *text, size_t text_n)
{
    if (!cl.running) return false;
    icon[0] = text[0] = 0;
    const bool over = cl.state == ST_OVER, ready = cl.state == ST_READY;
    switch (cl.id) {
    case CL_TRAIL:
        snprintf(icon, icon_n, "utensils");
        if (ready) snprintf(text, text_n, (int)(cl.t / 2000) % 2 ? "Don't eat chilies" : "Swipe to steer");
        else if (over && cl.new_best) snprintf(text, text_n, "New best %d!", cl.score);
        else if (over) snprintf(text, text_n, "Too spicy! Length %d", cl.score);
        else if (cl.best) snprintf(text, text_n, "Length %d \xC2\xB7 best %d", cl.score, cl.best);
        else snprintf(text, text_n, "Length %d", cl.score);
        return true;
    case CL_PAIRS:
        snprintf(icon, icon_n, "eye");
        if (over && cl.new_best) snprintf(text, text_n, "New best %d flips!", cl.score);
        else if (!cl.score) snprintf(text, text_n, "Find the pairs");
        else if (cl.best) snprintf(text, text_n, "%d flips \xC2\xB7 best %d", cl.score, cl.best);
        else snprintf(text, text_n, "%d flips", cl.score);
        return true;
    case CL_MAZE:
        if (cl.state == ST_PLAY) return false;   /* Figma: the maze fills the screen */
        snprintf(icon, icon_n, ready ? "move" : "star-line");
        if (ready) snprintf(text, text_n, "Tip or swipe to move");
        else if (cl.new_best) snprintf(text, text_n, "New best %d!", cl.score);
        else if (cl.best) snprintf(text, text_n, "%d \xC2\xB7 best %d", cl.score, cl.best);
        else snprintf(text, text_n, "%d", cl.score);
        return true;
    case CL_BRICKS:
        if (cl.state == ST_PLAY && bb.served) return false;   /* Figma: nothing over the play */
        snprintf(icon, icon_n, ready || cl.state == ST_PLAY ? "pointer" : "star-line");
        if (ready) snprintf(text, text_n, "Slide, then tap to serve");
        else if (cl.state == ST_PLAY) snprintf(text, text_n, bb.lives == 1 ? "Last ball \xC2\xB7 tap to serve" : "%d balls \xC2\xB7 tap to serve", bb.lives);
        else if (cl.new_best) snprintf(text, text_n, "New best %d!", cl.score);
        else if (cl.best) snprintf(text, text_n, "%d \xC2\xB7 best %d", cl.score, cl.best);
        else snprintf(text, text_n, "%d", cl.score);
        return true;
    case CL_ROLL: {
        if (cl.state == ST_PLAY) return false;   /* the maze fills the screen */
        char now[12], best[12];
        snprintf(now, sizeof now, "%d:%02d.%d", cl.score / 60000, cl.score / 1000 % 60, cl.score / 100 % 10);
        snprintf(best, sizeof best, "%d:%02d.%d", cl.best / 60000, cl.best / 1000 % 60, cl.best / 100 % 10);
        snprintf(icon, icon_n, ready ? "move" : "timer");
        if (ready) snprintf(text, text_n, "Tip to roll the ball home");
        else if (cl.new_best) snprintf(text, text_n, "New best %s!", now);
        else if (cl.best) snprintf(text, text_n, "%s \xC2\xB7 best %s", now, best);
        else snprintf(text, text_n, "%s", now);
        return true;
    }
    default:
        return false;   /* Snack Drop draws its own */
    }
}

int classic_status_y(void) { return cl.running && cl.id == CL_BRICKS ? 336 : 381; }
