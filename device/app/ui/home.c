#include "home.h"
#include "fx.h"
#include "wheel.h"
#include <stdio.h>
#include <string.h>
#include <math.h>

/* The worm (Figma "Free time eaten"): coral pixel art, 3.8 px cells. */
static const char *const WORM[] = {
    "................#....#.",
    ".................#..#..",
    ".................####..",
    "................######.",
    ".###..###..###.#####..#",
    "####################..#",
    "#######################",
    "###############.######.",
    ".###..###..###...####..",
    "..#....#....#..........",
};

/* MyToki 2 (Figma "Graphic"): the room fills the 466 screen, or sits in the 298 circle at (84, 84);
 * the younger child's Inset keeps the room's size but shows it in a 438 circle at (14, 14). */
#define FULL_D SCREEN_W
#define SMALL_D 298
#define SMALL_XY 84
#define INSET_D 438
#define INSET_XY 14
#define NOTE_Y 311            /* Figma "Note · Plain" (At the event); the button's notes ("All done!") at 319 */
#define NOTE_BUTTON_Y 319
/* the younger one step at a time (Figma "Picture row", Kind=Step, Size=Center): a 272 lime circle
 * concentric with the screen, the step's picture (105) and its name (Poppins SemiBold 24) in navy */
#define STEP_D 272
#define STEP_ICON 105
/* the Get ready checklist: rows 59 apart round the centre line */
#define STEPS_Y 100
#define STEPS_H 268
#define STEPS_ROW 92          /* row centres 145, 238, 330 (Figma Going out · Get ready, 1093:8088) */
#define STEPS_FOCUS 238
#define TAP_D 412             /* where the stars twinkle when Biscuit can be tapped: just inside the timer (227 out, 6 wide) */
#define TAP_CY CENTER

static struct {
    home_cb_t cb;
    lv_obj_t *page, *pet, *faint, *wheel, *scrim, *timer;
    lv_obj_t *count, *count_left;            /* MID_COUNTDOWN */
    lv_obj_t *step, *step_icon, *step_name;  /* MID_STEP */
    int step_shown;
    char step_sig[64];
    lv_obj_t *overdue, *overdue_text, *worm;
    lv_obj_t *tap_stars;
    lv_obj_t *left, *right;
    lv_obj_t *bigclock, *charging;
    pill_t bigclock_pill;
    header_t hdr;
    hill_t hill;
    home_bottom_t bottom;
    wheel_list_t steps;
    lv_obj_t *steps_fade;
    lv_obj_t *cue;
    char steps_sig[64];
    uint16_t steps_ticked;
    lime_card_t card;
    bubble_t bubble;
    uint8_t worm_eaten;
    float worm_phase;
    lv_obj_t *worm_ring, *worm_icon;
    char worm_icon_name[20];
    lv_timer_t *worm_timer;
    bool worm_on, dark, cue_on, stars_on;   /* the endless animations, run only while they show */
    char title_sig[48];
    home_graphic_t graphic;
    int16_t pet_dim;          /* the look last given to the pet (-1: none yet) */
    uint8_t room_fade;
} h;

static bool pet_held;   /* a long tap on the pet: its release isn't also a tap */
static void fire(lv_event_t *e)
{
    home_event_t ev = (home_event_t)(intptr_t)lv_event_get_user_data(e);
    if (ev == HOME_TAP_PET && pet_held) { pet_held = false; return; }
    if (h.cb) h.cb(ev, 0);
}
static void on_pet_hold(lv_event_t *e)
{
    lv_event_code_t c = lv_event_get_code(e);
    if (c == LV_EVENT_PRESSED) pet_held = false;
    else if (c == LV_EVENT_LONG_PRESSED) { pet_held = true; if (h.cb) h.cb(HOME_HOLD_PET, 0); }
}
static void on_wheel(int idx) { if (h.cb) h.cb(HOME_WHEEL_RESULT, idx); }

static void on_hill(hill_tap_t tap)
{
    if (!h.cb) return;
    switch (tap) {
    case HILL_TAP_NEXT: h.cb(HOME_TAP_NEXT, 0); break;
    case HILL_TAP_SPIN: h.cb(HOME_TAP_WHEEL, 0); break;
    case HILL_TAP_PLAY: h.cb(HOME_TAP_PLAY, 0); break;
    case HILL_TAP_BUTTON: h.cb(h.bottom == BOTTOM_GAMES ? HOME_TAP_PLAYTIME : HOME_TAP_CARD, 0); break;
    }
}

/* The worm row (Figma "Free time eaten", 1523:15161). Older: the worm (23 x 10 cells of 5.04 px), six
 * dots of free time (mint, dark once eaten, from the left) and an empty mint ring at the end, a 284 x
 * 60 row at (91, 222). Younger: a bigger worm (6.52 px cells), two big dots of play time left (chip,
 * gone once eaten) and the play it is eating towards in an amber circle, a 378 x 78 row at (44, 199).
 * It crawls in place: its humps ripple from tail to head and the head bobs as it munches; the dot in
 * front of it shrinks with each bite. */
