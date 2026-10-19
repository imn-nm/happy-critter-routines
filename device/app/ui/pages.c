#include "fx.h"
#include "pages.h"
#include "theme.h"
#include "widgets.h"
#include "../pet/pet.h"
#include "../pet/led.h"
#include "../assets/art/art_data.h"
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
/* Figma "Rewards · Shop" (1079:5120): the solid shop fills the screen (bunting, a striped wall, two
 * shelves) under the scrim, the header with the stars to spend, five rewards, the page dots. */
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

/* Figma "MyToki 2 / Shelf item": a 150 wide column, 4 px apart: the reward's line icon (64, cream),
 * its name (Label 20), then the price: lime when there are enough stars, a lavender number on a chip
 * when not, lavender "Asked" once asked. */
static void shelf_item(lv_obj_t *parent, const day_reward_t *rd, int idx, int stars, int32_t x, int32_t y)
{
    lv_obj_t *it = ui_box(parent);
    lv_obj_set_size(it, 150, 136);
    lv_obj_set_pos(it, x, y);
    lv_obj_add_flag(it, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(it, on_item, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    lv_obj_t *ic = ui_icon(it, reward_icon(rd->icon), 64, C_TEXT);
    lv_obj_set_pos(ic, 43, 0);
    lv_obj_t *name = ui_label(it, F_LABEL, C_TEXT, rd->title);
    lv_obj_set_size(name, 150, lv_font_get_line_height(F_LABEL));
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(name, 0, 68);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    lv_obj_t *tag;
    if (rd->state == REWARD_WAITING) tag = status_pill_create(it, "clock", "Asked", C_SYSTEM);
    else { pill_t p; pill_create(it, &p); pill_set(&p, stars >= rd->cost ? PILL_ACTION : PILL_CALM, "star-line", cost); tag = p.root; }
    lv_obj_update_layout(tag);
    lv_obj_set_pos(tag, 75 - lv_obj_get_width(tag) / 2, 97);
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
    /* Figma "Rewards · Shop" (1079:5120): five rewards, three on the top shelf and two below */
    static const int32_t X[5] = { 6, 158, 308, 75, 241 }, Y[5] = { 129, 129, 129, 275, 275 };
    int shown = 0;
    for (int i = 0; i < p->nrewards && shown < 5; i++, shown++) shelf_item(rw.items, &p->rewards[i], i, stars, X[shown], Y[shown]);
    if (!shown) {
        lv_obj_t *l = note_create(rw.items, 230);
        ui_set_text(l, "No rewards yet.\nA grown-up can add some.");
    }
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
    int32_t s = (int32_t)lroundf(256 * (1.0f - 0.10f * k - 0.06f * k2));
    if (lv_obj_get_style_transform_scale_x(card, 0) != s) {
        lv_obj_set_style_transform_scale(card, s, 0);
        lv_obj_set_style_transform_pivot_x(card, LV_PCT(50), 0);
        lv_obj_set_style_transform_pivot_y(card, LV_PCT(50), 0);
    }
    lv_opa_t o = (lv_opa_t)(255 * (1.0f - 0.3f * k - 0.15f * k2) * fmaxf(0.0f, 1.0f - far / 0.6f));
    if (lv_obj_get_style_opa_layered(card, 0) != o) lv_obj_set_style_opa_layered(card, o, 0);
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
        checkbox_create(card, 48, true);
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
        if (ch.just >= 0 && tick_in_place(ch.just, picture)) {
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
            ch.flip = false;
        }
        /* else: something changed while a tick settles; the hold lays everything out when it's over */
        ch.just = -1;
    }
    ui_show(ch.empty, shown == 0);
}

void chores_page_visible(bool visible) { (void)visible; }

lv_obj_t *chores_page_pet(void) { return NULL; }
