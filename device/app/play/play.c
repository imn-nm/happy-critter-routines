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

/* Figma "Playtime · Menu": 97 px circles, each with its icon and name. Page 0 is the four tapping
 * games in two rows of two; page 1 the three motion games, two above and one below. "%s" in a title
 * or label is the pet's name. Dress up is not a game: it lives in My pet (a long tap on the pet,
 * any time), with choosing the buddy, so it has no circle (page -1). */
#define MENU_PAGES 2
static const struct { const char *title, *label, *icon; int32_t x, y; int page; } MENU[GAME_COUNT] = {
    [GAME_DRESSUP] = { "Dress up", "Dress up", "shirt", 0, 0, -1 },
    [GAME_BATH] = { "Bath time", "Bath time", "droplets", 120, 126, 0 },
    [GAME_CARROT] = { "Carrot catch", "Carrot catch", "carrot", 248, 126, 0 },
    [GAME_BUBBLES] = { "Bubble pop", "Bubble pop", "bubble", 120, 250, 0 },
    [GAME_PEEKABOO] = { "Peekaboo", "Peekaboo", "eye", 248, 250, 0 },
    [GAME_ROLL] = { "Roll home", "Roll home", "move", 120, 126, 1 },
    [GAME_SAYS] = { "%s says", "%s says", "megaphone", 248, 126, 1 },
    [GAME_STACK] = { "Carrot stack", "Carrot stack", "layers", 184, 250, 1 },
};
static const struct { const char *title, *icon; } PAGE_HEAD[MENU_PAGES] = { { "Play with %s", "kite" }, { "Move with %s", "move" } };

/* Line icons for the dress-up items (the kit draws only Biscuit as pixel art). */
static const char *const ACC_ICON[PET_ACC_COUNT] = {
    [PET_ACC_HAT] = "party", [PET_ACC_STRAW] = "sun", [PET_ACC_CAP] = "cap", [PET_ACC_CROWN] = "crown",
    [PET_ACC_BOW] = "ribbon", [PET_ACC_BEANIE] = "snowflake", [PET_ACC_TIARA] = "sparkles", [PET_ACC_WIZARD] = "wand",
    [PET_ACC_SPECS] = "glasses", [PET_ACC_HEARTS] = "heart", [PET_ACC_SHADES] = "eye",
    [PET_ACC_SCARF] = "wind", [PET_ACC_BOWTIE] = "ribbon", [PET_ACC_MEDAL] = "medal", [PET_ACC_CAPE] = "shield",
};

static stage_t stage;

