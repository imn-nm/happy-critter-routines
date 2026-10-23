#include "fx.h"
#include "pages.h"
#include "theme.h"
#include "widgets.h"
#include "../pet/pet.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ================================================================ reward pictures */
const char *reward_icon(const char *icon)
{
    const char *key = icon && *icon ? icon : "gift";
    if (!strcmp(key, "movie")) return "film";
    if (!strcmp(key, "toy")) return "toys";
    if (!strcmp(key, "surprise")) return "gift";
    if (!strcmp(key, "outside")) return "kite";   /* a trip out; tasks' "outside" is the tree */
    return key;
}

/* ================================================================ rewards */
/* The rewards shop (Figma "Rewards · Shop v2", 1310:7010), on the MyToki 2 tokens like every other
 * page: the black screen with faint 7 px pinstripes of pink and chip for a wall, a scalloped awning
 * of lavender and hill-navy under the header (the stars to spend), and the rewards one to a shelf,
 * each shelf a little hill (the hairline, the raised face). A fade at the top and another at the
 * bottom take the shelves into the dark as they turn.
 * On a shelf: the picture standing on it, the name (and, under it, how many more stars when there
 * aren't enough), and at the right end the price as a pill: lime when the child can pay it (a tap
 * asks for it, at once: the pill is the choice, no screen to confirm it), calm purple when not, or
 * Asked once it's been asked for. A reward a grown-up has given leaves the shop. The shelves turn
 * like Chores and the day, the one at rest under the awning. */
#define SHOP_AWN_Y 134       /* the awning's rod, 9 px under the header's pill */
#define SHOP_WALL_Y 136      /* the pinstripes: from here, 295 px down */
#define SHOP_WALL_H 295
#define AWN_ROD 3
#define AWN_BAND 16
#define AWN_SCALLOP 36       /* a scallop's width (13 across the screen) */
#define SHOP_TOP 170         /* the shelves scroll from here, under the awning's scallops */
#define SHOP_ROW 96          /* a shelf: the reward above, the plank under it */
#define SHOP_FOCUS (SHOP_TOP + 6 + SHOP_ROW / 2)   /* the middle of the shelf at rest */
#define SHOP_PLANK 70        /* the plank's top, from the shelf's top */
#define SHOP_ICON 48         /* Figma: 46; the nearest icon drawn */
#define SHOP_X_ICON 41       /* its middle at x 65, y 46, as in the Figma */
#define SHOP_Y_ICON 22
#define SHOP_X_TEXT 108      /* the words: 200 wide, centred on the row's 92 */
#define SHOP_W_TEXT 200
#define SHOP_Y_PILL 27       /* the price pill's top */
#define SHOP_X_END 418       /* where the price pill stops */

static struct {
    page_cb_t on_tap;
    lv_obj_t *page, *wall, *awning, *empty;
    wheel_list_t wl;
    header_t head;
    char sig[256];
    char just[40];           /* the reward just asked for: its Asked pops */
    bool built;
} rw;

static void on_ask_tap(lv_event_t *e)
{
    int i = (int)(intptr_t)lv_event_get_user_data(e);
    if (rw.on_tap) rw.on_tap(i);
}

static void fill(lv_layer_t *l, int32_t x0, int32_t y0, int32_t x1, int32_t y1, uint32_t col, lv_opa_t opa, int32_t radius)
{
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = COL(col);
    d.bg_opa = opa;
    d.radius = radius;
    lv_area_t a = { x0, y0, x1, y1 };
    lv_draw_rect(l, &d, &a);
}

/* The wall: 7 px pinstripes, pink then chip, 14 px apart, at 14 % (only the part being redrawn). */
static void wall_draw(lv_event_t *e)
{
    lv_obj_t *o = lv_event_get_target(e);
    lv_layer_t *l = lv_event_get_layer(e);
    lv_area_t a;
    lv_obj_get_coords(o, &a);
    for (int32_t x = a.x1 - 1; x < a.x2; x += 14) {
        fill(l, x, a.y1, x + 6, a.y2, C_PINK, 36, 0);
        fill(l, x + 7, a.y1, x + 13, a.y2, C_CHIP, 36, 0);
    }
}

