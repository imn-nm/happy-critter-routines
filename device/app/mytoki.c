/*
 * The MyToki child app: owns today's plan and the child's progress, works out which screen
 * applies every quarter second, and turns taps and the 1 o'clock button into actions.
 * Runs unchanged in the simulator and on the ESP32-S3 board.
 */
#include "mytoki.h"
#include "hal.h"
#include "day.h"
#include "logic.h"
#include "cJSON.h"
#include "pet/pet.h"
#include "ui/theme.h"
#include "ui/widgets.h"
#include "ui/home.h"
#include "ui/fx.h"
#include "ui/pages.h"
#include "ui/overlays.h"
#include "ui/wheel.h"
#include "ui/swipe.h"
#include "play/play.h"
#include "motion.h"
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TICK_MS 250
#define REFRESH_MS (5 * 60 * 1000)
#define OFFLINE_RETRY_MS 15000
#define DONE_HOLD_MS 3000
#define DONE_OFFER_MS 5000         /* done early: "Press for Homework" while the ring at the button shrinks */
#define SAY_MS 7000
#define PET_VIEW_MS 6000            /* the spin's result stays this long, then Biscuit plays it */
#define GET_READY_S (5 * 60)
#define WHEEL_MIN_S (10 * 60)
#define IDLE_HOME_MS 45000
#define ALARM_WINDOW_S (30 * 60)   /* the alarm gives up after half an hour and just shows the day */
#define ALARM_CHIRPS_S (5 * 60)    /* it sounds again every minute for the first five */
#define SNOOZE_S (5 * 60)
#define MAX_SNOOZES 2
#define SCHOOL_OFF_S (3 * 60)      /* "Off to school!" for the first three minutes of School */
#define WELCOME_S (3 * 60)         /* "Welcome home!" for three minutes after School */
#define BED_SOON_S (10 * 60)       /* "Bedtime soon" ten minutes before the routine */
#define HELLO_MS 1800              /* "Hi, Amira!" after pairing */

typedef enum {
    ST_NONE, ST_SLEEPY, ST_ALARM, ST_SNOOZE, ST_IM_UP, ST_TASK, ST_DONE, ST_EVENT_PREP, ST_EVENT_READY,
    ST_EVENT, ST_SCHOOL_OFF, ST_SCHOOL, ST_WELCOME, ST_FREE, ST_WAITING, ST_WAIT_START, ST_BED_SOON, ST_BEDTIME,
    ST_DAY_OVER, ST_ALL_DONE, ST_FREE_DAY, ST_REST,
} state_t;

static struct {
    day_plan_t *plan;
    bool have_plan;
    char today[11];
    hal_time_t t;
    int32_t now_s;
    logic_now_t now;
    state_t state;
    int focus;
    uint8_t steps[DAY_MAX_TASKS];
    int done_task;
    uint32_t done_until;
    int32_t done_press_s;   /* when the button finished it (the 3 s cheer comes after) */
    int done_saved;         /* minutes saved by finishing early */
    int done_next;          /* the task a press pulls forward during the cheer, or -1 */
    uint32_t done_hold;     /* how long the cheer lasts (ms) */
    int ready_task;
    uint32_t ready_until;
    char say[48], say_key[64];
    uint32_t say_until;
    int32_t free_window;
    bool free_pet_view, reminded;
    uint32_t pet_view_at;       /* after a spin: when the result gives way to Biscuit playing (0 = none) */
    pet_activity_t free_act;
    int last_current;
    state_t last_state;
    bool requested, fetching;
    uint32_t last_fetch, retry_at;
    lv_obj_t *carousel, *pg_rewards, *pg_home, *pg_chores;
    int swipe_from;            /* the page a sideways swipe started on */
    bool swipe_pending;        /* ...and it is about to turn the carousel */
    int page;
    bool night_lock, rewards_only, fresh;
    char progress_date[11];
    /* the morning */
    bool alarm_ack, welcome_ack;
    uint8_t snoozes;
    int32_t snooze_until;       /* seconds of the day */
    uint32_t imup_until;        /* ms: the 3 s "You're up!" */
    int32_t alarm_chirp_s;      /* when the alarm last sounded */
    int school_task;            /* today's School row, or -1 */
    /* the device */
    uint32_t hello_until;       /* ms: "Hi, Amira!" after pairing */
    int battery_shown;          /* the last low-battery step shown (10, 5), or 0 */
    uint8_t brightness;
    int32_t last_now_s;         /* to notice the clock jumping back (the simulator's jumps) */
} app;

static void tick(lv_timer_t *timer);
static void on_sched_chore(int i);

/* ================================================================ small helpers */
static uint32_t now_ms(void) { return lv_tick_get(); }

static void lower(char *dst, size_t n, const char *src)
{
    size_t i = 0;
    for (; src[i] && i < n - 1; i++) dst[i] = (char)tolower((unsigned char)src[i]);
    dst[i] = 0;
}

/* Whole word (or word prefix with `prefix`) in a lower-case name. */
static bool word(const char *name, const char *w, bool prefix)
{
    size_t n = strlen(w);
    for (const char *p = name; (p = strstr(p, w)); p++) {
        bool start = p == name || !isalnum((unsigned char)p[-1]);
        bool end = prefix || !isalnum((unsigned char)p[n]);
        if (start && end) return true;
    }
    return false;
}

static bool any(const char *name, const char *const *words, bool prefix)
{
    for (; *words; words++) if (word(name, *words, prefix)) return true;
    return false;
}

static const char *const SPORTS[] = { "soccer", "football", "sport", "sports", "gym", "gymnastics", "basketball", "baseball",
    "softball", "tennis", "hockey", "run", "running", "exercise", "workout", "pe", "p.e.", "karate", "judo", "taekwondo",
    "martial", "cycling", "bike", "biking", "cricket", "rugby", "volleyball", "lacrosse", "golf", "athletics", "track", NULL };
static const char *const SPORTS_PREFIX[] = { "swim", "jog", "skat", NULL };
static const char *const WIND_DOWN[] = { "bedtime routine", "ready for bed", "wind down", NULL };
static const char *const MEALS[] = { "breakfast", "lunch", "dinner", "snack", "eat", "meal", "supper", NULL };
static const char *const LEARN[] = { "school", "class", "lesson", "learn", "read", "book", "homework", "study", "story", NULL };
static const char *const ART[] = { "draw", "paint", "color", "colour", "craft", "art", NULL };
static const char *const OUT[] = { "outside", "outdoor", "park", "garden", "nature", NULL };
static const char *const GAME[] = { "game", "gaming", "play", "screen", "tv", "video", "tablet", NULL };

static bool is_sports(const char *n) { return any(n, SPORTS, false) || any(n, SPORTS_PREFIX, true); }
static bool is_sleep(const char *n) { return !strcmp(n, "bedtime") || word(n, "sleep", true) || word(n, "nap", false); }

/* spriteClips.ts activityForTask */
static pet_activity_t activity_for(const day_task_t *t)
{
    if (t->activity > 0) return (pet_activity_t)t->activity;
    char n[48];
    lower(n, sizeof n, t->title);
    for (const char *const *w = WIND_DOWN; *w; w++) if (strstr(n, *w)) return PET_ACT_READING;
    if (strstr(n, "brush") || strstr(n, "teeth") || strstr(n, "tooth")) return PET_ACT_BRUSHING;
    for (const char *const *w = MEALS; *w; w++) if (strstr(n, *w)) return PET_ACT_EATING;
    if (is_sports(n)) return PET_ACT_SPORTS;
    if (strstr(n, "homework") || strstr(n, "study")) return PET_ACT_NONE;
    for (const char *const *w = LEARN; *w; w++) if (strstr(n, *w)) return PET_ACT_READING;
    if (any(n, ART, false) || strstr(n, "colo")) return PET_ACT_DRAWING;
    if (strstr(n, "bubble")) return PET_ACT_BUBBLES;
    for (const char *const *w = OUT; *w; w++) if (strstr(n, *w)) return PET_ACT_OUTSIDE;
    if (any(n, GAME, false)) return PET_ACT_GAMING;
    if (is_sleep(n)) return PET_ACT_SLEEPING;
    return PET_ACT_NONE;
}

/* ChildInterface promptForTask, with the Field Kit's greeting */
static const char *prompt_for(const day_task_t *t, char *buf, size_t n)
{
    if (t->say[0]) return t->say;
    char k[48];
    lower(k, sizeof k, t->title);
    for (const char *const *w = WIND_DOWN; *w; w++) if (strstr(k, *w)) return "Let\xE2\x80\x99s get cozy for bed!";
    if (t->system == SYS_WAKE || strstr(k, "wake") || strstr(k, "morning")) {
        snprintf(buf, n, "Good morning, %s!", app.plan->child.name);
        return buf;
    }
    if (is_sports(k)) return "Let\xE2\x80\x99s get moving!";
    if (t->system == SYS_BREAKFAST) return "Mmm, breakfast!";
    if (t->system == SYS_LUNCH) return "Lunch time!";
    if (t->system == SYS_DINNER) return "Dinner time!";
    if (strstr(k, "school") || strstr(k, "class") || strstr(k, "lesson") || strstr(k, "learn")) return "Let\xE2\x80\x99s learn together!";
    for (const char *const *w = MEALS; *w; w++) if (strstr(k, *w)) return "Let\xE2\x80\x99s eat together!";
    if (strstr(k, "brush") || strstr(k, "teeth") || strstr(k, "tooth")) return "Brush, brush, brush!";
    if (strstr(k, "read") || strstr(k, "book") || strstr(k, "homework") || strstr(k, "study")) return "I\xE2\x80\x99ll do it with you!";
    return NULL;
}

static const char *free_prompt(pet_activity_t a)
{
    switch (a) {
    case PET_ACT_READING: return "A little quiet time!";
    case PET_ACT_SPORTS: return "Let\xE2\x80\x99s get moving!";
    case PET_ACT_DRAWING: return "Let\xE2\x80\x99s draw a picture!";
    case PET_ACT_BUBBLES: return "Bubbles!";
    case PET_ACT_OUTSIDE: return "Let\xE2\x80\x99s play outside!";
    default: return "Let\xE2\x80\x99s have some fun!";
    }
}

