#include "widgets.h"
#include "swipe.h"
#include "fx.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define PI_F 3.14159265f

static bool picture_mode;
void ui_set_picture(bool picture) { picture_mode = picture; }
bool ui_picture(void) { return picture_mode; }

/* ================================================================ dot ring */
typedef struct {
    ring_style_t s;
    int32_t radius;
    uint8_t breath;   /* 0..255, for the pulse */
    uint8_t head;     /* comet head */
    lv_timer_t *timer;
    int32_t scale;    /* permille; 0 = full size */
    int16_t rot;      /* drifted round, deg/10 */
    int8_t drift;     /* per tick */
    bool wave;        /* brightness runs round the ring */
} ring_data_t;

static void ring_dot(lv_layer_t *layer, float x, float y, float r, lv_color_t c, lv_opa_t opa)
{
    if (opa <= LV_OPA_MIN || r <= 0) return;
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = c;
    d.bg_opa = opa;
    d.radius = LV_RADIUS_CIRCLE;
    int32_t dia = (int32_t)lroundf(r * 2);
    if (dia < 2) dia = 2;
    lv_area_t a;
    a.x1 = (int32_t)lroundf(x - dia / 2.0f);
    a.y1 = (int32_t)lroundf(y - dia / 2.0f);
    a.x2 = a.x1 + dia - 1;
    a.y2 = a.y1 + dia - 1;
    lv_draw_rect(layer, &d, &a);
}

static void ring_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    ring_data_t *d = lv_obj_get_user_data(obj);
    if (!d || !d->s.count) return;
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    float cx = c.x1 + lv_area_get_width(&c) / 2.0f, cy = c.y1 + lv_area_get_height(&c) / 2.0f;
    float k = d->s.pulse ? 0.6f + 0.4f * d->breath / 255.0f : 1.0f;
    float rad = d->radius * (d->scale ? d->scale : 1000) / 1000.0f, rot = d->rot * PI_F / 1800.0f;
    float ph = d->wave ? lv_tick_get() / 1000.0f * 2.2f : 0;
    for (int i = 0; i < d->s.count; i++) {
        /* the open arc: 60 positions round the clock, the 11 at the bottom left out; dot 0 is at 7 o'clock */
        float a = (d->s.arc ? (216.0f + 6.0f * i) * PI_F / 180.0f : i * 2 * PI_F / d->s.count) + rot;
        float x = cx + rad * sinf(a), y = cy - rad * cosf(a);
        float wf = 1;
        if (d->wave) {   /* three brightness bands running round, like the mock's halo */
            float glow = 0.5f + 0.5f * sinf(i * 6 * PI_F / d->s.count - ph + d->radius * 0.01f);
            wf = glow >= 0.667f ? 1.0f : glow >= 0.333f ? 0.72f : 0.45f;
        }
        if (d->s.comet) {
            int behind = (d->head - i + d->s.count) % d->s.count;
            if (behind < 12) {
                float t = 1.0f - behind / 12.0f;
                ring_dot(layer, x, y, d->s.dim_r + (d->s.lit_r - d->s.dim_r) * t, COL(d->s.lit_color), (lv_opa_t)(d->s.lit_opa * (0.25f + 0.75f * t)));
            } else {
                ring_dot(layer, x, y, d->s.dim_r, COL(d->s.dim_color), d->s.dim_opa);
            }
            continue;
        }
        /* celebrations: every dot one of the brand's friends (lavender, mint, bubblegum, coral, sky, carrot, amber) */
        static const uint32_t CONFETTI[] = { C_LAVENDER, C_MINT, 0xEAB5DE, C_CORAL, C_SKY, 0xF7945A, C_BUTTER };
        uint32_t lc = d->s.confetti ? CONFETTI[(i * 5 + d->radius) % 7] : d->s.lit_color;
        if (d->s.edge > 0) ring_dot(layer, x, y, (i < d->s.lit ? d->s.lit_r : d->s.dim_r) + d->s.edge, COL(d->s.edge_color), LV_OPA_COVER);
        if (i < d->s.lit) ring_dot(layer, x, y, d->s.lit_r, COL(lc), (lv_opa_t)(d->s.lit_opa * k * wf));
        else ring_dot(layer, x, y, d->s.dim_r, COL(d->s.dim_color), d->s.dim_opa);
    }
}

