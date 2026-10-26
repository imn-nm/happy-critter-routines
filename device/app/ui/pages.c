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
 * of lavender and chip under the header (the stars to spend), and the rewards one to a shelf,
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
/* The younger child's shop (Figma Younger · Rewards · Shop): the title alone, five big stars to spend
 * (36, 46 apart, at y 68), the awning higher (its rod at y 108), and taller shelves 110 apart from y
 * 154: the picture (71) in a black circle (91), the name, the price as small star pips (24), and a 61
 * lime circle with a star to ask (lavender with a clock once asked; none while there aren't enough). */
#define PIC_AWN_Y 108
#define PIC_TOP 146
#define PIC_ROW 110
#define PIC_FOCUS (154 + 106 / 2)
#define PIC_PLANK 92

static struct {
    page_cb_t on_tap;
    lv_obj_t *page, *wall, *awning, *empty, *pips, *fade_top;
    bool pic;                /* laid out for the younger child */
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

/* The awning: a hairline rod, then stripes of lavender and chip, each ending in a scallop, a
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
        uint32_t c = k % 2 ? C_CHIP : C_SYSTEM;   /* Figma Awning: lavender and bg/chip (user, 2026-10-22) */
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
    rw.fade_top = shop_fade(page, 31, 0, 400, 182, 145, 237, true);     /* black to 57 %, clear by 93 % */
    header_create(page, &rw.head);
    rw.pips = star_pips_create(page, 36, 46);
    lv_obj_set_pos(rw.pips, CENTER - (4 * 46 + 36) / 2, 68);
    ui_show(rw.pips, false);
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
    /* a grown-up's no puts it back on the shelf: it can be asked for again */
    bool open = rd->state == REWARD_NONE || rd->state == REWARD_DENIED;
    bool enough = stars >= rd->cost, can = open && enough;
    lv_obj_t *ic = ui_icon(row, reward_icon(rd->icon), SHOP_ICON, C_TEXT);
    lv_obj_set_pos(ic, SHOP_X_ICON, SHOP_Y_ICON);
    /* the price pill at the right end: the star and the number, or Asked; none while there aren't
     * enough stars (Figma Shelf · Need more: "14 more stars to go" says it) */
    pill_t pl;
    pill_create(row, &pl);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    if (rd->state == REWARD_WAITING) pill_set(&pl, PILL_SYSTEM, "clock", "Asked");
    else pill_set(&pl, can ? PILL_ACTION : PILL_CALM, "star-line", cost);
    ui_show(pl.root, rd->state == REWARD_WAITING || can);
    if (can) {
        lv_obj_add_flag(pl.root, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_ext_click_area(pl.root, 10);
        lv_obj_set_style_bg_color(pl.root, COL(C_TEXT), LV_STATE_PRESSED);
        lv_obj_add_event_cb(pl.root, on_ask_tap, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    }
    lv_obj_update_layout(pl.root);
    int32_t end_x = lv_obj_has_flag(pl.root, LV_OBJ_FLAG_HIDDEN) ? SHOP_X_END : SHOP_X_END - lv_obj_get_width(pl.root);
    lv_obj_set_pos(pl.root, end_x, SHOP_Y_PILL + (38 - lv_obj_get_height(pl.root)) / 2);
    if (just) fx_pop(pl.root, 0);
    /* the name (Item, two lines when it must), and under it how many more stars when there aren't
     * enough yet (Fine 16): a 200 x 92 column, its words centred */
    lv_obj_t *words = ui_box(row);
    lv_obj_set_size(words, SHOP_W_TEXT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(words, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(words, 2, 0);
    lv_obj_t *name = ui_label(words, &font_pop600_24, C_TEXT, rd->title);   /* Figma Shelf: Poppins SemiBold 24 */
    int32_t room = end_x - 8 - SHOP_X_TEXT < SHOP_W_TEXT ? end_x - 8 - SHOP_X_TEXT : SHOP_W_TEXT;
    ui_label_fit(name, &font_pop600_24, F_ITEM, room, 2);
    lv_obj_set_width(name, room);
    if (open && !enough) {
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

/* A younger child's shelf: the picture in its circle, the name and the price as pips (lit for the stars
 * they have towards it), the round button at the end. A price over five shows as five pips that
 * fill in step. */
static void shelf_pic(const day_reward_t *rd, int idx, int stars, bool just)
{
    lv_obj_t *slot = wheel_list_add(&rw.wl);
    lv_obj_t *row = ui_box(slot);
    lv_obj_set_size(row, SCREEN_W, 106);
    lv_obj_set_pos(row, 0, (PIC_ROW - 106) / 2);
    plank(row, PIC_PLANK + 14, 6, C_SCREEN, 150);
    plank(row, PIC_PLANK, 2, C_HILL_LINE, LV_OPA_COVER);
    plank(row, PIC_PLANK + 2, 10, C_RAISED, LV_OPA_COVER);
    plank(row, PIC_PLANK + 12, 2, C_HILL, LV_OPA_COVER);
    bool open = rd->state == REWARD_NONE || rd->state == REWARD_DENIED, asked = rd->state == REWARD_WAITING;
    bool can = open && stars >= rd->cost;
    uint32_t fg = asked ? C_NEXT_TASK : C_TEXT;   /* Figma: an asked treat in iris */
    lv_obj_t *disc = ui_box(row);
    lv_obj_set_size(disc, 91, 91);
    lv_obj_set_pos(disc, 34, 0);
    ui_style_card(disc, 0x040605, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_t *ic = ui_icon(disc, reward_icon(rd->icon), 72, fg);
    ui_icon_px(ic, reward_icon(rd->icon), 71);
    lv_obj_center(ic);
    lv_obj_t *name = ui_label(row, &font_pop600_24, fg, rd->title);
    ui_label_fit(name, &font_pop600_24, F_ITEM, 238, 1);   /* one line over the pips */
    lv_obj_set_width(name, 238);
    lv_obj_set_pos(name, 131, 26 + (lv_font_get_line_height(&font_pop600_24) - lv_font_get_line_height(lv_obj_get_style_text_font(name, 0))) / 2);
    int cost = rd->cost > 0 ? rd->cost : 1, have = stars < cost ? stars : cost;
    int shown = cost < 5 ? cost : 5, lit = cost <= 5 ? have : (have * 5) / cost;
    lv_obj_t *pips = star_pips_create(row, 24, 27);
    star_pips_set(pips, shown, asked ? shown : lit);
    lv_obj_set_pos(pips, 131, 64);
    if (asked || can) {
        lv_obj_t *b = ui_box(row);
        lv_obj_set_size(b, 61, 61);
        lv_obj_set_pos(b, 370, 28);
        ui_style_card(b, asked ? C_SYSTEM : C_ACTION, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_center(ui_icon(b, asked ? "clock" : "star-line", 28, C_ON_COLOR));
        if (can) {
            lv_obj_add_flag(b, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_ext_click_area(b, 10);
            lv_obj_set_style_bg_color(b, COL(C_TEXT), LV_STATE_PRESSED);
            lv_obj_add_event_cb(b, on_ask_tap, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
        }
        if (just) fx_pop(b, 0);
    }
}

/* The shop laid out for the age: the younger child's has the stars counted and the bigger shelves. */
static void shop_layout(bool pic)
{
    if (rw.built && pic == rw.pic) return;
    rw.pic = pic;
    lv_obj_set_y(rw.awning, pic ? PIC_AWN_Y : SHOP_AWN_Y);
    lv_obj_set_y(rw.wall, (pic ? PIC_AWN_Y : SHOP_AWN_Y) + 2);
    lv_obj_set_height(rw.wall, pic ? 344 : SHOP_WALL_H);
    lv_obj_set_y(rw.fade_top, pic ? PIC_AWN_Y - SHOP_AWN_Y : 0);   /* the fade rides up with the awning */
    int32_t top = pic ? PIC_TOP : SHOP_TOP;
    lv_obj_set_y(rw.wl.list, top);
    lv_obj_set_height(rw.wl.list, SCREEN_H - top);
    rw.wl.row_h = pic ? PIC_ROW : SHOP_ROW;
    wheel_list_set_focus(&rw.wl, (pic ? PIC_FOCUS : SHOP_FOCUS) - top);
    ui_show(rw.pips, pic);
    rw.sig[0] = 0;
}

void rewards_page_render(const day_plan_t *p, int stars, bool picture)
{
    shop_layout(picture);
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
    if (picture) {   /* the title, and the stars counted under it */
        header_set(&rw.head, NULL, "Rewards", HEADER_NONE, PILL_STAR, NULL, NULL);
        star_pips_set(rw.pips, 5, stars < 5 ? stars : 5);
    } else {
        header_set(&rw.head, ui_clock(), "Rewards", HEADER_PILL, PILL_STAR, "star-line", s);   /* the clock, as on Home and Chores */
    }
    if (same) return;
    int keep = rw.built ? wheel_list_current(&rw.wl) : 0, shown = 0;
    wheel_list_clear(&rw.wl);
    for (int i = 0; i < p->nrewards; i++) {
        if (p->rewards[i].state == REWARD_APPROVED) continue;   /* given: it has left the shop (a no stays) */
        if (picture) shelf_pic(&p->rewards[i], i, stars, !strcmp(p->rewards[i].id, rw.just));
        else shelf(&p->rewards[i], i, stars, !strcmp(p->rewards[i].id, rw.just));
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
/* Figma "My day · Chores" (1460:9008): the header with how many are done, then the List rows: the
 * finished ones above, the first to do on the line (y 216..295; the younger child's at 185..281), the
 * rest below; more scroll up. Tap a chore to tick it. */
#define CH_TOP 67            /* the list reaches up behind the header; rows scroll under it */
#define CH_FADE_Y 67         /* the fade behind the header */
#define CH_FOCUS 256
#define CH_PIC_FOCUS 233

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
    (void)picture;
    lv_obj_t *slot = chore_slot(idx);
    if (!slot || !lv_obj_get_child_count(slot)) return false;
    lv_obj_t *card = lv_obj_get_child(slot, 0), *chk = list_row_box(card);
    if (!chk) return false;
    lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_event_cb(card, on_chore);
    list_row_mark_done(card);
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

void chores_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&ch, 0, sizeof ch);
    ch.on_done = cb;
    ch.just = -1;
    ch.page = page;
    wheel_list_create(page, &ch.wl, 0, CH_TOP, SCREEN_W, SCREEN_H - CH_TOP, CH_FOCUS - CH_TOP, LROW_STEP);
    ch.wl.style = list_row_style;
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

/* A chore's row (List rows, widgets.h): lavender to do with when it's due, a night card with "Done!"
 * and a ticked box when done (a tap on it unchecks it); the younger child's has the name alone. */
static void chore_card(const day_chore_t *c, int idx, bool picture)
{
    lv_obj_t *slot = wheel_list_add(&ch.wl);
    lv_obj_set_user_data(slot, (void *)(intptr_t)(idx + 1));   /* its key, for the flip */
    bool done = c->done;
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
    const char *icon = c->icon[0] ? c->icon : "sparkles";
    lv_obj_t *card = list_row_create(slot, done ? LROW_CHORE_DONE : LROW_CHORE, picture, picture ? picture_icon(icon, c->title) : icon,
                                     c->title, when, LROW_END_CHECK, done);
    /* a tap checks it, or unchecks one done by mistake */
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
    /* the finished ones above (Figma Chores · One done), then the ones to do by when they're due,
     * the first of them on the line */
    int sorted[DAY_MAX_CHORES], k = 0, focus = 0;
    for (int i = 0; i < shown; i++) if (p->chores[order[i]].done) { sorted[k++] = order[i]; done++; }
    focus = done < shown ? done : shown - 1;
    for (int i = 0; i < shown; i++) if (!p->chores[order[i]].done) sorted[k++] = order[i];

    char s[24];
    snprintf(s, sizeof s, "%d of %d done", done, shown);
    /* the house, as on Home's Chores button; the younger child's page has the title alone */
    if (picture) header_set(&ch.head, NULL, "Chores", HEADER_NONE, PILL_DONE, NULL, NULL);
    else header_set(&ch.head, ui_clock(), "Chores", HEADER_PILL, PILL_DONE, "house", s);
    if ((ch.wl.focus_y != (picture ? CH_PIC_FOCUS : CH_FOCUS) - CH_TOP) || ch.wl.row_h != (picture ? LROW_PIC_STEP : LROW_STEP)) {
        ch.wl.row_h = picture ? LROW_PIC_STEP : LROW_STEP;
        wheel_list_set_focus(&ch.wl, (picture ? CH_PIC_FOCUS : CH_FOCUS) - CH_TOP);
        rows_same = false;
    }
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