/* The awning: a hairline rod, then stripes of lavender and hill-navy, each ending in a scallop, a
 * soft shadow under them. Drawn over the shelves, so a shelf turning up goes under it. */
static void awning_draw(lv_event_t *e)
{
    lv_obj_t *o = lv_event_get_target(e);
    lv_layer_t *l = lv_event_get_layer(e);
    lv_area_t a;
    lv_obj_get_coords(o, &a);
    int32_t y = a.y1 + AWN_ROD, r = AWN_SCALLOP / 2;
    for (int32_t x = a.x1 - 1, k = 0; x < a.x2; x += AWN_SCALLOP, k++)   /* the shadow, 4 px down */
        fill(l, x, y + AWN_BAND - r + 4, x + AWN_SCALLOP - 1, y + AWN_BAND + r + 3, C_SCREEN, 150, LV_RADIUS_CIRCLE);
    for (int32_t x = a.x1 - 1, k = 0; x < a.x2; x += AWN_SCALLOP, k++) {
        uint32_t c = k % 2 ? C_HILL : C_SYSTEM;   /* Figma Awning: lavender and bg/hill */
        fill(l, x, y, x + AWN_SCALLOP - 1, y + AWN_BAND - 1, c, LV_OPA_COVER, 0);
        fill(l, x, y + AWN_BAND - r, x + AWN_SCALLOP - 1, y + AWN_BAND + r - 1, c, LV_OPA_COVER, LV_RADIUS_CIRCLE);
    }
    fill(l, a.x1, a.y1, a.x2, a.y1 + AWN_ROD - 1, C_HILL_LINE, LV_OPA_COVER, 0);
}

static lv_obj_t *drawn_box(lv_obj_t *page, int32_t y, int32_t h, lv_event_cb_t draw)
{
    lv_obj_t *o = ui_box(page);
    lv_obj_set_size(o, SCREEN_W, h);
    lv_obj_set_pos(o, 0, y);
    lv_obj_add_event_cb(o, draw, LV_EVENT_DRAW_MAIN, NULL);
    return o;
}

/* The shelves keep their size and colour wherever they are: the fades at the top and the bottom
 * of the screen do the dimming (Figma). */
static void shelf_style(lv_obj_t *card, float d) { (void)d; ui_row_fade(card, LV_OPA_COVER); }

/* Figma's two fades over the shelves: black at the top to clear by y 169 (under the awning), and
 * clear from y 389 to black by y 441 at the bottom. */
static lv_obj_t *shop_fade(lv_obj_t *page, int32_t x, int32_t y, int32_t w, int32_t h, uint8_t f0, uint8_t f1, bool from_top)
{
    lv_obj_t *o = ui_box(page);
    lv_obj_set_size(o, w, h);
    lv_obj_set_pos(o, x, y);
    lv_grad_dsc_t *g = lv_malloc_zeroed(sizeof(lv_grad_dsc_t));
    g->dir = LV_GRAD_DIR_VER;
    g->stops_count = 3;
    g->stops[0].color = g->stops[1].color = g->stops[2].color = COL(C_SCREEN);
    if (from_top) { g->stops[0].opa = LV_OPA_COVER; g->stops[0].frac = 0; g->stops[1].opa = LV_OPA_COVER; g->stops[1].frac = f0; g->stops[2].opa = LV_OPA_TRANSP; g->stops[2].frac = f1; }
    else { g->stops[0].opa = LV_OPA_TRANSP; g->stops[0].frac = f0; g->stops[1].opa = LV_OPA_COVER; g->stops[1].frac = f1; g->stops[2].opa = LV_OPA_COVER; g->stops[2].frac = 255; }
    lv_obj_set_style_bg_grad(o, g, 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    return o;
}

void rewards_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&rw, 0, sizeof rw);
    rw.on_tap = cb;
    rw.page = page;
    rw.wall = drawn_box(page, SHOP_WALL_Y, SHOP_WALL_H, wall_draw);
    wheel_list_create(page, &rw.wl, 0, SHOP_TOP, SCREEN_W, SCREEN_H - SHOP_TOP, SHOP_FOCUS - SHOP_TOP, SHOP_ROW);
    rw.wl.style = shelf_style;
    rw.awning = drawn_box(page, SHOP_AWN_Y, AWN_ROD + AWN_BAND + AWN_SCALLOP / 2 + 4, awning_draw);
    shop_fade(page, 51, 354, 360, 112, 79, 199, false);   /* clear at 31 %, black from 78 % */
    shop_fade(page, 31, 0, 400, 182, 145, 237, true);     /* black to 57 %, clear by 93 % */
    header_create(page, &rw.head);
    page_dots_create(page, 0);
    rw.empty = note_create(page, 230);
    ui_set_text(rw.empty, "No rewards yet.\nA grown-up can add some.");
    ui_show(rw.empty, false);
}

