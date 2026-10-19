#include "widgets.h"
#include "swipe.h"
#include "fx.h"
#include "../pet/pet.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define PI_F 3.14159265f

static bool picture_mode;
static char clock_now[12] = "";
void ui_set_clock(int minutes) { ui_fmt_clock(clock_now, sizeof clock_now, minutes); }
const char *ui_clock(void) { return clock_now; }
void ui_set_picture(bool picture) { picture_mode = picture; }
bool ui_picture(void) { return picture_mode; }

static void free_user_data(lv_event_t *e) { lv_free(lv_obj_get_user_data(lv_event_get_target(e))); }

/* ================================================================ MyToki 2 Timer */
/* Figma "Timer": a ring of segments 223 px out from the centre, from 7:30 round the top to 4:30
 * (270 degrees, open at the bottom where the hill is), 6 px wide with round ends. As Figma lays the
 * 80/14 dashes out evenly: twelve steps of 22.5 degrees, a segment centred on the top, 14 px
 * between segments, and a half segment at each end (13 pieces). The track is timer/track; the
 * lit part, counted from the bottom-left end, is the tone: with 10 minutes or more left it is the
 * time gone by (the ring starts dark and lights up), under 10 and late the whole ring. The time is
 * shared out over the
 * segments alone (not the gaps, the half ones count half), so one segment changes smoothly along
 * its length before the next one starts. */
#define TIMER_R 223.0f
#define TIMER_W 6
#define TIMER_A0 135.0f
#define TIMER_SPAN 270.0f
#define TIMER_STEPS 12
#define TIMER_STEP (TIMER_SPAN / TIMER_STEPS)
#define TIMER_GAP (14.0f / TIMER_R * 180.0f / PI_F)
#define TIMER_PIECES (TIMER_STEPS + 1)

typedef struct { timer_tone_t tone; int16_t left; bool pulse; uint8_t breath; lv_timer_t *timer; } timer_data_t;

static const uint32_t TONE_COLOR[] = { C_PLENTY, C_HURRY, C_LATE_RING, C_NIGHT };

/* piece i runs from piece_a[i] to piece_b[i] degrees (on the stroke's centre line) */
static void timer_piece(int i, float *a, float *b)
{
    const float half = TIMER_STEP / 2 - TIMER_GAP / 2;
    if (i == 0) { *a = TIMER_A0; *b = TIMER_A0 + half; return; }
    if (i == TIMER_PIECES - 1) { *a = TIMER_A0 + TIMER_SPAN - half; *b = TIMER_A0 + TIMER_SPAN; return; }
    float c = TIMER_A0 + i * TIMER_STEP;
    *a = c - (TIMER_STEP - TIMER_GAP) / 2;
    *b = c + (TIMER_STEP - TIMER_GAP) / 2;
}

/* LVGL draws arcs in whole degrees (about 4 px out here), so the ends that fall between two are
 * drawn as short round-ended lines to the exact spot: the fill moves a pixel at a time. Everything
 * is drawn opaque (the pulse darkens the colour instead), so the overlaps don't show. */
static void timer_line(lv_layer_t *layer, const lv_draw_arc_dsc_t *d, float a0, float a1)
{
    lv_draw_line_dsc_t l;
    lv_draw_line_dsc_init(&l);
    l.color = d->color;
    l.width = TIMER_W;
    l.round_start = l.round_end = 1;
    float p = a0 * PI_F / 180.0f, q = a1 * PI_F / 180.0f;
    l.p1.x = (int32_t)lroundf(d->center.x + TIMER_R * cosf(p));
    l.p1.y = (int32_t)lroundf(d->center.y + TIMER_R * sinf(p));
    l.p2.x = (int32_t)lroundf(d->center.x + TIMER_R * cosf(q));
    l.p2.y = (int32_t)lroundf(d->center.y + TIMER_R * sinf(q));
    lv_draw_line(layer, &l);
}

static void timer_stroke(lv_layer_t *layer, lv_draw_arc_dsc_t *d, float a0, float a1)
{
    if (a1 - a0 < 0.05f) return;
    int32_t s = (int32_t)ceilf(a0), e = (int32_t)floorf(a1);
    if (e <= s) { timer_line(layer, d, a0, a1); return; }
    d->start_angle = s % 360;
    d->end_angle = e % 360;
    lv_draw_arc(layer, d);
    if (s - a0 > 0.05f) timer_line(layer, d, a0, (float)s);
    if (a1 - e > 0.05f) timer_line(layer, d, (float)e, a1);
}

static void timer_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    timer_data_t *t = lv_obj_get_user_data(obj);
    if (!t) return;
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_arc_dsc_t d;
    lv_draw_arc_dsc_init(&d);
    d.center.x = c.x1 + CENTER;
    d.center.y = c.y1 + CENTER;
    d.radius = (int32_t)(TIMER_R + TIMER_W / 2.0f + 0.5f);
    d.width = TIMER_W;
    d.rounded = 1;
    d.opa = LV_OPA_COVER;
    float total = 0, a, b;
    for (int i = 0; i < TIMER_PIECES; i++) { timer_piece(i, &a, &b); total += b - a; }
    const int16_t shown = t->tone == TIMER_PLENTY ? 1000 - t->left : t->left;
    const float lit = total * shown / 1000.0f;
    /* the track: every piece not yet reached, and the rest of the one changing now */
    d.color = COL(C_TRACK);
    float left = lit;
    for (int i = 0; i < TIMER_PIECES; i++) {
        timer_piece(i, &a, &b);
        if (left < b - a) timer_stroke(layer, &d, a + fmaxf(left, 0.0f), b);
        left -= b - a;
    }
    d.color = COL(TONE_COLOR[t->tone]);
    if (t->pulse) d.color = lv_color_mix(d.color, COL(C_SCREEN), (uint8_t)(150 + 105 * t->breath / 255));   /* breathing, over black */
    left = lit;
    for (int i = 0; i < TIMER_PIECES && left > 0; i++) {
        timer_piece(i, &a, &b);
        timer_stroke(layer, &d, a, a + fminf(left, b - a));
        left -= b - a;
    }
}

static void timer_tick(lv_timer_t *tm)
{
    lv_obj_t *obj = lv_timer_get_user_data(tm);
    timer_data_t *t = lv_obj_get_user_data(obj);
    if (!t->pulse || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) return;
    float ph = (lv_tick_get() % 1600) / 1600.0f;
    t->breath = (uint8_t)(255 * (0.5f + 0.5f * cosf(ph * 2 * PI_F)));
    lv_obj_invalidate(obj);
}

static void timer_delete(lv_event_t *e)
{
    timer_data_t *t = lv_obj_get_user_data(lv_event_get_target(e));
    if (t) { lv_timer_delete(t->timer); lv_free(t); }
}

lv_obj_t *timer_create(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, SCREEN_W, SCREEN_H);
    timer_data_t *t = lv_malloc_zeroed(sizeof(timer_data_t));
    t->left = 1000;
    lv_obj_set_user_data(o, t);
    lv_obj_add_event_cb(o, timer_draw, LV_EVENT_DRAW_MAIN, NULL);
    lv_obj_add_event_cb(o, timer_delete, LV_EVENT_DELETE, NULL);
    t->timer = lv_timer_create(timer_tick, 80, o);
    return o;
}

void timer_set(lv_obj_t *obj, timer_tone_t tone, int16_t left, bool pulse)
{
    timer_data_t *t = lv_obj_get_user_data(obj);
    if (left < 0) left = 0;
    if (left > 1000) left = 1000;
    if (t->tone == tone && t->left == left && t->pulse == pulse) return;
    t->tone = tone;
    t->left = left;
    t->pulse = pulse;
    lv_obj_invalidate(obj);
}

/* ================================================================ Pill */
/* Figma "Pill": 38 high, fully round, 12 px left (16 without an icon), 16 px right, a 20 px icon,
 * Pill 24. Calm = chip with lavender words; Hurry = amber; Late = coral, no icon; Night, Star and
 * Done = chip with iris, amber or mint words; System = lavender. */
