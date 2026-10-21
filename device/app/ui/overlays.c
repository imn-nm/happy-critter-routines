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
/* The Header: the clock (when `clock`), the title, then a pill or a quiet line. */
static header_t *ov_header_in(header_t *h, lv_obj_t *o, bool clock, const char *title, header_below_t below, pill_tone_t tone,
                              const char *icon, const char *text)
{
    header_create(o, h);
    header_set(h, clock ? ui_clock() : NULL, title, below, tone, icon, text);
    return h;
}

static header_t *ov_header(lv_obj_t *o, bool clock, const char *title, header_below_t below, pill_tone_t tone,
                           const char *icon, const char *text)
{
    static header_t scratch;
    return ov_header_in(&scratch, o, clock, title, below, tone, icon, text);
}

/* The room (Figma "Graphic"): Full fills the screen with the fade under the header; Small is the
 * 298 circle; the faint circle stands in when there is no room. */
static lv_obj_t *ov_graphic(lv_obj_t *o, bool full)
{
    lv_obj_t *pet = pet_create(o, full ? SCREEN_W : 298);
    lv_obj_set_pos(pet, full ? 0 : 84, full ? 0 : 84);
    if (full) scrim_create(o);
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
 * anytime; tap a chore's ring to tick it. A tap on Next or a flick up opens it; it slides back down
 * from its top edge (a drag down from the header, or a flick down that starts there). */
typedef enum { ROW_DONE, ROW_NOW, ROW_NEXT, ROW_FREE, ROW_CHORE, ROW_CHORE_DONE } row_state_t;
typedef struct { int task, chore; int16_t start, end; row_state_t state; } srow_t;

#define SCHED_TOP 92         /* the list starts under the header */
#define SCHED_ROW 87         /* a row's slot (Figma) */
#define SCHED_PIC_ROW 109    /* picture view (Figma 1078:5037) */
/* The row now (the focus line) sits in the middle of the room under the title, wherever the title
 * ends (it wraps to two lines), with one row showing above it and one below: about y 250, 276 in
 * picture view (schedule_open). */
#define SCHED_FADE_Y 89      /* the Fade behind the title, over the top of the list */

/* Figma "MyToki 2 / Schedule row" (1073:4620): Center is 400 x 84, fully round, 16 px in, gap 14: the
 * icon (36), the name and the detail line, then the Checkbox (48) or "Now". Edge (one row away) is
 * 360 x 66 at 70% with a 26 px icon: Done, Now and Next keep both lines, Free time and Chore show the
 * name alone. A row's parts remember where they sit on the Center card (packed in their user data)
 * and move as it turns; the words lose the 40 px the card does. */
enum { PART_PLAIN, PART_TITLE, PART_DETAIL, PART_TEXT, PART_ICON };
#define SROW_TEXT_W 256      /* 400 - 16 - 36 - 14 - 14 - 48 - 16 */
#define PART(kind, x, y) ((void *)(intptr_t)(((kind) << 20) | ((x) << 10) | (y)))

static void sched_style(lv_obj_t *card, float d)
{
    /* Two rows away (the fourth row, low on the round screen) is an Edge row at 94 % and 55 %, so its
     * corners clear the rim; past that it fades out. */
    float ad = fabsf(d), k = fminf(ad, 1.0f), k2 = fminf(fmaxf(0.0f, ad - 1.0f), 1.0f), far = fmaxf(0.0f, ad - 2.0f);
    ui_row_scale(card, (int32_t)lroundf(256 - 14 * k2), true);
    int32_t w = (int32_t)lroundf(400 - 40 * k), h = (int32_t)lroundf(84 - 18 * k);
    if (lv_obj_get_width(card) != w || lv_obj_get_height(card) != h) {
        lv_obj_set_size(card, w, h);
        int32_t dy = (int32_t)lroundf(9 * k), dx = (int32_t)lroundf(40 * k);
        uint32_t n = lv_obj_get_child_count(card);
        for (uint32_t i = 0; i < n; i++) {
            lv_obj_t *c = lv_obj_get_child(card, i);
            if (lv_obj_has_flag(c, LV_OBJ_FLAG_USER_1)) { lv_obj_set_size(c, w, h); continue; }   /* the dashed outline */
            intptr_t u = (intptr_t)lv_obj_get_user_data(c);
            int kind = (int)(u >> 20), x = (int)((u >> 10) & 0x3FF), y = (int)(u & 0x3FF);
            if (kind == PART_TITLE || kind == PART_TEXT || kind == PART_DETAIL) lv_obj_set_width(c, SROW_TEXT_W - dx);
            if (kind == PART_TITLE) { lv_obj_set_pos(c, x, y + (int32_t)lroundf(3 * k)); continue; }   /* 16 -> 19: the middle of an Edge row */
            lv_obj_set_pos(c, x > 300 ? x - dx : x, y - dy);
            if (kind == PART_DETAIL) lv_obj_set_style_opa(c, (lv_opa_t)(255 * (1.0f - k)), 0);
            if (kind == PART_ICON) lv_image_set_scale(c, (uint32_t)lroundf(256 * (36 - 10 * k) / 36));   /* 36 -> 26 */
            /* Now: the detail is lime on the line, cream once it moves off */
            if (lv_obj_has_flag(c, LV_OBJ_FLAG_USER_3)) lv_obj_set_style_text_color(c, COL(k > 0.5f ? C_TEXT : C_ACTION), 0);
        }
    }
    ui_row_fade(card, (lv_opa_t)(255 * (1.0f - 0.3f * k - 0.15f * k2) * fmaxf(0.0f, 1.0f - far / 0.6f)));   /* the row fades as one, like Figma */
}

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

static void on_row_chore(lv_event_t *e)
{
    int chore = (int)(intptr_t)lv_event_get_user_data(e);
    sc.just = chore;
    if (sc.on_chore) sc.on_chore(chore);
}

/* A row rebuilt as done right after its chore was ticked here: it starts as it was (lavender, an
 * empty ring) and turns done in front of the child. */
static void row_just_done(lv_obj_t *card, lv_obj_t *box)
{
    card_recolor(card, C_SYSTEM, C_RAISED, 360);
    checkbox_tick(box);
}

/* Figma "Schedule row" (Center): the icon (36), the name (Item 22) and the detail (Detail 20) from
 * x 66, then the Checkbox (48) or "Now". Done: a cream icon, muted words, ticked. Now: a lime outline,
 * the detail in lime, "Now". Next: the detail muted, nothing at the end. Free time: a mint dashed
 * outline, mint icon and words, an empty ring. Chores: lavender with navy words; tap the ring. */
static void sched_row(lv_obj_t *slot, const srow_t *r)
{
    const day_plan_t *p = sc.p;
    lv_obj_t *card = ui_box(slot);
    lv_obj_set_size(card, 400, 84);
    lv_obj_center(card);
    const char *icon = "star-line";
    char task[48], detail[40], a[12], b[12];
    uint32_t fg = C_TEXT, sub = C_TEXT_MUTED, icf = C_TEXT;
    switch (r->state) {
    case ROW_DONE: ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, 0, 0); fg = sub = C_TEXT_MUTED; break;
    case ROW_NOW: ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, C_ACTION, LV_OPA_COVER); lv_obj_set_style_border_width(card, 2, 0); sub = C_ACTION; break;
    case ROW_NEXT: ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, 0, 0); break;
    case ROW_FREE: {
        ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, 0, 0);
        lv_obj_t *o = dotted_outline_create(card, C_DONE, 999);
        lv_obj_set_size(o, 400, 84);
        lv_obj_add_flag(o, LV_OBJ_FLAG_USER_1);   /* its user data is its own: marked by the flag */
        fg = sub = icf = C_DONE;
        break;
    }
    case ROW_CHORE: ui_style_card(card, C_SYSTEM, LV_RADIUS_CIRCLE, 0, 0); fg = sub = icf = C_ON_COLOR; break;
    case ROW_CHORE_DONE: ui_style_card(card, C_RAISED, LV_RADIUS_CIRCLE, 0, 0); fg = sub = C_TEXT_MUTED; break;
    }
    if (r->task >= 0) {
        const day_task_t *t = &p->tasks[r->task];
        icon = t->icon[0] ? t->icon : "star-line";
        snprintf(task, sizeof task, "%s", t->title);
        char e[8], dur[16];
        ui_fmt_time(e, sizeof e, r->end);
        fmt_duration(dur, sizeof dur, r->end - r->start);
        snprintf(detail, sizeof detail, "Until %s \xC2\xB7 %s", e, dur);
    } else if (r->chore >= 0) {
        const day_chore_t *c = &p->chores[r->chore];
        icon = c->icon[0] ? c->icon : "sparkles";
        snprintf(task, sizeof task, "%s", c->title);
        if (r->state == ROW_CHORE_DONE) snprintf(detail, sizeof detail, "Done!");
        else if (c->from >= 0 && c->to >= 0) { fmt_hour(a, sizeof a, c->from); fmt_hour(b, sizeof b, c->to); snprintf(detail, sizeof detail, "Between %s and %s", a, b); }
        else if (c->to >= 0) { fmt_hour(b, sizeof b, c->to); snprintf(detail, sizeof detail, "By %s", b); }
        else if (c->from >= 0) { fmt_hour(a, sizeof a, c->from); snprintf(detail, sizeof detail, "From %s", a); }
        else snprintf(detail, sizeof detail, "Anytime");
    } else {
        icon = "kite";
        snprintf(task, sizeof task, "Free time");
        char dur[16];
        fmt_duration(dur, sizeof dur, r->end - r->start);
        snprintf(detail, sizeof detail, "%s all yours", dur);
    }
    lv_obj_t *ic = ui_icon(card, icon, 36, icf);
    lv_obj_set_size(ic, 36, 36);
    lv_image_set_inner_align(ic, LV_IMAGE_ALIGN_CENTER);
    lv_image_set_pivot(ic, 18, 18);
    lv_obj_set_pos(ic, 16, 24);
    lv_obj_set_user_data(ic, PART(PART_ICON, 16, 24));
    bool one_line = r->state == ROW_FREE || r->state == ROW_CHORE || r->state == ROW_CHORE_DONE;   /* on the Edge */
    lv_obj_t *tt = ui_label(card, F_ITEM, fg, task);
    lv_label_set_long_mode(tt, LV_LABEL_LONG_DOT);
    lv_obj_set_size(tt, SROW_TEXT_W, lv_font_get_line_height(F_ITEM));
    lv_obj_set_pos(tt, 66, 16);
    lv_obj_set_user_data(tt, one_line ? PART(PART_TITLE, 66, 16) : PART(PART_TEXT, 66, 16));
    lv_obj_t *dt = ui_label(card, F_DETAIL, sub, detail);
    lv_label_set_long_mode(dt, LV_LABEL_LONG_DOT);
    lv_obj_set_size(dt, SROW_TEXT_W, lv_font_get_line_height(F_DETAIL));
    lv_obj_set_pos(dt, 66, 44);
    lv_obj_set_user_data(dt, one_line ? PART(PART_DETAIL, 66, 44) : PART(PART_TEXT, 66, 44));
    if (r->state == ROW_NOW) lv_obj_add_flag(dt, LV_OBJ_FLAG_USER_3);
    if (r->state == ROW_NOW) {
        lv_obj_t *now = ui_label(card, F_LABEL, C_ACTION, "Now");
        lv_obj_set_pos(now, 337, 28);
        lv_obj_set_user_data(now, PART(PART_PLAIN, 337, 28));
    } else if (r->state != ROW_NEXT) {   /* Figma: Next ends with nothing */
        bool just = r->state == ROW_CHORE_DONE && r->chore == sc.just;
        lv_obj_t *box = checkbox_create(card, 48, !just && (r->state == ROW_DONE || r->state == ROW_CHORE_DONE));
        lv_obj_set_pos(box, 336, 18);
        lv_obj_set_user_data(box, PART(PART_PLAIN, 336, 18));
        if (just) row_just_done(card, box);
        if (r->state == ROW_CHORE) {
            lv_obj_add_flag(box, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_set_ext_click_area(box, 10);
            lv_obj_add_event_cb(box, on_row_chore, LV_EVENT_CLICKED, (void *)(intptr_t)r->chore);
        }
    }
}

