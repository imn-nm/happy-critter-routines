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

/* MyToki 2 (Figma "Graphic"): the room fills the 466 screen, or sits in the 298 circle at (84, 84). */
#define FULL_D SCREEN_W
#define SMALL_D 298
#define SMALL_XY 84
#define NOTE_Y 311
/* the Get ready checklist: rows 59 apart round the centre line */
#define STEPS_Y 100
#define STEPS_H 268
#define STEPS_ROW 87          /* row centres 145, 232, 319 (Figma) */
#define STEPS_FOCUS 232

static struct {
    home_cb_t cb;
    lv_obj_t *page, *pet, *faint, *wheel, *scrim, *timer;
    lv_obj_t *overdue, *overdue_text, *worm;
    lv_obj_t *tap_in, *tap_out;
    lv_obj_t *left, *right;
    lv_obj_t *bigclock;
    pill_t bigclock_pill;
    header_t hdr;
    hill_t hill;
    home_bottom_t bottom;
    wheel_list_t steps;
    lv_obj_t *steps_fade;
    lv_obj_t *cue;
    char steps_sig[64];
    int8_t steps_at;
    lime_card_t card;
    bubble_t bubble;
    uint8_t worm_eaten;
    float worm_x, worm_phase;
    lv_obj_t *worm_ring, *worm_icon;
    char worm_icon_name[20];
    lv_timer_t *worm_timer;
    char title_sig[48];
    home_graphic_t graphic;
    int16_t pet_dim;          /* the look last given to the pet (-1: none yet) */
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

/* The worm row (Figma "Free time eaten"): the worm, five mint dots of free time, and a mint ring at
 * the end holding what it's eating (the kite for free time, or the task it is taking time from).
 * It crawls: its humps ripple from tail to head, the head bobs as it munches, the dot in front of it
 * shrinks with each bite, and it slides forward a dot at a time as the time goes. */
#define WORM_CELL 3.8f
#define WORM_COLS 23
#define DOT_STEP 14
#define DOTS_X 98          /* the first dot, from the row's left */
#define RING_D 46
#define ROW_W 230
#define ROW_H 50
#define WORM_PERIOD_MS 1400

static float worm_x(int eaten) { return (float)(eaten * DOT_STEP); }

static void worm_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    const float ph = h.worm_phase * 6.2831853f;
    const float wx = c.x1 + h.worm_x;
    const float wy = c.y1 + (ROW_H - 10 * WORM_CELL) / 2.0f + 2;
    d.bg_color = COL(C_LATE);
    for (int i = 0; i < WORM_COLS; i++) {
        /* the body (columns 0..14) ripples in a wave from the tail; the head bobs */
        float dy = i < 15 ? -2.6f * fmaxf(0.0f, sinf(ph - i * 0.42f)) : 1.4f * sinf(ph * 2.0f);
        for (int j = 0; j < 10; j++) {
            if (WORM[j][i] != '#') continue;
            float x0 = wx + i * WORM_CELL, y0 = wy + j * WORM_CELL + dy;
            lv_area_t a = { (int32_t)x0, (int32_t)y0, (int32_t)(x0 + WORM_CELL) - 1, (int32_t)(y0 + WORM_CELL) - 1 };
            lv_draw_rect(layer, &d, &a);
        }
    }
    /* the dots it hasn't reached; the one at its mouth shrinks bite by bite */
    d.radius = LV_RADIUS_CIRCLE;
    const float mouth = h.worm_x + WORM_COLS * WORM_CELL;
    for (int k = 0; k < 5; k++) {
        float cx = DOTS_X + k * DOT_STEP + 3.5f;
        if (k < h.worm_eaten || cx < mouth - 2) continue;   /* eaten, or under its head */
        float r = 3.5f;
        if (cx < mouth + DOT_STEP) r *= 0.55f + 0.45f * (0.5f + 0.5f * cosf(ph * 2.0f));
        d.bg_color = COL(C_DONE);
        lv_area_t a = { (int32_t)(c.x1 + cx - r), (int32_t)(c.y1 + ROW_H / 2 - r), (int32_t)(c.x1 + cx + r), (int32_t)(c.y1 + ROW_H / 2 + r) };
        lv_draw_rect(layer, &d, &a);
    }
}

