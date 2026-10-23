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
/* The rewards shop: a little toy shop. Purple striped wallpaper with tiny sparkles, a striped
 * coral-and-cream awning under the header (the stars to spend), and the rewards one to a wooden
 * shelf: the picture standing on the shelf (each in its own colour), the name with the price right
 * after it (and how many more stars, under them, when there aren't enough yet), and at the end a
 * lime Ask, or Asked. Ask sends the request at once (the button is the choice: no screen to confirm it). The
 * shelves turn like the other lists (Chores, the day), the one at rest under the awning, the ones
 * further down fading. */
#define SHOP_AWN_Y 128       /* the awning: its rod's top, just under the header's pill */
#define SHOP_TOP 166         /* the shelves scroll from here, under the awning's scallops */
#define SHOP_ROW 100         /* a shelf: the reward above, the plank under it */
#define SHOP_FOCUS (SHOP_TOP + 8 + SHOP_ROW / 2)   /* the middle of the shelf at rest */
#define SHOP_PLANK 74        /* the plank's top face, from the shelf's top */
#define SHOP_MID 44          /* the words' and the end's middle, from the shelf's top (two lines clear the plank) */
#define SHOP_X_ICON 46
#define SHOP_X_TEXT 106
#define SHOP_X_END 414       /* where the end (Ask, how many more, Asked) stops */

#define WALL_A 0x1C1736      /* the wallpaper's stripes */
#define WALL_B 0x221C42
#define WALL_SPARK 0x3A3170  /* the sparkles in the lighter stripes */
#define AWN_RED 0xFF8F91     /* the awning: coral and cream */
#define AWN_ROD 0x5B3B25
#define WOOD_TOP 0xE3AE72    /* a shelf: its top face, its front, its bottom edge */
#define WOOD_FRONT 0xB9814E
#define WOOD_EDGE 0x7A5232
/* each reward's picture in its own colour, in turn */
static const uint32_t SHOP_TINT[] = { C_PINK, C_DONE, 0xFFCD4D, C_SYSTEM, 0x8FD3FF, AWN_RED };

