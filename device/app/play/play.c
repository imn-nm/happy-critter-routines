#include "../ui/fx.h"
#include "play.h"
#include "games.h"
#include "../hal.h"
#include "../pet/pet.h"
#include "../ui/theme.h"
#include "../ui/widgets.h"
#include "../ui/swipe.h"
#include <stdio.h>
#include <string.h>

#define STEP_MS 66
#define SEE_YOU_MS 8000

/* Figma "Playtime · Menu": five 97 px circles round Biscuit, each with its icon and name. */
static const struct { const char *title, *label, *icon; int32_t x, y; } MENU[GAME_COUNT] = {
    [GAME_DRESSUP] = { "Dress up", "Dress up", "shirt", 6, 151 },
    [GAME_BATH] = { "Bath time", "Bath\ntime", "droplets", 363, 151 },
    [GAME_CARROT] = { "Carrot catch", "Carrot\ncatch", "carrot", 47, 293 },
    [GAME_BUBBLES] = { "Bubble pop", "Bubble\npop", "bubble", 327, 293 },
    [GAME_PEEKABOO] = { "Peekaboo", "Peeka\nboo", "eye", 182, 362 },
};

/* Line icons for the dress-up items (the kit draws only Biscuit as pixel art). */
static const char *const ACC_ICON[PET_ACC_COUNT] = {
    [PET_ACC_HAT] = "party", [PET_ACC_STRAW] = "sun", [PET_ACC_CAP] = "cap", [PET_ACC_CROWN] = "crown",
    [PET_ACC_BOW] = "ribbon", [PET_ACC_BEANIE] = "snowflake", [PET_ACC_TIARA] = "sparkles", [PET_ACC_WIZARD] = "wand",
    [PET_ACC_SPECS] = "glasses", [PET_ACC_HEARTS] = "heart", [PET_ACC_SHADES] = "eye", [PET_ACC_STARS] = "star-fill",
    [PET_ACC_NOSE] = "circle-dot", [PET_ACC_SCARF] = "wind", [PET_ACC_BOWTIE] = "ribbon", [PET_ACC_LEI] = "yoga",
    [PET_ACC_MEDAL] = "medal", [PET_ACC_CAPE] = "shield",
};

static stage_t stage;

static struct {
    lv_obj_t *root, *canvas, *shade_top, *shade_low, *icon, *title, *bottom, *menu, *menu_pet;
    time_pill_t pill;
    uint16_t *buf;
    lv_timer_t *timer_obj;
    bool in_game, see_you;
    int32_t left;
    float t;
    char next[44], next_icon[20], next_time[8], pet[16];
    play_outfit_cb_t on_outfit;
    int slot;
    /* game controls */
    lv_obj_t *score;
    char sig[160];
} pl;

static void open_menu(void);

/* ---------------------------------------------------------------- the stage */
static void to_stage(lv_point_t pt, float *x, float *y)
{
    lv_area_t a;
    lv_obj_get_coords(pl.canvas, &a);
    float P = STAGE_D / 116.0f;
    *x = LW / 2 + (pt.x - a.x1 - STAGE_D / 2.0f) / P;
    *y = LH / 2 + (pt.y - a.y1 - STAGE_D / 2.0f) / P;
}

static void on_stage(lv_event_t *e)
{
    if (!pl.in_game) return;
    lv_event_code_t c = lv_event_get_code(e);
    lv_point_t pt;
    lv_indev_get_point(lv_indev_active(), &pt);
    float x, y;
    to_stage(pt, &x, &y);
    if (c == LV_EVENT_PRESSED) {
        /* Carrot catch: a tap on the stage starts it (the game shows what to do, no buttons) */
        if (game_current() == GAME_CARROT) { game_ui_t ui; game_ui(&ui); if (ui.state != 1) { carrot_play(); return; } }
        game_press(x, y);
    }
    else if (c == LV_EVENT_PRESSING) game_move(x, y);
    else if (c == LV_EVENT_RELEASED || c == LV_EVENT_PRESS_LOST) game_release();
}

static void draw_stage(void)
{
    if (pl.in_game) game_draw(&stage);
    else menu_draw(&stage, pl.t);
    stage_render(&stage, pl.buf);
    lv_obj_invalidate(pl.canvas);
}