/* "Piano Practice" -> "Piano practice" for sentences */
static void sentence(char *dst, size_t n, const char *title)
{
    lower(dst, n, title);
    if (dst[0]) dst[0] = (char)toupper((unsigned char)dst[0]);
}

static void first_word(char *dst, size_t n, const char *title)
{
    size_t i = 0;
    for (; title[i] && title[i] != ' ' && i < n - 1; i++) dst[i] = title[i];
    dst[i] = 0;
}

static void say(const char *key, const char *text, uint32_t ms)
{
    if (!text) return;
    if (key && !strcmp(key, app.say_key)) return;
    if (key) snprintf(app.say_key, sizeof app.say_key, "%s", key);
    snprintf(app.say, sizeof app.say, "%s", text);
    app.say_until = now_ms() + ms;
}

static void send(const char *type, const char *key, const char *id, int extra)
{
    char json[200], at[8];
    snprintf(at, sizeof at, "%02d:%02d", app.t.hour, app.t.minute);
    snprintf(json, sizeof json, "{\"type\":\"%s\",\"%s\":\"%s\",\"child_id\":\"%s\",\"date\":\"%s\",\"at\":\"%s\",\"value\":%d}",
             type, key, id, app.plan->child.id, app.today, at, extra);
    hal_send(json);
}

/* ================================================================ progress kept on the device */
static void save_progress(void)
{
    cJSON *root = cJSON_CreateObject();
    cJSON_AddStringToObject(root, "date", app.plan->date);
    cJSON *done = cJSON_AddObjectToObject(root, "done");
    cJSON *steps = cJSON_AddObjectToObject(root, "steps");
    for (int i = 0; i < app.plan->ntasks; i++) {
        const day_task_t *t = &app.plan->tasks[i];
        if (t->done_at >= 0) cJSON_AddNumberToObject(done, t->id, t->done_at);
        if (app.steps[i]) cJSON_AddNumberToObject(steps, t->id, app.steps[i]);
    }
    cJSON *chores = cJSON_AddArrayToObject(root, "chores");
    for (int i = 0; i < app.plan->nchores; i++)
        if (app.plan->chores[i].done) cJSON_AddItemToArray(chores, cJSON_CreateString(app.plan->chores[i].id));
    cJSON *asked = cJSON_AddArrayToObject(root, "asked");
    for (int i = 0; i < app.plan->nrewards; i++)
        if (app.plan->rewards[i].state == REWARD_WAITING) cJSON_AddItemToArray(asked, cJSON_CreateString(app.plan->rewards[i].id));
    cJSON_AddBoolToObject(root, "alarm", app.alarm_ack);
    cJSON_AddNumberToObject(root, "snoozes", app.snoozes);
    cJSON_AddBoolToObject(root, "welcome", app.welcome_ack);
    char *s = cJSON_PrintUnformatted(root);
    if (s) { hal_store_set("progress", s); cJSON_free(s); }
    cJSON_Delete(root);
}

/* What the child did on this device today, laid over a fresh plan (the server may not have it yet). */
static void apply_progress(day_plan_t *p)
{
    memset(app.steps, 0, sizeof app.steps);
    app.alarm_ack = app.welcome_ack = false;
    app.snoozes = 0;
    app.snooze_until = 0;
    static char buf[4096];
    if (!hal_store_get("progress", buf, sizeof buf)) return;
    cJSON *root = cJSON_Parse(buf);
    if (!root) return;
    const cJSON *date = cJSON_GetObjectItem(root, "date");
    if (cJSON_IsString(date) && !strcmp(date->valuestring, p->date)) {
        const cJSON *it;
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "done")) {
            int i = day_task_index(p, it->string);
            if (i >= 0 && p->tasks[i].done_at < 0) p->tasks[i].done_at = (int32_t)it->valuedouble;
        }
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "steps")) {
            int i = day_task_index(p, it->string);
            if (i >= 0) app.steps[i] = (uint8_t)it->valuedouble;
        }
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "chores"))
            for (int i = 0; i < p->nchores; i++) if (cJSON_IsString(it) && !strcmp(p->chores[i].id, it->valuestring)) p->chores[i].done = true;
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "asked"))
            for (int i = 0; i < p->nrewards; i++)
                if (cJSON_IsString(it) && !strcmp(p->rewards[i].id, it->valuestring) && p->rewards[i].state == REWARD_NONE) p->rewards[i].state = REWARD_WAITING;
        app.alarm_ack = cJSON_IsTrue(cJSON_GetObjectItem(root, "alarm"));
        app.welcome_ack = cJSON_IsTrue(cJSON_GetObjectItem(root, "welcome"));
        const cJSON *sn = cJSON_GetObjectItem(root, "snoozes");
        if (cJSON_IsNumber(sn)) app.snoozes = (uint8_t)sn->valuedouble;
    }
    cJSON_Delete(root);
}

/* Celebrations the child has already seen (approved rewards, streak stars). */
static void check_news(const day_plan_t *p)
{
    static char buf[1024];
    cJSON *seen = hal_store_get("seen", buf, sizeof buf) ? cJSON_Parse(buf) : NULL;
    bool first = !seen;
    if (!seen) seen = cJSON_CreateObject();
    cJSON *ap = cJSON_GetObjectItem(seen, "approved");
    if (!ap) ap = cJSON_AddArrayToObject(seen, "approved");
    cJSON *st = cJSON_GetObjectItem(seen, "streak");
    if (!st) st = cJSON_AddObjectToObject(seen, "streak");
    cJSON *dn = cJSON_GetObjectItem(seen, "denied");
    if (!dn) dn = cJSON_AddArrayToObject(seen, "denied");
    bool shown = false;
    extern void mytoki_open_rewards(int);
    /* a grown-up said no (or later) */
    for (int i = 0; i < p->nrewards; i++) {
        if (p->rewards[i].state != REWARD_DENIED) continue;
        bool known = false;
        const cJSON *it;
        cJSON_ArrayForEach(it, dn) if (cJSON_IsString(it) && !strcmp(it->valuestring, p->rewards[i].id)) known = true;
        if (known) continue;
        cJSON_AddItemToArray(dn, cJSON_CreateString(p->rewards[i].id));
        while (cJSON_GetArraySize(dn) > 24) cJSON_DeleteItemFromArray(dn, 0);
        if (!first && !shown) { denied_open(&p->rewards[i], p->rewards[i].note, mytoki_open_rewards); shown = true; }
    }
    /* stars from a grown-up: the balance went up */
    const cJSON *seen_stars = cJSON_GetObjectItem(seen, "stars");
    int before_stars = cJSON_IsNumber(seen_stars) ? (int)seen_stars->valuedouble : -1;
    if (before_stars >= 0 && p->child.stars > before_stars && !shown) {
        stars_open(p->child.stars - before_stars, p->child.stars, p->child.star_note);
        shown = true;
    }
    if (cJSON_IsNumber(seen_stars)) cJSON_SetNumberValue((cJSON *)seen_stars, p->child.stars);
    else cJSON_AddNumberToObject(seen, "stars", p->child.stars);
    for (int i = 0; i < p->nrewards; i++) {
        if (p->rewards[i].state != REWARD_APPROVED) continue;
        bool known = false;
        const cJSON *it;
        cJSON_ArrayForEach(it, ap) if (cJSON_IsString(it) && !strcmp(it->valuestring, p->rewards[i].id)) known = true;
        if (known) continue;
        cJSON_AddItemToArray(ap, cJSON_CreateString(p->rewards[i].id));
        while (cJSON_GetArraySize(ap) > 24) cJSON_DeleteItemFromArray(ap, 0);
        if (!first && !shown) { approved_open(&p->rewards[i], p->child.name, p->child.pet); shown = true; }
    }
    for (int i = 0; i < p->nstreaks; i++) {
        const day_streak_t *s = &p->streaks[i];
        const cJSON *was = cJSON_GetObjectItem(st, s->id);
        int before = cJSON_IsNumber(was) ? (int)was->valuedouble : -1;
        if (before != s->count) {
            if (cJSON_IsNumber(was)) cJSON_SetNumberValue((cJSON *)was, s->count);
            else cJSON_AddNumberToObject(st, s->id, s->count);
        }
        if (before >= 0 && s->count > before && !shown) {
            bool big = s->count >= s->goal;
            char line[64] = "";
            if (big) {
                int stars = p->child.stars;
                const day_reward_t *best = NULL, *near = NULL;
                for (int r = 0; r < p->nrewards; r++) {
                    const day_reward_t *rd = &p->rewards[r];
                    if (rd->state != REWARD_NONE) continue;
                    if (rd->cost <= stars && (!best || rd->cost > best->cost)) best = rd;
                    if (rd->cost > stars && (!near || rd->cost < near->cost)) near = rd;
                }
                if (best) snprintf(line, sizeof line, "You can get %s!", best->title);
                else if (near) snprintf(line, sizeof line, "%d more for %s", near->cost - stars, near->title);
            }
            streak_open(s, big, line, mytoki_open_rewards, p->child.picture);
            shown = true;
        }
    }
    char *out = cJSON_PrintUnformatted(seen);
    if (out) { hal_store_set("seen", out); cJSON_free(out); }
    cJSON_Delete(seen);
}

/* Biscuit landed from a jump: little sparks from his paws, wherever he lives. */
static void on_land_sparks(lv_obj_t *pet, void *u)
{
    (void)u;
    int32_t lx, rx, y;
    pet_paws(pet, &lx, &rx, &y);
    lv_obj_t *par = lv_obj_get_parent(pet);
    fx_sparks(par, lx, y, -1);
    fx_sparks(par, rx, y, +1);
}

