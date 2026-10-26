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

static lv_obj_t *sched, *others, *reminder, *approved, *denied, *stars, *streak, *battery, *sys;
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
        lv_free(lv_obj_get_user_data(old));
        lv_obj_set_user_data(old, NULL);
        overlay_fade_away(old);
    }
    lv_obj_t *o = overlay_create();
    *slot = o;
    lv_obj_add_event_cb(o, on_deleted, LV_EVENT_DELETE, slot);
    if (swipe) swipe_to_close(o, cleared, slot);
    return o;
}

static void close_later(lv_timer_t *t) { overlay_fade_away(lv_timer_get_user_data(t)); }
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

/* ---- MyToki 2 parts on an overlay ---- */
/* The Header: the clock (when `clock`), the title, then a pill or a quiet line. `big`: Header "Title
 * size=Big". The younger child's screens have the Sky (the sun or the moon) instead of the clock,
 * a Big title, and no pill. */
static header_t *ov_header_in(header_t *h, lv_obj_t *o, bool clock, const char *title, header_below_t below, pill_tone_t tone,
                              const char *icon, const char *text, bool big)
{
    header_create(o, h);
    /* the younger child's: no clock; a Big one has the Sky over it and no pill */
    if (ui_picture()) {
        if (big && clock) header_set_sky(h, ui_sky());
        if (big && below == HEADER_PILL) below = HEADER_NONE;
        clock = false;
    }
    header_set_big(h, big);
    header_set(h, clock ? ui_clock() : NULL, title, below, tone, icon, text);
    return h;
}

static header_t *ov_header(lv_obj_t *o, bool clock, const char *title, header_below_t below, pill_tone_t tone,
                           const char *icon, const char *text)
{
    static header_t scratch;
    return ov_header_in(&scratch, o, clock, title, below, tone, icon, text, false);
}

static header_t *ov_header_big(lv_obj_t *o, bool clock, const char *title, header_below_t below, pill_tone_t tone,
                               const char *icon, const char *text)
{
    static header_t scratch;
    return ov_header_in(&scratch, o, clock, title, below, tone, icon, text, true);
}

/* The room (Figma "Graphic"): Full fills the screen with the fade under the header; Faded (not
 * `full`) is the same room at 30% with the pet solid on it. */
static lv_obj_t *ov_graphic(lv_obj_t *o, bool full)
{
    lv_obj_t *pet = pet_create(o, SCREEN_W);
    lv_obj_set_pos(pet, 0, 0);
    if (!full) {
        pet_look_t look = pet_default_look(SCREEN_W);
        look.room_fade = 179;
        pet_set_look(pet, &look);
    }
    scrim_create(o);
    return pet;
}

/* The celebrations (a reward approved, stars, a streak): the pet alone on black, no room, so the
 * burst and the confetti stand out. */
static lv_obj_t *ov_party_graphic(lv_obj_t *o)
{
    lv_obj_set_style_bg_color(o, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(o, LV_OPA_COVER, 0);
    lv_obj_t *pet = pet_create(o, SCREEN_W);
    lv_obj_set_pos(pet, 0, 0);
    pet_look_t look = pet_default_look(SCREEN_W);
    look.room_off = true;
    look.bg = lv_color_hex(0x000000);
    /* no room to line up with: the window's room offset left him ~9 px left of centre when he
     * faces the child (celebrate), so stand him in the middle of the screen instead */
    look.dx = -1;
    pet_set_look(pet, &look);
    return pet;
}

/* A Note at y 322 (Figma "Note"); long words wrap and the note grows upwards. */
static void ov_note(lv_obj_t *o, const char *icon, const char *text, int32_t y)
{
    lime_card_t c;
    lime_card_create(o, &c, 0);
    lime_card_set(&c, icon, text, CARD_END_NONE);
    lv_obj_update_layout(c.root);
    if (lv_obj_get_width(c.root) > 340) { lime_card_wrap(&c, 280); lv_obj_update_layout(c.root); }
    int32_t h = lv_obj_get_height(c.root);
    if (y + h > 410) y = 410 - h;
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, y);
    fx_rise(c.root, 14, 220);
}

/* One lime outline button at the bottom, no curve (Figma Hill · Button). */
static void ov_hill_button(lv_obj_t *o, const char *icon, const char *label, hill_cb_t cb)
{
    hill_t hl;
    hill_create(o, &hl, cb);
    hill_set_button(&hl, icon, label);
}

static void ov_hill_empty(lv_obj_t *o)
{
    hill_t hl;
    hill_create(o, &hl, NULL);
    hill_set_empty(&hl);
}

/* A reward's icon in the middle (Figma Rewards · Choose and ask), `d` px. */
static lv_obj_t *ov_reward_art(lv_obj_t *o, const day_reward_t *r, int32_t d, int32_t y)
{
    /* the reward icons come at 100 and 120 too; anything else tops out at 48 and is scaled up */
    lv_obj_t *img = ui_icon(o, reward_icon(r->icon), d, C_TEXT);
    const lv_image_dsc_t *src = lv_image_get_src(img);
    int32_t w = src ? (int32_t)src->header.w : d;
    if (w != d) lv_image_set_scale(img, (uint32_t)(256 * d / w));
    lv_obj_set_size(img, w, w);
    lv_obj_set_pos(img, CENTER - w / 2, y + d / 2 - w / 2);
    return img;
}

static lv_obj_t *ov_line(lv_obj_t *o, const lv_font_t *f, uint32_t color, const char *text, int32_t y, int32_t w)
{
    lv_obj_t *l = ui_label(o, f, color, text);
    lv_obj_set_width(l, w);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(l, LV_ALIGN_TOP_MID, 0, y);
    return l;
}

/* ================================================================ Today's schedule */
/* Figma "My day · Today's schedule": the day as a wheel. The row now is on the focus line, full
 * size, with a lime outline; the one before sits above it and the next ones below, smaller and
 * fainter the further they are. It scrolls under the finger (with momentum, settling a row on the
 * line) and always opens on now. Chores come after the timed rows, by when they're due, then
 * anytime; tap a chore's ring to tick it (or untick it). A tap on Next or a flick up opens it; it slides back down
 * from its top edge (a drag down from the header, or a flick down that starts there). */