static void ring_invalidate_band(lv_obj_t *obj, ring_data_t *d)
{
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    int32_t cx = c.x1 + lv_area_get_width(&c) / 2, cy = c.y1 + lv_area_get_height(&c) / 2, r = d->radius + 5;
    /* four strips round the band rather than the whole disc */
    lv_area_t strips[4] = {
        { cx - r, cy - r, cx + r, cy - d->radius + 40 },
        { cx - r, cy + d->radius - 40, cx + r, cy + r },
        { cx - r, cy - d->radius + 40, cx - d->radius + 40, cy + d->radius - 40 },
        { cx + d->radius - 40, cy - d->radius + 40, cx + r, cy + d->radius - 40 },
    };
    for (int i = 0; i < 4; i++) lv_obj_invalidate_area(obj, &strips[i]);
}

static void ring_tick(lv_timer_t *t)
{
    lv_obj_t *obj = lv_timer_get_user_data(t);
    ring_data_t *d = lv_obj_get_user_data(obj);
    if (lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) return;
    if (d->s.pulse) {
        uint32_t ms = lv_tick_get() % 1600;
        float ph = ms / 1600.0f;
        d->breath = (uint8_t)(255 * (0.5f + 0.5f * cosf(ph * 2 * PI_F)));
        ring_invalidate_band(obj, d);
    } else if (d->s.comet) {
        d->head = (uint8_t)((d->head + 1) % d->s.count);
        ring_invalidate_band(obj, d);
    } else if (d->wave || d->drift) {
        d->rot = (int16_t)((d->rot + d->drift) % 3600);
        lv_obj_invalidate(obj);
    }
}

/* a springing ring overshoots its box a little */
static void ring_ext(lv_event_t *e) { lv_event_set_ext_draw_size(e, 24); }

void ring_set_scale(lv_obj_t *ring, int32_t permille)
{
    ring_data_t *d = lv_obj_get_user_data(ring);
    if (!d || d->scale == permille) return;
    d->scale = permille;
    lv_obj_invalidate(ring);
}

void ring_set_wave(lv_obj_t *ring, bool wave, int8_t drift)
{
    ring_data_t *d = lv_obj_get_user_data(ring);
    if (!d) return;
    d->wave = wave;
    d->drift = drift;
    lv_obj_invalidate(ring);
}

static void ring_delete(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    ring_data_t *d = lv_obj_get_user_data(obj);
    if (d) {
        if (d->timer) lv_timer_delete(d->timer);
        lv_free(d);
    }
}

/* Figma "Time ring" (2026-10-12): 49 dots on an open arc 156 px out (the gap at the bottom, under
 * Biscuit, where Next sits), 3.55 px dots with a 1.5 px ink rim so they read over the scene. The
 * lit ones count from the bottom-left end clockwise. `lit` keeps the old 0..60 scale. */
ring_style_t ring_style(uint8_t lit, uint32_t lit_color, uint32_t dim_color)
{
    ring_style_t s = { .count = 49, .lit = (uint8_t)(lit >= 60 ? 49 : (lit * 49 + 30) / 60), .lit_color = lit_color, .dim_color = dim_color,
                       .lit_r = 3.55f, .dim_r = 3.55f, .lit_opa = LV_OPA_COVER, .dim_opa = LV_OPA_COVER,
                       .arc = true, .edge = 1.5f, .edge_color = 0x000000 };
    return s;
}

lv_obj_t *ring_create(lv_obj_t *parent, int32_t radius)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, radius * 2 + 12, radius * 2 + 12);
    ring_data_t *d = lv_malloc_zeroed(sizeof(ring_data_t));
    d->radius = radius;
    lv_obj_set_user_data(o, d);
    lv_obj_add_event_cb(o, ring_draw, LV_EVENT_DRAW_MAIN, NULL);
    lv_obj_add_event_cb(o, ring_ext, LV_EVENT_REFR_EXT_DRAW_SIZE, NULL);
    lv_obj_add_event_cb(o, ring_delete, LV_EVENT_DELETE, NULL);
    d->timer = lv_timer_create(ring_tick, 80, o);
    return o;
}

void ring_set(lv_obj_t *ring, const ring_style_t *s)
{
    ring_data_t *d = lv_obj_get_user_data(ring);
    if (memcmp(&d->s, s, sizeof(*s)) == 0) return;
    d->s = *s;
    lv_obj_invalidate(ring);
}