/* Figma "Picture card" (Today's schedule · Younger): fully round, hugging its words. On the line:
 * 110 high, 24 px in, gap 16, a 56 icon; one row away: 80 high, 18 px in, gap 12, a 40 icon. The
 * words stay 22 / 20. Now has a 3 px lime outline, done ones show at 60%; further rows fade out. */
static void sched_tile_style(lv_obj_t *card, float d)
{
    float ad = fabsf(d), k = fminf(ad, 1.0f), far = fmaxf(0.0f, ad - 1.0f);
    int32_t h = (int32_t)lroundf(110 - 30 * k);
    if (lv_obj_get_height(card) != h) {
        lv_obj_set_height(card, h);
        lv_obj_set_style_pad_hor(card, (int32_t)lroundf(24 - 6 * k), 0);
        lv_obj_set_style_pad_column(card, (int32_t)lroundf(16 - 4 * k), 0);
        lv_obj_t *ic = lv_obj_get_child(card, 0);
        int32_t sz = (int32_t)lroundf(56 - 16 * k);
        lv_obj_set_size(ic, sz, sz);
        lv_image_set_scale(ic, (uint32_t)(256 * sz / 48));
    }
    float base = lv_obj_has_flag(card, LV_OBJ_FLAG_USER_2) ? 0.6f : 1.0f;   /* done: faded */
    ui_row_fade(card, (lv_opa_t)(255 * base * fmaxf(0.0f, 1.0f - far / 0.6f)));   /* the row fades as one, like Figma */
}