typedef enum { ROW_DONE, ROW_NOW, ROW_NEXT, ROW_FREE, ROW_CHORE, ROW_CHORE_DONE } row_state_t;
typedef struct { int task, chore; int16_t start, end; row_state_t state; } srow_t;

#define SCHED_TOP 92         /* the list starts under the header */
/* Figma "My day · Today's schedule" (1460:9008): the row now on the line at y 233..316 (Center, 83 with
 * its outline), the others Edge rows 12 apart (List rows, widgets.h). The younger child's (Picture
 * rows): the row now at 239..335. Black over the top down to y 103, clear by 169. */
#define SCHED_FOCUS 275
#define SCHED_PIC_FOCUS 287
#define SCHED_FADE_BLACK 103
#define SCHED_FADE_CLEAR 169

static struct {
    const day_plan_t *p;
    const logic_now_t *n;
    int now_min;
    bool picture;
    schedule_cb_t on_chore;
    srow_t rows[DAY_MAX_TASKS * 2 + DAY_MAX_CHORES];
    int nrows, focus;
    wheel_list_t wl;
    int32_t press_y;
    bool sheet_drag;
    int just;              /* the chore just ticked on this sheet (-1: none): its row ticks in front of the child */
} sc;

/* ---- the day under a sheet ---- */
/* While a sheet is up or on its way, the day under it (Home, set by the controller) sits back: it
 * drifts up a little, carrying on from the lean the finger gave it, and darkens under a scrim.
 * Translate and a plain box cost nothing extra (no layer), so this runs at full speed anywhere. */
#define BACKDROP_LIFT 16
#define BACKDROP_DIM 110
static lv_obj_t *backdrop, *scrim;
static int32_t backdrop_k = -1, backdrop_ty0;

void overlay_set_backdrop(lv_obj_t *under)
{
    backdrop = under;
    scrim = ui_box(lv_screen_active());
    lv_obj_set_size(scrim, SCREEN_W, SCREEN_H);
    ui_style_card(scrim, C_SCREEN, 0, 0, 0);
    lv_obj_set_style_bg_opa(scrim, LV_OPA_TRANSP, 0);
    lv_obj_add_flag(scrim, LV_OBJ_FLAG_HIDDEN);
}

/* The sheet starts to move: from wherever the lean left the day. */
static void backdrop_begin(void)
{
    if (!backdrop) return;
    lv_anim_delete(backdrop, NULL);   /* the lean springing back: the sheet takes it from here */
    backdrop_ty0 = lv_obj_get_style_translate_y(backdrop, 0);
    backdrop_k = -1;
    lv_obj_move_foreground(scrim);
}

static void backdrop_set(float k)
{
    if (!backdrop) return;
    if (k < 0) k = 0;
    if (k > 1) k = 1;
    int32_t kk = (int32_t)lroundf(k * 100);
    if (kk == backdrop_k) return;
    backdrop_k = kk;
    if (kk == 0) backdrop_ty0 = 0;
    int32_t ty = (int32_t)lroundf(backdrop_ty0 * (1.0f - k) - BACKDROP_LIFT * k);
    lv_obj_set_style_translate_y(backdrop, ty, 0);
    /* under a full sheet the scrim goes solid: LVGL starts drawing from it, so the day under it (the
     * room, the pet moving) isn't drawn again with every frame the sheet scrolls */
    bool covered = kk == 100, was = lv_obj_get_style_bg_opa(scrim, 0) == LV_OPA_COVER && !lv_obj_has_flag(scrim, LV_OBJ_FLAG_HIDDEN);
    ui_show(scrim, kk > 0);
    lv_obj_set_style_bg_opa(scrim, covered ? LV_OPA_COVER : (lv_opa_t)lroundf(BACKDROP_DIM * k), 0);
    if (covered != was) ui_render_now();   /* the pet rests under the sheet, and moves again as it lifts */
}

bool overlay_covering(void) { return backdrop && backdrop_k == 100; }

/* k from how far down the sheet's top edge is */
static void backdrop_follow(int32_t sheet_y) { backdrop_set(1.0f - (float)sheet_y / SCREEN_H); }

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
    sc.focus = focus_row >= 0 ? focus_row : 0;
}

/* A tap anywhere on a chore's row checks it or unchecks it; on the row now, does what the button
 * does at home (done, a step ticked, Start). Both run once the tap is over: the rows are rebuilt. */
static void chore_tapped(void *chore)
{
    if (!sched) return;
    sc.just = (int)(intptr_t)chore;
    if (sc.on_chore) sc.on_chore(sc.just);
}
static void on_row_chore(lv_event_t *e) { lv_async_call(chore_tapped, lv_event_get_user_data(e)); }

static schedule_now_cb_t on_now;
void schedule_set_on_now(schedule_now_cb_t cb) { on_now = cb; }
static void now_tapped(void *unused) { (void)unused; if (sched && on_now) on_now(); }
static void on_row_now(lv_event_t *e) { (void)e; lv_async_call(now_tapped, NULL); }

static void on_row_say(lv_event_t *e)
{
    const char *text = lv_event_get_user_data(e);
    if (text) hal_speak(text);
}

/* the whole row answers a tap: a chore, or the task now */
static void row_tappable(lv_obj_t *card, const srow_t *r)
{
    if (r->chore >= 0) {
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_row_chore, LV_EVENT_CLICKED, (void *)(intptr_t)r->chore);
    } else if (r->state == ROW_NOW) {
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_row_now, LV_EVENT_CLICKED, NULL);
    }
}

/* A row rebuilt as done right after its chore was ticked here: it starts as it was (lavender, an
 * empty ring) and turns done in front of the child. */
static void row_just_done(lv_obj_t *card, lv_obj_t *box)
{
    card_recolor(card, C_SYSTEM, C_RAISED, 360);
    if (box) checkbox_tick(box);
}

static void fmt_window(char *buf, size_t n, int from, int to)
{
    char a[12], b[12];
    if (from >= 0) fmt_hour(a, sizeof a, from);
    if (to >= 0) fmt_hour(b, sizeof b, to);
    if (from >= 0 && to >= 0) snprintf(buf, n, "%s to %s", a, b);
    else if (from >= 0) snprintf(buf, n, "From %s", a);
    else if (to >= 0) snprintf(buf, n, "By %s", b);
    else snprintf(buf, n, "Anytime");
}