static void pill_colors(pill_tone_t tone, uint32_t *bg, uint32_t *fg)
{
    switch (tone) {
    case PILL_HURRY: *bg = C_STAR; *fg = C_ON_COLOR; break;
    case PILL_LATE: *bg = C_LATE; *fg = C_ON_COLOR; break;
    case PILL_NIGHT: *bg = C_CHIP; *fg = C_NIGHT; break;
    case PILL_STAR: *bg = C_CHIP; *fg = C_STAR; break;
    case PILL_DONE: *bg = C_CHIP; *fg = C_DONE; break;
    case PILL_SYSTEM: *bg = C_SYSTEM; *fg = C_ON_COLOR; break;
    case PILL_ACTION: *bg = C_ACTION; *fg = C_ON_COLOR; break;   /* a price the child can pay */
    default: *bg = C_CHIP; *fg = C_CALM; break;
    }
}

void pill_create(lv_obj_t *parent, pill_t *p)
{
    p->root = ui_row(parent, 8);
    ui_style_card(p->root, C_CHIP, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_pad_left(p->root, 12, 0);
    lv_obj_set_style_pad_right(p->root, 16, 0);
    lv_obj_set_style_pad_ver(p->root, 2, 0);
    p->icon = ui_icon(p->root, "timer", 20, C_CALM);
    p->text = ui_label(p->root, F_PILL, C_CALM, "");
    p->tone = PILL_CALM;
}

void pill_set(pill_t *p, pill_tone_t tone, const char *icon, const char *text)
{
    uint32_t bg, fg;
    pill_colors(tone, &bg, &fg);
    bool has_icon = icon && *icon;
    ui_show(p->icon, has_icon);
    if (has_icon) ui_icon_set(p->icon, icon, 20);
    lv_obj_set_style_pad_left(p->root, has_icon ? 12 : 16, 0);
    lv_obj_set_style_bg_color(p->root, COL(bg), 0);
    ui_set_color(p->icon, fg);
    ui_set_color(p->text, fg);
    ui_set_text(p->text, text);
    if (tone != p->tone && !lv_obj_has_flag(p->root, LV_OBJ_FLAG_HIDDEN)) fx_bounce(p->root, 6, 0);   /* the mood changed */
    p->tone = tone;
}

/* the older calls: the tone is read from the colour they passed */
void time_pill_create(lv_obj_t *parent, time_pill_t *p) { pill_create(parent, p); }

static pill_tone_t tone_of(uint32_t c, bool status)
{
    if (c == C_STAR) return status ? PILL_STAR : PILL_HURRY;
    if (c == C_DONE) return PILL_DONE;
    if (c == C_NIGHT) return PILL_NIGHT;
    if (c == C_LATE || c == C_LATE_RING) return PILL_LATE;
    if (c == C_SYSTEM) return PILL_SYSTEM;
    return PILL_CALM;
}

void time_pill_set(time_pill_t *p, const char *icon, const char *text, uint32_t tone) { pill_set(p, tone_of(tone, false), icon, text); }

lv_obj_t *status_pill_create(lv_obj_t *parent, const char *icon, const char *text, uint32_t color)
{
    pill_t p;
    pill_create(parent, &p);
    pill_set(&p, tone_of(color, true), icon, text);
    return p.root;
}

/* ================================================================ Header */
/* Figma "MyToki 2 / Header" (1070:4496): a 340 wide column at y 23: the clock (Clock 22), the title
 * (Title 30, Poppins Bold, wrapping at 256) tucked 4 px up under it, then 6 px down a Pill or a quiet
 * line (Body 22, muted, wrapping at 272). */
#define HEADER_Y 23
void header_create(lv_obj_t *parent, header_t *h)
{
    h->root = ui_box(parent);
    lv_obj_set_size(h->root, 340, LV_SIZE_CONTENT);
    lv_obj_set_pos(h->root, 63, HEADER_Y);
    lv_obj_set_flex_flow(h->root, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(h->root, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(h->root, 0, 0);
    h->clock = ui_label(h->root, F_CLOCK_LINE, C_TEXT, "");
    h->title = ui_label(h->root, F_TITLE, C_TEXT, "");
    lv_obj_set_style_max_width(h->title, 256, 0);
    lv_obj_set_style_text_align(h->title, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(h->title, LV_LABEL_LONG_WRAP);
    pill_create(h->root, &h->pill);
    lv_obj_set_style_pad_ver(h->pill.root, 3, 0);    /* 38 high, like Figma's 4 px around a 30 px line */
    lv_obj_set_style_margin_top(h->pill.root, 6, 0);
    h->text = ui_label(h->root, F_BODY_P, C_TEXT_MUTED, "");
    lv_obj_set_style_margin_top(h->text, 6, 0);
    lv_obj_set_style_max_width(h->text, 272, 0);
    lv_obj_set_style_text_align(h->text, LV_TEXT_ALIGN_CENTER, 0);
}

void header_set(header_t *h, const char *clock, const char *title, header_below_t below,
                pill_tone_t tone, const char *icon, const char *text)
{
    bool c = clock && *clock, t = title && *title;
    ui_show(h->clock, c);
    if (c) ui_set_text(h->clock, clock);
    ui_show(h->title, t);
    if (t) ui_set_text(h->title, title);
    /* the title's text box starts 24 px under the clock's (Figma: 28 px line, -4 gap); with no title
     * the pill sits right under the clock, clear of the wheel's pointer at y 90 */
    if (lv_obj_get_style_margin_top(h->title, 0) != (c ? -4 : 0)) lv_obj_set_style_margin_top(h->title, c ? -4 : 0, 0);
    int32_t pill_gap = c && !t ? 0 : 6;
    if (lv_obj_get_style_margin_top(h->pill.root, 0) != pill_gap) lv_obj_set_style_margin_top(h->pill.root, pill_gap, 0);
    ui_show(h->pill.root, below == HEADER_PILL && text && *text);
    ui_show(h->text, below == HEADER_TEXT && text && *text);
    if (below == HEADER_PILL && text && *text) pill_set(&h->pill, tone, icon, text);
    if (below == HEADER_TEXT && text && *text) ui_set_text(h->text, text);
}

/* ================================================================ Hill */
/* Figma "Hill": an 800 x 293 ellipse whose top shows across the bottom of the screen from y 368,
 * bg/hill with a 1 px line/hill rim. Drawn once into an image, then shared by every hill. */
#define HILL_Y 368
#define HILL_H (SCREEN_H - HILL_Y)
#define FOOT_Y 420           /* the side pages: a low band of the same hill under the page dots */
typedef struct { lv_image_dsc_t img; uint8_t *px; } hill_pic_t;
static hill_pic_t hill_pics[2];

/* The top of the hill from `top` down to the rim, drawn once. */
static const lv_image_dsc_t *hill_image_at(int32_t top)
{
    hill_pic_t *pic = &hill_pics[top == HILL_Y ? 0 : 1];
    const int32_t h = SCREEN_H - top;
    if (pic->px) return &pic->img;
    pic->px = lv_malloc((size_t)SCREEN_W * h * 4);
    if (!pic->px) return NULL;
    uint8_t *hill_px = pic->px;
    lv_image_dsc_t *hill_img = &pic->img;
    const float cx = CENTER, cy = 146.5f, A = 400.0f, B = 146.5f;
    const float fr = 0x0E, fg = 0x12, fb = 0x21, lr = 0x4F, lg = 0x58, lb = 0x84;
    for (int y = 0; y < h; y++) {
        for (int x = 0; x < SCREEN_W; x++) {
            float u = (x + 0.5f - cx) / A, v = (y + 0.5f - cy) / B;
            float F = u * u + v * v - 1.0f;
            float g = 2.0f * sqrtf((u / A) * (u / A) + (v / B) * (v / B));
            float dist = g > 0 ? F / g : -10.0f;   /* px from the rim, negative inside */
            float cov = fminf(1.0f, fmaxf(0.0f, 0.5f - dist));
            float inner = fminf(1.0f, fmaxf(0.0f, 0.5f - (dist + 1.0f)));
            float line = cov - inner;
            uint8_t *px = &hill_px[((size_t)y * SCREEN_W + x) * 4];
            if (cov <= 0) { px[0] = px[1] = px[2] = px[3] = 0; continue; }
            float k = line / cov;
            px[0] = (uint8_t)(fb + (lb - fb) * k);
            px[1] = (uint8_t)(fg + (lg - fg) * k);
            px[2] = (uint8_t)(fr + (lr - fr) * k);
            px[3] = (uint8_t)(cov * 255.0f + 0.5f);
        }
    }
    hill_img->header.magic = LV_IMAGE_HEADER_MAGIC;
    hill_img->header.cf = LV_COLOR_FORMAT_ARGB8888;
    hill_img->header.w = SCREEN_W;
    hill_img->header.h = h;
    hill_img->header.stride = SCREEN_W * 4;
    hill_img->data_size = (uint32_t)SCREEN_W * h * 4;
    hill_img->data = hill_px;
    return hill_img;
}
static const lv_image_dsc_t *hill_image(void) { return hill_image_at(HILL_Y); }

static void hill_fire(lv_event_t *e)
{
    hill_cb_t cb = (hill_cb_t)lv_event_get_user_data(e);
    lv_obj_t *t = lv_event_get_current_target(e);
    hill_tap_t tap = (hill_tap_t)(intptr_t)lv_obj_get_user_data(t);
    if (cb) cb(tap);
}

static lv_obj_t *dots_build(lv_obj_t *parent)
{
    lv_obj_t *box = ui_row(parent, 6);
    for (int i = 0; i < 3; i++) {
        lv_obj_t *d = ui_box(box);
        lv_obj_set_size(d, 6, 6);
        ui_style_card(d, C_CHIP, 3, 0, 0);
    }
    return box;
}

void page_dots_set(lv_obj_t *box, int page)
{
    for (int i = 0; i < 3; i++) {
        lv_obj_t *d = lv_obj_get_child(box, i);
        bool here = i == page;
        lv_obj_set_width(d, here ? 18 : 6);
        lv_obj_set_style_bg_color(d, COL(here ? C_ACTION : C_CHIP), 0);
    }
}

lv_obj_t *page_dots_create(lv_obj_t *parent, int page)
{
    lv_obj_t *band = lv_image_create(parent);
    lv_image_set_src(band, hill_image_at(FOOT_Y));
    lv_obj_set_pos(band, 0, FOOT_Y);
    lv_obj_remove_flag(band, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_t *box = dots_build(parent);
    page_dots_set(box, page);
    lv_obj_update_layout(box);
    lv_obj_set_pos(box, CENTER - lv_obj_get_width(box) / 2, 446);
    return box;
}

static lv_obj_t *tap_target(lv_obj_t *o, hill_cb_t cb, hill_tap_t tap)
{
    lv_obj_add_flag(o, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_user_data(o, (void *)(intptr_t)tap);
    lv_obj_add_event_cb(o, hill_fire, LV_EVENT_CLICKED, (void *)cb);
    return o;
}

void hill_create(lv_obj_t *parent, hill_t *h, hill_cb_t cb)
{
    memset(h, 0, sizeof(*h));
    /* a clear 466 x 98 strip at y 368; only Next and Switch draw the curve (Figma Hill variants) */
    h->root = ui_box(parent);
    lv_obj_set_pos(h->root, 0, HILL_Y);
    lv_obj_set_size(h->root, SCREEN_W, HILL_H);
    h->curve = lv_image_create(h->root);
    lv_image_set_src(h->curve, hill_image());
    lv_obj_set_pos(h->curve, 0, 0);
    lv_obj_remove_flag(h->curve, LV_OBJ_FLAG_CLICKABLE);
    h->col = ui_box(h->root);
    lv_obj_set_size(h->col, SCREEN_W, HILL_H);
    lv_obj_set_flex_flow(h->col, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(h->col, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(h->col, 8, 0);
    /* Next: "Next 4:00" and the task with its icon (Space Grotesk); the whole hill opens the day */
    h->next = ui_box(h->col);
    lv_obj_set_size(h->next, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(h->next, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(h->next, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_t *when = ui_row(h->next, 8);
    ui_label(when, F_NEXT_LABEL, C_NEXT_LABEL, "Next");
    h->next_time = ui_label(when, F_NEXT_TIME, C_NEXT_LABEL, "");
    lv_obj_t *what = ui_row(h->next, 7);
    h->next_icon = ui_icon(what, "star-line", 20, C_NEXT_TASK);
    h->next_task = ui_label(what, F_NEXT_TASK, C_NEXT_TASK, "");
    lv_label_set_long_mode(h->next_task, LV_LABEL_LONG_DOT);
    lv_obj_set_style_max_width(h->next_task, 250, 0);
    tap_target(h->root, cb, HILL_TAP_NEXT);
    lv_obj_set_ext_click_area(h->root, 0);
    /* Button: one lime outline button, no curve (Figma Hill · Button, secondary, 52 high) */
    h->button = button_create(h->col, BTN_SECONDARY, false, "retry", "");
    lv_obj_set_height(h->button, 52);
    h->button_icon = lv_obj_get_child(h->button, 0);
    h->button_label = lv_obj_get_child(h->button, 1);
    tap_target(h->button, cb, HILL_TAP_BUTTON);
    /* Text: a cream line in Body 22, no curve */
    h->text = ui_label(h->col, F_BODY_P, C_TEXT, "");
    lv_obj_set_style_text_align(h->text, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_max_width(h->text, 300, 0);
    /* Switch: Spin | Play on a night pill (Figma "Mode switch") */
    h->sw = tab_bar_create(h->col);
    h->sw_spin = tab_create(h->sw, "wheel", "Spin");
    h->sw_play = tab_create(h->sw, NULL, "Play");
    tap_target(h->sw_spin, cb, HILL_TAP_SPIN);
    tap_target(h->sw_play, cb, HILL_TAP_PLAY);
    /* the page dots sit at y 80 of the hill (448 on the screen), whatever is above them */
    h->dots = dots_build(h->root);
    lv_obj_set_pos(h->dots, CENTER - 21, 80);
    h->page = -1;
    hill_set_empty(h);
    hill_set_dots(h, -1);
}

static void hill_kind(hill_t *h, hill_kind_t kind)
{
    bool fresh = kind != h->kind;
    h->kind = kind;
    ui_show(h->next, kind == HILL_NEXT);
    ui_show(h->button, kind == HILL_BUTTON);
    ui_show(h->text, kind == HILL_TEXT);
    ui_show(h->sw, kind == HILL_SWITCH);
    ui_show(h->curve, kind == HILL_NEXT || kind == HILL_SWITCH);
    static const int32_t PAD[] = { 0, 9, 14, 24, 23 };
    lv_obj_set_style_pad_top(h->col, PAD[kind], 0);
    if (fresh) {   /* what the hill says now rises into place */
        lv_obj_t *shown = kind == HILL_NEXT ? h->next : kind == HILL_BUTTON ? h->button : kind == HILL_TEXT ? h->text : kind == HILL_SWITCH ? h->sw : NULL;
        if (shown) fx_rise(shown, 14, 60);
    }
    if (kind == HILL_NEXT) lv_obj_add_flag(h->root, LV_OBJ_FLAG_CLICKABLE);
    else lv_obj_remove_flag(h->root, LV_OBJ_FLAG_CLICKABLE);
}

void hill_set_next(hill_t *h, const char *icon, const char *title, const char *time)
{
    hill_kind(h, HILL_NEXT);
    ui_icon_set(h->next_icon, icon && *icon ? icon : "star-line", 20);
    ui_set_text(h->next_task, title);
    ui_set_text(h->next_time, time ? time : "");
    ui_show(h->next_time, time && *time);
}

void hill_set_button(hill_t *h, const char *icon, const char *label)
{
    hill_kind(h, HILL_BUTTON);
    ui_show(h->button_icon, icon && *icon);
    if (icon && *icon) ui_icon_set(h->button_icon, icon, 22);
    ui_set_text(h->button_label, label);
}

void hill_set_text(hill_t *h, const char *text)
{
    hill_kind(h, HILL_TEXT);
    ui_set_text(h->text, text);
}

void hill_set_switch(hill_t *h, bool play)
{
    hill_kind(h, HILL_SWITCH);
    tab_select(h->sw_spin, !play);
    tab_select(h->sw_play, play);
}

void hill_set_empty(hill_t *h) { hill_kind(h, HILL_EMPTY); }

void hill_set_dots(hill_t *h, int page)
{
    ui_show(h->dots, page >= 0);
    if (page >= 0 && page != h->page) page_dots_set(h->dots, page);
    h->page = page;
}

/* ================================================================ the graphic's frame */
lv_obj_t *faint_circle_create(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, 298, 298);
    lv_obj_set_pos(o, 84, 84);
    lv_obj_set_style_radius(o, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(o, 1, 0);
    lv_obj_set_style_border_color(o, COL(C_FAINT), 0);
    lv_obj_set_style_border_opa(o, LV_OPA_COVER, 0);
    return o;
}

/* Figma "Scrim" (in "MyToki 2 / Graphic"): the header stays readable over bright rooms: black at
 * 55 % at the top, 25 % at y 105, clear by y 190. */
lv_obj_t *scrim_create(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, SCREEN_W, 190);
    lv_obj_set_pos(o, 0, 0);
    static lv_grad_dsc_t g;
    g.dir = LV_GRAD_DIR_VER;
    g.stops_count = 3;
    g.stops[0].color = COL(C_SCREEN); g.stops[0].opa = 140; g.stops[0].frac = 0;
    g.stops[1].color = COL(C_SCREEN); g.stops[1].opa = 64; g.stops[1].frac = 140;
    g.stops[2].color = COL(C_SCREEN); g.stops[2].opa = LV_OPA_TRANSP; g.stops[2].frac = 255;
    lv_obj_set_style_bg_grad(o, &g, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    return o;
}

/* Figma "Fade" on the screens with a scroll list: black behind the title, so rows that turn up under
 * the header slip out of sight. 370 x 99 from x 48, solid to 33 %, clear by 69 %. Put it on after the
 * list and before the header. `y` is its top (the Younger schedule: 89). */
lv_obj_t *list_fade_create(lv_obj_t *parent, int32_t y)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, 370, 99);
    lv_obj_set_pos(o, 48, y);
    static lv_grad_dsc_t g;
    g.dir = LV_GRAD_DIR_VER;
    g.stops_count = 2;
    g.stops[0].color = COL(C_SCREEN); g.stops[0].opa = LV_OPA_COVER; g.stops[0].frac = 83;
    g.stops[1].color = COL(C_SCREEN); g.stops[1].opa = LV_OPA_TRANSP; g.stops[1].frac = 176;
    lv_obj_set_style_bg_grad(o, &g, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    return o;
}

/* ================================================================ dot ring (loading, spotlight, halos) */
typedef struct {
    ring_style_t s;
    int32_t radius;
    uint8_t breath, head;
    lv_timer_t *timer;
    int32_t scale;
    int16_t rot;
    int8_t drift;
    bool wave;
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
        float a = (d->s.arc ? (216.0f + 6.0f * i) * PI_F / 180.0f : i * 2 * PI_F / d->s.count) + rot;
        float x = cx + rad * sinf(a), y = cy - rad * cosf(a);
        float wf = 1;
        if (d->wave) {
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
        static const uint32_t CONFETTI[] = { C_SYSTEM, C_DONE, C_PINK, C_LATE, C_NIGHT, C_CARROT, C_STAR };
        uint32_t lc = d->s.confetti ? CONFETTI[(i * 5 + d->radius) % 7] : d->s.lit_color;
        if (d->s.edge > 0) ring_dot(layer, x, y, (i < d->s.lit ? d->s.lit_r : d->s.dim_r) + d->s.edge, COL(d->s.edge_color), LV_OPA_COVER);
        if (i < d->s.lit) ring_dot(layer, x, y, d->s.lit_r, COL(lc), (lv_opa_t)(d->s.lit_opa * k * wf));
        else ring_dot(layer, x, y, d->s.dim_r, COL(d->s.dim_color), d->s.dim_opa);
    }
}

static void ring_tick(lv_timer_t *t)
{
    lv_obj_t *obj = lv_timer_get_user_data(t);
    ring_data_t *d = lv_obj_get_user_data(obj);
    if (lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) return;
    if (d->s.pulse) {
        float ph = (lv_tick_get() % 1600) / 1600.0f;
        d->breath = (uint8_t)(255 * (0.5f + 0.5f * cosf(ph * 2 * PI_F)));
        lv_obj_invalidate(obj);
    } else if (d->s.comet) {
        d->head = (uint8_t)((d->head + 1) % d->s.count);
        lv_obj_invalidate(obj);
    } else if (d->wave || d->drift) {
        d->rot = (int16_t)((d->rot + d->drift) % 3600);
        lv_obj_invalidate(obj);
    }
}

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
    ring_data_t *d = lv_obj_get_user_data(lv_event_get_target(e));
    if (d) {
        if (d->timer) lv_timer_delete(d->timer);
        lv_free(d);
    }
}

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

/* ================================================================ button cue (Playtime) */
/* the cue's state lives in its user data: the ring (0..100) in the low byte, dark in bit 8 */
void cue_set(lv_obj_t *cue, uint8_t ring, bool dark)
{
    intptr_t v = (intptr_t)ring | (dark ? 0x100 : 0);
    if ((intptr_t)lv_obj_get_user_data(cue) == v) return;
    lv_obj_set_user_data(cue, (void *)v);
    lv_obj_invalidate(cue);
}

static void cue_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    intptr_t v = (intptr_t)lv_obj_get_user_data(obj);
    uint8_t cue_ring = (uint8_t)(v & 0xFF);
    bool cue_dark = (v & 0x100) != 0;
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_arc_dsc_t a;
    lv_draw_arc_dsc_init(&a);
    a.center.x = c.x1 + CENTER;
    a.center.y = c.y1 + CENTER;
    a.rounded = 1;
    a.radius = 228;
    a.width = TIMER_W;
    a.start_angle = 293;
    a.end_angle = 307;
    a.color = COL(cue_dark ? C_CHIP : C_ACTION);
    a.opa = LV_OPA_COVER;
    if (cue_ring && !cue_dark) {
        a.color = COL(C_CHIP);
        lv_draw_arc(layer, &a);
        a.color = COL(C_ACTION);
        int half = 7 * cue_ring / 100;
        if (half <= 0) return;
        a.start_angle = 300 - half;
        a.end_angle = 300 + half;
    }
    lv_draw_arc(layer, &a);
}

lv_obj_t *cue_create(lv_obj_t *parent)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, SCREEN_W, SCREEN_H);
    lv_obj_add_event_cb(o, cue_draw, LV_EVENT_DRAW_MAIN, NULL);
    return o;
}

/* ================================================================ Side nav */
/* Figma "Nav button": 54 px, bg/raised, a 26 px lime icon. */
lv_obj_t *side_button_create(lv_obj_t *parent, bool left, const char *icon)
{
    lv_obj_t *b = ui_box(parent);
    lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_size(b, 54, 54);
    lv_obj_set_pos(b, left ? 24 : 388, 206);
    ui_style_card(b, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_bg_color(b, COL(C_CHIP), LV_STATE_PRESSED);
    lv_obj_set_ext_click_area(b, 8);
    lv_obj_t *i = ui_icon(b, icon, 26, C_ACTION);
    lv_obj_center(i);
    return b;
}

/* ================================================================ Note */
/* Figma "Note": lavender, fully round, 6 px high padding, 12 px left, a 20 px navy icon, Detail 20
 * in navy. Step: "2/4" (Item 22) in front, a 24 px navy ring the button ticks at the end. */
static void tick_ring(lv_obj_t *parent, lime_card_t *c)
{
    c->end = ui_box(parent);
    lv_obj_set_size(c->end, 24, 24);
    lv_obj_set_style_radius(c->end, LV_RADIUS_CIRCLE, 0);
    c->end_dot = ui_box(c->end);
    lv_obj_set_size(c->end_dot, 8, 8);
    lv_obj_center(c->end_dot);
    ui_style_card(c->end_dot, C_ON_COLOR, LV_RADIUS_CIRCLE, 0, 0);
    c->end_label = ui_label(c->end, F_LABEL, C_ON_COLOR, "OK");
    lv_obj_center(c->end_label);
}

void lime_card_create(lv_obj_t *parent, lime_card_t *c, int32_t width)
{
    memset(c, 0, sizeof(*c));
    c->root = ui_row(parent, 8);
    ui_style_card(c->root, C_SYSTEM, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_pad_left(c->root, 12, 0);
    lv_obj_set_style_pad_right(c->root, 16, 0);
    lv_obj_set_style_pad_ver(c->root, 6, 0);
    if (width) lv_obj_set_width(c->root, width);
    c->icon = ui_icon(c->root, "alarm", 20, C_ON_COLOR);
    c->steps = ui_label(c->root, F_ITEM, C_ON_COLOR, "");
    c->text = ui_label(c->root, F_DETAIL, C_ON_COLOR, "");
    if (width) {
        c->spacer = ui_box(c->root);
        lv_obj_set_size(c->spacer, 1, 4);
        lv_obj_set_flex_grow(c->spacer, 1);
        lv_label_set_long_mode(c->text, LV_LABEL_LONG_DOT);
        lv_obj_set_style_max_width(c->text, width - 90, 0);
    } else {
        lv_obj_set_style_max_width(c->text, 300, 0);
        lv_label_set_long_mode(c->text, LV_LABEL_LONG_DOT);
    }
    tick_ring(c->root, c);
    c->end_kind = (card_end_t)-1;
    ui_show(c->steps, false);
}

void lime_card_wrap(lime_card_t *c, int32_t max_text)
{
    lv_label_set_long_mode(c->text, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_max_width(c->text, max_text, 0);
    lv_obj_set_style_text_align(c->text, LV_TEXT_ALIGN_LEFT, 0);
    lv_obj_set_style_radius(c->root, 20, 0);
    lv_obj_set_style_pad_ver(c->root, 8, 0);
}

void lime_card_set_color(lime_card_t *c, uint32_t bg)
{
    (void)bg;   /* MyToki 2: every note is lavender (role/system) */
    lv_obj_set_style_bg_color(c->root, COL(C_SYSTEM), 0);
}

void lime_card_set(lime_card_t *c, const char *icon, const char *text, card_end_t end)
{
    ui_show(c->steps, false);
    if (c->step_look) {   /* back to Note · Plain: lavender, Detail 20 */
        c->step_look = false;
        lv_obj_set_style_bg_color(c->root, COL(C_SYSTEM), 0);
        lv_obj_set_style_pad_ver(c->root, 6, 0);
        lv_obj_set_style_text_font(c->text, F_DETAIL, 0);
    }
    ui_show(c->icon, icon != NULL && *icon);
    if (icon && *icon) ui_icon_set(c->icon, icon, 20);
    if (text && strcmp(lv_label_get_text(c->text), text) && !lv_obj_has_flag(c->root, LV_OBJ_FLAG_HIDDEN)) fx_slide(c->root, 8, 0);
    ui_set_text(c->text, text);
    if (c->end_kind == end) return;
    c->end_kind = end;
    lv_obj_t *e = c->end;
    ui_show(e, end != CARD_END_NONE);
    lv_obj_set_style_pad_right(c->root, end == CARD_END_NONE ? 16 : end == CARD_END_OK ? 6 : 10, 0);
    ui_show(c->end_dot, false);
    ui_show(c->end_label, end == CARD_END_OK);
    lv_obj_set_style_bg_opa(e, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(e, 0, 0);
    lv_obj_t *old_check = lv_obj_get_child(e, 2);
    if (old_check) lv_obj_delete(old_check);
    switch (end) {
    case CARD_END_BUTTON:
    case CARD_END_TAP:
        lv_obj_set_size(e, 24, 24);
        lv_obj_set_style_radius(e, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_border_width(e, 2, 0);
        lv_obj_set_style_border_color(e, COL(C_ON_COLOR), 0);
        lv_obj_set_style_border_opa(e, LV_OPA_COVER, 0);
        break;
    case CARD_END_DONE: {
        lv_obj_set_size(e, 24, 24);
        lv_obj_set_style_radius(e, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(e, COL(C_ON_COLOR), 0);
        lv_obj_set_style_bg_opa(e, LV_OPA_COVER, 0);
        lv_obj_t *chk = ui_icon(e, "check", 16, C_SYSTEM);
        lv_obj_center(chk);
        break;
    }
    case CARD_END_OK:
        lv_obj_set_size(e, LV_SIZE_CONTENT, 32);
        lv_obj_set_style_radius(e, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(e, COL(C_ACTION), 0);
        lv_obj_set_style_bg_opa(e, LV_OPA_COVER, 0);
        lv_obj_set_style_pad_hor(e, 14, 0);
        break;
    default:
        break;
    }
}

void lime_card_set_steps(lime_card_t *c, int total, int done)
{
    char s[12];
    lv_snprintf(s, sizeof s, "%d/%d", done + 1 > total ? total : done + 1, total);
    if (!c->step_look) {   /* Note · Step: lime, 8 px high padding, the words in Body 22 */
        c->step_look = true;
        lv_obj_set_style_bg_color(c->root, COL(C_ACTION), 0);
        lv_obj_set_style_pad_ver(c->root, 8, 0);
        lv_obj_set_style_text_font(c->text, F_BODY_P, 0);
    }
    ui_show(c->icon, false);
    ui_show(c->steps, true);
    ui_set_text(c->steps, s);
    if (done == c->done_shown + 1) {
        fx_pop(c->steps, 0);
        fx_ripple_from(c->end, 12, 34, C_ACTION);
    }
    c->done_shown = done;
}

/* ================================================================ Speech */
/* Figma "Speech": cream, r 20, 16 x 8 padding, Speech 20 in navy wrapping at 160, a tail at the
 * bottom left pointing down at Biscuit. */
static void tail_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    const bubble_t *b = lv_obj_get_user_data(obj);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_triangle_dsc_t t;
    lv_draw_triangle_dsc_init(&t);
    t.color = COL(C_PET);
    t.opa = lv_obj_get_style_opa_recursive(obj, 0);
    if (b && b->top) {
        t.p[0].x = c.x1; t.p[0].y = c.y1 + 12;
        t.p[1].x = c.x1 + 16; t.p[1].y = c.y1 + 12;
        t.p[2].x = c.x1 + 8; t.p[2].y = c.y1;
    } else {
        t.p[0].x = c.x1; t.p[0].y = c.y1;
        t.p[1].x = c.x1 + 16; t.p[1].y = c.y1;
        t.p[2].x = c.x1 + 2; t.p[2].y = c.y1 + 12;
    }
    lv_draw_triangle(lv_event_get_layer(e), &t);
}

void bubble_create(lv_obj_t *parent, bubble_t *b)
{
    b->tail = ui_box(parent);
    lv_obj_set_size(b->tail, 16, 12);
    lv_obj_set_user_data(b->tail, b);
    lv_obj_add_event_cb(b->tail, tail_draw, LV_EVENT_DRAW_MAIN, NULL);
    b->top = false;
    b->root = ui_row(parent, 0);
    ui_style_card(b->root, C_PET, 20, 0, 0);
    lv_obj_set_style_pad_hor(b->root, 16, 0);
    lv_obj_set_style_pad_ver(b->root, 8, 0);
    b->label = ui_label(b->root, F_SPEECH, C_ON_COLOR, "");
    lv_obj_set_style_max_width(b->label, 160, 0);
    lv_label_set_long_mode(b->label, LV_LABEL_LONG_WRAP);
    bubble_hide(b);
}

/* How far from the middle the round screen reaches at row y, 6 px in from the rim. */
static int32_t screen_half(int32_t y)
{
    float r = CENTER - 6.0f, d = (float)(y - CENTER);
    float h = r * r - d * d;
    return h > 0 ? (int32_t)sqrtf(h) : 0;
}

void bubble_say(bubble_t *b, const char *text, int32_t x, int32_t y)
{
    bool fresh = lv_obj_has_flag(b->root, LV_OBJ_FLAG_HIDDEN) || strcmp(lv_label_get_text(b->label), text) != 0;
    b->top = false;
    ui_set_text(b->label, text);
    lv_obj_update_layout(b->root);
    int32_t w = lv_obj_get_width(b->root), hh = lv_obj_get_height(b->root);
    /* keep it inside the round screen: its corners (r 20) at the top and bottom edges */
    int32_t half = screen_half(y + 6);
    if (screen_half(y + hh - 6) < half) half = screen_half(y + hh - 6);
    int32_t right = CENTER + half - 6;
    if (x + w > right) x = right - w;
    lv_obj_set_pos(b->root, x, y);
    lv_obj_set_pos(b->tail, x + 14, y + lv_obj_get_height(b->root) - 1);
    ui_reveal(b->root, true, 10);
    ui_reveal(b->tail, true, 10);
    if (fresh && !lv_anim_get(b->root, NULL)) { fx_slide(b->root, 8, 0); fx_slide(b->tail, 8, 0); }
}

/* Beside Biscuit's head, to the right (his ears end about x 250 in the full room), and under
 * whatever the header shows: `below` is the lowest y the header reaches. */
#define BUBBLE_X 292
void bubble_say_pet(bubble_t *b, const char *text, int32_t below)
{
    int32_t y = below + 12;
    if (y < 120) y = 120;
    bubble_say(b, text, BUBBLE_X, y);
}

void bubble_say_top(bubble_t *b, const char *text, int32_t y)
{
    bool fresh = lv_obj_has_flag(b->root, LV_OBJ_FLAG_HIDDEN) || strcmp(lv_label_get_text(b->label), text) != 0;
    b->top = true;
    ui_set_text(b->label, text);
    lv_obj_update_layout(b->root);
    int32_t w = lv_obj_get_width(b->root);
    lv_obj_set_pos(b->root, CENTER - w / 2, y + 11);
    lv_obj_set_pos(b->tail, CENTER - 8, y);
    ui_reveal(b->root, true, -10);
    ui_reveal(b->tail, true, -10);
    lv_obj_invalidate(b->tail);
    if (fresh && !lv_anim_get(b->root, NULL)) { fx_slide(b->root, 8, 0); fx_slide(b->tail, 8, 0); }
}

void bubble_hide(bubble_t *b)
{
    ui_reveal(b->root, false, b->top ? -8 : 8);
    ui_reveal(b->tail, false, b->top ? -8 : 8);
}

/* ================================================================ Button */
/* Figma "Button": 48 high (40 small), fully round, 24 px sides, Button 22 (Label 20 small), a 22 px
 * icon. Primary lime with navy words; Secondary a 2 px lime outline; Tertiary lime words. */
lv_obj_t *button_create(lv_obj_t *parent, button_kind_t kind, bool small, const char *icon, const char *label)
{
    lv_obj_t *b = ui_row(parent, 8);
    lv_obj_set_height(b, small ? 40 : 48);
    lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(b, 8);
    int32_t pad = kind == BTN_TERTIARY ? 12 : small ? 18 : 24;
    lv_obj_set_style_pad_hor(b, pad, 0);
    lv_obj_set_style_radius(b, LV_RADIUS_CIRCLE, 0);
    uint32_t fg = kind == BTN_PRIMARY ? C_ON_COLOR : C_ACTION;
    if (kind == BTN_PRIMARY) {
        ui_style_card(b, C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_set_style_bg_color(b, COL(C_TEXT), LV_STATE_PRESSED);
    } else if (kind == BTN_SECONDARY) {
        lv_obj_set_style_border_width(b, 2, 0);
        lv_obj_set_style_border_color(b, COL(C_ACTION), 0);
        lv_obj_set_style_border_opa(b, LV_OPA_COVER, 0);
        lv_obj_set_style_bg_color(b, COL(C_RAISED), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
    } else {
        lv_obj_set_style_bg_color(b, COL(C_RAISED), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
    }
    lv_obj_t *ic = ui_icon(b, icon && *icon ? icon : "retry", small ? 20 : 22, fg);
    ui_show(ic, icon && *icon);
    ui_label(b, small ? F_LABEL : F_BUTTON, fg, label);
    return b;
}

/* ================================================================ Tab */
/* Figma "Tab": fully round, 16 px sides, 6 px high, a 22 px icon and Label 20; selected = a 2 px
 * lime outline with lime words, otherwise muted words. */
lv_obj_t *tab_create(lv_obj_t *parent, const char *icon, const char *label)
{
    lv_obj_t *t = ui_row(parent, 6);
    lv_obj_set_style_pad_hor(t, 16, 0);
    lv_obj_set_style_pad_ver(t, 6, 0);
    lv_obj_set_style_radius(t, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_color(t, COL(C_ACTION), 0);
    lv_obj_set_style_border_opa(t, LV_OPA_COVER, 0);
    lv_obj_add_flag(t, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(t, 6);
    if (icon && *icon) ui_icon(t, icon, 22, C_TEXT_MUTED);
    else pet_face_create(t, 1, COL(C_RAISED));   /* Play: Biscuit's face */
    ui_label(t, F_LABEL, C_TEXT_MUTED, label);
    tab_select(t, false);
    return t;
}

void tab_select(lv_obj_t *t, bool selected)
{
    lv_obj_set_style_border_width(t, selected ? 2 : 0, 0);
    uint32_t c = selected ? C_ACTION : C_TEXT_MUTED;
    for (uint32_t i = 0; i < lv_obj_get_child_count(t); i++) {
        lv_obj_t *k = lv_obj_get_child(t, i);
        if (lv_obj_check_type(k, &lv_label_class) || lv_obj_check_type(k, &lv_image_class)) ui_set_color(k, c);
    }
}

lv_obj_t *tab_bar_create(lv_obj_t *parent)
{
    lv_obj_t *b = ui_row(parent, 4);
    ui_style_card(b, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_pad_all(b, 4, 0);
    return b;
}

/* ================================================================ small things */
lv_obj_t *chip_create(lv_obj_t *parent, uint32_t bg, uint32_t fg, const char *text)
{
    lv_obj_t *c = ui_row(parent, 0);
    if (bg) ui_style_card(c, bg, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_pad_hor(c, bg ? 10 : 0, 0);
    lv_obj_set_style_pad_ver(c, 1, 0);
    ui_label(c, F_LABEL, fg, text);
    return c;
}

typedef struct { uint32_t color; int32_t radius; } outline_t;

static void outline_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    outline_t *o = lv_obj_get_user_data(obj);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    float x0 = c.x1 + 1.5f, y0 = c.y1 + 1.5f, x1 = c.x2 - 1.5f, y1 = c.y2 - 1.5f;
    float r = fminf((float)o->radius, fminf(x1 - x0, y1 - y0) / 2);   /* a big radius: fully round */
    float w = x1 - x0 - 2 * r, h = y1 - y0 - 2 * r;
    float per = 2 * (w + h) + 2 * PI_F * r;
    int n = (int)(per / 14.0f);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = COL(o->color);
    d.radius = 1;
    for (int i = 0; i < n; i++) {
        /* 8 px dashes, 6 px gaps (Figma Schedule row · Free time) */
        for (float s0 = i * per / n, s = s0; s < s0 + 8; s += 1.0f) {
            float q = s, x, y;
            if (q < w) { x = x0 + r + q; y = y0; }
            else if ((q -= w) < PI_F * r / 2) { float a = q / r; x = x1 - r + r * sinf(a); y = y0 + r - r * cosf(a); }
            else if ((q -= PI_F * r / 2) < h) { x = x1; y = y0 + r + q; }
            else if ((q -= h) < PI_F * r / 2) { float a = q / r; x = x1 - r + r * cosf(a); y = y1 - r + r * sinf(a); }
            else if ((q -= PI_F * r / 2) < w) { x = x1 - r - q; y = y1; }
            else if ((q -= w) < PI_F * r / 2) { float a = q / r; x = x0 + r - r * sinf(a); y = y1 - r + r * cosf(a); }
            else if ((q -= PI_F * r / 2) < h) { x = x0; y = y1 - r - q; }
            else { q -= h; float a = q / r; x = x0 + r - r * cosf(a); y = y0 + r - r * sinf(a); }
            lv_area_t a = { (int32_t)(x - 1), (int32_t)(y - 1), (int32_t)(x), (int32_t)(y) };
            lv_draw_rect(layer, &d, &a);
        }
    }
}

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

lv_obj_t *note_create(lv_obj_t *parent, int32_t y)
{
    lv_obj_t *l = ui_label(parent, F_DETAIL, C_TEXT_MUTED, "");
    lv_obj_set_width(l, 260);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(l, LV_ALIGN_TOP_MID, 0, y);
    return l;
}

/* ================================================================ Checkbox */
/* The ring (the box itself), the navy fill and the tick are separate, so an unchecked box can
 * turn into a checked one in front of the child (checkbox_tick). */
lv_obj_t *checkbox_create(lv_obj_t *parent, int32_t d, bool checked)
{
    lv_obj_t *box = ui_box(parent);
    lv_obj_set_size(box, d, d);
    lv_obj_set_style_radius(box, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(box, 2, 0);
    lv_obj_set_style_border_color(box, COL(C_HILL_LINE), 0);
    lv_obj_set_style_border_opa(box, checked ? LV_OPA_TRANSP : LV_OPA_COVER, 0);
    lv_obj_t *fill = ui_box(box);
    lv_obj_set_size(fill, d, d);
    lv_obj_center(fill);
    ui_style_card(fill, C_ON_COLOR, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_transform_pivot_x(fill, lv_pct(50), 0);
    lv_obj_set_style_transform_pivot_y(fill, lv_pct(50), 0);
    lv_obj_t *tick = ui_icon(box, "check", d >= 48 ? 28 : 16, C_ACTION);
    lv_obj_center(tick);
    lv_obj_set_style_transform_pivot_x(tick, lv_pct(50), 0);
    lv_obj_set_style_transform_pivot_y(tick, lv_pct(50), 0);
    ui_show(fill, checked);
    ui_show(tick, checked);
    return box;
}

/* ================================================================ motion */
static float path_t(const lv_anim_t *a)
{
    if (a->duration <= 0 || a->act_time >= a->duration) return 1.0f;
    if (a->act_time <= 0) return 0.0f;
    return (float)a->act_time / (float)a->duration;
}

static int32_t path_mix(const lv_anim_t *a, float k)
{
    return a->start_value + (int32_t)lroundf((float)(a->end_value - a->start_value) * k);
}

int32_t ui_path_out(const lv_anim_t *a)
{
    float u = 1.0f - path_t(a);
    return path_mix(a, 1.0f - u * u * u);
}

int32_t ui_path_settle(const lv_anim_t *a)
{
    const float c1 = 0.9f, c3 = c1 + 1.0f;   /* easeOutBack, softened: peaks 3 % past the mark */
    float u = path_t(a) - 1.0f;
    return path_mix(a, 1.0f + c3 * u * u * u + c1 * u * u);
}

int32_t ui_path_spring(const lv_anim_t *a)
{
    float t = path_t(a);
    float k = 1.0f - expf(-7.0f * t) * cosf(13.0f * t);
    return path_mix(a, t >= 1.0f ? 1.0f : k);
}

/* ---- reveal: show and hide with motion ---- */
#define REVEAL_OUT LV_OBJ_FLAG_USER_4   /* on its way out: visible, fading, hidden when done */
static void reveal_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }
static void reveal_ty(void *obj, int32_t v) { lv_obj_set_style_translate_y(obj, v, 0); }
static void reveal_gone(lv_anim_t *a)
{
    lv_obj_t *o = a->var;
    lv_obj_remove_flag(o, REVEAL_OUT);
    lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_opa(o, LV_OPA_COVER, 0);
    lv_obj_set_style_translate_y(o, 0, 0);
}

static void reveal_anim(lv_obj_t *o, lv_anim_exec_xcb_t exec, int32_t v0, int32_t v1, uint32_t ms, lv_anim_path_cb_t path,
                        lv_anim_completed_cb_t done)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, exec);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_early_apply(&a, true);
    lv_anim_set_path_cb(&a, path);
    lv_anim_set_completed_cb(&a, done);
    lv_anim_start(&a);
}

void ui_reveal(lv_obj_t *o, bool show, int32_t dy)
{
    if (!o) return;
    bool hidden = lv_obj_has_flag(o, LV_OBJ_FLAG_HIDDEN), leaving = lv_obj_has_flag(o, REVEAL_OUT);
    if (show) {
        if (!hidden && !leaving) return;
        lv_anim_delete(o, reveal_opa);
        lv_anim_delete(o, reveal_ty);
        lv_obj_remove_flag(o, REVEAL_OUT);
        lv_obj_remove_flag(o, LV_OBJ_FLAG_HIDDEN);
        int32_t from_opa = leaving ? lv_obj_get_style_opa(o, 0) : LV_OPA_TRANSP;
        int32_t from_ty = leaving ? lv_obj_get_style_translate_y(o, 0) : dy;
        reveal_anim(o, reveal_opa, from_opa, LV_OPA_COVER, 260, ui_path_out, NULL);
        reveal_anim(o, reveal_ty, from_ty, 0, 380, ui_path_settle, NULL);
    } else {
        if (hidden || leaving) return;
        lv_anim_delete(o, reveal_opa);
        lv_anim_delete(o, reveal_ty);
        lv_obj_add_flag(o, REVEAL_OUT);
        reveal_anim(o, reveal_opa, lv_obj_get_style_opa(o, 0), LV_OPA_TRANSP, 200, lv_anim_path_ease_in, reveal_gone);
        reveal_anim(o, reveal_ty, lv_obj_get_style_translate_y(o, 0), dy / 2, 200, lv_anim_path_ease_in, NULL);
    }
}

static void (*render_fn)(void);
void ui_set_render(void (*fn)(void)) { render_fn = fn; }
void ui_render_now(void) { if (render_fn) render_fn(); }

static void scale_exec(void *obj, int32_t v) { lv_obj_set_style_transform_scale(obj, v, 0); }
static void border_opa_exec(void *obj, int32_t v) { lv_obj_set_style_border_opa(obj, (lv_opa_t)v, 0); }

static void anim_simple(lv_obj_t *o, lv_anim_exec_xcb_t exec, int32_t v0, int32_t v1, uint32_t ms, uint32_t delay,
                        lv_anim_path_cb_t path)
{
    lv_anim_delete(o, exec);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, exec);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_delay(&a, delay);
    lv_anim_set_early_apply(&a, true);
    lv_anim_set_path_cb(&a, path);
    lv_anim_start(&a);
}

void checkbox_tick(lv_obj_t *box)
{
    if (!box || lv_obj_get_child_count(box) < 2) return;
    lv_obj_t *fill = lv_obj_get_child(box, 0), *tick = lv_obj_get_child(box, 1);
    if (!lv_obj_has_flag(fill, LV_OBJ_FLAG_HIDDEN)) return;   /* already ticked */
    ui_show(fill, true);
    ui_show(tick, true);
    anim_simple(fill, scale_exec, 0, 256, 220, 0, ui_path_out);
    anim_simple(box, border_opa_exec, LV_OPA_COVER, LV_OPA_TRANSP, 160, 0, lv_anim_path_linear);
    anim_simple(tick, scale_exec, 0, 256, 260, 110, ui_path_settle);
    int32_t d = lv_obj_get_width(box);
    fx_ripple_from(box, d / 2, d / 2 + 26, C_DONE);
}

typedef struct { lv_color_t from, to; } recolor_t;
static void recolor_exec(void *obj, int32_t v)
{
    lv_anim_t *a = lv_anim_get(obj, recolor_exec);
    if (!a) return;
    recolor_t *r = a->user_data;
    lv_obj_set_style_bg_color(obj, lv_color_mix(r->to, r->from, (uint8_t)v), 0);
}
static void recolor_gone(lv_anim_t *a) { lv_free(a->user_data); }

void card_recolor(lv_obj_t *card, uint32_t from, uint32_t to, uint32_t ms)
{
    if (!card) return;
    lv_anim_delete(card, recolor_exec);
    recolor_t *r = lv_malloc(sizeof(recolor_t));
    r->from = COL(from);
    r->to = COL(to);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, card);
    lv_anim_set_exec_cb(&a, recolor_exec);
    lv_anim_set_user_data(&a, r);
    lv_anim_set_values(&a, 0, 255);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_early_apply(&a, true);
    lv_anim_set_path_cb(&a, ui_path_out);
    lv_anim_set_deleted_cb(&a, recolor_gone);
    lv_anim_start(&a);
}

/* ================================================================ the wheel list */
/* Rows sit in equal slots. The list is padded so the first and the last row can both reach the
 * focus line, and it snaps a row's centre onto that line (LVGL's centre snap uses the padded
 * content box, so the padding puts the line where we want it). While it moves, every row is
 * scaled and faded by how far it is from the line, and pulled in a little so the smaller rows
 * stay close together, like the faces of a turning wheel. */
#define WHEEL_SHRINK 0.16f    /* per row away from the line */
#define WHEEL_FADE 0.30f
#define WHEEL_FAR 2.6f

static void wheel_apply(lv_obj_t *list)
{
    wheel_list_t *w = lv_obj_get_user_data(list);
    if (!w) return;
    lv_area_t la;
    lv_obj_get_coords(list, &la);
    int32_t line = la.y1 + w->focus_y;
    uint32_t n = lv_obj_get_child_count(list);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *slot = lv_obj_get_child(list, i);
        lv_obj_t *card = lv_obj_get_child(slot, 0);
        if (!card) continue;
        lv_area_t a;
        lv_obj_get_coords(slot, &a);
        float d = ((a.y1 + a.y2) / 2.0f - line) / (float)w->row_h;
        if (w->style) { w->style(card, d); continue; }
        float ad = fminf(fabsf(d), WHEEL_FAR);
        float scale = 1.0f - w->shrink * ad;
        int32_t s = (int32_t)(256 * scale);
        lv_opa_t opa = (lv_opa_t)(255 * fmaxf(0.0f, 1.0f - w->fade * ad));
        int32_t ty = (int32_t)lroundf(-(d > 0 ? 1 : -1) * w->row_h * (w->shrink / 2) * ad * ad);
        if (lv_obj_get_style_transform_scale_x(card, 0) != s) {
            lv_obj_set_style_transform_scale(card, s, 0);
        }
        if (lv_obj_get_style_opa(card, 0) != opa) lv_obj_set_style_opa(card, opa, 0);
        if (lv_obj_get_style_translate_y(card, 0) != ty) lv_obj_set_style_translate_y(card, ty, 0);
    }
}

static void wheel_scroll(lv_event_t *e) { wheel_apply(lv_event_get_target(e)); }

void wheel_list_create(lv_obj_t *parent, wheel_list_t *w, int32_t x, int32_t y, int32_t width, int32_t height,
                       int32_t focus_y, int32_t row_h)
{
    w->focus_y = focus_y;
    w->row_h = row_h;
    w->shrink = WHEEL_SHRINK;
    w->fade = WHEEL_FADE;
    w->style = NULL;
    w->list = ui_box(parent);
    lv_obj_set_pos(w->list, x, y);
    lv_obj_set_size(w->list, width, height);
    lv_obj_add_flag(w->list, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM | LV_OBJ_FLAG_SCROLL_ELASTIC);
    lv_obj_remove_flag(w->list, LV_OBJ_FLAG_SCROLL_CHAIN_VER);
    lv_obj_set_scroll_dir(w->list, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(w->list, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_scroll_snap_y(w->list, LV_SCROLL_SNAP_CENTER);
    lv_obj_set_flex_flow(w->list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(w->list, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(w->list, 0, 0);
    lv_obj_set_style_pad_top(w->list, focus_y - row_h / 2, 0);
    lv_obj_set_style_pad_bottom(w->list, height - focus_y - row_h / 2, 0);
    lv_obj_set_user_data(w->list, w);
    lv_obj_add_event_cb(w->list, wheel_scroll, LV_EVENT_SCROLL, NULL);
    lv_obj_add_event_cb(w->list, wheel_scroll, LV_EVENT_SIZE_CHANGED, NULL);
}

lv_obj_t *wheel_list_add(wheel_list_t *w)
{
    lv_obj_t *slot = ui_box(w->list);
    lv_obj_set_size(slot, lv_pct(100), w->row_h);
    lv_obj_add_flag(slot, LV_OBJ_FLAG_SNAPPABLE | LV_OBJ_FLAG_EVENT_BUBBLE);
    return slot;
}

/* The wheel's own turn: LVGL's scroll animation is replaced by one with the settle; a finger on the
 * list takes over at once. */
static void turn_exec(void *obj, int32_t v)
{
    lv_indev_t *in = lv_indev_active();
    if (in && lv_indev_get_scroll_obj(in) == obj) { lv_anim_delete(obj, turn_exec); return; }
    lv_obj_scroll_to_y(obj, v, LV_ANIM_OFF);
}

static int wheel_clamp(wheel_list_t *w, int i)
{
    lv_obj_update_layout(w->list);
    int n = (int)lv_obj_get_child_count(w->list);
    if (i > n - 1) i = n - 1;
    return i < 0 ? 0 : i;
}

void wheel_list_turn(wheel_list_t *w, int i, uint32_t delay_ms)
{
    i = wheel_clamp(w, i);
    int32_t from = lv_obj_get_scroll_y(w->list), to = (int32_t)i * w->row_h;
    lv_anim_delete(w->list, NULL);   /* LVGL's own snap or throw */
    if (from == to) { wheel_apply(w->list); return; }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, w->list);
    lv_anim_set_exec_cb(&a, turn_exec);
    lv_anim_set_values(&a, from, to);
    lv_anim_set_duration(&a, 420);
    lv_anim_set_delay(&a, delay_ms);
    lv_anim_set_path_cb(&a, ui_path_settle);
    lv_anim_start(&a);
}

void wheel_list_focus(wheel_list_t *w, int i, bool anim)
{
    if (anim) { wheel_list_turn(w, i, 0); return; }
    i = wheel_clamp(w, i);
    lv_anim_delete(w->list, NULL);
    lv_obj_scroll_to_y(w->list, (int32_t)i * w->row_h, LV_ANIM_OFF);
    wheel_apply(w->list);
}

int wheel_list_current(const wheel_list_t *w)
{
    int32_t y = lv_obj_get_scroll_y(w->list);
    return (int)((y + w->row_h / 2) / w->row_h);
}

void wheel_list_clear(wheel_list_t *w) { lv_obj_clean(w->list); }

int wheel_list_mark(wheel_list_t *w, wheel_mark_t *marks, int max)
{
    lv_obj_update_layout(w->list);
    int n = 0;
    uint32_t cnt = lv_obj_get_child_count(w->list);
    for (uint32_t i = 0; i < cnt && n < max; i++) {
        lv_obj_t *slot = lv_obj_get_child(w->list, i);
        intptr_t key = (intptr_t)lv_obj_get_user_data(slot);
        if (!key) continue;
        lv_area_t a;
        lv_obj_get_coords(slot, &a);
        marks[n++] = (wheel_mark_t){ key, a.y1 - lv_obj_get_style_translate_y(slot, 0) };
    }
    return n;
}

static void slot_ty(void *obj, int32_t v) { lv_obj_set_style_translate_y(obj, v, 0); }
static void slot_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }

void wheel_list_flip(wheel_list_t *w, const wheel_mark_t *marks, int n)
{
    lv_obj_update_layout(w->list);
    uint32_t cnt = lv_obj_get_child_count(w->list);
    for (uint32_t i = 0; i < cnt; i++) {
        lv_obj_t *slot = lv_obj_get_child(w->list, i);
        intptr_t key = (intptr_t)lv_obj_get_user_data(slot);
        if (!key) continue;
        int k = 0;
        while (k < n && marks[k].key != key) k++;
        if (k == n) {   /* a new row: it fades in where it is */
            anim_simple(slot, slot_opa, LV_OPA_TRANSP, LV_OPA_COVER, 260, 120, ui_path_out);
            continue;
        }
        lv_area_t a;
        lv_obj_get_coords(slot, &a);
        int32_t dy = marks[k].y - a.y1;
        if (dy) anim_simple(slot, slot_ty, dy, 0, 400, 0, ui_path_settle);
    }
    wheel_apply(w->list);
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

static bool leaving(lv_obj_t *o)
{
    if (lv_obj_has_flag(o, LV_OBJ_FLAG_USER_1)) return true;
    lv_obj_add_flag(o, LV_OBJ_FLAG_USER_1);
    lv_anim_delete(o, anim_x);
    lv_anim_delete(o, anim_opa);
    lv_anim_delete(o, anim_ty);
    return false;
}

void overlay_enter_push(lv_obj_t *o)
{
    if (!o) return;
    lv_obj_set_x(o, SCREEN_W);
    run_anim(o, anim_x, SCREEN_W, 0, 340, ui_path_out, NULL);
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
    run_anim(o, anim_opa, LV_OPA_TRANSP, LV_OPA_COVER, 220, ui_path_out, NULL);
    run_anim(o, anim_ty, 24, 0, 320, ui_path_settle, rise_done);
}

void overlay_slide_away(lv_obj_t *o, int dir)
{
    if (!o || leaving(o)) return;
    run_anim(o, anim_x, lv_obj_get_x(o), dir * SCREEN_W, 300, ui_path_out, slide_done);
}

void overlay_fade_away(lv_obj_t *o)
{
    if (!o || leaving(o)) return;
    run_anim(o, anim_opa, lv_obj_get_style_opa(o, 0), LV_OPA_TRANSP, 200, lv_anim_path_ease_in, slide_done);
}

static bool on_swipe(lv_obj_t *o, int dir, lv_point_t start, void *user, bool commit)
{
    (void)start; (void)user;
    if (dir == SWIPE_DOWN || dir == SWIPE_UP) return false;
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
    ui_style_card(o, C_SCREEN, 0, 0, 0);
    return o;
}
