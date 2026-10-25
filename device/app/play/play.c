#include "../ui/fx.h"
#include "play.h"
#include "games.h"
#include "classic.h"
#include "../hal.h"
#include "../pet/pet.h"
#include "../ui/theme.h"
#include "../ui/widgets.h"
#include "../ui/swipe.h"
#include "../mytoki.h"
#include "../motion.h"
#include <math.h>
#include <stdio.h>
#include <string.h>

#define STEP_MS 66
#define SEE_YOU_MS 8000

/* The games menu: one list, like Chores and the shop (user, 2026-10-25): Biscuit's games first, then
 * the classic ones, each row a picture of the game (device/tools/icons/game-*.svg), its name and a
 * few words on how it's played. "%s" in a title or a line is the pet's name. Dress up is not a
 * game: it lives in My pet (a long tap on the pet, any time), with choosing the buddy, so it has no
 * row. */
static const struct { const char *title, *icon; } MENU[GAME_COUNT] = {
    [GAME_DRESSUP] = { "Dress up", "shirt" },
    [GAME_BATH] = { "Bath time", "game-bath" },
    [GAME_CARROT] = { "Carrot catch", "game-carrot" },
    [GAME_BUBBLES] = { "Bubble pop", "game-bubbles" },
};
static const struct { const char *title, *icon; } CLASSIC[CL_COUNT] = {
    [CL_TRAIL] = { "Snack Trail", "game-trail" },
    [CL_MAZE] = { "Maze Munch", "game-maze" },
    [CL_BRICKS] = { "Brick Bounce", "game-bricks" },
    [CL_PAIRS] = { "Pet Pairs", "game-pairs" },
    [CL_DROP] = { "Snack Drop", "game-drop" },
    [CL_ROLL] = { "Roll home", "game-roll" },
};
/* The rows, in order, and the line under each name */
static const struct { bool classic; int id; const char *how; } GAME_ROWS[] = {
    { false, GAME_BATH, "Scrub, rinse, dry" },
    { false, GAME_CARROT, "Catch the carrots" },
    { false, GAME_BUBBLES, "Tap the bubbles" },
    { true, CL_ROLL, "Tip to roll home" },
    { true, CL_TRAIL, "Steer to cookies" },
    { true, CL_MAZE, "Eat every snack" },
    { true, CL_BRICKS, "Break the bricks" },
    { true, CL_PAIRS, "Find the pairs" },
    { true, CL_DROP, "Tap the right one" },
};
#define GAME_ROW_COUNT ((int)(sizeof GAME_ROWS / sizeof GAME_ROWS[0]))
/* Placed as Chores: the list reaches up behind the header, rows 82 apart, the one at rest at y 171 */
#define GL_TOP 67
#define GL_FOCUS 171
#define GL_ROW 82
#define GL_W 360
#define GL_H 72

/* Line icons for the dress-up items (the kit draws only Biscuit as pixel art). */
static const char *const ACC_ICON[PET_ACC_COUNT] = {
    [PET_ACC_HAT] = "party", [PET_ACC_STRAW] = "sun", [PET_ACC_CAP] = "cap", [PET_ACC_CROWN] = "crown",
    [PET_ACC_BOW] = "ribbon", [PET_ACC_BEANIE] = "snowflake", [PET_ACC_TIARA] = "sparkles", [PET_ACC_WIZARD] = "wand",
    [PET_ACC_SPECS] = "glasses", [PET_ACC_HEARTS] = "heart", [PET_ACC_SHADES] = "eye",
    [PET_ACC_SCARF] = "wind", [PET_ACC_BOWTIE] = "ribbon", [PET_ACC_MEDAL] = "medal", [PET_ACC_CAPE] = "shield",
};

static stage_t stage;