/* A row of the day (List rows in widgets.h): a task with how long it is ("20 min"), free time with
 * how much is all yours, a chore with when; the younger child's rows have the name alone. A tap on a
 * chore's row ticks it (or unticks it); on the row now, it's the button at home. */
static void sched_row(lv_obj_t *slot, const srow_t *r)
{
    const day_plan_t *p = sc.p;
    const char *icon = "star-line";
    char task[48], detail[40];
    lrow_kind_t kind = LROW_NEXT;
    lrow_end_t end = LROW_END_NONE;
    switch (r->state) {
    case ROW_DONE: kind = LROW_DONE; end = sc.picture ? LROW_END_TICK : LROW_END_CHECK; break;
    case ROW_NOW: kind = LROW_NOW; end = LROW_END_NOW; break;
    case ROW_NEXT: kind = LROW_NEXT; break;
    case ROW_FREE: kind = LROW_FREE; break;
    case ROW_CHORE: kind = LROW_CHORE; end = LROW_END_CHECK; break;
    case ROW_CHORE_DONE: kind = LROW_CHORE_DONE; end = LROW_END_CHECK; break;
    }
    if (r->task >= 0) {
        const day_task_t *t = &p->tasks[r->task];
        icon = t->icon[0] ? t->icon : "star-line";
        snprintf(task, sizeof task, "%s", t->title);
        fmt_duration(detail, sizeof detail, r->end - r->start);   /* Figma: how long it is, no times */
    } else if (r->chore >= 0) {
        const day_chore_t *c = &p->chores[r->chore];
        icon = c->icon[0] ? c->icon : "sparkles";
        snprintf(task, sizeof task, "%s", c->title);
        if (r->state == ROW_CHORE_DONE) snprintf(detail, sizeof detail, "Done!");
        else fmt_window(detail, sizeof detail, c->from, c->to);
    } else {
        icon = "kite";
        snprintf(task, sizeof task, "Free Time");
        char dur[16];
        fmt_duration(dur, sizeof dur, r->end - r->start);
        snprintf(detail, sizeof detail, "%s all yours", dur);
    }
    if (sc.picture) icon = picture_icon(icon, task);
    bool just = r->state == ROW_CHORE_DONE && r->chore == sc.just;
    bool checked = (r->state == ROW_DONE || r->state == ROW_CHORE_DONE) && !just;
    lv_obj_t *card = list_row_create(slot, kind, sc.picture, icon, task, detail, end, checked);
    if (just) row_just_done(card, list_row_box(card));
    if (r->chore >= 0 || r->state == ROW_NOW || !sc.picture) { row_tappable(card, r); return; }
    /* the younger child's other rows: a tap reads the name out */
    static char said[DAY_MAX_TASKS * 2 + DAY_MAX_CHORES][48];
    int idx = (int)(r - sc.rows);
    snprintf(said[idx], sizeof said[idx], "%s", task);
    lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(card, on_row_say, LV_EVENT_CLICKED, said[idx]);
}

static void sched_fill(int focus)
{
    wheel_list_clear(&sc.wl);
    for (int i = 0; i < sc.nrows; i++) sched_row(wheel_list_add(&sc.wl), &sc.rows[i]);
    wheel_list_focus(&sc.wl, focus, false);
    sc.just = -1;
}

/* Let go of the sheet before it was pulled far enough: it springs back up. */
static void anim_y(void *obj, int32_t v) { lv_obj_set_y(obj, v); backdrop_follow(v); }
static void sched_gone(lv_anim_t *a) { lv_obj_delete(a->var); }
static void sched_deleted(lv_event_t *e) { (void)e; backdrop_set(0); }

static void sched_anim(lv_obj_t *o, int32_t v0, int32_t v1, uint32_t ms, lv_anim_path_cb_t path, lv_anim_completed_cb_t done)
{
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, o);
    lv_anim_set_exec_cb(&a, anim_y);
    lv_anim_set_values(&a, v0, v1);
    lv_anim_set_duration(&a, ms);
    lv_anim_set_path_cb(&a, path);
    if (done) lv_anim_set_completed_cb(&a, done);
    lv_anim_start(&a);
}

static void sheet_back(void)
{
    if (!sched || lv_anim_get(sched, anim_y)) return;
    sched_anim(sched, lv_obj_get_y(sched), 0, 300, ui_path_settle, NULL);
}

/* The sheet's top edge (the header): it follows the finger down and goes once pulled past 120 px. */
static void sched_touch(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_point_t pt;
    lv_indev_get_point(lv_indev_active(), &pt);
    /* the top edge itself pulls the controls down (swipe_set_pull); under it, the sheet */
    if (code == LV_EVENT_PRESSED) { sc.press_y = pt.y; sc.sheet_drag = pt.y < SCHED_TOP && pt.y > SWIPE_PULL_EDGE; return; }
    if (code == LV_EVENT_PRESSING) {
        if (sc.sheet_drag && sched) { int32_t dy = pt.y - sc.press_y; lv_obj_set_y(sched, dy > 0 ? dy : 0); backdrop_follow(dy > 0 ? dy : 0); }
        return;
    }
    if (code != LV_EVENT_RELEASED && code != LV_EVENT_PRESS_LOST) return;
    if (sc.sheet_drag) {
        sc.sheet_drag = false;
        if (sched && lv_obj_get_y(sched) > 120) schedule_close();
        else sheet_back();
    }
}

static bool sched_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)user;
    if (dir == SWIPE_UP) return false;
    /* down on the list scrolls it; only a flick that starts at the top edge puts the sheet away */
    if (dir == SWIPE_DOWN && start.y >= SCHED_TOP) return false;
    if (commit) {
        if (dir == SWIPE_DOWN) schedule_close();
        else overlay_slide_away(sched, dir);
    }
    return true;
}