/* ================================================================ carousel */
static void go_page(int page, bool anim)
{
    lv_obj_t *target = page == 0 ? app.pg_rewards : page == 2 ? app.pg_chores : app.pg_home;
    if (lv_obj_has_flag(target, LV_OBJ_FLAG_HIDDEN)) page = 1;
    /* pages are a screen wide; hidden ones take no room */
    int slot = page - (page > 0 && lv_obj_has_flag(app.pg_rewards, LV_OBJ_FLAG_HIDDEN) ? 1 : 0);
    lv_obj_update_layout(app.carousel);
    lv_obj_scroll_to_x(app.carousel, slot * SCREEN_W, anim ? LV_ANIM_ON : LV_ANIM_OFF);
    if (!anim) app.page = page;
}

void mytoki_open_rewards(int unused)
{
    (void)unused;
    go_page(0, true);
}

static void on_scroll_end(lv_event_t *e)
{
    (void)e;
    /* LVGL sends one as the finger lifts, before the snap has moved anywhere; when that lift was a
     * swipe, on_base_swipe decides the page and the settled one after its animation lands here */
    if (app.swipe_pending) return;
    int32_t x = lv_obj_get_scroll_x(app.carousel);
    int idx = (int)((x + SCREEN_W / 2) / SCREEN_W);
    bool has_rewards = !lv_obj_has_flag(app.pg_rewards, LV_OBJ_FLAG_HIDDEN);
    app.page = has_rewards ? idx : idx + 1;
}

/* A swipe on the day turns the carousel a page, even a short gentle one LVGL's snap would undo. */
static bool on_base_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)start; (void)user;
    if (dir == SWIPE_DOWN) {
        /* the alarm: five more minutes, twice at most; nothing on screen says so */
        if (app.state != ST_ALARM || app.snoozes >= MAX_SNOOZES) return false;
        if (commit) {
            app.snoozes++;
            app.snooze_until = app.now_s + SNOOZE_S;
            save_progress();
            tick(NULL);
        }
        return true;
    }
    if (dir == SWIPE_UP) {
        /* a flick up on Home lifts the day's schedule, like tapping the Next pill; a flick down puts it back */
        if (app.page != 1 || app.night_lock || !app.have_plan || !app.plan) return false;
        if (app.state == ST_ALARM || app.state == ST_SNOOZE || app.state == ST_SLEEPY) return false;
        if (commit) schedule_open(app.plan, &app.now, app.now_s / 60, app.plan->child.picture, on_sched_chore);
        return true;
    }
    if (app.night_lock) return false;
    /* from the page the finger was on: finger to the left, the page on the right */
    int target = (commit ? app.swipe_from : app.page) - dir;
    if (target < 0 || target > 2) return false;
    if (target == 2 && app.rewards_only) return false;
    if (commit) {
        app.swipe_pending = false;
        app.page = target;
        go_page(target, true);
    } else {
        app.swipe_from = app.page;
        app.swipe_pending = true;
    }
    return true;
}

static void set_night_lock(bool lock, bool rewards_only)
{
    if (lock == app.night_lock && rewards_only == app.rewards_only) return;
    app.night_lock = lock;
    app.rewards_only = rewards_only;
    ui_show(app.pg_rewards, !lock);
    ui_show(app.pg_chores, !lock && !rewards_only);
    lv_obj_add_flag(app.carousel, LV_OBJ_FLAG_SCROLLABLE);
    go_page(lock ? 1 : (rewards_only && app.page == 2 ? 1 : app.page), false);
    if (lock) lv_obj_remove_flag(app.carousel, LV_OBJ_FLAG_SCROLLABLE);
}

/* ================================================================ Playtime */
void mytoki_open_playtime(void);
static void read_out(void);

/* ================================================================ actions */
static void finish_task_at(int i, int32_t at_s)
{
    day_task_t *t = &app.plan->tasks[i];
    if (t->done_at >= 0) return;
    t->done_at = at_s;
    int32_t spent = at_s - logic_start(&app.now, app.plan, i) * 60;
    char at[8];
    snprintf(at, sizeof at, "%02d:%02d", (int)(at_s / 3600), (int)(at_s / 60 % 60));
    char json[220];
    snprintf(json, sizeof json, "{\"type\":\"task_done\",\"task_id\":\"%s\",\"child_id\":\"%s\",\"date\":\"%s\",\"at\":\"%s\",\"value\":%d}",
             t->id, app.plan->child.id, app.today, at, (int)(spent > 0 ? spent : 0));
    hal_send(json);
    save_progress();
}

static void finish_task(int i) { finish_task_at(i, app.now_s); }

static void on_chore(int i)
{
    day_chore_t *c = &app.plan->chores[i];
    if (c->done) return;
    c->done = true;
    send("chore_done", "task_id", c->id, 0);
    save_progress();
    hal_play(HAL_SOUND_DONE);
    pet_react(chores_page_pet(), PET_CLIP_CELEBRATE);
    chores_page_render(app.plan, app.now_s / 60, app.plan->child.picture);
}

/* a chore ticked from the schedule wheel */
static void on_sched_chore(int i)
{
    on_chore(i);
    pet_react(home_pet(), PET_CLIP_CELEBRATE);
    schedule_refresh(app.plan, &app.now, app.now_s / 60);
}

static int available_stars(void)
{
    int s = app.plan->child.stars;
    for (int i = 0; i < app.plan->nrewards; i++) if (app.plan->rewards[i].state == REWARD_WAITING) s -= app.plan->rewards[i].cost;
    return s < 0 ? 0 : s;
}

/* the child asked for a reward (Rewards · 02 · Choose and ask): one request, then "Asked!" */
static void on_ask(int i)
{
    day_reward_t *r = &app.plan->rewards[i];
    if (r->state != REWARD_NONE || available_stars() < r->cost) return;
    r->state = REWARD_WAITING;
    send("reward_request", "reward_id", r->id, r->cost);
    save_progress();
    hal_play(HAL_SOUND_TICK);
    rewards_page_render(app.plan, available_stars(), app.plan->child.picture);
    reward_asked_open(r);
}

/* a reward tapped in the shop: see it bigger and ask for it */
static void on_reward_tap(int i)
{
    const day_reward_t *r = &app.plan->rewards[i];
    if (r->state == REWARD_WAITING) { reward_asked_open(r); return; }
    if (r->state != REWARD_NONE) return;
    reward_choose_open(r, i, available_stars(), on_ask);
}

static void on_other_done(int task)
{
    finish_task(task);
    hal_play(HAL_SOUND_DONE);
    logic_now(app.plan, app.now_s, &app.now);
    others_refresh(app.plan, &app.now);
}

/* A wheel option as Biscuit's activity ("Draw" -> drawing). */
static pet_activity_t activity_for_option(const char *opt)
{
    char k[24];
    lower(k, sizeof k, opt);
    if (any(k, ART, false) || strstr(k, "draw") || strstr(k, "colo")) return PET_ACT_DRAWING;
    if (strstr(k, "read") || strstr(k, "book")) return PET_ACT_READING;
    if (strstr(k, "bubble")) return PET_ACT_BUBBLES;
    for (const char *const *w = OUT; *w; w++) if (strstr(k, *w)) return PET_ACT_OUTSIDE;
    if (is_sports(k) || strstr(k, "dance")) return PET_ACT_SPORTS;
    if (any(k, GAME, false)) return PET_ACT_GAMING;
    return pet_pick_free_time_activity();
}

static void on_home(home_event_t ev, int arg)
{
    switch (ev) {
    case HOME_TAP_REWARDS: go_page(0, true); break;
    case HOME_TAP_CHORES: go_page(2, true); break;
    case HOME_TAP_NEXT: schedule_open(app.plan, &app.now, app.now_s / 60, app.plan->child.picture, on_sched_chore); break;
    case HOME_TAP_CARD:
        if (app.state == ST_EVENT && app.now.nstill) others_open(app.plan, &app.now, on_other_done);
        break;
    case HOME_TAP_PLAY: app.free_pet_view = true; break;
    case HOME_TAP_WHEEL: app.free_pet_view = false; break;
    case HOME_TAP_PET: {
        if ((app.state == ST_FREE && app.now.free_remaining - GET_READY_S > 0) || app.state == ST_FREE_DAY) { mytoki_open_playtime(); break; }
        static const char *const HI[] = { "Hi!", "We\xE2\x80\x99ve got this!", "Happy to see you!", "What\xE2\x80\x99s next?" };
        if (app.state == ST_ALARM || app.state == ST_SNOOZE) { say(NULL, "I\xE2\x80\x99m up! Are you?", 2500); break; }
        if (app.state == ST_SLEEPY || app.state == ST_DAY_OVER || app.state == ST_BEDTIME) say(NULL, "Zzz\xE2\x80\xA6", 2500);
        else say(NULL, HI[hal_random() % 4], 2500);
        break;
    }
    case HOME_WHEEL_RESULT:
        app.free_act = activity_for_option(app.plan->wheel[arg]);
        app.pet_view_at = now_ms() + PET_VIEW_MS;
        if (!app.pet_view_at) app.pet_view_at = 1;
        break;
    case HOME_TAP_SPEAKER: read_out(); break;
    case HOME_TAP_PLAYTIME: mytoki_open_playtime(); break;
    case HOME_TAP_STEP: mytoki_button(); break;
    }
}

static void on_retry(int unused)
{
    (void)unused;
    app.retry_at = 0;
    app.fetching = true;
    app.last_fetch = now_ms();
    if (system_showing() != SYS_SCREEN_PAIRING) system_show(SYS_SCREEN_LOADING, NULL, NULL);
    hal_request_day();
}