/* ================================================================ button cue */
static void cue_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    /* Figma "Button cue": a lime arc 23..37 degrees past 12 o'clock, 217..226 px out, with a soft
     * orange shadow (#FF5F1F at 70%, blur 10) */
    lv_draw_arc_dsc_t a;
    lv_draw_arc_dsc_init(&a);
    a.center.x = c.x1 + CENTER;
    a.center.y = c.y1 + CENTER;
    a.rounded = 0;
    a.color = COL(0xFF5F1F);
    static const struct { int16_t grow; lv_opa_t opa; } GLOW[] = { { 8, 10 }, { 5, 18 }, { 2, 30 } };
    for (unsigned i = 0; i < sizeof(GLOW) / sizeof(GLOW[0]); i++) {
        a.radius = 226 + GLOW[i].grow;
        a.width = 9 + GLOW[i].grow * 2;
        a.start_angle = 293 - GLOW[i].grow / 4;
        a.end_angle = 307 + GLOW[i].grow / 4;
        a.opa = GLOW[i].opa;
        lv_draw_arc(layer, &a);
    }
    a.color = COL(C_LIME);
    a.radius = 226;
    a.width = 9;
    a.start_angle = 293;
    a.end_angle = 307;
    a.opa = LV_OPA_COVER;
    lv_draw_arc(layer, &a);
}

lv_obj_t *cue_create(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, SCREEN_W, SCREEN_H);
    lv_obj_add_event_cb(o, cue_draw, LV_EVENT_DRAW_MAIN, NULL);
    return o;
}