void schedule_open(const day_plan_t *p, const logic_now_t *n, int now_min, bool picture, schedule_cb_t on_chore)
{
    lv_obj_t *o = open_overlay(&sched, false);
    swipe_add(o, sched_swipe, NULL);
    lv_obj_add_event_cb(o, sched_touch, LV_EVENT_ALL, NULL);
    lv_obj_add_event_cb(o, sched_deleted, LV_EVENT_DELETE, NULL);
    memset(&sc, 0, sizeof sc);
    sc.just = -1;
    sc.p = p; sc.n = n; sc.now_min = now_min; sc.picture = picture; sc.on_chore = on_chore;
    int32_t row = picture ? LROW_PIC_STEP : LROW_STEP, focus = picture ? SCHED_PIC_FOCUS : SCHED_FOCUS;
    wheel_list_create(o, &sc.wl, 0, SCHED_TOP, SCREEN_W, SCREEN_H - SCHED_TOP, focus - SCHED_TOP, row);
    sc.wl.style = list_row_style;
    sched_rows();
    sched_fill(sc.focus);
    /* black behind the title, then the header on top: rows that turn up under it slip out of sight */
    top_fade_create(o, SCHED_FADE_BLACK, SCHED_FADE_CLEAR);
    /* the younger child's is "My day", the title alone (Figma Younger · My day) */
    if (picture) ov_header(o, false, "My day", HEADER_NONE, PILL_CALM, NULL, NULL);
    else ov_header(o, true, "Today\xE2\x80\x99s Schedule", HEADER_NONE, PILL_CALM, NULL, NULL);
    /* a grab handle above the clock: the sheet can be pulled down */
    lv_obj_t *grip = ui_box(o);
    lv_obj_set_size(grip, 36, 4);
    lv_obj_set_pos(grip, CENTER - 18, 11);
    ui_style_card(grip, C_HILL_LINE, 2, 0, 0);
    /* the sheet slides up from the bottom and settles; the day sits back under it, and the rows
     * come up a beat behind the header (parallax) */
    backdrop_begin();
    lv_obj_set_y(o, SCREEN_H);
    sched_anim(o, SCREEN_H, 0, 380, ui_path_out, NULL);
    uint32_t rows = lv_obj_get_child_count(sc.wl.list), k = 0;
    for (uint32_t i = 0; i < rows && k < 5; i++) {
        lv_obj_t *slot = lv_obj_get_child(sc.wl.list, i);
        lv_area_t a;
        lv_obj_get_coords(slot, &a);
        if (a.y2 < SCHED_TOP || a.y1 > SCREEN_H) continue;   /* only the rows in view */
        fx_rise(slot, 26, 120 + 40 * k++);
    }
}

void schedule_refresh(const day_plan_t *p, const logic_now_t *n, int now_min)
{
    if (!sched) return;
    int keep = wheel_list_current(&sc.wl);
    sc.p = p; sc.n = n; sc.now_min = now_min;
    sched_rows();
    sched_fill(keep);
}

bool schedule_is_open(void) { return sched != NULL; }

void schedule_close(void)
{
    if (!sched) return;
    lv_obj_t *o = sched;
    sched = NULL;
    lv_anim_delete(o, anim_y);
    int32_t from = lv_obj_get_y(o);
    uint32_t ms = (uint32_t)(300 * (SCREEN_H - from) / SCREEN_H);
    sched_anim(o, from, SCREEN_H, ms < 140 ? 140 : ms, ui_path_out, sched_gone);
}

/* ================================================================ Other things to finish */
/* Figma "Task · Other things to finish": the title over two lines, "You can do it!", and the
 * checklist as a wheel of lavender rows, the first on the line; tap one when it's done. */
static struct {
    overlay_cb_t cb;
    wheel_list_t wl;
    int just;              /* the task just ticked here (-1: none) */
    lv_timer_t *hold;      /* its row turns done where it is, then the list closes up */
    bool flip;
    int32_t now_s;         /* the time the rows were built for ("Was due" once a time has gone) */
    char sig[DAY_MAX_TASKS * 4 + 4];
} ot;

/* every row on the line: no Edge rows here (Figma Task · Other things to finish) */
static void others_style(lv_obj_t *card, float d) { (void)d; list_row_style(card, 0); }

static void on_other(lv_event_t *e)
{
    int task = (int)(intptr_t)lv_event_get_user_data(e);
    ot.just = task;
    if (ot.cb) ot.cb(task);
}

static void others_hold_over(lv_timer_t *t)
{
    (void)t;
    ot.hold = NULL;
    ot.flip = true;
    ot.sig[0] = 0;
    ui_render_now();
}

static void others_hold(uint32_t ms)
{
    if (ot.hold) { lv_timer_set_period(ot.hold, ms); lv_timer_reset(ot.hold); return; }
    ot.hold = lv_timer_create(others_hold_over, ms, NULL);
    lv_timer_set_repeat_count(ot.hold, 1);
}

static void others_deleted(lv_event_t *e)
{
    if (lv_event_get_target(e) != others && others) return;   /* an older sheet fading out under a new one */
    if (ot.hold) { lv_timer_delete(ot.hold); ot.hold = NULL; }
}

static void slot_fade(void *obj, int32_t v) { lv_obj_set_style_opa(obj, (lv_opa_t)v, 0); }

/* The task just ticked turns done in its row (lavender to a night card, the box ticks), then the
 * row fades as the hold ends, and the rows under it close up. */
static bool other_tick_in_place(int task)
{
    uint32_t n = lv_obj_get_child_count(ot.wl.list);
    for (uint32_t i = 0; i < n; i++) {
        lv_obj_t *slot = lv_obj_get_child(ot.wl.list, i);
        if ((intptr_t)lv_obj_get_user_data(slot) != task + 1 || !lv_obj_get_child_count(slot)) continue;
        lv_obj_t *card = lv_obj_get_child(slot, 0);
        if (!card) return false;
        lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_remove_event_cb(card, on_other);
        list_row_mark_done(card);
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, slot);
        lv_anim_set_exec_cb(&a, slot_fade);
        lv_anim_set_values(&a, LV_OPA_COVER, LV_OPA_TRANSP);
        lv_anim_set_duration(&a, 200);
        lv_anim_set_delay(&a, 460);
        lv_anim_set_path_cb(&a, ui_path_out);
        lv_anim_start(&a);
        return true;
    }
    return false;
}