static struct {
    page_cb_t on_tap;
    lv_obj_t *page, *scene, *awning, *empty;
    wheel_list_t wl;
    header_t head;
    uint16_t *buf;
    char sig[256];
    char just[40];           /* the reward just asked for: its "Asked" pops */
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

/* The wall, drawn once: 28 px stripes, a four-point sparkle in every other light stripe (staggered
 * rows), and the top darkening to the night behind the header's words. */
static void shop_scene(lv_obj_t *page)
{
    rw.buf = lv_malloc((size_t)SCREEN_W * SCREEN_H * 2);
    rw.scene = lv_canvas_create(page);
    lv_canvas_set_buffer(rw.scene, rw.buf, SCREEN_W, SCREEN_H, LV_COLOR_FORMAT_RGB565);
    lv_obj_set_pos(rw.scene, 0, 0);
    lv_obj_remove_flag(rw.scene, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    lv_layer_t l;
    lv_canvas_init_layer(rw.scene, &l);
    for (int32_t x = 0, k = 0; x < SCREEN_W; x += 28, k++) fill(&l, x, 0, x + 27, SCREEN_H - 1, k % 2 ? WALL_B : WALL_A, LV_OPA_COVER, 0);
    for (int32_t y = 190, r = 0; y < SCREEN_H; y += 44, r++)
        for (int32_t x = 42 + (r % 2) * 56; x < SCREEN_W; x += 112) {
            fill(&l, x - 1, y - 4, x, y + 3, WALL_SPARK, LV_OPA_COVER, 0);   /* a plus: 2 x 8 and 8 x 2 */
            fill(&l, x - 4, y - 1, x + 3, y, WALL_SPARK, LV_OPA_COVER, 0);
        }
    lv_draw_rect_dsc_t g;
    lv_draw_rect_dsc_init(&g);
    g.bg_grad.dir = LV_GRAD_DIR_VER;
    g.bg_grad.stops_count = 2;
    g.bg_grad.stops[0].color = COL(C_SCREEN); g.bg_grad.stops[0].opa = LV_OPA_COVER; g.bg_grad.stops[0].frac = 0;
    g.bg_grad.stops[1].color = COL(C_SCREEN); g.bg_grad.stops[1].opa = 120; g.bg_grad.stops[1].frac = 255;
    g.bg_opa = LV_OPA_COVER;
    lv_area_t top = { 0, 0, SCREEN_W - 1, SHOP_AWN_Y + 4 };
    lv_draw_rect(&l, &g, &top);
    lv_canvas_finish_layer(rw.scene, &l);
}

/* The awning: a wooden rod, then 34 px stripes of coral and cream, each ending in a scallop, with a
 * soft shadow under the scallops. Drawn over the shelves, so a shelf turning up goes under it. */
#define AWN_STRIPE 34
#define AWN_BAND 18
static void awning_draw(lv_event_t *e)
{
    lv_obj_t *o = lv_event_get_target(e);
    lv_layer_t *l = lv_event_get_layer(e);
    lv_area_t a;
    lv_obj_get_coords(o, &a);
    int32_t y = a.y1 + 4, r = AWN_STRIPE / 2;
    for (int32_t x = a.x1 - 4, k = 0; x < a.x2; x += AWN_STRIPE, k++)   /* the shadow, 3 px down */
        fill(l, x, y + AWN_BAND - r + 3, x + AWN_STRIPE - 1, y + AWN_BAND + r + 2, 0x000000, 70, LV_RADIUS_CIRCLE);
    for (int32_t x = a.x1 - 4, k = 0; x < a.x2; x += AWN_STRIPE, k++) {
        uint32_t c = k % 2 ? C_TEXT : AWN_RED;
        fill(l, x, y, x + AWN_STRIPE - 1, y + AWN_BAND - 1, c, LV_OPA_COVER, 0);
        fill(l, x, y + AWN_BAND - r, x + AWN_STRIPE - 1, y + AWN_BAND + r - 1, c, LV_OPA_COVER, LV_RADIUS_CIRCLE);
    }
    fill(l, a.x1, a.y1, a.x2, a.y1 + 4, AWN_ROD, LV_OPA_COVER, 0);
}

static lv_obj_t *awning_create(lv_obj_t *page)
{
    lv_obj_t *o = ui_box(page);
    lv_obj_set_size(o, SCREEN_W, 5 + AWN_BAND + AWN_STRIPE / 2 + 4);
    lv_obj_set_pos(o, 0, SHOP_AWN_Y);
    lv_obj_add_event_cb(o, awning_draw, LV_EVENT_DRAW_MAIN, NULL);
    return o;
}

/* Shelves away from the one at rest fade (they keep their size: a shelf doesn't shrink). */
static void shelf_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), far = fmaxf(0.0f, ad - 1.4f);
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - 0.3f * fminf(ad, 1.0f)) * fmaxf(0.0f, 1.0f - far / 0.8f)));
}

void rewards_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&rw, 0, sizeof rw);
    rw.on_tap = cb;
    rw.page = page;
    shop_scene(page);
    wheel_list_create(page, &rw.wl, 0, SHOP_TOP, SCREEN_W, SCREEN_H - SHOP_TOP, SHOP_FOCUS - SHOP_TOP, SHOP_ROW);
    rw.wl.style = shelf_style;
    rw.awning = awning_create(page);
    header_create(page, &rw.head);
    page_dots_create(page, 0);
    rw.empty = note_create(page, 230);
    ui_set_text(rw.empty, "No rewards yet.\nA grown-up can add some.");
    ui_show(rw.empty, false);
}

static lv_obj_t *wood(lv_obj_t *row, int32_t y, int32_t h, uint32_t col, lv_opa_t opa)
{
    lv_obj_t *b = ui_box(row);
    lv_obj_set_size(b, SCREEN_W, h);
    lv_obj_set_pos(b, 0, y);
    lv_obj_set_style_bg_color(b, COL(col), 0);
    lv_obj_set_style_bg_opa(b, opa, 0);
    return b;
}

/* A shelf: the plank (a light top face, the front, a dark edge, a soft shadow), the reward's picture
 * standing on it, its name with the price right after it (how many more stars under them when
 * there aren't enough), and the end: Ask, or Asked. */