static struct {
    lv_obj_t *root, *canvas, *shade_top, *shade_low, *bottom, *menu, *menu_pet, *timer;
    lv_obj_t *bar_fill;         /* Bath time: how far the step has got */
    int32_t total;              /* the play time there was at the start, for the timer */
    wheel_list_t wl;            /* the games menu: a row per game */
    lv_obj_t *buddy_pet;        /* My pet: the pet trying each choice on */
    bool classic;               /* the game being played is a classic one (classic.c draws it) */
    bool buddy;                 /* My pet is showing */
    bool standalone;            /* opened by a long tap on the pet, not from Playtime */
    int editor_page;            /* My pet: 0 My buddy, 1 Dress up */
    play_character_cb_t on_character;
    header_t head;
    char left_text[32];
    uint16_t *buf;
    led_cache_t cache;          /* what's in buf: a step repaints only what moved */
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

/* "%s says" with the pet's name in it */
static void named(char *out, size_t n, const char *fmt)
{
    if (strstr(fmt, "%s")) snprintf(out, n, fmt, pl.pet);
    else snprintf(out, n, "%s", fmt);
}

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
    led_rect_t px = stage_render(&stage, pl.buf, &pl.cache);
    if (px.x1 > px.x0 && px.y1 > px.y0) {
        lv_area_t at;
        lv_obj_get_coords(pl.canvas, &at);
        lv_area_t changed = { at.x1 + px.x0, at.y1 + px.y0, at.x1 + px.x1 - 1, at.y1 + px.y1 - 1 };
        lv_obj_invalidate_area(pl.canvas, &changed);
    }
}

/* The stage's buffer is going: what the cache remembers of it goes with it. */
static void forget_cache(void)
{
    lv_free(pl.cache.cells);
    memset(&pl.cache, 0, sizeof pl.cache);
}

/* ---------------------------------------------------------------- the header */
static char head_title[40];

/* MyToki 2 Header: the clock, the game's name, the play time left in a mint pill */
static void set_header(const char *icon, const char *title)
{
    (void)icon;
    if (title) snprintf(head_title, sizeof head_title, "%s", title);
    if (!pl.head.root) return;
    /* My pet: its page's name and where the other page is (no play time: it isn't a game) */
    if (pl.buddy) {
        header_set(&pl.head, ui_clock(), head_title, HEADER_TEXT, PILL_CALM, NULL,
                   pl.editor_page ? "Swipe back to My buddy" : "Swipe to dress up");
        return;
    }
    /* a classic game (Figma "13 · Classic games"): the clock, its name, the play time left; Maze
     * Munch fills the screen, so no name; Roll home's maze fills the display, so the clock alone (the
     * rim still shows the play time) */
    if (pl.in_game && pl.classic) {
        bool wide = classic_wide(), bare = wide && classic_current() == CL_ROLL;
        header_set(&pl.head, ui_clock(), wide ? NULL : head_title, bare ? HEADER_NONE : HEADER_PILL, PILL_DONE, "kite", pl.left_text);
        return;
    }
    /* the menu: "Games" over the list, as Chores; the other games: the clock and the pill only */
    header_set(&pl.head, ui_clock(), pl.in_game ? NULL : "Games", HEADER_PILL, PILL_DONE, "kite", pl.left_text);
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
    (void)sunken;
    /* MyToki 2 Tab: on a night pill; the current one has a lime outline and lime words */
    ui_style_card(c, C_RAISED, LV_RADIUS_CIRCLE, C_ACTION, on ? LV_OPA_COVER : 0);
    if (on) lv_obj_set_style_border_width(c, 2, 0);
    ui_label(c, F_LABEL, on ? C_ACTION : C_TEXT_MUTED, text);
    return c;
}

