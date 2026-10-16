#include "home.h"
#include "fx.h"
#include "wheel.h"
#include <stdio.h>
#include <string.h>

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
#define NOTE_Y 322

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
    lime_card_t card;
    bubble_t bubble;
    uint8_t worm_eaten;
    char title_sig[48];
    home_graphic_t graphic;
    int16_t pet_dim;          /* the look last given to the pet (-1: none yet) */
} h;

static void fire(lv_event_t *e) { if (h.cb) h.cb((home_event_t)(intptr_t)lv_event_get_user_data(e), 0); }
static void on_wheel(int idx) { if (h.cb) h.cb(HOME_WHEEL_RESULT, idx); }

static void on_hill(hill_tap_t tap)
{
    if (!h.cb) return;
    switch (tap) {
    case HILL_TAP_NEXT: h.cb(HOME_TAP_NEXT, 0); break;
    case HILL_TAP_SPIN: h.cb(HOME_TAP_WHEEL, 0); break;
    case HILL_TAP_PLAY: h.cb(HOME_TAP_PLAY, 0); break;
    case HILL_TAP_BUTTON: h.cb(HOME_TAP_CARD, 0); break;
    }
}

/* The worm crawls right as it eats the five mint free-time dots, towards the empty mint ring. */
static void worm_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    float wx = c.x1 + h.worm_eaten * 13.0f;
    d.bg_color = COL(C_LATE);
    for (int j = 0; j < 10; j++)
        for (int i = 0; WORM[j][i]; i++) {
            if (WORM[j][i] != '#') continue;
            int32_t x0 = (int32_t)(wx + i * 3.8f), y0 = (int32_t)(c.y1 + 4 + j * 3.8f);
            int32_t x1 = (int32_t)(wx + (i + 1) * 3.8f) - 1, y1 = (int32_t)(c.y1 + 4 + (j + 1) * 3.8f) - 1;
            lv_area_t a = { x0, y0, x1, y1 };
            lv_draw_rect(layer, &d, &a);
        }
    d.radius = LV_RADIUS_CIRCLE;
    for (int k = 0; k < 5; k++) {
        bool eaten = k < h.worm_eaten;
        if (eaten && k < h.worm_eaten - 1) continue;   /* the worm sits on them */
        d.bg_color = COL(eaten ? C_CHIP : C_DONE);
        int32_t x = c.x1 + 93 + k * 13, y = c.y1 + 20;
        lv_area_t a = { x, y, x + 6, y + 6 };
        lv_draw_rect(layer, &d, &a);
    }
    /* the free time still left: an empty mint ring */
    d.bg_opa = LV_OPA_TRANSP;
    d.border_color = COL(C_DONE);
    d.border_width = 2;
    d.border_opa = LV_OPA_COVER;
    lv_area_t r = { c.x1 + 170, c.y1 + 1, c.x1 + 213, c.y1 + 44 };
    lv_draw_rect(layer, &d, &r);
}

static void ring_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }

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
    lv_obj_set_width(h.overdue_text, 220);
    lv_obj_set_style_text_align(h.overdue_text, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.overdue_text, LV_ALIGN_TOP_MID, 0, 178);
    h.worm = ui_box(h.overdue);
    lv_obj_set_size(h.worm, 214, 46);
    lv_obj_set_pos(h.worm, 126, 252);
    lv_obj_add_event_cb(h.worm, worm_draw, LV_EVENT_DRAW_MAIN, NULL);

    h.scrim = scrim_create(page);
    h.timer = timer_create(page);

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
    h.right = side_button_create(page, false, "list");
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

static void set_graphic(home_graphic_t g)
{
    bool room = g == GRAPHIC_FULL || g == GRAPHIC_SMALL;
    ui_show(h.pet, room);
    ui_show(h.faint, g == GRAPHIC_EMPTY);
    ui_show(h.scrim, g == GRAPHIC_FULL);
    if (room && g != h.graphic) {
        int32_t d = g == GRAPHIC_FULL ? FULL_D : SMALL_D, xy = g == GRAPHIC_FULL ? 0 : SMALL_XY;
        pet_set_size(h.pet, d);
        lv_obj_set_pos(h.pet, xy, xy);
    }
    if (room) h.graphic = g;
}

void home_render(const home_view_t *v)
{
    /* ---- the graphic ---- */
    home_graphic_t g = v->graphic;
    if (v->mid == MID_OVERDUE) g = GRAPHIC_EMPTY;
    else if (v->mid == MID_WHEEL || v->mid == MID_NONE) g = GRAPHIC_NONE;
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
    ui_show(h.wheel, v->mid == MID_WHEEL);
    ui_show(h.overdue, v->mid == MID_OVERDUE);
    if (v->mid == MID_OVERDUE) {
        ui_set_text(h.overdue_text, v->overdue_text);
        if (h.worm_eaten != v->worm_eaten) { h.worm_eaten = v->worm_eaten; lv_obj_invalidate(h.worm); }
    }
    ui_show(h.tap_in, pet_on && v->tap_ring);
    ui_show(h.tap_out, pet_on && v->tap_ring);

    /* ---- the timer ---- */
    ui_show(h.timer, v->timer_show);
    if (v->timer_show) timer_set(h.timer, v->timer_tone, v->timer_left, v->timer_pulse);

    /* ---- the header ---- */
    ui_show(h.hdr.root, !v->clock);
    ui_show(h.bigclock, v->clock);
    ui_show(h.bigclock_pill.root, v->clock && v->status[0]);
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
        header_set(&h.hdr, v->clock_line, v->hide_title ? NULL : v->title, below, tone, v->status_icon, text);
        if (strcmp(h.title_sig, v->title)) { snprintf(h.title_sig, sizeof h.title_sig, "%s", v->title); fx_slide(h.hdr.root, 10, 0); }   /* a new screen */
    }

    /* ---- the note ---- */
    bool card = v->card != CARDPOS_NONE || (v->chores_left > 0 && pet_on);
    ui_show(h.card.root, card);
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

    /* ---- Biscuit's words ---- */
    const char *say = v->say[0] ? v->say : v->say_top;
    if (say[0] && pet_on) bubble_say_pet(&h.bubble, say);
    else bubble_hide(&h.bubble);

    /* ---- the hill ---- */
    switch (v->bottom) {
    case BOTTOM_NEXT: hill_set_next(&h.hill, v->next_icon, v->next_title, v->next_time); break;
    case BOTTOM_NOTE: hill_set_text(&h.hill, v->note); break;
    case BOTTOM_PLAY:
    case BOTTOM_WHEEL: hill_set_switch(&h.hill, v->bottom == BOTTOM_PLAY); break;
    default: hill_set_empty(&h.hill); break;
    }
    hill_set_dots(&h.hill, v->dots ? 1 : -1);

    /* ---- the side buttons ---- */
    ui_show(h.left, v->sides);
    ui_show(h.right, v->sides && !v->rewards_only);
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
