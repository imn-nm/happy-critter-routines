#include "widgets.h"
#include "swipe.h"
#include "fx.h"
#include "../pet/pet.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PI_F 3.14159265f

static bool picture_mode;
static char clock_now[12] = "";
void ui_set_clock(int minutes) { ui_fmt_clock(clock_now, sizeof clock_now, minutes); }
const char *ui_clock(void) { return clock_now; }
void ui_set_picture(bool picture) { picture_mode = picture; }
bool ui_picture(void) { return picture_mode; }
static char sky_now[20] = "sun";
void ui_set_sky(const char *icon) { snprintf(sky_now, sizeof sky_now, "%s", icon && *icon ? icon : "sun"); }
const char *ui_sky(void) { return sky_now; }

static void free_user_data(lv_event_t *e) { lv_free(lv_obj_get_user_data(lv_event_get_target(e))); }

/* ================================================================ MyToki 2 Timer */
/* Figma "Timer": a ring of segments 227 px out from the centre (the 474 instance at -4, -4, out to
 * the bezel, since 2026-10-26), from 7:30 round the top to 4:30
 * (270 degrees, open at the bottom where the hill is), 6 px wide with round ends. As Figma lays the
 * 80/14 dashes out evenly: twelve steps of 22.5 degrees, a segment centred on the top, 14 px
 * between segments, and a half segment at each end (13 pieces). The track is timer/track; the
 * lit part, counted from the bottom-left end, is the tone: with 10 minutes or more left it is the
 * time gone by (the ring starts dark and lights up), under 10 and late the whole ring. The time is
 * shared out over the
 * segments alone (not the gaps, the half ones count half), so one segment changes smoothly along
 * its length before the next one starts. */
#define TIMER_R 227.0f
#define TIMER_W 6
#define TIMER_A0 135.0f
#define TIMER_SPAN 270.0f
#define TIMER_STEPS 12
#define TIMER_STEP (TIMER_SPAN / TIMER_STEPS)
#define TIMER_GAP (14.0f / TIMER_R * 180.0f / PI_F)
#define TIMER_PIECES (TIMER_STEPS + 1)

typedef struct { timer_tone_t tone; int16_t left; bool pulse; uint8_t breath; lv_timer_t *timer; } timer_data_t;

static const uint32_t TONE_COLOR[] = { C_PLENTY, C_HURRY, C_LATE_RING, C_NIGHT };
uint32_t timer_tone_color(timer_tone_t tone) { return TONE_COLOR[tone]; }

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

/* The stroke's bounding box (its ends, and the arc's extremes at 0/90/180/270 degrees between them)
 * against the strip being drawn. */
static bool stroke_in_strip(const lv_layer_t *layer, const lv_draw_arc_dsc_t *d, float a0, float a1)
{
    float x0 = 1e9f, y0 = 1e9f, x1 = -1e9f, y1 = -1e9f;
    for (float k = ceilf(a0 / 90.0f) * 90.0f - 180.0f; ; k += 90.0f) {
        float ang = k < a0 ? a0 : k > a1 ? a1 : k;
        float p = ang * PI_F / 180.0f, x = d->center.x + TIMER_R * cosf(p), y = d->center.y + TIMER_R * sinf(p);
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (k >= a1) break;
    }
    const int32_t m = TIMER_W + 2;
    return ui_in_strip(layer, (int32_t)x0 - m, (int32_t)y0 - m, (int32_t)x1 + m, (int32_t)y1 + m);
}