/* ---------------------------------------------------------------- game controls */
static void on_item(lv_event_t *e)
{
    int acc = (int)(intptr_t)lv_event_get_user_data(e);
    if (dressup_wear(acc) && pl.on_outfit) pl.on_outfit();
    if (pl.buddy_pet) pet_react(pl.buddy_pet, PET_CLIP_WAVE);   /* My pet: he shows it off */
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

/* ---------------------------------------------------------------- my buddy */
static lv_obj_t *pick_tile(lv_obj_t *parent, int32_t x, int32_t y, bool on)
{
    lv_obj_t *b = ui_box(parent);
    lv_obj_set_size(b, 52, 48);
    lv_obj_set_pos(b, x, y);
    if (on) {
        lv_obj_set_style_radius(b, 15, 0);
        lv_obj_set_style_border_width(b, 2, 0);
        lv_obj_set_style_border_color(b, COL(C_LIME), 0);
        lv_obj_set_style_border_opa(b, LV_OPA_COVER, 0);
    } else {
        ui_style_card(b, C_GLASS, 15, C_LINE, LV_OPA_COVER);
    }
    lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_bg_color(b, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(b, LV_OPA_COVER, LV_STATE_PRESSED);
    return b;
}

static void buddy_changed(int ch, int col)
{
    pet_set_character(ch, col);
    snprintf(pl.pet, sizeof pl.pet, "%s", pet_chars[ch].name);
    if (pl.on_character) pl.on_character();
    if (pl.buddy_pet) pet_react(pl.buddy_pet, PET_CLIP_WAVE);
    pl.sig[0] = 0;
    hal_play(HAL_SOUND_TICK);
}

static void on_buddy_char(lv_event_t *e)
{
    int ch = (int)(intptr_t)lv_event_get_user_data(e), cur, col;
    pet_get_character(&cur, &col);
    if (ch == cur) return;
    buddy_changed(ch, 0);   /* a new character starts in its own colours */
}

static void on_buddy_colour(lv_event_t *e)
{
    int col = (int)(intptr_t)lv_event_get_user_data(e), ch, cur;
    pet_get_character(&ch, &cur);
    if (col == cur) return;
    buddy_changed(ch, col);
}

/* The characters in a row (each one's face), then the chosen one's four colours (its fur). */
static void buddy_controls(void)
{
    int ch, col;
    pet_get_character(&ch, &col);
    char sig[32];
    snprintf(sig, sizeof sig, "buddy%d,%d", ch, col);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    const int32_t x0 = (SCREEN_W - (PET_CHAR_COUNT * 52 + (PET_CHAR_COUNT - 1) * 12)) / 2;
    for (int i = 0; i < PET_CHAR_COUNT; i++) {
        lv_obj_t *b = pick_tile(pl.bottom, x0 + i * 64, 0, i == ch);
        lv_obj_add_event_cb(b, on_buddy_char, LV_EVENT_CLICKED, (void *)(intptr_t)i);
        /* each one's head in a round frame, like a small portrait */
        lv_obj_t *face = pet_face_create_round(b, i, i == ch ? col : 0, 40, COL(C_HILL_LINE));
        lv_obj_center(face);
        lv_obj_add_flag(face, LV_OBJ_FLAG_EVENT_BUBBLE);
    }
    const int32_t x1 = (SCREEN_W - (PET_COLOUR_COUNT * 52 + (PET_COLOUR_COUNT - 1) * 12)) / 2;
    for (int i = 0; i < PET_COLOUR_COUNT; i++) {
        lv_obj_t *b = pick_tile(pl.bottom, x1 + i * 64, 54, i == col);
        lv_obj_add_event_cb(b, on_buddy_colour, LV_EVENT_CLICKED, (void *)(intptr_t)i);
        lv_obj_t *dot = ui_box(b);
        lv_obj_set_size(dot, 26, 26);
        lv_obj_center(dot);
        lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_bg_color(dot, lv_color_hex(pet_chars[ch].colours[i].swatch), 0);
        lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
        lv_obj_add_flag(dot, LV_OBJ_FLAG_EVENT_BUBBLE);
    }
}

static void buddy_close(void)
{
    if (!pl.buddy) return;
    pl.buddy = false;
    if (pl.buddy_pet) { lv_obj_delete(pl.buddy_pet); pl.buddy_pet = NULL; }
}

/* ---------------------------------------------------------------- my pet */
/* My pet (a long tap on the pet, any time): two pages, My buddy (which character and colour) and
 * Dress up (head, face, neck), with the pet in its room trying each choice on at once. */
static void editor_controls(void)
{
    if (pl.editor_page) dressup_controls();
    else buddy_controls();
}

static void editor_page(int page)
{
    pl.editor_page = page;
    pl.slot = 0;
    pl.sig[0] = 0;
    editor_controls();
    fx_spring_children(pl.bottom, 30);
    set_header(NULL, page ? "Dress up" : "My buddy");
}

static void editor_open(int page)
{
    pl.buddy = true;
    pl.in_game = false;
    ui_show(pl.menu, false);
    if (pl.menu_pet) { ui_show(pl.menu_pet, false); pet_set_paused(pl.menu_pet, true); }
    ui_show(pl.canvas, false);
    if (!pl.buddy_pet) {
        pl.buddy_pet = pet_create(pl.root, SCREEN_W);
        lv_obj_set_pos(pl.buddy_pet, 0, 0);
        pet_look_t bl = pet_default_look(SCREEN_W);
        bl.dy += PET_LOW_CELLS;   /* Playtime keeps the Figma height */
        pet_set_look(pl.buddy_pet, &bl);
        lv_obj_move_to_index(pl.buddy_pet, 0);
        pet_set_mood(pl.buddy_pet, PET_MOOD_HAPPY);
    }
    ui_show(pl.shade_top, true);
    ui_show(pl.shade_low, true);
    ui_show(pl.bottom, true);
    fx_rise(pl.bottom, 18, 80);
    editor_page(page);
    hal_play(HAL_SOUND_TICK);
}

/* Bath time's steps: soap Scrub, shower Rinse, wind Dry. The one under way has a lime outline, the
 * done ones a mint tick. */
static lv_obj_t *bath_pill(lv_obj_t *parent, const char *icon, const char *text, int state, int32_t x)
{
    lv_obj_t *c = ui_row(parent, 4);
    lv_obj_set_size(c, 98, 44);
    lv_obj_set_pos(c, x, 26);
    lv_obj_set_flex_align(c, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    ui_style_card(c, C_RAISED, LV_RADIUS_CIRCLE, C_ACTION, state == 1 ? LV_OPA_COVER : 0);
    if (state == 1) lv_obj_set_style_border_width(c, 2, 0);
    uint32_t col = state == 1 ? C_ACTION : state == 2 ? C_DONE : C_TEXT_MUTED;
    ui_icon(c, state == 2 ? "check" : icon, 20, col);
    ui_label(c, F_LABEL, col, text);
    return c;
}

/* Bath time: the three steps, and under them a bar for how far this one has got (it fills as the
 * child scrubs, rinses, dries; the steps are rebuilt only when one is done) */
static void bath_controls(const game_ui_t *ui)
{
    char sig[16];
    snprintf(sig, sizeof sig, "bath%d", ui->step);
    if (strcmp(sig, pl.sig)) {
        strcpy(pl.sig, sig);
        lv_obj_clean(pl.bottom);
        pl.score = NULL;
        static const char *const STEPS[3] = { "Scrub", "Rinse", "Dry" };
        static const char *const ICONS[3] = { "soap", "shower", "wind" };
        for (int i = 0; i < 3; i++) {
            lv_obj_t *c = bath_pill(pl.bottom, ICONS[i], STEPS[i], i == ui->step ? 1 : i < ui->step ? 2 : 0, 80 + i * 104);
            if (i == ui->step) fx_pop(c, 0);
        }
        lv_obj_t *track = ui_box(pl.bottom);
        lv_obj_set_size(track, 200, 12);
        lv_obj_set_pos(track, CENTER - 100, 80);
        ui_style_card(track, C_CHIP, 6, 0, 0);
        pl.bar_fill = ui_box(track);
        lv_obj_set_height(pl.bar_fill, 12);
        ui_style_card(pl.bar_fill, ui->step >= 3 ? C_DONE : C_ACTION, 6, 0, 0);
    }
    if (pl.bar_fill) {
        int32_t w = (int32_t)lroundf(12 + (ui->step >= 3 ? 1 : ui->progress) * 188);
        if (lv_obj_get_width(pl.bar_fill) != w) lv_obj_set_width(pl.bar_fill, w);
    }
}

static void game_controls(void)
{
    game_id_t g = game_current();
    if (g == GAME_DRESSUP) { dressup_controls(); return; }
    game_ui_t ui;
    game_ui(&ui);
    if (g == GAME_BATH) { bath_controls(&ui); return; }
    char line[48];
    switch (g) {
    case GAME_CARROT: snprintf(line, sizeof line, "%d carrot%s", ui.score, ui.score == 1 ? "" : "s"); break;
    case GAME_BUBBLES:
        if (ui.state == 0) snprintf(line, sizeof line, "Tap to play");
        else if (ui.record) snprintf(line, sizeof line, "New best %d!", ui.score);
        else if (ui.best) snprintf(line, sizeof line, "%d \xC2\xB7 best %d", ui.score, ui.best);
        else snprintf(line, sizeof line, "%d popped", ui.score);
        break;
    default: line[0] = 0; break;
    }
    char sig[160];
    snprintf(sig, sizeof sig, "%d|%s", g, line);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    pl.bar_fill = NULL;
    /* the score as a Status pill at y 381 */
    pl.score = status_pill_create(pl.bottom, MENU[g].icon, line, C_BONE);
    lv_obj_update_layout(pl.score);
    lv_obj_align(pl.score, LV_ALIGN_TOP_MID, 0, 47);
    fx_pop(pl.score, 0);
}

/* A classic game: its status pill (the count, or what to do) where the game says, or none. */
static void classic_controls(void)
{
    char icon[20], text[48], sig[160];
    bool on = classic_status(icon, sizeof icon, text, sizeof text);
    snprintf(sig, sizeof sig, "cl%d|%d|%s|%s", on, (int)classic_status_y(), icon, text);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    pl.bar_fill = NULL;
    set_header(NULL, NULL);   /* Maze Munch's name goes once it fills the screen */
    if (!on) return;
    pl.score = status_pill_create(pl.bottom, icon, text, C_BONE);
    lv_obj_update_layout(pl.score);
    lv_obj_align(pl.score, LV_ALIGN_TOP_MID, 0, classic_status_y() - lv_obj_get_y(pl.bottom));
    fx_pop(pl.score, 0);
}

/* ---------------------------------------------------------------- menu and games */
static void game_shown(const char *title)
{
    buddy_close();
    pl.in_game = true;
    pl.sig[0] = 0;
    pl.slot = 0;
    ui_show(pl.menu, false);
    if (pl.menu_pet) { ui_show(pl.menu_pet, false); pet_set_paused(pl.menu_pet, true); }
    ui_show(pl.canvas, !pl.classic);
    ui_show(pl.shade_top, !pl.classic);
    ui_show(pl.shade_low, !pl.classic);
    ui_show(pl.bottom, true);
    set_header(NULL, title);
    hal_play(HAL_SOUND_TICK);
}

/* As Chores: the row at rest is full size; one away 90 %, two away a little smaller again, further
 * ones fade out. */
static void game_row_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), k = fminf(ad, 1.0f), k2 = fminf(fmaxf(0.0f, ad - 1.0f), 1.0f), far = fmaxf(0.0f, ad - 2.0f);
    ui_row_scale(card, (int32_t)lroundf(256 * (1.0f - 0.10f * k - 0.06f * k2)), true);
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - 0.3f * k - 0.15f * k2) * fmaxf(0.0f, 1.0f - far / 0.6f)));
}

