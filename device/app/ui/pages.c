#include "fx.h"
#include "pages.h"
#include "theme.h"
#include "widgets.h"
#include "../pet/pet.h"
#include "../pet/led.h"
#include "../assets/art/art_data.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define PEACH 0xF4C3A7   /* the circle behind a reward's picture when it has no art */

/* ================================================================ reward pictures */
const lv_image_dsc_t *reward_art(const char *icon)
{
    if (!icon) return NULL;
    const char *key = icon;
    if (!strcmp(icon, "movie")) key = "film";
    else if (!strcmp(icon, "surprise") || !strcmp(icon, "toy") || !strcmp(icon, "toys")) key = "gift";
    for (int i = 0; i < art_table_count; i++) if (!strcmp(art_table[i].name, key)) return art_table[i].img;
    return NULL;
}

lv_obj_t *reward_picture(lv_obj_t *parent, const day_reward_t *r, int32_t d)
{
    lv_obj_t *c = ui_box(parent);
    lv_obj_set_size(c, d, d);
    ui_style_card(c, PEACH, LV_RADIUS_CIRCLE, 0, 0);
    const lv_image_dsc_t *art = reward_art(r->icon);
    if (art) {
        lv_obj_t *img = lv_image_create(c);
        lv_image_set_src(img, art);
        int32_t shown = d * 88 / 112;
        lv_image_set_scale(img, (uint32_t)(256 * shown / 72));
        lv_obj_center(img);
    } else {
        lv_obj_t *ic = ui_icon(c, r->icon[0] ? r->icon : "gift", d / 2, C_ON_COLOR);
        lv_obj_center(ic);
    }
    return c;
}

/* ================================================================ rewards */
/* Figma "Rewards · Shop": the shop fills the screen (bunting, a striped wall, two shelves), the
 * header with the stars to spend, four rewards on the shelves, the page dots. */
static struct {
    page_cb_t on_tap;
    lv_obj_t *page, *scene, *items;
    header_t head;
    uint16_t *buf;
    char sig[256];
} rw;

static void on_item(lv_event_t *e)
{
    if (rw.on_tap) rw.on_tap((int)(intptr_t)lv_event_get_user_data(e));
}

static void shop_scene(lv_obj_t *page)
{
    rw.buf = lv_malloc((size_t)SCREEN_W * SCREEN_H * 2);
    rw.scene = lv_canvas_create(page);
    lv_canvas_set_buffer(rw.scene, rw.buf, SCREEN_W, SCREEN_H, LV_COLOR_FORMAT_RGB565);
    lv_obj_set_pos(rw.scene, 0, 0);
    lv_obj_remove_flag(rw.scene, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_SCROLLABLE);
    led_args_t a = {
        .buf = rw.buf, .d = SCREEN_W, .pitch = 3.8f,
        .room = shop_room, .body = NULL, .fx = NULL, .walls = shop_walls,
        .gw = shop_side, .gh = shop_side, .cx = shop_center, .cy = shop_center,
        .dim = 40, .bg = C_SCREEN, .sparkles = -1, .palette = shop_palette, .extend = true, .solid = true,
    };
    led_render(&a);
    scrim_create(page);
}

void rewards_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&rw, 0, sizeof rw);
    rw.on_tap = cb;
    rw.page = page;
    shop_scene(page);
    rw.items = ui_box(page);
    lv_obj_set_size(rw.items, SCREEN_W, SCREEN_H);
    header_create(page, &rw.head);
    page_dots_create(page, 0);
}

/* Figma "Shelf item": the picture (72) on the shelf, its name (Label 20), then the price: amber
 * when there are enough stars, an amber number on a chip when not, lavender "Asked" once asked. */
