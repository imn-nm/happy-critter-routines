#include "fx.h"
#include "pages.h"
#include "theme.h"
#include "widgets.h"
#include "../pet/pet.h"
#include "../pet/led.h"
#include "../assets/art/art_data.h"
#include <stdio.h>
#include <string.h>

#define PEACH 0xF4C3A7   /* the circle behind a reward's picture */

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
        int32_t shown = d * 88 / 112;   /* Figma: an 88 px picture in the 112 px circle */
        lv_image_set_scale(img, (uint32_t)(256 * shown / 72));
        lv_obj_center(img);
    } else {
        lv_obj_t *ic = ui_icon(c, r->icon[0] ? r->icon : "gift", d / 2, C_NAVY);
        lv_obj_center(ic);
    }
    return c;
}

/* ================================================================ rewards */
static struct {
    page_cb_t on_tap;
    lv_obj_t *page, *scene, *pill, *items, *hicon, *htitle;
    uint16_t *buf;
    char sig[256];
} rw;

static void on_item(lv_event_t *e)
{
    if (rw.on_tap) rw.on_tap((int)(intptr_t)lv_event_get_user_data(e));
}

/* Figma "Scene · Shop" at 50%: two wooden shelves and bunting in LED dots, from the sampled grid. */
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
        .dim = 150, .bg = C_INK, .sparkles = -1, .palette = shop_palette, .extend = false,   /* Figma: the scene at 50% */
    };
    led_render(&a);
}