static void on_game_row(lv_event_t *e)
{
    int i = (int)(intptr_t)lv_event_get_user_data(e);
    if (GAME_ROWS[i].classic) {
        classic_id_t g = (classic_id_t)GAME_ROWS[i].id;
        pl.classic = true;
        classic_start(g);
        game_shown(CLASSIC[g].title);
        classic_controls();
        return;
    }
    game_id_t g = (game_id_t)GAME_ROWS[i].id;
    pl.classic = false;
    game_start(g, pl.pet);
    char t[40];
    named(t, sizeof t, MENU[g].title);
    game_shown(t);
}

static void on_back_wheel(lv_event_t *e);

/* A game's row (the Chore row's shape, 360 x 72, fully round, on the raised card): the game's
 * picture in lime, its name and how it's played, and a lime Play disc at the end. The last row,
 * Spin the wheel, goes back to the free-time wheel (a swipe right does too). */
static void game_row(int i, bool picture)
{
    bool spin = i < 0;
    lv_obj_t *slot = wheel_list_add(&pl.wl);
    lv_obj_t *card = ui_row(slot, 14);
    lv_obj_set_size(card, GL_W, GL_H);
    lv_obj_center(card);
    lv_obj_set_style_pad_left(card, 18, 0);
    lv_obj_set_style_pad_right(card, 12, 0);
    ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_bg_color(card, COL(C_CHIP), LV_STATE_PRESSED);
    const char *icon = spin ? "wheel" : GAME_ROWS[i].classic ? CLASSIC[GAME_ROWS[i].id].icon : MENU[GAME_ROWS[i].id].icon;
    lv_obj_t *ic = ui_icon(card, icon, 40, spin ? C_SYSTEM : C_LIME);
    lv_obj_set_size(ic, 40, 40);
    lv_image_set_inner_align(ic, LV_IMAGE_ALIGN_CENTER);
    lv_obj_t *body = ui_box(card);
    lv_obj_set_size(body, 10, LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(body, 1);
    lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
    char name[40], how[48];
    if (spin) snprintf(name, sizeof name, "Spin the wheel");
    else named(name, sizeof name, GAME_ROWS[i].classic ? CLASSIC[GAME_ROWS[i].id].title : MENU[GAME_ROWS[i].id].title);
    lv_obj_t *n = ui_label(body, F_ITEM, C_TEXT, name);
    lv_label_set_long_mode(n, LV_LABEL_LONG_DOT);
    lv_obj_set_size(n, lv_pct(100), lv_font_get_line_height(F_ITEM));
    if (!picture) {   /* picture view: the picture and the name are enough */
        if (spin) snprintf(how, sizeof how, "Back to the wheel");
        else named(how, sizeof how, GAME_ROWS[i].how);
        lv_obj_t *h = ui_label(body, F_DETAIL, C_TEXT_MUTED, how);
        lv_label_set_long_mode(h, LV_LABEL_LONG_DOT);
        lv_obj_set_size(h, lv_pct(100), lv_font_get_line_height(F_DETAIL));
    }
    if (!spin) {
        lv_obj_t *go = ui_box(card);
        lv_obj_set_size(go, 48, 48);
        ui_style_card(go, C_LIME, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_add_flag(go, LV_OBJ_FLAG_EVENT_BUBBLE);
        lv_obj_t *pi = ui_icon(go, "go", 22, C_ON_COLOR);
        lv_obj_center(pi);
    }
    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    if (spin) lv_obj_add_event_cb(card, on_back_wheel, LV_EVENT_CLICKED, NULL);
    else lv_obj_add_event_cb(card, on_game_row, LV_EVENT_CLICKED, (void *)(intptr_t)i);
}

static void open_menu(void)
{
    buddy_close();
    classic_stop();
    pl.in_game = false;
    pl.classic = false;
    pl.sig[0] = 0;
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    pl.bar_fill = NULL;
    ui_show(pl.bottom, false);
    ui_show(pl.menu, true);
    if (pl.menu_pet) { ui_show(pl.menu_pet, true); pet_set_paused(pl.menu_pet, false); pet_react(pl.menu_pet, PET_CLIP_WAVE); }
    ui_show(pl.canvas, false);
    ui_show(pl.shade_top, false);
    ui_show(pl.shade_low, false);
    set_header(NULL, NULL);   /* the list stays where it was: the game just played is at rest */
}

static void close_sliding(int dir);

static void on_back_wheel(lv_event_t *e)
{
    (void)e;
    if (pl.in_game || pl.see_you) return;
    hal_play(HAL_SOUND_TICK);
    mytoki_show_wheel();   /* even if Playtime was opened from Biscuit's room */
    close_sliding(SWIPE_RIGHT);
}

bool play_in_menu(void) { return pl.root && !pl.in_game && !pl.see_you && !pl.buddy && !pl.standalone; }
bool play_in_game(void) { return pl.root && pl.in_game && !pl.see_you; }

/* Swipe left or right: the menu turns its pages (left for the next games, right to come back), and
 * from the first page a swipe right leaves. A game ignores swipes (a drag is play): only the button
 * at 1 o'clock leaves it. Tilting never swipes. */
static bool on_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)user;
    if (dir == SWIPE_DOWN) return false;
    if (dir == SWIPE_UP && !pl.in_game && !pl.see_you && !pl.buddy) return false;   /* the list turning */
    if (pl.in_game && !pl.see_you) return false;   /* a game is left only by the button */
    if (!commit) return true;
    /* My pet: left for Dress up, right back to My buddy; right from My buddy leaves it */
    if (pl.buddy && !pl.see_you) {
        if (dir == SWIPE_LEFT) { if (!pl.editor_page) { editor_page(1); hal_play(HAL_SOUND_TICK); } return true; }
        if (dir == SWIPE_RIGHT && pl.editor_page) { editor_page(0); hal_play(HAL_SOUND_TICK); return true; }
        if (!pl.standalone) { open_menu(); return true; }
        close_sliding(dir);
        return true;
    }
    if (!pl.see_you && dir == SWIPE_LEFT) return true;   /* the games are one list: nothing to the left */
    close_sliding(dir);
    return true;
}

