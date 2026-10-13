#include "home.h"
#include "fx.h"
#include "wheel.h"
#include <stdio.h>
#include <string.h>

/* The worm from Figma "Worm · LED" (Running over): coral LED dots, 3.8 px apart. */
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

/* Figma 609:2719 (2026-10-12): the scene is a 286 px circle at (90, 90); the ring's dots sit 156 px out. */
#define SCENE_D 286
#define SCENE_XY 90
#define RING_R 156

static struct {
    home_cb_t cb;
    lv_obj_t *page, *pet, *ring, *wheel;
    lv_obj_t *icon, *title, *status, *late, *clock, *status_pill;
    lv_obj_t *overdue, *overdue_text, *worm, *kite_ring;
    lv_obj_t *left, *right, *dots, *cue, *note, *action, *action_face, *action_icon, *action_text;
    lv_obj_t *stars, *stars_label, *stars_row;
    lv_obj_t *speaker, *bigplay, *bigplay_pill, *bigplay_wheel, *chores_pill;
    int8_t chores_sig;
    lv_obj_t *mode, *mode_spin, *mode_play, *mode_spin_icon, *mode_spin_label, *mode_play_label, *tap_in, *tap_out;
    char stars_sig[48], status_sig[80];
    time_pill_t pill;
    lime_card_t card;
    lv_obj_t *step_prev, *step_prev_text, *step_next, *step_next_text;   /* the steps list round the current step */
    lv_obj_t *free_btn, *free_btn_label;   /* free time: the pill under the time that flips to Biscuit (Play) or the wheel (Spin) */
    bubble_t bubble;
    next_block_t next;
    uint8_t worm_eaten;
    home_cardpos_t cardpos;
} h;

static void fire(lv_event_t *e) { if (h.cb) h.cb((home_event_t)(intptr_t)lv_event_get_user_data(e), 0); }
static void on_wheel(int idx) { if (h.cb) h.cb(HOME_WHEEL_RESULT, idx); }

static void worm_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.radius = LV_RADIUS_CIRCLE;
    /* the worm crawls right as it eats: one 13 px step per free-time dot */
    float wx = c.x1 + h.worm_eaten * 13.0f;
    d.bg_color = COL(C_CORAL);
    for (int j = 0; j < 10; j++)
        for (int i = 0; WORM[j][i]; i++) {
            if (WORM[j][i] != '#') continue;
            int32_t x = (int32_t)(wx + i * 3.8f), y = (int32_t)(c.y1 + j * 3.8f);
            lv_area_t a = { x, y, x + 2, y + 2 };
            lv_draw_rect(layer, &d, &a);
        }
    /* five free-time dots: eaten ones go dark */
    for (int k = 0; k < 5; k++) {
        bool eaten = k < h.worm_eaten;
        d.bg_color = COL(eaten ? C_DOT_OFF : C_MINT);
        int32_t x = c.x1 + 92 + k * 13, y = c.y1 + 19;
        lv_area_t a = { x, y, x + 6, y + 6 };
        if (eaten && k < h.worm_eaten - 1) continue; /* the worm sits on them */
        lv_draw_rect(layer, &d, &a);
    }
}