#define WORM_COLS 23
#define WORM_PERIOD_MS 1400
typedef struct {
    float cell;                 /* a cell of the worm */
    int16_t worm_y;             /* its top in the row */
    int8_t ndots;
    float dot_d, dot_x0, dot_step;   /* the dots: size, the first one's middle, apart */
    int16_t ring_d, ring_x;     /* the ring (older) or the activity circle (younger) */
    int16_t row_x, row_y, row_w, row_h;
    bool young;
} worm_geo_t;
static const worm_geo_t WORM_OLD = { 5.04f, 0, 6, 9, 128, 17.4f, 58, 226, 91, 222, 284, 60, false };
static const worm_geo_t WORM_YOUNG = { 6.52f, 6, 2, 42, 193, 64, 78, 300, 44, 199, 378, 78, true };
static const worm_geo_t *worm_geo = &WORM_OLD;

static void worm_draw(lv_event_t *e)
{
    const worm_geo_t *g = worm_geo;
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    const float ph = h.worm_phase * 6.2831853f, cell = g->cell;
    const float wx = (float)c.x1, wy = c.y1 + (float)g->worm_y;
    d.bg_color = COL(C_LATE);
    for (int i = 0; i < WORM_COLS; i++) {
        /* the body (columns 0..14) ripples in a wave from the tail; the head bobs */
        float dy = (i < 15 ? -2.6f * fmaxf(0.0f, sinf(ph - i * 0.42f)) : 1.4f * sinf(ph * 2.0f)) * cell / 3.8f;
        for (int j = 0; j < 10; j++) {
            if (WORM[j][i] != '#') continue;
            float x0 = wx + i * cell, y0 = wy + j * cell + dy;
            lv_area_t a = { (int32_t)x0, (int32_t)y0, (int32_t)(x0 + cell) - 1, (int32_t)(y0 + cell) - 1 };
            if (ui_in_strip(layer, a.x1, a.y1, a.x2, a.y2)) lv_draw_rect(layer, &d, &a);
        }
    }
    /* the dots: the eaten ones dark (older) or gone (younger); the next one shrinks bite by bite */
    d.radius = LV_RADIUS_CIRCLE;
    int eaten = (h.worm_eaten * g->ndots + 4) / 5;
    for (int k = 0; k < g->ndots; k++) {
        float cx = g->dot_x0 + k * g->dot_step, r = g->dot_d / 2;
        if (k < eaten && g->young) continue;
        if (k == eaten) r *= 0.75f + 0.25f * (0.5f + 0.5f * cosf(ph * 2.0f));
        d.bg_color = COL(k < eaten || g->young ? C_CHIP : C_DONE);
        lv_area_t a = { (int32_t)lroundf(c.x1 + cx - r), (int32_t)lroundf(c.y1 + g->row_h / 2.0f - r),
                        (int32_t)lroundf(c.x1 + cx + r) - 1, (int32_t)lroundf(c.y1 + g->row_h / 2.0f + r) - 1 };
        if (ui_in_strip(layer, a.x1, a.y1, a.x2, a.y2)) lv_draw_rect(layer, &d, &a);
    }
}

/* Every 40 ms while the worm shows: the crawl. */
static void worm_tick(lv_timer_t *t)
{
    (void)t;
    if (!h.worm || lv_obj_has_flag(h.overdue, LV_OBJ_FLAG_HIDDEN)) return;
    h.worm_phase += 40.0f / WORM_PERIOD_MS;
    if (h.worm_phase >= 1.0f) h.worm_phase -= 1.0f;
    lv_obj_invalidate(h.worm);
}

/* The row and the sentence where the age's Figma has them: older, the row at y 222 and the sentence
 * (Poppins Medium 24) low at y 368; younger, the row at 199 and "Playtime is going away" (Montserrat
 * Bold 32) at 341. */
static void worm_layout(bool young)
{
    const worm_geo_t *g = worm_geo = young ? &WORM_YOUNG : &WORM_OLD;
    lv_obj_set_pos(h.worm, g->row_x, g->row_y);
    lv_obj_set_size(h.worm, g->row_w, g->row_h);
    lv_obj_set_size(h.worm_ring, g->ring_d, g->ring_d);
    lv_obj_set_pos(h.worm_ring, g->ring_x, (g->row_h - g->ring_d) / 2 + (young ? 0 : 1));
    if (young) ui_style_card(h.worm_ring, C_STAR, LV_RADIUS_CIRCLE, 0, 0);
    else lv_obj_set_style_bg_opa(h.worm_ring, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(h.worm_ring, young ? 0 : 2, 0);
    ui_show(h.worm_icon, young);
    const lv_font_t *f = young ? &font_mon700_32 : &font_pop500_24;
    lv_obj_set_style_text_font(h.overdue_text, f, 0);
    lv_obj_set_style_text_line_space(h.overdue_text, young ? 0 : -2, 0);   /* Figma: 40 and 30 px lines */
    lv_obj_set_width(h.overdue_text, young ? 378 : 290);
    lv_obj_align(h.overdue_text, LV_ALIGN_TOP_MID, 0, young ? 341 : 366);
}

static void ring_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }
/* a star twinkles: it brightens and swells a little, then fades and shrinks away */
static void twinkle_exec(void *obj, int32_t v)
{
    lv_obj_set_style_image_opa(obj, (lv_opa_t)v, 0);
    lv_image_set_scale(obj, (uint32_t)(150 + v * 130 / 255));
}

/* The stars about Biscuit when he can be tapped, each in its own time. */
static const struct { int16_t deg, size; uint16_t ms, delay; } STARS[] = {
    { 210, 16, 900, 0 }, { 236, 12, 700, 350 }, { 304, 14, 800, 600 },
    { 330, 18, 1000, 150 }, { 150, 12, 750, 800 }, { 30, 16, 850, 450 },
};