void play_button(void)
{
    if (!pl.root) return;
    if (pl.see_you || pl.standalone) { play_close(); return; }   /* My pet: the button is done */
    if (!pl.in_game) return;
    open_menu();   /* the way out of a game: back to the menu */
    hal_play(HAL_SOUND_TICK);
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
    pl.canvas = pl.bottom = pl.menu = pl.menu_pet = pl.shade_top = pl.shade_low = pl.timer = pl.bar_fill = NULL;
    pl.buddy_pet = NULL;
    pl.buddy = false;
    pl.head.root = NULL;
    memset(&pl.wl, 0, sizeof pl.wl);
    pl.classic = false;
    lv_free(pl.buf);
    pl.buf = NULL;
    forget_cache();
    lv_obj_add_event_cb(pl.root, on_ok, LV_EVENT_CLICKED, NULL);
    /* Figma "Playtime · See you later": the room, Biscuit waving, "Time to get ready", what's next */
    lv_obj_t *pet = pet_create(pl.root, SCREEN_W);
    lv_obj_set_pos(pet, 0, 0);
    pet_look_t sl = pet_default_look(SCREEN_W);
    sl.dy += PET_LOW_CELLS;   /* Playtime keeps the Figma height */
    pet_set_look(pet, &sl);
    pet_force_clip(pet, PET_CLIP_WAVE);
    scrim_create(pl.root);
    hill_t hl;
    hill_create(pl.root, &hl, NULL);
    if (pl.next[0]) hill_set_next(&hl, pl.next_icon, pl.next, pl.next_time);
    lime_card_t c;
    lime_card_create(pl.root, &c, 0);
    lime_card_set(&c, "clock", "Time to get ready", CARD_END_NONE);
    lv_obj_update_layout(c.root);
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, 322);
    header_t h;
    header_create(pl.root, &h);
    header_set(&h, ui_clock(), "See you later!", HEADER_TEXT, PILL_CALM, NULL, "Play again next free time");
    lv_obj_set_style_max_width(h.text, 300, 0);   /* one line: it would break as "free / time" at 272 */
    hal_play(HAL_SOUND_SOON);
    fx_rise(c.root, 14, 120);
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
    if (pl.buddy) { editor_controls(); return; }
    if (!pl.in_game) return; /* the menu's Biscuit draws himself */
    if (pl.classic) { classic_controls(); return; }   /* it plays on its own timer */
    game_update(STEP_MS);
    game_controls();
    draw_stage();
}