/* ================================================================ which screen, and its view */
static state_t derive(void)
{
    const logic_now_t *n = &app.now;
    app.focus = -1;
    if (app.done_task >= 0) {
        if ((int32_t)(now_ms() - app.done_until) < 0) { app.focus = app.done_task; return ST_DONE; }
        finish_task_at(app.done_task, app.done_press_s);
        app.done_task = -1;
        logic_now(app.plan, app.now_s, &app.now);
    }
    if (app.plan->rest_day) return ST_REST;
    if (n->day_over) return ST_DAY_OVER;
    /* the morning alarm: from wake-up until the button says I'm up (or half an hour passes) */
    if (n->has_timed && !n->before_wake && !app.alarm_ack) {
        app.focus = n->current;
        if (app.imup_until && (int32_t)(now_ms() - app.imup_until) < 0) return ST_IM_UP;
        if (app.imup_until) { app.imup_until = 0; app.alarm_ack = true; save_progress(); }
        else if (app.now_s < n->wake * 60 + ALARM_WINDOW_S) return app.now_s < app.snooze_until ? ST_SNOOZE : ST_ALARM;
        else { app.alarm_ack = true; save_progress(); }
        app.focus = -1;
    }
    if (n->current >= 0) {
        const day_task_t *c = &app.plan->tasks[n->current];
        app.focus = n->current;
        if (c->system == SYS_BEDTIME) return ST_BEDTIME;
        if (c->system == SYS_SCHOOL) return app.now_s < n->start[n->current] * 60 + SCHOOL_OFF_S ? ST_SCHOOL_OFF : ST_SCHOOL;
        if (c->event) {
            if (app.now_s / 60 < c->event_start) {
                bool all = c->nsteps && app.steps[n->current] >= c->nsteps;
                return all ? ST_EVENT_READY : ST_EVENT_PREP;
            }
            return ST_EVENT;
        }
        if (n->waiting[n->current]) return ST_WAIT_START;
        return ST_TASK;
    }
    if (n->before_wake) return ST_SLEEPY;
    /* the first minutes home after school */
    if (app.school_task >= 0 && !app.welcome_ack) {
        int32_t end = app.plan->tasks[app.school_task].end * 60;
        if (app.now_s >= end && app.now_s < end + WELCOME_S) return ST_WELCOME;
    }
    /* bedtime soon: the routine (or bed) is the next thing and starts within ten minutes */
    if (n->nupcoming) {
        int nx = n->upcoming[0];
        const day_task_t *t = &app.plan->tasks[nx];
        int32_t start = n->start[nx] * 60;
        if ((t->bedtime_routine || t->system == SYS_BEDTIME) && start > app.now_s && start - app.now_s <= BED_SOON_S) return ST_BED_SOON;
    }
    if (n->free) return ST_FREE;
    if (n->nupcoming) return ST_WAITING;
    return n->has_timed ? ST_ALL_DONE : ST_FREE_DAY;
}

/* "3:42 pm" */
static void fmt_clock(char *buf, size_t n, int minutes)
{
    ui_fmt_time(buf, n, minutes);
    size_t l = strlen(buf);
    snprintf(buf + l, n - l, " %s", ui_ampm(minutes));
}

/* The night clock (Figma Wind down · Night clock): the handheld on its dock after Goodnight. */
static void night_clock(home_view_t *v)
{
    const logic_now_t *n = &app.now;
    const int now_m = app.now_s / 60;
    v->clock = true;
    ui_fmt_time(v->clock_text, sizeof v->clock_text, now_m);
    char w[8];
    ui_fmt_time(w, sizeof w, n->wake);
    v->below = BELOW_TIME;
    snprintf(v->status, sizeof v->status, "Wake up at %s", w);
    snprintf(v->status_icon, sizeof v->status_icon, "alarm");
    v->pill_tone = PILL_NIGHT;
    v->timer_show = false;
    v->mood = PET_MOOD_SLEEP;
    v->pet_dim = 128;
    v->sides = v->dots = false;
    v->bottom = BOTTOM_NOTE;
    snprintf(v->note, sizeof v->note, "Charging - %d%%", hal_battery());
}

static void next_from(home_view_t *v, int first)
{
    const logic_now_t *n = &app.now;
    int idx = -1, k0 = 0;
    for (int k = 0; k < n->nupcoming; k++) if (n->upcoming[k] != app.focus) { idx = n->upcoming[k]; k0 = k; break; }
    if (first >= 0) { idx = first; k0 = -1; }
    if (idx < 0) { v->bottom = BOTTOM_NONE; return; }
    const day_task_t *t = &app.plan->tasks[idx];
    v->bottom = BOTTOM_NEXT;
    snprintf(v->next_icon, sizeof v->next_icon, "%s", t->icon);
    snprintf(v->next_title, sizeof v->next_title, "%s", t->title);
    int start = t->event ? t->event_start : n->start[idx];
    ui_fmt_time(v->next_time, sizeof v->next_time, start);
    int more = 0;
    for (int i = 0; i < app.plan->ntasks; i++) if (app.plan->tasks[i].done_at < 0 && n->start[i] > start) more++;
    (void)k0;
    v->peeks = (int8_t)(more > 2 ? 2 : more);
}

/* A night streak's row, shown under Biscuit at bedtime instead of the note. */
static bool night_stars(home_view_t *v)
{
    for (int i = 0; i < app.plan->nstreaks; i++) {
        const day_streak_t *s = &app.plan->streaks[i];
        if (!s->night || s->count >= s->goal) continue;
        v->bottom = BOTTOM_STARS;
        snprintf(v->star_icon, sizeof v->star_icon, "%s", s->icon);
        v->star_goal = s->goal;
        v->star_count = s->count;
        v->star_prize = s->prize;
        return true;
    }
    return false;
}

/* Picture view (under 7): icon-first. Clock times instead of "min left", the countdown as the
 * free-time title, just the name at bedtime, and a speaker that reads the task out. */
static void picture_view(home_view_t *v)
{
    const day_plan_t *p = app.plan;
    const logic_now_t *n = &app.now;
    v->picture = true;
    const day_task_t *t = app.focus >= 0 ? &p->tasks[app.focus] : NULL;
    char a[8], b[8];
    switch (app.state) {
    case ST_TASK:
    case ST_EVENT:
        if (!n->overdue) {
            ui_fmt_time(a, sizeof a, t->event && app.state == ST_EVENT ? t->event_start : n->start[app.focus]);
            ui_fmt_time(b, sizeof b, t->end);
            snprintf(v->status, sizeof v->status, "%s \xE2\x80\x93 %s%s", a, b, ui_ampm(t->end));
        }
        v->speaker = true;
        break;
    case ST_FREE:
        break;   /* the same screen for both ages (Circle rule 7) */
    case ST_BEDTIME:
    case ST_DAY_OVER:
        snprintf(v->title, sizeof v->title, "%s", p->child.name);
        v->status[0] = 0;
        if (v->bottom == BOTTOM_NOTE) v->bottom = BOTTOM_NONE;
        break;
    default:
        break;
    }
    v->say[0] = 0;
}

/* 0..1000 of the timer still lit */
static int16_t share_left(int32_t left, int32_t total)
{
    if (total <= 0 || left <= 0) return 0;
    int32_t v = (int32_t)((int64_t)left * 1000 / total);
    return (int16_t)(v > 1000 ? 1000 : v);
}

/* MyToki 2's rule (Figma Task · 10 min or more / Under 10 min): with 10 minutes or more left the room
 * fills the screen and the timer shows what's left in mint; under 10 the room shrinks into the
 * circle, the whole timer and the pill turn amber. `calm` is the pill's tone with time to spare. */
static void timed(home_view_t *v, int mins_left, int32_t rem, int32_t total, pill_tone_t calm)
{
    v->timer_show = true;
    if (mins_left < 10) {
        v->graphic = GRAPHIC_SMALL;
        v->timer_tone = TIMER_HURRY;
        v->timer_left = 1000;
        v->pill_tone = PILL_HURRY;
    } else {
        v->graphic = GRAPHIC_FULL;
        v->timer_tone = TIMER_PLENTY;
        v->timer_left = share_left(rem, total);
        v->pill_tone = calm;
    }
}

/* The running-late screen (Figma Task · Running late): no room, the coral timer breathing. */
static void late(home_view_t *v)
{
    v->mid = MID_OVERDUE;
    v->late_chip = true;
    v->timer_show = true;
    v->timer_tone = TIMER_LATE;
    v->timer_left = 1000;
    v->timer_pulse = true;
}

/* A note the button answers (Figma "Note"): a step, "Press to start". */
static void button_note(home_view_t *v, const char *icon, const char *text)
{
    v->card = CARDPOS_LOW;
    snprintf(v->card_icon, sizeof v->card_icon, "%s", icon ? icon : "");
    snprintf(v->card_text, sizeof v->card_text, "%s", text);
    v->card_end = CARD_END_BUTTON;
}