void rewards_page_create(lv_obj_t *page, page_cb_t cb)
{
    memset(&rw, 0, sizeof rw);
    rw.on_tap = cb;
    rw.page = page;
    shop_scene(page);
    /* header: a star, "Rewards", the stars to spend */
    rw.hicon = ui_icon(page, "star-line", 20, C_BONE);
    lv_obj_set_pos(rw.hicon, 223, 14);
    ui_show(rw.hicon, false);
    rw.htitle = ui_label(page, F_TITLE, C_BONE, "Rewards");
    lv_obj_set_width(rw.htitle, 340);
    lv_obj_set_style_text_align(rw.htitle, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(rw.htitle, LV_ALIGN_TOP_MID, 0, 14);
    rw.pill = status_pill_create(page, "star-line", "0 to spend", C_BUTTER);
    lv_obj_align(rw.pill, LV_ALIGN_TOP_MID, 0, 45);
    rw.items = ui_box(page);
    lv_obj_set_size(rw.items, SCREEN_W, SCREEN_H);
    page_dots_create(page, 0);
}

/* Figma "Shelf item": the picture (72) on the shelf, the name under it, then the price tag:
 * filled lime when there are enough stars, a lime outline when not, lavender "Asked" once asked. */
static void shelf_item(lv_obj_t *parent, const day_reward_t *rd, int idx, int stars, int32_t x, int32_t y)
{
    lv_obj_t *it = ui_box(parent);
    lv_obj_set_size(it, 150, 149);
    lv_obj_set_pos(it, x, y);
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
    lv_obj_t *name = ui_label(it, F_ITEM, C_BONE, rd->title);
    lv_obj_set_size(name, 150, 29);
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(name, 0, 72);
    lv_obj_t *tag = ui_row(it, 6);
    lv_obj_set_height(tag, 28);
    lv_obj_set_style_pad_left(tag, 10, 0);
    lv_obj_set_style_pad_right(tag, 12, 0);
    char cost[8];
    snprintf(cost, sizeof cost, "%d", rd->cost);
    if (rd->state == REWARD_WAITING) {
        ui_style_card(tag, C_LAVENDER, 14, 0, 0);
        ui_icon(tag, "clock", 16, C_NAVY);
        ui_label(tag, F_ITEM, C_NAVY, "Asked");
    } else if (stars >= rd->cost) {
        ui_style_card(tag, C_LIME, 14, 0, 0);
        ui_icon(tag, "star-line", 16, C_NAVY);
        ui_label(tag, F_ITEM, C_NAVY, cost);
    } else {
        ui_style_card(tag, C_GLASS, 14, C_LIME, LV_OPA_COVER);
        lv_obj_set_style_border_width(tag, 2, 0);
        ui_icon(tag, "star-line", 16, C_LIME);
        ui_label(tag, F_ITEM, C_LIME, cost);
    }
    lv_obj_update_layout(tag);
    lv_obj_set_pos(tag, 75 - lv_obj_get_width(tag) / 2, 105);
}

void rewards_page_render(const day_plan_t *p, int stars, bool picture)
{
    char sig[256];
    int n = snprintf(sig, sizeof sig, "%d|%d|", stars, picture);
    for (int i = 0; i < p->nrewards && n < (int)sizeof sig - 8; i++) n += snprintf(sig + n, sizeof sig - n, "%s%d,", p->rewards[i].id, p->rewards[i].state);
    if (!strcmp(sig, rw.sig)) return;
    strcpy(rw.sig, sig);

    char s[24];
    snprintf(s, sizeof s, "%d to spend", stars);
    lv_obj_t *old = rw.pill;
    ui_show(rw.hicon, ui_picture());
    lv_obj_align(rw.htitle, LV_ALIGN_TOP_MID, 0, ui_picture() ? 38 : 14);
    rw.pill = status_pill_create(rw.page, "star-line", s, C_BUTTER);
    lv_obj_move_to_index(rw.pill, lv_obj_get_index(old));
    lv_obj_delete(old);
    lv_obj_update_layout(rw.pill);
    lv_obj_align(rw.pill, LV_ALIGN_TOP_MID, 0, ui_picture() ? 69 : 45);

    lv_obj_clean(rw.items);
    /* two shelves, two rewards each (Figma: the shop holds four) */
    static const int32_t X[2] = { 75, 241 }, Y[2] = { 117, 279 };
    int shown = 0;
    for (int i = 0; i < p->nrewards && shown < 4; i++, shown++) shelf_item(rw.items, &p->rewards[i], i, stars, X[shown % 2], Y[shown / 2]);
    if (!shown) {
        lv_obj_t *l = note_create(rw.items, 230);
        ui_set_text(l, "No rewards yet.\nA grown-up can add some.");
    }
}

/* ================================================================ chores */
static struct {
    page_cb_t on_done;
    lv_obj_t *page, *pill, *list, *empty, *strip, *pet, *hicon, *htitle;
    int just;                  /* the chore just tapped: its tick pops */
    char sig[256];
} ch;

static void on_chore(lv_event_t *e)
{
    ch.just = (int)(intptr_t)lv_event_get_user_data(e);
    if (ch.on_done) ch.on_done(ch.just);
}

/* "3 pm", "6:30 pm" */
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
    /* Biscuit's room along the bottom (Figma "Scene · Wide"): his round scene, 466 wide, clipped to
     * a 192 px strip and fading out at the top */
    ch.strip = ui_box(page);
    lv_obj_set_size(ch.strip, SCREEN_W, 192);
    lv_obj_set_pos(ch.strip, 0, 274);
    ch.pet = pet_create(ch.strip, SCREEN_W);
    lv_obj_set_pos(ch.pet, 0, -137);
    pet_look_t look = pet_default_look(SCREEN_W);
    look.pitch = 3.8f;
    look.wide = true;
    look.dy = 2;
    pet_set_look(ch.pet, &look);
    pet_set_mood(ch.pet, PET_MOOD_HAPPY);
    pet_set_tappable(ch.pet, true);
    lv_obj_t *fade = ui_box(ch.strip);
    lv_obj_set_size(fade, SCREEN_W, 56);
    lv_obj_set_pos(fade, 0, 0);
    static lv_grad_dsc_t grad;
    grad.dir = LV_GRAD_DIR_VER;
    grad.stops_count = 2;
    grad.stops[0].color = COL(C_INK); grad.stops[0].opa = LV_OPA_COVER; grad.stops[0].frac = 0;
    grad.stops[1].color = COL(C_INK); grad.stops[1].opa = LV_OPA_TRANSP; grad.stops[1].frac = 255;
    lv_obj_set_style_bg_grad(fade, &grad, 0);
    lv_obj_set_style_bg_opa(fade, LV_OPA_COVER, 0);

    ch.hicon = ui_icon(page, "listchecks", 20, C_BONE);
    lv_obj_set_pos(ch.hicon, 223, 14);
    ui_show(ch.hicon, false);
    ch.htitle = ui_label(page, F_TITLE, C_BONE, "Chores");
    lv_obj_set_width(ch.htitle, 340);
    lv_obj_set_style_text_align(ch.htitle, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(ch.htitle, LV_ALIGN_TOP_MID, 0, 14);
    ch.pill = status_pill_create(page, "check", "0 of 0 done", C_MINT);
    lv_obj_align(ch.pill, LV_ALIGN_TOP_MID, 0, 45);

    ch.list = ui_box(page);
    lv_obj_set_size(ch.list, 332, 216);
    lv_obj_set_pos(ch.list, 67, 108);
    lv_obj_add_flag(ch.list, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_scroll_dir(ch.list, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(ch.list, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_flex_flow(ch.list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(ch.list, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_style_pad_row(ch.list, 8, 0);
    ch.empty = note_create(page, 180);
    ui_set_text(ch.empty, "Nothing to do right now.\nBiscuit says thanks!");
    page_dots_create(page, 2);
}

/* Chores whose window covers now (getActiveWindowChores); done ones stay. */
static bool chore_now(const day_chore_t *c, int now_min)
{
    if (c->from < 0 && c->to < 0) return true;
    int a = c->from < 0 ? 0 : c->from, b = c->to < 0 ? 24 * 60 - 1 : c->to;
    return now_min >= a && now_min <= b;
}

/* Figma "Chore": a lavender card 332 x 64 with the chore's icon, its name, its window, and a ring
 * to tap; done, it turns to a card with a mint tick and "Done!". */
static void chore_card(const day_chore_t *c, int idx, bool picture)
{
    lv_obj_t *card = ui_box(ch.list);
    lv_obj_set_size(card, 332, 64);
    bool done = c->done;
    ui_style_card(card, done ? C_GLASS : C_LAVENDER, 18, 0, 0);
    uint32_t fg = done ? C_BONE : C_NAVY;
    lv_obj_t *ic = ui_icon(card, c->icon[0] ? c->icon : "sparkles", 24, fg);
    lv_obj_set_pos(ic, 16, 20);
    if (!picture) {
        lv_obj_t *name = ui_label(card, F_ITEM, fg, c->title);
        lv_obj_set_width(name, 196);
        lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
        lv_obj_set_pos(name, 52, 8);
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
        lv_obj_t *row = ui_row(card, 6);
        if (!done) ui_icon(row, "clock", 16, C_NAVY);
        ui_label(row, F_CAPTION, done ? C_MINT : C_NAVY, when);
        lv_obj_set_pos(row, 52, 37);
    } else {
        /* picture view: the name only, bigger (younger kids tap the words to hear them) */
        lv_obj_t *name = ui_label(card, F_ITEM, fg, c->title);
        lv_obj_set_width(name, 196);
        lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
        lv_obj_set_pos(name, 52, 18);
    }
    lv_obj_t *end = ui_box(card);
    lv_obj_set_size(end, 38, 38);
    lv_obj_set_pos(end, 278, 13);
    lv_obj_set_style_radius(end, LV_RADIUS_CIRCLE, 0);
    if (done) {
        ui_style_card(end, C_MINT, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_t *chk = ui_icon(end, "check", 26, C_NAVY);
        lv_obj_center(chk);
        if (idx == ch.just) {
            /* just ticked: the tick pops and a few pieces fly off it */
            fx_pop(end, 0);
            lv_obj_update_layout(ch.list);
            lv_area_t a, pg;
            lv_obj_get_coords(end, &a);
            lv_obj_get_coords(ch.page, &pg);
            int32_t ex = (a.x1 + a.x2) / 2 - pg.x1, ey = (a.y1 + a.y2) / 2 - pg.y1;
            fx_burst_cfg_t cfg = { .waves = 1, .wave_r0 = 10, .wave_span = 80 };
            fx_burst_create(ch.page, ex, ey, &cfg);
            fx_confetti(ch.page, ex, ey, 16, FX_PARTY, 6, 120);
            if (ch.pet) pet_react(ch.pet, PET_CLIP_CELEBRATE);   /* he jumps for it, sparks and all */
        }
    } else {
        lv_obj_set_style_border_width(end, 2, 0);
        lv_obj_set_style_border_color(end, COL(C_NAVY), 0);
        lv_obj_set_style_border_opa(end, LV_OPA_COVER, 0);
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_bg_color(card, COL(C_BONE), LV_STATE_PRESSED);
        lv_obj_add_event_cb(card, on_chore, LV_EVENT_CLICKED, (void *)(intptr_t)idx);
    }
}

void chores_page_render(const day_plan_t *p, int now_min, bool picture)
{
    char sig[256];
    int n = snprintf(sig, sizeof sig, "%d|", picture);
    for (int i = 0; i < p->nchores && n < (int)sizeof sig - 8; i++)
        if (chore_now(&p->chores[i], now_min)) n += snprintf(sig + n, sizeof sig - n, "%s%d,", p->chores[i].id, p->chores[i].done);
    if (!strcmp(sig, ch.sig)) return;
    strcpy(ch.sig, sig);

    bool ticked = ch.just >= 0;
    int shown = 0, done = 0;
    lv_obj_clean(ch.list);
    /* to do first, then the ones already done */
    for (int pass = 0; pass < 2; pass++)
        for (int i = 0; i < p->nchores; i++) {
            const day_chore_t *c = &p->chores[i];
            if (!chore_now(c, now_min) || (pass == 0) == c->done) continue;
            chore_card(c, i, picture);
            shown++;
            if (c->done) done++;
        }
    char s[24];
    snprintf(s, sizeof s, "%d of %d done", done, shown);
    lv_obj_t *old = ch.pill;
    ui_show(ch.hicon, ui_picture());
    lv_obj_align(ch.htitle, LV_ALIGN_TOP_MID, 0, ui_picture() ? 38 : 14);
    ch.pill = status_pill_create(ch.page, "check", s, C_MINT);
    lv_obj_move_to_index(ch.pill, lv_obj_get_index(old));
    lv_obj_delete(old);
    lv_obj_update_layout(ch.pill);
    lv_obj_align(ch.pill, LV_ALIGN_TOP_MID, 0, ui_picture() ? 69 : 45);
    if (ticked) fx_bounce(ch.pill, 8, 150);
    ch.just = -1;
    ui_show(ch.empty, shown == 0);
}

void chores_page_visible(bool visible)
{
    if (ch.pet) pet_set_paused(ch.pet, !visible);
}

lv_obj_t *chores_page_pet(void) { return ch.pet; }