void play_set_paused(bool paused)
{
    if (!pl.root || !pl.timer_obj) return;
    if (paused) lv_timer_pause(pl.timer_obj);
    else lv_timer_resume(pl.timer_obj);
    if (pl.classic) classic_set_paused(paused);
    if (!paused && pl.in_game) motion_level();   /* picked up again: however it's held now is level */
}

void play_set_time_total(int32_t s) { if (pl.root && s > pl.total) { pl.total = s; play_set_time_left(pl.left); } }

void play_set_time_left(int32_t s)
{
    if (!pl.root || pl.see_you || pl.standalone) return;   /* My pet has no play time */
    pl.left = s;
    if (s <= 0) { see_you_later(); return; }
    if (s >= 3600) snprintf(pl.left_text, sizeof pl.left_text, "%d:%02d:%02d free time left", (int)(s / 3600), (int)(s / 60 % 60), (int)(s % 60));
    else snprintf(pl.left_text, sizeof pl.left_text, "%d:%02d free time left", (int)(s / 60), (int)(s % 60));
    set_header(NULL, NULL);
    /* the rim: what's left of the play time in mint, the whole of it amber under 10 minutes */
    if (s > pl.total) pl.total = s;
    if (pl.timer) {
        if (s < 600) timer_set(pl.timer, TIMER_HURRY, 1000, false);
        else timer_set(pl.timer, TIMER_PLENTY, (int16_t)((int64_t)s * 1000 / (pl.total ? pl.total : 1)), false);
    }
}