static void build_view(home_view_t *v)
{
    memset(v, 0, sizeof *v);
    const day_plan_t *p = app.plan;
    const logic_now_t *n = &app.now;
    const int now_m = app.now_s / 60;
    char buf[96];
    v->sides = v->dots = true;
    v->title_color = C_TEXT;
    v->icon_color = C_TEXT;
    v->force_clip = -1;
    v->mood = PET_MOOD_HAPPY;
    v->mid = MID_PET;
    v->graphic = GRAPHIC_FULL;
    v->pill_tone = PILL_CALM;
    ui_fmt_clock(v->clock_line, sizeof v->clock_line, now_m);
    const day_task_t *t = app.focus >= 0 ? &p->tasks[app.focus] : NULL;

    switch (app.state) {
    case ST_TASK: {
        snprintf(v->icon, sizeof v->icon, "%s", t->icon);
        snprintf(v->title, sizeof v->title, "%s", t->title);
        pet_activity_t act = activity_for(t);
        char k[48];
        lower(k, sizeof k, t->title);
        v->mood = t->system == SYS_WAKE || strstr(k, "wake") || strstr(k, "morning") ? PET_MOOD_EXCITED
                : act == PET_ACT_SLEEPING ? PET_MOOD_SLEEP : n->drowsy ? PET_MOOD_DROWSY : PET_MOOD_HAPPY;
        v->activity = act;
        for (const char *const *w = WIND_DOWN; *w; w++)
            if (strstr(k, *w)) { v->activity = PET_ACT_NONE; v->mood = PET_MOOD_DROWSY; v->wake = true; }   /* his bedroom (Figma Wind down) */
        if (n->paused >= 0) {
            char low[48];
            sentence(low, sizeof low, p->tasks[n->paused].title);
            snprintf(buf, sizeof buf, "paused:%s", p->tasks[n->paused].id);
            char line[48];
            snprintf(line, sizeof line, "%s after this!", low);
            say(buf, line, 600000);
        }
        if (n->overdue) {
            late(v);
            char name[48];
            sentence(name, sizeof name, t->title);
            const reserve_t *r = &n->reserve;
            if (r->free_reserve) {
                snprintf(v->overdue_text, sizeof v->overdue_text, "%s is eating up your free time", name);
                v->worm_eaten = (uint8_t)(5 - (r->reserve_remaining * 5 + r->reserve_total - 1) / (r->reserve_total ? r->reserve_total : 1));
                snprintf(v->worm_icon, sizeof v->worm_icon, "kite");
            } else if (r->reserve_task >= 0) {
                snprintf(v->overdue_text, sizeof v->overdue_text, "%s is taking time from %s", name, p->tasks[r->reserve_task].title);
                v->worm_eaten = 5;
                snprintf(v->worm_icon, sizeof v->worm_icon, "%s", p->tasks[r->reserve_task].icon[0] ? p->tasks[r->reserve_task].icon : "clock");
            } else {
                snprintf(v->overdue_text, sizeof v->overdue_text, "%s is taking a little longer today", name);
                v->worm_eaten = 5;
            }
        } else {
            int left = logic_minutes_left(n, p, app.focus, app.now_s);
            v->below = BELOW_TIME;
            snprintf(v->status, sizeof v->status, "%d min left", left);
            snprintf(v->status_icon, sizeof v->status_icon, "timer");
            int32_t total = (t->end - n->start[app.focus]) * 60, rem = t->end * 60 - app.now_s;
            if (n->run_start[app.focus] >= 0) {   /* started by the button: its own full length from the press */
                total = (t->end - t->start) * 60;
                rem = logic_run_remaining(n, p, app.focus, app.now_s);
            }
            timed(v, left, rem, total, PILL_CALM);
            if (left < 10) v->sides = false;
        }
        if (n->overdue) v->sides = false;
        if (t->nsteps && app.steps[app.focus] < t->nsteps) {
            /* the steps as a checklist that turns, the one now in the middle, no room (Figma Morning ·
             * Get dressed, the same as Going out · Get ready); the button or a tap ticks it */
            v->mid = MID_STEPS;
            v->sides = false;
            v->steps_total = (int8_t)t->nsteps;
            v->steps_done = (int8_t)app.steps[app.focus];
            for (int i = 0; i < t->nsteps && i < HOME_STEPS_MAX; i++) snprintf(v->step_text[i], sizeof v->step_text[i], "%s", t->steps[i].text);
        }
        next_from(v, -1);
        /* Figma: his greeting at wake-up and dinner only, as the task starts */
        bool greets = t->system == SYS_WAKE || t->system == SYS_DINNER || strstr(k, "wake") || strstr(k, "morning") || strstr(k, "dinner") || t->say[0];
        if (!n->overdue && v->card == CARDPOS_NONE && v->graphic == GRAPHIC_FULL && greets) {
            snprintf(buf, sizeof buf, "task:%s", t->id);
            char tmp[64];
            say(buf, prompt_for(t, tmp, sizeof tmp), SAY_MS);
        }
        break;
    }
    case ST_DONE: {
        snprintf(v->icon, sizeof v->icon, "%s", t->icon);
        snprintf(v->title, sizeof v->title, "%s", t->title);
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "Done!");
        snprintf(v->status_icon, sizeof v->status_icon, "check");
        v->pill_tone = PILL_DONE;
        v->force_clip = PET_CLIP_CELEBRATE;
        /* done early: the next task can start now; a press while the offer lasts pulls it forward */
        if (app.done_next >= 0 && logic_can_pull(p, app.done_next, app.now_s)) {
            snprintf(buf, sizeof buf, "Press for %s", p->tasks[app.done_next].title);
            button_note(v, "timer", buf);
            next_from(v, app.done_next);
        } else {
            next_from(v, -1);
            snprintf(v->say, sizeof v->say, "Great job!");
        }
        break;
    }
    case ST_WAIT_START: {
        /* waiting for the button: the timer full and still, the full length ahead */
        snprintf(v->icon, sizeof v->icon, "%s", t->icon);
        snprintf(v->title, sizeof v->title, "%s", t->title);
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "%d min \xC2\xB7 waiting", t->end - t->start);
        snprintf(v->status_icon, sizeof v->status_icon, "clock");
        v->timer_show = true;
        v->timer_tone = TIMER_PLENTY;
        v->timer_left = 1000;
        v->mood = PET_MOOD_HAPPY;
        v->force_clip = PET_CLIP_CURIOUS;
        const reserve_t *r = &n->reserve;
        if (r->free_reserve && r->reserve_remaining < r->reserve_total) {
            /* the wait is eating the day the way running late does */
            late(v);
            v->late_chip = false;
            snprintf(v->overdue_text, sizeof v->overdue_text, "Waiting is eating up your free time");
            v->worm_eaten = (uint8_t)(5 - (r->reserve_remaining * 5 + r->reserve_total - 1) / (r->reserve_total ? r->reserve_total : 1));
            snprintf(v->worm_icon, sizeof v->worm_icon, "kite");
        } else if (!r->free_reserve && r->reserve_task >= 0) {
            late(v);
            v->late_chip = false;
            snprintf(v->overdue_text, sizeof v->overdue_text, "Waiting is taking time from %s", p->tasks[r->reserve_task].title);
            v->worm_eaten = 5;
            snprintf(v->worm_icon, sizeof v->worm_icon, "%s", p->tasks[r->reserve_task].icon[0] ? p->tasks[r->reserve_task].icon : "clock");
        }
        button_note(v, "timer", "Press to start");
        next_from(v, -1);
        break;
    }
    case ST_EVENT_PREP:
    case ST_EVENT_READY: {
        bool ready = app.state == ST_EVENT_READY;
        char shortname[24];
        first_word(shortname, sizeof shortname, t->title);
        int mins = t->event_start - now_m;
        snprintf(v->icon, sizeof v->icon, "backpack");
        snprintf(v->title, sizeof v->title, ready ? "You\xE2\x80\x99re ready!" : "Get ready");
        snprintf(v->status, sizeof v->status, "%s in %d min", shortname, mins);
        v->below = BELOW_TIME;
        snprintf(v->status_icon, sizeof v->status_icon, "%s", ready ? "check" : t->icon);
        int32_t total = (t->event_start - n->start[app.focus]) * 60, rem = t->event_start * 60 - app.now_s;
        timed(v, mins, rem, total, PILL_CALM);
        if (ready) v->pill_tone = PILL_DONE;
        v->mood = PET_MOOD_HAPPY;
        v->activity = PET_ACT_NONE;
        if (ready && (int32_t)(now_ms() - app.ready_until) < 0) v->force_clip = PET_CLIP_CELEBRATE;
        else if (!ready) v->force_clip = PET_CLIP_ENCOURAGE;
        if (!ready && t->nsteps) {
            /* the checklist turns like a wheel: the step done above, this one, the next below */
            v->mid = MID_STEPS;
            v->sides = false;
            v->steps_total = (int8_t)t->nsteps;
            v->steps_done = (int8_t)app.steps[app.focus];
            for (int i = 0; i < t->nsteps && i < HOME_STEPS_MAX; i++) snprintf(v->step_text[i], sizeof v->step_text[i], "%s", t->steps[i].text);
        }
        app.say[0] = 0;   /* Figma Going out: no bubble; the note and the pill say it */
        next_from(v, app.focus);
        break;
    }
    case ST_EVENT: {
        snprintf(v->icon, sizeof v->icon, "%s", t->icon);
        snprintf(v->title, sizeof v->title, "%s", t->title);
        v->below = BELOW_TIME;
        int left = logic_minutes_left(n, p, app.focus, app.now_s);
        snprintf(v->status, sizeof v->status, "%d min left", left);
        snprintf(v->status_icon, sizeof v->status_icon, "timer");
        int32_t total = (t->end - t->event_start) * 60, rem = t->end * 60 - app.now_s;
        timed(v, left, rem, total, PILL_CALM);
        v->activity = activity_for(t);
        if (n->nstill) v->chores_left = (int8_t)(n->nstill > 99 ? 99 : n->nstill);   /* the note opens Other things to finish */
        next_from(v, -1);
        break;
    }
    case ST_FREE: {
        int32_t rem = n->free_remaining, total = n->free_total;
        int left = (int)((rem + 59) / 60);
        snprintf(v->icon, sizeof v->icon, "kite");
        snprintf(v->title, sizeof v->title, "Free time");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "%d min left", left);
        snprintf(v->status_icon, sizeof v->status_icon, "kite");
        timed(v, left, rem, total, PILL_DONE);
        bool can_play = rem - GET_READY_S > 0;
        const day_task_t *nx = n->nupcoming ? &p->tasks[n->upcoming[0]] : NULL;
        next_from(v, -1);
        if (!can_play) {
            /* the last five minutes (Figma Free time · Last 5 minutes) */
            v->mood = PET_MOOD_EXCITED;
            v->force_clip = PET_CLIP_CURIOUS;
            (void)nx;
        } else if (total > WHEEL_MIN_S && !app.free_pet_view) {
            /* Figma Free time · Spin: the pill alone over the wheel, Games on the hill */
            v->hide_title = true;
            v->clock_line[0] = 0;
            v->mid = MID_WHEEL;
            v->bottom = BOTTOM_GAMES;
            v->dots = false;
        } else {
            /* Figma Free time · Play with Biscuit: the clock and the pill, his room, tap him to play */
            v->hide_title = true;
            v->activity = app.free_act;
            snprintf(v->say, sizeof v->say, "Tap to play!");
        }
        if (nx && logic_can_pull(p, n->upcoming[0], app.now_s) && v->card == CARDPOS_NONE && !v->hide_title && can_play) {
            snprintf(buf, sizeof buf, "Press to start %s", nx->title);
            button_note(v, "timer", buf);
        }
        break;
    }
    case ST_WAITING:
        snprintf(v->icon, sizeof v->icon, "clock");
        snprintf(v->title, sizeof v->title, "Time to relax");
        snprintf(v->status, sizeof v->status, "Nothing to do right now");
        v->mood = n->drowsy ? PET_MOOD_DROWSY : PET_MOOD_HAPPY;
        next_from(v, -1);
        break;
    case ST_ALARM: {
        snprintf(v->icon, sizeof v->icon, "sun");
        snprintf(v->title, sizeof v->title, "Good morning!");
        v->below = BELOW_TIME;
        fmt_clock(v->status, sizeof v->status, n->wake);
        snprintf(v->status_icon, sizeof v->status_icon, "alarm");
        v->mood = PET_MOOD_DROWSY;
        v->wake = true;
        v->sides = v->dots = false;
        break;
    }
    case ST_SNOOZE: {
        int32_t left = app.snooze_until - app.now_s;
        if (left < 0) left = 0;
        snprintf(v->icon, sizeof v->icon, "cloudmoon");
        snprintf(v->title, sizeof v->title, "5 more minutes");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "%d:%02d left", (int)(left / 60), (int)(left % 60));
        snprintf(v->status_icon, sizeof v->status_icon, "timer");
        timed(v, (int)(left / 60), left, SNOOZE_S, PILL_CALM);
        v->mood = PET_MOOD_EXCITED;
        v->wake = true;
        v->sides = v->dots = false;
        break;
    }
    case ST_IM_UP:
        snprintf(v->icon, sizeof v->icon, "sun");
        snprintf(v->title, sizeof v->title, "You\xE2\x80\x99re up!");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "Let\xE2\x80\x99s go!");
        snprintf(v->status_icon, sizeof v->status_icon, "check");
        v->pill_tone = PILL_DONE;
        v->force_clip = PET_CLIP_CELEBRATE;
        next_from(v, -1);
        break;
    case ST_SCHOOL_OFF: {
        char e[8];
        ui_fmt_time(e, sizeof e, t->end);
        snprintf(v->icon, sizeof v->icon, "backpack");
        snprintf(v->title, sizeof v->title, "Off to school!");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "See you at %s", e);
        snprintf(v->status_icon, sizeof v->status_icon, "house");
        v->force_clip = PET_CLIP_WAVE;
        say("school-off", "Bye! Have a great day!", 600000);
        next_from(v, -1);
        break;
    }
    case ST_SCHOOL: {
        /* quiet hours: Biscuit reading, nothing to tap */
        char e[8];
        ui_fmt_time(e, sizeof e, t->end);
        snprintf(v->icon, sizeof v->icon, "backpack");
        snprintf(v->title, sizeof v->title, "At school");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "Back at %s", e);
        snprintf(v->status_icon, sizeof v->status_icon, "house");
        v->activity = PET_ACT_READING;
        next_from(v, -1);
        break;
    }
    case ST_WELCOME:
        snprintf(v->icon, sizeof v->icon, "house");
        snprintf(v->title, sizeof v->title, "Welcome home!");
        v->force_clip = PET_CLIP_ENCOURAGE;
        say("welcome", "How was school?", 600000);
        next_from(v, -1);
        break;
    case ST_BED_SOON: {
        int nx = n->upcoming[0];
        int32_t left = n->start[nx] * 60 - app.now_s;
        int mins = (int)((left + 59) / 60);
        snprintf(v->icon, sizeof v->icon, "moon");
        snprintf(v->title, sizeof v->title, "Bedtime soon");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "Starts in %d min", mins);
        snprintf(v->status_icon, sizeof v->status_icon, "timer");
        timed(v, mins, left, BED_SOON_S, PILL_CALM);
        v->mood = PET_MOOD_DROWSY;
        v->wake = true;   /* his bedroom */
        next_from(v, nx);
        break;
    }
    case ST_BEDTIME:
    case ST_DAY_OVER: {
        bool over = app.state == ST_DAY_OVER;
        if (hal_docked()) { night_clock(v); break; }   /* on its dock: the night clock, from Goodnight on */
        snprintf(v->icon, sizeof v->icon, "moon");
        snprintf(v->title, sizeof v->title, "Goodnight, %s!", p->child.name);
        snprintf(v->status, sizeof v->status, over ? "Sleep tight" : "Time to rest");
        v->mood = PET_MOOD_SLEEP;
        v->pet_dim = over ? 90 : 0;
        if (!over) snprintf(v->say, sizeof v->say, "See you tomorrow!");
        v->sides = v->dots = false;
        break;
    }
    case ST_SLEEPY: {
        if (hal_docked()) { night_clock(v); break; }
        int to_wake = n->wake - now_m;
        char w[8];
        ui_fmt_time(w, sizeof w, n->wake);
        v->below = BELOW_TIME;
        v->pill_tone = PILL_NIGHT;
        snprintf(v->status, sizeof v->status, "Wake up at %s", w);
        snprintf(v->status_icon, sizeof v->status_icon, "alarm");
        if (to_wake > 60) {
            /* picked up in the night (Figma Wind down · Woke in the night) */
            snprintf(v->icon, sizeof v->icon, "cloudmoon");
            snprintf(v->title, sizeof v->title, "Still night");
            v->pet_dim = 90;
        } else {
            snprintf(v->icon, sizeof v->icon, "moon");
            snprintf(v->title, sizeof v->title, "Still sleepy time");
        }
        v->mood = PET_MOOD_SLEEP;
        v->sides = v->dots = false;
        break;
    }
    case ST_ALL_DONE:
    case ST_FREE_DAY:
    case ST_REST: {
        bool rest = app.state == ST_REST, all = app.state == ST_ALL_DONE;
        snprintf(v->icon, sizeof v->icon, rest ? "house" : all ? "party" : "sun");
        snprintf(v->title, sizeof v->title, rest ? "Cozy rest day" : all ? "All done for today!" : "A free day!");
        snprintf(v->status, sizeof v->status, rest ? "No plans today" : all ? "Nice work" : "Nothing planned today");
        v->mood = all ? PET_MOOD_EXCITED : PET_MOOD_HAPPY;
        v->activity = rest ? PET_ACT_READING : all ? PET_ACT_NONE : PET_ACT_OUTSIDE;
        if (all) v->force_clip = PET_CLIP_CELEBRATE;
        /* Figma Quiet days: his words beside him; a free day is a tap away from Playtime */
        if (rest) snprintf(v->say, sizeof v->say, "Take it easy today");
        else if (all) snprintf(v->say, sizeof v->say, "You did it, %s!", p->child.name);
        else snprintf(v->say, sizeof v->say, "Tap me to play!");
        break;
    }
    default:
        break;
    }
    if (p->child.picture) picture_view(v);
    if (!p->child.picture && app.say[0] && app.state != ST_DONE && !v->say[0] && (int32_t)(now_ms() - app.say_until) < 0) snprintf(v->say, sizeof v->say, "%s", app.say);
}