/* ================================================================ nav buttons */
/* Figma "Nav button": 44 px, surface/card with a surface/line outline, an 18 px cream icon. */
lv_obj_t *side_button_create(lv_obj_t *parent, bool left, const char *icon)
{
    lv_obj_t *b = ui_box(parent);
    lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_size(b, 44, 44);
    lv_obj_set_pos(b, left ? 8 : 414, 211);
    ui_style_card(b, C_GLASS, LV_RADIUS_CIRCLE, C_LINE, LV_OPA_COVER);
    lv_obj_set_style_bg_color(b, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_set_ext_click_area(b, 10);
    lv_obj_t *i = ui_icon(b, icon, 18, C_BONE);
    lv_obj_center(i);
    return b;
}

/* ================================================================ page dots */
/* Figma "Carousel dots": a 46 x 10 pill, 2 px padding, 6 px dots, the lime bar 18 wide. */
lv_obj_t *page_dots_create(lv_obj_t *parent, int page)
{
    lv_obj_t *box = ui_box(parent);
    lv_obj_set_size(box, 46, 10);
    lv_obj_set_pos(box, 210, 444);
    ui_style_card(box, C_DOTS_BG, 5, 0, 0);
    int32_t x = 2;
    for (int i = 0; i < 3; i++) {
        lv_obj_t *d = ui_box(box);
        bool here = i == page;
        lv_obj_set_size(d, here ? 18 : 6, 6);
        lv_obj_set_pos(d, x, 2);
        ui_style_card(d, here ? C_LIME : C_LINE, 3, 0, 0);
        x += (here ? 18 : 6) + 6;
    }
    return box;
}

/* ================================================================ next pill */
/* Figma "Next Task": "Next" (Tag 14, muted) at y 370, the pill 37 high (card, line outline, r 18)
 * at y 391, two sunken cards peeking 7 and 13 px below it. */
static lv_obj_t *peek_create(lv_obj_t *parent)
{
    lv_obj_t *p = ui_box(parent);
    ui_style_card(p, C_DEEP, 16, C_LINE, LV_OPA_COVER);
    return p;
}

void next_block_create(lv_obj_t *parent, next_block_t *nb, lv_event_cb_t on_tap, void *user)
{
    nb->label = ui_label(parent, F_TAG, C_MUTED, "Next");
    lv_obj_align(nb->label, LV_ALIGN_TOP_MID, 0, 370);
    nb->peek3 = peek_create(parent);
    nb->peek2 = peek_create(parent);
    nb->pill = ui_row(parent, 8);
    lv_obj_set_height(nb->pill, 37);
    ui_style_card(nb->pill, C_GLASS, 18, C_LINE, LV_OPA_COVER);
    lv_obj_set_style_pad_left(nb->pill, 12, 0);
    lv_obj_set_style_pad_right(nb->pill, 14, 0);
    lv_obj_add_flag(nb->pill, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(nb->pill, 8);
    lv_obj_set_style_bg_color(nb->pill, COL(C_LINE), LV_STATE_PRESSED);
    if (on_tap) lv_obj_add_event_cb(nb->pill, on_tap, LV_EVENT_CLICKED, user);
    nb->icon = ui_icon(nb->pill, "star-line", 16, C_BONE);
    nb->title = ui_label(nb->pill, F_MESSAGE, C_BONE, "");
    nb->time = ui_label(nb->pill, F_LABEL, C_MUTED, "");
}

void next_block_set(next_block_t *nb, const char *icon, const char *title, const char *time, int peeks)
{
    ui_icon_set(nb->icon, icon, 16);
    ui_set_text(nb->title, title);
    ui_set_text(nb->time, time);
    ui_show(nb->time, time && *time);
    lv_obj_update_layout(nb->pill);
    int32_t w = lv_obj_get_width(nb->pill);
    lv_obj_set_pos(nb->pill, CENTER - w / 2, 391);
    lv_obj_set_size(nb->peek2, w + 2, 36);
    lv_obj_set_pos(nb->peek2, CENTER - w / 2 - 1, 398);
    lv_obj_set_size(nb->peek3, w, 36);
    lv_obj_set_pos(nb->peek3, CENTER - w / 2, 404);
    ui_show(nb->peek2, peeks >= 1);
    ui_show(nb->peek3, peeks >= 2);
}

void next_block_show(next_block_t *nb, bool show)
{
    ui_show(nb->label, show);
    ui_show(nb->pill, show);
    if (!show) {
        ui_show(nb->peek2, false);
        ui_show(nb->peek3, false);
    }
}

/* ================================================================ system message */
/* Figma "System message": 40 high, r 14, 12 px left, icon 18, Message 17 in navy, gap 10.
 * Plain and Done are lavender (14 px right); Steps and Checklist are lime (8 px right) with a
 * 22 px navy ring the button or a tap ticks; With action is lavender with a lime OK pill. */
static void tick_ring(lv_obj_t *parent, lime_card_t *c)
{
    c->end = ui_box(parent);
    lv_obj_set_size(c->end, 22, 22);
    lv_obj_set_style_radius(c->end, LV_RADIUS_CIRCLE, 0);
    c->end_dot = ui_box(c->end);
    lv_obj_set_size(c->end_dot, 8, 8);
    lv_obj_center(c->end_dot);
    ui_style_card(c->end_dot, C_NAVY, LV_RADIUS_CIRCLE, 0, 0);
    c->end_label = ui_label(c->end, F_LABEL, C_NAVY, "OK");
    lv_obj_center(c->end_label);
}

void lime_card_create(lv_obj_t *parent, lime_card_t *c, int32_t width)
{
    memset(c, 0, sizeof(*c));
    c->root = ui_row(parent, 10);
    lv_obj_set_height(c->root, 40);
    ui_style_card(c->root, C_LAVENDER, 14, 0, 0);
    lv_obj_set_style_pad_left(c->root, 12, 0);
    lv_obj_set_style_pad_right(c->root, 14, 0);
    if (width) lv_obj_set_width(c->root, width);
    c->icon = ui_icon(c->root, "alarm", 18, C_NAVY);
    c->steps = ui_box(c->root);
    lv_obj_set_height(c->steps, 8);
    c->text = ui_label(c->root, F_MESSAGE, C_NAVY, "");
    if (width) {
        c->spacer = ui_box(c->root);
        lv_obj_set_size(c->spacer, 1, 4);
        lv_obj_set_flex_grow(c->spacer, 1);
        lv_label_set_long_mode(c->text, LV_LABEL_LONG_DOT);
        lv_obj_set_style_max_width(c->text, width - 90, 0);
    }
    tick_ring(c->root, c);
    c->end_kind = (card_end_t)-1;
    ui_show(c->steps, false);
}

/* Longer words wrap onto more lines (up to `max_text` px wide) and the card grows to fit. */
void lime_card_wrap(lime_card_t *c, int32_t max_text)
{
    lv_label_set_long_mode(c->text, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_max_width(c->text, max_text, 0);
    lv_obj_set_style_text_align(c->text, LV_TEXT_ALIGN_LEFT, 0);
    lv_obj_set_height(c->root, LV_SIZE_CONTENT);
    lv_obj_set_style_pad_top(c->root, 8, 0);
    lv_obj_set_style_pad_bottom(c->root, 8, 0);
}

void lime_card_set_color(lime_card_t *c, uint32_t bg)
{
    lv_obj_set_style_bg_color(c->root, COL(bg), 0);
}

void lime_card_set(lime_card_t *c, const char *icon, const char *text, card_end_t end)
{
    ui_show(c->steps, false);
    ui_show(c->icon, icon != NULL);
    if (icon) ui_icon_set(c->icon, icon, 18);
    ui_set_text(c->text, text);
    if (c->end_kind == end) return;
    c->end_kind = end;
    lv_obj_t *e = c->end;
    bool lime = end == CARD_END_BUTTON || end == CARD_END_TAP;
    lime_card_set_color(c, lime ? C_LIME : C_LAVENDER);
    ui_show(e, end != CARD_END_NONE);
    lv_obj_set_style_pad_right(c->root, end == CARD_END_NONE ? 14 : end == CARD_END_OK ? 4 : 8, 0);
    ui_show(c->end_dot, false);   /* Figma: the ring alone; the arc at 1 o'clock says it's the button */
    ui_show(c->end_label, end == CARD_END_OK);
    lv_obj_set_style_bg_opa(e, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(e, 0, 0);
    lv_obj_t *old_check = lv_obj_get_child(e, 2);
    if (old_check) lv_obj_delete(old_check);
    switch (end) {
    case CARD_END_BUTTON:
    case CARD_END_TAP:
        lv_obj_set_size(e, 22, 22);
        lv_obj_set_style_radius(e, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_border_width(e, 2, 0);
        lv_obj_set_style_border_color(e, COL(C_NAVY), 0);
        lv_obj_set_style_border_opa(e, LV_OPA_COVER, 0);
        break;
    case CARD_END_DONE: {
        lv_obj_set_size(e, 22, 22);
        lv_obj_set_style_radius(e, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(e, COL(C_NAVY), 0);
        lv_obj_set_style_bg_opa(e, LV_OPA_COVER, 0);
        lv_obj_t *chk = ui_icon(e, "check", 14, C_LAVENDER);
        lv_obj_center(chk);
        break;
    }
    case CARD_END_OK:
        /* the action inside: a small lime button, 52 x 32, r 10 */
        lv_obj_set_size(e, LV_SIZE_CONTENT, 32);
        lv_obj_set_style_radius(e, 10, 0);
        lv_obj_set_style_bg_color(e, COL(C_LIME), 0);
        lv_obj_set_style_bg_opa(e, LV_OPA_COVER, 0);
        lv_obj_set_style_pad_hor(e, 14, 0);
        break;
    default:
        break;
    }
}

void lime_card_set_steps(lime_card_t *c, int total, int done)
{
    ui_show(c->icon, false);
    ui_show(c->steps, true);
    bool rebuilt = (int)lv_obj_get_child_count(c->steps) != total;
    if (rebuilt) {
        lv_obj_clean(c->steps);
        for (int i = 0; i < total; i++) {
            lv_obj_t *d = ui_box(c->steps);
            lv_obj_set_size(d, 8, 8);
            lv_obj_set_pos(d, i * 11, 0);
            lv_obj_set_style_radius(d, 2, 0);
        }
        lv_obj_set_width(c->steps, total * 11 - 3);
    }
    for (int i = 0; i < total; i++) {
        lv_obj_t *d = lv_obj_get_child(c->steps, i);
        lv_obj_set_style_bg_color(d, COL(C_NAVY), 0);
        lv_obj_set_style_border_color(d, COL(C_NAVY), 0);
        if (i < done) { lv_obj_set_style_bg_opa(d, LV_OPA_COVER, 0); lv_obj_set_style_border_width(d, 0, 0); }
        else if (i == done) { lv_obj_set_style_bg_opa(d, LV_OPA_TRANSP, 0); lv_obj_set_style_border_width(d, 2, 0); }
        else { lv_obj_set_style_bg_opa(d, 71, 0); lv_obj_set_style_border_width(d, 0, 0); }
    }
    /* a step just ticked: its dot pops and a ripple leaves the ring */
    if (!rebuilt && done == c->done_shown + 1) {
        lv_obj_t *d = lv_obj_get_child(c->steps, done - 1);
        if (d) fx_pop(d, 0);
        fx_ripple_from(c->end, 11, 34, C_LIME);
    }
    c->done_shown = done;
}

/* ================================================================ speech bubble */
/* Figma "Pet speech": cream, r 12, 12 x 7 padding, Message 17 in navy, a 14 x 9 tail bottom-left. */
static void tail_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    const bubble_t *b = lv_obj_get_user_data(obj);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_triangle_dsc_t t;
    lv_draw_triangle_dsc_init(&t);
    t.color = COL(C_BONE);
    t.opa = lv_obj_get_style_opa_recursive(obj, 0);
    if (b && b->top) {
        t.p[0].x = c.x1; t.p[0].y = c.y1 + 9;
        t.p[1].x = c.x1 + 14; t.p[1].y = c.y1 + 9;
        t.p[2].x = c.x1 + 7; t.p[2].y = c.y1;
    } else {
        t.p[0].x = c.x1; t.p[0].y = c.y1;
        t.p[1].x = c.x1 + 14; t.p[1].y = c.y1;
        t.p[2].x = c.x1 + 2; t.p[2].y = c.y1 + 9;
    }
    lv_draw_triangle(lv_event_get_layer(e), &t);
}

void bubble_create(lv_obj_t *parent, bubble_t *b)
{
    b->tail = ui_box(parent);
    lv_obj_set_size(b->tail, 14, 9);
    lv_obj_set_user_data(b->tail, b);
    lv_obj_add_event_cb(b->tail, tail_draw, LV_EVENT_DRAW_MAIN, NULL);
    b->top = false;
    b->root = ui_row(parent, 0);
    ui_style_card(b->root, C_BONE, 12, 0, 0);
    lv_obj_set_style_pad_hor(b->root, 12, 0);
    lv_obj_set_style_pad_ver(b->root, 7, 0);
    b->label = ui_label(b->root, F_MESSAGE, C_NAVY, "");
    lv_obj_set_style_max_width(b->label, 260, 0);
    bubble_hide(b);
}

void bubble_say(bubble_t *b, const char *text, int32_t x, int32_t y)
{
    bool fresh = lv_obj_has_flag(b->root, LV_OBJ_FLAG_HIDDEN) || strcmp(lv_label_get_text(b->label), text) != 0;
    b->top = false;
    ui_set_text(b->label, text);
    lv_obj_update_layout(b->root);
    int32_t w = lv_obj_get_width(b->root);
    if (x + w > 420) x = 420 - w;   /* keep it inside the round screen */
    lv_obj_set_pos(b->root, x, y);
    lv_obj_set_pos(b->tail, x + 9, y + lv_obj_get_height(b->root) - 1);
    ui_show(b->root, true);
    ui_show(b->tail, true);
    if (fresh) { fx_slide(b->root, 8, 0); fx_slide(b->tail, 8, 0); }   /* something new to say: a little hop */
}

void bubble_say_top(bubble_t *b, const char *text, int32_t y)
{
    bool fresh = lv_obj_has_flag(b->root, LV_OBJ_FLAG_HIDDEN) || strcmp(lv_label_get_text(b->label), text) != 0;
    b->top = true;
    ui_set_text(b->label, text);
    lv_obj_update_layout(b->root);
    int32_t w = lv_obj_get_width(b->root);
    lv_obj_set_pos(b->root, CENTER - w / 2, y + 8);
    lv_obj_set_pos(b->tail, CENTER - 7, y);
    ui_show(b->root, true);
    ui_show(b->tail, true);
    lv_obj_invalidate(b->tail);
    if (fresh) { fx_slide(b->root, 8, 0); fx_slide(b->tail, 8, 0); }
}

void bubble_hide(bubble_t *b)
{
    ui_show(b->root, false);
    ui_show(b->tail, false);
}

/* ================================================================ time pill */
/* Figma "Time pill": 26 high, r 13, card with a line outline, 10 px left, 12 px right, a 14 px
 * icon and Label 16, both in the tone colour. */
void time_pill_create(lv_obj_t *parent, time_pill_t *p)
{
    p->root = ui_row(parent, 6);
    lv_obj_set_height(p->root, 26);
    ui_style_card(p->root, C_GLASS, 13, C_LINE, LV_OPA_COVER);
    lv_obj_set_style_pad_left(p->root, 10, 0);
    lv_obj_set_style_pad_right(p->root, 12, 0);
    p->icon = ui_icon(p->root, "timer", 14, C_LIME);
    p->text = ui_label(p->root, F_LABEL, C_LIME, "");
}

void time_pill_set(time_pill_t *p, const char *icon, const char *text, uint32_t tone)
{
    ui_show(p->icon, icon && *icon);
    if (icon && *icon) ui_icon_set(p->icon, icon, 14);
    ui_set_color(p->icon, tone);
    ui_set_text(p->text, text);
    ui_set_color(p->text, tone);
}

/* ================================================================ status pill */
/* Figma "Status pill": 32 high, r 16, card with a line outline, 12 px left, 14 px right, icon 16. */
lv_obj_t *status_pill_create(lv_obj_t *parent, const char *icon, const char *text, uint32_t color)
{
    lv_obj_t *p = ui_row(parent, 6);
    lv_obj_set_height(p, 32);
    ui_style_card(p, C_GLASS, 16, C_LINE, LV_OPA_COVER);
    lv_obj_set_style_pad_left(p, 12, 0);
    lv_obj_set_style_pad_right(p, 14, 0);
    if (icon && *icon) ui_icon(p, icon, 16, color);
    ui_label(p, F_LABEL, color, text);
    return p;
}

/* ================================================================ buttons */
/* Figma "Button": Large 44 high (r 22, 22 px sides, Button 18), Small 32 (r 16, 14 px, Label 16).
 * Primary is filled lime with navy words, Secondary a lime outline, Tertiary lime words only. */
lv_obj_t *button_create(lv_obj_t *parent, button_kind_t kind, bool small, const char *icon, const char *label)
{
    lv_obj_t *b = ui_row(parent, small ? 6 : 8);
    lv_obj_set_height(b, small ? 32 : 44);
    lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(b, 8);
    int32_t pad = kind == BTN_TERTIARY ? (small ? 8 : 12) : (small ? 14 : 22);
    lv_obj_set_style_pad_hor(b, pad, 0);
    lv_obj_set_style_radius(b, small ? 16 : 22, 0);
    uint32_t fg = kind == BTN_PRIMARY ? C_NAVY : C_LIME;
    if (kind == BTN_PRIMARY) {
        ui_style_card(b, C_LIME, small ? 16 : 22, 0, 0);
        lv_obj_set_style_bg_color(b, COL(C_BONE), LV_STATE_PRESSED);
    } else if (kind == BTN_SECONDARY) {
        lv_obj_set_style_border_width(b, 2, 0);
        lv_obj_set_style_border_color(b, COL(C_LIME), 0);
        lv_obj_set_style_border_opa(b, LV_OPA_COVER, 0);
        lv_obj_set_style_bg_color(b, COL(C_GLASS), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
    } else {
        lv_obj_set_style_bg_color(b, COL(C_GLASS), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
    }
    if (icon && *icon) ui_icon(b, icon, small ? 16 : 20, fg);
    ui_label(b, small ? F_LABEL : F_BUTTON, fg, label);
    return b;
}

/* ================================================================ small things */
/* Figma "Tag": 21 high, r 6, 7 x 3 padding, Tag 14. */
lv_obj_t *chip_create(lv_obj_t *parent, uint32_t bg, uint32_t fg, const char *text)
{
    lv_obj_t *c = ui_row(parent, 0);
    lv_obj_set_height(c, 21);
    if (bg) ui_style_card(c, bg, 6, 0, 0);
    else {
        lv_obj_set_style_radius(c, 6, 0);
        lv_obj_set_style_border_width(c, 2, 0);
        lv_obj_set_style_border_color(c, COL(fg), 0);
        lv_obj_set_style_border_opa(c, LV_OPA_COVER, 0);
    }
    lv_obj_set_style_pad_hor(c, 7, 0);
    ui_label(c, F_TAG, fg, text);
    return c;
}

typedef struct { uint32_t color; int32_t radius; } outline_t;

static void outline_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    outline_t *o = lv_obj_get_user_data(obj);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    float x0 = c.x1 + 1.5f, y0 = c.y1 + 1.5f, x1 = c.x2 - 1.5f, y1 = c.y2 - 1.5f, r = (float)o->radius;
    float w = x1 - x0 - 2 * r, h = y1 - y0 - 2 * r;
    float per = 2 * (w + h) + 2 * PI_F * r;
    int n = (int)(per / 6.5f);
    lv_layer_t *layer = lv_event_get_layer(e);
    for (int i = 0; i < n; i++) {
        float s = i * per / n, x, y;
        if (s < w) { x = x0 + r + s; y = y0; }
        else if ((s -= w) < PI_F * r / 2) { float a = s / r; x = x1 - r + r * sinf(a); y = y0 + r - r * cosf(a); }
        else if ((s -= PI_F * r / 2) < h) { x = x1; y = y0 + r + s; }
        else if ((s -= h) < PI_F * r / 2) { float a = s / r; x = x1 - r + r * cosf(a); y = y1 - r + r * sinf(a); }
        else if ((s -= PI_F * r / 2) < w) { x = x1 - r - s; y = y1; }
        else if ((s -= w) < PI_F * r / 2) { float a = s / r; x = x0 + r - r * sinf(a); y = y1 - r + r * cosf(a); }
        else if ((s -= PI_F * r / 2) < h) { x = x0; y = y1 - r - s; }
        else { s -= h; float a = s / r; x = x0 + r - r * cosf(a); y = y0 + r - r * sinf(a); }
        ring_dot(layer, x, y, 1.5f, COL(o->color), LV_OPA_COVER);
    }
}

static void free_user_data(lv_event_t *e) { lv_free(lv_obj_get_user_data(lv_event_get_target(e))); }

lv_obj_t *dotted_outline_create(lv_obj_t *parent, uint32_t color, int32_t radius)
{
    lv_obj_t *o = ui_box(parent);
    outline_t *d = lv_malloc(sizeof(outline_t));
    d->color = color;
    d->radius = radius;
    lv_obj_set_user_data(o, d);
    lv_obj_add_event_cb(o, outline_draw, LV_EVENT_DRAW_MAIN, NULL);
    lv_obj_add_event_cb(o, free_user_data, LV_EVENT_DELETE, NULL);
    return o;
}

/* Figma "Message" under Biscuit: Message 17 in muted, 260 wide, centred. */
lv_obj_t *note_create(lv_obj_t *parent, int32_t y)
{
    lv_obj_t *l = ui_label(parent, F_MESSAGE, C_MUTED, "");
    lv_obj_set_width(l, 260);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(l, LV_ALIGN_TOP_MID, 0, y);
    return l;
}

/* ================================================================ overlays and swipes */
typedef struct { void (*on_close)(void *); void *user; } swipe_t;

static void slide_done(lv_anim_t *a)
{
    lv_obj_t *o = a->var;
    swipe_t *s = lv_obj_get_user_data(o);
    if (s && s->on_close) s->on_close(s->user);
    lv_obj_delete(o);
}

static void anim_x(void *obj, int32_t v) { lv_obj_set_x(obj, v); }
static void anim_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }
static void anim_ty(void *obj, int32_t v) { lv_obj_set_style_translate_y(obj, v, 0); }

static void run_anim(lv_obj_t *o, lv_anim_exec_xcb_t exec, int32_t v0, int32_t v1, uint32_t ms,
                     lv_anim_path_cb_t path, lv_anim_completed_cb_t done)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, exec);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_path_cb(&a, path);
    if (done) lv_anim_set_completed_cb(&a, done);
    lv_anim_start(&a);
}

/* An overlay on its way out is marked, so a second swipe or a timer doesn't start it leaving twice.
 * Leaving cuts short an arrival still in progress (a flick straight back, a plan that loads at once). */
static bool leaving(lv_obj_t *o)
{
    if (lv_obj_has_flag(o, LV_OBJ_FLAG_USER_1)) return true;
    lv_obj_add_flag(o, LV_OBJ_FLAG_USER_1);
    lv_anim_delete(o, anim_x);
    lv_anim_delete(o, anim_opa);
    lv_anim_delete(o, anim_ty);
    return false;
}

/* Timing after iOS: arrivals decelerate (ease out, ~300 ms), departures ease in and out (~260 ms). */
void overlay_enter_push(lv_obj_t *o)
{
    if (!o) return;
    lv_obj_set_x(o, SCREEN_W);
    run_anim(o, anim_x, SCREEN_W, 0, 300, lv_anim_path_ease_out, NULL);
}

static void rise_done(lv_anim_t *a)
{
    lv_obj_set_style_opa(a->var, LV_OPA_COVER, 0);
    lv_obj_set_style_translate_y(a->var, 0, 0);
}

void overlay_enter_rise(lv_obj_t *o)
{
    if (!o) return;
    lv_obj_set_style_opa(o, LV_OPA_TRANSP, 0);
    lv_obj_set_style_translate_y(o, 24, 0);
    run_anim(o, anim_opa, LV_OPA_TRANSP, LV_OPA_COVER, 220, lv_anim_path_ease_out, NULL);
    run_anim(o, anim_ty, 24, 0, 280, lv_anim_path_ease_out, rise_done);
}

void overlay_slide_away(lv_obj_t *o, int dir)
{
    if (!o || leaving(o)) return; /* already going */
    run_anim(o, anim_x, lv_obj_get_x(o), dir * SCREEN_W, 260, lv_anim_path_ease_in_out, slide_done);
}

void overlay_fade_away(lv_obj_t *o)
{
    if (!o || leaving(o)) return;
    run_anim(o, anim_opa, lv_obj_get_style_opa(o, 0), LV_OPA_TRANSP, 200, lv_anim_path_ease_in, slide_done);
}

static bool on_swipe(lv_obj_t *o, int dir, lv_point_t start, void *user, bool commit)
{
    (void)start; (void)user;
    if (dir == SWIPE_DOWN) return false;
    if (commit) overlay_slide_away(o, dir);
    return true;
}

void swipe_to_close(lv_obj_t *screen, void (*on_close)(void *), void *user)
{
    swipe_t *s = lv_malloc(sizeof(swipe_t));
    s->on_close = on_close;
    s->user = user;
    lv_obj_set_user_data(screen, s);
    lv_obj_add_event_cb(screen, free_user_data, LV_EVENT_DELETE, NULL);
    swipe_add(screen, on_swipe, NULL);
}

lv_obj_t *overlay_create(void)
{
    lv_obj_t *o = ui_box(lv_layer_top());
    lv_obj_set_size(o, SCREEN_W, SCREEN_H);
    lv_obj_add_flag(o, LV_OBJ_FLAG_CLICKABLE);
    ui_style_card(o, C_INK, 0, 0, 0);
    return o;
}