bool play_is_open(void) { return pl.root != NULL; }

static void free_buf(lv_event_t *e) { lv_free(lv_event_get_user_data(e)); }

static void forget(void)
{
    if (pl.timer_obj) lv_timer_delete(pl.timer_obj);
    classic_stop();
    if (pl.root && pl.buf) lv_obj_add_event_cb(pl.root, free_buf, LV_EVENT_DELETE, pl.buf);
    else lv_free(pl.buf);
    forget_cache();
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

void play_open(int32_t seconds_left, const char *next_title, const char *next_icon, const char *next_time, const char *pet_name,
               play_outfit_cb_t on_outfit, play_character_cb_t on_character)
{
    if (pl.root) return;
    memset(&pl, 0, sizeof pl);
    pl.on_outfit = on_outfit;
    pl.on_character = on_character;
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
    classic_create(pl.root);   /* the classic games draw here, under the header and the timer */
    pl.shade_top = shade(pl.root, 0, 128, false);
    pl.shade_low = shade(pl.root, 314, 152, true);

    pl.timer = timer_create(pl.root);

    /* the menu: the games as one list, like Chores, the rows turning under the header; a tap on a
     * row plays that game, and the last row (or a swipe right) goes back to the wheel */
    pl.menu = ui_box(pl.root);
    lv_obj_set_size(pl.menu, SCREEN_W, SCREEN_H);
    wheel_list_create(pl.menu, &pl.wl, 0, GL_TOP, SCREEN_W, SCREEN_H - GL_TOP, GL_FOCUS - GL_TOP, GL_ROW);
    pl.wl.style = game_row_style;
    bool picture = ui_picture();
    for (int i = 0; i < GAME_ROW_COUNT; i++) game_row(i, picture);
    game_row(-1, picture);
    wheel_list_focus(&pl.wl, 0, false);
    list_fade_create(pl.menu, GL_TOP);

    /* the header: the clock, the game's name, the play time left in a mint pill */
    header_create(pl.root, &pl.head);

    pl.bottom = ui_box(pl.root);
    lv_obj_set_size(pl.bottom, SCREEN_W, 132);
    lv_obj_set_pos(pl.bottom, 0, 334);

    open_menu();
    play_set_time_left(seconds_left);
    pl.timer_obj = lv_timer_create(step, STEP_MS, NULL);
    overlay_enter_push(pl.root);   /* opened by a tap on Biscuit: in from the right, out the same way */
}

/* My pet: a long tap on the pet, any time. The pet in its room, My buddy then Dress up a swipe
 * apart; a swipe right from My buddy (or the button) puts it away. */
void play_open_pet(const char *pet_name, play_outfit_cb_t on_outfit, play_character_cb_t on_character)
{
    if (pl.root) return;
    memset(&pl, 0, sizeof pl);
    pl.standalone = true;
    pl.on_outfit = on_outfit;
    pl.on_character = on_character;
    snprintf(pl.pet, sizeof pl.pet, "%s", pet_name && *pet_name ? pet_name : "Biscuit");
    pl.root = overlay_create();
    swipe_add(pl.root, on_swipe, NULL);
    pl.shade_top = shade(pl.root, 0, 128, false);
    pl.shade_low = shade(pl.root, 314, 152, true);
    header_create(pl.root, &pl.head);
    pl.bottom = ui_box(pl.root);
    lv_obj_set_size(pl.bottom, SCREEN_W, 132);
    lv_obj_set_pos(pl.bottom, 0, 334);
    editor_open(0);
    pl.timer_obj = lv_timer_create(step, STEP_MS, NULL);
    overlay_enter_pop(pl.root);   /* a long tap: it pops up from the middle, over the pet */
}
