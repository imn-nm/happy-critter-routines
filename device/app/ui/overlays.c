#include "overlays.h"
#include "theme.h"
#include "widgets.h"
#include "swipe.h"
#include "../pet/pet.h"
#include "../hal.h"
#include "pages.h"
#include "fx.h"
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

static lv_obj_t *sched, *others, *reminder, *approved, *denied, *chosen, *asked, *stars, *streak, *battery, *sys;
static sys_screen_t sys_kind;

static void cleared(void *user) { *(lv_obj_t **)user = NULL; }
static void on_deleted(lv_event_t *e)
{
    lv_obj_t **slot = lv_event_get_user_data(e);
    if (*slot == lv_event_get_target(e)) *slot = NULL;
}

/* A new overlay that forgets itself when it goes. One already in the slot (the loading screen
 * taking over from an error, say) fades out under the newcomer instead of vanishing. */
static lv_obj_t *open_overlay(lv_obj_t **slot, bool swipe)
{
    if (*slot) {
        lv_obj_t *old = *slot;
        *slot = NULL;
        lv_free(lv_obj_get_user_data(old));    /* its swipe record, so its close doesn't clear the new one's slot */
        lv_obj_set_user_data(old, NULL);
        overlay_fade_away(old);
    }
    lv_obj_t *o = overlay_create();
    *slot = o;
    lv_obj_add_event_cb(o, on_deleted, LV_EVENT_DELETE, slot);
    if (swipe) swipe_to_close(o, cleared, slot);
    return o;
}

/* Closes itself after a while; the timer goes with the overlay if it's closed first. */
static void close_later(lv_timer_t *t)
{
    lv_obj_t *o = lv_timer_get_user_data(t);
    overlay_fade_away(o);
}

static void drop_timer(lv_event_t *e) { lv_timer_delete(lv_event_get_user_data(e)); }

static void auto_close(lv_obj_t **slot, uint32_t ms)
{
    lv_timer_t *t = lv_timer_create(close_later, ms, *slot);
    lv_timer_set_repeat_count(t, 1);
    lv_timer_set_auto_delete(t, false);
    lv_obj_add_event_cb(*slot, drop_timer, LV_EVENT_DELETE, t);
}

static void fmt_duration(char *buf, size_t n, int minutes)
{
    if (minutes < 60) snprintf(buf, n, "%d min", minutes);
    else if (minutes % 60 == 0) snprintf(buf, n, "%d h", minutes / 60);
    else snprintf(buf, n, "%d h %d", minutes / 60, minutes % 60);
}

/* ---- the Figma Header on an overlay (2026-10-12): Title 22 at y 14, a line at y 45; the picture
 * view keeps the icon 20 at y 14 with the title at 38 and the line at 69 ---- */