/* ================================================================ the clock */
static void request_plan(void)
{
    app.fetching = true;
    app.requested = true;
    app.last_fetch = now_ms();
    hal_request_day();
}

static void speak_state(state_t to)
{
    if (!app.plan->child.picture) return;
    char line[96];
    const day_task_t *t = app.focus >= 0 ? &app.plan->tasks[app.focus] : NULL;
    switch (to) {
    case ST_BEDTIME: hal_speak("Time for bed. Goodnight!"); break;
    case ST_EVENT_PREP: snprintf(line, sizeof line, "Time to get ready for %s!", t->title); hal_speak(line); break;
    case ST_EVENT: snprintf(line, sizeof line, "Time for %s. Have fun!", t->title); hal_speak(line); break;
    case ST_TASK: snprintf(line, sizeof line, "Time for %s!", t->title); hal_speak(line); break;
    case ST_WAIT_START: snprintf(line, sizeof line, "%s is waiting. Press the button to start.", t->title); hal_speak(line); break;
    case ST_DONE: hal_speak("Yay!"); break;
    default: break;
    }
}

static void read_out(void)
{
    char line[128];
    const day_task_t *t = app.focus >= 0 ? &app.plan->tasks[app.focus] : NULL;
    if (!t) return;
    int st = app.steps[app.focus];
    if (app.state == ST_EVENT_PREP && t->nsteps && st < t->nsteps) snprintf(line, sizeof line, "Get ready for %s. Next step: %s", t->title, t->steps[st].text);
    else if (app.state == ST_EVENT) snprintf(line, sizeof line, "Have fun at %s!", t->title);
    else if (t->nsteps && st < t->nsteps) snprintf(line, sizeof line, "%s. Next step: %s", t->title, t->steps[st].text);
    else snprintf(line, sizeof line, "%s", t->title);
    hal_speak(line);
}

static void on_state_change(state_t from, state_t to)
{
    speak_state(to);
    app.say[0] = 0; /* a new screen: Biscuit says something new, or nothing */
    (void)from;
    if (to == ST_BEDTIME) hal_play(HAL_SOUND_BEDTIME);
    if (to == ST_ALARM) { hal_play(HAL_SOUND_CHIME); app.alarm_chirp_s = app.now_s; }
    if (to == ST_WELCOME || to == ST_SCHOOL_OFF) hal_play(HAL_SOUND_START);
    if (to == ST_BED_SOON) { hal_play(HAL_SOUND_SOON); pet_react(home_pet(), PET_CLIP_SLEEPY); }   /* a yawn */
    if (to == ST_FREE || to == ST_ALL_DONE) app.free_act = pet_pick_free_time_activity();
    /* a little joy on the day's wins */
    if (to == ST_DONE) home_celebrate(HOME_FX_DONE);
    if (from != ST_NONE && (to == ST_EVENT_READY || to == ST_ALL_DONE)) home_celebrate(HOME_FX_BIG);
    if (to == ST_IM_UP || to == ST_WELCOME) home_celebrate(HOME_FX_SPARKLE);
}