/* The endless little animations (the cue's breath, the stars, the worm) run only while they show
 * and the screen is on: one running keeps LVGL's animation timer, and the chip, awake every frame. */
static void cue_breathe(bool on)
{
    if (on == h.cue_on) return;
    h.cue_on = on;
    lv_anim_delete(h.cue, ring_opa);
    lv_obj_set_style_opa(h.cue, LV_OPA_COVER, 0);
    if (!on) return;
    lv_anim_t ca;
    lv_anim_init(&ca);
    lv_anim_set_var(&ca, h.cue);
    lv_anim_set_exec_cb(&ca, ring_opa);
    lv_anim_set_values(&ca, 255, 110);
    lv_anim_set_duration(&ca, 700);
    lv_anim_set_playback_duration(&ca, 700);
    lv_anim_set_repeat_count(&ca, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&ca);
}

static void stars_twinkle(bool on)
{
    if (on == h.stars_on) return;
    h.stars_on = on;
    uint32_t n = lv_obj_get_child_count(h.tap_stars);
    for (uint32_t i = 0; i < n && i < sizeof STARS / sizeof STARS[0]; i++) {
        lv_obj_t *s = lv_obj_get_child(h.tap_stars, (int32_t)i);
        lv_anim_delete(s, twinkle_exec);
        if (!on) { twinkle_exec(s, 0); continue; }
        lv_anim_t t;
        lv_anim_init(&t);
        lv_anim_set_var(&t, s);
        lv_anim_set_exec_cb(&t, twinkle_exec);
        lv_anim_set_values(&t, 0, 255);
        lv_anim_set_duration(&t, STARS[i].ms);
        lv_anim_set_playback_duration(&t, STARS[i].ms);
        lv_anim_set_repeat_delay(&t, 300 + STARS[i].delay / 2);
        lv_anim_set_delay(&t, STARS[i].delay);
        lv_anim_set_path_cb(&t, lv_anim_path_ease_in_out);
        lv_anim_set_repeat_count(&t, LV_ANIM_REPEAT_INFINITE);
        lv_anim_start(&t);
    }
}

static void worm_run(void)
{
    if (h.worm_on && !h.dark) lv_timer_resume(h.worm_timer);
    else lv_timer_pause(h.worm_timer);
}

void home_pause(bool dark)
{
    h.dark = dark;
    worm_run();
}

/* Figma Going out · Get ready (Step rows): the step now is a lime row 348 wide, fully round, on the
 * centre line, its words Pill 24; the ones above (done, mint) and below (lime) are 301 wide at 30%,
 * their words Detail 20 (the number and the Checkbox stay their size); further ones fade out. A black
 * fade over the top lets the row above slip under the header. */
static void steps_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), near = fminf(ad, 1.0f), far = fmaxf(0.0f, ad - 1.0f);
    int32_t w = (int32_t)lroundf(348 - 47 * near);
    if (lv_obj_get_width(card) != w) {
        lv_obj_set_width(card, w);
        lv_obj_t *l = lv_obj_get_child(card, 1);
        const lv_font_t *f = near < 0.5f ? &font_pop600_24 : F_DETAIL;   /* the words switch half way out */
        if (lv_obj_get_style_text_font(l, 0) != f) {
            lv_obj_set_style_text_font(l, f, 0);
            lv_obj_set_style_max_height(l, 2 * lv_font_get_line_height(f) - 2, 0);   /* two lines at most */
        }
    }
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - 0.7f * near) * fmaxf(0.0f, 1.0f - far / 0.6f)));   /* the row fades as one, like Figma */
}

/* a tap on any step checks or unchecks it, in any order; sent once the click is over */
static void step_tapped(void *i) { if (h.cb) h.cb(HOME_TAP_STEP, (int)(intptr_t)i); }
static void on_step(lv_event_t *e) { lv_async_call(step_tapped, lv_event_get_user_data(e)); }
static void on_step_one(lv_event_t *e) { (void)e; if (h.step_shown >= 0) lv_async_call(step_tapped, (void *)(intptr_t)h.step_shown); }   /* (-2: all ticked) */

/* Figma "Step": 348 wide, 16 / 24 padding, gap 16: the number ("2.", Detail 20 in cream) on a 35 px
 * amber disc, the step (Pill 24, up to two lines of 30), the Checkbox (48). 80 high with one line. */