static lv_obj_t *header(lv_obj_t *o, const char *icon, uint32_t icon_color, const char *title, const char *text, uint32_t text_color)
{
    bool pic = ui_picture();
    if (pic && icon && *icon) {
        lv_obj_t *ic = ui_icon(o, icon, 20, icon_color);
        lv_obj_set_pos(ic, 223, 14);
    }
    lv_obj_t *t = ui_label(o, F_TITLE, C_BONE, title);
    lv_obj_set_width(t, 340);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(t, LV_LABEL_LONG_DOT);
    lv_obj_align(t, LV_ALIGN_TOP_MID, 0, pic ? 38 : 14);
    if (text && *text) {
        lv_obj_t *s = ui_label(o, F_LABEL, text_color, text);
        lv_obj_set_width(s, 340);
        lv_obj_set_style_text_align(s, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_align(s, LV_ALIGN_TOP_MID, 0, pic ? 69 : 45);
    }
    return t;
}

/* With an overline instead of an icon: Label 16 muted at y 14, the title at y 42. */
static void header_overline(lv_obj_t *o, const char *overline, const char *title)
{
    lv_obj_t *ov = ui_label(o, F_LABEL, C_MUTED, overline);
    lv_obj_align(ov, LV_ALIGN_TOP_MID, 0, 14);
    lv_obj_t *t = ui_label(o, F_TITLE, C_BONE, title);
    lv_obj_set_width(t, 340);
    lv_obj_set_style_text_align(t, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(t, LV_LABEL_LONG_DOT);
    lv_obj_align(t, LV_ALIGN_TOP_MID, 0, 42);
    fx_rise(ov, 10, 0);
    fx_rise(t, 14, 60);
}

/* Biscuit's round scene as on Home: 286 px at (90, 90) on the 3.8 px LED grid. */
static lv_obj_t *scene(lv_obj_t *o, int32_t d, int32_t xy)
{
    lv_obj_t *pet = pet_create(o, d);
    lv_obj_set_pos(pet, xy, xy);
    pet_look_t look = pet_default_look(d);
    look.pitch = 3.8f;
    pet_set_look(pet, &look);
    return pet;
}

/* A lavender message card centred at y (Figma "System message", Plain). */
/* A message card at y. Long words wrap (the card is at most ~274 wide, which fits the round screen
 * down to y 426), and a card near the bottom keeps its bottom edge inside the circle. */
static void message(lv_obj_t *o, const char *icon, const char *text, int32_t y)
{
    lime_card_t c;
    lime_card_create(o, &c, 0);
    lime_card_wrap(&c, 220);
    lime_card_set(&c, icon, text, CARD_END_NONE);
    lv_obj_update_layout(c.root);
    int32_t h = lv_obj_get_height(c.root), w = lv_obj_get_width(c.root);
    /* keep the whole card inside the round screen: the lower it sits, the narrower the circle is */
    int32_t r = SCREEN_W / 2, half = w / 2 + 6;
    int32_t bottom = r + (int32_t)sqrtf((float)(r * r - half * half));
    if (bottom > 426) bottom = 426;
    if (y + h > bottom) y = bottom - h;
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, y);
    fx_rise(c.root, 14, 220);
}

/* ================================================================ Today's schedule */
/* Figma "Day · Today's schedule": a wheel of three rows. The middle row is the big one (now, with
 * a lime outline); the rows above and below are smaller and dimmer. Swipe up or down to turn it;
 * swipe sideways to close. Chores sit after the timed rows, by when they're due, then anytime;
 * tap a chore's ring to tick it. Picture view (under 7) stacks big icon tiles instead. */
typedef enum { ROW_DONE, ROW_NOW, ROW_NEXT, ROW_FREE, ROW_CHORE, ROW_CHORE_DONE } row_state_t;
typedef struct { int task, chore; int16_t start, end; row_state_t state; } srow_t;

static struct {
    const day_plan_t *p;
    const logic_now_t *n;
    int now_min;
    bool picture;
    schedule_cb_t on_chore;
    srow_t rows[DAY_MAX_TASKS * 2 + DAY_MAX_CHORES];
    int nrows, pos;
    lv_obj_t *clip, *wheel;     /* the rows live in `wheel`, inside `clip`, which hides them under the header as they turn */
    int32_t press_y;
    bool sheet_drag;            /* the finger took the sheet by its header: it follows the finger down */
    bool turning;               /* the wheel is mid-turn */
} sc;

/* "3 pm", "6:30 pm" */
static void fmt_hour(char *buf, size_t n, int minutes)
{
    int h = (minutes / 60) % 24, m = minutes % 60, h12 = h % 12 == 0 ? 12 : h % 12;
    if (m) snprintf(buf, n, "%d:%02d %s", h12, m, ui_ampm(minutes));
    else snprintf(buf, n, "%d %s", h12, ui_ampm(minutes));
}

static int cmp_chore_row(const void *a, const void *b)
{
    const srow_t *x = a, *y = b;
    int tx = x->end < 0 ? 1 << 20 : x->end, ty = y->end < 0 ? 1 << 20 : y->end;
    return tx - ty;
}

/* Every task, free time between them when the gap is 15 minutes or more, then the chores. */
static void sched_rows(void)
{
    const day_plan_t *p = sc.p;
    const logic_now_t *n = sc.n;
    sc.nrows = 0;
    int focus = n->current >= 0 ? n->current : n->nupcoming ? n->upcoming[0] : -1;
    int focus_row = -1;
    for (int i = 0; i < p->ntasks; i++) {
        bool done = p->tasks[i].done_at >= 0;
        srow_t r = { i, -1, n->start[i], p->tasks[i].end, done ? ROW_DONE : i == n->current ? ROW_NOW : ROW_NEXT };
        if (i == focus && focus_row < 0) focus_row = sc.nrows;
        sc.rows[sc.nrows++] = r;
        if (i + 1 < p->ntasks) {
            int gap_from = p->tasks[i].end, gap_to = n->start[i + 1];
            bool to_bed = p->tasks[i].bedtime_routine && p->tasks[i + 1].system == SYS_BEDTIME;
            if (gap_to - gap_from >= 15 && !to_bed) {
                srow_t f = { -1, -1, (int16_t)gap_from, (int16_t)gap_to, ROW_FREE };
                if (n->current < 0 && n->free && sc.now_min >= gap_from && sc.now_min < gap_to) focus_row = sc.nrows;
                sc.rows[sc.nrows++] = f;
            }
        }
    }
    int first_chore = sc.nrows;
    for (int i = 0; i < p->nchores; i++) {
        const day_chore_t *c = &p->chores[i];
        srow_t r = { -1, i, c->from, c->to, c->done ? ROW_CHORE_DONE : ROW_CHORE };
        sc.rows[sc.nrows++] = r;
    }
    if (sc.nrows - first_chore > 1) qsort(sc.rows + first_chore, (size_t)(sc.nrows - first_chore), sizeof(srow_t), cmp_chore_row);
    if (sc.pos < 0) sc.pos = focus_row >= 0 ? focus_row : 0;
    if (sc.pos > sc.nrows - 1) sc.pos = sc.nrows - 1;
    if (sc.pos < 0) sc.pos = 0;
}

static void on_row_chore(lv_event_t *e)
{
    int chore = (int)(intptr_t)lv_event_get_user_data(e);
    if (sc.on_chore) sc.on_chore(chore);
}

/* Figma "Schedule row". Center: 430 x 88 at x 18, r 24; Edge: 350 x 68 at x 58, r 20, at 75%. */
static void sched_row(const srow_t *r, int32_t y, bool center)
{
    const day_plan_t *p = sc.p;
    lv_obj_t *card = ui_box(sc.wheel);
    lv_obj_set_size(card, center ? 430 : 350, center ? 88 : 68);
    lv_obj_set_pos(card, center ? 18 : 58, y);
    lv_obj_set_style_radius(card, center ? 24 : 20, 0);
    if (!center) lv_obj_set_style_opa(card, 191, 0);
    const char *icon = "star-line";
    char time[8], ampm[8], task[48], detail[40], a[12], b[12];
    uint32_t fg = C_BONE, sub = C_MUTED;
    switch (r->state) {
    case ROW_DONE: ui_style_card(card, C_DEEP, center ? 24 : 20, C_LINE, LV_OPA_COVER); break;
    case ROW_NOW: ui_style_card(card, C_GLASS, center ? 24 : 20, C_LIME, LV_OPA_COVER); lv_obj_set_style_border_width(card, 2, 0); break;
    case ROW_NEXT: ui_style_card(card, C_GLASS, center ? 24 : 20, C_LINE, LV_OPA_COVER); break;
    case ROW_FREE: {
        lv_obj_t *o = dotted_outline_create(card, C_MINT, center ? 24 : 20);
        lv_obj_set_size(o, lv_obj_get_width(card), lv_obj_get_height(card));
        fg = C_MINT;
        break;
    }
    case ROW_CHORE: ui_style_card(card, C_LAVENDER, center ? 24 : 20, 0, 0); fg = sub = C_NAVY; break;
    case ROW_CHORE_DONE:
        lv_obj_set_style_border_width(card, 2, 0);
        lv_obj_set_style_border_color(card, COL(C_LAVENDER), 0);
        lv_obj_set_style_border_opa(card, LV_OPA_COVER, 0);
        break;
    }
    if (r->task >= 0) {
        const day_task_t *t = &p->tasks[r->task];
        icon = t->icon[0] ? t->icon : "star-line";
        ui_fmt_time(time, sizeof time, r->start);
        snprintf(ampm, sizeof ampm, "%s", ui_ampm(r->start));
        snprintf(task, sizeof task, "%s", t->title);
        char e[8], dur[16];
        ui_fmt_time(e, sizeof e, r->end);
        fmt_duration(dur, sizeof dur, r->end - r->start);
        snprintf(detail, sizeof detail, "Until %s \xC2\xB7 %s", e, dur);
    } else if (r->chore >= 0) {
        const day_chore_t *c = &p->chores[r->chore];
        icon = c->icon[0] ? c->icon : "sparkles";
        snprintf(task, sizeof task, "%s", c->title);
        if (c->to >= 0) { ui_fmt_time(time, sizeof time, c->to); snprintf(ampm, sizeof ampm, "%s", ui_ampm(c->to)); }
        else { snprintf(time, sizeof time, "Any"); snprintf(ampm, sizeof ampm, "time"); }
        if (c->from >= 0 && c->to >= 0) { fmt_hour(a, sizeof a, c->from); fmt_hour(b, sizeof b, c->to); snprintf(detail, sizeof detail, "Between %s to %s", a, b); }
        else if (c->to >= 0) { fmt_hour(b, sizeof b, c->to); snprintf(detail, sizeof detail, "By %s", b); }
        else if (c->from >= 0) { fmt_hour(a, sizeof a, c->from); snprintf(detail, sizeof detail, "From %s", a); }
        else snprintf(detail, sizeof detail, "anytime");
    } else {
        icon = "kite";
        ui_fmt_time(time, sizeof time, r->start);
        snprintf(ampm, sizeof ampm, "%s", ui_ampm(r->start));
        snprintf(task, sizeof task, "Free time");
        char dur[16];
        fmt_duration(dur, sizeof dur, r->end - r->start);
        snprintf(detail, sizeof detail, "%s all yours", dur);
    }
    if (center) {
        lv_obj_t *tl = ui_label(card, F_ITEM, fg, time);
        lv_obj_set_pos(tl, 24, 18);
        lv_obj_t *ap = ui_label(card, F_CAPTION, sub, ampm);
        lv_obj_set_pos(ap, 24, 47);
        lv_obj_t *ic = ui_icon(card, icon, 26, fg);
        lv_obj_set_pos(ic, 90, 31);
        lv_obj_t *tt = ui_label(card, F_TITLE, fg, task);
        lv_label_set_long_mode(tt, LV_LABEL_LONG_DOT);
        lv_obj_set_width(tt, r->state == ROW_FREE ? 279 : 215);
        lv_obj_set_pos(tt, 130, 16);
        lv_obj_t *dt = ui_label(card, F_CAPTION, sub, detail);
        lv_label_set_long_mode(dt, LV_LABEL_LONG_DOT);
        lv_obj_set_width(dt, 215);
        lv_obj_set_pos(dt, 130, 47);
    } else {
        lv_obj_t *tl = ui_label(card, F_LABEL, fg, time);
        lv_obj_set_pos(tl, 19, 11);
        lv_obj_t *ap = ui_label(card, F_CAPTION, sub, ampm);
        lv_obj_set_pos(ap, 19, 35);
        lv_obj_t *ic = ui_icon(card, icon, 20, fg);
        lv_obj_set_pos(ic, 77, 24);
        lv_obj_t *tt = ui_label(card, F_ITEM, fg, task);
        lv_label_set_long_mode(tt, LV_LABEL_LONG_DOT);
        lv_obj_set_width(tt, 200);
        lv_obj_set_pos(tt, 109, 8);
        lv_obj_t *dt = ui_label(card, F_CAPTION, sub, detail);
        lv_label_set_long_mode(dt, LV_LABEL_LONG_DOT);
        lv_obj_set_width(dt, 200);
        lv_obj_set_pos(dt, 109, 38);
    }
    /* the end of the row: a mint tick, the Now tag, or a chore's ring to tap */
    if (r->state == ROW_DONE || r->state == ROW_CHORE_DONE) {
        int32_t d = center ? 30 : 24;
        lv_obj_t *tick = ui_box(card);
        lv_obj_set_size(tick, d, d);
        lv_obj_set_pos(tick, center ? 379 : 312, center ? 29 : 22);
        ui_style_card(tick, C_MINT, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_t *c = ui_icon(tick, "check", center ? 18 : 14, C_NAVY);
        lv_obj_center(c);
    } else if (r->state == ROW_NOW && center) {
        lv_obj_t *chip = chip_create(card, 0, C_LIME, "Now");
        lv_obj_set_pos(chip, 359, 34);
    } else if (r->state == ROW_CHORE) {
        int32_t d = center ? 32 : 26;
        lv_obj_t *ring = ui_box(card);
        lv_obj_set_size(ring, d, d);
        lv_obj_set_pos(ring, center ? 378 : 310, center ? 28 : 21);
        lv_obj_set_style_radius(ring, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_border_width(ring, 2, 0);
        lv_obj_set_style_border_color(ring, COL(C_NAVY), 0);
        lv_obj_set_style_border_opa(ring, LV_OPA_COVER, 0);
        lv_obj_add_flag(ring, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_ext_click_area(ring, 14);
        lv_obj_add_event_cb(ring, on_row_chore, LV_EVENT_CLICKED, (void *)(intptr_t)r->chore);
    }
}

static void on_tile_say(lv_event_t *e)
{
    const char *text = lv_event_get_user_data(e);
    if (text) hal_speak(text);
}

/* Picture view (Figma "Today's schedule · Younger"): done on top, now in the middle, next below. */
static void sched_tile(const srow_t *r, int which)
{
    const day_plan_t *p = sc.p;
    const char *icon = r->task >= 0 ? p->tasks[r->task].icon : r->chore >= 0 ? p->chores[r->chore].icon : "kite";
    char name[48], t[16], say[80];
    if (r->task >= 0) { char w[24]; snprintf(w, sizeof w, "%s", p->tasks[r->task].title); char *sp = strchr(w, ' '); if (sp) *sp = 0; snprintf(name, sizeof name, "%s", w); }
    else if (r->chore >= 0) snprintf(name, sizeof name, "%s", p->chores[r->chore].title);
    else snprintf(name, sizeof name, "Free time");
    if (r->start >= 0) ui_fmt_time(t, sizeof t, r->start); else snprintf(t, sizeof t, "Any time");
    bool big = which == 1;
    lv_obj_t *tile = ui_box(sc.wheel);
    lv_obj_set_size(tile, big ? 294 : 235, big ? 110 : 79);
    lv_obj_set_pos(tile, big ? 86 : 116, which == 0 ? 82 : which == 1 ? 181 : 311);
    bool done = r->state == ROW_DONE || r->state == ROW_CHORE_DONE;
    if (big) { ui_style_card(tile, C_GLASS, 24, C_LIME, LV_OPA_COVER); lv_obj_set_style_border_width(tile, 3, 0); }
    else ui_style_card(tile, done ? C_DEEP : C_GLASS, 24, C_LINE, LV_OPA_COVER);
    uint32_t fg = done && !big ? C_MUTED : C_BONE;
    lv_obj_t *ic = ui_icon(tile, icon && *icon ? icon : "star-line", big ? 76 : 44, fg);
    lv_obj_set_pos(ic, big ? 19 : 28, big ? 17 : 17);
    lv_obj_t *nm = ui_label(tile, big ? F_TITLE : F_ITEM, fg, name);
    lv_label_set_long_mode(nm, LV_LABEL_LONG_DOT);
    lv_obj_set_width(nm, big ? 150 : 130);
    lv_obj_set_pos(nm, big ? 127 : 88, big ? 28 : 12);
    if (big && r->end > r->start) { char e[8]; ui_fmt_time(e, sizeof e, r->end); snprintf(t + strlen(t), sizeof t - strlen(t), "\xE2\x80\x93%s", e); }
    lv_obj_t *tm = ui_label(tile, F_LABEL, big ? C_LIME : fg, t);
    lv_obj_set_pos(tm, big ? 127 : 88, big ? 57 : 43);
    if (done && which == 0) {
        lv_obj_t *tick = ui_box(sc.wheel);
        lv_obj_set_size(tick, 28, 28);
        lv_obj_set_pos(tick, 329, 74);
        ui_style_card(tick, C_MINT, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_t *c = ui_icon(tick, "check", 16, C_NAVY);
        lv_obj_center(c);
    }
    snprintf(say, sizeof say, "%s at %s", name, t);
    static char said[3][80];
    strcpy(said[which], say);
    lv_obj_add_flag(tile, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(tile, on_tile_say, LV_EVENT_CLICKED, said[which]);
}

static void sched_draw(void)
{
    if (!sched || !sc.wheel) return;
    lv_obj_clean(sc.wheel);
    if (!sc.nrows) return;
    if (sc.picture) {
        for (int k = -1; k <= 1; k++) {
            int i = sc.pos + k;
            if (i < 0 || i >= sc.nrows) continue;
            sched_tile(&sc.rows[i], k + 1);
        }
        /* the path dots between the tiles */
        static const int32_t DOTS[4] = { 164, 172, 294, 302 };
        for (int d = 0; d < 4; d++) {
            if ((d < 2 && sc.pos == 0) || (d >= 2 && sc.pos >= sc.nrows - 1)) continue;
            lv_obj_t *o = ui_box(sc.wheel);
            lv_obj_set_size(o, 6, 6);
            lv_obj_set_pos(o, 230, DOTS[d]);
            ui_style_card(o, C_LINE, 3, 0, 0);
        }
        return;
    }
    if (sc.pos > 0) sched_row(&sc.rows[sc.pos - 1], 107, false);
    sched_row(&sc.rows[sc.pos], 189, true);
    if (sc.pos + 1 < sc.nrows) sched_row(&sc.rows[sc.pos + 1], 291, false);
}

#define SCHED_CLIP_Y 72   /* the rows turn under here; the header above stays put */

static void anim_y(void *obj, int32_t v) { lv_obj_set_y(obj, v); }
static void anim_opa(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }
static void sched_gone(lv_anim_t *a) { lv_obj_delete(a->var); }
static void turn_done(lv_anim_t *a) { (void)a; sc.turning = false; }

static void sched_anim(lv_obj_t *o, lv_anim_exec_xcb_t exec, int32_t v0, int32_t v1, uint32_t ms,
                       lv_anim_path_cb_t path, lv_anim_completed_cb_t done)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, exec);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_path_cb(&a, path);
    if (done) lv_anim_set_completed_cb(&a, done);
    lv_anim_start(&a);
}

/* A fresh set of rows, inside the clip, placed so row positions stay screen positions. */
static lv_obj_t *sched_wheel(void)
{
    lv_obj_t *w = ui_box(sc.clip);
    lv_obj_set_size(w, SCREEN_W, SCREEN_H);
    lv_obj_set_pos(w, 0, -SCHED_CLIP_Y);
    return w;
}

/* The wheel turns one row later (dir +1) or earlier (dir -1): the new rows slide in from that
 * side and fade up while the old ones slide out and fade, so the big middle row seems to roll. */
static void sched_turn_to(int pos, int dir)
{
    lv_obj_t *old = sc.wheel;
    sc.pos = pos;
    sc.wheel = sched_wheel();
    sched_draw();
    int32_t shift = sc.picture ? 115 : 92;
    sc.turning = true;
    lv_obj_set_style_opa(sc.wheel, LV_OPA_TRANSP, 0);
    sched_anim(sc.wheel, anim_y, -SCHED_CLIP_Y + dir * shift, -SCHED_CLIP_Y, 260, lv_anim_path_ease_out, turn_done);
    sched_anim(sc.wheel, anim_opa, LV_OPA_TRANSP, LV_OPA_COVER, 200, lv_anim_path_ease_out, NULL);
    sched_anim(old, anim_y, -SCHED_CLIP_Y, -SCHED_CLIP_Y - dir * shift, 260, lv_anim_path_ease_out, sched_gone);
    sched_anim(old, anim_opa, LV_OPA_COVER, LV_OPA_TRANSP, 200, lv_anim_path_ease_in, NULL);
    hal_play(HAL_SOUND_TICK);
}

/* Let go of the sheet before it was pulled far enough: it springs back up. */
static void sheet_back(void)
{
    if (!sched || lv_anim_get(sched, anim_y)) return;
    sched_anim(sched, anim_y, lv_obj_get_y(sched), 0, 240, lv_anim_path_ease_out, NULL);
}

/* The finger on the sheet. Taken by its header it follows the finger down, and closes once it has
 * been pulled past 120 px (or springs back). On the rows a drag up shows later rows, a drag down
 * earlier ones. A quick flick down anywhere puts the sheet away (swipe.c). */
static void sched_touch(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_point_t pt;
    lv_indev_get_point(lv_indev_active(), &pt);
    if (code == LV_EVENT_PRESSED) { sc.press_y = pt.y; sc.sheet_drag = pt.y < SCHED_CLIP_Y; return; }
    if (code == LV_EVENT_PRESSING) {
        if (sc.sheet_drag && sched) { int32_t dy = pt.y - sc.press_y; lv_obj_set_y(sched, dy > 0 ? dy : 0); }
        return;
    }
    if (code != LV_EVENT_RELEASED && code != LV_EVENT_PRESS_LOST) return;
    if (sc.sheet_drag) {
        sc.sheet_drag = false;
        if (sched && lv_obj_get_y(sched) > 120) schedule_close();
        else sheet_back();
        return;
    }
    if (sc.turning) return;
    int32_t dy = pt.y - sc.press_y;
    if (dy <= -40 && sc.pos < sc.nrows - 1) sched_turn_to(sc.pos + 1, +1);
    else if (dy >= 40 && sc.pos > 0) sched_turn_to(sc.pos - 1, -1);
}

static bool sched_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)start; (void)user;
    if (dir == SWIPE_UP) return false;
    if (commit) {
        if (dir == SWIPE_DOWN) schedule_close();      /* it came up: a flick down sends it back down */
        else overlay_slide_away(sched, dir);
    }
    return true;
}

void schedule_open(const day_plan_t *p, const logic_now_t *n, int now_min, bool picture, schedule_cb_t on_chore)
{
    lv_obj_t *o = open_overlay(&sched, false);
    swipe_add(o, sched_swipe, NULL);
    lv_obj_add_event_cb(o, sched_touch, LV_EVENT_ALL, NULL);
    memset(&sc, 0, sizeof sc);
    sc.p = p; sc.n = n; sc.now_min = now_min; sc.picture = picture; sc.on_chore = on_chore; sc.pos = -1;
    header(o, "calendar", C_BONE, picture ? "Today" : "Today\xE2\x80\x99s Schedule", NULL, 0);
    sc.clip = ui_box(o);
    lv_obj_set_pos(sc.clip, 0, SCHED_CLIP_Y);
    lv_obj_set_size(sc.clip, SCREEN_W, SCREEN_H - SCHED_CLIP_Y);
    sc.wheel = sched_wheel();
    sched_rows();
    sched_draw();
    /* the sheet slides up from the bottom and settles */
    sched_anim(o, anim_y, SCREEN_H, 0, 320, lv_anim_path_ease_out, NULL);
}

void schedule_refresh(const day_plan_t *p, const logic_now_t *n, int now_min)
{
    if (!sched) return;
    sc.p = p; sc.n = n; sc.now_min = now_min;
    sched_rows();
    sched_draw();
}

bool schedule_is_open(void) { return sched != NULL; }

void schedule_close(void)
{
    if (!sched) return;
    lv_obj_t *o = sched;
    sched = NULL;
    lv_anim_delete(o, anim_y);   /* still arriving or springing back: it turns round from where it is */
    /* back down the way it came, shorter if it was already pulled part of the way */
    int32_t from = lv_obj_get_y(o);
    uint32_t ms = (uint32_t)(260 * (SCREEN_H - from) / SCREEN_H);
    sched_anim(o, anim_y, from, SCREEN_H, ms < 120 ? 120 : ms, lv_anim_path_ease_in_out, sched_gone);
}

/* ================================================================ Other things to finish */
static overlay_cb_t others_cb;
static lv_obj_t *others_list;

static void on_other(lv_event_t *e)
{
    int task = (int)(intptr_t)lv_event_get_user_data(e);
    if (others_cb) others_cb(task);
}

void others_refresh(const day_plan_t *p, const logic_now_t *n)
{
    if (!others) return;
    lv_obj_clean(others_list);
    for (int k = 0; k < n->nstill; k++) {
        const day_task_t *t = &p->tasks[n->still[k]];
        lime_card_t c;
        lime_card_create(others_list, &c, 270);
        lime_card_set(&c, "clock", t->title, CARD_END_TAP);
        lv_obj_add_flag(c.root, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_bg_color(c.root, COL(C_BONE), LV_STATE_PRESSED);
        lv_obj_add_event_cb(c.root, on_other, LV_EVENT_CLICKED, (void *)(intptr_t)n->still[k]);
    }
    if (!n->nstill) overlay_fade_away(others);
}

/* Figma Task · Other things to finish: the header, lime checklists 270 wide from y 108, Biscuit
 * 135 px at (166, 259). */
void others_open(const day_plan_t *p, const logic_now_t *n, overlay_cb_t on_done)
{
    others_cb = on_done;
    lv_obj_t *o = open_overlay(&others, true);
    /* Figma: the title wraps onto two lines, "You can do it!" under it */
    lv_obj_t *ht = header(o, "listchecks", C_BONE, "Other things to finish", NULL, 0);
    lv_obj_set_width(ht, 234);
    lv_label_set_long_mode(ht, LV_LABEL_LONG_WRAP);
    lv_obj_align(ht, LV_ALIGN_TOP_MID, 0, ui_picture() ? 38 : 14);
    lv_obj_t *hs = ui_label(o, F_LABEL, C_MUTED, "You can do it!");
    lv_obj_align(hs, LV_ALIGN_TOP_MID, 0, ui_picture() ? 96 : 82);
    others_list = ui_box(o);
    lv_obj_set_size(others_list, 270, 150);
    lv_obj_set_pos(others_list, 98, 108);
    lv_obj_add_flag(others_list, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_scroll_dir(others_list, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(others_list, LV_SCROLLBAR_MODE_OFF);
    lv_obj_set_flex_flow(others_list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(others_list, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(others_list, 10, 0);
    lv_obj_add_flag(others_list, LV_OBJ_FLAG_GESTURE_BUBBLE);
    lv_obj_t *pet = scene(o, 135, 166);
    lv_obj_set_pos(pet, 166, 259);
    pet_set_mood(pet, PET_MOOD_HAPPY);
    pet_react(pet, PET_CLIP_ENCOURAGE);
    others_refresh(p, n);
    overlay_enter_push(o);
}

bool others_is_open(void) { return others != NULL; }

/* ================================================================ get-ready reminder */
static time_pill_t rem_pill;

static void on_ok(lv_event_t *e)
{
    (void)e;
    if (reminder) overlay_fade_away(reminder);
}

void reminder_update(int32_t seconds_left)
{
    if (!reminder) return;
    char s[24];
    int mins = (seconds_left + 59) / 60;
    snprintf(s, sizeof s, "Starts in %d min", mins < 1 ? 1 : mins);
    time_pill_set(&rem_pill, "timer", s, C_LIME);
    lv_obj_update_layout(rem_pill.root);
    lv_obj_align(rem_pill.root, LV_ALIGN_TOP_MID, 0, 69);
}

/* Figma Free time · Dinner soon: the next thing's icon and "Dinner soon", a lime "Starts in 5 min"
 * pill, a lavender "Get ready for dinner", Biscuit waving, and Dinner in the Next pill. */
void reminder_open(const char *next_icon, const char *next_title, const char *next_time, int32_t seconds_left, bool picture)
{
    lv_obj_t *o = open_overlay(&reminder, true);
    lv_obj_add_event_cb(o, on_ok, LV_EVENT_CLICKED, NULL);
    lv_obj_t *pet = scene(o, 286, 90);
    pet_set_mood(pet, PET_MOOD_EXCITED);
    pet_force_clip(pet, PET_CLIP_WAVE);
    char title[56], ready[64], low[48];
    snprintf(title, sizeof title, "%s soon", next_title);
    header(o, next_icon && *next_icon ? next_icon : "alarm", C_BONE, picture ? "" : title, NULL, 0);
    time_pill_create(o, &rem_pill);
    reminder_update(seconds_left);
    size_t i = 0;
    for (; next_title[i] && i < sizeof low - 1; i++) low[i] = (char)((next_title[i] >= 'A' && next_title[i] <= 'Z') ? next_title[i] + 32 : next_title[i]);
    low[i] = 0;
    snprintf(ready, sizeof ready, "Get ready for %s", low);
    lime_card_t c;
    lime_card_create(o, &c, 0);
    lime_card_set(&c, "alarm", picture ? "" : ready, CARD_END_NONE);
    lv_obj_update_layout(c.root);
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, 99);
    static next_block_t nb;
    next_block_create(o, &nb, NULL, NULL);
    next_block_set(&nb, next_icon, next_title, next_time, 0);
    hal_play(HAL_SOUND_SOON);
    auto_close(&reminder, 15000);
    overlay_enter_rise(o);
}

bool reminder_is_open(void) { return reminder != NULL; }

/* ================================================================ reward approved */
/* Figma Rewards · 05 · Approved!, choreographed after artifacts/reward-burst/index.html: the
 * reward's icon arrives in the middle while 24 dots charge round it; at 0.7 s the burst (a flash,
 * dot shockwaves, rays, confetti, the chime, the screen jolts), Biscuit's window switches on and
 * he springs out in his Celebrate clip, the icon flies up to the header, three dot rings spring
 * into place and twinkle, the title's words pop in, his bubble rises. Then the party loop: his
 * hops throw sparks from his paws and a little confetti keeps falling, until the child swipes. */
#define AP_BURST 700
static struct { char title[56]; lv_obj_t *icon, *overline; int32_t icon_x; bubble_t bubble; } ap;

static void ap_tick(lv_obj_t *o, void *u) { (void)o; (void)u; hal_play(HAL_SOUND_TICK); }
static void ap_go(lv_obj_t *o, void *u) { (void)o; pet_set_paused(u, false); }
static void ap_burst(lv_obj_t *o, void *u)
{
    (void)u;
    hal_play(HAL_SOUND_CHIME);
    fx_jolt(o, 6, 900, 0);
    fx_confetti(o, CENTER, CENTER, 110, FX_PARTY, 6, 300);
    fx_fly(ap.icon, CENTER, CENTER, ap.icon_x, 24, 294, 107, 420, 0, true);   /* up to the header, 20 px */
    fx_rise(ap.overline, 8, 300);
}
static void ap_halo(lv_obj_t *o, void *u)
{
    (void)u;
    static const uint32_t C[3] = { 0xEAB5DE, 0xF7945A, C_LAVENDER };
    static const lv_opa_t O[3] = { LV_OPA_COVER, LV_OPA_COVER, LV_OPA_COVER };
    fx_halo(o, C, O, 0, 0);
}
static void ap_title(lv_obj_t *o, void *u) { (void)u; fx_words(o, ap.title, F_TITLE, C_BONE, 42, 0, 60); }
static void ap_bubble(lv_obj_t *o, void *u)
{
    (void)u;
    bubble_create(o, &ap.bubble);
    bubble_say_top(&ap.bubble, "Hooray! Have the best time!", 386);
    fx_rise(ap.bubble.root, 12, 0);
    fx_rise(ap.bubble.tail, 12, 0);
}
static void ap_party(lv_obj_t *o, void *u) { (void)u; fx_drizzle(o, 0, FX_PARTY, 6); }

void approved_open(const day_reward_t *r, const char *child_name, const char *pet_name)
{
    (void)child_name; (void)pet_name;
    lv_obj_t *o = open_overlay(&approved, true);
    snprintf(ap.title, sizeof ap.title, "%s!", r->title);
    /* Biscuit waits in the dark; his clip starts a little before the burst so his first jump takes off with it */
    lv_obj_t *pet = scene(o, 232, 117);
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    pet_set_paused(pet, true);
    fx_iris(pet, 140, AP_BURST);
    fx_burst_cfg_t cfg = { .charge = true, .burst_at = AP_BURST, .flash_r = 290, .waves = 3, .rays = true };
    fx_burst_create(o, CENTER, CENTER, &cfg);
    /* the header: the icon lands left of "Woohoo, you earned it!" */
    ap.overline = ui_label(o, F_LABEL, C_MUTED, "Woohoo, you earned it!");
    lv_obj_update_layout(ap.overline);
    int32_t row = 20 + 6 + lv_obj_get_width(ap.overline);
    ap.icon_x = CENTER - row / 2 + 10;
    lv_obj_set_pos(ap.overline, CENTER - row / 2 + 26, 14);
    lv_obj_set_style_opa(ap.overline, LV_OPA_TRANSP, 0);
    /* the reward's icon arrives in the middle, 64 px */
    ap.icon = ui_icon(o, r->icon[0] ? r->icon : "gift", 48, C_LIME);
    lv_obj_add_flag(ap.icon, LV_OBJ_FLAG_IGNORE_LAYOUT);
    fx_fly(ap.icon, CENTER, CENTER, CENTER, CENTER, 60, 341, 350, 30, false);
    for (uint32_t k = 0; k < 5; k++) fx_at(o, 120 + k * 100, ap_tick, NULL);
    fx_at(o, AP_BURST - 420, ap_go, pet);
    fx_at(o, AP_BURST, ap_burst, NULL);
    fx_at(o, AP_BURST + 160, ap_halo, NULL);
    fx_at(o, 1150, ap_title, NULL);
    fx_at(o, 1950, ap_bubble, NULL);
    fx_at(o, 2400, ap_party, NULL);
    auto_close(&approved, 120000);   /* the party goes on until the child swipes it away */
}

/* ================================================================ reward screens */
/* Rewards · 03 · Waiting and 06 · Not this time share one layout: the lavender circle (293 px at
 * 87, 87) with the reward's picture in a peach circle, its name, two lines, and one button. */
static overlay_cb_t circle_cb;
static lv_obj_t **circle_slot;

static void on_circle_button(lv_event_t *e)
{
    (void)e;
    if (circle_slot && *circle_slot) {
        /* Asked was pushed in from the shop, so it backs out to the right; Not this time came up on its own */
        if (circle_slot == &asked) overlay_slide_away(*circle_slot, 1);
        else overlay_fade_away(*circle_slot);
    }
    if (circle_cb) circle_cb(0);
}

static void circle_screen(lv_obj_t **slot, const char *icon, const char *title, const day_reward_t *r,
                          const char *copy, const char *button, overlay_cb_t cb)
{
    circle_slot = slot;
    circle_cb = cb;
    lv_obj_t *o = open_overlay(slot, true);
    header(o, icon, C_BONE, title, NULL, 0);
    lv_obj_t *card = ui_box(o);
    lv_obj_set_size(card, 293, 293);
    lv_obj_set_pos(card, 87, 87);
    ui_style_card(card, C_LAVENDER, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_t *pic = reward_picture(card, r, 60);
    lv_obj_set_pos(pic, 117, 70);
    lv_obj_t *name = ui_label(card, F_ITEM, C_NAVY, r->title);
    lv_obj_set_width(name, 270);
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_set_pos(name, 12, 135);
    lv_obj_t *c = ui_label(card, F_BODY_P, C_NAVY, copy);
    lv_obj_set_width(c, 245);
    lv_obj_set_style_text_align(c, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(c, 24, 169);
    lv_obj_t *btn = button_create(o, BTN_PRIMARY, false, "gift", button);
    lv_obj_add_event_cb(btn, on_circle_button, LV_EVENT_CLICKED, NULL);
    lv_obj_update_layout(btn);
    lv_obj_align(btn, LV_ALIGN_TOP_MID, 0, 402);
    if (slot == &asked) overlay_enter_push(o);
    else overlay_enter_rise(o);
}

void denied_open(const day_reward_t *r, const char *note, overlay_cb_t on_shop)
{
    char copy[120];
    if (note && *note) snprintf(copy, sizeof copy, "Your %d stars are back.\n%s", r->cost, note);
    else snprintf(copy, sizeof copy, "Your %d stars are back.\nMaybe another day!", r->cost);
    circle_screen(&denied, "heart", "Not this time", r, copy, "Back to shop", on_shop);
    auto_close(&denied, 20000);
}

/* Figma Reward spotlight: the picture on a 212 px card circle centred at (233, 178), a dotted orbit
 * (248 across, 70 %), two little stars, and a badge at the bottom right when there is one. */
static void reward_spotlight(lv_obj_t *o, const day_reward_t *r, uint32_t orbit, uint32_t star1, uint32_t star2)
{
    lv_obj_t *spot = ui_box(o);
    lv_obj_set_size(spot, 212, 212);
    lv_obj_set_pos(spot, 127, 72);
    ui_style_card(spot, C_GLASS, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_t *ring = ring_create(o, 124);
    lv_obj_align(ring, LV_ALIGN_CENTER, 0, -54);
    ring_style_t s = ring_style(60, orbit, orbit);
    s.count = 36;
    s.lit = 36;
    s.arc = false;
    s.edge = 0;
    s.lit_r = 2.1f;
    s.dim_r = 2.1f;
    s.lit_opa = s.dim_opa = 178;
    ring_set(ring, &s);
    const lv_image_dsc_t *art = reward_art(r->icon);
    if (art) {
        lv_obj_t *img = lv_image_create(spot);
        lv_image_set_src(img, art);
        lv_image_set_scale(img, (uint32_t)(256 * 138 / 72));   /* an 88-in-112 picture, at 176 */
        lv_obj_center(img);
    } else {
        lv_obj_t *ic = ui_icon(spot, r->icon[0] ? r->icon : "gift", 96, C_BONE);
        lv_obj_center(ic);
    }
    lv_obj_t *s1 = ui_icon(o, "star-fill", 24, star1);
    lv_obj_set_pos(s1, 109, 119);
    lv_obj_t *s2 = ui_icon(o, "star-fill", 18, star2);
    lv_obj_set_pos(s2, 339, 183);
}

void reward_asked_open(const day_reward_t *r)
{
    circle_slot = &asked;
    circle_cb = NULL;
    lv_obj_t *o = open_overlay(&asked, true);
    header(o, "star-line", C_BONE, "Request sent!", NULL, 0);
    reward_spotlight(o, r, C_MINT, C_MINT, C_LAVENDER);
    /* the badge: a kite in a mint circle with an ink edge, bottom right of the spotlight */
    lv_obj_t *badge = ui_box(o);
    lv_obj_set_size(badge, 48, 48);
    lv_obj_set_pos(badge, 309, 231);
    ui_style_card(badge, C_MINT, LV_RADIUS_CIRCLE, C_INK, LV_OPA_COVER);
    lv_obj_set_style_border_width(badge, 4, 0);
    lv_obj_t *ki = ui_icon(badge, "kite", 24, C_NAVY);
    lv_obj_center(ki);
    lv_obj_t *name = ui_label(o, F_ITEM, C_BONE, r->title);
    lv_obj_set_width(name, 320);
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_align(name, LV_ALIGN_TOP_MID, 0, 306);
    lv_obj_t *c = ui_label(o, F_BODY_P, C_MUTED, "Waiting for a grown-up");
    lv_obj_set_width(c, 320);
    lv_obj_set_style_text_align(c, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(c, LV_ALIGN_TOP_MID, 0, 342);
    lv_obj_t *btn = button_create(o, BTN_PRIMARY, false, "gift", "Back to shop");
    lv_obj_add_event_cb(btn, on_circle_button, LV_EVENT_CLICKED, NULL);
    lv_obj_update_layout(btn);
    lv_obj_align(btn, LV_ALIGN_TOP_MID, 0, 402);
    overlay_enter_push(o);
}

/* Figma Rewards · 02 · Choose and ask: the picture in a 112 px peach circle, the name, the price
 * in amber, Ask for this (lime) and Not now (lime words). */
static overlay_cb_t ask_cb;
static int ask_index;

static void on_ask(lv_event_t *e)
{
    (void)e;
    if (chosen) overlay_slide_away(chosen, -1);
    if (ask_cb) ask_cb(ask_index);
}

static void on_not_now(lv_event_t *e)
{
    (void)e;
    if (chosen) overlay_slide_away(chosen, 1);   /* back to the shop, the way it came */
}

void reward_choose_open(const day_reward_t *r, int index, int stars, overlay_cb_t cb)
{
    ask_cb = cb;
    ask_index = index;
    lv_obj_t *o = open_overlay(&chosen, true);
    header(o, "star-line", C_BONE, "Want this reward?", NULL, 0);
    reward_spotlight(o, r, C_LAVENDER, C_BUTTER, 0xEAB5DE);
    bool enough = stars >= r->cost;
    /* the price: a card pill over the bottom of the spotlight, the stars in amber */
    lv_obj_t *price = ui_row(o, 6);
    lv_obj_set_height(price, 38);
    lv_obj_set_style_pad_hor(price, 14, 0);
    lv_obj_set_flex_align(price, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    ui_style_card(price, C_GLASS, 20, C_LINE, LV_OPA_COVER);
    char cost[24];
    if (enough) snprintf(cost, sizeof cost, "%d stars", r->cost);
    else snprintf(cost, sizeof cost, "%d more stars", r->cost - stars);
    ui_icon(price, "star-fill", 22, enough ? C_BUTTER : C_MUTED);
    ui_label(price, F_ITEM, enough ? C_BUTTER : C_MUTED, cost);
    lv_obj_update_layout(price);
    lv_obj_align(price, LV_ALIGN_TOP_MID, 0, 263);
    lv_obj_t *name = ui_label(o, F_ITEM, C_BONE, r->title);
    lv_obj_set_width(name, 320);
    lv_obj_set_style_text_align(name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
    lv_obj_align(name, LV_ALIGN_TOP_MID, 0, 312);
    if (enough) {
        lv_obj_t *ask = button_create(o, BTN_PRIMARY, false, NULL, "Ask for this");
        lv_obj_add_event_cb(ask, on_ask, LV_EVENT_CLICKED, NULL);
        lv_obj_update_layout(ask);
        lv_obj_align(ask, LV_ALIGN_TOP_MID, 0, 355);
    }
    lv_obj_t *no = button_create(o, BTN_TERTIARY, false, NULL, enough ? "Not now" : "Back to shop");
    lv_obj_add_event_cb(no, on_not_now, LV_EVENT_CLICKED, NULL);
    lv_obj_update_layout(no);
    lv_obj_align(no, LV_ALIGN_TOP_MID, 0, enough ? 405 : 355);
    overlay_enter_push(o);   /* a reward tapped in the shop: in from the right, out the same way */
}

/* ================================================================ stars from a grown-up */
/* Figma Rewards · 07 · You got a star!, with the same choreography as the approved reward: a
 * star charges and bursts in the middle, flies up into the stars pill as the count ticks up,
 * Biscuit springs out, a butter halo, the title's words pop in, the grown-up's reason rises. */
#define SX_BURST 700
static struct { char title[32], note[96]; lv_obj_t *icon, *pill, *pill_icon, *label; int from, to; } sx;

static void sx_go(lv_obj_t *o, void *u) { (void)o; pet_set_paused(u, false); }
static void sx_burst(lv_obj_t *o, void *u)
{
    (void)u;
    hal_play(HAL_SOUND_CHIME);
    fx_jolt(o, 6, 900, 0);
    fx_confetti(o, CENTER, CENTER, 100, FX_BRAND, 7, 300);
    lv_area_t a, oa;
    lv_obj_get_coords(sx.pill_icon, &a);
    lv_obj_get_coords(o, &oa);
    int32_t ty = (a.y1 + a.y2) / 2 - oa.y1 - lv_obj_get_style_translate_y(sx.pill, 0);
    fx_fly(sx.icon, CENTER, CENTER, (a.x1 + a.x2) / 2 - oa.x1, ty, 294, 85, 420, 0, true);   /* into the pill's star */
}
static void sx_land(lv_obj_t *o, void *u)
{
    (void)o; (void)u;
    lv_obj_set_style_opa(sx.pill_icon, LV_OPA_COVER, 0);
    if (sx.icon) { lv_obj_delete(sx.icon); sx.icon = NULL; }
    fx_count(sx.label, sx.from, sx.to, "%d stars", 900);
    fx_bounce(sx.pill, 10, 950);
}
static void sx_halo(lv_obj_t *o, void *u)
{
    (void)u;
    static const uint32_t C[3] = { C_BUTTER, C_BUTTER, C_BUTTER };
    static const lv_opa_t O[3] = { LV_OPA_COVER, 153, 89 };
    fx_halo(o, C, O, 0, 0);
}
static void sx_title(lv_obj_t *o, void *u) { (void)u; fx_words(o, sx.title, F_TITLE, C_BONE, 42, 0, 60); }
static void sx_note(lv_obj_t *o, void *u) { (void)u; if (sx.note[0]) message(o, "star-fill", sx.note, 386); }
static void sx_party(lv_obj_t *o, void *u) { (void)u; fx_drizzle(o, 0, FX_BRAND, 7); }

void stars_open(int delta, int total, const char *note)
{
    lv_obj_t *o = open_overlay(&stars, true);
    if (delta > 1) snprintf(sx.title, sizeof sx.title, "%d new stars!", delta);
    else snprintf(sx.title, sizeof sx.title, "You got a star!");
    snprintf(sx.note, sizeof sx.note, "%s", note ? note : "");
    sx.from = total - delta;
    sx.to = total;
    lv_obj_t *pet = scene(o, 232, 117);
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    pet_set_paused(pet, true);
    fx_iris(pet, 140, SX_BURST);
    fx_burst_cfg_t cfg = { .charge = true, .burst_at = SX_BURST, .flash_r = 290, .waves = 3, .rays = true };
    fx_burst_create(o, CENTER, CENTER, &cfg);
    lv_obj_t *ov = ui_label(o, F_LABEL, C_MUTED, "Woohoo!");
    lv_obj_align(ov, LV_ALIGN_TOP_MID, 0, 14);
    fx_rise(ov, 8, 1000);
    char count[24];
    snprintf(count, sizeof count, "%d stars", sx.from);
    sx.pill = status_pill_create(o, "star-fill", count, C_BUTTER);
    lv_obj_update_layout(sx.pill);
    lv_obj_align(sx.pill, LV_ALIGN_TOP_MID, 0, 73);
    sx.pill_icon = lv_obj_get_child(sx.pill, 0);
    sx.label = lv_obj_get_child(sx.pill, 1);
    lv_obj_set_style_opa(sx.pill_icon, LV_OPA_TRANSP, 0);
    fx_rise(sx.pill, 10, 900);
    sx.icon = ui_icon(o, "star-fill", 48, C_BUTTER);
    lv_obj_add_flag(sx.icon, LV_OBJ_FLAG_IGNORE_LAYOUT);
    fx_fly(sx.icon, CENTER, CENTER, CENTER, CENTER, 60, 341, 350, 30, false);
    fx_at(o, SX_BURST - 420, sx_go, pet);
    fx_at(o, SX_BURST, sx_burst, NULL);
    fx_at(o, SX_BURST + 160, sx_halo, NULL);
    fx_at(o, SX_BURST + 420, sx_land, NULL);
    fx_at(o, 1150, sx_title, NULL);
    fx_at(o, 1730, sx_note, NULL);
    fx_at(o, 2400, sx_party, NULL);
    auto_close(&stars, 30000);
}

/* ================================================================ streak stars */
static overlay_cb_t shop_cb;
static void on_shop(lv_event_t *e)
{
    (void)e;
    if (streak) overlay_slide_away(streak, -1);
    if (shop_cb) shop_cb(0);
}

static void star_row(lv_obj_t *o, const day_streak_t *s, int size, int32_t y, int lit)
{
    lv_obj_t *row = ui_row(o, 6);
    ui_icon(row, s->icon[0] ? s->icon : "bed", 18, C_MUTED);
    int goal = s->goal > 8 ? 7 : s->goal - 1;  /* the last star is the prize ring */
    for (int i = 0; i < goal; i++) {
        lv_obj_t *st = ui_icon(row, i < lit ? "star-fill" : "star-line", size, C_BUTTER);
        if (i >= lit) lv_obj_set_style_image_opa(st, LV_OPA_30, 0);
    }
    lv_obj_t *prize = ui_box(row);
    lv_obj_set_size(prize, size + 12, size + 12);
    lv_obj_set_style_radius(prize, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(prize, 2, 0);
    lv_obj_set_style_border_color(prize, COL(C_BUTTER), 0);
    lv_obj_set_style_border_opa(prize, LV_OPA_COVER, 0);
    char n[8];
    snprintf(n, sizeof n, "%d", s->prize);
    lv_obj_t *l = ui_label(prize, F_TAG, C_BUTTER, n);
    lv_obj_center(l);
    lv_obj_update_layout(row);
    lv_obj_align(row, LV_ALIGN_TOP_MID, 0, y);
}

void streak_open(const day_streak_t *s, bool big, const char *shop_line, overlay_cb_t on_shop_cb, bool picture)
{
    shop_cb = on_shop_cb;
    lv_obj_t *o = open_overlay(&streak, true);
    char t[48], sub[32];
    if (big) {
        snprintf(t, sizeof t, picture ? "Yay!" : "%d nights in a row!", s->goal);
        snprintf(sub, sizeof sub, "%d stars", s->prize);
        header(o, NULL, 0, t, NULL, 0);
        lv_obj_t *pill = status_pill_create(o, "star-fill", picture ? "" : sub, C_BUTTER);
        lv_obj_update_layout(pill);
        lv_obj_align(pill, LV_ALIGN_TOP_MID, 0, 69);
        lv_obj_t *pet = scene(o, 232, 117);
        pet_force_clip(pet, PET_CLIP_CELEBRATE);
        static const uint32_t COLS[3] = { C_BUTTER, C_BUTTER, C_BUTTER };
        static const lv_opa_t OPAS[3] = { LV_OPA_COVER, 153, 89 };
        fx_halo(o, COLS, OPAS, 0, 0);
        if (shop_line && shop_line[0]) {
            lime_card_t c;
            lime_card_create(o, &c, 0);
            lime_card_set(&c, "gift", shop_line, CARD_END_NONE);
            lv_obj_add_flag(c.root, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_event_cb(c.root, on_shop, LV_EVENT_CLICKED, NULL);
            lv_obj_update_layout(c.root);
            lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, 388);
        }
        auto_close(&streak, 9000);
    } else {
        snprintf(sub, sizeof sub, "%d of %d nights", s->count, s->goal);
        header(o, NULL, 0, picture ? "Yay!" : "Yay, another star!", picture ? "" : sub, C_BUTTER);
        if (picture) hal_speak("Yay!");
        lv_obj_t *pet = scene(o, 232, 117);
        pet_force_clip(pet, PET_CLIP_CELEBRATE);
        lv_obj_t *r = ring_create(o, 156);
        lv_obj_align(r, LV_ALIGN_CENTER, 0, 0);
        ring_style_t st = ring_style(60, C_BUTTER, C_DOT_OFF);
        ring_set(r, &st);
        star_row(o, s, picture ? 26 : 22, picture ? 380 : 384, s->count);
        auto_close(&streak, 6000);
    }
    hal_play(HAL_SOUND_CHIME);
}

/* ================================================================ battery low */
static lv_obj_t *battery_pill;

/* Figma Connection · Battery low: the alert icon, "Battery low", the charge left as a Status
 * pill, a sleepy Biscuit, and one message. Nothing to tap. */
void battery_open(int percent)
{
    char left[16];
    snprintf(left, sizeof left, "%d%% left", percent);
    if (battery) {
        lv_obj_t *old = battery_pill;
        battery_pill = status_pill_create(battery, "battery", left, C_BONE);
        lv_obj_move_to_index(battery_pill, lv_obj_get_index(old));
        lv_obj_delete(old);
        lv_obj_update_layout(battery_pill);
        lv_obj_align(battery_pill, LV_ALIGN_TOP_MID, 0, 69);
        return;
    }
    lv_obj_t *o = open_overlay(&battery, true);
    header(o, "alert", C_BONE, "Battery low", NULL, 0);
    battery_pill = status_pill_create(o, "battery", left, C_BONE);
    lv_obj_update_layout(battery_pill);
    lv_obj_align(battery_pill, LV_ALIGN_TOP_MID, 0, 69);
    lv_obj_t *pet = scene(o, 286, 90);
    pet_set_mood(pet, PET_MOOD_DROWSY);
    message(o, "house", "Put me on my dock", 388);
    hal_play(HAL_SOUND_SOON);
    auto_close(&battery, 20000);
    overlay_enter_rise(o);
}

void battery_close(void)
{
    if (battery) overlay_fade_away(battery);
}

bool battery_is_open(void) { return battery != NULL; }

/* ================================================================ system screens */
static overlay_cb_t retry_cb;
static void on_retry(lv_event_t *e)
{
    (void)e;
    if (retry_cb) retry_cb(0);
}

static void try_again(lv_obj_t *o)
{
    lv_obj_t *btn = button_create(o, BTN_PRIMARY, false, "retry", "Try again");
    lv_obj_add_event_cb(btn, on_retry, LV_EVENT_CLICKED, NULL);
    lv_obj_update_layout(btn);
    lv_obj_align(btn, LV_ALIGN_TOP_MID, 0, 388);
}

void system_show(sys_screen_t which, const char *detail, overlay_cb_t cb)
{
    retry_cb = cb;
    if (which == SYS_SCREEN_NONE) {
        lv_obj_t *o = sys;
        sys = NULL;
        sys_kind = SYS_SCREEN_NONE;
        if (o) overlay_fade_away(o);   /* the day fades in underneath */
        return;
    }
    if (sys && sys_kind == which) return;
    sys_kind = which;
    lv_obj_t *o = open_overlay(&sys, false);
    if (which == SYS_SCREEN_LOADING) {
        /* Figma Connection · Loading: a lime comet on 40 dots 135 px out, Biscuit, one message */
        lv_obj_t *r = ring_create(o, 160);
        lv_obj_align(r, LV_ALIGN_CENTER, 0, 0);
        ring_style_t s = ring_style(0, C_LIME, C_DOT_OFF);
        s.count = 40;
        s.comet = true;
        s.arc = false;    /* the comet runs round the whole circle */
        s.edge = 0;
        s.lit_r = 3.65f;
        s.dim_r = 2.25f;
        ring_set(r, &s);
        lv_obj_t *pet = scene(o, 286, 90);
        pet_set_mood(pet, PET_MOOD_IDLE);
        header(o, "sun", C_BONE, detail && *detail ? detail : "Hello!", "Getting your day ready", C_MUTED);
        message(o, "clock", "Just a moment\xE2\x80\xA6", 388);
    } else if (which == SYS_SCREEN_OFFLINE) {
        /* Figma Connection · Can’t reach the internet */
        lv_obj_t *pet = scene(o, 286, 90);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        header(o, "wifioff", C_BONE, "Let\xE2\x80\x99s reconnect", "We can\xE2\x80\x99t connect right now", C_MUTED);
        try_again(o);
    } else if (which == SYS_SCREEN_PAIRING) {
        /* Figma Connection · First start · pairing: Biscuit looks around; the code in Clock 48 */
        lv_obj_t *pet = scene(o, 286, 90);
        pet_set_mood(pet, PET_MOOD_IDLE);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        header(o, "sparkles", C_BONE, "Hello!", "Ask a grown-up to open the app", C_MUTED);
        lv_obj_t *l = ui_label(o, F_TAG, C_MUTED, "Code for the app");
        lv_obj_align(l, LV_ALIGN_TOP_MID, 0, 362);
        lv_obj_t *code = ui_label(o, F_CLOCK, C_BONE, detail && *detail ? detail : "");
        lv_obj_align(code, LV_ALIGN_TOP_MID, 0, 380);
    } else {
        /* Figma Connection · Something went wrong: a friendly line, one message, Try again */
        lv_obj_t *pet = scene(o, 286, 90);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        header(o, "alert", C_BONE, "Let\xE2\x80\x99s try again", "Your day didn\xE2\x80\x99t load", C_MUTED);
        message(o, "alert", "Biscuit hit a little bump", 73);
        try_again(o);
    }
    overlay_enter_rise(o);
}

sys_screen_t system_showing(void) { return sys ? sys_kind : SYS_SCREEN_NONE; }

void overlays_close_idle(void)
{
    if (sched) schedule_close();
    if (others) overlay_slide_away(others, -1);
}

void overlays_close_all(void)
{
    lv_obj_t **slots[] = { &sched, &others, &reminder, &approved, &denied, &chosen, &asked, &stars, &streak, &battery };
    for (unsigned i = 0; i < sizeof slots / sizeof slots[0]; i++)
        if (*slots[i]) { lv_obj_delete(*slots[i]); *slots[i] = NULL; }
}