void others_refresh(const day_plan_t *p, const logic_now_t *n, int32_t now_s)
{
    if (!others) return;
    ot.now_s = now_s;
    char sig[sizeof ot.sig];
    int w = 0;
    for (int k = 0; k < n->nstill && w < (int)sizeof sig - 6; k++) w += snprintf(sig + w, sizeof sig - w, "%d,", n->still[k]);
    sig[w] = 0;
    if (!strcmp(sig, ot.sig)) return;
    strcpy(ot.sig, sig);
    if (ot.just >= 0 && other_tick_in_place(ot.just)) {
        ot.just = -1;
        others_hold(680);
        return;
    }
    ot.just = -1;
    if (ot.hold) return;   /* the list is laid out again when the hold is over */
    wheel_mark_t marks[DAY_MAX_TASKS];
    int nm = ot.flip ? wheel_list_mark(&ot.wl, marks, DAY_MAX_TASKS) : 0;
    int keep = ot.flip ? wheel_list_current(&ot.wl) : 0;
    ot.flip = false;
    wheel_list_clear(&ot.wl);
    bool pic = ui_picture();
    for (int k = 0; k < n->nstill; k++) {
        const day_task_t *t = &p->tasks[n->still[k]];
        lv_obj_t *slot = wheel_list_add(&ot.wl);
        lv_obj_set_user_data(slot, (void *)(intptr_t)(n->still[k] + 1));
        char from[24], when[16];
        if (t->bedtime_routine || t->system == SYS_BEDTIME) snprintf(from, sizeof from, "Before bedtime");
        else { fmt_hour(when, sizeof when, t->end); snprintf(from, sizeof from, "From %s", when); }   /* Figma: "From 3:30 pm", from when it was due */
        const char *icon = t->icon[0] ? t->icon : "clock";
        lv_obj_t *card = list_row_create(slot, LROW_CHORE, pic, pic ? picture_icon(icon, t->title) : icon, t->title, from, LROW_END_CHECK, false);
        lv_obj_set_style_bg_color(card, COL(C_TEXT), LV_STATE_PRESSED);
        lv_obj_add_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_add_event_cb(card, on_other, LV_EVENT_CLICKED, (void *)(intptr_t)n->still[k]);
    }
    wheel_list_focus(&ot.wl, keep, false);
    if (nm) wheel_list_flip(&ot.wl, marks, nm);
    if (!n->nstill) overlay_fade_away(others);
}

void others_open(const day_plan_t *p, const logic_now_t *n, int32_t now_s, overlay_cb_t on_done)
{
    lv_obj_t *o = open_overlay(&others, true);
    if (ot.hold) lv_timer_delete(ot.hold);
    memset(&ot, 0, sizeof ot);
    ot.cb = on_done;
    ot.just = -1;
    lv_obj_add_event_cb(o, others_deleted, LV_EVENT_DELETE, NULL);
    /* Figma: Center rows 12 apart, the first from y 178 (the younger child's from 182); more scroll
     * up under the header */
    bool pic = ui_picture();
    wheel_list_create(o, &ot.wl, 0, 110, SCREEN_W, SCREEN_H - 110, pic ? 120 : 108, pic ? 108 : 91);
    ot.wl.style = others_style;
    list_fade_create(o, 110);   /* clear by y 178, the first row's top */
    ov_header(o, !ui_picture(), "Other things to finish", HEADER_TEXT, PILL_CALM, NULL, "You can do it!");   /* a list: the younger child's has no Sky */
    others_refresh(p, n, now_s);
    overlay_enter_push(o);
}

bool others_is_open(void) { return others != NULL; }

/* ================================================================ get-ready reminder */
/* Figma "Free time · Dinner soon": the small room, the amber timer, "Dinner soon" with "Starts in
 * 5 min", "Get ready for dinner", and Dinner on the hill. */
static header_t rem_header, *rem_head;

void reminder_update(int32_t seconds_left)
{
    if (!reminder || !rem_head) return;
    char s[24];
    int mins = (seconds_left + 59) / 60;
    snprintf(s, sizeof s, "%d min", mins < 1 ? 1 : mins);
    if (!ui_picture()) pill_set(&rem_head->pill, PILL_HURRY, "timer", s);
}

static void on_rem_tap(lv_event_t *e) { (void)e; if (reminder) overlay_fade_away(reminder); }

void reminder_open(const char *next_icon, const char *next_title, const char *next_time, int32_t seconds_left, bool picture)
{
    lv_obj_t *o = open_overlay(&reminder, true);
    lv_obj_add_event_cb(o, on_rem_tap, LV_EVENT_CLICKED, NULL);
    lv_obj_t *pet = ov_graphic(o, false);
    if (picture) {   /* the younger child's: the room in its circle inside the ring (Graphic Inset) */
        pet_set_size(pet, 438);
        lv_obj_set_pos(pet, 14, 14);
        pet_look_t look = pet_default_look(438);
        pet_set_look(pet, &look);
    }
    pet_set_mood(pet, PET_MOOD_EXCITED);
    pet_force_clip(pet, PET_CLIP_WAVE);
    lv_obj_t *tm = timer_create(o);
    timer_set(tm, TIMER_HURRY, 1000, false);
    char title[56], ready[64], low[48];
    snprintf(title, sizeof title, "%s soon", next_title);
    size_t i = 0;
    for (; next_title[i] && i < sizeof low - 1; i++) low[i] = (char)((next_title[i] >= 'A' && next_title[i] <= 'Z') ? next_title[i] + 32 : next_title[i]);
    low[i] = 0;
    snprintf(ready, sizeof ready, "Get ready for %s", low);
    hill_t hl;
    hill_create(o, &hl, NULL);
    hill_set_next(&hl, next_icon, next_title, picture ? "" : next_time);
    hill_set_dots(&hl, 1);
    (void)ready;
    /* Figma keeps Home's side buttons; a tap on one (or anywhere) puts the reminder away */
    for (int i = 0; i < 2; i++) {
        lv_obj_t *b = side_button_create(o, i == 0, i == 0 ? "star-line" : "house");
        side_button_set_big(b, picture, i == 0 ? "star-line" : "house");
        lv_obj_add_flag(b, LV_OBJ_FLAG_EVENT_BUBBLE);
    }
    rem_head = ov_header_in(&rem_header, o, true, title, HEADER_PILL, PILL_HURRY, "timer", "5 min", picture);   /* the younger child's: Big, the Sky */
    if (picture) {   /* the Sky: what is coming (dinner's plate), amber like the timer */
        header_set_sky(rem_head, picture_icon(next_icon, next_title));
        header_set_sky_tone(rem_head, C_HURRY);
    }
    reminder_update(seconds_left);
    hal_play(HAL_SOUND_SOON);
    auto_close(&reminder, 15000);
    overlay_enter_rise(o);
}