/* The panel: dim at night and at school, darker on the dock, the sunrise over the alarm's first minute. */
static void brightness(void)
{
    uint8_t b = 100;
    switch (app.state) {
    case ST_SLEEPY: case ST_DAY_OVER: b = hal_docked() ? 20 : 35; break;
    case ST_BEDTIME: b = 60; break;
    case ST_SNOOZE: b = 45; break;
    case ST_SCHOOL: b = 50; break;
    case ST_BED_SOON: b = 80; break;
    case ST_ALARM: { int32_t s = app.now_s - app.now.wake * 60; b = (uint8_t)(s >= 60 ? 100 : s < 0 ? 35 : 35 + s * 65 / 60); break; }
    default: break;
    }
    if (b != app.brightness) { app.brightness = b; hal_set_brightness(b); }
}

static void tick(lv_timer_t *timer)
{
    (void)timer;
    hal_time_now(&app.t);
    snprintf(app.today, sizeof app.today, "%04d-%02d-%02d", app.t.year, app.t.month, app.t.day);
    app.now_s = app.t.hour * 3600 + app.t.minute * 60 + app.t.second;
    ui_set_clock(app.now_s / 60);

    if (app.hello_until && (int32_t)(now_ms() - app.hello_until) >= 0) {
        app.hello_until = 0;
        system_show(SYS_SCREEN_NONE, NULL, NULL);
    }
    if (!app.have_plan) {
        if (!app.fetching && (int32_t)(now_ms() - app.retry_at) >= 0) on_retry(0);
        return;
    }
    /* the clock jumped back (a simulator jump, or a correction): the morning starts over */
    if (app.now_s < app.last_now_s - 60) {
        app.alarm_ack = app.welcome_ack = false;
        app.snoozes = 0;
        app.snooze_until = 0;
        app.imup_until = 0;
        save_progress();
    }
    app.last_now_s = app.now_s;
    /* the battery: a nudge at 10% and again at 5%, gone as soon as it's on the dock */
    int bat = hal_battery();
    if (hal_docked() || bat > 10) {
        if (battery_is_open()) battery_close();
        if (bat > 10) app.battery_shown = 0;
    } else {
        int step = bat <= 5 ? 5 : 10;
        if (app.battery_shown != step) { app.battery_shown = step; battery_open(bat); }
    }
    /* a new day, or time to look for changes (at most once a minute, in case the clock and the plan disagree) */
    uint32_t since = now_ms() - app.last_fetch;
    if (!app.fetching && ((strcmp(app.today, app.plan->date) && since > 60000) || since > REFRESH_MS)) request_plan();

    logic_now(app.plan, app.now_s, &app.now);
    app.state = derive();
    if (app.state != app.last_state) {
        on_state_change(app.last_state, app.state);
        app.last_state = app.state;
    }
    /* a new task starts */
    int cur = app.now.current;
    if (cur != app.last_current) {
        if (cur >= 0 && app.last_current != -2 && app.state == ST_TASK) hal_play(HAL_SOUND_START);
        app.last_current = cur;
    }
    /* a new free-time window */
    if (app.state == ST_FREE) {
        int32_t win = app.now_s - (app.now.free_total - app.now.free_remaining);
        if (labs(win - app.free_window) > 90) {
            app.free_window = win;
            app.free_pet_view = false;
            app.pet_view_at = 0;
            app.reminded = false;
            app.free_act = pet_pick_free_time_activity();
            home_wheel_reset();
        }
        if (app.pet_view_at && (int32_t)(now_ms() - app.pet_view_at) >= 0) { app.pet_view_at = 0; app.free_pet_view = true; }
        /* once per window, five minutes before the next thing */
        if (!app.reminded && app.now.free_remaining <= GET_READY_S && app.now.free_total > GET_READY_S && app.now.nupcoming) {
            app.reminded = true;
            if (!play_is_open()) {
                const day_task_t *nx = &app.plan->tasks[app.now.upcoming[0]];
                char at[8];
                ui_fmt_time(at, sizeof at, nx->event ? nx->event_start : app.now.start[app.now.upcoming[0]]);
                reminder_open(nx->icon, nx->title, at, app.now.free_remaining, app.plan->child.picture);
            }
        }
    }
    if (play_is_open()) play_set_time_left(app.state == ST_FREE ? app.now.free_remaining - GET_READY_S : 0);
    if (reminder_is_open()) reminder_update(app.now.free_remaining);

    /* the alarm sounds again every minute for the first five */
    if (app.state == ST_ALARM && app.now_s - app.alarm_chirp_s >= 60 && app.now_s - app.now.wake * 60 < ALARM_CHIRPS_S) {
        app.alarm_chirp_s = app.now_s;
        hal_play(HAL_SOUND_START);
    }
    brightness();
    bool locked = app.state == ST_SLEEPY || app.state == ST_DAY_OVER || app.state == ST_ALARM || app.state == ST_SNOOZE
               || app.state == ST_IM_UP || app.state == ST_SCHOOL_OFF || app.state == ST_SCHOOL;
    set_night_lock(locked, app.state == ST_BEDTIME);

    home_view_t v;
    build_view(&v);
    home_render(&v);
    if (app.fresh) { pet_skip_intro(home_pet()); app.fresh = false; }
    pet_set_paused(home_pet(), app.page != 1 || v.mid != MID_PET || play_is_open());
    chores_page_visible(app.page == 2);
    rewards_page_render(app.plan, available_stars(), app.plan->child.picture);
    chores_page_render(app.plan, app.now_s / 60, app.plan->child.picture);
    if (others_is_open()) others_refresh(app.plan, &app.now);

    /* left on a side page: drift back home */
    if (lv_display_get_inactive_time(NULL) > IDLE_HOME_MS) {
        if (app.page != 1) go_page(1, true);
        if (schedule_is_open() || others_is_open()) overlays_close_idle();
    }
}