/* Every 40 ms while the worm shows: the crawl, and the slide to where it has eaten up to. */
static void worm_tick(lv_timer_t *t)
{
    (void)t;
    if (!h.worm || lv_obj_has_flag(h.overdue, LV_OBJ_FLAG_HIDDEN)) return;
    h.worm_phase += 40.0f / WORM_PERIOD_MS;
    if (h.worm_phase >= 1.0f) h.worm_phase -= 1.0f;
    float to = worm_x(h.worm_eaten);
    h.worm_x += (to - h.worm_x) * 0.08f;
    if (fabsf(to - h.worm_x) < 0.2f) h.worm_x = to;
    lv_obj_invalidate(h.worm);
}

/* The message and the worm row as one block, centred in the screen with a steady gap. */
static void worm_layout(void)
{
    lv_obj_update_layout(h.overdue_text);
    int32_t th = lv_obj_get_height(h.overdue_text), gap = 30;
    int32_t top = CENTER - (th + gap + ROW_H) / 2 - 8;
    lv_obj_set_y(h.overdue_text, top);
    lv_obj_set_y(h.worm, top + th + gap);
}

static void ring_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }

/* Figma Going out · Get ready (Step rows): the step now is a lime row 348 wide, fully round, on the
 * centre line; the one above (done, mint) shows at 30%, the one below (lime) at 50%, both 0.865 the
 * size; further ones fade out. A black fade over the top row lets it slip under the header. */
static void steps_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), near = fminf(ad, 1.0f), far = fmaxf(0.0f, ad - 1.0f);
    float base = (intptr_t)lv_obj_get_user_data(card) ? 0.30f : 0.50f;
    float opa = (1.0f - (1.0f - base) * near) * fmaxf(0.0f, 1.0f - far / 0.6f);
    int32_t s = (int32_t)(256 * (1.0f - 0.135f * near - 0.05f * far));
    if (lv_obj_get_style_transform_scale_x(card, 0) != s) lv_obj_set_style_transform_scale(card, s, 0);
    lv_opa_t o = (lv_opa_t)(255 * opa);
    if (lv_obj_get_style_opa_layered(card, 0) != o) lv_obj_set_style_opa_layered(card, o, 0);   /* the row fades as one, like Figma */
}

/* Figma "Step": 348 wide, 12 / 16 padding, gap 8: "2." (Detail 20), the step (Pill 24, up to two
 * lines of 30), the Checkbox (48). 72 high with one line, 84 with two. */