/* A quiet step row: "1. Put on your pants" with the ring, at a third of its colour. */
static lv_obj_t *step_row(lv_obj_t *parent, lv_obj_t **text, uint32_t color)
{
    lv_obj_t *r = ui_row(parent, 10);
    lv_obj_set_height(r, 34);
    ui_style_card(r, color, 14, 0, 0);
    lv_obj_set_style_bg_opa(r, 84, 0);   /* 33 % */
    lv_obj_set_style_pad_left(r, 12, 0);
    lv_obj_set_style_pad_right(r, 8, 0);
    *text = ui_label(r, F_CAPTION, C_NAVY, "");
    lv_obj_t *ring = ui_box(r);
    lv_obj_set_size(ring, 22, 22);
    lv_obj_set_style_radius(ring, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(ring, 2, 0);
    lv_obj_set_style_border_color(ring, COL(C_NAVY), 0);
    lv_obj_set_style_border_opa(ring, LV_OPA_COVER, 0);
    return r;
}

/* Figma "Mode switch": a 238 x 46 pill with two 112 x 36 sides, Spin and Play; the selected side
 * has a lime outline and lime words. */
static lv_obj_t *mode_side(lv_obj_t *parent, int32_t x)
{
    lv_obj_t *s = ui_row(parent, 8);
    lv_obj_set_size(s, 112, 36);
    lv_obj_set_pos(s, x, 5);
    lv_obj_set_flex_align(s, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_radius(s, 18, 0);
    lv_obj_set_style_border_color(s, COL(C_LIME), 0);
    lv_obj_set_style_border_opa(s, LV_OPA_COVER, 0);
    lv_obj_add_flag(s, LV_OBJ_FLAG_CLICKABLE);
    return s;
}

static void mode_select(bool play)
{
    lv_obj_set_style_border_width(h.mode_spin, play ? 0 : 2, 0);
    lv_obj_set_style_border_width(h.mode_play, play ? 2 : 0, 0);
    ui_set_color(h.mode_spin_label, play ? C_BONE : C_LIME);
    ui_set_color(h.mode_spin_icon, play ? C_BONE : C_LIME);
    ui_set_color(h.mode_play_label, play ? C_LIME : C_BONE);
}

static void ring_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }

static lv_obj_t *action_pill(lv_obj_t *parent)
{
    lv_obj_t *p = ui_row(parent, 8);
    ui_style_card(p, C_GLASS, 18, C_LINE, LV_OPA_COVER);
    lv_obj_set_style_pad_left(p, 12, 0);
    lv_obj_set_style_pad_right(p, 16, 0);
    lv_obj_set_style_pad_ver(p, 8, 0);
    lv_obj_add_flag(p, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_bg_color(p, COL(C_LINE), LV_STATE_PRESSED);
    h.action_face = pet_face_create(p, 1, COL(C_GLASS));
    h.action_icon = ui_icon(p, "wheel", 18, C_BONE);
    h.action_text = ui_label(p, F_MESSAGE, C_BONE, "Play");
    return p;
}

void home_create(lv_obj_t *page, home_cb_t cb)
{
    memset(&h, 0, sizeof h);
    h.cb = cb;
    h.page = page;

    h.pet = pet_create(page, SCENE_D);
    lv_obj_set_pos(h.pet, SCENE_XY, SCENE_XY);
    lv_obj_add_event_cb(h.pet, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_PET);

    h.ring = ring_create(page, RING_R);
    lv_obj_align(h.ring, LV_ALIGN_CENTER, 0, 0);

    h.wheel = wheel_create(page, on_wheel);
    lv_obj_align(h.wheel, LV_ALIGN_CENTER, 0, 0);

    /* running over: the message and the worm eating free time */
    h.overdue = ui_box(page);
    lv_obj_set_size(h.overdue, SCREEN_W, 300);
    lv_obj_set_pos(h.overdue, 0, 150);
    h.overdue_text = ui_label(h.overdue, F_MESSAGE, C_BONE, "");
    lv_obj_set_width(h.overdue_text, 190);
    lv_obj_set_style_text_align(h.overdue_text, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.overdue_text, LV_ALIGN_TOP_MID, 0, 9);
    h.worm = ui_box(h.overdue);
    lv_obj_set_size(h.worm, 170, 40);
    lv_obj_set_pos(h.worm, 129, 108);
    lv_obj_add_event_cb(h.worm, worm_draw, LV_EVENT_DRAW_MAIN, NULL);
    h.kite_ring = ui_box(h.overdue);
    lv_obj_set_size(h.kite_ring, 32, 32);
    lv_obj_set_pos(h.kite_ring, 305, 115);
    lv_obj_set_style_radius(h.kite_ring, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.kite_ring, 2, 0);
    lv_obj_set_style_border_color(h.kite_ring, COL(C_MINT), 0);
    lv_obj_set_style_border_opa(h.kite_ring, LV_OPA_COVER, 0);
    lv_obj_t *kite = ui_icon(h.kite_ring, "kite", 18, C_MINT);
    lv_obj_center(kite);

    /* header (Figma "Header", 2026-10-12: no icon for older kids, Title 22 at y 14, the line or pill
     * at y 45; the picture view keeps its icon at y 10 with the title at 44 and the pill at 76) */
    h.icon = ui_icon(page, "sun", 20, C_BONE);
    lv_obj_set_pos(h.icon, 223, 14);
    h.title = ui_label(page, F_TITLE, C_BONE, "");
    lv_obj_set_width(h.title, 340);
    lv_obj_set_style_text_align(h.title, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(h.title, LV_LABEL_LONG_DOT);
    lv_obj_align(h.title, LV_ALIGN_TOP_MID, 0, 14);
    h.status = ui_label(page, F_LABEL, C_MUTED, "");
    lv_obj_set_width(h.status, 340);
    lv_obj_set_style_text_align(h.status, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(h.status, LV_ALIGN_TOP_MID, 0, 45);
    time_pill_create(page, &h.pill);
    h.status_pill = status_pill_create(page, "star-fill", "", C_BUTTER);
    h.late = chip_create(page, C_CORAL, C_NAVY, "Late");
    lv_obj_align(h.late, LV_ALIGN_TOP_MID, 0, 45);
    /* the night clock (docked): Clock 48 at y 26 */
    h.clock = ui_label(page, F_CLOCK, C_BONE, "");
    lv_obj_set_width(h.clock, 300);
    lv_obj_set_style_text_align(h.clock, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_opa(h.clock, 204, 0);
    lv_obj_align(h.clock, LV_ALIGN_TOP_MID, 0, 26);

    lime_card_create(page, &h.card, 0);
    lv_obj_add_flag(h.card.root, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(h.card.root, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CARD);
    /* Figma Morning · Get dressed (steps): the step before (mint, done) and the one after (lime),
     * both at a third of their colour, 34 high in Caption 15, round the current step */
    h.step_prev = step_row(page, &h.step_prev_text, C_MINT);
    h.step_next = step_row(page, &h.step_next_text, C_LIME);

    bubble_create(page, &h.bubble);

    h.left = side_button_create(page, true, "star-line");
    lv_obj_add_event_cb(h.left, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_REWARDS);
    h.right = side_button_create(page, false, "list");
    lv_obj_add_event_cb(h.right, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CHORES);

    next_block_create(page, &h.next, fire, (void *)(intptr_t)HOME_TAP_NEXT);
    h.action = action_pill(page);
    lv_obj_add_event_cb(h.action, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_PLAY);
    /* at an event: a small "N to finish" pill under Biscuit (Figma Going out · At the event) */
    h.chores_pill = button_create(page, BTN_SECONDARY, true, "listchecks", "2 to finish");
    lv_obj_add_event_cb(h.chores_pill, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_CARD);
    h.chores_sig = -1;
    h.note = note_create(page, 376);
    h.stars = ui_box(page);
    lv_obj_set_size(h.stars, SCREEN_W, 70);
    lv_obj_set_pos(h.stars, 0, 372);
    h.stars_label = ui_label(h.stars, F_CAPTION, C_MUTED, "Tonight\xE2\x80\x99s star");
    lv_obj_align(h.stars_label, LV_ALIGN_TOP_MID, 0, 2);
    h.stars_row = ui_row(h.stars, 6);

    /* picture view: the speaker, and a big Play with the wheel as an icon */
    h.speaker = ui_box(page);
    lv_obj_set_size(h.speaker, 36, 36);
    lv_obj_set_pos(h.speaker, 346, 42);
    ui_style_card(h.speaker, C_GLASS, LV_RADIUS_CIRCLE, C_LINE, LV_OPA_COVER);
    lv_obj_add_flag(h.speaker, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(h.speaker, 8);
    lv_obj_set_style_bg_color(h.speaker, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_t *vol = ui_icon(h.speaker, "volume", 18, C_BONE);
    lv_obj_center(vol);
    lv_obj_add_event_cb(h.speaker, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_SPEAKER);
    h.bigplay = ui_row(page, 8);
    h.bigplay_pill = ui_row(h.bigplay, 10);
    ui_style_card(h.bigplay_pill, C_LIME, 24, 0, 0);
    lv_obj_set_style_pad_left(h.bigplay_pill, 14, 0);
    lv_obj_set_style_pad_right(h.bigplay_pill, 18, 0);
    lv_obj_set_style_pad_ver(h.bigplay_pill, 10, 0);
    lv_obj_add_flag(h.bigplay_pill, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_bg_color(h.bigplay_pill, COL(C_BONE), LV_STATE_PRESSED);
    pet_face_create(h.bigplay_pill, 1, COL(C_LIME));
    ui_label(h.bigplay_pill, F_BUTTON, C_NAVY, "Play");
    lv_obj_add_event_cb(h.bigplay_pill, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_PLAYTIME);
    h.bigplay_wheel = ui_box(h.bigplay);
    lv_obj_set_size(h.bigplay_wheel, 44, 44);
    ui_style_card(h.bigplay_wheel, C_GLASS, LV_RADIUS_CIRCLE, C_LINE, LV_OPA_COVER);
    lv_obj_add_flag(h.bigplay_wheel, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_bg_color(h.bigplay_wheel, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_t *wi = ui_icon(h.bigplay_wheel, "wheel", 20, C_BONE);
    lv_obj_center(wi);
    lv_obj_add_event_cb(h.bigplay_wheel, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_WHEEL);

    /* free time: the Spin / Play switch under the time pill (Figma Header "Below=Free time") */
    h.mode = ui_box(page);
    lv_obj_set_size(h.mode, 238, 46);
    lv_obj_set_pos(h.mode, 114, 46);
    ui_style_card(h.mode, C_GLASS, 22, C_LINE, LV_OPA_COVER);
    h.mode_spin = mode_side(h.mode, 5);
    h.mode_spin_icon = ui_icon(h.mode_spin, "retry", 20, C_LIME);
    h.mode_spin_label = ui_label(h.mode_spin, F_BUTTON, C_LIME, "Spin");
    lv_obj_add_event_cb(h.mode_spin, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_WHEEL);
    h.mode_play = mode_side(h.mode, 121);
    pet_face_create(h.mode_play, 1, COL(C_GLASS));
    h.mode_play_label = ui_label(h.mode_play, F_BUTTON, C_BONE, "Play");
    lv_obj_add_event_cb(h.mode_play, fire, LV_EVENT_CLICKED, (void *)(intptr_t)HOME_TAP_PLAY);
    /* Figma Free time (2026-10-12): the time at the top with one 112 x 36 card pill under it that
     * goes to the other side: "Play" over the wheel, "Spin" over Biscuit */
    h.free_btn = ui_row(page, 8);
    lv_obj_set_size(h.free_btn, 112, 36);
    lv_obj_set_pos(h.free_btn, 177, 38);
    lv_obj_set_flex_align(h.free_btn, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    ui_style_card(h.free_btn, C_GLASS, 22, 0, 0);
    lv_obj_set_style_bg_color(h.free_btn, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_add_flag(h.free_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(h.free_btn, 6);
    h.free_btn_label = ui_label(h.free_btn, F_BUTTON, C_BONE, "Play");
    /* Biscuit can be tapped: a lime ring (300) and a ripple (312) that pulses out (Figma "Tap Biscuit") */
    h.tap_in = ui_box(page);
    lv_obj_set_size(h.tap_in, 300, 300);
    lv_obj_align(h.tap_in, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_radius(h.tap_in, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.tap_in, 3, 0);
    lv_obj_set_style_border_color(h.tap_in, COL(C_LIME), 0);
    lv_obj_set_style_border_opa(h.tap_in, LV_OPA_COVER, 0);
    h.tap_out = ui_box(page);
    lv_obj_set_size(h.tap_out, 312, 312);
    lv_obj_align(h.tap_out, LV_ALIGN_CENTER, 0, 0);
    lv_obj_set_style_radius(h.tap_out, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(h.tap_out, 2, 0);
    lv_obj_set_style_border_color(h.tap_out, COL(C_LIME), 0);
    lv_obj_set_style_border_opa(h.tap_out, LV_OPA_COVER, 0);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, h.tap_out);
    lv_anim_set_exec_cb(&a, ring_opa);
    lv_anim_set_values(&a, 255, 40);
    lv_anim_set_duration(&a, 900);
    lv_anim_set_playback_duration(&a, 900);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_start(&a);

    h.dots = page_dots_create(page, 1);
    h.cue = cue_create(page);
}

lv_obj_t *home_pet(void) { return h.pet; }

void home_set_wheel(const char options[][20], int n) { wheel_set_options(h.wheel, options, n); }
void home_wheel_reset(void) { wheel_reset(h.wheel); }

/* The Status pill is rebuilt only when its words change. */
static void status_pill_update(const home_view_t *v)
{
    char sig[80];
    snprintf(sig, sizeof sig, "%s|%s|%06X", v->status_icon, v->status, (unsigned)v->status_color);
    if (!strcmp(sig, h.status_sig)) return;
    strcpy(h.status_sig, sig);
    lv_obj_t *old = h.status_pill;
    h.status_pill = status_pill_create(h.page, v->status_icon, v->status, v->status_color);
    lv_obj_move_to_index(h.status_pill, lv_obj_get_index(old));
    lv_obj_delete(old);
}

void home_render(const home_view_t *v)
{
    /* header */
    bool freehdr = v->below == BELOW_FREE;
    ui_show(h.clock, v->clock);
    ui_show(h.icon, !v->clock && !freehdr && v->icon[0] && v->picture);
    ui_show(h.title, !v->clock && !freehdr);
    ui_show(h.mode, false);   /* the switch gave way to one pill */
    ui_show(h.free_btn, freehdr);
    if (freehdr) {
        bool play = v->free_mode == 1;
        ui_set_text(h.free_btn_label, play ? "Spin" : "Play");
        lv_obj_remove_event_cb(h.free_btn, fire);
        lv_obj_add_event_cb(h.free_btn, fire, LV_EVENT_CLICKED, (void *)(intptr_t)(play ? HOME_TAP_WHEEL : HOME_TAP_PLAY));
    }
    bool text = !v->clock && !v->late_chip && v->below == BELOW_TEXT && v->status[0];
    bool pill = !v->late_chip && (v->below == BELOW_TIME || freehdr) && v->status[0];
    bool spill = !v->clock && !v->late_chip && v->below == BELOW_STATUS && v->status[0];
    ui_show(h.status, text);
    ui_show(h.pill.root, pill);
    ui_show(h.status_pill, spill);
    ui_show(h.late, !v->clock && v->late_chip);
    if (v->clock) {
        ui_set_text(h.clock, v->clock_text);
    } else {
        int isz = v->picture ? (strcmp(v->icon, "moon") ? 32 : 38) : 20;
        ui_icon_set(h.icon, v->icon, isz);
        lv_obj_set_pos(h.icon, CENTER - isz / 2, v->picture ? 10 : 14);
        ui_set_color(h.icon, v->icon_color);
        const lv_font_t *tf = v->title_big ? F_DISPLAY : F_TITLE;
        if (lv_obj_get_style_text_font(h.title, 0) != tf) lv_obj_set_style_text_font(h.title, tf, 0);
        lv_obj_set_width(h.title, v->picture ? 260 : 340);
        lv_obj_align(h.title, LV_ALIGN_TOP_MID, 0, v->picture ? (v->title_big ? 42 : 44) : 14);
        lv_obj_align(h.status, LV_ALIGN_TOP_MID, 0, v->picture ? 76 : 45);
        lv_obj_align(h.late, LV_ALIGN_TOP_MID, 0, v->picture ? 76 : 45);
        if (strcmp(lv_label_get_text(h.title), v->title)) { fx_slide(h.title, 10, 0); fx_slide(h.icon, 8, 0); }   /* a new screen */
        ui_set_text(h.title, v->title);
        ui_set_color(h.title, v->title_color);
        lv_obj_set_style_text_opa(h.title, v->title_opa ? v->title_opa : LV_OPA_COVER, 0);
        if (text) {
            ui_set_text(h.status, v->status);
            ui_set_color(h.status, v->status_color);
        }
        if (spill) {
            status_pill_update(v);
            lv_obj_update_layout(h.status_pill);
            lv_obj_align(h.status_pill, LV_ALIGN_TOP_MID, 0, v->picture ? 76 : 45);
        }
    }
    if (pill) {
        time_pill_set(&h.pill, v->status_icon, v->status, v->status_color);
        lv_obj_update_layout(h.pill.root);
        lv_obj_align(h.pill.root, LV_ALIGN_TOP_MID, 0, v->clock ? 92 : freehdr ? 6 : v->picture ? 76 : 45);
        lv_obj_set_style_opa(h.pill.root, v->clock ? 204 : LV_OPA_COVER, 0);
        /* free time: the words alone, no card behind them (Figma Free time · timer + Play) */
        lv_obj_set_style_bg_opa(h.pill.root, freehdr ? LV_OPA_TRANSP : LV_OPA_COVER, 0);
        lv_obj_set_style_border_opa(h.pill.root, freehdr ? LV_OPA_TRANSP : LV_OPA_COVER, 0);
    }

    /* the middle */
    bool pet_on = v->mid == MID_PET;
    ui_show(h.pet, pet_on);
    ui_show(h.wheel, v->mid == MID_WHEEL);
    ui_show(h.overdue, v->mid == MID_OVERDUE);
    ui_show(h.ring, v->ring_show);
    if (v->ring_show) ring_set(h.ring, &v->ring);
    ui_show(h.tap_in, pet_on && v->tap_ring);
    ui_show(h.tap_out, pet_on && v->tap_ring);
    pet_set_paused(h.pet, !pet_on);
    if (pet_on) {
        int32_t d = v->pet_d ? v->pet_d : SCENE_D, xy = v->pet_d ? v->pet_xy : SCENE_XY;
        pet_set_size(h.pet, d);
        lv_obj_set_pos(h.pet, xy, xy);
        pet_look_t look = pet_default_look(d);
        look.pitch = 3.8f;      /* the same LED grid as the 232 px Field Kit scene, more of the room */
        look.dim = v->pet_dim;
        look.room_off = v->room_off;
        look.wide = v->pet_wide;
        pet_set_look(h.pet, &look);
        pet_set_mood(h.pet, v->mood);
        pet_set_activity(h.pet, v->activity);
        pet_force_clip(h.pet, v->force_clip);
        if (v->wake) pet_wake_up(h.pet);
    }
    if (v->mid == MID_OVERDUE) {
        ui_set_text(h.overdue_text, v->overdue_text);
        if (h.worm_eaten != v->worm_eaten) { h.worm_eaten = v->worm_eaten; lv_obj_invalidate(h.worm); }
    }

    /* message card */
    ui_show(h.card.root, v->card != CARDPOS_NONE);
    ui_show(h.step_prev, v->steps_list && v->step_prev[0]);
    ui_show(h.step_next, v->steps_list && v->step_next[0]);
    if (v->steps_list) {
        if (v->step_prev[0]) { ui_set_text(h.step_prev_text, v->step_prev); lv_obj_update_layout(h.step_prev); lv_obj_align(h.step_prev, LV_ALIGN_TOP_MID, 0, 160); }
        if (v->step_next[0]) { ui_set_text(h.step_next_text, v->step_next); lv_obj_update_layout(h.step_next); lv_obj_align(h.step_next, LV_ALIGN_TOP_MID, 0, 272); }
    }
    if (v->card != CARDPOS_NONE) {
        if (v->steps_list) {
            lime_card_set(&h.card, NULL, v->card_text, v->card_end);   /* "2. Put on your pants", no dots */
        } else if (v->steps_total > 0) {
            lime_card_set(&h.card, NULL, v->card_text, v->card_end);
            lime_card_set_steps(&h.card, v->steps_total, v->steps_done);
        } else {
            lime_card_set(&h.card, v->card_icon[0] ? v->card_icon : NULL, v->card_text, v->card_end);
        }
        bool lime = v->card_lime || v->card_end == CARD_END_BUTTON || v->card_end == CARD_END_TAP;
        lime_card_set_color(&h.card, lime ? C_LIME : C_LAVENDER);
        lv_obj_update_layout(h.card.root);
        lv_obj_align(h.card.root, LV_ALIGN_TOP_MID, 0, v->card == CARDPOS_TOP ? (v->picture ? 99 : 75) : v->card == CARDPOS_LOW ? 314 : v->card == CARDPOS_MID ? 213 : 368);
    }

    /* Biscuit's words */
    if (v->say[0] && pet_on && v->say_low) {
        /* the alarm: centred at the bottom, over the full-screen room (Figma Morning · Alarm) */
        bubble_say(&h.bubble, v->say, 151, 374);
        lv_obj_update_layout(h.bubble.root);
        int32_t w = lv_obj_get_width(h.bubble.root);
        lv_obj_set_x(h.bubble.root, CENTER - w / 2);
        lv_obj_set_x(h.bubble.tail, CENTER - w / 2 + 9);
    } else if (v->say[0] && pet_on) bubble_say(&h.bubble, v->say, 232, v->card == CARDPOS_TOP ? 170 : 122);
    else if (v->say_top[0] && pet_on) bubble_say_top(&h.bubble, v->say_top, 392);
    else bubble_hide(&h.bubble);

    /* bottom */
    next_block_show(&h.next, v->bottom == BOTTOM_NEXT);
    if (v->bottom == BOTTOM_NEXT) next_block_set(&h.next, v->next_icon, v->next_title, v->next_time, v->peeks);
    ui_show(h.action, false);   /* the Spin / Play switch lives in the header now */
    ui_show(h.chores_pill, v->chores_left > 0 && pet_on);
    if (v->chores_left > 0 && v->chores_left != h.chores_sig) {
        h.chores_sig = v->chores_left;
        char n[20];
        snprintf(n, sizeof n, "%d to finish", v->chores_left);
        ui_set_text(lv_obj_get_child(h.chores_pill, -1), n);
    }
    if (v->chores_left > 0) { lv_obj_update_layout(h.chores_pill); lv_obj_align(h.chores_pill, LV_ALIGN_TOP_MID, 0, 316); }
    ui_show(h.note, v->bottom == BOTTOM_NOTE);
    if (v->bottom == BOTTOM_NOTE) {
        ui_set_text(h.note, v->note);
        lv_obj_set_style_text_opa(h.note, v->note_opa ? v->note_opa : LV_OPA_COVER, 0);
    }

    ui_show(h.stars, v->bottom == BOTTOM_STARS);
    if (v->bottom == BOTTOM_STARS) {
        char sig[48];
        snprintf(sig, sizeof sig, "%s%d/%d+%d", v->star_icon, v->star_count, v->star_goal, v->star_prize);
        if (strcmp(sig, h.stars_sig)) {
            strcpy(h.stars_sig, sig);
            lv_obj_clean(h.stars_row);
            ui_icon(h.stars_row, v->star_icon[0] ? v->star_icon : "bed", 18, C_MUTED);
            for (int i = 0; i + 1 < v->star_goal && i < 7; i++) {
                bool got = i < v->star_count;
                lv_obj_t *st = ui_icon(h.stars_row, got ? "star-fill" : "star-line", 18, C_BUTTER);
                /* tonight's star waits, outlined; the ones still to come are faint */
                if (!got && i > v->star_count) lv_obj_set_style_image_opa(st, LV_OPA_30, 0);
            }
            lv_obj_t *prize = ui_box(h.stars_row);
            lv_obj_set_size(prize, 28, 28);
            lv_obj_set_style_radius(prize, LV_RADIUS_CIRCLE, 0);
            lv_obj_set_style_border_width(prize, 2, 0);
            lv_obj_set_style_border_color(prize, COL(C_BUTTER), 0);
            lv_obj_set_style_border_opa(prize, LV_OPA_COVER, 0);
            char n[8];
            snprintf(n, sizeof n, "%d", v->star_prize);
            lv_obj_t *l = ui_label(prize, F_TAG, C_BUTTER, n);
            lv_obj_center(l);
            lv_obj_update_layout(h.stars_row);
            lv_obj_align(h.stars_row, LV_ALIGN_TOP_MID, 0, 22);
        }
    }

    ui_show(h.speaker, v->speaker && !v->clock);
    ui_show(h.bigplay, v->big_play);
    if (v->big_play) {
        lv_obj_update_layout(h.bigplay);
        lv_obj_align(h.bigplay, LV_ALIGN_TOP_MID, 0, 306);
    }
    ui_show(h.left, v->sides);
    ui_show(h.right, v->sides && !v->rewards_only);
    ui_show(h.dots, v->dots);
    ui_show(h.cue, v->cue);
}

/* A little joy on the day's wins. Done: the burst over the scene, "Done!" springs in, Biscuit's
 * hops throw sparks. The whole day or an event ready: bigger, with the halo rings. Hello (I'm up,
 * welcome home): his window switches on, a hop, twinkles. */
void home_celebrate(home_fx_t kind)
{
    if (!h.page) return;
    static const uint32_t HALO[3] = { C_LIME, 0xF59A76, C_LAVENDER };
    static const lv_opa_t FULL[3] = { LV_OPA_COVER, LV_OPA_COVER, LV_OPA_COVER };
    fx_burst_cfg_t cfg = { .burst_at = 0, .flash_r = 200, .waves = 2, .rays = false };
    switch (kind) {
    case HOME_FX_DONE:
        fx_burst_create(h.page, CENTER, CENTER, &cfg);
        fx_confetti(h.page, CENTER, CENTER, 60, FX_PARTY, 6, 240);
        fx_jolt(h.page, 5, 800, 0);
        fx_spring(h.status, 80);
        break;
    case HOME_FX_BIG:
        cfg.flash_r = 290;
        cfg.waves = 3;
        cfg.rays = true;
        fx_burst_create(h.page, CENTER, CENTER, &cfg);
        fx_confetti(h.page, CENTER, CENTER, 110, FX_PARTY, 6, 300);
        fx_jolt(h.page, 6, 900, 0);
        fx_halo(h.page, HALO, FULL, 160, 3000);
        fx_spring(h.status, 80);
        break;
    default:
        fx_iris(h.pet, 160, 0);
        fx_twinkle(h.page, CENTER, CENTER, 150, 6, 0, 2600);   /* 0: each star a brand colour */
        pet_react(h.pet, PET_CLIP_CELEBRATE);
        break;
    }
}