bool reminder_is_open(void) { return reminder != NULL; }

/* ================================================================ reward approved */
/* Figma "Rewards · Approved!", kept light for the board: the child's pet irises on and springs out
 * cheering, the chime and one burst of confetti, the reward's icon flies up into the header, the
 * header comes in (the clock, "Ice Cream Trip!", "You earned it!"), then "Press to go on" with the
 * cue at the button, which puts it away (so does a swipe, or 20 s). */
#define AP_BURST 300
static struct { lv_obj_t *icon, *head, *note; } ap;

static void ap_go(lv_obj_t *o, void *u) { (void)o; pet_set_paused(u, false); }
static void ap_burst(lv_obj_t *o, void *u)
{
    (void)u;
    hal_play(HAL_SOUND_CHIME);
    fx_confetti(o, CENTER, CENTER, 40, FX_PARTY, 6, 240);
    fx_fly(ap.icon, CENTER, CENTER, CENTER, 70, 294, 0, 420, 0, true);   /* up into the header, then gone */
}
static void ap_title(lv_obj_t *o, void *u) { (void)o; (void)u; lv_obj_set_style_opa(ap.head, LV_OPA_COVER, 0); fx_rise(ap.head, 10, 0); }
static void ap_note(lv_obj_t *o, void *u) { (void)o; (void)u; lv_obj_set_style_opa(ap.note, LV_OPA_COVER, 0); fx_rise(ap.note, 14, 0); }

void approved_open(const day_reward_t *r, const char *child_name, const char *pet_name)
{
    (void)child_name; (void)pet_name;
    lv_obj_t *o = open_overlay(&approved, true);
    char title[56];
    snprintf(title, sizeof title, "%s!", r->title);
    lv_obj_t *pet = ov_party_graphic(o);   /* the child's own character */
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    pet_set_paused(pet, true);
    fx_iris(pet, 220, 0);
    ap.icon = ui_icon(o, r->icon[0] ? r->icon : "gift", 48, C_ACTION);
    lv_obj_add_flag(ap.icon, LV_OBJ_FLAG_IGNORE_LAYOUT);
    fx_fly(ap.icon, CENTER, CENTER, CENTER, CENTER, 60, 341, 260, 0, false);
    ov_hill_empty(o);
    header_t *h = ov_header(o, true, title, HEADER_TEXT, PILL_CALM, NULL, "You earned it!");
    ap.head = h->root;
    lv_obj_set_style_opa(ap.head, LV_OPA_TRANSP, 0);
    /* Figma Note · Button at y 340, and the button's cue */
    lime_card_t c;
    lime_card_create(o, &c, 0);
    lime_card_set(&c, "backpack", "Press to go on", CARD_END_BUTTON);
    lv_obj_update_layout(c.root);
    lv_obj_align(c.root, LV_ALIGN_TOP_MID, 0, 340);
    ap.note = c.root;
    lv_obj_set_style_opa(ap.note, LV_OPA_TRANSP, 0);
    lv_obj_t *cue = cue_create(o);
    cue_set(cue, 0, false);
    fx_at(o, 120, ap_go, pet);
    fx_at(o, AP_BURST, ap_burst, NULL);
    fx_at(o, AP_BURST + 320, ap_title, NULL);
    fx_at(o, AP_BURST + 900, ap_note, NULL);
    auto_close(&approved, 20000);   /* the button puts it away (as it does any overlay) */
}

/* ================================================================ reward screens */
/* Figma "Rewards · Not this time": no room, the faint circle with the reward's picture in it, its
 * name, a line, and the action on the hill. (Asking happens on the shop's shelves.) */
static overlay_cb_t circle_cb;
static lv_obj_t **circle_slot;

static void on_back_to_shop(hill_tap_t tap)
{
    (void)tap;
    if (circle_slot && *circle_slot) overlay_fade_away(*circle_slot);
    if (circle_cb) circle_cb(0);
}

/* the grown-up's words in quotes (Figma Rewards · Not this time), three lines at most above the
 * hill; with no words, that the stars came back */
static struct { char id[40]; int cost; lv_obj_t *root, *copy; } dx;
static void denied_copy(const char *note)
{
    char copy[160];
    bool words = note && *note;
    if (words) snprintf(copy, sizeof copy, "\xE2\x80\x9C%s\xE2\x80\x9D", note);
    else snprintf(copy, sizeof copy, "Your %d stars are back", dx.cost);
    lv_obj_set_width(dx.copy, words ? 300 : 220);
    lv_label_set_long_mode(dx.copy, LV_LABEL_LONG_DOT);
    lv_obj_set_height(dx.copy, LV_SIZE_CONTENT);
    lv_label_set_text(dx.copy, copy);
    lv_obj_update_layout(dx.copy);
    int32_t line = lv_font_get_line_height(F_BODY_P) + lv_obj_get_style_text_line_space(dx.copy, 0);
    if (lv_obj_get_height(dx.copy) > 3 * line) lv_obj_set_height(dx.copy, 3 * line);
}

bool denied_set_note(const char *reward_id, const char *note)
{
    if (!denied || denied != dx.root || !dx.copy || strcmp(dx.id, reward_id)) return false;
    denied_copy(note);
    fx_rise(dx.copy, 14, 220);
    return true;
}

/* (an older one fading out after a new one opened leaves the new one alone) */
static void denied_gone(lv_event_t *e) { if (lv_event_get_user_data(e) == dx.root) { dx.root = dx.copy = NULL; dx.id[0] = 0; } }