static void steps_build(const home_view_t *v, int just)
{
    wheel_list_clear(&h.steps);
    for (int i = 0; i < v->steps_total && i < HOME_STEPS_MAX; i++) {
        bool done = i < v->steps_done;
        lv_obj_t *slot = wheel_list_add(&h.steps);
        lv_obj_t *row = ui_row(slot, 8);
        lv_obj_set_width(row, 348);
        lv_obj_set_height(row, LV_SIZE_CONTENT);
        lv_obj_set_style_min_height(row, 72, 0);
        lv_obj_center(row);
        ui_style_card(row, done ? C_DONE : C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_set_style_pad_ver(row, 12, 0);
        lv_obj_set_style_pad_hor(row, 16, 0);
        lv_obj_set_style_transform_pivot_x(row, lv_pct(50), 0);
        lv_obj_set_style_transform_pivot_y(row, lv_pct(50), 0);
        lv_obj_set_user_data(row, (void *)(intptr_t)done);
        char num[8];
        snprintf(num, sizeof num, "%d.", i + 1);
        ui_label(row, F_DETAIL, C_ON_COLOR, num);
        lv_obj_t *l = ui_label(row, F_PILL, C_ON_COLOR, v->step_text[i]);
        lv_label_set_long_mode(l, LV_LABEL_LONG_WRAP);
        lv_obj_set_style_text_line_space(l, -2, 0);                       /* 30 px lines, as Figma's 125% */
        lv_obj_set_style_max_height(l, 2 * lv_font_get_line_height(F_PILL) - 2, 0);   /* two lines at most */
        lv_obj_set_flex_grow(l, 1);
        if (i == v->steps_done) {   /* the step now: a tap ticks it, like the button */
            lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_event_cb(row, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_STEP);
        }
        lv_obj_t *box = checkbox_create(row, 48, done && i != just);
        if (i == just) {   /* the step just ticked: lime to mint, the box ticks, before the wheel turns */
            card_recolor(row, C_ACTION, C_DONE, 360);
            checkbox_tick(box);
        }
    }
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
    lv_obj_set_width(h.overdue_text, 290);
    lv_obj_set_style_text_align(h.overdue_text, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.overdue_text, LV_ALIGN_TOP_MID, 0, 178);
    h.worm = ui_box(h.overdue);
    lv_obj_set_size(h.worm, ROW_W, ROW_H);
    lv_obj_set_pos(h.worm, CENTER - ROW_W / 2, 252);
    lv_obj_add_event_cb(h.worm, worm_draw, LV_EVENT_DRAW_MAIN, NULL);
    /* the ring at the end: what it's eating */
    h.worm_ring = ui_box(h.worm);
    lv_obj_set_size(h.worm_ring, RING_D, RING_D);
    lv_obj_set_pos(h.worm_ring, ROW_W - RING_D, (ROW_H - RING_D) / 2);
    lv_obj_set_style_radius(h.worm_ring, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.worm_ring, 2, 0);
    lv_obj_set_style_border_color(h.worm_ring, COL(C_DONE), 0);
    lv_obj_set_style_border_opa(h.worm_ring, LV_OPA_COVER, 0);
    h.worm_icon = ui_icon(h.worm_ring, "kite", 24, C_DONE);
    lv_obj_center(h.worm_icon);
    snprintf(h.worm_icon_name, sizeof h.worm_icon_name, "kite");
    h.worm_timer = lv_timer_create(worm_tick, 40, NULL);

    /* Get ready: the checklist */
    wheel_list_create(page, &h.steps, 0, STEPS_Y, SCREEN_W, STEPS_H, STEPS_FOCUS - STEPS_Y, STEPS_ROW);
    h.steps.style = steps_style;
    /* Figma "Fade" over the top row: black down past the header's pill (y 131), clear by the top of
     * the row on the line (y 196), so the finished step slips under the header instead of showing
     * through it */
    h.steps_fade = ui_box(page);
    lv_obj_set_pos(h.steps_fade, 59, STEPS_Y);
    lv_obj_set_size(h.steps_fade, 348, 96);
    static lv_grad_dsc_t fade;
    fade.dir = LV_GRAD_DIR_VER;
    fade.stops_count = 2;
    fade.stops[0].color = COL(C_SCREEN); fade.stops[0].opa = LV_OPA_COVER; fade.stops[0].frac = 90;    /* y 134 */
    fade.stops[1].color = COL(C_SCREEN); fade.stops[1].opa = LV_OPA_TRANSP; fade.stops[1].frac = 255;
    lv_obj_set_style_bg_grad(h.steps_fade, &fade, 0);
    lv_obj_set_style_bg_opa(h.steps_fade, LV_OPA_COVER, 0);
    h.steps_at = -1;
    h.graphic = (home_graphic_t)-1;

    h.scrim = scrim_create(page);
    h.timer = timer_create(page);
    /* the lime arc at 1 o'clock while the alarm sounds: the button there says I'm up; it breathes */
    h.cue = cue_create(page);
    cue_set(h.cue, 0, false);
    lv_anim_t ca;
    lv_anim_init(&ca);
    lv_anim_set_var(&ca, h.cue);
    lv_anim_set_exec_cb(&ca, ring_opa);
    lv_anim_set_values(&ca, 255, 110);
    lv_anim_set_duration(&ca, 700);
    lv_anim_set_playback_duration(&ca, 700);
    lv_anim_set_repeat_count(&ca, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&ca);

    /* Biscuit can be tapped: a lime ring and a ripple that pulses out (Figma "Tap ring", 260 here) */
    h.tap_out = ui_box(page);
    lv_obj_set_size(h.tap_out, 272, 272);
    lv_obj_set_pos(h.tap_out, CENTER - 136, 252 - 136);
    lv_obj_set_style_radius(h.tap_out, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.tap_out, 2, 0);
    lv_obj_set_style_border_color(h.tap_out, COL(C_ACTION), 0);
    lv_obj_set_style_border_opa(h.tap_out, LV_OPA_COVER, 0);
    h.tap_in = ui_box(page);
    lv_obj_set_size(h.tap_in, 260, 260);
    lv_obj_set_pos(h.tap_in, CENTER - 130, 252 - 130);
    lv_obj_set_style_radius(h.tap_in, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.tap_in, 3, 0);
    lv_obj_set_style_border_color(h.tap_in, COL(C_ACTION), 0);
    lv_obj_set_style_border_opa(h.tap_in, LV_OPA_COVER, 0);
    lv_obj_t *badge = ui_box(h.tap_in);
    lv_obj_set_size(badge, 40, 40);
    lv_obj_set_pos(badge, 196, 196);
    ui_style_card(badge, C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_t *hand = ui_icon(badge, "hand", 24, C_ON_COLOR);
    lv_obj_center(hand);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, h.tap_out);
    lv_anim_set_exec_cb(&a, ring_opa);
    lv_anim_set_values(&a, 140, 20);
    lv_anim_set_duration(&a, 900);
    lv_anim_set_playback_duration(&a, 900);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&a);

    hill_create(page, &h.hill, on_hill);

    /* a note at y 322 (Figma "Note"): a step, a reminder, "2 to finish" */
    lime_card_create(page, &h.card, 0);
    lv_obj_add_flag(h.card.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.card.root, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CARD);

    bubble_create(page, &h.bubble);

    h.left = side_button_create(page, true, "star-line");
    lv_obj_add_event_cb(h.left, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_REWARDS);
    h.right = side_button_create(page, false, "listchecks");   /* the same icon as the Chores pill */
    lv_obj_add_event_cb(h.right, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CHORES);

    header_create(page, &h.hdr);
    lv_obj_add_flag(h.hdr.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.hdr.root, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_SPEAKER);

    /* the night clock on the dock: Big number 52 at y 30, the wake-up pill under it */
    h.bigclock = ui_label(page, F_CLOCK, C_TEXT, "");
    lv_obj_set_width(h.bigclock, 300);
    lv_obj_set_style_text_align(h.bigclock, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.bigclock, LV_ALIGN_TOP_MID, 0, 30);
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

static void set_graphic(home_graphic_t g)
{
    bool room = g == GRAPHIC_FULL || g == GRAPHIC_SMALL;
    ui_reveal(h.pet, room, 0);
    ui_reveal(h.faint, g == GRAPHIC_EMPTY, 0);
    ui_reveal(h.scrim, g == GRAPHIC_FULL, 0);
    if (room && g != h.graphic) {
        int32_t d = g == GRAPHIC_FULL ? FULL_D : SMALL_D, xy = g == GRAPHIC_FULL ? 0 : SMALL_XY;
        pet_set_size(h.pet, d);
        lv_obj_set_pos(h.pet, xy, xy);
        if (h.graphic != (home_graphic_t)-1) room_resized();   /* the room settles into its new size */
    }
    if (room) h.graphic = g;
}

void home_render(const home_view_t *v)
{
    /* ---- the graphic ---- */
    home_graphic_t g = v->graphic;
    if (v->mid == MID_OVERDUE) g = GRAPHIC_EMPTY;
    else if (v->mid == MID_WHEEL || v->mid == MID_NONE || v->mid == MID_STEPS) g = GRAPHIC_NONE;
    set_graphic(g);
    bool pet_on = g == GRAPHIC_FULL || g == GRAPHIC_SMALL;
    pet_set_paused(h.pet, !pet_on);
    if (pet_on) {
        if (h.pet_dim != v->pet_dim) {
            pet_look_t look = pet_default_look(lv_obj_get_width(h.pet));
            look.dim = v->pet_dim;
            pet_set_look(h.pet, &look);
            h.pet_dim = v->pet_dim;
        }
        pet_set_mood(h.pet, v->mood);
        pet_set_activity(h.pet, v->activity);
        pet_force_clip(h.pet, v->force_clip);
        if (v->wake) pet_wake_up(h.pet);
    }
    ui_reveal(h.wheel, v->mid == MID_WHEEL, 16);
    ui_reveal(h.steps.list, v->mid == MID_STEPS, 16);
    ui_reveal(h.steps_fade, v->mid == MID_STEPS, 0);
    if (v->mid == MID_STEPS) {
        char sig[64];
        snprintf(sig, sizeof sig, "%d/%d:%.40s", v->steps_done, v->steps_total, v->step_text[0]);
        bool fresh = strcmp(sig, h.steps_sig) != 0;
        if (fresh) {
            bool next_step = h.steps_at >= 0 && v->steps_done == h.steps_at + 1;
            snprintf(h.steps_sig, sizeof h.steps_sig, "%s", sig);
            steps_build(v, next_step ? h.steps_at : -1);
            /* a step ticked: it ticks on the line, then the wheel turns to the next one */
            wheel_list_focus(&h.steps, next_step ? h.steps_at : v->steps_done, false);
            if (next_step) wheel_list_turn(&h.steps, v->steps_done, 380);
            h.steps_at = v->steps_done;
        }
    } else if (h.steps_sig[0]) {
        h.steps_sig[0] = 0;
        h.steps_at = -1;
    }
    bool showing = !lv_obj_has_flag(h.overdue, LV_OBJ_FLAG_HIDDEN);
    ui_reveal(h.overdue, v->mid == MID_OVERDUE, 12);
    if (v->mid == MID_OVERDUE) {
        ui_set_text(h.overdue_text, v->overdue_text);
        worm_layout();
        const char *icon = v->worm_icon[0] ? v->worm_icon : "kite";
        if (strcmp(icon, h.worm_icon_name)) {
            snprintf(h.worm_icon_name, sizeof h.worm_icon_name, "%s", icon);
            ui_icon_set(h.worm_icon, icon, 24);
            lv_obj_center(h.worm_icon);
        }
        if (h.worm_eaten != v->worm_eaten) {
            h.worm_eaten = v->worm_eaten;
            if (!showing) h.worm_x = worm_x(h.worm_eaten);   /* coming on: start where it is, no slide */
        }
    }
    ui_show(h.tap_in, pet_on && v->tap_ring);
    ui_show(h.tap_out, pet_on && v->tap_ring);
    ui_show(h.cue, v->cue);
    if (v->cue) cue_set(h.cue, v->cue_ring, v->cue_dark);

    /* ---- the timer ---- */
    ui_reveal(h.timer, v->timer_show, 0);
    if (v->timer_show) timer_set(h.timer, v->timer_tone, v->timer_left, v->timer_pulse);

    /* ---- the header ---- */
    ui_reveal(h.hdr.root, !v->clock, -8);
    ui_reveal(h.bigclock, v->clock, -8);
    ui_reveal(h.bigclock_pill.root, v->clock && v->status[0], -8);
    if (v->clock) {
        ui_set_text(h.bigclock, v->clock_text);
        pill_set(&h.bigclock_pill, PILL_NIGHT, v->status_icon, v->status);
        lv_obj_update_layout(h.bigclock_pill.root);
        lv_obj_align(h.bigclock_pill.root, LV_ALIGN_TOP_MID, 0, 100);
    } else {
        header_below_t below = v->late_chip ? HEADER_PILL
                             : (v->below == BELOW_TIME || v->below == BELOW_STATUS || v->below == BELOW_FREE) ? HEADER_PILL
                             : v->status[0] ? HEADER_TEXT : HEADER_NONE;
        pill_tone_t tone = v->late_chip ? PILL_LATE : v->pill_tone;
        const char *text = v->late_chip ? "Late" : v->status;
        header_set(&h.hdr, v->clock_line, v->hide_title ? NULL : v->title, below, tone, v->late_chip ? NULL : v->status_icon, text);
        if (strcmp(h.title_sig, v->title)) { snprintf(h.title_sig, sizeof h.title_sig, "%s", v->title); fx_slide(h.hdr.root, 10, 0); }   /* a new screen */
    }

    /* ---- the note ---- */
    bool card = (v->card != CARDPOS_NONE && v->mid != MID_STEPS) || (v->chores_left > 0 && pet_on);
    ui_reveal(h.card.root, card, 10);
    if (card) {
        if (v->card != CARDPOS_NONE) {
            lime_card_set(&h.card, v->card_icon[0] ? v->card_icon : NULL, v->card_text, v->card_end);
            if (v->steps_total > 0) lime_card_set_steps(&h.card, v->steps_total, v->steps_done);
        } else {
            char n[24];
            snprintf(n, sizeof n, "%d to finish", v->chores_left);
            lime_card_set(&h.card, "listchecks", n, CARD_END_NONE);
        }
        lv_obj_update_layout(h.card.root);
        lv_obj_align(h.card.root, LV_ALIGN_TOP_MID, 0, NOTE_Y);
    }

    /* ---- Biscuit's words: beside his head, under whatever the header shows ---- */
    const char *say = v->say[0] ? v->say : v->say_top;
    if (say[0] && pet_on) {
        int32_t below = 128;
        if (!v->clock) {
            lv_obj_update_layout(h.hdr.root);
            below = lv_obj_get_y(h.hdr.root) + lv_obj_get_height(h.hdr.root);
        }
        bubble_say_pet(&h.bubble, say, below, v->sides ? 206 : SCREEN_H);
    } else bubble_hide(&h.bubble);

    /* ---- the hill ---- */
    h.bottom = v->bottom;
    switch (v->bottom) {
    case BOTTOM_GAMES:   /* the free-time wheel (Figma Free time · Spin): one Games button, no curve, no dots */
        hill_set_button(&h.hill, NULL, "Games");
        break;
    case BOTTOM_NEXT: hill_set_next(&h.hill, v->next_icon, v->next_title, v->next_time); break;
    case BOTTOM_NOTE: hill_set_text(&h.hill, v->note); break;
    case BOTTOM_PLAY:
    case BOTTOM_WHEEL: hill_set_switch(&h.hill, v->bottom == BOTTOM_PLAY); break;
    default: hill_set_empty(&h.hill); break;
    }
    hill_set_dots(&h.hill, v->dots ? 1 : -1);

    /* ---- the side buttons ---- */
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