static void plank(lv_obj_t *row, int32_t y, int32_t h, uint32_t col, lv_opa_t opa)
{
    lv_obj_t *b = ui_box(row);
    lv_obj_set_size(b, SCREEN_W, h);
    lv_obj_set_pos(b, 0, y);
    lv_obj_set_style_bg_color(b, COL(col), 0);
    lv_obj_set_style_bg_opa(b, opa, 0);
}

/* A shelf: a little hill of a plank (the hairline on top, the raised face, a dark edge, a soft
 * shadow), the reward's picture standing on it, its name (how many more stars under it when there
 * aren't enough), and at the right end the price pill: lime to tap, calm purple, or Asked. */
static void shelf(const day_reward_t *rd, int idx, int stars, bool just)
{
    lv_obj_t *slot = wheel_list_add(&rw.wl);
    lv_obj_t *row = ui_box(slot);
    lv_obj_set_size(row, SCREEN_W, SHOP_ROW);
    plank(row, SHOP_PLANK + 14, 6, C_SCREEN, 150);
    plank(row, SHOP_PLANK, 2, C_HILL_LINE, LV_OPA_COVER);
    plank(row, SHOP_PLANK + 2, 10, C_RAISED, LV_OPA_COVER);
    plank(row, SHOP_PLANK + 12, 2, C_HILL, LV_OPA_COVER);
    bool enough = stars >= rd->cost, can = rd->state == REWARD_NONE && enough;
    lv_obj_t *ic = ui_icon(row, reward_icon(rd->icon), SHOP_ICON, C_TEXT);
    lv_obj_set_pos(ic, SHOP_X_ICON, SHOP_Y_ICON);
    /* the price pill at the right end: the star and the number, or Asked */
    pill_t pl;
    pill_create(row, &pl);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    if (rd->state == REWARD_WAITING) pill_set(&pl, PILL_SYSTEM, "clock", "Asked");
    else pill_set(&pl, can ? PILL_ACTION : PILL_CALM, "star-line", cost);
    if (can) {
        lv_obj_add_flag(pl.root, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_ext_click_area(pl.root, 10);
        lv_obj_set_style_bg_color(pl.root, COL(C_TEXT), LV_STATE_PRESSED);
        lv_obj_add_event_cb(pl.root, on_ask_tap, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    }
    lv_obj_update_layout(pl.root);
    int32_t end_x = SHOP_X_END - lv_obj_get_width(pl.root);
    lv_obj_set_pos(pl.root, end_x, SHOP_Y_PILL);
    if (just) fx_pop(pl.root, 0);
    /* the name (Item, two lines when it must), and under it how many more stars when there aren't
     * enough yet (Fine 16): a 200 x 92 column, its words centred */
    lv_obj_t *words = ui_box(row);
    lv_obj_set_size(words, SHOP_W_TEXT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(words, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(words, 2, 0);
    lv_obj_t *name = ui_label(words, F_ITEM, C_TEXT, rd->title);
    int32_t room = end_x - 8 - SHOP_X_TEXT < SHOP_W_TEXT ? end_x - 8 - SHOP_X_TEXT : SHOP_W_TEXT;
    ui_label_fit(name, F_ITEM, F_ITEM, room, 2);
    lv_obj_set_width(name, room);
    if (rd->state == REWARD_NONE && !enough) {
        char more[24];
        snprintf(more, sizeof more, "%d more star%s to go", rd->cost - stars, rd->cost - stars == 1 ? "" : "s");
        lv_obj_t *m = ui_label(words, F_FINE, C_TEXT_MUTED, more);
        lv_obj_set_width(m, room);
    }
    /* centred on the picture; three lines would cross the plank, so they sit on it instead */
    lv_obj_update_layout(words);
    int32_t wh = lv_obj_get_height(words), wy = 46 - wh / 2;
    if (wy + wh > SHOP_PLANK - 4) wy = SHOP_PLANK - 4 - wh;
    lv_obj_set_pos(words, SHOP_X_TEXT, wy < 0 ? 0 : wy);
}

void rewards_page_render(const day_plan_t *p, int stars, bool picture)
{
    (void)picture;
    char sig[256];
    int n = snprintf(sig, sizeof sig, "%d|%s|", stars, ui_clock());
    for (int i = 0; i < p->nrewards && n < (int)sizeof sig - 8; i++) n += snprintf(sig + n, sizeof sig - n, "%s%d,", p->rewards[i].id, p->rewards[i].state);
    if (!strcmp(sig, rw.sig)) return;
    /* the shelves change with the stars (what's affordable) and the rewards and their states, not the clock */
    const char *bar = strchr(sig, '|'), *obar = strchr(rw.sig, '|');
    const char *bar2 = bar ? strchr(bar + 1, '|') : NULL, *obar2 = obar ? strchr(obar + 1, '|') : NULL;
    bool same = rw.built && bar2 && obar2 && !strcmp(bar2, obar2) && atoi(sig) == atoi(rw.sig);
    strcpy(rw.sig, sig);
    char s[24];
    snprintf(s, sizeof s, "%d to spend", stars);
    header_set(&rw.head, ui_clock(), "Rewards", HEADER_PILL, PILL_STAR, "star-line", s);   /* the clock, as on Home and Chores */
    if (same) return;
    int keep = rw.built ? wheel_list_current(&rw.wl) : 0, shown = 0;
    wheel_list_clear(&rw.wl);
    for (int i = 0; i < p->nrewards; i++) {
        if (p->rewards[i].state == REWARD_APPROVED) continue;   /* given: it has left the shop */
        shelf(&p->rewards[i], i, stars, !strcmp(p->rewards[i].id, rw.just));
        shown++;
    }
    rw.just[0] = 0;
    if (shown) wheel_list_focus(&rw.wl, keep < shown ? keep : shown - 1, false);
    if (!rw.built && shown) fx_rise_children(rw.wl.list, 22, 45);   /* the first time: the shelves arrive one after another */
    ui_show(rw.empty, shown == 0);
    rw.built = true;
}

/* The reward just asked for (by its id): its Asked pops in when the shelves are next drawn. */
void rewards_page_asked(const char *id) { snprintf(rw.just, sizeof rw.just, "%s", id ? id : ""); }

void rewards_page_parallax(float t)
{
    int32_t back = (int32_t)lroundf(-t * SCREEN_W * 0.10f), front = (int32_t)lroundf(t * SCREEN_W * 0.08f);
    if (lv_obj_get_style_translate_x(rw.awning, 0) != back) lv_obj_set_style_translate_x(rw.awning, back, 0);
    if (lv_obj_get_style_translate_x(rw.wall, 0) != back) lv_obj_set_style_translate_x(rw.wall, back, 0);
    if (lv_obj_get_style_translate_x(rw.head.root, 0) != front) lv_obj_set_style_translate_x(rw.head.root, front, 0);
}

/* ================================================================ chores */
/* Figma "My day · Chores": the header with how many are done, then equal rows from y 130, the ones
 * to do first and the finished ones after; more scroll up. Tap a chore to tick it. */
#define CH_TOP 67            /* the list reaches up behind the header; rows scroll under it */
#define CH_FADE_Y 67         /* the fade behind the header: clear by y 135, the first row's top */
#define CH_FOCUS 171         /* rows 82 apart, the first 6 px under the pill as in Figma */
#define CH_ROW 82

static struct {
    page_cb_t on_done;
    lv_obj_t *page, *empty;
    header_t head;
    wheel_list_t wl;
    int just;              /* the chore the child just tapped here (-1: none) */
    lv_timer_t *hold;      /* while a ticked row settles in place, the list keeps its order... */
    bool flip;             /* ...then it is laid out again with the rows sliding to their new places */
    char sig[256];
} ch;

static void on_chore(lv_event_t *e)
{
    ch.just = (int)(intptr_t)lv_event_get_user_data(e);
    if (ch.on_done) ch.on_done(ch.just);
}

/* The hold is over: lay the list out again (the controller draws everything, and the rows flip). */
static void hold_over(lv_timer_t *t)
{
    (void)t;
    ch.hold = NULL;
    ch.flip = true;
    ch.sig[0] = 0;
    ui_render_now();
}

static void hold(uint32_t ms)
{
    if (ch.hold) { lv_timer_set_period(ch.hold, ms); lv_timer_reset(ch.hold); return; }
    ch.hold = lv_timer_create(hold_over, ms, NULL);
    lv_timer_set_repeat_count(ch.hold, 1);
}

/* The slot holding chore idx (keys are idx + 1), or NULL. */
static lv_obj_t *chore_slot(int idx)
{
    uint32_t n = lv_obj_get_child_count(ch.wl.list);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *slot = lv_obj_get_child(ch.wl.list, i);
        if ((intptr_t)lv_obj_get_user_data(slot) == idx + 1) return slot;
    }
    return NULL;
}

/* The chore the child just tapped turns done where it is: the box ticks, the row drifts from
 * lavender to a night card, its words go quiet, a little burst at the box. False when its row
 * isn't on the page. */
static bool tick_in_place(int idx, bool picture)
{
    lv_obj_t *slot = chore_slot(idx);
    if (!slot || !lv_obj_get_child_count(slot)) return false;
    lv_obj_t *card = lv_obj_get_child(slot, 0);
    uint32_t n = lv_obj_get_child_count(card);
    if (n < 3) return false;
    lv_obj_t *ic = lv_obj_get_child(card, 0), *body = lv_obj_get_child(card, 1), *chk = lv_obj_get_child(card, (int32_t)n - 1);
    lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_event_cb(card, on_chore);
    card_recolor(card, C_SYSTEM, C_RAISED, 360);
    lv_obj_set_style_bg_color(card, COL(C_RAISED), LV_STATE_PRESSED);
    ui_set_color(ic, C_TEXT);
    lv_obj_t *name = lv_obj_get_child(body, 0);
    if (name) ui_set_color(name, C_TEXT_MUTED);
    lv_obj_t *when = picture ? NULL : lv_obj_get_child(body, 1);
    if (when) { ui_set_text(when, "Done!"); ui_set_color(when, C_DONE); }
    checkbox_tick(chk);
    lv_obj_update_layout(ch.wl.list);
    lv_area_t a, pg;
    lv_obj_get_coords(chk, &a);
    lv_obj_get_coords(ch.page, &pg);
    int32_t ex = (a.x1 + a.x2) / 2 - pg.x1, ey = (a.y1 + a.y2) / 2 - pg.y1;
    fx_burst_cfg_t cfg = { .waves = 1, .wave_r0 = 10, .wave_span = 80 };
    fx_burst_create(ch.page, ex, ey, &cfg);
    fx_confetti(ch.page, ex, ey, 16, FX_PARTY, 6, 120);
    return true;
}

static void fmt_hour(char *buf, size_t n, int minutes)
{
    int h = (minutes / 60) % 24, m = minutes % 60, h12 = h % 12 == 0 ? 12 : h % 12;
    if (m) snprintf(buf, n, "%d:%02d %s", h12, m, ui_ampm(minutes));
    else snprintf(buf, n, "%d %s", h12, ui_ampm(minutes));
}

/* Like Today's schedule: the row on the line is full size; one away is an Edge row (90 %, 70 %), two
 * away a little smaller again (84 %, 55 %), and further ones fade out. Each row fades as one. */
static void chore_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), k = fminf(ad, 1.0f), k2 = fminf(fmaxf(0.0f, ad - 1.0f), 1.0f), far = fmaxf(0.0f, ad - 2.0f);
    ui_row_scale(card, (int32_t)lroundf(256 * (1.0f - 0.10f * k - 0.06f * k2)), true);
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - 0.3f * k - 0.15f * k2) * fmaxf(0.0f, 1.0f - far / 0.6f)));
}