static void timer_stroke(lv_layer_t *layer, lv_draw_arc_dsc_t *d, float a0, float a1)
{
    if (a1 - a0 < 0.05f || !stroke_in_strip(layer, d, a0, a1)) return;
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

/* The widgets' own timers (the rim timer's breathing, the rings): all paused while the screen is
 * dark, and the rim timer's while it isn't breathing, so they don't wake the chip for nothing. */
#define WTIMERS 16
static lv_timer_t *wtimers[WTIMERS];
static bool wtimers_paused;

static void wtimer_add(lv_timer_t *t)
{
    for (int i = 0; i < WTIMERS; i++)
        if (!wtimers[i]) { wtimers[i] = t; if (wtimers_paused) lv_timer_pause(t); return; }
}

static void wtimer_remove(lv_timer_t *t)
{
    for (int i = 0; i < WTIMERS; i++) if (wtimers[i] == t) wtimers[i] = NULL;
}

void ui_widget_timers_pause(bool paused)
{
    wtimers_paused = paused;
    for (int i = 0; i < WTIMERS; i++) {
        if (!wtimers[i]) continue;
        if (paused) lv_timer_pause(wtimers[i]);
        else lv_timer_resume(wtimers[i]);
    }
}

/* Only the rim's band, as twelve boxes round it: the timer's own box is the whole screen, and its
 * breathing redrew everything under it a dozen times a second. */
static void timer_invalidate_rim(lv_obj_t *obj)
{
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    const float m = TIMER_W + 3;
    for (int k = 0; k < 12; k++) {
        float p = k * PI_F / 6, q = (k + 1) * PI_F / 6;
        float xa = TIMER_R * cosf(p), xb = TIMER_R * cosf(q), ya = TIMER_R * sinf(p), yb = TIMER_R * sinf(q);
        lv_area_t a = {
            .x1 = c.x1 + CENTER + (int32_t)floorf(fminf(xa, xb) - m), .y1 = c.y1 + CENTER + (int32_t)floorf(fminf(ya, yb) - m),
            .x2 = c.x1 + CENTER + (int32_t)ceilf(fmaxf(xa, xb) + m), .y2 = c.y1 + CENTER + (int32_t)ceilf(fmaxf(ya, yb) + m),
        };
        lv_obj_invalidate_area(obj, &a);
    }
}

static void timer_tick(lv_timer_t *tm)
{
    lv_obj_t *obj = lv_timer_get_user_data(tm);
    timer_data_t *t = lv_obj_get_user_data(obj);
    if (!t->pulse || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) return;
    float ph = (lv_tick_get() % 1600) / 1600.0f;
    t->breath = (uint8_t)(255 * (0.5f + 0.5f * cosf(ph * 2 * PI_F)));
    timer_invalidate_rim(obj);
}

static void timer_delete(lv_event_t *e)
{
    timer_data_t *t = lv_obj_get_user_data(lv_event_get_target(e));
    if (t) { wtimer_remove(t->timer); lv_timer_delete(t->timer); lv_free(t); }
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
    t->timer = lv_timer_create(timer_tick, 120, o);   /* the breath at 8 frames a second */
    lv_timer_pause(t->timer);   /* until it breathes */
    return o;
}

void timer_set(lv_obj_t *obj, timer_tone_t tone, int16_t left, bool pulse)
{
    timer_data_t *t = lv_obj_get_user_data(obj);
    if (left < 0) left = 0;
    if (left > 1000) left = 1000;
    if (t->tone == tone && t->left == left && t->pulse == pulse) return;
    if (t->pulse != pulse) {
        if (pulse) { wtimer_add(t->timer); if (!wtimers_paused) lv_timer_resume(t->timer); }
        else { wtimer_remove(t->timer); lv_timer_pause(t->timer); }
    }
    t->tone = tone;
    t->left = left;
    t->pulse = pulse;
    lv_obj_invalidate(obj);
}

/* ================================================================ Pill */
/* Figma "Pill": 38 high, fully round, 12 px left (16 without an icon), 16 px right, a 20 px icon,
 * Pill 24. Calm = chip with lavender words; Hurry = amber; Late = coral, no icon; Night, Star and
 * Done = black with iris, amber or mint words; System = lavender. */
static void pill_colors(pill_tone_t tone, uint32_t *bg, uint32_t *fg)
{
    switch (tone) {
    case PILL_HURRY: *bg = C_STAR; *fg = C_ON_COLOR; break;
    case PILL_LATE: *bg = C_LATE; *fg = C_ON_COLOR; break;
    case PILL_NIGHT: *bg = C_SCREEN; *fg = C_NIGHT; break;
    case PILL_STAR: *bg = C_SCREEN; *fg = C_STAR; break;
    case PILL_DONE: *bg = C_SCREEN; *fg = C_DONE; break;
    case PILL_SYSTEM: *bg = C_SYSTEM; *fg = C_ON_COLOR; break;
    case PILL_ACTION: *bg = C_ACTION; *fg = C_ON_COLOR; break;   /* a price the child can pay */
    default: *bg = C_SCREEN; *fg = C_CALM; break;   /* the quiet tones sit on black, not the chip (user, 2026-10-22) */
    }
}

void pill_create(lv_obj_t *parent, pill_t *p)
{
    p->root = ui_row(parent, 8);
    ui_style_card(p->root, C_SCREEN, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_pad_left(p->root, 12, 0);
    lv_obj_set_style_pad_right(p->root, 16, 0);
    lv_obj_set_style_pad_ver(p->root, 4, 0);   /* Figma Pill: space/4 */
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
/* Figma "MyToki 2 / Header" (1070:4496), as the side-by-side screens have it (1460:9008):
 * Regular: a 340 wide column whose words start at y 31: the clock (Poppins Medium 18), the title
 * (Title 30, Poppins Bold, wrapping at 256) right under it, then a Pill (its middle at y 114) or a
 * cream line (Body 22, wrapping at 272). The clock alone (Free time · Spin) sits at y 23 with the pill
 * 30 under it.
 * Big: 312 wide from x 77: the clock (Poppins Medium 24), the title in Montserrat Bold 40 on 40 px
 * lines, a cream line 8 px under it, or the pill down at the foot of the screen (y 385).
 * The younger child's headers have the Sky chip (52, at y 24) instead of the clock, the title under it
 * at y 84 (78 when it takes two lines); with neither (the one-step screens) the title is at y 54.
 * The y below are where LVGL's label boxes go: Figma's text boxes are shorter than the fonts' lines,
 * so each is placed to put the words' baseline where Figma's is. */
#define HEADER_Y 23
#define HEADER_TIGHT_Y 16      /* a tight header (no clock): the title's glyphs start about y 24 */
#define HEADER_BIG_X 77
#define HEADER_BIG_W 312
#define HEADER_FOOT_Y 385      /* Big's pill, at the foot of the screen */
#define SKY_D 52
#define SKY_Y 24
static const lv_font_t *const F_BIG_TITLE = &font_mon700_40;
static const lv_font_t *const F_BIG_CLOCK = &font_pop500_24;

void header_create(lv_obj_t *parent, header_t *h)
{
    h->root = ui_box(parent);
    h->tight = h->big = h->low = false;
    h->sky_tone = 0;
    h->sky_name[0] = 0;
    lv_obj_set_size(h->root, 340, LV_SIZE_CONTENT);
    lv_obj_set_pos(h->root, 63, HEADER_Y);
    lv_obj_set_flex_flow(h->root, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(h->root, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(h->root, 0, 0);
    /* Figma "Sky": a bg/raised disc with the sun, the moon or the task's icon (32) in it */
    h->sky = ui_box(h->root);
    lv_obj_set_size(h->sky, SKY_D, SKY_D);
    ui_style_card(h->sky, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
    h->sky_icon = ui_icon(h->sky, "sun", 32, C_STAR);
    lv_obj_center(h->sky_icon);
    ui_show(h->sky, false);
    h->clock = ui_label(h->root, F_HEADER_CLOCK, C_CLOCK, "");
    h->title = ui_label(h->root, F_TITLE, C_TEXT, "");
    lv_obj_set_style_max_width(h->title, 256, 0);
    lv_obj_set_style_text_align(h->title, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(h->title, LV_LABEL_LONG_WRAP);
    pill_create(h->root, &h->pill);
    lv_obj_set_style_pad_ver(h->pill.root, 3, 0);
    lv_obj_set_style_margin_top(h->pill.root, 10, 0);
    h->text = ui_label(h->root, F_BODY_P, C_TEXT, "");
    lv_obj_set_style_margin_top(h->text, 7, 0);
    lv_obj_set_style_max_width(h->text, 272, 0);
    lv_obj_set_style_text_align(h->text, LV_TEXT_ALIGN_CENTER, 0);
    /* Big's pill, down at the foot of the screen (beside the column, not in it) */
    pill_create(parent, &h->foot);
    lv_obj_set_style_pad_ver(h->foot.root, 3, 0);
    ui_show(h->foot.root, false);
}

void header_set_big(header_t *h, bool big) { h->big = big; }

/* the timer's colour while one runs; without one the moon iris, anything else amber */
static void sky_color(header_t *h)
{
    if (h->sky_name[0]) ui_set_color(h->sky_icon, h->sky_tone ? h->sky_tone : !strcmp(h->sky_name, "moon") ? C_NIGHT : C_STAR);
}

void header_set_sky(header_t *h, const char *icon)
{
    const char *name = icon ? icon : "";
    if (!strcmp(name, h->sky_name)) return;
    snprintf(h->sky_name, sizeof h->sky_name, "%s", name);
    ui_show(h->sky, *name != 0);
    if (!*name) return;
    ui_icon_set(h->sky_icon, name, 32);
    sky_color(h);
    lv_obj_center(h->sky_icon);
}

void header_set_sky_tone(header_t *h, uint32_t color)
{
    h->sky_tone = color;
    sky_color(h);
}

static void set_margin(lv_obj_t *o, int32_t m) { if (lv_obj_get_style_margin_top(o, 0) != m) lv_obj_set_style_margin_top(o, m, 0); }

void header_set(header_t *h, const char *clock, const char *title, header_below_t below,
                pill_tone_t tone, const char *icon, const char *text)
{
    bool s = h->sky_name[0] != 0, c = clock && *clock && !s, t = title && *title, big = h->big;
    ui_show(h->clock, c);
    if (c) ui_set_text(h->clock, clock);
    ui_show(h->title, t);
    /* the size first, then the words, so the lines are counted in the right font */
    const lv_font_t *tf = big ? F_BIG_TITLE : F_TITLE;
    if (lv_obj_get_style_text_font(h->title, 0) != tf) {
        lv_obj_set_style_text_font(h->title, tf, 0);
        lv_obj_set_style_text_font(h->clock, big ? F_BIG_CLOCK : F_HEADER_CLOCK, 0);
        lv_obj_set_style_max_width(h->title, big ? HEADER_BIG_W : 256, 0);
        lv_obj_set_style_text_line_space(h->title, big ? 40 - lv_font_get_line_height(F_BIG_TITLE) : 0, 0);   /* Figma: 40 px lines */
        lv_obj_set_width(h->root, big ? HEADER_BIG_W : 340);
        lv_obj_set_x(h->root, big ? HEADER_BIG_X : 63);
    }
    if (t) ui_set_text(h->title, title);
    bool two = false;
    if (t && big && s) { lv_obj_update_layout(h->title); two = lv_obj_get_height(h->title) > lv_font_get_line_height(F_BIG_TITLE); }
    int32_t y, title_gap = 0, pill_gap, text_gap;
    if (s) {
        /* the Sky at y 24, the title's text box at 84 (78 with two lines) */
        y = SKY_Y;
        title_gap = (two ? 72 : 78) - (SKY_Y + SKY_D);
    } else if (big) {
        y = c ? 22 : 49;                                           /* the clock's text at 27, the title's at 55 */
        title_gap = c ? 49 - (22 + lv_font_get_line_height(F_BIG_CLOCK)) : 0;
    } else if (h->tight) {
        y = HEADER_TIGHT_Y;
    } else if (c && !t) {
        y = 24;                                                    /* the clock alone (Free time · Spin) */
    } else {
        y = c ? 32 : h->low ? 53 : 30;                             /* the clock's text at 31; a title alone at 31 (`low`: 54, the younger one-step screens) */
        title_gap = c ? 50 - (32 + lv_font_get_line_height(F_HEADER_CLOCK)) : 0;
    }
    set_margin(h->title, title_gap);
    pill_gap = big ? 0 : !c && !t ? 30 : c && !t ? 56 - (24 + lv_font_get_line_height(F_HEADER_CLOCK)) : h->tight ? 2 : 10;
    text_gap = big ? 5 : 7;
    set_margin(h->pill.root, pill_gap);
    set_margin(h->text, text_gap);
    if (lv_obj_get_y(h->root) != y) lv_obj_set_y(h->root, y);
    /* Big's pill stands at the foot of the screen, out of the column */
    bool pill = below == HEADER_PILL && text && *text, foot = big && pill;
    ui_show(h->pill.root, pill && !foot);
    ui_show(h->foot.root, foot);
    ui_show(h->text, below == HEADER_TEXT && text && *text);
    if (pill) pill_set(foot ? &h->foot : &h->pill, tone, icon, text);
    if (below == HEADER_TEXT && text && *text) ui_set_text(h->text, text);
    lv_obj_set_style_max_width(h->text, big ? HEADER_BIG_W : 272, 0);
    if (foot) {
        lv_obj_update_layout(h->foot.root);
        lv_obj_set_pos(h->foot.root, CENTER - lv_obj_get_width(h->foot.root) / 2,
                       HEADER_FOOT_Y + (38 - lv_obj_get_height(h->foot.root)) / 2);   /* Figma's 38 high pill, ours a little shorter: the same middle */
    }
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
    lv_obj_set_pos(box, CENTER - lv_obj_get_width(box) / 2, 429);   /* Figma Rewards and Chores: 9 px under the band's top */
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
    /* Next on one line ("Next 6:00  Dinner") over a small button (the free-time wheel: Games) */
    h->line = ui_row(h->col, 8);
    ui_label(h->line, F_NEXT_LABEL, C_NEXT_LABEL, "Next");
    h->line_time = ui_label(h->line, F_NEXT_TIME, C_NEXT_LABEL, "");
    lv_obj_t *gap = ui_box(h->line);
    lv_obj_set_size(gap, 2, 1);
    h->line_icon = ui_icon(h->line, "star-line", 18, C_NEXT_TASK);
    h->line_task = ui_label(h->line, F_NEXT_LABEL, C_NEXT_TASK, "");
    lv_label_set_long_mode(h->line_task, LV_LABEL_LONG_DOT);
    lv_obj_set_style_max_width(h->line_task, 170, 0);
    tap_target(h->line, cb, HILL_TAP_NEXT);
    lv_obj_set_ext_click_area(h->line, 10);
    /* Button: one lime outline button, no curve (Figma Hill · Button, secondary, 52 high) */
    h->button = button_create(h->col, BTN_SECONDARY, false, "retry", "");
    lv_obj_set_height(h->button, 52);
    h->button_icon = lv_obj_get_child(h->button, 0);
    h->button_label = lv_obj_get_child(h->button, 1);
    tap_target(h->button, cb, HILL_TAP_BUTTON);
    /* Round: the younger child's 72 picture button with a 3 px lime ring, its middle at y 403 */
    h->round = ui_box(h->root);
    lv_obj_set_size(h->round, 72, 72);
    lv_obj_add_flag(h->round, LV_OBJ_FLAG_IGNORE_LAYOUT);
    lv_obj_set_pos(h->round, CENTER - 36, 404 - HILL_Y - 36);
    ui_style_card(h->round, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_border_width(h->round, 3, 0);
    lv_obj_set_style_border_color(h->round, COL(C_ACTION), 0);
    lv_obj_set_style_border_opa(h->round, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(h->round, COL(C_CHIP), LV_STATE_PRESSED);
    h->round_icon = ui_icon(h->round, "game", 36, C_ACTION);
    lv_obj_center(h->round_icon);
    tap_target(h->round, cb, HILL_TAP_BUTTON);
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
    ui_show(h->line, kind == HILL_NEXT_BUTTON);
    ui_show(h->button, kind == HILL_BUTTON || kind == HILL_NEXT_BUTTON);
    ui_show(h->text, kind == HILL_TEXT);
    ui_show(h->sw, kind == HILL_SWITCH);
    ui_show(h->round, kind == HILL_ROUND);
    ui_show(h->curve, kind == HILL_NEXT || kind == HILL_SWITCH || kind == HILL_NEXT_BUTTON);   /* the round game pad stands on the room */
    static const int32_t PAD[] = { 0, 9, 14, 24, 23, 6, 0 };
    lv_obj_set_style_pad_top(h->col, PAD[kind], 0);
    lv_obj_set_style_pad_row(h->col, kind == HILL_NEXT_BUTTON ? 4 : 8, 0);
    /* under the Next line (the wheel's Games) the button is a slim pill, so the wheel above stays
     * the thing to look at; on its own it's the full 52 px button */
    bool slim = kind == HILL_NEXT_BUTTON;
    lv_obj_set_height(h->button, slim ? 34 : 52);
    lv_obj_set_style_pad_hor(h->button, slim ? 18 : 24, 0);
    lv_obj_set_style_text_font(h->button_label, slim ? F_LABEL : F_BUTTON, 0);
    if (fresh) {   /* what the hill says now rises into place */
        lv_obj_t *shown = kind == HILL_NEXT ? h->next : kind == HILL_BUTTON ? h->button : kind == HILL_TEXT ? h->text : kind == HILL_SWITCH ? h->sw
                        : kind == HILL_ROUND ? h->round : NULL;
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

void hill_set_round(hill_t *h, const char *icon)
{
    hill_kind(h, HILL_ROUND);
    ui_icon_set(h->round_icon, icon && *icon ? icon : "game", 36);
    lv_obj_center(h->round_icon);
}

void hill_set_next_button(hill_t *h, const char *icon, const char *title, const char *time, const char *label)
{
    hill_kind(h, HILL_NEXT_BUTTON);
    ui_icon_set(h->line_icon, icon && *icon ? icon : "star-line", 18);
    ui_set_text(h->line_task, title);
    ui_set_text(h->line_time, time ? time : "");
    ui_show(h->line_time, time && *time);
    ui_show(h->button_icon, false);
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
static void free_user_grad(lv_event_t *e) { lv_free(lv_event_get_user_data(e)); }

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

lv_obj_t *top_fade_create(lv_obj_t *parent, int32_t black_to, int32_t clear_by)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, 400, clear_by);
    lv_obj_set_pos(o, 33, 0);
    lv_grad_dsc_t *g = lv_malloc_zeroed(sizeof *g);
    g->dir = LV_GRAD_DIR_VER;
    g->stops_count = 2;
    g->stops[0].color = COL(C_SCREEN); g->stops[0].opa = LV_OPA_COVER; g->stops[0].frac = (uint8_t)(255 * black_to / clear_by);
    g->stops[1].color = COL(C_SCREEN); g->stops[1].opa = LV_OPA_TRANSP; g->stops[1].frac = 255;
    lv_obj_set_style_bg_grad(o, g, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    lv_obj_add_event_cb(o, free_user_grad, LV_EVENT_DELETE, g);
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
    if (ui_in_strip(layer, a.x1, a.y1, a.x2, a.y2)) lv_draw_rect(layer, &d, &a);
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
        if (d->timer) { wtimer_remove(d->timer); lv_timer_delete(d->timer); }
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
    wtimer_add(d->timer);
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
/* the cue's state lives in its user data: the ring (0..100) in the low byte, dark in bit 8. Its
 * box is just the arc at 1 o'clock (r 224-230, on the timer's line, 293-307 degrees, round ends), so its breathing
 * redraws that corner and not the whole screen. */
#define CUE_X 310
#define CUE_Y 12
#define CUE_W 72
#define CUE_H 52
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
    a.center.x = c.x1 + CENTER - CUE_X;
    a.center.y = c.y1 + CENTER - CUE_Y;
    a.rounded = 1;
    a.radius = 232;          /* Figma "Button cue": 9 px wide on the timer's line (227) */
    a.width = 9;
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
    lv_obj_set_size(o, CUE_W, CUE_H);
    lv_obj_set_pos(o, CUE_X, CUE_Y);
    lv_obj_add_event_cb(o, cue_draw, LV_EVENT_DRAW_MAIN, NULL);
    return o;
}

/* ================================================================ Side nav */
/* Figma "Nav button": 54 px, bg/raised, a 26 px lime icon. The younger child's "Nav button · Big":
 * 72 px at (24, 197) and (370, 197), a 36 px icon. */
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
    lv_obj_set_user_data(b, (void *)(intptr_t)(left ? 1 : 0));
    return b;
}

void side_button_set_big(lv_obj_t *b, bool big, const char *icon)
{
    int32_t d = big ? 72 : 54;
    if (lv_obj_get_width(b) == d) return;
    bool left = (intptr_t)lv_obj_get_user_data(b) != 0;
    lv_obj_set_size(b, d, d);
    lv_obj_set_pos(b, left ? 24 : SCREEN_W - 24 - d, big ? 197 : 206);
    lv_obj_t *i = lv_obj_get_child(b, 0);
    ui_icon_set(i, icon, big ? 36 : 26);
    lv_obj_center(i);
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
    b->speaker = ui_icon(b->root, "volume", 20, C_ON_COLOR);
    lv_obj_set_style_margin_right(b->speaker, 8, 0);
    ui_show(b->speaker, false);
    b->label = ui_label(b->root, F_SPEECH, C_ON_COLOR, "");
    lv_obj_set_style_max_width(b->label, 160, 0);
    lv_label_set_long_mode(b->label, LV_LABEL_LONG_WRAP);
    bubble_hide(b);
}

void bubble_set_speaker(bubble_t *b, bool on) { ui_show(b->speaker, on); }

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

/* Figma "Speech" beside Biscuit's head: from x 246, its tail's tip at y 206; lower when the header
 * reaches further down (20 px under `below`, the lowest y it reaches). It may cover the top of the
 * side button, as in Figma. */
#define BUBBLE_X 246
void bubble_say_pet(bubble_t *b, const char *text, int32_t below, int32_t avoid_y)
{
    (void)avoid_y;
    ui_set_text(b->label, text);
    lv_obj_update_layout(b->root);
    int32_t y = 206 - 12 - lv_obj_get_height(b->root);
    if (y < below + 20) y = below + 20;
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

/* ================================================================ Star pips */
lv_obj_t *star_pips_create(lv_obj_t *parent, int32_t d, int32_t step)
{
    lv_obj_t *row = ui_box(parent);
    lv_obj_set_size(row, 4 * step + d, d);
    for (int i = 0; i < 5; i++) {   /* the star a little inside its square, as Figma draws it */
        int32_t sd = d * 5 / 6;
        lv_obj_t *s = ui_icon(row, "star-fill", sd, C_HILL_LINE);
        ui_icon_px(s, "star-fill", sd);
        lv_obj_set_pos(s, i * step + (d - sd) / 2, (d - sd) / 2);
    }
    return row;
}

void star_pips_set(lv_obj_t *row, int shown, int lit)
{
    for (int i = 0; i < 5; i++) {
        lv_obj_t *s = lv_obj_get_child(row, i);
        ui_show(s, i < shown);
        ui_set_color(s, i < lit ? C_STAR : C_HILL_LINE);
    }
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
            if (ui_in_strip(layer, a.x1, a.y1, a.x2, a.y2)) lv_draw_rect(layer, &d, &a);
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

/* ================================================================ List rows */
/* The row's parts carry what they are in their user data; the row's user data has its kind, its
 * end, and whether it's the younger child's (bits). list_row_style sets size and places the parts
 * for where the row is on the wheel. */
enum { LPART_ICON = 1, LPART_TITLE, LPART_DETAIL, LPART_END, LPART_NOW, LPART_DASH };
#define LROW_F_PIC 0x100
#define LROW_F_BORDER 0x200
#define LROW_F_DAY 0x400
#define LROW_DAY_W 352      /* the younger child's My day: Center */
#define LROW_DAY_EDGE 296   /* and Edge */

static const lv_font_t *const F_ROW = &font_pop600_24;

lv_obj_t *list_row_create(lv_obj_t *slot, lrow_kind_t kind, bool picture, const char *icon, const char *title,
                          const char *detail, lrow_end_t end, bool checked)
{
    lv_obj_t *card = ui_box(slot);
    lv_obj_set_size(card, 1, 1);
    lv_obj_center(card);
    uint32_t bg = C_RAISED, fg = C_TEXT, sub = C_TEXT_MUTED, icf = C_TEXT;
    bool border = false;
    switch (kind) {
    case LROW_DONE: fg = sub = icf = C_TEXT_MUTED; break;
    case LROW_NOW: sub = C_ACTION; border = true; break;
    case LROW_NEXT: break;
    case LROW_FREE: fg = sub = icf = C_DONE; border = true; break;
    case LROW_CHORE: bg = C_SYSTEM; fg = sub = icf = C_ON_COLOR; break;
    case LROW_CHORE_DONE: fg = icf = C_TEXT_MUTED; sub = C_DONE; break;
    }
    if (picture && kind == LROW_DONE) fg = icf = C_TEXT_MUTED;
    ui_style_card(card, bg, LV_RADIUS_CIRCLE, 0, 0);
    if (kind == LROW_NOW) {
        lv_obj_set_style_border_width(card, picture ? 3 : 2, 0);
        lv_obj_set_style_border_color(card, COL(C_ACTION), 0);
        lv_obj_set_style_border_opa(card, LV_OPA_COVER, 0);
    } else if (kind == LROW_FREE) {
        /* a clear 2 px border keeps the parts where Now's outline puts them; the dashes go over it */
        lv_obj_set_style_border_width(card, 2, 0);
        lv_obj_set_style_border_opa(card, LV_OPA_TRANSP, 0);
        lv_obj_t *o = dotted_outline_create(card, C_DONE, 999);
        lv_obj_add_flag(o, LV_OBJ_FLAG_IGNORE_LAYOUT);
        lv_obj_add_flag(o, LV_OBJ_FLAG_USER_1);   /* the outline: its user data is its own */
    }
    lv_obj_t *ic = ui_icon(card, icon && *icon ? icon : "star-line", picture ? 72 : 48, icf);
    lv_image_set_inner_align(ic, LV_IMAGE_ALIGN_CENTER);
    lv_obj_set_user_data(ic, (void *)(intptr_t)LPART_ICON);
    lv_obj_t *tt = ui_label(card, picture ? &font_pop600_20 : F_ROW, fg, title);
    lv_label_set_long_mode(tt, LV_LABEL_LONG_DOT);
    lv_obj_set_user_data(tt, (void *)(intptr_t)LPART_TITLE);
    if (picture && kind == LROW_DONE) {   /* Figma Picture row · Done: the picture at 50 %, the name at 60 % */
        lv_obj_set_style_image_opa(ic, LV_OPA_50, 0);
        lv_obj_set_style_text_opa(tt, LV_OPA_60, 0);
    }
    if (!picture && detail) {
        lv_obj_t *dt = ui_label(card, F_DETAIL, sub, detail);
        lv_label_set_long_mode(dt, LV_LABEL_LONG_DOT);
        lv_obj_set_height(dt, lv_font_get_line_height(F_DETAIL));
        lv_obj_set_user_data(dt, (void *)(intptr_t)LPART_DETAIL);
    }
    if (end == LROW_END_CHECK) {
        lv_obj_t *box = checkbox_create(card, 52, checked);
        lv_obj_set_user_data(box, (void *)(intptr_t)LPART_END);
    } else if (end == LROW_END_NOW && !picture) {
        lv_obj_t *now = ui_label(card, F_LABEL, C_ACTION, "Now");
        lv_obj_set_user_data(now, (void *)(intptr_t)LPART_NOW);
    } else if (end == LROW_END_TICK) {
        /* a 32 mint disc with a navy tick */
        lv_obj_t *t = ui_box(card);
        lv_obj_set_size(t, 32, 32);
        ui_style_card(t, C_DONE, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_center(ui_icon(t, "check", 20, C_ON_COLOR));
        lv_obj_set_user_data(t, (void *)(intptr_t)LPART_NOW);
    }
    lv_obj_set_user_data(card, (void *)(intptr_t)(kind | (end << 4) | (picture ? LROW_F_PIC : 0) | (border ? LROW_F_BORDER : 0)));
    return card;
}

/* The widest word of `t` in `font`. */
static int32_t widest_word(const char *t, const lv_font_t *font)
{
    int32_t best = 0;
    while (*t) {
        char w[48];
        size_t n = 0;
        while (*t == ' ') t++;
        while (*t && *t != ' ') { if (n < sizeof w - 1) w[n++] = *t; t++; }
        w[n] = 0;
        if (!n) break;
        lv_point_t sz;
        lv_text_get_size(&sz, w, font, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
        if (sz.x > best) best = sz.x;
    }
    return best;
}

void list_row_set_day(lv_obj_t *card)
{
    intptr_t f = (intptr_t)lv_obj_get_user_data(card) | LROW_F_DAY;
    lv_obj_set_user_data(card, (void *)f);
    /* the name's room a row away, where it is narrowest (as list_row_style lays it out) */
    int32_t b = lv_obj_get_style_border_width(card, 0), cw = LROW_DAY_EDGE - 2 * b, tx = 18 + 38 + 14;
    int32_t room = (((f >> 4) & 0xF) != LROW_END_NONE ? cw - 24 - 24 - 14 : cw - 18) - tx;
    uint32_t n = lv_obj_get_child_count(card);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *c = lv_obj_get_child(card, (int32_t)i);
        if (lv_obj_has_flag(c, LV_OBJ_FLAG_USER_1) || (intptr_t)lv_obj_get_user_data(c) != LPART_TITLE) continue;
        const lv_font_t *font = widest_word(lv_label_get_text(c), &font_pop600_28) <= room ? &font_pop600_28 : &font_pop600_24;
        lv_obj_set_style_text_font(c, font, 0);
        lv_obj_set_style_text_line_space(c, UI_FIT_SPACE, 0);
    }
}

lv_obj_t *list_row_box(lv_obj_t *card)
{
    uint32_t n = lv_obj_get_child_count(card);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *c = lv_obj_get_child(card, (int32_t)i);
        if (!lv_obj_has_flag(c, LV_OBJ_FLAG_USER_1) && (intptr_t)lv_obj_get_user_data(c) == LPART_END) return c;
    }
    return NULL;
}

void list_row_mark_done(lv_obj_t *card)
{
    card_recolor(card, C_SYSTEM, C_RAISED, 360);
    lv_obj_set_style_bg_color(card, COL(C_RAISED), LV_STATE_PRESSED);
    uint32_t n = lv_obj_get_child_count(card);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *c = lv_obj_get_child(card, (int32_t)i);
        if (lv_obj_has_flag(c, LV_OBJ_FLAG_USER_1)) continue;
        switch ((int)(intptr_t)lv_obj_get_user_data(c)) {
        case LPART_ICON: case LPART_TITLE: ui_set_color(c, C_TEXT_MUTED); break;
        case LPART_DETAIL: ui_set_text(c, "Done!"); ui_set_color(c, C_DONE); break;
        case LPART_END: checkbox_tick(c); break;
        }
    }
}

const char *picture_icon(const char *icon, const char *title)
{
    if (!icon || (strcmp(icon, "clean") && strcmp(icon, "house") && strcmp(icon, "home"))) return icon;
    char t[48];
    size_t i = 0;
    for (; title && title[i] && i < sizeof t - 1; i++) t[i] = (char)((title[i] >= 'A' && title[i] <= 'Z') ? title[i] + 32 : title[i]);
    t[i] = 0;
    return strstr(t, "desk") ? "pencil" : "sofa";
}

/* A checkbox drawn at d px whatever it was made at (its ring, fill and tick follow). */
static void box_size(lv_obj_t *box, int32_t d)
{
    if (lv_obj_get_width(box) == d) return;
    lv_obj_set_size(box, d, d);
    lv_obj_t *fill = lv_obj_get_child(box, 0), *tick = lv_obj_get_child(box, 1);
    if (fill) { lv_obj_set_size(fill, d, d); lv_obj_center(fill); }
    if (tick) lv_obj_center(tick);
}

void list_row_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), k = fminf(ad, 1.0f), far = fmaxf(0.0f, ad - 2.0f);
    intptr_t f = (intptr_t)lv_obj_get_user_data(card);
    bool pic = f & LROW_F_PIC, day = f & LROW_F_DAY;
    int32_t b = lv_obj_get_style_border_width(card, 0);
    /* Center to Edge */
    int32_t w = day ? (int32_t)lroundf(LROW_DAY_W - (LROW_DAY_W - LROW_DAY_EDGE) * k)
              : pic ? (int32_t)lroundf(400 - 72 * k) : (int32_t)lroundf(416 - 24 * k);
    int32_t hc = pic ? (int32_t)lroundf(96 - 16 * k) : (int32_t)lroundf(79 - 5 * k);
    int32_t pull = pic ? LROW_PIC_PULL : LROW_PULL;
    int32_t ty = (int32_t)lroundf((d > 0 ? -1 : 1) * pull * fmaxf(0.0f, ad - 1.0f));
    if (lv_obj_get_style_translate_y(card, 0) != ty) lv_obj_set_style_translate_y(card, ty, 0);
    if (lv_obj_get_width(card) != w || lv_obj_get_height(card) != hc + 2 * b) {
        lv_obj_set_size(card, w, hc + 2 * b);
        int32_t cw = w - 2 * b;                                   /* the inside width */
        int32_t in = pic ? (int32_t)lroundf(20 - 2 * k) : 24;      /* to the icon, inside the outline */
        int32_t isz = pic ? (int32_t)lroundf(72 - 34 * k) : (int32_t)lroundf(48 - 4 * k);
        int32_t box = pic ? (int32_t)lroundf(48 - 24 * k) : (int32_t)lroundf(52 - 4 * k);
        int32_t tx = in + isz + (pic ? (int32_t)lroundf(16 - 2 * k) : 14);
        int32_t rpad = pic ? (int32_t)lroundf(16 + 8 * k) : 16;
        int32_t end_x = cw - rpad - box;
        bool has_end = ((f >> 4) & 0xF) != LROW_END_NONE;
        uint32_t n = lv_obj_get_child_count(card);
        for (uint32_t i = 0; i < n; i++) {
            lv_obj_t *c = lv_obj_get_child(card, (int32_t)i);
            if (lv_obj_has_flag(c, LV_OBJ_FLAG_USER_1)) { lv_obj_set_pos(c, -b, -b); lv_obj_set_size(c, w, hc + 2 * b); continue; }   /* the dashed outline */
            switch ((int)(intptr_t)lv_obj_get_user_data(c)) {
            case LPART_ICON: {
                lv_obj_set_size(c, isz, isz);
                lv_obj_set_pos(c, in, (hc - isz) / 2);
                const lv_image_dsc_t *src = lv_image_get_src(c);
                int32_t sw = src ? (int32_t)src->header.w : isz;
                lv_image_set_pivot(c, sw / 2, sw / 2);
                lv_image_set_scale(c, (uint32_t)(256 * isz / (sw ? sw : isz)));
                break;
            }
            case LPART_TITLE: {
                int32_t tw = (has_end ? end_x - 14 : cw - in) - tx;
                lv_obj_set_width(c, tw);
                if (day) lv_obj_set_height(c, LV_SIZE_CONTENT);
                lv_obj_update_layout(c);
                int32_t lh = lv_obj_get_height(c);
                if (day) {   /* two lines at most */
                    const lv_font_t *font = lv_obj_get_style_text_font(c, 0);
                    int32_t two = 2 * lv_font_get_line_height(font) + UI_FIT_SPACE;
                    if (lh > two) lv_obj_set_height(c, lh = two);
                }
                lv_obj_set_pos(c, tx, pic ? (hc - lh) / 2 : (int32_t)lroundf(10 - 2 * k));
                break;
            }
            case LPART_DETAIL:
                lv_obj_set_width(c, (has_end ? end_x - 14 : cw - in) - tx);
                lv_obj_set_pos(c, tx, (int32_t)lroundf(40 - 2 * k));
                break;
            case LPART_END:
                box_size(c, box);
                lv_obj_set_pos(c, end_x, (hc - box) / 2);
                break;
            case LPART_NOW:
                lv_obj_set_pos(c, cw - rpad - lv_obj_get_width(c), (hc - lv_obj_get_height(c)) / 2);
                break;
            }
        }
    }
    /* the row fades as one: 70 % (younger 60 %) a row away, then out */
    float edge = pic ? 0.4f : 0.3f;
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - edge * k) * fmaxf(0.0f, 1.0f - far / 0.6f)));
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

int32_t ui_path_in_out(const lv_anim_t *a)
{
    float t = path_t(a), u = 2.0f - 2.0f * t;
    return path_mix(a, t < 0.5f ? 2.0f * t * t : 1.0f - u * u / 2.0f);
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

void ui_hide_now(lv_obj_t *o)
{
    if (!o) return;
    lv_anim_delete(o, reveal_opa);
    lv_anim_delete(o, reveal_ty);
    lv_obj_remove_flag(o, REVEAL_OUT);
    lv_obj_add_flag(o, LV_OBJ_FLAG_HIDDEN);
    lv_obj_set_style_opa(o, LV_OPA_COVER, 0);
    lv_obj_set_style_translate_y(o, 0, 0);
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

void checkbox_untick(lv_obj_t *box)
{
    if (!box || lv_obj_get_child_count(box) < 2) return;
    lv_obj_t *fill = lv_obj_get_child(box, 0), *tick = lv_obj_get_child(box, 1);
    if (lv_obj_has_flag(fill, LV_OBJ_FLAG_HIDDEN)) return;   /* already clear */
    lv_anim_delete(fill, scale_exec);
    lv_anim_delete(tick, scale_exec);
    lv_anim_delete(box, border_opa_exec);
    ui_show(fill, false);
    ui_show(tick, false);
    lv_obj_set_style_border_opa(box, LV_OPA_COVER, 0);
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
        ui_row_scale(card, s, false);
        if (lv_obj_get_style_opa(card, 0) != opa) lv_obj_set_style_opa(card, opa, 0);
        if (lv_obj_get_style_translate_y(card, 0) != ty) lv_obj_set_style_translate_y(card, ty, 0);
    }
}

static void wheel_scroll(lv_event_t *e) { wheel_apply(lv_event_get_target(e)); }

/* A flick stops on the next row instead of coasting past several: a finger that dragged the list
 * onto another row lands on the row nearest the line, a shorter flick moves exactly one row, and a
 * touch that hardly moved settles back. */
#define WHEEL_FLICK_PX 12
static void wheel_grabbed(lv_event_t *e)
{
    lv_obj_t *list = lv_event_get_target(e);
    wheel_list_t *w = lv_obj_get_user_data(list);
    lv_indev_t *in = lv_indev_active();
    /* a finger's begin has no parameter (LVGL's own scroll animations pass themselves) */
    if (w && !lv_event_get_param(e) && in && lv_indev_get_scroll_obj(in) == list) w->grab_y = lv_obj_get_scroll_y(list);
}

static void wheel_released(lv_event_t *e)
{
    if (!lv_event_get_param(e)) return;   /* the end of a turn, not of a finger */
    lv_obj_t *list = lv_event_get_target(e);
    wheel_list_t *w = lv_obj_get_user_data(list);
    if (!w) return;
    int32_t y = lv_obj_get_scroll_y(list), moved = y - w->grab_y;
    int from = (int)lroundf((float)w->grab_y / w->row_h), at = (int)lroundf((float)y / w->row_h);
    if (at == from && LV_ABS(moved) >= WHEEL_FLICK_PX) at += moved > 0 ? 1 : -1;
    wheel_list_turn(w, at, 0);   /* in place of LVGL's snap, which it stops */
}

void wheel_list_create(lv_obj_t *parent, wheel_list_t *w, int32_t x, int32_t y, int32_t width, int32_t height,
                       int32_t focus_y, int32_t row_h)
{
    w->focus_y = focus_y;
    w->row_h = row_h;
    w->shrink = WHEEL_SHRINK;
    w->fade = WHEEL_FADE;
    w->style = NULL;
    w->grab_y = 0;
    w->list = ui_box(parent);
    lv_obj_set_pos(w->list, x, y);
    lv_obj_set_size(w->list, width, height);
    lv_obj_add_flag(w->list, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLL_ELASTIC);
    lv_obj_remove_flag(w->list, LV_OBJ_FLAG_SCROLL_CHAIN_VER | LV_OBJ_FLAG_SCROLL_MOMENTUM);   /* a row per flick: wheel_released */
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
    lv_obj_add_event_cb(w->list, wheel_grabbed, LV_EVENT_SCROLL_BEGIN, NULL);
    lv_obj_add_event_cb(w->list, wheel_released, LV_EVENT_SCROLL_END, NULL);
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

/* LVGL's own snap or throw, or an earlier turn; not the list's other animations (ui_reveal's fade in,
 * stopped halfway, left the list invisible) */
static void wheel_stop(wheel_list_t *w)
{
    lv_obj_stop_scroll_anim(w->list);
    lv_anim_delete(w->list, turn_exec);
}

void wheel_list_turn(wheel_list_t *w, int i, uint32_t delay_ms)
{
    i = wheel_clamp(w, i);
    int32_t from = lv_obj_get_scroll_y(w->list), to = (int32_t)i * w->row_h;
    wheel_stop(w);
    if (from == to) { wheel_apply(w->list); return; }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, w->list);
    lv_anim_set_exec_cb(&a, turn_exec);
    lv_anim_set_values(&a, from, to);
    lv_anim_set_duration(&a, 420);
    lv_anim_set_delay(&a, delay_ms);
    lv_anim_set_path_cb(&a, ui_path_settle);
    /* not applied at once: started as a finger lets go, the input device still holds the list then,
     * and turn_exec would take that for a finger taking over */
    lv_anim_set_early_apply(&a, false);
    lv_anim_start(&a);
}

void wheel_list_focus(wheel_list_t *w, int i, bool anim)
{
    if (anim) { wheel_list_turn(w, i, 0); return; }
    i = wheel_clamp(w, i);
    wheel_stop(w);
    lv_obj_scroll_to_y(w->list, (int32_t)i * w->row_h, LV_ANIM_OFF);
    wheel_apply(w->list);
}

void wheel_list_set_focus(wheel_list_t *w, int32_t focus_y)
{
    int at = wheel_list_current(w);
    w->focus_y = focus_y;
    lv_obj_set_style_pad_top(w->list, focus_y - w->row_h / 2, 0);
    lv_obj_set_style_pad_bottom(w->list, lv_obj_get_height(w->list) - focus_y - w->row_h / 2, 0);
    lv_obj_update_layout(w->list);
    wheel_list_focus(w, at, false);
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

/* A screen pushed in waits off to the right for the frame that first draws it before it slides:
 * building it (Playtime's stage, its games) and drawing it take a while on the board, and a slide
 * timed from before that is first seen half way in. */
static lv_obj_t *push_waiting;
static lv_timer_t *push_timer;
static void push_drawn(lv_event_t *e);

static void push_go(void)
{
    lv_display_t *d = lv_display_get_default();
    if (d) lv_display_remove_event_cb_with_user_data(d, push_drawn, NULL);
    if (push_timer) { lv_timer_delete(push_timer); push_timer = NULL; }
    lv_obj_t *o = push_waiting;
    push_waiting = NULL;
    if (o) run_anim(o, anim_x, SCREEN_W, 0, 360, ui_path_in_out, NULL);
}

static void push_drawn(lv_event_t *e) { (void)e; push_go(); }
static void push_late(lv_timer_t *t) { (void)t; push_timer = NULL; push_go(); }   /* no frame came (the screen asleep) */
static void push_deleted(lv_event_t *e) { if (lv_event_get_target(e) == push_waiting) push_waiting = NULL; }

static bool leaving(lv_obj_t *o)
{
    if (lv_obj_has_flag(o, LV_OBJ_FLAG_USER_1)) return true;
    lv_obj_add_flag(o, LV_OBJ_FLAG_USER_1);
    if (o == push_waiting) push_waiting = NULL;
    lv_anim_delete(o, anim_x);
    lv_anim_delete(o, anim_opa);
    lv_anim_delete(o, anim_ty);
    return false;
}

void overlay_enter_push(lv_obj_t *o)
{
    if (!o) return;
    if (push_waiting) push_go();   /* one already waiting goes now */
    lv_obj_set_x(o, SCREEN_W);
    push_waiting = o;
    lv_obj_add_event_cb(o, push_deleted, LV_EVENT_DELETE, NULL);
    lv_display_t *d = lv_display_get_default();
    if (d) lv_display_add_event_cb(d, push_drawn, LV_EVENT_REFR_READY, NULL);
    push_timer = lv_timer_create(push_late, 300, NULL);
    lv_timer_set_repeat_count(push_timer, 1);
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

static void anim_scale(void *obj, int32_t v) { lv_obj_set_style_transform_scale(obj, v, 0); }
static void pop_done(lv_anim_t *a) { lv_obj_set_style_transform_scale(a->var, 256, 0); }

void overlay_enter_pop(lv_obj_t *o)
{
    if (!o) return;
    lv_obj_set_style_transform_pivot_x(o, lv_pct(50), 0);
    lv_obj_set_style_transform_pivot_y(o, lv_pct(50), 0);
    lv_obj_set_style_transform_scale(o, 205, 0);
    lv_obj_set_style_opa(o, LV_OPA_TRANSP, 0);
    run_anim(o, anim_opa, LV_OPA_TRANSP, LV_OPA_COVER, 180, ui_path_out, NULL);
    run_anim(o, anim_scale, 205, 256, 420, ui_path_spring, pop_done);
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