/* ---------------------------------------------------------------- the header */
static void set_header(const char *icon, const char *title)
{
    ui_icon_set(pl.icon, icon, 20);
    ui_set_text(pl.title, title);
}

/* A 128 px shade at the top and a 152 px one at the bottom so the words read over the room. */
static lv_obj_t *shade(lv_obj_t *parent, int32_t y, int32_t h, bool down)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, SCREEN_W, h);
    lv_obj_set_pos(o, 0, y);
    static lv_grad_dsc_t g[2];
    lv_grad_dsc_t *gd = &g[down ? 1 : 0];
    gd->dir = LV_GRAD_DIR_VER;
    gd->stops_count = 2;
    gd->stops[0].color = COL(C_INK); gd->stops[0].opa = down ? LV_OPA_TRANSP : 230; gd->stops[0].frac = 0;
    gd->stops[1].color = COL(C_INK); gd->stops[1].opa = down ? 230 : LV_OPA_TRANSP; gd->stops[1].frac = 255;
    lv_obj_set_style_bg_grad(o, gd, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    return o;
}

/* Figma: 84 x 44 pills for the dress-up categories and the bath steps; the current one has a
 * lime outline. */
static lv_obj_t *step_pill(lv_obj_t *parent, const char *text, bool on, bool sunken, int32_t x)
{
    lv_obj_t *c = ui_row(parent, 0);
    lv_obj_set_size(c, 84, 44);
    lv_obj_set_pos(c, x, 0);
    lv_obj_set_flex_align(c, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    if (on) {
        ui_style_card(c, sunken ? C_DOTS_BG : C_INK, 22, C_LIME, LV_OPA_COVER);
        lv_obj_set_style_border_width(c, 2, 0);
        if (!sunken) lv_obj_set_style_bg_opa(c, LV_OPA_TRANSP, 0);
    } else {
        ui_style_card(c, C_GLASS, 22, 0, 0);
    }
    ui_label(c, F_LABEL, C_BONE, text);
    return c;
}

/* ---------------------------------------------------------------- game controls */
static void on_item(lv_event_t *e)
{
    int acc = (int)(intptr_t)lv_event_get_user_data(e);
    if (dressup_wear(acc) && pl.on_outfit) pl.on_outfit();
    pl.sig[0] = 0; /* redraw the items: one is now worn */
}

static void on_slot(lv_event_t *e)
{
    pl.slot = (int)(intptr_t)lv_event_get_user_data(e);
    pl.sig[0] = 0;
}

/* Figma "Playtime · Dress up": Head / Face / Neck at y 334, the items in 52 x 48 tiles at y 388 */
static void dressup_controls(void)
{
    int o[3];
    pet_get_outfit(&o[0], &o[1], &o[2]);
    char sig[64];
    snprintf(sig, sizeof sig, "du%d|%d,%d,%d", pl.slot, o[0], o[1], o[2]);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    static const char *const SLOTS[3] = { "Head", "Face", "Neck" };
    for (int i = 0; i < 3; i++) {
        lv_obj_t *c = step_pill(pl.bottom, SLOTS[i], i == pl.slot, true, 99 + i * 92);
        lv_obj_set_y(c, 0);
        lv_obj_add_flag(c, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(c, on_slot, LV_EVENT_CLICKED, (void *)(intptr_t)i);
    }
    lv_obj_t *items = ui_box(pl.bottom);
    lv_obj_set_size(items, 244, 48);
    lv_obj_set_pos(items, 111, 54);
    lv_obj_set_flex_flow(items, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(items, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(items, 12, 0);
    lv_obj_add_flag(items, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_scroll_dir(items, LV_DIR_HOR);
    lv_obj_set_scrollbar_mode(items, LV_SCROLLBAR_MODE_OFF);
    lv_obj_t *worn_item = NULL;
    for (int a = 0; a < PET_ACC_COUNT; a++) {
        if (pet_acc_slot[a] != pl.slot) continue;
        bool worn = o[pl.slot] == a;
        lv_obj_t *b = ui_box(items);
        lv_obj_set_size(b, 52, 48);
        if (worn) {
            lv_obj_set_style_radius(b, 15, 0);
            lv_obj_set_style_border_width(b, 2, 0);
            lv_obj_set_style_border_color(b, COL(C_LIME), 0);
            lv_obj_set_style_border_opa(b, LV_OPA_COVER, 0);
            worn_item = b;
        } else {
            ui_style_card(b, C_GLASS, 15, C_LINE, LV_OPA_COVER);
        }
        lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_bg_color(b, COL(C_LINE), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
        lv_obj_add_event_cb(b, on_item, LV_EVENT_CLICKED, (void *)(intptr_t)a);
        lv_obj_t *ic = ui_icon(b, ACC_ICON[a], 24, worn ? C_LIME : C_BONE);
        lv_obj_center(ic);
    }
    if (worn_item) lv_obj_scroll_to_view(worn_item, LV_ANIM_OFF);
}

static void game_controls(void)
{
    game_id_t g = game_current();
    if (g == GAME_DRESSUP) { dressup_controls(); return; }
    game_ui_t ui;
    game_ui(&ui);
    char line[48];
    switch (g) {
    case GAME_CARROT: snprintf(line, sizeof line, "%d carrot%s", ui.score, ui.score == 1 ? "" : "s"); break;
    case GAME_BUBBLES: snprintf(line, sizeof line, "%d popped", ui.score); break;
    case GAME_PEEKABOO: snprintf(line, sizeof line, ui.found ? "Boo! Found %s" : "Find %s", pl.pet); break;
    default: line[0] = 0; break;
    }
    char sig[160];
    snprintf(sig, sizeof sig, "%d|%d|%s", g, ui.step, line);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    if (g == GAME_BATH) {
        /* Figma "Playtime · Bath time": 1 Scrub · 2 Rinse · 3 Dry at y 372 */
        static const char *const STEPS[3] = { "1 Scrub", "2 Rinse", "3 Dry" };
        for (int i = 0; i < 3; i++) { lv_obj_t *c = step_pill(pl.bottom, STEPS[i], i == ui.step, false, 99 + i * 92); lv_obj_set_y(c, 38); if (i == ui.step) fx_pop(c, 0); }
    } else {
        /* the score as a Status pill at y 381 */
        pl.score = status_pill_create(pl.bottom, MENU[g].icon, line, C_BONE);
        lv_obj_update_layout(pl.score);
        lv_obj_align(pl.score, LV_ALIGN_TOP_MID, 0, 47);
        fx_pop(pl.score, 0);
        if (g == GAME_PEEKABOO && ui.found) fx_confetti(pl.root, CENTER, CENTER, 18, FX_PARTY, 6, 120);
    }
}

/* ---------------------------------------------------------------- menu and games */
static void on_game(lv_event_t *e)
{
    game_id_t g = (game_id_t)(intptr_t)lv_event_get_user_data(e);
    pl.in_game = true;
    pl.sig[0] = 0;
    pl.slot = 0;
    game_start(g, pl.pet);
    ui_show(pl.menu, false);
    ui_show(pl.menu_pet, false);
    pet_set_paused(pl.menu_pet, true);
    ui_show(pl.canvas, true);
    ui_show(pl.shade_top, true);
    ui_show(pl.shade_low, true);
    ui_show(pl.bottom, true);
    set_header(MENU[g].icon, MENU[g].title);
    hal_play(HAL_SOUND_TICK);
}

static void open_menu(void)
{
    pl.in_game = false;
    pl.sig[0] = 0;
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    ui_show(pl.bottom, false);
    ui_show(pl.menu, true);
    fx_spring_children(pl.menu, 50);
    if (pl.menu_pet) { ui_show(pl.menu_pet, true); pet_set_paused(pl.menu_pet, false); pet_react(pl.menu_pet, PET_CLIP_WAVE); }
    ui_show(pl.canvas, false);
    ui_show(pl.shade_top, false);
    ui_show(pl.shade_low, false);
    char t[40];
    snprintf(t, sizeof t, "Play with %s", pl.pet);
    set_header("kite", t);
}

static void close_sliding(int dir);

/* Swipe left or right: a game goes back to the menu, the menu back to the day. In Carrot catch
 * and Bath time a sideways drag on the stage is play, so there the swipe has to start outside it
 * (the title or the controls), unless the game is over. */
static bool on_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)user;
    if (dir == SWIPE_DOWN) return false;
    if (pl.in_game && !pl.see_you && game_drag_active()) {
        if (start.y > 100 && start.y < 330) return false;
    }
    if (!commit) return true;
    if (pl.in_game && !pl.see_you) open_menu();
    else close_sliding(dir);
    return true;
}

/* ---------------------------------------------------------------- see you later */
static uint32_t seeyou_at;

static void on_ok(lv_event_t *e)
{
    (void)e;
    play_close();
}

/* Figma "Playtime · See you later": a wave, "Play again next free time", "Time to get ready",
 * and what's next in the Next pill. */
static void see_you_later(void)
{
    pl.see_you = true;
    seeyou_at = lv_tick_get();
    lv_obj_clean(pl.root);
    pl.canvas = pl.title = pl.icon = pl.bottom = pl.menu = pl.menu_pet = pl.shade_top = pl.shade_low = NULL;
    lv_free(pl.buf);
    pl.buf = NULL;
    lv_obj_add_event_cb(pl.root, on_ok, LV_EVENT_CLICKED, NULL);
    lv_obj_t *pet = pet_create(pl.root, 286);
    lv_obj_set_pos(pet, 90, 90);
    pet_look_t look = pet_default_look(286);
    look.pitch = 3.8f;
    pet_set_look(pet, &look);
    pet_force_clip(pet, PET_CLIP_WAVE);
    lv_obj_t *ic = ui_icon(pl.root, "hand", 20, C_BONE);
    lv_obj_set_pos(ic, 223, 14);
    lv_obj_t *t = ui_label(pl.root, F_TITLE, C_BONE, "See you later!");
    lv_obj_set_width(t, 340);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(t, LV_ALIGN_TOP_MID, 0, 38);
    lv_obj_t *s = ui_label(pl.root, F_LABEL, C_MUTED, "Play again next free time");
    lv_obj_set_width(s, 340);
    lv_obj_set_style_text_align(s, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(s, LV_ALIGN_TOP_MID, 0, 69);
    lime_card_t c;
    lime_card_create(pl.root, &c, 0);
    lime_card_set(&c, "alarm", "Time to get ready", CARD_END_NONE);
    lv_obj_update_layout(c.root);
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, 97);
    if (pl.next[0]) {
        static next_block_t nb;
        next_block_create(pl.root, &nb, NULL, NULL);
        next_block_set(&nb, pl.next_icon, pl.next, pl.next_time, 0);
    }
    hal_play(HAL_SOUND_SOON);
    fx_rise_children(pl.root, 14, 30);
    char say[96];
    snprintf(say, sizeof say, "Time to get ready for %s. See you later!", pl.next);
    hal_speak(say);
}

/* ---------------------------------------------------------------- the clock */
static void step(lv_timer_t *t)
{
    (void)t;
    if (pl.see_you) {
        if (lv_tick_get() - seeyou_at >= SEE_YOU_MS) play_close();
        return;
    }
    pl.t += STEP_MS;
    if (!pl.in_game) return; /* the menu's Biscuit draws himself */
    game_update(STEP_MS);
    game_controls();
    draw_stage();
}

void play_set_time_left(int32_t s)
{
    if (!pl.root || pl.see_you) return;
    pl.left = s;
    if (s <= 0) { see_you_later(); return; }
    char t[16];
    snprintf(t, sizeof t, "%d:%02d left", (int)(s / 60), (int)(s % 60));
    time_pill_set(&pl.pill, "kite", t, C_MINT);
    lv_obj_update_layout(pl.pill.root);
    lv_obj_align(pl.pill.root, LV_ALIGN_TOP_MID, 0, 69);
}

bool play_is_open(void) { return pl.root != NULL; }

static void free_buf(lv_event_t *e) { lv_free(lv_event_get_user_data(e)); }

static void forget(void)
{
    if (pl.timer_obj) lv_timer_delete(pl.timer_obj);
    if (pl.root && pl.buf) lv_obj_add_event_cb(pl.root, free_buf, LV_EVENT_DELETE, pl.buf);
    else lv_free(pl.buf);
    memset(&pl, 0, sizeof pl);
}

void play_close(void)
{
    lv_obj_t *root = pl.root;
    forget();
    /* often called from one of its own buttons: the fade lets LVGL finish the event first */
    if (root) overlay_fade_away(root);
}

static void close_sliding(int dir)
{
    lv_obj_t *root = pl.root;
    forget();
    if (root) overlay_slide_away(root, dir);
}

void play_open(int32_t seconds_left, const char *next_title, const char *next_icon, const char *next_time, const char *pet_name, play_outfit_cb_t on_outfit)
{
    if (pl.root) return;
    memset(&pl, 0, sizeof pl);
    pl.on_outfit = on_outfit;
    snprintf(pl.next, sizeof pl.next, "%s", next_title ? next_title : "");
    snprintf(pl.next_icon, sizeof pl.next_icon, "%s", next_icon ? next_icon : "");
    snprintf(pl.next_time, sizeof pl.next_time, "%s", next_time ? next_time : "");
    snprintf(pl.pet, sizeof pl.pet, "%s", pet_name && *pet_name ? pet_name : "Biscuit");
    pl.root = overlay_create();
    swipe_add(pl.root, on_swipe, NULL);

    /* the stage fills the display (Figma "Scene · full display") */
    pl.buf = lv_malloc(STAGE_D * STAGE_D * 2);
    pl.canvas = lv_canvas_create(pl.root);
    lv_canvas_set_buffer(pl.canvas, pl.buf, STAGE_D, STAGE_D, LV_COLOR_FORMAT_RGB565);
    lv_obj_set_pos(pl.canvas, 0, 0);
    lv_obj_add_flag(pl.canvas, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(pl.canvas, on_stage, LV_EVENT_ALL, NULL);
    pl.shade_top = shade(pl.root, 0, 128, false);
    pl.shade_low = shade(pl.root, 314, 152, true);

    /* the menu: Biscuit's own room, 286 px, waving now and then; the five games round him */
    pl.menu_pet = pet_create(pl.root, 286);
    lv_obj_set_pos(pl.menu_pet, 90, 85);
    pet_look_t look = pet_default_look(286);
    look.pitch = 3.8f;
    pet_set_look(pl.menu_pet, &look);
    pet_set_mood(pl.menu_pet, PET_MOOD_EXCITED);
    pet_set_tappable(pl.menu_pet, true);
    pl.menu = ui_box(pl.root);
    lv_obj_set_size(pl.menu, SCREEN_W, SCREEN_H);
    for (int g = 0; g < GAME_COUNT; g++) {
        lv_obj_t *b = ui_box(pl.menu);
        lv_obj_set_size(b, 97, 97);
        lv_obj_set_pos(b, MENU[g].x, MENU[g].y);
        ui_style_card(b, C_GLASS, LV_RADIUS_CIRCLE, C_LINE, LV_OPA_COVER);
        lv_obj_set_style_bg_color(b, COL(C_LINE), LV_STATE_PRESSED);
        lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(b, on_game, LV_EVENT_CLICKED, (void *)(intptr_t)g);
        bool two = strchr(MENU[g].label, '\n') != NULL;
        lv_obj_t *ic = ui_icon(b, MENU[g].icon, 24, C_LIME);
        lv_obj_align(ic, LV_ALIGN_TOP_MID, 0, two ? 12 : 24);
        lv_obj_t *l = ui_label(b, F_LABEL, C_BONE, MENU[g].label);
        lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_align(l, LV_ALIGN_TOP_MID, 0, two ? 40 : 52);
    }

    /* the header: the game's icon, its name, the play time left in a mint pill */
    pl.icon = ui_icon(pl.root, "kite", 20, C_BONE);
    lv_obj_set_pos(pl.icon, 223, 14);
    pl.title = ui_label(pl.root, F_TITLE, C_BONE, "");
    lv_obj_set_width(pl.title, 340);
    lv_obj_set_style_text_align(pl.title, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(pl.title, LV_ALIGN_TOP_MID, 0, 38);
    time_pill_create(pl.root, &pl.pill);

    pl.bottom = ui_box(pl.root);
    lv_obj_set_size(pl.bottom, SCREEN_W, 132);
    lv_obj_set_pos(pl.bottom, 0, 334);

    open_menu();
    play_set_time_left(seconds_left);
    pl.timer_obj = lv_timer_create(step, STEP_MS, NULL);
    overlay_enter_push(pl.root);   /* opened by a tap on Biscuit: in from the right, out the same way */
}