void chores_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&ch, 0, sizeof ch);
    ch.on_done = cb;
    ch.just = -1;
    ch.page = page;
    wheel_list_create(page, &ch.wl, 0, CH_TOP, SCREEN_W, SCREEN_H - CH_TOP, CH_FOCUS - CH_TOP, CH_ROW);
    ch.wl.style = chore_style;
    list_fade_create(page, CH_FADE_Y);
    header_create(page, &ch.head);
    page_dots_create(page, 2);
    ch.empty = note_create(page, 200);
    ui_set_text(ch.empty, "Nothing to do right now.\nBiscuit says thanks!");
}

/* Chores whose window covers now (getActiveWindowChores); done ones stay. */
static bool chore_now(const day_chore_t *c, int now_min)
{
    if (c->from < 0 && c->to < 0) return true;
    int a = c->from < 0 ? 0 : c->from, b = c->to < 0 ? 24 * 60 - 1 : c->to;
    return now_min >= a && now_min <= b;
}

/* Figma "Chore row": 360 x 72, r 24: the icon, the name, when (or "Done!"), and a ring to tap;
 * lavender to do, a night card with a mint tick when done (a tap on it unchecks it). */
static void chore_card(const day_chore_t *c, int idx, bool picture)
{
    lv_obj_t *slot = wheel_list_add(&ch.wl);
    lv_obj_set_user_data(slot, (void *)(intptr_t)(idx + 1));   /* its key, for the flip */
    lv_obj_t *card = ui_row(slot, 14);
    lv_obj_set_size(card, 360, 72);
    lv_obj_center(card);
    lv_obj_set_style_pad_hor(card, 16, 0);
    bool done = c->done;
    ui_style_card(card, done ? C_RAISED : C_SYSTEM, LV_RADIUS_CIRCLE, 0, 0);   /* Figma "Chore row": fully round */
    uint32_t fg = done ? C_TEXT_MUTED : C_ON_COLOR;
    /* Figma "MyToki 2 / Chore row" (1073:4636): a 36 px icon slot; to do the icon fills it (navy),
     * done it is 26 px in the middle (cream) */
    lv_obj_t *ic = ui_icon(card, c->icon[0] ? c->icon : "sparkles", 36, done ? C_TEXT : C_ON_COLOR);
    lv_obj_set_size(ic, 36, 36);
    lv_image_set_inner_align(ic, LV_IMAGE_ALIGN_CENTER);
    lv_image_set_pivot(ic, 18, 18);
    if (done) lv_image_set_scale(ic, 256 * 26 / 36);
    lv_obj_t *body = ui_box(card);
    lv_obj_set_size(body, 10, LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(body, 1);
    lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
    lv_obj_t *name = ui_label(body, F_ITEM, fg, c->title);
    lv_obj_set_width(name, lv_pct(100));
    ui_label_fit(name, F_ITEM, F_LABEL, 360 - 2 * 16 - 36 - 48 - 2 * 14, 2);   /* the row less its padding, icon, ring and gaps */
    if (!picture) {
        char when[40];
        if (done) snprintf(when, sizeof when, "Done!");
        else if (c->from < 0 && c->to < 0) snprintf(when, sizeof when, "Anytime");
        else {
            char a[12], b[12];
            if (c->from >= 0) fmt_hour(a, sizeof a, c->from);
            if (c->to >= 0) fmt_hour(b, sizeof b, c->to);
            if (c->from >= 0 && c->to >= 0) snprintf(when, sizeof when, "%s to %s", a, b);
            else if (c->from >= 0) snprintf(when, sizeof when, "From %s", a);
            else snprintf(when, sizeof when, "By %s", b);
        }
        lv_obj_t *w = ui_label(body, F_DETAIL, done ? C_DONE : C_ON_COLOR, when);
        lv_label_set_long_mode(w, LV_LABEL_LONG_DOT);
        lv_obj_set_size(w, lv_pct(100), lv_font_get_line_height(F_DETAIL));
    }
    /* a tap checks it, or unchecks one done by mistake */
    checkbox_create(card, 48, done);
    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_style_bg_color(card, COL(done ? C_CHIP : C_TEXT), LV_STATE_PRESSED);
    lv_obj_add_event_cb(card, on_chore, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
}

static const day_plan_t *sort_plan;
static int cmp_due(const void *a, const void *b)
{
    const day_chore_t *x = &sort_plan->chores[*(const int *)a], *y = &sort_plan->chores[*(const int *)b];
    int tx = x->to < 0 ? 1 << 20 : x->to, ty = y->to < 0 ? 1 << 20 : y->to;
    return tx != ty ? tx - ty : *(const int *)a - *(const int *)b;
}

void chores_page_render(const day_plan_t *p, int now_min, bool picture)
{
    char sig[256];
    int n = snprintf(sig, sizeof sig, "%d|%s|", picture, ui_clock());
    for (int i = 0; i < p->nchores && n < (int)sizeof sig - 8; i++)
        if (chore_now(&p->chores[i], now_min)) n += snprintf(sig + n, sizeof sig - n, "%s%d,", p->chores[i].id, p->chores[i].done);
    if (!strcmp(sig, ch.sig)) return;
    /* the clock alone moved: only the header changes */
    const char *bar = strchr(sig, '|'), *bar2 = bar ? strchr(bar + 1, '|') : NULL;
    const char *obar = strchr(ch.sig, '|'), *obar2 = obar ? strchr(obar + 1, '|') : NULL;
    bool rows_same = bar2 && obar2 && !strcmp(bar2, obar2) && sig[0] == ch.sig[0];
    strcpy(ch.sig, sig);

    int order[DAY_MAX_CHORES], shown = 0, done = 0;
    for (int i = 0; i < p->nchores; i++) if (chore_now(&p->chores[i], now_min)) order[shown++] = i;
    sort_plan = p;
    qsort(order, (size_t)shown, sizeof(int), cmp_due);
    /* the ones to do by when they're due, then the finished ones */
    int sorted[DAY_MAX_CHORES], k = 0, focus = 0;
    for (int i = 0; i < shown; i++) if (!p->chores[order[i]].done) sorted[k++] = order[i];
    for (int i = 0; i < shown; i++) if (p->chores[order[i]].done) { sorted[k++] = order[i]; done++; }

    char s[24];
    snprintf(s, sizeof s, "%d of %d done", done, shown);
    header_set(&ch.head, ui_clock(), "Chores", HEADER_PILL, PILL_DONE, "listchecks", s);   /* the same icon as Home's Chores button */
    if (!rows_same) {
        if (ch.just >= 0 && !p->chores[ch.just].done) ch.flip = true;   /* unchecked: it slides back up among the ones to do */
        if (ch.just >= 0 && p->chores[ch.just].done && tick_in_place(ch.just, picture)) {
            /* ticked here: it turns done where it is, the count bounces, and after a beat the
             * finished one slides down to the end while the rest close up */
            fx_bounce(ch.head.pill.root, 8, 120);
            hold(620);
        } else if (!ch.hold) {
            wheel_mark_t marks[DAY_MAX_CHORES];
            int nm = ch.flip ? wheel_list_mark(&ch.wl, marks, DAY_MAX_CHORES) : 0;
            int keep = ch.flip ? wheel_list_current(&ch.wl) : focus;
            wheel_list_clear(&ch.wl);
            for (int i = 0; i < shown; i++) chore_card(&p->chores[sorted[i]], sorted[i], picture);
            wheel_list_focus(&ch.wl, keep, false);
            if (nm) wheel_list_flip(&ch.wl, marks, nm);
            else fx_rise_children(ch.wl.list, 22, 45);   /* a fresh list: the rows arrive one after another */
            ch.flip = false;
        }
        /* else: something changed while a tick settles; the hold lays everything out when it's over */
        ch.just = -1;
    }
    ui_show(ch.empty, shown == 0);
}

void chores_page_visible(bool visible) { (void)visible; }

void chores_page_parallax(float t)
{
    int32_t front = (int32_t)lroundf(t * SCREEN_W * 0.08f);
    if (lv_obj_get_style_translate_x(ch.head.root, 0) != front) lv_obj_set_style_translate_x(ch.head.root, front, 0);
}

lv_obj_t *chores_page_pet(void) { return NULL; }