void denied_open(const day_reward_t *r, const char *note, overlay_cb_t on_shop)
{
    circle_slot = &denied;
    circle_cb = on_shop;
    lv_obj_t *o = open_overlay(&denied, true);
    lv_obj_add_event_cb(o, denied_gone, LV_EVENT_DELETE, o);
    dx.root = o;
    faint_circle_create(o);
    ov_reward_art(o, r, 72, 108);
    ov_line(o, &font_pop600_24, C_TEXT, r->title, 218, 320);
    snprintf(dx.id, sizeof dx.id, "%s", r->id);
    dx.cost = r->cost;
    dx.copy = ov_line(o, F_BODY_P, C_TEXT_MUTED, "", 252, 220);
    denied_copy(note);
    ov_hill_button(o, NULL, "Back to shop", on_back_to_shop);
    ov_header(o, true, "Not this time", HEADER_NONE, PILL_CALM, NULL, NULL);
    auto_close(&denied, 20000);
    overlay_enter_rise(o);
}

/* ================================================================ stars from a grown-up */
/* Figma "Rewards · You got a star!": the same choreography as the approved reward; the star flies
 * into the header's pill as the count ticks up; the grown-up's reason is a note. */
#define SX_BURST 700
static struct { char title[32], note[160]; lv_obj_t *icon, *pill, *pill_icon, *label, *pips; int from, to; bool note_due; } sx;

static void sx_go(lv_obj_t *o, void *u) { (void)o; pet_set_paused(u, false); }
static void sx_burst(lv_obj_t *o, void *u)
{
    (void)u;
    hal_play(HAL_SOUND_CHIME);
    fx_jolt(o, 6, 900, 0);
    fx_confetti(o, CENTER, CENTER, 100, FX_BRAND, 7, 300);
    lv_area_t a, oa;
    lv_obj_t *to = sx.pips ? lv_obj_get_child(sx.pips, LV_CLAMP(1, sx.to, 5) - 1) : sx.pill_icon;   /* the younger child's: into its pip */
    lv_obj_get_coords(to, &a);
    lv_obj_get_coords(o, &oa);
    int32_t ty = (a.y1 + a.y2) / 2 - oa.y1 - (sx.pips ? 0 : lv_obj_get_style_translate_y(sx.pill, 0));
    fx_fly(sx.icon, CENTER, CENTER, (a.x1 + a.x2) / 2 - oa.x1, ty, 294, sx.pips ? 192 : 107, 420, 0, true);
}
static void sx_land(lv_obj_t *o, void *u)
{
    (void)o; (void)u;
    if (sx.icon) { lv_obj_delete(sx.icon); sx.icon = NULL; }
    if (sx.pips) {   /* the new star lands in the counter */
        star_pips_set(sx.pips, 5, sx.to < 5 ? sx.to : 5);
        fx_pop(lv_obj_get_child(sx.pips, LV_CLAMP(1, sx.to, 5) - 1), 0);
        return;
    }
    lv_obj_set_style_opa(sx.pill_icon, LV_OPA_COVER, 0);
    fx_count(sx.label, sx.from, sx.to, "%d to spend", 900);
    fx_bounce(sx.pill, 10, 950);
}
static void sx_halo(lv_obj_t *o, void *u)
{
    (void)u;
    static const uint32_t C[3] = { C_STAR, C_STAR, C_STAR };
    static const lv_opa_t O[3] = { LV_OPA_COVER, 153, 89 };
    fx_halo(o, C, O, 0, 0);
}
static void sx_note(lv_obj_t *o, void *u) { (void)u; sx.note_due = true; if (sx.note[0]) ov_note(o, "star-line", sx.note, 348); }
static void sx_party(lv_obj_t *o, void *u) { (void)u; fx_drizzle(o, 0, FX_BRAND, 7); }

void stars_open(int delta, int total, const char *note)
{
    lv_obj_t *o = open_overlay(&stars, true);
    if (delta > 1) snprintf(sx.title, sizeof sx.title, "%d new stars!", delta);
    else snprintf(sx.title, sizeof sx.title, "You got a star!");
    snprintf(sx.note, sizeof sx.note, "%s", note ? note : "");
    sx.note_due = false;
    sx.from = total - delta;
    sx.to = total;
    lv_obj_t *pet = ov_party_graphic(o);
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    pet_set_paused(pet, true);
    fx_iris(pet, 160, SX_BURST);
    fx_burst_cfg_t cfg = { .charge = true, .burst_at = SX_BURST, .flash_r = 290, .waves = 3, .rays = true };
    fx_burst_create(o, CENTER, CENTER, &cfg);
    ov_hill_empty(o);
    char count[24];
    snprintf(count, sizeof count, "%d to spend", sx.from);
    header_t *h = ov_header(o, true, sx.title, ui_picture() ? HEADER_NONE : HEADER_PILL, PILL_STAR, "star-line", count);
    lv_obj_update_layout(h->root);
    sx.pill = h->pill.root;
    sx.pill_icon = h->pill.icon;
    sx.label = h->pill.text;
    sx.pips = NULL;
    if (ui_picture()) {   /* Figma Younger · You got a star!: the stars counted, five in a row at y 75 */
        sx.pips = star_pips_create(o, 36, 46);
        lv_obj_set_pos(sx.pips, CENTER - (4 * 46 + 36) / 2, 75);
        star_pips_set(sx.pips, 5, sx.from < 5 ? (sx.from < 0 ? 0 : sx.from) : 5);
        fx_rise(sx.pips, 10, 900);
    }
    lv_obj_set_style_opa(sx.pill_icon, LV_OPA_TRANSP, 0);
    fx_rise(h->root, 10, 900);
    sx.icon = ui_icon(o, "star-fill", 48, C_STAR);
    lv_obj_add_flag(sx.icon, LV_OBJ_FLAG_IGNORE_LAYOUT);
    fx_fly(sx.icon, CENTER, CENTER, CENTER, CENTER, 60, 341, 350, 30, false);
    fx_at(o, SX_BURST - 420, sx_go, pet);
    fx_at(o, SX_BURST, sx_burst, NULL);
    fx_at(o, SX_BURST + 160, sx_halo, NULL);
    fx_at(o, SX_BURST + 420, sx_land, NULL);
    fx_at(o, 1730, sx_note, NULL);
    fx_at(o, 2400, sx_party, NULL);
    auto_close(&stars, 30000);
}