/* ================================================================ entry points */
void mytoki_start(void)
{
    memset(&app, 0, sizeof app);
    app.plan = lv_malloc_zeroed(sizeof(day_plan_t));
    app.done_task = -1;
    app.ready_task = -1;
    app.last_current = -2;
    app.page = 1;
    app.free_window = -100000;

    swipe_init();
    swipe_set_base(on_base_swipe);
    pet_set_on_land(on_land_sparks, NULL);
    lv_obj_t *scr = lv_screen_active();
    lv_obj_set_style_bg_color(scr, COL(C_INK), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_remove_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    app.carousel = ui_box(scr);
    lv_obj_set_size(app.carousel, SCREEN_W, SCREEN_H);
    /* clickable, so a drag that starts on an empty part of a page still moves the pages */
    lv_obj_add_flag(app.carousel, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_ONE | LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_scroll_dir(app.carousel, LV_DIR_HOR);
    lv_obj_set_scroll_snap_x(app.carousel, LV_SCROLL_SNAP_CENTER);
    lv_obj_set_scrollbar_mode(app.carousel, LV_SCROLLBAR_MODE_OFF);
    lv_obj_remove_flag(app.carousel, LV_OBJ_FLAG_SCROLL_ELASTIC);
    lv_obj_set_flex_flow(app.carousel, LV_FLEX_FLOW_ROW);
    lv_obj_add_event_cb(app.carousel, on_scroll_end, LV_EVENT_SCROLL_END, NULL);
    lv_obj_t **pages[3] = { &app.pg_rewards, &app.pg_home, &app.pg_chores };
    for (int i = 0; i < 3; i++) {
        *pages[i] = ui_box(app.carousel);
        lv_obj_set_size(*pages[i], SCREEN_W, SCREEN_H);
        lv_obj_add_flag(*pages[i], LV_OBJ_FLAG_SNAPPABLE);
    }
    rewards_page_create(app.pg_rewards, on_reward_tap);
    home_create(app.pg_home, on_home);
    chores_page_create(app.pg_chores, on_chore);
    go_page(1, false);

    {
        /* Figma Connection · Loading: "Hello, Amira!" once Biscuit has met her */
        char known[40], hello[56] = "";
        if (hal_store_get("name", known, sizeof known) && known[0]) snprintf(hello, sizeof hello, "Hello, %s!", known);
        system_show(SYS_SCREEN_LOADING, hello[0] ? hello : NULL, NULL);
    }
    lv_timer_create(tick, TICK_MS, NULL);
    request_plan();
}

void mytoki_day_received(const char *json, size_t len)
{
    app.fetching = false;
    hal_time_now(&app.t);
    ui_set_clock(app.t.hour * 60 + app.t.minute);   /* screens that open with the plan show the time too */
    day_plan_t *p = lv_malloc(sizeof(day_plan_t));
    if (!p) return;
    if (!day_parse(json, len, p)) {
        lv_free(p);
        if (!app.have_plan) system_show(SYS_SCREEN_ERROR, "The day plan from the server could not be read.", on_retry);
        return;
    }
    if (!p->date[0]) snprintf(p->date, sizeof p->date, "%s", app.today);
    /* keep step ticks and the "Done!" hold across a refresh */
    char done_id[40] = "";
    if (app.have_plan && app.done_task >= 0) snprintf(done_id, sizeof done_id, "%s", app.plan->tasks[app.done_task].id);
    apply_progress(p);
    lv_free(app.plan);
    app.plan = p;
    if (done_id[0]) app.done_task = day_task_index(p, done_id);
    bool first = !app.have_plan;
    app.have_plan = true;
    app.school_task = -1;
    for (int i = 0; i < p->ntasks; i++) if (p->tasks[i].system == SYS_SCHOOL) { app.school_task = i; break; }

    pet_set_personality(p->child.id);
    int head = pet_acc_by_name(p->child.outfit[0]), face = pet_acc_by_name(p->child.outfit[1]), neck = pet_acc_by_name(p->child.outfit[2]);
    char kept[32];
    if (hal_store_get("outfit", kept, sizeof kept)) {
        int h = -1, f = -1, n = -1;
        if (sscanf(kept, "%d,%d,%d", &h, &f, &n) == 3) {
            if (h == head && f == face && n == neck) hal_store_set("outfit", "");
            else if (kept[0]) { head = h; face = f; neck = n; }
        }
    }
    pet_set_outfit(head, face, neck);
    /* the child's character and colour; a choice made here stays until the plan has it */
    int ch = pet_char_by_id(p->child.character);
    if (ch < 0) ch = 0;   /* a character the device does not draw yet shows as Biscuit */
    int col = pet_colour_by_name(ch, p->child.color);
    if (hal_store_get("character", kept, sizeof kept)) {
        int c = -1, k = -1;
        if (sscanf(kept, "%d,%d", &c, &k) == 2) {
            if (c == ch && k == col) hal_store_set("character", "");
            else if (kept[0] && c >= 0 && c < PET_CHAR_COUNT) { ch = c; col = k; }
        }
    }
    pet_set_character(ch, col);
    snprintf(p->child.pet, sizeof p->child.pet, "%s", pet_chars[ch].name);
    home_set_wheel((const char (*)[20])p->wheel, p->nwheel);
    hal_store_set("name", p->child.name);
    if (system_showing() == SYS_SCREEN_PAIRING) {
        /* paired: Biscuit learns the child's name, then the day loads */
        char hello[48];
        snprintf(hello, sizeof hello, "Hi, %s!", p->child.name);
        system_show(SYS_SCREEN_NONE, NULL, NULL);
        system_show(SYS_SCREEN_LOADING, hello, NULL);
        app.hello_until = now_ms() + HELLO_MS;
        hal_play(HAL_SOUND_CHIME);
    } else if (system_showing() != SYS_SCREEN_NONE) system_show(SYS_SCREEN_NONE, NULL, NULL);
    if (first) { app.last_state = ST_NONE; app.fresh = true; }
    ui_set_picture(p->child.picture);
    check_news(p);
    tick(NULL);
}

/* The four digits a grown-up types into the app; kept until the device is paired. */
static const char *pair_code(void)
{
    static char code[8];
    if (!code[0] && !hal_store_get("pair_code", code, sizeof code)) {
        uint32_t r = hal_random() % 10000;
        snprintf(code, sizeof code, "%02u %02u", (unsigned)(r / 100), (unsigned)(r % 100));
        hal_store_set("pair_code", code);
    }
    return code;
}

void mytoki_day_failed(int reason)
{
    app.fetching = false;
    if (app.have_plan) return; /* keep going with what we have */
    app.retry_at = now_ms() + OFFLINE_RETRY_MS;
    if (reason == 3) { system_show(SYS_SCREEN_PAIRING, pair_code(), on_retry); return; }
    system_show(reason == 0 ? SYS_SCREEN_OFFLINE : SYS_SCREEN_ERROR,
                reason == 0 ? NULL : "The server did not answer.", on_retry);
}

void mytoki_motion(float ax, float ay, float az)
{
    motion_push(ax, ay, az, lv_tick_get());
}

void mytoki_button(void)
{
    if (!app.have_plan) return;
    if (reminder_is_open()) return;
    if (play_is_open()) { play_button(); return; }   /* Biscuit says: "Button" */
    const int f = app.focus;
    switch (app.state) {
    case ST_TASK: {
        day_task_t *t = &app.plan->tasks[f];
        if (t->fun) return;
        if (schedule_is_open()) overlays_close_all();
        go_page(1, true);
        if (t->nsteps && app.steps[f] < t->nsteps) {
            app.steps[f]++;
            save_progress();
            if (app.steps[f] < t->nsteps) {
                hal_play(HAL_SOUND_TICK);
                pet_react(home_pet(), PET_CLIP_ENCOURAGE);
                break;
            }
        }
        /* finished: Biscuit cheers for 3 seconds, then it's marked done. Done early with a next task
         * that can move: 5 seconds, with the ring at the button, to start it now instead */
        app.done_task = f;
        app.done_press_s = app.now_s;
        app.done_saved = logic_minutes_left(&app.now, app.plan, f, app.now_s);
        app.done_next = -1;
        for (int k = 0; k < app.now.nupcoming; k++) {
            int nx = app.now.upcoming[k];
            if (nx == f) continue;
            if (logic_can_pull(app.plan, nx, app.now_s)) app.done_next = nx;
            break;
        }
        app.done_hold = app.done_saved > 0 && app.done_next >= 0 ? DONE_OFFER_MS : DONE_HOLD_MS;
        app.done_until = now_ms() + app.done_hold;
        hal_play(HAL_SOUND_DONE);
        break;
    }
    case ST_WAIT_START: {
        /* Start: its full time runs from this moment */
        day_task_t *t = &app.plan->tasks[f];
        if (schedule_is_open()) overlays_close_all();
        go_page(1, true);
        t->started_at = app.now_s;
        send("task_start", "task_id", t->id, 0);
        hal_play(HAL_SOUND_START);
        pet_react(home_pet(), PET_CLIP_ENCOURAGE);
        break;
    }
    case ST_DONE: {
        /* a press before the ring is gone: the next task starts now, the ones behind it move up */
        if (app.done_next < 0 || !logic_can_pull(app.plan, app.done_next, app.now_s)) return;
        int nx = app.done_next;
        char id[40];
        snprintf(id, sizeof id, "%s", app.plan->tasks[nx].id);
        finish_task_at(app.done_task, app.done_press_s);
        app.done_task = -1;
        app.done_next = -1;
        logic_pull_forward(app.plan, nx, app.now_s);
        send("next_now", "task_id", id, 0);
        hal_play(HAL_SOUND_START);
        break;
    }
    case ST_FREE: {
        /* free time with a next task that can move: start it now */
        if (!app.now.nupcoming) return;
        int nx = app.now.upcoming[0];
        if (!logic_can_pull(app.plan, nx, app.now_s)) return;
        if (play_is_open()) return;
        char id[40];
        snprintf(id, sizeof id, "%s", app.plan->tasks[nx].id);
        logic_pull_forward(app.plan, nx, app.now_s);
        send("next_now", "task_id", id, 0);
        hal_play(HAL_SOUND_START);
        break;
    }
    case ST_EVENT_PREP: {
        day_task_t *t = &app.plan->tasks[f];
        if (!t->nsteps || app.steps[f] >= t->nsteps) return;
        go_page(1, true);
        app.steps[f]++;
        save_progress();
        if (app.steps[f] >= t->nsteps) {
            app.ready_task = f;
            app.ready_until = now_ms() + DONE_HOLD_MS;
            hal_play(HAL_SOUND_DONE);
        } else {
            hal_play(HAL_SOUND_TICK);
        }
        break;
    }
    case ST_ALARM:
    case ST_SNOOZE:
        /* I'm up: three seconds of cheering, then the day */
        app.imup_until = now_ms() + DONE_HOLD_MS;
        app.snooze_until = 0;
        hal_play(HAL_SOUND_DONE);
        break;
    case ST_WELCOME:
        app.welcome_ack = true;
        save_progress();
        hal_play(HAL_SOUND_TICK);
        break;
    default:
        return; /* no arc at 1 o'clock: the button does nothing */
    }
    tick(NULL);
}

void mytoki_debug(const char *cmd)
{
    if (!strcmp(cmd, "refresh")) { request_plan(); return; }
    if (!strcmp(cmd, "crash")) system_show(SYS_SCREEN_ERROR, NULL, on_retry);
}

/* Dress-up changed what he wears: tell the server, and keep it here until the plan has it. */
static void on_outfit(void)
{
    int o[3];
    pet_get_outfit(&o[0], &o[1], &o[2]);
    char json[200];
    snprintf(json, sizeof json, "{\"type\":\"outfit\",\"child_id\":\"%s\",\"outfit\":{\"head\":\"%s\",\"face\":\"%s\",\"neck\":\"%s\"}}",
             app.plan->child.id, o[0] >= 0 ? pet_acc_names[o[0]] : "", o[1] >= 0 ? pet_acc_names[o[1]] : "",
             o[2] >= 0 ? pet_acc_names[o[2]] : "");
    hal_send(json);
    char keep[64];
    snprintf(keep, sizeof keep, "%d,%d,%d", o[0], o[1], o[2]);
    hal_store_set("outfit", keep);
}

/* My buddy: the child picked a character or colour. Tell the server, and keep it here until the
 * plan has it. */
static void on_character(void)
{
    int ch, col;
    pet_get_character(&ch, &col);
    snprintf(app.plan->child.pet, sizeof app.plan->child.pet, "%s", pet_chars[ch].name);
    char json[200];
    snprintf(json, sizeof json, "{\"type\":\"character\",\"child_id\":\"%s\",\"pet_type\":\"%s\",\"pet_color\":\"%s\"}",
             app.plan->child.id, pet_chars[ch].id, col ? pet_chars[ch].colours[col].name : "");
    hal_send(json);
    char keep[16];
    snprintf(keep, sizeof keep, "%d,%d", ch, col);
    hal_store_set("character", keep);
}

/* Free time with more than the five get-ready minutes left: the games. */
void mytoki_open_playtime(void)
{
    if (play_is_open()) return;
    if (app.state != ST_FREE && app.state != ST_FREE_DAY) return;
    int32_t left = app.state == ST_FREE_DAY ? 3600 : app.now.free_remaining - GET_READY_S;   /* a free day: an hour at a time */
    if (left <= 0) return;
    const day_task_t *nx = app.now.nupcoming ? &app.plan->tasks[app.now.upcoming[0]] : NULL;
    char at[8] = "";
    if (nx) ui_fmt_time(at, sizeof at, nx->event ? nx->event_start : app.now.start[app.now.upcoming[0]]);
    play_open(left, nx ? nx->title : "", nx ? nx->icon : "", at, app.plan->child.pet, on_outfit, on_character);
    if (app.state == ST_FREE) play_set_time_total(app.now.free_total - GET_READY_S);
}
