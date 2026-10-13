#include "fx.h"
#include "theme.h"
#include "widgets.h"
#include "../hal.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

const uint32_t FX_BRAND[7] = { C_LAVENDER, C_MINT, 0xEAB5DE, C_CORAL, C_SKY, 0xF7945A, C_BUTTER };
const uint32_t FX_PARTY[6] = { C_LAVENDER, C_MINT, 0xEAB5DE, C_CORAL, C_SKY, 0xF7945A };
const uint32_t FX_STARS[4] = { C_BUTTER, 0xEAB5DE, C_LAVENDER, C_SKY };
static uint32_t brand(uint32_t i) { return FX_BRAND[i % 7]; }

#define PI_F 3.14159265f
#define CREAM 0xFFFFF0
#define SALMON 0xF59A76

static uint32_t rnd(uint32_t n) { return n ? hal_random() % n : 0; }
static float frand(void) { return (float)rnd(10000) / 10000.0f; }
static float clampf(float v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
static float ease_out(float t) { t = 1 - clampf(t); return 1 - t * t * t; }
static float ease_in(float t) { t = clampf(t); return t * t * t; }
static float ease_in_out(float t) { t = clampf(t); return t < .5f ? 4 * t * t * t : 1 - powf(-2 * t + 2, 3) / 2; }
static float ease_out_expo(float t) { return t >= 1 ? 1 : 1 - powf(2, -10 * clampf(t)); }
static float ease_out_back(float t, float s) { t = clampf(t) - 1; return t * t * ((s + 1) * t + s) + 1; }
static lv_color_t mix(uint32_t a, uint32_t b, float t)
{
    t = clampf(t);
    int r = (int)(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    int g = (int)(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    int bl = (int)((a & 255) * (1 - t) + (b & 255) * t);
    return lv_color_make((uint8_t)r, (uint8_t)g, (uint8_t)bl);
}

/* A free-floating object: not laid out by a flex parent, not tappable. */
static lv_obj_t *loose(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_add_flag(o, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_remove_flag(o, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    return o;
}

static void free_user_data(lv_event_t *e) { lv_free(lv_obj_get_user_data(lv_event_get_target(e))); }
static void delete_var(lv_anim_t *a) { lv_obj_delete(a->var); }
static void free_anim_data(lv_anim_t *a) { lv_free(a->user_data); }

static int32_t anim_arg(void *var, lv_anim_exec_xcb_t cb)
{
    lv_anim_t *a = lv_anim_get(var, cb);
    return a ? (int32_t)(intptr_t)a->user_data : 0;
}

static void start_anim(lv_obj_t *o, lv_anim_exec_xcb_t exec, void *user, int32_t v0, int32_t v1, uint32_t ms, uint32_t delay,
                       lv_anim_path_cb_t path, lv_anim_completed_cb_t done)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, exec);
    lv_anim_set_user_data(&a, user);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_delay(&a, delay);
    lv_anim_set_path_cb(&a, path);
    lv_anim_set_early_apply(&a, false);
    lv_anim_set_completed_cb(&a, done);
    lv_anim_start(&a);
}

static void start_1000(lv_obj_t *o, lv_anim_exec_xcb_t exec, int32_t arg, uint32_t ms, uint32_t delay,
                       lv_anim_path_cb_t path, lv_anim_completed_cb_t done)
{
    lv_anim_delete(o, exec);
    start_anim(o, exec, (void *)(intptr_t)arg, 0, 1000, ms, delay, path, done);
}

/* ================================================================ timeline */
typedef struct { fx_cb_t fn; void *user; lv_obj_t *owner; lv_timer_t *timer; } at_t;

static void at_gone(lv_event_t *e)
{
    at_t *a = lv_event_get_user_data(e);
    lv_timer_delete(a->timer);
    lv_free(a);
}

static void at_fire(lv_timer_t *t)
{
    at_t *a = lv_timer_get_user_data(t);
    lv_obj_remove_event_cb_with_user_data(a->owner, at_gone, a);
    fx_cb_t fn = a->fn;
    void *user = a->user;
    lv_obj_t *owner = a->owner;
    lv_free(a);
    lv_timer_delete(t);
    fn(owner, user);
}

void fx_at(lv_obj_t *owner, uint32_t ms, fx_cb_t fn, void *user)
{
    if (!owner || !fn) return;
    at_t *a = lv_malloc(sizeof(at_t));
    a->fn = fn;
    a->user = user;
    a->owner = owner;
    a->timer = lv_timer_create(at_fire, ms ? ms : 1, a);
    lv_timer_set_repeat_count(a->timer, 1);
    lv_timer_set_auto_delete(a->timer, false);
    lv_obj_add_event_cb(owner, at_gone, LV_EVENT_DELETE, a);
}

/* ================================================================ confetti */
typedef struct {
    float x0, y0, vx, vy, k, g, life, phase, spin, flip;
    int32_t w, h;
    uint8_t shape;   /* 0 dot, 1 strip, 2 star */
} piece_t;

static void piece_exec(void *var, int32_t ms)
{
    lv_obj_t *o = var;
    piece_t *p = lv_obj_get_user_data(o);
    if (!p) return;
    float tau = ms / 1000.0f, e = expf(-p->k * tau);
    float x = p->x0 + p->vx / p->k * (1 - e);
    float y = p->y0 + p->vy / p->k * (1 - e) + p->g / p->k * (tau - (1 - e) / p->k);
    float a = tau > p->life - 0.4f ? clampf((p->life - tau) / 0.4f) : 1;
    int32_t h = p->h;
    if (p->shape == 1) {
        h = (int32_t)((float)p->h * fabsf(cosf(p->flip * tau + p->phase)));
        if (h < 2) h = 2;
        lv_obj_set_size(o, p->w, h);
    } else if (p->shape == 2) {
        lv_image_set_rotation(o, (int32_t)(p->spin * tau * 573) % 3600);
    }
    lv_obj_set_pos(o, (int32_t)x - p->w / 2, (int32_t)y - h / 2);
    lv_obj_set_style_opa(o, (lv_opa_t)(255 * a), 0);
}

static const fx_shoot_t BURST_SHOOT = { 240, 620, -90, 360, 90, 520, 2.1f, 1.3f, 2.4f, false };

void fx_confetti_ex(lv_obj_t *parent, int32_t cx, int32_t cy, int n, const uint32_t *colors, int ncolors, const fx_shoot_t *s)
{
    if (!parent || n <= 0 || ncolors <= 0) return;
    for (int i = 0; i < n; i++) {
        piece_t *p = lv_malloc_zeroed(sizeof(piece_t));
        float kind = frand();
        p->shape = s->dots_only ? 0 : kind < 0.12f ? 2 : kind < 0.55f ? 0 : 1;
        float ang = (s->angle_deg + (frand() * 2 - 1) * s->spread_deg) * PI_F / 180.0f;
        float speed = s->speed_min + frand() * (s->speed_max - s->speed_min);
        p->x0 = (float)cx;
        p->y0 = (float)cy;
        p->vx = cosf(ang) * speed;
        p->vy = sinf(ang) * speed - s->lift;
        p->k = s->k;
        p->g = s->g;
        p->life = s->life_min + frand() * (s->life_max - s->life_min);
        p->phase = frand() * 6.28f;
        p->spin = (frand() - 0.5f) * 14;
        p->flip = 6 + frand() * 10;
        lv_obj_t *o;
        if (p->shape == 2) {
            int32_t size = 10 + (int32_t)rnd(3) * 2;
            o = ui_icon(parent, "star-fill", size, colors[rnd((uint32_t)ncolors)]);
            lv_obj_add_flag(o, LV_OBJ_FLAG_IGNORE_LAYOUT);
            lv_obj_remove_flag(o, LV_OBJ_FLAG_CLICKABLE);
            p->w = p->h = size;
        } else {
            o = loose(parent);
            if (p->shape == 0) { p->w = p->h = 4 + (int32_t)rnd(5); }
            else { p->w = 4; p->h = 10; }
            ui_style_card(o, colors[rnd((uint32_t)ncolors)], p->shape == 0 ? LV_RADIUS_CIRCLE : 1, 0, 0);
            lv_obj_set_size(o, p->w, p->h);
        }
        lv_obj_set_user_data(o, p);
        lv_obj_add_event_cb(o, free_user_data, LV_EVENT_DELETE, NULL);
        piece_exec(o, 0);
        uint32_t dur = (uint32_t)(p->life * 1000);
        start_anim(o, piece_exec, NULL, 0, (int32_t)dur, dur, 0, lv_anim_path_linear, delete_var);
    }
}

void fx_confetti(lv_obj_t *parent, int32_t cx, int32_t cy, int n, const uint32_t *colors, int ncolors, int32_t spread)
{
    fx_shoot_t s = BURST_SHOOT;
    float f = (float)spread / 300.0f;
    s.speed_min *= f;
    s.speed_max *= f;
    fx_confetti_ex(parent, cx, cy, n, colors, ncolors, &s);
}

void fx_sparks(lv_obj_t *parent, int32_t x, int32_t y, int side)
{
    fx_shoot_t s = { 120, 210, side < 0 ? -145 : -35, 20, 0, 380, 2.6f, 0.55f, 0.8f, true };
    fx_confetti_ex(parent, x, y, 4, FX_BRAND, 7, &s);
}

/* ---- drizzle: a piece every 280 ms from the top, swaying down ---- */
typedef struct { float x0, v, phase; uint32_t dur; } drop_t;

static void drop_exec(void *var, int32_t ms)
{
    drop_t *d = lv_obj_get_user_data(var);
    if (!d) return;
    float tau = ms / 1000.0f;
    float y = -8 + tau * d->v, x = d->x0 + sinf(tau * 2.2f + d->phase) * 9;
    float a = 0.7f * clampf(tau / 0.4f) * clampf((470 - y) / 60);
    lv_obj_set_pos(var, (int32_t)x, (int32_t)y);
    lv_obj_set_style_opa(var, (lv_opa_t)(255 * a), 0);
}

typedef struct { lv_obj_t *parent; const uint32_t *colors; int ncolors; uint32_t until; lv_timer_t *timer; } drizzle_t;

static void drizzle_gone(lv_event_t *e)
{
    drizzle_t *z = lv_event_get_user_data(e);
    lv_timer_delete(z->timer);
    lv_free(z);
}

static void drizzle_tick(lv_timer_t *t)
{
    drizzle_t *z = lv_timer_get_user_data(t);
    if (z->until && (int32_t)(lv_tick_get() - z->until) > 0) {
        lv_obj_remove_event_cb_with_user_data(z->parent, drizzle_gone, z);
        lv_free(z);
        lv_timer_delete(t);
        return;
    }
    drop_t *d = lv_malloc(sizeof(drop_t));
    d->x0 = CENTER + (float)((int)rnd(351) - 175);
    d->v = 42 + frand() * 34;
    d->phase = frand() * 6.28f;
    d->dur = (uint32_t)(490.0f / d->v * 1000);
    float kind = frand();
    lv_obj_t *o;
    if (kind < 0.12f) {
        o = ui_icon(z->parent, "star-fill", 10, z->colors[rnd((uint32_t)z->ncolors)]);
        lv_obj_add_flag(o, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_remove_flag(o, LV_OBJ_FLAG_CLICKABLE);
    } else {
        o = loose(z->parent);
        bool dot = kind < 0.55f;
        lv_obj_set_size(o, dot ? 5 : 3, dot ? 5 : 8);
        ui_style_card(o, z->colors[rnd((uint32_t)z->ncolors)], dot ? LV_RADIUS_CIRCLE : 1, 0, 0);
    }
    lv_obj_set_user_data(o, d);
    lv_obj_add_event_cb(o, free_user_data, LV_EVENT_DELETE, NULL);
    drop_exec(o, 0);
    start_anim(o, drop_exec, NULL, 0, (int32_t)d->dur, d->dur, 0, lv_anim_path_linear, delete_var);
}

void fx_drizzle(lv_obj_t *parent, uint32_t ms, const uint32_t *colors, int ncolors)
{
    if (!parent) return;
    drizzle_t *z = lv_malloc(sizeof(drizzle_t));
    z->parent = parent;
    z->colors = colors;
    z->ncolors = ncolors;
    z->until = ms ? lv_tick_get() + ms : 0;
    z->timer = lv_timer_create(drizzle_tick, 280, z);
    lv_obj_add_event_cb(parent, drizzle_gone, LV_EVENT_DELETE, z);
}

/* ================================================================ the burst */
typedef struct { int32_t cx, cy, t; fx_burst_cfg_t cfg; } burst_t;

static void disc(lv_layer_t *layer, float x, float y, float r, lv_color_t c, lv_opa_t opa)
{
    if (opa <= LV_OPA_MIN || r <= 0.4f) return;
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = c;
    d.bg_opa = opa;
    d.radius = LV_RADIUS_CIRCLE;
    int32_t dia = (int32_t)lroundf(r * 2);
    if (dia < 2) dia = 2;
    lv_area_t a = { (int32_t)lroundf(x - dia / 2.0f), (int32_t)lroundf(y - dia / 2.0f), 0, 0 };
    a.x2 = a.x1 + dia - 1;
    a.y2 = a.y1 + dia - 1;
    lv_draw_rect(layer, &d, &a);
}

static void burst_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    burst_t *b = lv_obj_get_user_data(obj);
    if (!b) return;
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    float cx = c.x1 + b->cx, cy = c.y1 + b->cy;
    const fx_burst_cfg_t *k = &b->cfg;
    float t = b->t / 1000.0f, at = k->burst_at / 1000.0f, tau = t - at;

    /* rays: faint lime lines turning slowly */
    if (k->rays && tau >= 0 && tau < 1.4f) {
        float r2 = 60 + 190 * ease_out(tau / 0.45f);
        lv_draw_line_dsc_t l;
        lv_draw_line_dsc_init(&l);
        l.color = COL(C_LIME);
        l.width = 1;
        l.opa = (lv_opa_t)(255 * 0.28f * (1 - ease_in(tau / 1.4f)));
        for (int i = 0; i < 16; i++) {
            float ang = i * PI_F / 8 + tau * 0.35f;
            l.p1.x = cx + 70 * cosf(ang); l.p1.y = cy + 70 * sinf(ang);
            l.p2.x = cx + r2 * cosf(ang); l.p2.y = cy + r2 * sinf(ang);
            lv_draw_line(layer, &l);
        }
    }
    /* the charge: 24 dots light up one after another, then squeeze in */
    if (k->charge && t < at + 0.02f) {
        float wind = ease_in((t - (at - 0.15f)) / 0.15f), r = 56 - 8 * wind;
        for (int i = 0; i < 24; i++) {
            float a = -PI_F / 2 + i * PI_F / 12, x = cx + r * cosf(a), y = cy + r * sinf(a);
            float lit_at = at * (0.17f + i * 0.026f);
            bool lit = t >= lit_at;
            float pop = lit ? 1 + 0.6f * expf(-(t - lit_at) * 22) : 0;
            lv_opa_t opa = lit ? LV_OPA_COVER : (lv_opa_t)(255 * 0.9f * clampf((t - 0.03f) / 0.2f));
            disc(layer, x, y, lit ? 2.8f * pop : 1.5f, lit ? mix(brand((uint32_t)i), CREAM, wind) : COL(C_LINE), opa);
        }
    }
    /* dot shockwaves */
    static const struct { float r0, d; int n; } WAVE[3] = { { 48, 3.6f, 24 }, { 30, 3.0f, 64 }, { 30, 2.6f, 40 } };
    float span = k->wave_span ? (float)k->wave_span : 300;
    for (int w = 0; w < k->waves && w < 3; w++) {
        float q = (tau - w * 0.06f) / 0.6f;
        if (q < 0 || q > 1) continue;
        float r0 = k->wave_r0 ? (float)k->wave_r0 : WAVE[w].r0;
        float r = r0 + span * ease_out_expo(q), sz = WAVE[w].d * (1 - q) + 0.6f;
        lv_opa_t opa = (lv_opa_t)(255 * (1 - powf(q, 1.5f)));
        for (int i = 0; i < WAVE[w].n; i++) {
            float a = -PI_F / 2 + i * 2 * PI_F / WAVE[w].n;
            disc(layer, cx + r * cosf(a), cy + r * sinf(a), sz, COL(brand((uint32_t)(i * 5 + w * 3))), opa);
        }
    }
    /* the flash: a soft white-to-lime bloom, and a blink over the whole screen for 120 ms */
    if (k->flash_r > 0 && tau >= 0 && tau < 0.42f) {
        float q = tau / 0.42f, r = (30 + 260 * ease_out(q)) * (float)k->flash_r / 290.0f;
        static const float RR[4] = { 1.0f, 0.72f, 0.46f, 0.26f };
        static const float OO[4] = { 0.10f, 0.16f, 0.26f, 0.50f };
        for (int i = 0; i < 4; i++) disc(layer, cx, cy, r * RR[i], i < 2 ? COL(C_LIME) : COL(CREAM), (lv_opa_t)(255 * OO[i] * (1 - q)));
        if (tau < 0.12f) {
            lv_draw_rect_dsc_t d;
            lv_draw_rect_dsc_init(&d);
            d.bg_color = lv_color_white();
            d.bg_opa = (lv_opa_t)(255 * 0.16f * (1 - tau / 0.12f));
            lv_draw_rect(layer, &d, &c);
        }
    }
}

static void burst_step(void *var, int32_t v)
{
    lv_obj_t *obj = var;
    burst_t *b = lv_obj_get_user_data(obj);
    if (!b) return;
    b->t = v;
    if (b->cfg.charge && (uint32_t)v < b->cfg.burst_at) {
        lv_area_t c;
        lv_obj_get_coords(obj, &c);
        lv_area_t a = { c.x1 + b->cx - 72, c.y1 + b->cy - 72, c.x1 + b->cx + 72, c.y1 + b->cy + 72 };
        lv_obj_invalidate_area(obj, &a);
    } else {
        lv_obj_invalidate(obj);
    }
}

lv_obj_t *fx_burst_create(lv_obj_t *parent, int32_t cx, int32_t cy, const fx_burst_cfg_t *cfg)
{
    if (!parent || !cfg) return NULL;
    lv_obj_t *o = loose(parent);
    lv_obj_set_pos(o, 0, 0);
    int32_t w = lv_obj_get_width(parent), h = lv_obj_get_height(parent);   /* a brand-new overlay has no size yet */
    lv_obj_set_size(o, w > 0 ? w : SCREEN_W, h > 0 ? h : SCREEN_H);
    burst_t *b = lv_malloc_zeroed(sizeof(burst_t));
    b->cx = cx;
    b->cy = cy;
    b->cfg = *cfg;
    lv_obj_set_user_data(o, b);
    lv_obj_add_event_cb(o, free_user_data, LV_EVENT_DELETE, NULL);
    lv_obj_add_event_cb(o, burst_draw, LV_EVENT_DRAW_MAIN, NULL);
    uint32_t dur = cfg->burst_at + 1500;
    start_anim(o, burst_step, NULL, 0, (int32_t)dur, dur, 0, lv_anim_path_linear, delete_var);
    return o;
}

/* ================================================================ entrances */
static void rise_exec(void *var, int32_t t)
{
    int32_t dy = anim_arg(var, rise_exec);
    int32_t tt = t > 1000 ? 1000 : t;
    lv_obj_set_style_opa(var, (lv_opa_t)(255 * tt / 1000), 0);
    lv_obj_set_style_translate_y(var, dy * (1000 - t) / 1000, 0);
}

static void rise_done(lv_anim_t *a)
{
    lv_obj_set_style_opa(a->var, LV_OPA_COVER, 0);
    lv_obj_set_style_translate_y(a->var, 0, 0);
}

void fx_rise(lv_obj_t *o, int32_t dy, uint32_t delay)
{
    if (!o) return;
    lv_obj_set_style_opa(o, LV_OPA_TRANSP, 0);
    lv_obj_set_style_translate_y(o, dy, 0);
    start_1000(o, rise_exec, dy, 380, delay, lv_anim_path_overshoot, rise_done);
}

void fx_rise_children(lv_obj_t *parent, int32_t dy, uint32_t stagger)
{
    if (!parent) return;
    uint32_t n = lv_obj_get_child_count(parent), k = 0;
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *c = lv_obj_get_child(parent, (int32_t)i);
        if (lv_obj_has_flag(c, LV_OBJ_FLAG_HIDDEN)) continue;
        fx_rise(c, dy, stagger * k++);
    }
}

static void slide_exec(void *var, int32_t t)
{
    int32_t dy = anim_arg(var, slide_exec);
    lv_obj_set_style_translate_y(var, dy * (1000 - t) / 1000, 0);
}

static void slide_done(lv_anim_t *a) { lv_obj_set_style_translate_y(a->var, 0, 0); }

void fx_slide(lv_obj_t *o, int32_t dy, uint32_t delay)
{
    if (!o) return;
    lv_obj_set_style_translate_y(o, dy, 0);
    start_1000(o, slide_exec, dy, 340, delay, lv_anim_path_overshoot, slide_done);
}

/* a spring: 1 - amp * e^(-8 tau) cos(15 tau), like the mock's title words */
static void spring_exec(void *var, int32_t ms)
{
    int32_t amp = anim_arg(var, spring_exec);   /* in hundredths */
    float tau = ms / 1000.0f;
    float s = 1 - amp / 100.0f * expf(-8 * tau) * cosf(15 * tau);
    lv_obj_set_style_transform_scale(var, (int32_t)(256 * s), 0);
    lv_obj_set_style_opa(var, (lv_opa_t)(255 * clampf(tau / 0.12f)), 0);
}

static void spring_done(lv_anim_t *a)
{
    lv_obj_set_style_transform_scale(a->var, 256, 0);
    lv_obj_set_style_opa(a->var, LV_OPA_COVER, 0);
}

static void spring_start(lv_obj_t *o, int amp, uint32_t delay)
{
    lv_obj_set_style_transform_pivot_x(o, LV_PCT(50), 0);
    lv_obj_set_style_transform_pivot_y(o, LV_PCT(50), 0);
    lv_obj_set_style_transform_scale(o, (int32_t)(256 * (1 - amp / 100.0f)), 0);
    lv_obj_set_style_opa(o, LV_OPA_TRANSP, 0);
    lv_anim_delete(o, spring_exec);
    start_anim(o, spring_exec, (void *)(intptr_t)amp, 0, 600, 600, delay, lv_anim_path_linear, spring_done);
}

void fx_spring(lv_obj_t *o, uint32_t delay) { if (o) spring_start(o, 60, delay); }

void fx_spring_children(lv_obj_t *parent, uint32_t stagger)
{
    if (!parent) return;
    uint32_t n = lv_obj_get_child_count(parent), k = 0;
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *c = lv_obj_get_child(parent, (int32_t)i);
        if (lv_obj_has_flag(c, LV_OBJ_FLAG_HIDDEN)) continue;
        fx_spring(c, stagger * k++);
    }
}

static void pop_exec(void *var, int32_t t) { lv_obj_set_style_transform_scale(var, 154 + (256 - 154) * t / 1000, 0); }
static void pop_done(lv_anim_t *a) { lv_obj_set_style_transform_scale(a->var, 256, 0); }

void fx_pop(lv_obj_t *o, uint32_t delay)
{
    if (!o) return;
    lv_obj_set_style_transform_pivot_x(o, LV_PCT(50), 0);
    lv_obj_set_style_transform_pivot_y(o, LV_PCT(50), 0);
    lv_obj_set_style_transform_scale(o, 154, 0);
    start_1000(o, pop_exec, 0, 320, delay, lv_anim_path_overshoot, pop_done);
}

static void bounce_exec(void *var, int32_t t)
{
    int32_t h = anim_arg(var, bounce_exec);
    lv_obj_set_style_translate_y(var, (int32_t)(-(float)h * sinf(PI_F * (float)t / 1000.0f)), 0);
}

void fx_bounce(lv_obj_t *o, int32_t height, uint32_t delay)
{
    if (!o) return;
    start_1000(o, bounce_exec, height, 420, delay, lv_anim_path_ease_in_out, slide_done);
}

static void jolt_exec(void *var, int32_t ms)
{
    int32_t amp = anim_arg(var, jolt_exec);
    float tau = ms / 1000.0f;
    lv_obj_set_style_translate_y(var, (int32_t)(amp * expf(-7 * tau) * sinf(26 * tau)), 0);
}

void fx_jolt(lv_obj_t *o, int32_t amp, uint32_t ms, uint32_t delay)
{
    if (!o) return;
    lv_anim_delete(o, jolt_exec);
    start_anim(o, jolt_exec, (void *)(intptr_t)amp, 0, (int32_t)ms, ms, delay, lv_anim_path_linear, slide_done);
}

void fx_words(lv_obj_t *parent, const char *text, const lv_font_t *font, uint32_t color, int32_t y, uint32_t delay, uint32_t stagger)
{
    if (!parent || !text) return;
    char buf[96];
    snprintf(buf, sizeof buf, "%s", text);
    lv_obj_t *words[8];
    int32_t widths[8], n = 0, total = 0;
    const int32_t gap = 7;
    for (char *w = strtok(buf, " "); w && n < 8; w = strtok(NULL, " ")) {
        lv_obj_t *l = ui_label(parent, font, color, w);
        lv_obj_add_flag(l, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_update_layout(l);
        widths[n] = lv_obj_get_width(l);
        total += widths[n] + (n ? gap : 0);
        words[n++] = l;
    }
    int32_t x = CENTER - total / 2;
    for (int32_t i = 0; i < n; i++) {
        lv_obj_set_pos(words[i], x, y);
        x += widths[i] + gap;
        spring_start(words[i], i == n - 1 ? 75 : 60, delay + stagger * (uint32_t)i);
    }
}

/* ---- fly: an image from one centre to another, scaling on the way ---- */
typedef struct { int32_t x0, y0, x1, y1, s0, s1; bool twirl; } fly_t;

static void fly_exec(void *var, int32_t t)
{
    lv_anim_t *a = lv_anim_get(var, fly_exec);
    if (!a) return;
    fly_t *f = a->user_data;
    float q = t / 1000.0f;
    float x = f->x0 + (f->x1 - f->x0) * ease_in_out(q);
    float y = f->y0 + (f->y1 - f->y0) * ease_out_back(q, 1.25f);
    int32_t s = (int32_t)(f->s0 + (f->s1 - f->s0) * ease_in_out(q));
    lv_obj_t *img = var;
    int32_t w = lv_obj_get_width(img), h = lv_obj_get_height(img);
    lv_obj_set_pos(img, (int32_t)x - w / 2, (int32_t)y - h / 2);
    lv_image_set_scale(img, (uint32_t)(s < 16 ? 16 : s));
    if (f->twirl) lv_image_set_rotation(img, (int32_t)(-0.25f * sinf(q * PI_F) * (1 - q) * 573));
}

void fx_fly(lv_obj_t *img, int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t scale0, int32_t scale1, uint32_t ms, uint32_t delay, bool twirl)
{
    if (!img) return;
    fly_t *f = lv_malloc(sizeof(fly_t));
    *f = (fly_t){ x0, y0, x1, y1, scale0, scale1, twirl };
    lv_obj_update_layout(img);
    int32_t w = lv_obj_get_width(img), h = lv_obj_get_height(img);
    lv_obj_set_pos(img, x0 - w / 2, y0 - h / 2);
    lv_image_set_scale(img, (uint32_t)(scale0 < 16 ? 16 : scale0));
    lv_anim_delete(img, fly_exec);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, img);
    lv_anim_set_exec_cb(&a, fly_exec);
    lv_anim_set_user_data(&a, f);
    lv_anim_set_values(&a, 0, 1000);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_delay(&a, delay);
    lv_anim_set_early_apply(&a, false);
    lv_anim_set_deleted_cb(&a, free_anim_data);
    lv_anim_start(&a);
}

/* ---- iris: the pet is clipped by a circle that grows from nothing ---- */
typedef struct { lv_obj_t *pet, *parent; int32_t x, y, d; } iris_t;

static void iris_exec(void *var, int32_t t)
{
    iris_t *r = lv_obj_get_user_data(var);
    if (!r) return;
    int32_t s = (int32_t)(r->d * ease_out(t / 1000.0f));
    if (s < 2) s = 2;
    int32_t off = (r->d - s) / 2;
    lv_obj_set_size(var, s, s);
    lv_obj_set_pos(var, r->x + off, r->y + off);
    lv_obj_set_pos(r->pet, -off, -off);
}

static void iris_done(lv_anim_t *a)
{
    lv_obj_t *clip = a->var;
    iris_t *r = lv_obj_get_user_data(clip);
    if (r && lv_obj_is_valid(r->pet)) {
        lv_obj_set_parent(r->pet, r->parent);
        lv_obj_set_pos(r->pet, r->x, r->y);
        lv_obj_move_to_index(r->pet, lv_obj_get_index(clip));
    }
    lv_obj_delete(clip);
}

void fx_iris(lv_obj_t *pet, uint32_t ms, uint32_t delay)
{
    if (!pet) return;
    lv_obj_t *parent = lv_obj_get_parent(pet);
    lv_obj_update_layout(pet);   /* a pet placed a moment ago has no position yet */
    iris_t *r = lv_malloc(sizeof(iris_t));
    r->pet = pet;
    r->parent = parent;
    r->x = lv_obj_get_x(pet);
    r->y = lv_obj_get_y(pet);
    r->d = lv_obj_get_width(pet);
    lv_obj_t *clip = loose(parent);
    lv_obj_move_to_index(clip, lv_obj_get_index(pet) + 1);
    lv_obj_set_style_radius(clip, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_clip_corner(clip, true, 0);
    lv_obj_set_user_data(clip, r);
    lv_obj_add_event_cb(clip, free_user_data, LV_EVENT_DELETE, NULL);
    lv_obj_set_parent(pet, clip);
    iris_exec(clip, 0);
    start_anim(clip, iris_exec, NULL, 0, 1000, ms, delay, lv_anim_path_linear, iris_done);
}

/* ---- halo: three dot rings spring into place, then twinkle and drift ---- */
static void halo_exec(void *var, int32_t ms)
{
    float tau = ms / 1000.0f;
    float s = 1 - 0.45f * expf(-6.5f * tau) * cosf(13 * tau);
    ring_set_scale(var, (int32_t)(1000 * s));
    lv_obj_set_style_opa(var, (lv_opa_t)(255 * clampf(tau / 0.15f)), 0);
}

static void halo_settled(lv_anim_t *a) { ring_set_scale(a->var, 1000); lv_obj_set_style_opa(a->var, LV_OPA_COVER, 0); }
static void halo_fade_exec(void *var, int32_t v) { lv_obj_set_style_opa(var, (lv_opa_t)v, 0); }

void fx_halo(lv_obj_t *parent, const uint32_t colors[3], const lv_opa_t opas[3], uint32_t delay, uint32_t life)
{
    if (!parent) return;
    static const int32_t R[3] = { 136, 148, 160 };   /* the outer one on the time ring's radius */
    static const uint8_t N[3] = { 48, 60, 72 };
    static const float DOT[3] = { 2.8f, 2.1f, 1.6f };
    static const int8_t DRIFT[3] = { 2, -1, 1 };
    for (int i = 0; i < 3; i++) {
        lv_obj_t *r = ring_create(parent, R[i]);
        lv_obj_add_flag(r, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_align(r, LV_ALIGN_CENTER, 0, 0);
        ring_style_t s = ring_style(60, colors[i], C_DOT_OFF);
        s.count = N[i];
        s.lit = N[i];
        s.arc = false;
        s.edge = 0;
        s.lit_r = DOT[i];
        s.lit_opa = opas[i];
        s.confetti = true;   /* every dot its own brand colour; colors[] only matters if that's off */
        ring_set(r, &s);
        ring_set_wave(r, true, DRIFT[i]);
        ring_set_scale(r, 550);
        lv_obj_set_style_opa(r, LV_OPA_TRANSP, 0);
        start_anim(r, halo_exec, NULL, 0, 700, 700, delay + 70 * (uint32_t)i, lv_anim_path_linear, halo_settled);
        if (life) start_anim(r, halo_fade_exec, NULL, 255, 0, 500, delay + life, lv_anim_path_ease_in, delete_var);
    }
}

/* ================================================================ small touches */
typedef struct { int32_t cx, cy, r0, r1; } ripple_t;

static void ripple_exec(void *var, int32_t t)
{
    ripple_t *r = lv_obj_get_user_data(var);
    if (!r) return;
    int32_t rad = r->r0 + (r->r1 - r->r0) * t / 1000;
    lv_obj_set_size(var, rad * 2, rad * 2);
    lv_obj_set_pos(var, r->cx - rad, r->cy - rad);
    lv_obj_set_style_border_opa(var, (lv_opa_t)(255 - 255 * t / 1000), 0);
}

void fx_ripple(lv_obj_t *parent, int32_t cx, int32_t cy, int32_t r0, int32_t r1, uint32_t color)
{
    if (!parent) return;
    lv_obj_t *o = loose(parent);
    ripple_t *r = lv_malloc(sizeof(ripple_t));
    *r = (ripple_t){ cx, cy, r0, r1 };
    lv_obj_set_user_data(o, r);
    lv_obj_add_event_cb(o, free_user_data, LV_EVENT_DELETE, NULL);
    lv_obj_set_style_radius(o, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(o, 2, 0);
    lv_obj_set_style_border_color(o, COL(color), 0);
    ripple_exec(o, 0);
    start_anim(o, ripple_exec, NULL, 0, 1000, 520, 0, lv_anim_path_ease_out, delete_var);
}

void fx_ripple_from(lv_obj_t *around, int32_t r0, int32_t r1, uint32_t color)
{
    if (!around) return;
    lv_obj_t *p = lv_obj_get_parent(around);
    while (p && lv_obj_get_parent(p) && (lv_obj_get_width(p) < SCREEN_W || lv_obj_get_height(p) < SCREEN_H)) p = lv_obj_get_parent(p);
    if (!p) return;
    lv_area_t a, pa;
    lv_obj_get_coords(around, &a);
    lv_obj_get_coords(p, &pa);
    fx_ripple(p, (a.x1 + a.x2) / 2 - pa.x1 + lv_obj_get_scroll_x(p), (a.y1 + a.y2) / 2 - pa.y1 + lv_obj_get_scroll_y(p), r0, r1, color);
}

static void twinkle_exec(void *var, int32_t v) { lv_obj_set_style_image_opa(var, (lv_opa_t)v, 0); }

void fx_twinkle(lv_obj_t *parent, int32_t cx, int32_t cy, int32_t radius, int n, uint32_t color, uint32_t ms)
{
    if (!parent) return;
    for (int i = 0; i < n; i++) {
        float ang = frand() * 2 * PI_F, d = (float)radius * (0.55f + frand() * 0.45f);
        int32_t size = 10 + (int32_t)rnd(3) * 2;
        lv_obj_t *s = ui_icon(parent, "star-fill", size, color ? color : brand(rnd(7)));
        lv_obj_add_flag(s, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_remove_flag(s, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_pos(s, cx + (int32_t)(cosf(ang) * d) - size / 2, cy + (int32_t)(sinf(ang) * d) - size / 2);
        lv_obj_set_style_image_opa(s, LV_OPA_TRANSP, 0);
        uint32_t dur = 320 + rnd(320), cycles = ms / (dur * 2);
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, s);
        lv_anim_set_exec_cb(&a, twinkle_exec);
        lv_anim_set_values(&a, 0, 255);
        lv_anim_set_duration(&a, dur);
        lv_anim_set_playback_duration(&a, dur);
        lv_anim_set_delay(&a, rnd(500));
        lv_anim_set_repeat_count(&a, cycles ? cycles : 1);
        lv_anim_set_completed_cb(&a, delete_var);
        lv_anim_start(&a);
    }
}

typedef struct { int from, to; char fmt[32]; } count_t;

static void count_exec(void *var, int32_t t)
{
    lv_anim_t *a = lv_anim_get(var, count_exec);
    if (!a) return;
    count_t *c = a->user_data;
    char s[48];
    snprintf(s, sizeof s, c->fmt, c->from + (c->to - c->from) * t / 1000);
    lv_label_set_text(var, s);
}

void fx_count(lv_obj_t *label, int from, int to, const char *fmt, uint32_t ms)
{
    if (!label) return;
    count_t *c = lv_malloc(sizeof(count_t));
    c->from = from;
    c->to = to;
    snprintf(c->fmt, sizeof c->fmt, "%s", fmt);
    lv_anim_delete(label, count_exec);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, label);
    lv_anim_set_exec_cb(&a, count_exec);
    lv_anim_set_user_data(&a, c);
    lv_anim_set_values(&a, 0, 1000);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
    lv_anim_set_early_apply(&a, false);
    lv_anim_set_deleted_cb(&a, free_anim_data);
    lv_anim_start(&a);
}