static void steps_build(const home_view_t *v)
{
    wheel_list_clear(&h.steps);
    for (int i = 0; i < v->steps_total && i < HOME_STEPS_MAX; i++) {
        bool done = v->steps_ticked & (1u << i);
        lv_obj_t *slot = wheel_list_add(&h.steps);
        lv_obj_t *row = ui_row(slot, 16);
        lv_obj_set_width(row, 348);
        lv_obj_set_height(row, LV_SIZE_CONTENT);
        lv_obj_set_style_min_height(row, 80, 0);
        lv_obj_center(row);
        ui_style_card(row, done ? C_DONE : C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_set_style_pad_ver(row, 16, 0);
        lv_obj_set_style_pad_hor(row, 24, 0);
        lv_obj_set_user_data(row, (void *)(intptr_t)done);
        char num[8];
        snprintf(num, sizeof num, "%d.", i + 1);
        lv_obj_t *disc = ui_box(row);
        lv_obj_set_size(disc, 35, 35);
        ui_style_card(disc, C_HURRY, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_center(ui_label(disc, F_DETAIL, C_TEXT, num));
        lv_obj_t *l = ui_label(row, &font_pop600_24, C_ON_COLOR, v->step_text[i]);
        lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_line_space(l, -1, 0);                       /* 30 px lines, as Figma's 125% */
        lv_obj_set_style_max_height(l, 2 * lv_font_get_line_height(&font_pop600_24) - 1, 0);   /* two lines at most */
        lv_obj_set_flex_grow(l, 1);
        lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(row, on_step, LV_EVENT_CLICKED, (void *)(intptr_t)i);
        checkbox_create(row, 48, done);
    }
}

/* The first step not checked yet, from `from` on and round to the top; `from` when all are. */
static int steps_next(uint16_t ticked, int n, int from)
{
    for (int k = 0; k < n; k++) {
        int i = (from + k) % n;
        if (!(ticked & (1u << i))) return i;
    }
    return from;
}

/* The checklist as the view has it. A new list is built on its first step left. A step checked or
 * unchecked changes where it is (lime to mint and the box ticks, or back), then the wheel turns:
 * from a step checked on to the next one left (unless the one on the line is still to do), to a
 * step unchecked. */
static void steps_update(const home_view_t *v)
{
    int n = LV_MIN(v->steps_total, HOME_STEPS_MAX);
    uint16_t ticked = v->steps_ticked & (uint16_t)((1u << n) - 1);
    char sig[64];
    snprintf(sig, sizeof sig, "%d:%.40s", n, v->step_text[0]);
    if (strcmp(sig, h.steps_sig)) {
        snprintf(h.steps_sig, sizeof h.steps_sig, "%s", sig);
        h.steps_ticked = ticked;
        steps_build(v);
        wheel_list_focus(&h.steps, steps_next(ticked, n, 0), false);
        return;
    }
    uint16_t changed = ticked ^ h.steps_ticked;
    if (!changed) return;
    h.steps_ticked = ticked;
    int at = LV_CLAMP(0, wheel_list_current(&h.steps), n - 1), to = at;
    for (int i = 0; i < n; i++) {
        if (!(changed & (1u << i))) continue;
        lv_obj_t *slot = lv_obj_get_child(h.steps.list, i), *row = slot ? lv_obj_get_child(slot, 0) : NULL;
        if (!row) continue;
        bool on = ticked & (1u << i);
        lv_obj_set_user_data(row, (void *)(intptr_t)on);
        card_recolor(row, on ? C_ACTION : C_DONE, on ? C_DONE : C_ACTION, on ? 360 : 240);
        if (on) checkbox_tick(lv_obj_get_child(row, -1));
        else checkbox_untick(lv_obj_get_child(row, -1));
        if (!on) to = i;
        else if (ticked & (1u << at)) to = steps_next(ticked, n, i);
    }
    wheel_list_focus(&h.steps, at, false);   /* where it was, the faded rows restyled */
    if (to != at) wheel_list_turn(&h.steps, to, (changed & ticked) ? 380 : 120);
}

int home_steps_current(void)
{
    if (!h.steps_sig[0] || lv_obj_has_flag(h.steps.list, LV_OBJ_FLAG_HIDDEN)) return -1;
    return wheel_list_current(&h.steps);
}

void home_create(lv_obj_t *page, home_cb_t cb)
{
    memset(&h, 0, sizeof h);
    h.cb = cb;
    h.page = page;
    lv_obj_set_style_bg_color(page, COL(C_SCREEN), 0);

    /* the graphic: Biscuit's room */
    h.pet = pet_create(page, FULL_D);
    lv_obj_set_pos(h.pet, 0, 0);
    lv_obj_add_event_cb(h.pet, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_PET);
    lv_obj_add_event_cb(h.pet, on_pet_hold, LV_EVENT_ALL, NULL);
    h.graphic = GRAPHIC_FULL;
    h.pet_dim = -1;
    h.faint = faint_circle_create(page);

    /* free time: the activity wheel, the hub at (233, 238) */
    h.wheel = wheel_create(page, on_wheel);
    lv_obj_set_pos(h.wheel, 83, 88);

    /* running late: the message and the worm eating free time */
    h.overdue = ui_box(page);
    lv_obj_set_size(h.overdue, SCREEN_W, SCREEN_H);
    h.overdue_text = ui_label(h.overdue, F_MESSAGE, C_TEXT, "");
    lv_obj_set_style_text_align(h.overdue_text, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(h.overdue_text, LV_LABEL_LONG_WRAP);
    h.worm = ui_box(h.overdue);
    lv_obj_add_event_cb(h.worm, worm_draw, LV_EVENT_DRAW_MAIN, NULL);
    /* at the end: the empty mint ring (older), or the amber circle with what it's eating (younger) */
    h.worm_ring = ui_box(h.worm);
    lv_obj_set_style_radius(h.worm_ring, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_color(h.worm_ring, COL(C_DONE), 0);
    lv_obj_set_style_border_opa(h.worm_ring, LV_OPA_COVER, 0);
    h.worm_icon = ui_icon(h.worm_ring, "kite", 54, C_ON_COLOR);
    ui_icon_px(h.worm_icon, "kite", 54);
    lv_obj_center(h.worm_icon);
    snprintf(h.worm_icon_name, sizeof h.worm_icon_name, "kite");
    worm_layout(false);
    h.worm_timer = lv_timer_create(worm_tick, 40, NULL);
    lv_timer_pause(h.worm_timer);   /* until it's running late */

    /* Get ready: the checklist */
    wheel_list_create(page, &h.steps, 0, STEPS_Y, SCREEN_W, STEPS_H, STEPS_FOCUS - STEPS_Y, STEPS_ROW);
    h.steps.style = steps_style;
    /* Figma "Fade" over the top: black down to y 86, clear by 152, so the finished step slips under
     * the header and its pill instead of showing through them */
    h.steps_fade = top_fade_create(page, 86, 152);
    h.graphic = (home_graphic_t)-1;

    /* the younger child's step: one lime circle in the middle; a tap ticks it, like the button */
    h.step = ui_box(page);
    lv_obj_set_size(h.step, STEP_D, STEP_D);
    lv_obj_set_pos(h.step, CENTER - STEP_D / 2, CENTER - STEP_D / 2);
    ui_style_card(h.step, C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_bg_color(h.step, COL(C_TEXT), LV_STATE_PRESSED);
    lv_obj_add_flag(h.step, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.step, on_step_one, LV_EVENT_CLICKED, NULL);
    lv_obj_set_style_transform_pivot_x(h.step, STEP_D / 2, 0);
    lv_obj_set_style_transform_pivot_y(h.step, STEP_D / 2, 0);
    h.step_icon = ui_icon(h.step, "shirt", STEP_ICON, C_ON_COLOR);
    ui_icon_px(h.step_icon, "shirt", STEP_ICON);
    lv_obj_align(h.step_icon, LV_ALIGN_TOP_MID, 0, 210 - (CENTER - STEP_D / 2) - STEP_ICON / 2);   /* its middle at y 210 */
    h.step_name = ui_label(h.step, &font_pop600_24, C_ON_COLOR, "");
    lv_obj_set_width(h.step_name, 236);
    lv_obj_set_style_text_align(h.step_name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(h.step_name, LV_LABEL_LONG_WRAP);
    lv_obj_set_style_text_line_space(h.step_name, -1, 0);   /* Figma: 30 px lines */
    lv_obj_align(h.step_name, LV_ALIGN_TOP_MID, 0, 278 - (CENTER - STEP_D / 2));
    ui_show(h.step, false);
    h.step_shown = -1;

    /* the last two minutes: "1:46" (Montserrat SemiBold 96, amber) and "left" (Poppins Medium 32) */
    h.count = ui_label(page, &font_mon600_96, C_HURRY, "");
    lv_obj_set_width(h.count, 300);
    lv_obj_set_style_text_align(h.count, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.count, LV_ALIGN_TOP_MID, 0, 178);
    h.count_left = ui_label(page, &font_pop500_32, C_TEXT_MUTED, "left");
    lv_obj_align(h.count_left, LV_ALIGN_TOP_MID, 0, 261);
    ui_show(h.count, false);
    ui_show(h.count_left, false);

    h.scrim = scrim_create(page);
    h.timer = timer_create(page);
    /* the lime arc at 1 o'clock while the alarm sounds: the button there says I'm up; it breathes */
    h.cue = cue_create(page);
    cue_set(h.cue, 0, false);

    /* Biscuit can be tapped (free time): little stars twinkle about him, each in its own time (no
     * badge: the stars say it), clear of the header, the side buttons and the hill */
    h.tap_stars = ui_box(page);
    lv_obj_set_size(h.tap_stars, SCREEN_W, SCREEN_H);
    for (unsigned i = 0; i < sizeof STARS / sizeof STARS[0]; i++) {
        float ang = STARS[i].deg * 3.14159265f / 180.0f;
        int32_t r = TAP_D / 2 - 20, sz = STARS[i].size;
        lv_obj_t *s = ui_icon(h.tap_stars, "star-fill", sz, i % 2 ? C_TEXT : C_ACTION);
        lv_obj_set_pos(s, CENTER + (int32_t)(cosf(ang) * r) - sz / 2, TAP_CY + (int32_t)(sinf(ang) * r) - sz / 2);
        lv_image_set_pivot(s, sz / 2, sz / 2);
        twinkle_exec(s, 0);   /* they twinkle while they show (stars_twinkle) */
    }

    hill_create(page, &h.hill, on_hill);

    /* a note at y 322 (Figma "Note"): a step, a reminder, "2 to finish" */
    lime_card_create(page, &h.card, 0);
    lv_obj_add_flag(h.card.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.card.root, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CARD);

    bubble_create(page, &h.bubble);

    h.left = side_button_create(page, true, "star-line");
    lv_obj_add_event_cb(h.left, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_REWARDS);
    h.right = side_button_create(page, false, "house");   /* Figma: the house means Chores (its pill has it too) */
    lv_obj_add_event_cb(h.right, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CHORES);

    header_create(page, &h.hdr);
    lv_obj_add_flag(h.hdr.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.hdr.root, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_SPEAKER);

    /* the night clock on the dock (Figma "Night clock"): Big number 52 at y 30, "Charging · 52%" under
     * it, the alarm's pill low on the screen (y 365) */
    h.bigclock = ui_label(page, F_CLOCK, C_CLOCK, "");
    lv_obj_set_width(h.bigclock, 300);
    lv_obj_set_style_text_align(h.bigclock, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.bigclock, LV_ALIGN_TOP_MID, 0, 30);
    h.charging = ui_label(page, F_BODY_P, C_TEXT_MUTED, "");
    lv_obj_set_width(h.charging, 300);
    lv_obj_set_style_text_align(h.charging, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.charging, LV_ALIGN_TOP_MID, 0, 91);
    pill_create(page, &h.bigclock_pill);
}

lv_obj_t *home_pet(void) { return h.pet; }

void home_set_wheel(const char options[][20], int n) { wheel_set_options(h.wheel, options, n); }
void home_wheel_reset(void) { wheel_reset(h.wheel); }

/* The room changed size (full to the small circle, or back): it eases in from a touch smaller. */
static void room_scale(void *obj, int32_t v) { lv_obj_set_style_transform_scale(obj, v, 0); }
static void room_resized(void)
{
    lv_obj_set_style_transform_pivot_x(h.pet, lv_pct(50), 0);
    lv_obj_set_style_transform_pivot_y(h.pet, lv_pct(50), 0);
    lv_anim_delete(h.pet, room_scale);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, h.pet);
    lv_anim_set_exec_cb(&a, room_scale);
    lv_anim_set_values(&a, 230, 256);
    lv_anim_set_duration(&a, 420);
    lv_anim_set_early_apply(&a, true);
    lv_anim_set_path_cb(&a, ui_path_settle);
    lv_anim_start(&a);
}

static bool graphic_room(home_graphic_t g) { return g == GRAPHIC_FULL || g == GRAPHIC_SMALL || g == GRAPHIC_FADED || g == GRAPHIC_INSET; }

static void set_graphic(home_graphic_t g)
{
    bool room = graphic_room(g);
    ui_reveal(h.pet, room, 0);
    ui_reveal(h.faint, g == GRAPHIC_EMPTY, 0);
    ui_reveal(h.scrim, room && g != GRAPHIC_SMALL, 0);
    if (room && g != h.graphic) {
        int32_t d = g == GRAPHIC_SMALL ? SMALL_D : g == GRAPHIC_INSET ? INSET_D : FULL_D;
        int32_t xy = g == GRAPHIC_SMALL ? SMALL_XY : g == GRAPHIC_INSET ? INSET_XY : 0;
        bool small = g == GRAPHIC_SMALL || h.graphic == GRAPHIC_SMALL;
        if (lv_obj_get_width(h.pet) != d) {
            pet_set_size(h.pet, d);
            lv_obj_set_pos(h.pet, xy, xy);
            if (small && h.graphic != (home_graphic_t)-1) room_resized();   /* the room settles into its new size */
        }
    }
    if (room) h.graphic = g;
}

/* The younger child's step: the first one not ticked, in the circle. A step ticked: the next one
 * springs into its place. */
static void step_one_update(const home_view_t *v)
{
    int n = LV_MIN(v->steps_total, HOME_STEPS_MAX);
    uint16_t ticked = v->steps_ticked & (uint16_t)((1u << n) - 1);
    int at = -1;
    for (int i = 0; i < n; i++) if (!(ticked & (1u << i))) { at = i; break; }
    char sig[64];
    snprintf(sig, sizeof sig, "%d:%.40s", n, v->step_text[0]);
    bool fresh = strcmp(sig, h.step_sig) != 0;
    if (at < 0) {
        /* the last one ticked: the circle turns mint with a tick for the moment before the room
         * comes back */
        if (h.step_shown == -2) return;
        h.step_shown = -2;
        snprintf(h.step_sig, sizeof h.step_sig, "%s", sig);
        lv_obj_set_style_bg_color(h.step, COL(C_DONE), 0);
        ui_icon_px(h.step_icon, "check", STEP_ICON);
        lv_image_set_rotation(h.step_icon, 0);
        ui_set_text(h.step_name, "All done!");
        fx_ripple_from(h.step, STEP_D / 2, STEP_D / 2 + 60, C_DONE);
        fx_pop(h.step, 0);
        return;
    }
    if (!fresh && at == h.step_shown) return;
    bool moved_on = !fresh && h.step_shown != -1;
    snprintf(h.step_sig, sizeof h.step_sig, "%s", sig);
    h.step_shown = at;
    lv_obj_set_style_bg_color(h.step, COL(C_ACTION), 0);
    ui_icon_px(h.step_icon, v->step_icon[at][0] ? v->step_icon[at] : "check", STEP_ICON);
    lv_image_set_rotation(h.step_icon, strcmp(v->step_icon[at], "toothbrush") ? 0 : -450);   /* Figma's toothbrush stands on a slant */
    ui_set_text(h.step_name, v->step_text[at]);
    if (moved_on) {
        fx_ripple_from(h.step, STEP_D / 2, STEP_D / 2 + 60, C_DONE);
        fx_pop(h.step, 0);
    }
}

void home_render(const home_view_t *v)
{
    /* ---- the graphic ---- */
    home_graphic_t g = v->graphic;
    if (v->mid == MID_OVERDUE) g = GRAPHIC_NONE;   /* Figma Task · Running late: no room, no circle */
    else if (v->mid == MID_WHEEL || v->mid == MID_NONE || v->mid == MID_STEPS || v->mid == MID_STEP || v->mid == MID_COUNTDOWN) g = GRAPHIC_NONE;
    set_graphic(g);
    bool pet_on = graphic_room(g);
    pet_set_paused(h.pet, !pet_on);
    if (pet_on) {
        uint8_t fade = g == GRAPHIC_FADED ? 179 : v->room_fade;   /* Faded: the room at 30%, he stays solid */
        if (h.pet_dim != v->pet_dim || h.room_fade != fade) {
            pet_look_t look = pet_default_look(lv_obj_get_width(h.pet));
            look.dim = v->pet_dim;
            look.room_fade = fade;
            pet_set_look(h.pet, &look);
            h.pet_dim = v->pet_dim;
            h.room_fade = fade;
        }
        pet_set_mood(h.pet, v->mood);
        pet_set_activity(h.pet, v->activity);
        pet_force_clip(h.pet, v->force_clip);
        if (v->wake) pet_wake_up(h.pet);
    }
    ui_reveal(h.wheel, v->mid == MID_WHEEL, 16);
    wheel_set_pictures(h.wheel, v->picture);
    ui_reveal(h.steps.list, v->mid == MID_STEPS, 16);
    ui_reveal(h.steps_fade, v->mid == MID_STEPS, 0);
    if (v->mid == MID_STEPS) steps_update(v);
    else h.steps_sig[0] = 0;
    ui_reveal(h.step, v->mid == MID_STEP, 0);
    if (v->mid == MID_STEP) step_one_update(v);
    else { h.step_sig[0] = 0; h.step_shown = -1; }
    ui_reveal(h.count, v->mid == MID_COUNTDOWN, 0);
    ui_reveal(h.count_left, v->mid == MID_COUNTDOWN, 0);
    if (v->mid == MID_COUNTDOWN) ui_set_text(h.count, v->countdown);
    bool showing = !lv_obj_has_flag(h.overdue, LV_OBJ_FLAG_HIDDEN);
    if (v->mid != MID_OVERDUE && v->mood == PET_MOOD_SLEEP) ui_hide_now(h.overdue);   /* bedtime: no ghost of the late card */
    else ui_reveal(h.overdue, v->mid == MID_OVERDUE, 12);
    h.worm_on = v->mid == MID_OVERDUE;
    worm_run();
    if (v->mid == MID_OVERDUE) {
        ui_set_text(h.overdue_text, v->overdue_text);
        worm_layout(v->picture);
        const char *icon = v->worm_icon[0] ? v->worm_icon : "kite";
        if (strcmp(icon, h.worm_icon_name)) {
            snprintf(h.worm_icon_name, sizeof h.worm_icon_name, "%s", icon);
            ui_icon_px(h.worm_icon, icon, 54);
            lv_obj_center(h.worm_icon);
        }
        if (h.worm_eaten != v->worm_eaten) { h.worm_eaten = v->worm_eaten; lv_obj_invalidate(h.worm); }
        (void)showing;
    }
    ui_show(h.tap_stars, pet_on && v->tap_ring);
    stars_twinkle(pet_on && v->tap_ring);
    ui_show(h.cue, v->cue);
    cue_breathe(v->cue);
    if (v->cue) cue_set(h.cue, v->cue_ring, v->cue_dark);

    bool to_sleep = v->mood == PET_MOOD_SLEEP;   /* the night screen: what the day showed goes at once, no ghost of it */
    /* ---- the timer ---- */
    if (!v->timer_show && to_sleep) ui_hide_now(h.timer);
    else ui_reveal(h.timer, v->timer_show, 0);
    if (v->timer_show) timer_set(h.timer, v->timer_tone, v->timer_left, v->timer_pulse);

    /* ---- the header ---- */
    ui_reveal(h.hdr.root, !v->clock, -8);
    if (v->clock) ui_show(h.hdr.foot.root, false);
    ui_reveal(h.bigclock, v->clock, -8);
    ui_reveal(h.bigclock_pill.root, v->clock && v->status[0], -8);
    ui_reveal(h.charging, v->clock && v->note[0], -8);
    if (v->clock) {
        ui_set_text(h.bigclock, v->clock_text);
        ui_set_text(h.charging, v->note);
        pill_set(&h.bigclock_pill, PILL_NIGHT, v->status_icon, v->status);
        lv_obj_update_layout(h.bigclock_pill.root);
        lv_obj_align(h.bigclock_pill.root, LV_ALIGN_TOP_MID, 0, 365 + (38 - lv_obj_get_height(h.bigclock_pill.root)) / 2);
    } else {
        header_below_t below = v->late_chip ? HEADER_PILL
                             : (v->below == BELOW_TIME || v->below == BELOW_STATUS || v->below == BELOW_FREE) ? HEADER_PILL
                             : v->status[0] ? HEADER_TEXT : HEADER_NONE;
        pill_tone_t tone = v->late_chip ? PILL_LATE : v->pill_tone;
        const char *text = v->late_chip ? "Late" : v->status;
        h.hdr.tight = v->mid == MID_WHEEL && v->title[0];   /* free time's wheel: the title at the top, the pill clear of it */
        h.hdr.low = v->mid == MID_STEP;                     /* the younger one-step screens: the title down at y 54 */
        header_set_big(&h.hdr, v->title_big);
        header_set_sky(&h.hdr, v->sky);
        header_set_sky_tone(&h.hdr, v->timer_show ? timer_tone_color(v->timer_tone) : 0);   /* the icon in the timer's colour */
        header_set(&h.hdr, v->clock_line, v->title, below, tone, v->late_chip ? NULL : v->status_icon, text);
        if (strcmp(h.title_sig, v->title)) { snprintf(h.title_sig, sizeof h.title_sig, "%s", v->title); fx_slide(h.hdr.root, 10, 0); }   /* a new screen */
    }

    /* ---- the note ---- */
    bool card = (v->card != CARDPOS_NONE && v->mid != MID_STEPS) || (v->chores_left > 0 && pet_on);
    if (!card && to_sleep) ui_hide_now(h.card.root);
    else ui_reveal(h.card.root, card, 10);
    if (card) {
        if (v->card != CARDPOS_NONE) {
            lime_card_set(&h.card, v->card_icon[0] ? v->card_icon : NULL, v->card_text, v->card_end);
        } else {
            char n[32];
            snprintf(n, sizeof n, "%d chore%s left today", v->chores_left, v->chores_left == 1 ? "" : "s");   /* Figma Going out · At the event */
            lime_card_set(&h.card, "listchecks", n, CARD_END_NONE);
        }
        lv_obj_update_layout(h.card.root);
        lv_obj_align(h.card.root, LV_ALIGN_TOP_MID, 0, v->card != CARDPOS_NONE && v->card_end == CARD_END_BUTTON ? NOTE_BUTTON_Y : NOTE_Y);
    }

    /* ---- Biscuit's words: beside his head, under whatever the header shows ---- */
    const char *say = v->say[0] ? v->say : v->say_top;
    if (say[0] && pet_on) {
        int32_t below = 128;
        if (!v->clock) {
            lv_obj_update_layout(h.hdr.root);
            below = lv_obj_get_y(h.hdr.root) + lv_obj_get_height(h.hdr.root);
        }
        bubble_set_speaker(&h.bubble, v->picture);   /* the younger child's: said out loud */
        bubble_say_pet(&h.bubble, say, below, v->sides ? 206 : SCREEN_H);
    } else bubble_hide(&h.bubble);

    /* ---- the hill ---- */
    h.bottom = v->bottom;
    switch (v->bottom) {
    case BOTTOM_GAMES:   /* the free-time wheel (Figma Free time · Spin): one Games button, no curve; the younger child's is the round game pad */
        if (v->picture) hill_set_round(&h.hill, "game");
        else hill_set_button(&h.hill, NULL, "Games");
        break;
    case BOTTOM_NEXT: hill_set_next(&h.hill, v->next_icon, v->next_title, v->picture ? "" : v->next_time); break;   /* younger: no times */
    case BOTTOM_NOTE: hill_set_text(&h.hill, v->note); break;
    case BOTTOM_PLAY:
    case BOTTOM_WHEEL: hill_set_switch(&h.hill, v->bottom == BOTTOM_PLAY); break;
    default: hill_set_empty(&h.hill); break;
    }
    hill_set_dots(&h.hill, v->dots ? 1 : -1);

    /* ---- the side buttons (the younger child's are bigger) ---- */
    side_button_set_big(h.left, v->picture, "star-line");
    side_button_set_big(h.right, v->picture, "house");
    ui_reveal(h.left, v->sides, 0);
    ui_reveal(h.right, v->sides && !v->rewards_only, 0);
}

/* The page is `t` screens from the middle of the carousel: the room hangs back a little and the
 * header, the side buttons and the hill lead, so the turn has depth. */
void home_parallax(float t)
{
    int32_t back = (int32_t)lroundf(-t * SCREEN_W * 0.10f), front = (int32_t)lroundf(t * SCREEN_W * 0.08f);
    lv_obj_t *backs[] = { h.pet, h.faint, h.scrim, h.wheel };
    lv_obj_t *fronts[] = { h.hdr.root, h.left, h.right, h.hill.root, h.card.root, h.bubble.root, h.bubble.tail };
    for (size_t i = 0; i < sizeof backs / sizeof *backs; i++) if (lv_obj_get_style_translate_x(backs[i], 0) != back) lv_obj_set_style_translate_x(backs[i], back, 0);
    for (size_t i = 0; i < sizeof fronts / sizeof *fronts; i++) if (lv_obj_get_style_translate_x(fronts[i], 0) != front) lv_obj_set_style_translate_x(fronts[i], front, 0);
}

/* A little joy on the day's wins. Done: the burst, "Done!" springs in, Biscuit's hops throw sparks.
 * The whole day or an event ready: bigger, with the halo rings. Hello (I'm up, welcome home): a
 * hop and twinkles. */
void home_celebrate(home_fx_t kind)
{
    if (!h.page) return;
    static const uint32_t HALO[3] = { C_ACTION, C_CARROT, C_SYSTEM };
    static const lv_opa_t FULL[3] = { LV_OPA_COVER, LV_OPA_COVER, LV_OPA_COVER };
    fx_burst_cfg_t cfg = { .burst_at = 0, .flash_r = 200, .waves = 2, .rays = false };
    switch (kind) {
    case HOME_FX_DONE:
        fx_burst_create(h.page, CENTER, CENTER, &cfg);
        fx_confetti(h.page, CENTER, CENTER, 60, FX_PARTY, 6, 240);
        fx_jolt(h.page, 5, 800, 0);
        fx_spring(h.hdr.pill.root, 80);
        break;
    case HOME_FX_BIG:
        cfg.flash_r = 290;
        cfg.waves = 3;
        cfg.rays = true;
        fx_burst_create(h.page, CENTER, CENTER, &cfg);
        fx_confetti(h.page, CENTER, CENTER, 110, FX_PARTY, 6, 300);
        fx_jolt(h.page, 6, 900, 0);
        fx_halo(h.page, HALO, FULL, 160, 3000);
        fx_spring(h.hdr.pill.root, 80);
        break;
    default:
        fx_twinkle(h.page, CENTER, CENTER, 150, 6, 0, 2600);
        pet_react(h.pet, PET_CLIP_CELEBRATE);
        break;
    }
}