static struct {
    lv_obj_t *root, *canvas, *shade_top, *shade_low, *bottom, *menu, *menu_pet, *cue, *timer;
    int32_t total;              /* the play time there was at the start, for the timer */
    lv_obj_t *circle[GAME_COUNT], *chev_l, *chev_r;
    lv_obj_t *buddy_pet;        /* My pet: the pet trying each choice on */
    bool buddy;                 /* My pet is showing */
    bool standalone;            /* opened by a long tap on the pet, not from Playtime */
    int editor_page;            /* My pet: 0 My buddy, 1 Dress up */
    play_character_cb_t on_character;
    header_t head;
    char left_text[16];
    uint16_t *buf;
    lv_timer_t *timer_obj;
    bool in_game, see_you;
    int page;
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
static void menu_page(int page);

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
    stage_render(&stage, pl.buf);
    lv_obj_invalidate(pl.canvas);
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
    /* the menu: the clock and the pill only (a 32 px "Play with Biscuit" would wrap onto the games) */
    header_set(&pl.head, ui_clock(), pl.in_game ? head_title : NULL, HEADER_PILL, PILL_DONE, "kite", pl.left_text);
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
        lv_obj_t *face = pet_face_create_of(b, i, i == ch ? col : 0, 2, COL(i == ch ? C_INK : C_GLASS));
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

/* Biscuit says: the move he is calling, as a cream row (Biscuit speaks): the icon and the word. */
static lv_obj_t *cue_row(lv_obj_t *parent, const char *icon, const char *word)
{
    lv_obj_t *c = ui_row(parent, 10);
    lv_obj_set_height(c, 44);
    lv_obj_set_style_pad_hor(c, 18, 0);
    lv_obj_set_flex_align(c, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    ui_style_card(c, C_BONE, 22, 0, 0);
    ui_icon(c, icon, 24, C_NAVY);
    ui_label(c, F_BUTTON, C_NAVY, word);
    return c;
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
    case GAME_ROLL:
        if (ui.best) snprintf(line, sizeof line, "Maze %d of 3  \xC2\xB7  Best %d:%02d.%d", ui.score, ui.best / 60000, (ui.best / 1000) % 60, (ui.best / 100) % 10);
        else snprintf(line, sizeof line, "Maze %d of 3", ui.score);
        break;
    case GAME_SAYS:
        if (ui.cue[0]) snprintf(line, sizeof line, "%s", ui.cue);
        else if (ui.best) snprintf(line, sizeof line, "Best run %d", ui.best);
        else snprintf(line, sizeof line, "Tap to play");
        break;
    case GAME_STACK: snprintf(line, sizeof line, "%d high  \xC2\xB7  Best %d", ui.score, ui.best); break;
    default: line[0] = 0; break;
    }
    if (pl.cue) ui_show(pl.cue, g == GAME_SAYS && !strcmp(ui.cue_icon, "circle-dot"));
    char sig[160];
    snprintf(sig, sizeof sig, "%d|%d|%s|%s", g, ui.step, ui.cue_icon, line);
    if (!strcmp(sig, pl.sig)) return;
    strcpy(pl.sig, sig);
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    if (g == GAME_BATH) {
        /* Figma "Playtime · Bath time": 1 Scrub · 2 Rinse · 3 Dry at y 372 */
        static const char *const STEPS[3] = { "1 Scrub", "2 Rinse", "3 Dry" };
        for (int i = 0; i < 3; i++) { lv_obj_t *c = step_pill(pl.bottom, STEPS[i], i == ui.step, false, 99 + i * 92); lv_obj_set_y(c, 38); if (i == ui.step) fx_pop(c, 0); }
    } else if (g == GAME_SAYS && ui.cue[0]) {
        lv_obj_t *c = cue_row(pl.bottom, ui.cue_icon, ui.cue);
        lv_obj_update_layout(c);
        lv_obj_align(c, LV_ALIGN_TOP_MID, 0, 40);
        fx_pop(c, 0);
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
    buddy_close();
    pl.in_game = true;
    pl.sig[0] = 0;
    pl.slot = 0;
    game_start(g, pl.pet);
    ui_show(pl.menu, false);
    if (pl.menu_pet) { ui_show(pl.menu_pet, false); pet_set_paused(pl.menu_pet, true); }
    ui_show(pl.canvas, true);
    ui_show(pl.shade_top, true);
    ui_show(pl.shade_low, true);
    ui_show(pl.bottom, true);
    char t[40];
    named(t, sizeof t, MENU[g].title);
    set_header(MENU[g].icon, t);
    hal_play(HAL_SOUND_TICK);
}

/* One page of the ring: its circles spring in, a chevron points at the other page. */
static void menu_page(int page)
{
    pl.page = page;
    for (int g = 0; g < GAME_COUNT; g++) if (pl.circle[g]) ui_show(pl.circle[g], MENU[g].page == page);
    ui_show(pl.chev_r, page < MENU_PAGES - 1);
    ui_show(pl.chev_l, page > 0);
    fx_spring_children(pl.menu, 50);
    char t[40];
    named(t, sizeof t, PAGE_HEAD[page].title);
    set_header(PAGE_HEAD[page].icon, t);
}

static void on_chevron(lv_event_t *e)
{
    int dir = (int)(intptr_t)lv_event_get_user_data(e);
    int to = pl.page + dir;
    if (to < 0 || to >= MENU_PAGES) return;
    menu_page(to);
    hal_play(HAL_SOUND_TICK);
}

static void open_menu(void)
{
    buddy_close();
    pl.in_game = false;
    pl.sig[0] = 0;
    lv_obj_clean(pl.bottom);
    pl.score = NULL;
    ui_show(pl.bottom, false);
    if (pl.cue) ui_show(pl.cue, false);
    ui_show(pl.menu, true);
    if (pl.menu_pet) { ui_show(pl.menu_pet, true); pet_set_paused(pl.menu_pet, false); pet_react(pl.menu_pet, PET_CLIP_WAVE); }
    ui_show(pl.canvas, false);
    ui_show(pl.shade_top, false);
    ui_show(pl.shade_low, false);
    menu_page(pl.page);   /* back to the page the game came from */
}

static void close_sliding(int dir);

/* Swipe left or right: a game goes back to the menu; the menu turns its pages (left for the
 * motion games, right to come back), and from the first page a swipe right leaves. In Carrot
 * catch and Bath time a sideways drag on the stage is play, so there the swipe has to start
 * outside it (the title or the controls), unless the game is over. Tilting never swipes. */
static bool on_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)user;
    if (dir == SWIPE_DOWN) return false;
    if (pl.in_game && !pl.see_you && game_drag_active()) {
        if (start.y > 100 && start.y < 330) return false;
    }
    if (!commit) return true;
    /* My pet: left for Dress up, right back to My buddy; right from My buddy leaves it */
    if (pl.buddy && !pl.see_you) {
        if (dir == SWIPE_LEFT) { if (!pl.editor_page) { editor_page(1); hal_play(HAL_SOUND_TICK); } return true; }
        if (dir == SWIPE_RIGHT && pl.editor_page) { editor_page(0); hal_play(HAL_SOUND_TICK); return true; }
        if (!pl.standalone) { open_menu(); return true; }
        close_sliding(dir);
        return true;
    }
    if (pl.in_game && !pl.see_you) { open_menu(); return true; }
    if (!pl.see_you) {
        if (dir == SWIPE_LEFT) { if (pl.page < MENU_PAGES - 1) { menu_page(pl.page + 1); hal_play(HAL_SOUND_TICK); } return true; }
        if (pl.page > 0) { menu_page(pl.page - 1); hal_play(HAL_SOUND_TICK); return true; }
    }
    close_sliding(dir);
    return true;
}