static void shelf_item(lv_obj_t *parent, const day_reward_t *rd, int idx, int stars, int32_t cx, int32_t y)
{
    lv_obj_t *it = ui_box(parent);
    lv_obj_set_size(it, 150, 146);
    lv_obj_set_pos(it, cx - 75, y);
    lv_obj_add_flag(it, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(it, on_item, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    const lv_image_dsc_t *art = reward_art(rd->icon);
    if (art) {
        lv_obj_t *img = lv_image_create(it);
        lv_image_set_src(img, art);
        lv_obj_set_pos(img, 39, 0);
    } else {
        lv_obj_t *pic = reward_picture(it, rd, 72);
        lv_obj_set_pos(pic, 39, 0);
    }
    lv_obj_t *name = ui_label(it, F_LABEL, C_TEXT, rd->title);
    lv_obj_set_size(name, 150, lv_font_get_line_height(F_LABEL));
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(name, 0, 76);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    lv_obj_t *tag;
    if (rd->state == REWARD_WAITING) tag = status_pill_create(it, "clock", "Asked", C_SYSTEM);
    else if (stars >= rd->cost) { pill_t p; pill_create(it, &p); pill_set(&p, PILL_HURRY, "star-line", cost); tag = p.root; }
    else tag = status_pill_create(it, "star-line", cost, C_STAR);
    lv_obj_update_layout(tag);
    lv_obj_set_pos(tag, 75 - lv_obj_get_width(tag) / 2, 106);
}

void rewards_page_render(const day_plan_t *p, int stars, bool picture)
{
    char sig[256];
    int n = snprintf(sig, sizeof sig, "%d|%d|%s|", stars, picture, ui_clock());
    for (int i = 0; i < p->nrewards && n < (int)sizeof sig - 8; i++) n += snprintf(sig + n, sizeof sig - n, "%s%d,", p->rewards[i].id, p->rewards[i].state);
    if (!strcmp(sig, rw.sig)) return;
    bool items_same = !strncmp(sig, rw.sig, (size_t)(strchr(sig, '|') - sig));
    strcpy(rw.sig, sig);
    char s[24];
    snprintf(s, sizeof s, "%d to spend", stars);
    header_set(&rw.head, NULL, "Rewards", HEADER_PILL, PILL_STAR, "star-line", s);   /* Figma: no clock in the shop */
    (void)items_same;
    lv_obj_clean(rw.items);
    /* two shelves, two rewards each (Figma: the shop holds four), centred at x 150 and 316 */
    static const int32_t X[2] = { 150, 316 }, Y[2] = { 124, 280 };
    int shown = 0;
    for (int i = 0; i < p->nrewards && shown < 4; i++, shown++) shelf_item(rw.items, &p->rewards[i], i, stars, X[shown % 2], Y[shown / 2]);
    if (!shown) {
        lv_obj_t *l = note_create(rw.items, 230);
        ui_set_text(l, "No rewards yet.\nA grown-up can add some.");
    }
}

/* ================================================================ chores */
/* Figma "My day · Chores": the header with how many are done, then equal rows from y 130, the ones
 * to do first and the finished ones after; more scroll up. Tap a chore to tick it. */
#define CH_TOP 131           /* under the pill (header at y 23) */
#define CH_FOCUS 171         /* rows 82 apart, the first 6 px under the pill as in Figma */
#define CH_ROW 82

static struct {
    page_cb_t on_done;
    lv_obj_t *page, *empty;
    header_t head;
    wheel_list_t wl;
    int just;
    char sig[256];
} ch;

static void on_chore(lv_event_t *e)
{
    ch.just = (int)(intptr_t)lv_event_get_user_data(e);
    if (ch.on_done) ch.on_done(ch.just);
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
    wheel_list_create(page, &ch.wl, 0, CH_TOP, SCREEN_W, SCREEN_H - CH_TOP, CH_FOCUS - CH_TOP, CH_ROW);
    ch.wl.shrink = ch.wl.fade = 0;
    header_create(page, &ch.head);
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
 * lavender to do, a night card with a mint tick when done. */
static void chore_card(const day_chore_t *c, int idx, bool picture)
{
    lv_obj_t *slot = wheel_list_add(&ch.wl);
    lv_obj_t *card = ui_row(slot, 14);
    lv_obj_set_size(card, 360, 72);
    lv_obj_center(card);
    lv_obj_set_style_pad_hor(card, 16, 0);
    bool done = c->done;
    ui_style_card(card, done ? C_RAISED : C_SYSTEM, LV_RADIUS_CIRCLE, 0, 0);   /* Figma "Chore row": fully round */
    uint32_t fg = done ? C_TEXT_MUTED : C_ON_COLOR;
    ui_icon(card, c->icon[0] ? c->icon : "sparkles", 24, fg);
    lv_obj_t *body = ui_box(card);
    lv_obj_set_size(body, 10, LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(body, 1);
    lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
    lv_obj_t *name = ui_label(body, F_ITEM, fg, c->title);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_size(name, lv_pct(100), lv_font_get_line_height(F_ITEM));
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
    if (done) {
        lv_obj_t *chk = checkbox_create(card, 48, true);
        if (idx == ch.just) {
            fx_pop(chk, 0);
            lv_obj_update_layout(ch.wl.list);
            lv_area_t a, pg;
            lv_obj_get_coords(chk, &a);
            lv_obj_get_coords(ch.page, &pg);
            int32_t ex = (a.x1 + a.x2) / 2 - pg.x1, ey = (a.y1 + a.y2) / 2 - pg.y1;
            fx_burst_cfg_t cfg = { .waves = 1, .wave_r0 = 10, .wave_span = 80 };
            fx_burst_create(ch.page, ex, ey, &cfg);
            fx_confetti(ch.page, ex, ey, 16, FX_PARTY, 6, 120);
        }
    } else {
        checkbox_create(card, 48, false);
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_bg_color(card, COL(C_TEXT), LV_STATE_PRESSED);
        lv_obj_add_event_cb(card, on_chore, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    }
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
    header_set(&ch.head, ui_clock(), "Chores", HEADER_PILL, PILL_DONE, "check", s);
    if (!rows_same) {
        bool ticked = ch.just >= 0;
        wheel_list_clear(&ch.wl);
        for (int i = 0; i < shown; i++) chore_card(&p->chores[sorted[i]], sorted[i], picture);
        wheel_list_focus(&ch.wl, focus, false);
        if (ticked) fx_bounce(ch.head.pill.root, 8, 150);
        ch.just = -1;
    }
    ui_show(ch.empty, shown == 0);
}

void chores_page_visible(bool visible) { (void)visible; }

lv_obj_t *chores_page_pet(void) { return NULL; }