static void shelf(const day_reward_t *rd, int idx, int stars, bool just)
{
    lv_obj_t *slot = wheel_list_add(&rw.wl);
    lv_obj_t *row = ui_box(slot);
    lv_obj_set_size(row, SCREEN_W, SHOP_ROW);
    wood(row, SHOP_PLANK + 15, 6, 0x000000, 80);
    wood(row, SHOP_PLANK, 4, WOOD_TOP, LV_OPA_COVER);
    wood(row, SHOP_PLANK + 4, 9, WOOD_FRONT, LV_OPA_COVER);
    wood(row, SHOP_PLANK + 13, 2, WOOD_EDGE, LV_OPA_COVER);
    bool enough = stars >= rd->cost;
    lv_obj_t *ic = ui_icon(row, reward_icon(rd->icon), 48, SHOP_TINT[idx % (int)(sizeof SHOP_TINT / sizeof SHOP_TINT[0])]);
    lv_obj_set_pos(ic, SHOP_X_ICON, SHOP_PLANK - 50);
    /* the end first: what's left for the name and the price is what's between */
    lv_obj_t *end = NULL;
    if (rd->state == REWARD_WAITING) {
        end = ui_row(row, 6);
        ui_icon(end, "clock", 20, C_SYSTEM);
        ui_label(end, F_LABEL, C_SYSTEM, "Asked");
    } else if (rd->state == REWARD_NONE && enough) {
        end = button_create(row, BTN_PRIMARY, true, NULL, "Ask");
        lv_obj_add_event_cb(end, on_ask_tap, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    }
    int32_t end_x = SHOP_X_END;
    if (end) {
        lv_obj_update_layout(end);
        end_x = SHOP_X_END - lv_obj_get_width(end);
        lv_obj_set_pos(end, end_x, SHOP_MID - lv_obj_get_height(end) / 2);
        if (just) fx_pop(end, 0);
    }
    /* the name, then the price snug beside it (a star and the number, amber when there are enough);
     * under them, how many more stars when there aren't enough yet */
    lv_obj_t *words = ui_box(row);
    lv_obj_set_size(words, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(words, LV_FLEX_FLOW_COLUMN);
    lv_obj_t *line = ui_row(words, 6);
    lv_obj_set_flex_align(line, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_t *name = ui_label(line, F_ITEM, C_TEXT, rd->title);
    lv_obj_t *price = ui_row(line, 3);
    ui_icon(price, "star-fill", 20, enough ? C_STAR : C_TEXT_MUTED);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    ui_label(price, F_ITEM, enough ? C_STAR : C_TEXT_MUTED, cost);
    lv_obj_update_layout(price);
    int32_t room = end_x - 10 - SHOP_X_TEXT - 6 - lv_obj_get_width(price);
    int lines = ui_label_fit(name, F_ITEM, F_ITEM, room, 2);   /* every name the same size: a long one takes two lines */
    /* the name only as wide as its words (its longest line), so the price sits right after it */
    lv_point_t sz;
    lv_text_get_size(&sz, rd->title, lv_obj_get_style_text_font(name, 0), 0, lines == 2 ? UI_FIT_SPACE : 0, lines == 2 ? room : LV_COORD_MAX, LV_TEXT_FLAG_NONE);
    lv_obj_set_width(name, (sz.x < room ? sz.x : room) + 1);
    if (rd->state == REWARD_NONE && !enough) {
        char more[24];
        snprintf(more, sizeof more, "%d more star%s to go", rd->cost - stars, rd->cost - stars == 1 ? "" : "s");
        ui_label(words, F_DETAIL, C_TEXT_MUTED, more);
    }
    lv_obj_update_layout(words);
    lv_obj_set_pos(words, SHOP_X_TEXT, SHOP_MID - lv_obj_get_height(words) / 2);
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
    int keep = rw.built ? wheel_list_current(&rw.wl) : 0;
    wheel_list_clear(&rw.wl);
    for (int i = 0; i < p->nrewards; i++) shelf(&p->rewards[i], i, stars, !strcmp(p->rewards[i].id, rw.just));
    rw.just[0] = 0;
    if (p->nrewards) wheel_list_focus(&rw.wl, keep < p->nrewards ? keep : p->nrewards - 1, false);
    if (!rw.built && p->nrewards) fx_rise_children(rw.wl.list, 22, 45);   /* the first time: the shelves arrive one after another */
    ui_show(rw.empty, p->nrewards == 0);
    rw.built = true;
}

/* The reward just asked for (by its id): its "Asked" pops in when the shelves are next drawn. */
void rewards_page_asked(const char *id) { snprintf(rw.just, sizeof rw.just, "%s", id ? id : ""); }

void rewards_page_parallax(float t)
{
    int32_t back = (int32_t)lroundf(-t * SCREEN_W * 0.10f), front = (int32_t)lroundf(t * SCREEN_W * 0.08f);
    if (lv_obj_get_style_translate_x(rw.scene, 0) != back) lv_obj_set_style_translate_x(rw.scene, back, 0);
    if (lv_obj_get_style_translate_x(rw.awning, 0) != back) lv_obj_set_style_translate_x(rw.awning, back, 0);
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