void play_button(void)
{
    if (!pl.root) return;
    if (pl.see_you || pl.standalone) { play_close(); return; }   /* My pet: the button is done */
    if (pl.in_game) game_button();
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
    pl.canvas = pl.bottom = pl.menu = pl.menu_pet = pl.shade_top = pl.shade_low = pl.cue = pl.timer = NULL;
    pl.buddy_pet = NULL;
    pl.buddy = false;
    pl.head.root = NULL;
    pl.chev_l = pl.chev_r = NULL;
    memset(pl.circle, 0, sizeof pl.circle);
    lv_free(pl.buf);
    pl.buf = NULL;
    lv_obj_add_event_cb(pl.root, on_ok, LV_EVENT_CLICKED, NULL);
    /* Figma "Playtime · See you later": the room, Biscuit waving, "Time to get ready", what's next */
    lv_obj_t *pet = pet_create(pl.root, SCREEN_W);
    lv_obj_set_pos(pet, 0, 0);
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
    game_update(STEP_MS);
    game_controls();
    draw_stage();
}

void play_set_time_total(int32_t s) { if (pl.root && s > pl.total) { pl.total = s; play_set_time_left(pl.left); } }

void play_set_time_left(int32_t s)
{
    if (!pl.root || pl.see_you || pl.standalone) return;   /* My pet has no play time */
    pl.left = s;
    if (s <= 0) { see_you_later(); return; }
    snprintf(pl.left_text, sizeof pl.left_text, "%d:%02d left", (int)(s / 60), (int)(s % 60));
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
    pl.shade_top = shade(pl.root, 0, 128, false);
    pl.shade_low = shade(pl.root, 314, 152, true);

    pl.timer = timer_create(pl.root);

    /* the menu (Figma Playtime · Menu): no room, the games in rows of three and two, a page at a time */
    pl.menu = ui_box(pl.root);
    lv_obj_set_size(pl.menu, SCREEN_W, SCREEN_H);
    bool picture = ui_picture();
    for (int g = 0; g < GAME_COUNT; g++) {
        if (MENU[g].page < 0) continue;   /* Dress up: in My pet */
        lv_obj_t *t = ui_box(pl.menu);
        pl.circle[g] = t;
        lv_obj_set_size(t, 140, 122);   /* the 98 tile, wider so a long name fits on one line */
        lv_obj_set_pos(t, MENU[g].x - 21, MENU[g].y);
        lv_obj_add_flag(t, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(t, on_game, LV_EVENT_CLICKED, (void *)(intptr_t)g);
        lv_obj_t *b = ui_box(t);
        lv_obj_set_size(b, 88, 88);
        lv_obj_align(b, LV_ALIGN_TOP_MID, 0, 0);
        ui_style_card(b, C_RAISED, LV_RADIUS_CIRCLE, C_CHIP, LV_OPA_COVER);
        lv_obj_set_style_border_width(b, 2, 0);
        lv_obj_add_flag(b, LV_OBJ_FLAG_EVENT_BUBBLE);
        lv_obj_set_style_bg_color(b, COL(C_CHIP), LV_STATE_PRESSED);
        lv_obj_t *ic = ui_icon(b, MENU[g].icon, 36, C_LIME);
        lv_obj_center(ic);
        if (picture && MENU[g].page > 0) continue;   /* picture view: the motion games are icon-first */
        char label[32];
        named(label, sizeof label, MENU[g].label);
        lv_obj_t *l = ui_label(t, F_LABEL, C_BONE, label);
        lv_obj_set_size(l, 140, lv_font_get_line_height(F_LABEL));
        lv_label_set_long_mode(l, LV_LABEL_LONG_DOT);
        lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_align(l, LV_ALIGN_TOP_MID, 0, 94);
    }
    /* small chevrons inside the rim, between the rows, pointing at the other page */
    for (int i = 0; i < 2; i++) {
        lv_obj_t *b = ui_box(pl.menu);
        lv_obj_set_size(b, 32, 32);
        lv_obj_set_pos(b, i ? 408 : 26, 262);
        ui_style_card(b, C_GLASS, LV_RADIUS_CIRCLE, C_LINE, LV_OPA_COVER);
        lv_obj_set_style_bg_color(b, COL(C_LINE), LV_STATE_PRESSED);
        lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_ext_click_area(b, 10);
        lv_obj_add_event_cb(b, on_chevron, LV_EVENT_CLICKED, (void *)(intptr_t)(i ? 1 : -1));
        lv_obj_t *ic = ui_icon(b, i ? "chevron" : "chevron-left", 16, C_BONE);
        lv_obj_center(ic);
        if (i) pl.chev_r = b; else pl.chev_l = b;
    }
    /* the arc at 1 o'clock while Biscuit says "Button" */
    pl.cue = cue_create(pl.root);
    ui_show(pl.cue, false);

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
    overlay_enter_push(pl.root);
}