static void on_tile_say(lv_event_t *e)
{
    const char *text = lv_event_get_user_data(e);
    if (text) hal_speak(text);
}

/* Picture view: the icon, the first word of the name and the time ("3:40–4:00" for now), and the
 * Checkbox, ticked once done. Tap one to hear it. */
static void sched_tile(lv_obj_t *slot, const srow_t *r, int idx)
{
    const day_plan_t *p = sc.p;
    const char *icon = r->task >= 0 ? p->tasks[r->task].icon : r->chore >= 0 ? p->chores[r->chore].icon : "kite";
    char name[48], t[24];
    if (r->task >= 0) { char w[24]; snprintf(w, sizeof w, "%s", p->tasks[r->task].title); char *sp = strchr(w, ' '); if (sp) *sp = 0; snprintf(name, sizeof name, "%s", w); }
    else if (r->chore >= 0) snprintf(name, sizeof name, "%s", p->chores[r->chore].title);
    else snprintf(name, sizeof name, "Free time");
    if (r->start >= 0) ui_fmt_time(t, sizeof t, r->start); else snprintf(t, sizeof t, "Any time");
    bool now = r->state == ROW_NOW, done = r->state == ROW_DONE || r->state == ROW_CHORE_DONE;
    if (now && r->end > r->start) { char e[8]; ui_fmt_time(e, sizeof e, r->end); snprintf(t + strlen(t), sizeof t - strlen(t), "\xE2\x80\x93%s", e); }
    lv_obj_t *tile = ui_row(slot, 16);
    lv_obj_set_height(tile, 110);
    lv_obj_center(tile);
    ui_style_card(tile, C_RAISED, LV_RADIUS_CIRCLE, C_ACTION, now ? LV_OPA_COVER : 0);
    lv_obj_set_style_pad_hor(tile, 24, 0);
    if (now) lv_obj_set_style_border_width(tile, 3, 0);
    if (done) lv_obj_add_flag(tile, LV_OBJ_FLAG_USER_2);
    uint32_t fg = done ? C_TEXT_MUTED : C_TEXT;
    lv_obj_t *ic = ui_icon(tile, icon && *icon ? icon : "star-line", 48, fg);
    lv_image_set_inner_align(ic, LV_IMAGE_ALIGN_CENTER);
    lv_obj_t *body = ui_box(tile);
    lv_obj_set_size(body, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(body, LV_FLEX_FLOW_COLUMN);
    lv_obj_t *nm = ui_label(body, F_ITEM, fg, name);
    lv_label_set_long_mode(nm, LV_LABEL_LONG_DOT);
    lv_obj_set_style_max_width(nm, 160, 0);
    ui_label(body, F_DETAIL, now ? C_ACTION : C_TEXT_MUTED, t);
    bool just = r->state == ROW_CHORE_DONE && r->chore == sc.just;
    lv_obj_t *box = checkbox_create(tile, 48, done && !just);
    if (just) row_just_done(tile, box);
    static char said[DAY_MAX_TASKS * 2 + DAY_MAX_CHORES][64];
    snprintf(said[idx], sizeof said[idx], "%s at %s", name, t);
    lv_obj_add_flag(tile, LV_OBJ_FLAG_CLICKABLE | LV_OBJ_FLAG_EVENT_BUBBLE);
    lv_obj_add_event_cb(tile, on_tile_say, LV_EVENT_CLICKED, said[idx]);
}

static void sched_fill(int focus)
{
    wheel_list_clear(&sc.wl);
    for (int i = 0; i < sc.nrows; i++) {
        lv_obj_t *slot = wheel_list_add(&sc.wl);
        if (sc.picture) sched_tile(slot, &sc.rows[i], i);
        else sched_row(slot, &sc.rows[i]);
    }
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
    if (code == LV_EVENT_PRESSED) { sc.press_y = pt.y; sc.sheet_drag = pt.y < SCHED_TOP; return; }
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
    int32_t row = picture ? SCHED_PIC_ROW : SCHED_ROW;
    wheel_list_create(o, &sc.wl, 0, SCHED_TOP, SCREEN_W, SCREEN_H - SCHED_TOP, (SCREEN_H - SCHED_TOP) / 2, row);
    sc.wl.style = picture ? sched_tile_style : sched_style;
    sched_rows();
    sched_fill(sc.focus);
    /* Figma Younger: two path dots between the cards */
    lv_obj_t *dots[2] = { NULL, NULL };
    if (picture)
        for (int i = 0; i < 2; i++) {
            dots[i] = ui_box(o);
            lv_obj_set_size(dots[i], 6, 6);
            ui_style_card(dots[i], C_CHIP, LV_RADIUS_CIRCLE, 0, 0);
        }
    /* black behind the title, then the header on top: rows that turn up under it slip out of sight */
    list_fade_create(o, SCHED_FADE_Y);
    header_t *hd = ov_header(o, true, "Today\xE2\x80\x99s Schedule", HEADER_NONE, PILL_CALM, NULL, NULL);
    /* between the title's bottom and the lowest point where a row one away still fits inside the
     * round screen (360 wide; a picture card about 240), so the rows above and below show alike */
    lv_obj_update_layout(hd->root);
    int32_t top = lv_obj_get_y(hd->root) + lv_obj_get_height(hd->root), half = picture ? 120 : 180;
    int32_t bottom = CENTER + (int32_t)sqrtf((float)(CENTER * CENTER - half * half));
    int32_t focus = (top + bottom) / 2;
    wheel_list_set_focus(&sc.wl, focus - SCHED_TOP);
    for (int i = 0; i < 2; i++)
        if (dots[i]) lv_obj_set_pos(dots[i], CENTER - 3, focus + (i ? 59 : -65));   /* in the gaps either side of the card now */
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
        uint32_t m = lv_obj_get_child_count(card);
        if (m < 3) return false;
        lv_obj_remove_flag(card, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_remove_event_cb(card, on_other);
        card_recolor(card, C_SYSTEM, C_RAISED, 360);
        ui_set_color(lv_obj_get_child(card, 0), C_TEXT);
        lv_obj_t *col = lv_obj_get_child(card, 1);
        for (uint32_t j = 0; j < lv_obj_get_child_count(col); j++) ui_set_color(lv_obj_get_child(col, j), C_TEXT_MUTED);
        checkbox_tick(lv_obj_get_child(card, (int32_t)m - 1));
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
    for (int k = 0; k < n->nstill; k++) {
        const day_task_t *t = &p->tasks[n->still[k]];
        lv_obj_t *slot = wheel_list_add(&ot.wl);
        lv_obj_set_user_data(slot, (void *)(intptr_t)(n->still[k] + 1));
        lv_obj_t *card = ui_row(slot, 14);
        lv_obj_set_size(card, 360, 72);
        lv_obj_center(card);
        ui_style_card(card, C_SYSTEM, LV_RADIUS_CIRCLE, 0, 0);   /* Figma "Chore row": fully round */
        lv_obj_set_style_pad_hor(card, 16, 0);
        lv_obj_set_style_bg_color(card, COL(C_TEXT), LV_STATE_PRESSED);
        ui_icon(card, t->icon[0] ? t->icon : "clock", 24, C_ON_COLOR);
        lv_obj_t *col = ui_box(card);
        lv_obj_set_size(col, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
        lv_obj_set_flex_flow(col, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_grow(col, 1);
        lv_obj_t *name = ui_label(col, F_ITEM, C_ON_COLOR, t->title);
        lv_label_set_long_mode(name, LV_LABEL_LONG_DOT);
        lv_obj_set_size(name, 250, lv_font_get_line_height(F_ITEM));
        char by[24], when[16];
        if (t->bedtime_routine || t->system == SYS_BEDTIME) snprintf(by, sizeof by, "Before bedtime");
        else {   /* "Before 3:30 pm" while there is time; "Was due 3:30 pm" once it has gone */
            fmt_hour(when, sizeof when, t->end);
            snprintf(by, sizeof by, "%s %s", t->end * 60 <= ot.now_s ? "Was due" : "Before", when);
        }
        ui_label(col, F_DETAIL, C_ON_COLOR, by);
        checkbox_create(card, 48, false);
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
    /* Figma: two equal rows, centres at 213 and 298; more scroll up under the header */
    wheel_list_create(o, &ot.wl, 0, 110, SCREEN_W, SCREEN_H - 110, 104, 84);
    ot.wl.shrink = ot.wl.fade = 0;
    list_fade_create(o, 110);   /* clear by y 178, the first row's top */
    ov_header(o, true, "Other things to finish", HEADER_TEXT, PILL_CALM, NULL, "You can do it!");
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
    snprintf(s, sizeof s, "Starts in %d min", mins < 1 ? 1 : mins);
    pill_set(&rem_head->pill, PILL_HURRY, "timer", s);
}

static void on_rem_tap(lv_event_t *e) { (void)e; if (reminder) overlay_fade_away(reminder); }

void reminder_open(const char *next_icon, const char *next_title, const char *next_time, int32_t seconds_left, bool picture)
{
    lv_obj_t *o = open_overlay(&reminder, true);
    lv_obj_add_event_cb(o, on_rem_tap, LV_EVENT_CLICKED, NULL);
    lv_obj_t *pet = ov_graphic(o, false);
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
    hill_set_next(&hl, next_icon, next_title, next_time);
    hill_set_dots(&hl, 1);
    (void)ready;
    /* Figma keeps Home's side buttons; a tap on one (or anywhere) puts the reminder away */
    for (int i = 0; i < 2; i++) lv_obj_add_flag(side_button_create(o, i == 0, i == 0 ? "star-line" : "list"), LV_OBJ_FLAG_EVENT_BUBBLE);
    rem_head = ov_header_in(&rem_header, o, true, picture ? "" : title, HEADER_PILL, PILL_HURRY, "timer", "Starts in 5 min");
    reminder_update(seconds_left);
    hal_play(HAL_SOUND_SOON);
    auto_close(&reminder, 15000);
    overlay_enter_rise(o);
}

bool reminder_is_open(void) { return reminder != NULL; }

/* ================================================================ reward approved */
/* Figma "Rewards · Approved!": the burst (charge, flash, confetti, the chime), the room irises on
 * and Biscuit springs out, the reward's icon flies up to the header, the halo rings, the title's
 * words pop, his bubble, then a little party until the child swipes. */
#define AP_BURST 700
static struct { char title[56]; lv_obj_t *icon, *overline; bubble_t bubble; } ap;

static void ap_tick(lv_obj_t *o, void *u) { (void)o; (void)u; hal_play(HAL_SOUND_TICK); }
static void ap_go(lv_obj_t *o, void *u) { (void)o; pet_set_paused(u, false); }
static void ap_burst(lv_obj_t *o, void *u)
{
    (void)u;
    hal_play(HAL_SOUND_CHIME);
    fx_jolt(o, 6, 900, 0);
    fx_confetti(o, CENTER, CENTER, 110, FX_PARTY, 6, 300);
    fx_fly(ap.icon, CENTER, CENTER, CENTER, 34, 294, 0, 420, 0, true);   /* up into the header, then gone */
    fx_rise(ap.overline, 8, 300);
}
static void ap_halo(lv_obj_t *o, void *u)
{
    (void)u;
    static const uint32_t C[3] = { C_PINK, C_CARROT, C_SYSTEM };
    static const lv_opa_t O[3] = { LV_OPA_COVER, LV_OPA_COVER, LV_OPA_COVER };
    fx_halo(o, C, O, 0, 0);
}
static void ap_title(lv_obj_t *o, void *u) { (void)u; fx_words(o, ap.title, F_TITLE, C_TEXT, 50, 0, 60); }
static void ap_bubble(lv_obj_t *o, void *u)
{
    (void)u;
    bubble_create(o, &ap.bubble);
    bubble_say_pet(&ap.bubble, "Hooray! Have the best time!", 128, SCREEN_H);
    fx_rise(ap.bubble.root, 12, 0);
    fx_rise(ap.bubble.tail, 12, 0);
}
static void ap_party(lv_obj_t *o, void *u) { (void)u; fx_drizzle(o, 0, FX_PARTY, 6); }

void approved_open(const day_reward_t *r, const char *child_name, const char *pet_name)
{
    (void)child_name; (void)pet_name;
    lv_obj_t *o = open_overlay(&approved, true);
    snprintf(ap.title, sizeof ap.title, "%s!", r->title);
    lv_obj_t *pet = ov_party_graphic(o);
    pet_force_clip(pet, PET_CLIP_CELEBRATE);
    pet_set_paused(pet, true);
    fx_iris(pet, 160, AP_BURST);
    fx_burst_cfg_t cfg = { .charge = true, .burst_at = AP_BURST, .flash_r = 290, .waves = 3, .rays = true };
    fx_burst_create(o, CENTER, CENTER, &cfg);
    ap.overline = ui_label(o, F_CLOCK_LINE, C_TEXT, "You earned it!");
    lv_obj_align(ap.overline, LV_ALIGN_TOP_MID, 0, 18);
    lv_obj_set_style_opa(ap.overline, LV_OPA_TRANSP, 0);
    ap.icon = ui_icon(o, r->icon[0] ? r->icon : "gift", 48, C_ACTION);
    lv_obj_add_flag(ap.icon, LV_OBJ_FLAG_IGNORE_LAYOUT);
    fx_fly(ap.icon, CENTER, CENTER, CENTER, CENTER, 60, 341, 350, 30, false);
    ov_hill_empty(o);
    for (uint32_t k = 0; k < 5; k++) fx_at(o, 120 + k * 100, ap_tick, NULL);
    fx_at(o, AP_BURST - 420, ap_go, pet);
    fx_at(o, AP_BURST, ap_burst, NULL);
    fx_at(o, AP_BURST + 160, ap_halo, NULL);
    fx_at(o, 1150, ap_title, NULL);
    fx_at(o, 1950, ap_bubble, NULL);
    fx_at(o, 2400, ap_party, NULL);
    auto_close(&approved, 120000);
}

/* ================================================================ reward screens */
/* Figma "Rewards · Choose and ask", "Waiting" and "Not this time": no room, the faint circle with
 * the reward's picture in it, its name, a line, and the action on the hill. */
static overlay_cb_t circle_cb;
static lv_obj_t **circle_slot;

static void on_back_to_shop(hill_tap_t tap)
{
    (void)tap;
    if (circle_slot && *circle_slot) {
        if (circle_slot == &asked) overlay_slide_away(*circle_slot, 1);
        else overlay_fade_away(*circle_slot);
    }
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
    ov_reward_art(o, r, 100, 110);
    ov_line(o, F_ITEM, C_TEXT, r->title, 218, 320);
    snprintf(dx.id, sizeof dx.id, "%s", r->id);
    dx.cost = r->cost;
    dx.copy = ov_line(o, F_BODY_P, C_TEXT_MUTED, "", 252, 220);
    denied_copy(note);
    ov_hill_button(o, NULL, "Back to shop", on_back_to_shop);
    ov_header(o, true, "Not this time", HEADER_NONE, PILL_CALM, NULL, NULL);
    auto_close(&denied, 20000);
    overlay_enter_rise(o);
}

void reward_asked_open(const day_reward_t *r)
{
    circle_slot = &asked;
    circle_cb = NULL;
    lv_obj_t *o = open_overlay(&asked, true);
    faint_circle_create(o);
    ov_reward_art(o, r, 120, 150);
    ov_line(o, F_ITEM, C_TEXT, r->title, 284, 320);
    ov_hill_button(o, NULL, "Back to shop", on_back_to_shop);
    ov_header(o, false, "Request sent!", HEADER_PILL, PILL_CALM, "clock", "Waiting for a grown-up");
    overlay_enter_push(o);
}

static overlay_cb_t ask_cb;
static int ask_index;
static bool ask_enough;

static void on_ask_hill(hill_tap_t tap)
{
    (void)tap;
    if (!ask_enough) { if (chosen) overlay_slide_away(chosen, 1); return; }
    if (chosen) overlay_slide_away(chosen, -1);
    if (ask_cb) ask_cb(ask_index);
}

static void on_not_now(lv_event_t *e)
{
    (void)e;
    if (chosen) overlay_slide_away(chosen, 1);
}

void reward_choose_open(const day_reward_t *r, int index, int stars, overlay_cb_t cb)
{
    ask_cb = cb;
    ask_index = index;
    ask_enough = stars >= r->cost;
    lv_obj_t *o = open_overlay(&chosen, true);
    faint_circle_create(o);
    ov_reward_art(o, r, 120, 140);
    ov_line(o, F_ITEM, C_TEXT, r->title, 268, 320);
    if (ask_enough) {
        lv_obj_t *no = button_create(o, BTN_TERTIARY, false, NULL, "Not now");
        lv_obj_add_event_cb(no, on_not_now, LV_EVENT_CLICKED, NULL);
        lv_obj_update_layout(no);
        lv_obj_align(no, LV_ALIGN_TOP_MID, 0, 306);
    }
    ov_hill_button(o, NULL, ask_enough ? "Ask for this" : "Back to shop", on_ask_hill);
    char cost[24];
    if (ask_enough) snprintf(cost, sizeof cost, "%d stars", r->cost);
    else snprintf(cost, sizeof cost, "%d more stars", r->cost - stars);
    /* short of stars there is nothing to ask yet: "Not yet" over how many more */
    ov_header(o, false, ask_enough ? "Ask for this?" : "Not yet", HEADER_PILL, PILL_STAR, "star-line", cost);
    overlay_enter_push(o);
}

/* ================================================================ stars from a grown-up */
/* Figma "Rewards · You got a star!": the same choreography as the approved reward; the star flies
 * into the header's pill as the count ticks up; the grown-up's reason is a note. */
#define SX_BURST 700
static struct { char title[32], note[160]; lv_obj_t *icon, *pill, *pill_icon, *label; int from, to; bool note_due; } sx;

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
    fx_fly(sx.icon, CENTER, CENTER, (a.x1 + a.x2) / 2 - oa.x1, ty, 294, 107, 420, 0, true);
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
    snprintf(count, sizeof count, "%d stars", sx.from);
    header_t *h = ov_header(o, true, sx.title, HEADER_PILL, PILL_STAR, "star-line", count);
    lv_obj_update_layout(h->root);
    sx.pill = h->pill.root;
    sx.pill_icon = h->pill.icon;
    sx.label = h->pill.text;
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
    snprintf(left, sizeof left, "%d%% left", percent);
    if (battery && bat_head) { pill_set(&bat_head->pill, PILL_LATE, "battery", left); return; }
    lv_obj_t *o = open_overlay(&battery, true);
    lv_obj_t *pet = ov_graphic(o, true);
    pet_set_mood(pet, PET_MOOD_DROWSY);
    pet_wake_up(pet);   /* his bedroom (Figma Connection · Battery low) */
    hill_t hl;
    hill_create(o, &hl, NULL);
    hill_set_text(&hl, "Put me on my dock");
    bat_head = ov_header_in(&bat_header, o, true, "Battery low", HEADER_PILL, PILL_LATE, "battery", left);
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
        ov_header(o, ui_clock()[0], detail && *detail ? detail : "Hello!", HEADER_TEXT, PILL_CALM, NULL, "Getting your day ready");
    } else if (which == SYS_SCREEN_OFFLINE) {
        /* Figma "Connection · Can't reach the internet" */
        lv_obj_t *pet = ov_graphic(o, true);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        ov_hill_button(o, NULL, "Try again", on_retry_hill);
        ov_header(o, ui_clock()[0], "Let\xE2\x80\x99s reconnect", HEADER_TEXT, PILL_CALM, NULL, "We can\xE2\x80\x99t connect right now");
    } else if (which == SYS_SCREEN_PAIRING) {
        /* Figma "First start · Pairing": no clock yet, the code in the faint circle */
        faint_circle_create(o);
        ov_line(o, F_DETAIL, C_TEXT_MUTED, "Code for the app", 194, 260);
        ov_line(o, F_CLOCK, C_TEXT, detail && *detail ? detail : "", 222, 260);
        ov_hill_empty(o);
        header_t *h = ov_header(o, false, "Hello!", HEADER_TEXT, PILL_CALM, NULL, "Ask a grown-up to open the app");
        lv_obj_set_y(h->root, 40);   /* Figma First start: a little lower */
    } else {
        /* Figma "Connection · Something went wrong" */
        lv_obj_t *pet = ov_graphic(o, true);
        pet_set_mood(pet, PET_MOOD_HAPPY);
        pet_force_clip(pet, PET_CLIP_CURIOUS);
        ov_hill_button(o, NULL, "Try again", on_retry_hill);
        ov_header(o, ui_clock()[0], "Let\xE2\x80\x99s try again", HEADER_TEXT, PILL_CALM, NULL, "Your day didn\xE2\x80\x99t load");
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