bool stars_set_note(const char *note)
{
    if (!stars || sx.note[0] || !note || !*note) return false;
    snprintf(sx.note, sizeof sx.note, "%s", note);
    if (sx.note_due) ov_note(stars, "star-line", sx.note, 348);
    return true;
}

/* ================================================================ streak stars */
/* (No streaks on the child's screens since 2026-10-08; kept so an old plan still shows something.) */
static overlay_cb_t shop_cb;
static void on_shop_hill(hill_tap_t tap)
{
    (void)tap;
    if (streak) overlay_slide_away(streak, -1);
    if (shop_cb) shop_cb(0);
}

void streak_open(const day_streak_t *s, bool big, const char *shop_line, overlay_cb_t on_shop_cb, bool picture)
{
    shop_cb = on_shop_cb;
    lv_obj_t *o = open_overlay(&streak, true);
    lv_obj_t *pet = ov_party_graphic(o);
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    char t[48], sub[32];
    if (big) snprintf(t, sizeof t, picture ? "Yay!" : "%d nights in a row!", s->goal);
    else snprintf(t, sizeof t, picture ? "Yay!" : "Yay, another star!");
    snprintf(sub, sizeof sub, big ? "%d stars" : "%d of %d nights", big ? s->prize : s->count, s->goal);
    if (big && shop_line && shop_line[0]) ov_hill_button(o, "gift", shop_line, on_shop_hill);
    else ov_hill_empty(o);
    ov_header(o, true, t, HEADER_PILL, PILL_STAR, "star-fill", sub);
    auto_close(&streak, big ? 9000 : 6000);
    hal_play(HAL_SOUND_CHIME);
}

/* ================================================================ battery low */
/* Figma "Connection · Battery low": the coral "10% left" pill, sleepy Biscuit, "Put me on my dock". */
static header_t bat_header, *bat_head;

void battery_open(int percent)
{
    char left[16];
    snprintf(left, sizeof left, ui_picture() ? "Low" : "%d%% left", percent);   /* Figma: the younger child's coral pill says Low */
    if (battery && bat_head) { pill_set(&bat_head->pill, PILL_LATE, "battery", left); return; }
    lv_obj_t *o = open_overlay(&battery, true);
    lv_obj_t *pet = ov_graphic(o, true);
    pet_set_mood(pet, PET_MOOD_DROWSY);
    pet_wake_up(pet);   /* his bedroom (Figma Connection · Battery low) */
    hill_t hl;
    hill_create(o, &hl, NULL);
    hill_set_text(&hl, "Put me on my dock");
    bat_head = ov_header_in(&bat_header, o, !ui_picture(), "Battery low", HEADER_PILL, PILL_LATE, "battery", left, false);
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
static void on_retry_hill(hill_tap_t tap)
{
    (void)tap;
    if (retry_cb) retry_cb(0);
}

void system_show(sys_screen_t which, const char *detail, overlay_cb_t cb)
{
    retry_cb = cb;
    if (which == SYS_SCREEN_NONE) {
        lv_obj_t *o = sys;
        sys = NULL;
        sys_kind = SYS_SCREEN_NONE;
        if (o) overlay_fade_away(o);
        return;
    }
    if (sys && sys_kind == which) return;
    sys_kind = which;
    lv_obj_t *o = open_overlay(&sys, false);
    if (which == SYS_SCREEN_LOADING) {
        /* Figma "Connection · Loading": the room, a hello, "Just a moment…" */
        lv_obj_t *pet = ov_graphic(o, true);
        pet_set_mood(pet, PET_MOOD_IDLE);
        hill_t hl;
        hill_create(o, &hl, NULL);
        hill_set_text(&hl, "Just a moment\xE2\x80\xA6");
        ov_header_big(o, true, detail && *detail ? detail : "Hello!", HEADER_TEXT, PILL_CALM, NULL, "Getting your day ready");
    } else if (which == SYS_SCREEN_OFFLINE) {
        /* Figma "Connection · Can't reach the internet" */
        lv_obj_t *pet = ov_graphic(o, true);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        ov_hill_button(o, NULL, "Try again", on_retry_hill);
        ov_header_big(o, true, "No internet", HEADER_TEXT, PILL_CALM, NULL, "We can\xE2\x80\x99t connect right now");
    } else if (which == SYS_SCREEN_PAIRING) {
        /* Figma "First start · Pairing": no clock yet, the code in the faint circle */
        faint_circle_create(o);
        ov_line(o, F_DETAIL, C_TEXT_MUTED, "Code for the app", 194, 260);
        ov_line(o, F_CLOCK, C_TEXT, detail && *detail ? detail : "", 222, 260);
        ov_hill_empty(o);
        ov_header(o, false, "Hello!", HEADER_TEXT, PILL_CALM, NULL, "Ask a grown-up to open the app");
    } else {
        /* Figma "Connection · Something went wrong" */
        lv_obj_t *pet = ov_graphic(o, true);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        ov_hill_button(o, NULL, "Try again", on_retry_hill);
        ov_header_big(o, true, "Oops!", HEADER_TEXT, PILL_CALM, NULL, "Your day didn\xE2\x80\x99t load");
    }
    overlay_enter_rise(o);
}

sys_screen_t system_showing(void) { return sys ? sys_kind : SYS_SCREEN_NONE; }

void overlays_close_idle(void)
{
    if (sched) schedule_close();
    if (others) overlay_slide_away(others, -1);
}

bool overlays_any_open(void)
{
    return sched || others || reminder || approved || denied || stars || streak || battery;
}

void overlays_close_all(void)
{
    lv_obj_t **slots[] = { &sched, &others, &reminder, &approved, &denied, &stars, &streak, &battery };
    for (unsigned i = 0; i < sizeof slots / sizeof slots[0]; i++)
        if (*slots[i]) { lv_obj_delete(*slots[i]); *slots[i] = NULL; }
}
