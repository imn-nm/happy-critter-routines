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
#include "play/games.h"
#include "motion.h"
#include <ctype.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TICK_MS 250
#define REFRESH_MS (30 * 1000)     /* a parent's change (a new time, a task marked done) shows within this */
#define REFRESH_MAX_MS (5 * 60 * 1000)   /* while the server fails, each look waits twice as long, up to this */
#define OFFLINE_RETRY_MS 15000
#define OFFLINE_RETRY_MAX_MS (2 * 60 * 1000)   /* the same with no day yet ("Getting your day ready") */
#define DONE_HOLD_MS 3000
#define DONE_OFFER_MS 5000         /* done early: "Press for Homework" while the ring at the button shrinks */
#define SAY_MS 7000
#define STEPS_ALL_MS 2500         /* the last step checked: the list stays a moment before the room comes back */
#define STEPS_PEEK_MS 8000        /* "Steps done" tapped: the list again, to uncheck one */
#define SLEEP_MS 10000            /* put down this long (and not touched), the screen goes off */
#define SYNC_GRACE_S 120          /* what the child did here wins over a fresh plan this long (the server may not have it yet); then the plan, where a grown-up may have changed it, wins */
#define PET_VIEW_MS 6000            /* the spin's result stays this long, then Biscuit plays it */
#define GET_READY_S (5 * 60)
#define WHEEL_MIN_S (10 * 60)
#define IDLE_HOME_MS 45000
#define ALARM_RING_S 30            /* the alarm's tone again every half minute while it rings... */
#define ALARM_CHIRPS_S (15 * 60)   /* ...for a quarter of an hour (it stays on screen until the button) */
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
    uint16_t ticks[DAY_MAX_TASKS];   /* the steps checked, in any order: bit i = step i */
    int steps_peek;                  /* the task whose checked list shows again, or -1 */
    int32_t chore_at[DAY_MAX_CHORES]; /* when the child last checked or unchecked each chore here (s of the day), or -1 */
    char gift_seen[40];               /* the last grown-up's free time greeted */
    uint32_t steps_peek_until;
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
    uint32_t refresh_ms, retry_ms;   /* the waits now: longer while the server fails, back to the start once it answers */
    uint32_t plan_hash;         /* the last day received, to skip one that hasn't changed */
    int32_t reapply_until_s;    /* until then (s of the day) a day is laid over again even unchanged: something done here is in its grace */
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
    int32_t alarm_ring_s;       /* when it began ringing (again, after a snooze) */
    int school_task;            /* today's School row, or -1 */
    /* the device */
    uint32_t hello_until;       /* ms: "Hi, Amira!" after pairing */
    int battery_shown;          /* the last low-battery step shown (10, 5), or 0 */
    uint8_t brightness;
    int32_t last_now_s;         /* to notice the clock jumping back (the simulator's jumps) */
    /* the screen off when put down */
    bool screen_off, sleep_test;
    uint32_t touch_ms, awake_ms;    /* the last touch or press; the screen last came on */
    lv_obj_t *wake_catcher;         /* over everything while it's off: the touch that wakes it does nothing else */
} app;

static void screen_wake(void);
static void screen_init(void);

/* ---- a task's steps: checked in any order, and unchecked again ---- */
static uint16_t steps_mask(int f) { return (uint16_t)((1u << app.plan->tasks[f].nsteps) - 1); }
static bool steps_all(int f) { return app.plan->tasks[f].nsteps && (app.ticks[f] & steps_mask(f)) == steps_mask(f); }
static int steps_first_left(int f)
{
    for (int i = 0; i < app.plan->tasks[f].nsteps; i++)
        if (!(app.ticks[f] & (1u << i))) return i;
    return -1;
}
/* What the button checks: the step on the checklist's line, or the first one left if that's checked. */
static int steps_for_button(int f)
{
    int i = home_steps_current();
    if (i < 0 || i >= app.plan->tasks[f].nsteps || (app.ticks[f] & (1u << i))) i = steps_first_left(f);
    return i;
}

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
static const char *const LEARN[] = { "school", "class", "lesson", "learn", "read", "book", "story", NULL };
static const char *const HANDS[] = { "wash hands", "wash your hands", "wash my hands", "wash the hands", "washing hands", "hand wash", "handwash", NULL };
static const char *const SHOWER[] = { "shower", "bath", "bathtime", "wash hair", NULL };
static const char *const TIDY[] = { "tidy", "clean up", "clean room", "clean your room", "clean my room", "pick up", "put away",
    "chore", "chores", "dishes", "laundry", "make bed", "make the bed", "make your bed", "make my bed", "sweep", "vacuum", NULL };
static const char *const DRESS[] = { "get dressed", "getting dressed", "clothes", "uniform", "pyjamas", "pajamas", "pjs", "socks",
    "shoes", "coat", "jacket", NULL };
static const char *const WAKE[] = { "get up", "getting up", "im up", "i'm up", "good morning", NULL };
static const char *const MUSIC[] = { "piano", "keyboard", "music", "instrument", "violin", "guitar", "recorder", "drum", "ukulele",
    "cello", "flute", "trumpet", NULL };
static const char *const HOOPS[] = { "basketball", "netball", "shoot hoops", "hoops", NULL };
static const char *const HOMEWORK[] = { "homework", "study", "worksheet", "spelling", "math", "maths", "write", "writing", "journal", NULL };
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
    /* Before meals: "Wash hands before dinner", "Clean up after dinner". */
    for (const char *const *w = HANDS; *w; w++) if (strstr(n, *w)) return PET_ACT_HANDWASHING;
    if (any(n, SHOWER, false)) return PET_ACT_SHOWER;
    if (any(n, TIDY, true)) return PET_ACT_TIDYING;
    if (any(n, DRESS, false) || word(n, "dress", true)) return PET_ACT_DRESSING;
    if (any(n, WAKE, false) || word(n, "wake", true)) return PET_ACT_WAKING;
    for (const char *const *w = MEALS; *w; w++) if (strstr(n, *w)) return PET_ACT_EATING;
    /* Before sport and reading: "piano lesson", "basketball practice". */
    if (any(n, MUSIC, false)) return PET_ACT_MUSIC;
    if (any(n, HOOPS, false)) return PET_ACT_BASKETBALL;
    if (is_sports(n)) return PET_ACT_SPORTS;
    if (any(n, HOMEWORK, false)) return PET_ACT_HOMEWORK;
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

/* A length for the child to read: "45 min" under an hour, then "2 hr" or "3 hr 47 min". */
static const char *hr_min(char *dst, size_t n, int minutes)
{
    if (minutes < 60) snprintf(dst, n, "%d min", minutes);
    else if (minutes % 60 == 0) snprintf(dst, n, "%d hr", minutes / 60);
    else snprintf(dst, n, "%d hr %d min", minutes / 60, minutes % 60);
    return dst;
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
    cJSON *steps = cJSON_AddObjectToObject(root, "ticks");
    for (int i = 0; i < app.plan->ntasks; i++) {
        const day_task_t *t = &app.plan->tasks[i];
        if (t->done_at >= 0) cJSON_AddNumberToObject(done, t->id, t->done_at);
        if (app.ticks[i]) cJSON_AddNumberToObject(steps, t->id, app.ticks[i]);
    }
    /* chores checked or unchecked here: done or not, and when */
    cJSON *chores = cJSON_AddObjectToObject(root, "chores");
    for (int i = 0; i < app.plan->nchores; i++) {
        if (app.chore_at[i] < 0) continue;
        cJSON *c = cJSON_AddObjectToObject(chores, app.plan->chores[i].id);
        cJSON_AddBoolToObject(c, "done", app.plan->chores[i].done);
        cJSON_AddNumberToObject(c, "at", app.chore_at[i]);
    }
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

/* A step checked or unchecked: a tap on it does either, the button only checks. The last one
 * checked doesn't finish the task (the steps get Shower ready; then comes the shower): Biscuit cheers,
 * the list stays a moment, then "All done!" with the button lit, and one more press finishes it (the
 * time left becomes free time, or the next task starts early). At an event, all checked is "You're
 * ready!". */
static void set_step(int f, int i, bool on)
{
    if (f < 0 || i < 0 || i >= app.plan->tasks[f].nsteps) return;
    if (!!(app.ticks[f] & (1u << i)) == on) return;
    if (on) app.ticks[f] |= (uint16_t)(1u << i);
    else app.ticks[f] &= (uint16_t)~(1u << i);
    save_progress();
    if (app.state == ST_EVENT_PREP && steps_all(f)) {
        app.ready_task = f;
        app.ready_until = now_ms() + DONE_HOLD_MS;
        hal_play(HAL_SOUND_DONE);
        return;
    }
    if (on && steps_all(f)) {
        app.steps_peek = f;
        app.steps_peek_until = now_ms() + STEPS_ALL_MS;
    }
    hal_play(HAL_SOUND_TICK);
    if (on) pet_react(home_pet(), steps_all(f) ? PET_CLIP_CELEBRATE : PET_CLIP_ENCOURAGE);
}

/* What the child did on this device today, laid over a fresh plan. A task done or a chore checked or
 * unchecked here counts only for SYNC_GRACE_S (the server may not have heard yet); after that the
 * plan says, so a grown-up undoing it in the app undoes it here too. Steps are only kept here. */
static void apply_progress(day_plan_t *p, int32_t now_s)
{
    memset(app.ticks, 0, sizeof app.ticks);
    for (int i = 0; i < DAY_MAX_CHORES; i++) app.chore_at[i] = -1;
    app.steps_peek = -1;
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
            int32_t at = (int32_t)it->valuedouble;
            if (i >= 0 && p->tasks[i].done_at < 0 && now_s - at < SYNC_GRACE_S) p->tasks[i].done_at = at;
        }
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "steps")) {   /* (older: how many, in order) */
            int i = day_task_index(p, it->string), k = (int)it->valuedouble;
            if (i >= 0 && k > 0) app.ticks[i] = (uint16_t)((1u << LV_MIN(k, 16)) - 1);
        }
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "ticks")) {
            int i = day_task_index(p, it->string);
            if (i >= 0) app.ticks[i] = (uint16_t)it->valuedouble;
        }
        cJSON_ArrayForEach(it, cJSON_GetObjectItem(root, "chores")) {   /* (an older list of ids: past its grace) */
            const cJSON *at = cJSON_GetObjectItem(it, "at");
            if (!it->string || !cJSON_IsNumber(at)) continue;
            for (int i = 0; i < p->nchores; i++) {
                if (strcmp(p->chores[i].id, it->string)) continue;
                app.chore_at[i] = (int32_t)at->valuedouble;
                if (now_s - app.chore_at[i] < SYNC_GRACE_S) p->chores[i].done = cJSON_IsTrue(cJSON_GetObjectItem(it, "done"));
            }
        }
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

/* A grown-up's note (why stars came, why a reward was a no) is shown once: the ids of the ones
 * shown are kept here (store "notes"), and the server hears "note_seen" so it stops sending it. */
static bool note_known(const cJSON *notes, const char *id)
{
    const cJSON *it;
    cJSON_ArrayForEach(it, notes) if (cJSON_IsString(it) && !strcmp(it->valuestring, id)) return true;
    return false;
}

static void note_shown(cJSON *notes, const char *id, bool tell)
{
    cJSON_AddItemToArray(notes, cJSON_CreateString(id));
    while (cJSON_GetArraySize(notes) > 12) cJSON_DeleteItemFromArray(notes, 0);
    if (tell) send("note_seen", "note_id", id, 0);
}

/* Celebrations the child has already seen (approved rewards, streak stars). */
static void check_news(const day_plan_t *p)
{
    static char nbuf[640];
    cJSON *notes = hal_store_get("notes", nbuf, sizeof nbuf) ? cJSON_Parse(nbuf) : NULL;
    if (!cJSON_IsArray(notes)) { cJSON_Delete(notes); notes = cJSON_CreateArray(); }
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
        const char *nid = p->rewards[i].note_id;
        bool new_note = nid[0] && !note_known(notes, nid);
        if (known) {
            /* the reason came after the no: into the screen if it is still up, else the screen again */
            if (!new_note) continue;
            if (first) { note_shown(notes, nid, false); continue; }
            if (denied_set_note(p->rewards[i].id, p->rewards[i].note)) { note_shown(notes, nid, true); continue; }
            if (shown) continue;
            denied_open(&p->rewards[i], p->rewards[i].note, mytoki_open_rewards);
            note_shown(notes, nid, true);
            shown = true;
            continue;
        }
        cJSON_AddItemToArray(dn, cJSON_CreateString(p->rewards[i].id));
        while (cJSON_GetArraySize(dn) > 24) cJSON_DeleteItemFromArray(dn, 0);
        if (first) { if (new_note) note_shown(notes, nid, false); continue; }
        if (!shown) {
            denied_open(&p->rewards[i], p->rewards[i].note, mytoki_open_rewards);
            if (new_note) note_shown(notes, nid, true);
            shown = true;
        }
    }
    /* stars from a grown-up: the balance went up */
    const cJSON *seen_stars = cJSON_GetObjectItem(seen, "stars");
    int before_stars = cJSON_IsNumber(seen_stars) ? (int)seen_stars->valuedouble : -1;
    const char *sid = p->child.star_note_id;
    bool new_star_note = sid[0] && !note_known(notes, sid);
    if (before_stars >= 0 && p->child.stars > before_stars && !shown) {
        stars_open(p->child.stars - before_stars, p->child.stars, new_star_note ? p->child.star_note : "");
        if (new_star_note) note_shown(notes, sid, true);
        shown = true;
    } else if (new_star_note && (first || before_stars < 0)) {
        note_shown(notes, sid, false);
    } else if (new_star_note) {
        /* the reason came after the stars: into "You got a star!" if it is still up, else that again */
        if (stars_set_note(p->child.star_note)) note_shown(notes, sid, true);
        else if (!shown) {
            int n = p->child.star_note_stars > 0 ? p->child.star_note_stars : 1;
            stars_open(n, p->child.stars, p->child.star_note);
            note_shown(notes, sid, true);
            shown = true;
        }
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
    out = cJSON_PrintUnformatted(notes);
    if (out) { hal_store_set("notes", out); cJSON_free(out); }
    cJSON_Delete(notes);
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
/* The three round screens are stacked like a little pyramid: the one in front is full size on
 * top, the ones beside it sit lower, smaller and dimmer, each clipped to its circle. As the finger
 * drags, or the turn plays, every page is drawn by how far it is from the middle, so the leaving
 * page sinks back while the coming one rises into place. At rest a page is drawn plain (no
 * layer, no clipping): this costs only while something moves. */
#define DEPTH_SHRINK 0.22f   /* a page one screen away is 78 % */
#define DEPTH_DROP 36        /* ...and sits this much lower */
#define DEPTH_FADE 0.45f     /* ...at 55 % */

static void carousel_depth(lv_event_t *e)
{
    (void)e;
    if (!UI_DEPTH) return;
    int32_t sx = lv_obj_get_scroll_x(app.carousel);
    lv_obj_t *pages[3] = { app.pg_rewards, app.pg_home, app.pg_chores };
    int slot = 0;
    for (int i = 0; i < 3; i++) {
        lv_obj_t *pg = pages[i];
        if (lv_obj_has_flag(pg, LV_OBJ_FLAG_HIDDEN)) continue;
        float t = (float)(slot * SCREEN_W - sx) / SCREEN_W;   /* 0 in the middle, 1 a screen to the right */
        slot++;
        float ad = fminf(fabsf(t), 1.0f);
        bool moving = ad > 0.002f;
        int32_t s = moving ? (int32_t)lroundf(256 * (1.0f - DEPTH_SHRINK * ad)) : 256;
        int32_t drop = moving ? (int32_t)lroundf(DEPTH_DROP * ad) : 0;
        lv_opa_t o = moving ? (lv_opa_t)lroundf(255 * (1.0f - DEPTH_FADE * ad)) : LV_OPA_COVER;
        if (lv_obj_get_style_transform_scale_x(pg, 0) != s) lv_obj_set_style_transform_scale(pg, s, 0);
        if (lv_obj_get_style_translate_y(pg, 0) != drop) lv_obj_set_style_translate_y(pg, drop, 0);
        if (lv_obj_get_style_opa_layered(pg, 0) != o) lv_obj_set_style_opa_layered(pg, o, 0);
        if (lv_obj_get_style_clip_corner(pg, 0) != moving) lv_obj_set_style_clip_corner(pg, moving, 0);
        float pt = moving ? t : 0.0f;
        if (pg == app.pg_home) home_parallax(pt);
        else if (pg == app.pg_rewards) rewards_page_parallax(pt);
        else chores_page_parallax(pt);
    }
}

/* The turn itself: our own animation (LVGL's snap is replaced), quick off the mark and soft to
 * land, its length by how far there is still to go. SCROLL_END is sent as it lands, as LVGL would. */
static void carousel_x(void *obj, int32_t v) { lv_obj_scroll_to_x(obj, v, LV_ANIM_OFF); }
static void carousel_landed(lv_anim_t *a) { lv_obj_send_event(a->var, LV_EVENT_SCROLL_END, NULL); }

static void go_page(int page, bool anim)
{
    lv_obj_t *target = page == 0 ? app.pg_rewards : page == 2 ? app.pg_chores : app.pg_home;
    if (lv_obj_has_flag(target, LV_OBJ_FLAG_HIDDEN)) page = 1;
    /* pages are a screen wide; hidden ones take no room */
    int slot = page - (page > 0 && lv_obj_has_flag(app.pg_rewards, LV_OBJ_FLAG_HIDDEN) ? 1 : 0);
    lv_obj_update_layout(app.carousel);
    lv_anim_delete(app.carousel, NULL);   /* LVGL's own throw or snap, or an earlier turn */
    int32_t from = lv_obj_get_scroll_x(app.carousel), to = slot * SCREEN_W;
    if (!anim || from == to) {
        lv_obj_scroll_to_x(app.carousel, to, LV_ANIM_OFF);
        app.page = page;
        return;
    }
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, app.carousel);
    lv_anim_set_exec_cb(&a, carousel_x);
    lv_anim_set_values(&a, from, to);
    lv_anim_set_duration(&a, 220 + (uint32_t)(240 * labs(to - from) / SCREEN_W));
    lv_anim_set_path_cb(&a, ui_path_out);
    lv_anim_set_completed_cb(&a, carousel_landed);
    lv_anim_start(&a);
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

static bool can_lift_schedule(void);

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
        if (!can_lift_schedule()) return false;
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

/* Whether a flick up on Home would lift the schedule right now (on_base_swipe says the same): only
 * from the hill at the bottom, where the schedule is, so a flick on the room or a list doesn't. */
#define PULL_Y 340
static bool can_lift_schedule(void)
{
    if (app.page != 1 || app.night_lock || !app.have_plan || !app.plan) return false;
    if (swipe_start().y < PULL_Y) return false;
    return app.state != ST_ALARM && app.state != ST_SNOOZE && app.state != ST_SLEEPY;
}

/* The day leans with the finger: dragged up on Home it lifts a little (the schedule is down
 * there), in the morning the alarm gives a little to a pull down (a snooze); let go and it
 * settles back, under the sheet if the flick landed. A finger that a list or the carousel has
 * taken is left alone. */
static bool leaning;
static void lean_y(void *obj, int32_t v) { lv_obj_set_style_translate_y(obj, v, 0); }

static void on_base_drag(int32_t dx, int32_t dy, bool end)
{
    lv_obj_t *pg = app.pg_home;
    if (end) {
        if (!leaning) return;
        leaning = false;
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, pg);
        lv_anim_set_exec_cb(&a, lean_y);
        lv_anim_set_values(&a, lv_obj_get_style_translate_y(pg, 0), 0);
        lv_anim_set_duration(&a, 320);
        lv_anim_set_path_cb(&a, ui_path_settle);
        lv_anim_start(&a);
        return;
    }
    if (app.page != 1 || play_is_open()) return;
    lv_indev_t *in = lv_indev_active();
    if (in && lv_indev_get_scroll_obj(in)) return;
    if (labs(dx) > labs(dy)) { if (leaning) on_base_drag(0, 0, true); return; }
    bool up = dy < 0;
    bool can = up ? can_lift_schedule() : app.state == ST_ALARM && app.snoozes < MAX_SNOOZES;
    if (!can) return;
    int32_t travel = labs(dy) - 6;
    if (travel < 0) travel = 0;
    int32_t ty = (int32_t)lroundf(40.0f * (1.0f - expf(-(float)travel / 80.0f)));   /* gives, then resists */
    lv_anim_delete(pg, lean_y);
    lv_obj_set_style_translate_y(pg, up ? -ty : ty, 0);
    leaning = true;
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
void mytoki_open_pet(void);
static void read_out(void);

/* ================================================================ actions */
static void finish_task_at(int i, int32_t at_s)
{
    day_task_t *t = &app.plan->tasks[i];
    if (t->done_at >= 0) return;
    t->done_at = at_s;
    app.reapply_until_s = app.now_s + SYNC_GRACE_S + REFRESH_MS / 1000 * 2;
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

/* A tap on a chore checks it, or unchecks one checked by mistake; the server hears either. */
static void on_chore(int i)
{
    day_chore_t *c = &app.plan->chores[i];
    c->done = !c->done;
    app.chore_at[i] = app.now_s;
    app.reapply_until_s = app.now_s + SYNC_GRACE_S + REFRESH_MS / 1000 * 2;
    send(c->done ? "chore_done" : "chore_undo", "task_id", c->id, 0);
    save_progress();
    if (c->done) {
        hal_play(HAL_SOUND_DONE);
        pet_react(chores_page_pet(), PET_CLIP_CELEBRATE);
    } else {
        hal_play(HAL_SOUND_TICK);
    }
    chores_page_render(app.plan, app.now_s / 60, app.plan->child.picture);
}

/* the task now tapped on the schedule: the sheet goes and the button's action happens at home */
static void on_sched_now(void)
{
    overlays_close_all();
    mytoki_button();
}

/* a chore ticked (or unticked) from the schedule wheel */
static void on_sched_chore(int i)
{
    on_chore(i);
    if (app.plan->chores[i].done) pet_react(home_pet(), PET_CLIP_CELEBRATE);
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
    others_refresh(app.plan, &app.now, app.now_s);
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
        if (app.state == ST_EVENT && app.now.nstill) others_open(app.plan, &app.now, app.now_s, on_other_done);
        else if (app.state == ST_TASK && app.focus >= 0 && steps_all(app.focus)) {   /* "All done!" tapped: the list again, to uncheck one */
            app.steps_peek = app.focus;
            app.steps_peek_until = now_ms() + STEPS_PEEK_MS;
            tick(NULL);
        }
        break;
    case HOME_TAP_PLAY: app.free_pet_view = true; break;
    case HOME_TAP_WHEEL: app.free_pet_view = false; break;
    case HOME_HOLD_PET: mytoki_open_pet(); break;
    case HOME_TAP_PET: {
        if ((app.state == ST_FREE && app.now.free_remaining - GET_READY_S > 0) || app.state == ST_FREE_DAY) { mytoki_open_playtime(); break; }
        static const char *const HI[] = { "Hi!", "We\xE2\x80\x99ve got this!", "Happy to see you!", "What\xE2\x80\x99s next?" };
        if (app.state == ST_ALARM || app.state == ST_SNOOZE) { say(NULL, "I\xE2\x80\x99m up! Are you?", 2500); break; }
        if (app.state == ST_SLEEPY || app.state == ST_DAY_OVER || app.state == ST_BEDTIME) say(NULL, "Zzz\xE2\x80\xA6", 2500);
        else say(NULL, HI[hal_random_u32() % 4], 2500);
        break;
    }
    case HOME_WHEEL_RESULT:
        app.free_act = activity_for_option(app.plan->wheel[arg]);
        app.pet_view_at = now_ms() + PET_VIEW_MS;
        if (!app.pet_view_at) app.pet_view_at = 1;
        break;
    case HOME_TAP_SPEAKER: read_out(); break;
    case HOME_TAP_PLAYTIME: mytoki_open_playtime(); break;
    case HOME_TAP_STEP:
        if ((app.state == ST_TASK || app.state == ST_EVENT_PREP) && app.focus >= 0 && arg >= 0 && arg < 16) {
            set_step(app.focus, arg, !(app.ticks[app.focus] & (1u << arg)));
            tick(NULL);
        }
        break;
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
    /* the morning alarm: from wake-up until the button says I'm up (only the button ends it: user,
     * 2026-10-21) */
    if (n->has_timed && !n->before_wake && !app.alarm_ack) {
        app.focus = n->current;
        if (app.imup_until && (int32_t)(now_ms() - app.imup_until) < 0) return ST_IM_UP;
        if (!app.imup_until) return app.now_s < app.snooze_until ? ST_SNOOZE : ST_ALARM;
        app.imup_until = 0;
        app.alarm_ack = true;
        save_progress();
        app.focus = -1;
    }
    if (n->current >= 0) {
        const day_task_t *c = &app.plan->tasks[n->current];
        app.focus = n->current;
        if (c->system == SYS_BEDTIME) return ST_BEDTIME;
        if (c->system == SYS_SCHOOL) return app.now_s < n->start[n->current] * 60 + SCHOOL_OFF_S ? ST_SCHOOL_OFF : ST_SCHOOL;
        if (c->event) {
            if (app.now_s / 60 < c->event_start) {
                bool all = steps_all(n->current);
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
    char buf[96], len[24];
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
            snprintf(v->status, sizeof v->status, "%s left", hr_min(len, sizeof len, left));
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
        bool peek = app.steps_peek == app.focus && (int32_t)(now_ms() - app.steps_peek_until) < 0;
        if (t->nsteps && (!steps_all(app.focus) || peek)) {
            /* the steps as a checklist that turns, no room (Figma Morning · Get dressed, the same as
             * Going out · Get ready): checked in any order by a tap or the button, unchecked by a tap */
            v->mid = MID_STEPS;
            v->sides = false;
            v->steps_total = (int8_t)t->nsteps;
            v->steps_ticked = app.ticks[app.focus];
            for (int i = 0; i < t->nsteps && i < HOME_STEPS_MAX; i++) snprintf(v->step_text[i], sizeof v->step_text[i], "%s", t->steps[i].text);
        } else if (t->nsteps && !n->overdue) {
            /* all checked: "All done!" with the button at its end; one more press finishes the task
             * (user, 2026-10-21). It never finishes on its own: the steps may only get it ready. A tap
             * on the note brings the list back to uncheck one. */
            button_note(v, "check", "All done!");
        }
        if (t->nsteps && steps_all(app.focus)) v->cue = true;   /* the button at 1 o'clock lights up */
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
        snprintf(v->status, sizeof v->status, "%s \xC2\xB7 waiting", hr_min(len, sizeof len, t->end - t->start));
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
        snprintf(v->status, sizeof v->status, "%s in %s", shortname, hr_min(len, sizeof len, mins));
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
            v->steps_ticked = app.ticks[app.focus];
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
        snprintf(v->status, sizeof v->status, "%s left", hr_min(len, sizeof len, left));
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
        snprintf(v->title, sizeof v->title, "Free Time");
        v->below = BELOW_TIME;
        snprintf(v->status, sizeof v->status, "%s left", hr_min(len, sizeof len, left));
        snprintf(v->status_icon, sizeof v->status_icon, "kite");
        timed(v, left, rem, total, PILL_DONE);
        bool can_play = rem - GET_READY_S > 0, quiet = false;   /* quiet: the wheel or Biscuit's view, no note */
        const day_task_t *nx = n->nupcoming ? &p->tasks[n->upcoming[0]] : NULL;
        next_from(v, -1);
        if (!can_play) {
            /* the last five minutes (Figma Free time · Last 5 minutes, 1080:5604): his room fills
             * the screen again but faded to 30%, he stays solid, the timer and pill amber */
            v->graphic = GRAPHIC_FULL;
            v->room_fade = 179;
            v->mood = PET_MOOD_EXCITED;
            v->force_clip = PET_CLIP_CURIOUS;
            (void)nx;
        } else if (total > WHEEL_MIN_S && !app.free_pet_view) {
            /* Figma Free time · Spin (1080:5388): the title and the time pill over the wheel (no
             * clock), Games under it */
            quiet = true;
            v->clock_line[0] = 0;
            v->mid = MID_WHEEL;
            v->bottom = BOTTOM_GAMES;
            v->dots = false;
        } else {
            /* Figma Free time · Play with Biscuit: the clock, the title and the pill, his room, tap
             * him to play */
            quiet = true;
            v->activity = app.free_act;
            /* a grown-up's free time just given: he says that first ("Free time! 15 minutes") */
            bool gift = !strncmp(app.say_key, "free:", 5) && (int32_t)(now_ms() - app.say_until) < 0;
            snprintf(v->say, sizeof v->say, "%s", gift ? app.say : "Tap to play!");
            v->tap_ring = can_play;   /* the lime ring pulses round him: a tap opens the games */
        }
        if (nx && logic_can_pull(p, n->upcoming[0], app.now_s) && v->card == CARDPOS_NONE && !quiet && can_play) {
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
        v->cue = true;   /* the button at 1 o'clock says I'm up */
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
        snprintf(v->status, sizeof v->status, "Starts in %s", hr_min(len, sizeof len, mins));
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
        else { snprintf(v->say, sizeof v->say, "Tap me to play!"); v->tap_ring = app.state == ST_FREE_DAY; }
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
    int st = steps_first_left(app.focus);
    if (app.state == ST_EVENT_PREP && st >= 0) snprintf(line, sizeof line, "Get ready for %s. Next step: %s", t->title, t->steps[st].text);
    else if (app.state == ST_EVENT) snprintf(line, sizeof line, "Have fun at %s!", t->title);
    else if (st >= 0) snprintf(line, sizeof line, "%s. Next step: %s", t->title, t->steps[st].text);
    else snprintf(line, sizeof line, "%s", t->title);
    hal_speak(line);
}

/* Free time a grown-up gave (the day already makes room for it): the first time it's on, MyToki
 * comes home and Biscuit says so (read out in picture view), with the chime. Once per gift. */
static void free_time_gift(void)
{
    const int now_m = app.now_s / 60;
    for (int i = 0; i < app.plan->nfree; i++) {
        const char *id = app.plan->free[i].id;
        if (now_m < app.plan->free[i].start || now_m >= app.plan->free[i].end || !strcmp(id, app.gift_seen)) continue;
        snprintf(app.gift_seen, sizeof app.gift_seen, "%s", id);
        char line[48], key[48], len[24];
        snprintf(line, sizeof line, "Free Time! %s", hr_min(len, sizeof len, app.plan->free[i].end - app.plan->free[i].start));
        snprintf(key, sizeof key, "free:%.40s", id);
        screen_wake();
        if (schedule_is_open()) overlays_close_all();
        go_page(1, true);
        app.free_pet_view = true;    /* Biscuit says it, Games under him */
        app.pet_view_at = 0;
        say(key, line, SAY_MS);
        if (app.plan->child.picture) hal_speak(line);
        hal_play(HAL_SOUND_CHIME);
        return;
    }
}

static void on_state_change(state_t from, state_t to)
{
    screen_wake();   /* something new to see (it goes off again if still put down) */
    speak_state(to);
    app.say[0] = 0; /* a new screen: Biscuit says something new, or nothing */
    (void)from;
    if (to == ST_BEDTIME) hal_play(HAL_SOUND_BEDTIME);
    if (to == ST_ALARM) { hal_play(HAL_SOUND_ALARM); app.alarm_chirp_s = app.alarm_ring_s = app.now_s; }
    if (to == ST_WELCOME || to == ST_SCHOOL_OFF) hal_play(HAL_SOUND_START);
    if (to == ST_BED_SOON) { hal_play(HAL_SOUND_SOON); pet_react(home_pet(), PET_CLIP_SLEEPY); }   /* a yawn */
    if (to == ST_FREE || to == ST_ALL_DONE) app.free_act = pet_pick_free_time_activity();
    /* a little joy on the day's wins */
    if (to == ST_DONE) home_celebrate(HOME_FX_DONE);
    if (from != ST_NONE && (to == ST_EVENT_READY || to == ST_ALL_DONE)) home_celebrate(HOME_FX_BIG);
    if (to == ST_IM_UP || to == ST_WELCOME) home_celebrate(HOME_FX_SPARKLE);
}

/* The panel: dim at night, darker on the dock, the sunrise over the alarm's first minute (full at school). */
static void brightness(void)
{
    if (app.screen_off) return;
    uint8_t b = 80;   /* full brightness was too bright (user, 2026-10-20) */
    switch (app.state) {
    case ST_SLEEPY: case ST_DAY_OVER: b = hal_docked() ? 20 : 35; break;
    case ST_BEDTIME: b = 50; break;
    /* still asleep while the alarm rings or snoozes: the screen stays dim until he's up */
    case ST_ALARM: case ST_SNOOZE: b = hal_docked() ? 20 : 35; break;
    case ST_BED_SOON: b = 65; break;
    default: break;
    }
    /* fade to it, a step a tick (about two seconds from dim to full), so waking up brightens */
    if (b == app.brightness) return;
    int step = 8, d = (int)b - (int)app.brightness;
    if (!app.brightness) app.brightness = b;   /* the very first screen: no fade from black */
    else app.brightness = (uint8_t)(app.brightness + (d > step ? step : d < -step ? -step : d));
    hal_set_brightness(app.brightness);
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
    if (!app.fetching && now_ms() - app.last_fetch > app.refresh_ms) request_plan();

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
    free_time_gift();   /* after the new window's reset above, so Biscuit's room stays */
    if (play_is_open()) play_set_time_left(app.state == ST_FREE ? app.now.free_remaining - GET_READY_S : 0);
    if (reminder_is_open()) reminder_update(app.now.free_remaining);

    /* the alarm's soft tone again every half minute while it rings, for the first quarter of an hour */
    if (app.state == ST_ALARM && app.now_s - app.alarm_chirp_s >= ALARM_RING_S && app.now_s - app.alarm_ring_s < ALARM_CHIRPS_S) {
        app.alarm_chirp_s = app.now_s;
        hal_play(HAL_SOUND_ALARM);
    }
    brightness();
    bool locked = app.state == ST_SLEEPY || app.state == ST_DAY_OVER || app.state == ST_ALARM || app.state == ST_SNOOZE
               || app.state == ST_IM_UP || app.state == ST_SCHOOL_OFF || app.state == ST_SCHOOL;
    set_night_lock(locked, app.state == ST_BEDTIME);

    home_view_t v;
    build_view(&v);
    home_render(&v);
    if (app.fresh) { pet_skip_intro(home_pet()); app.fresh = false; }
    pet_set_paused(home_pet(), app.page != 1 || v.mid != MID_PET || play_is_open() || overlay_covering());
    chores_page_visible(app.page == 2);
    rewards_page_render(app.plan, available_stars(), app.plan->child.picture);
    chores_page_render(app.plan, app.now_s / 60, app.plan->child.picture);
    if (others_is_open()) others_refresh(app.plan, &app.now, app.now_s);

    /* left on a side page: drift back home */
    if (lv_display_get_inactive_time(NULL) > IDLE_HOME_MS) {
        if (app.page != 1) go_page(1, true);
        if (schedule_is_open() || others_is_open()) overlays_close_idle();
    }
}

/* a page asks for the screen to be drawn again now (a held-back change is ready) */
static void render_now(void) { if (app.have_plan) tick(NULL); }

/* ================================================================ entry points */
void mytoki_start(void)
{
    memset(&app, 0, sizeof app);
    app.plan = lv_malloc_zeroed(sizeof(day_plan_t));
    app.done_task = -1;
    app.ready_task = -1;
    app.last_current = -2;
    app.refresh_ms = REFRESH_MS;
    app.retry_ms = OFFLINE_RETRY_MS;
    app.page = 1;
    app.free_window = -100000;

    swipe_init();
    screen_init();
    schedule_set_on_now(on_sched_now);
    swipe_set_base(on_base_swipe);
    swipe_set_drag(on_base_drag);
    ui_set_render(render_now);
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
    lv_obj_add_event_cb(app.carousel, carousel_depth, LV_EVENT_SCROLL, NULL);
    lv_obj_t **pages[3] = { &app.pg_rewards, &app.pg_home, &app.pg_chores };
    for (int i = 0; i < 3; i++) {
        *pages[i] = ui_box(app.carousel);
        lv_obj_set_size(*pages[i], SCREEN_W, SCREEN_H);
        lv_obj_add_flag(*pages[i], LV_OBJ_FLAG_SNAPPABLE);
        /* for the pyramid: scaled about its middle, clipped to its circle while it moves */
        lv_obj_set_style_transform_pivot_x(*pages[i], lv_pct(50), 0);
        lv_obj_set_style_transform_pivot_y(*pages[i], lv_pct(50), 0);
        lv_obj_set_style_radius(*pages[i], LV_RADIUS_CIRCLE, 0);
    }
    overlay_set_backdrop(app.pg_home);   /* the schedule sheet lifts off Home */
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

/* cached: the day kept from before a restart (the server can't be reached yet), taken only if it is
 * today's and there is no day yet */
static void take_day(const char *json, size_t len, bool cached)
{
    hal_time_now(&app.t);
    int32_t now_s = app.t.hour * 3600 + app.t.minute * 60 + app.t.second;
    /* the same day as last time (most refreshes): nothing to redo, unless something done here is
     * still in (or just past) its grace, when the plan has to be laid over again */
    uint32_t hash = 2166136261u;
    for (size_t i = 0; i < len; i++) hash = (hash ^ (uint8_t)json[i]) * 16777619u;
    if (app.have_plan && hash == app.plan_hash && now_s > app.reapply_until_s) return;
    app.plan_hash = hash;
    ui_set_clock(app.t.hour * 60 + app.t.minute);   /* screens that open with the plan show the time too */
    day_plan_t *p = lv_malloc(sizeof(day_plan_t));
    if (!p) return;
    if (!day_parse(json, len, p)) {
        lv_free(p);
        if (!app.have_plan && !cached) system_show(SYS_SCREEN_ERROR, "The day plan from the server could not be read.", on_retry);
        return;
    }
    if (cached) {
        char today[11];
        snprintf(today, sizeof today, "%04d-%02d-%02d", app.t.year, app.t.month, app.t.day);
        if (app.have_plan || strcmp(p->date, today)) { lv_free(p); return; }
    }
    if (!p->date[0]) snprintf(p->date, sizeof p->date, "%s", app.today);
#ifdef MYTOKI_NO_SCHOOL
    /* a test setting on the board (CONFIG_MYTOKI_NO_SCHOOL): the day runs as if there were no School */
    for (int i = 0; i < p->ntasks; ) {
        if (p->tasks[i].system != SYS_SCHOOL) { i++; continue; }
        memmove(&p->tasks[i], &p->tasks[i + 1], (size_t)(p->ntasks - i - 1) * sizeof p->tasks[0]);
        p->ntasks--;
    }
#endif
    /* keep step ticks and the "Done!" hold across a refresh */
    char done_id[40] = "";
    if (app.have_plan && app.done_task >= 0) snprintf(done_id, sizeof done_id, "%s", app.plan->tasks[app.done_task].id);
    apply_progress(p, now_s);
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

void mytoki_day_received(const char *json, size_t len)
{
    app.fetching = false;
    app.refresh_ms = REFRESH_MS;
    app.retry_ms = OFFLINE_RETRY_MS;
    take_day(json, len, false);
}

void mytoki_day_cached(const char *json, size_t len)
{
    if (!app.have_plan) take_day(json, len, true);
}

/* The four digits a grown-up types into the app; kept until the device is paired. */
static const char *pair_code(void)
{
    static char code[8];
    if (!code[0] && !hal_store_get("pair_code", code, sizeof code)) {
        uint32_t r = hal_random_u32() % 10000;
        snprintf(code, sizeof code, "%02u %02u", (unsigned)(r / 100), (unsigned)(r % 100));
        hal_store_set("pair_code", code);
    }
    return code;
}

void mytoki_day_failed(int reason)
{
    app.fetching = false;
    if (app.have_plan) {   /* keep going with what we have, and look again later */
        app.refresh_ms = app.refresh_ms * 2 > REFRESH_MAX_MS ? REFRESH_MAX_MS : app.refresh_ms * 2;
        return;
    }
    if (reason == 3) app.retry_ms = OFFLINE_RETRY_MS;   /* not paired: nothing was asked of the server */
    app.retry_at = now_ms() + app.retry_ms;
    app.retry_ms = app.retry_ms * 2 > OFFLINE_RETRY_MAX_MS ? OFFLINE_RETRY_MAX_MS : app.retry_ms * 2;
    if (reason == 3) { system_show(SYS_SCREEN_PAIRING, pair_code(), on_retry); return; }
    system_show(reason == 0 ? SYS_SCREEN_OFFLINE : SYS_SCREEN_ERROR,
                reason == 0 ? NULL : "The server did not answer.", on_retry);
}

/* ================================================================ the screen off when put down */
/* Lying flat and still on a table, untouched, for 10 s, the screen goes off (held in a hand, however
 * steadily, it stays on); picked up or tipped, the button or a touch brings it back, and that touch
 * or press does nothing else. It stays on on the
 * dock (the night clock), while the alarm rings, in Playtime, and without a motion sensor. */
static bool may_sleep(void)
{
    if (!hal_screen_sleeps() && !app.sleep_test) return false;
    if (!motion_alive(now_ms()) || hal_docked() || play_is_open()) return false;
    return app.state != ST_ALARM && app.state != ST_SNOOZE && app.state != ST_IM_UP;
}

static void screen_wake(void)
{
    app.awake_ms = now_ms();
    if (!app.screen_off) return;
    app.screen_off = false;
    /* a finger on it lifts first (on_catcher); picked up, it's gone at once */
    lv_indev_t *in = lv_indev_active();
    if (!in || lv_indev_get_active_obj() != app.wake_catcher) ui_show(app.wake_catcher, false);
    hal_screen(true);
    app.brightness = 0;   /* straight to the right brightness, no fade up */
    brightness();
}

static void screen_sleep(void)
{
    app.screen_off = true;
    ui_show(app.wake_catcher, true);
    lv_obj_move_foreground(app.wake_catcher);
    hal_screen(false);
}

static void screen_watch(void)
{
    uint32_t now = now_ms();
    if (app.screen_off) {
        if (motion_energy() > MOTION_PICKUP_G || !motion_flat() || !may_sleep()) screen_wake();
        else if (lv_obj_get_index(app.wake_catcher) != (int32_t)lv_obj_get_child_count(lv_layer_top()) - 1)
            lv_obj_move_foreground(app.wake_catcher);   /* still over anything that opened meanwhile */
        return;
    }
    if (may_sleep() && motion_rest_ms() >= SLEEP_MS && now - app.touch_ms >= SLEEP_MS && now - app.awake_ms >= SLEEP_MS) screen_sleep();
}

static void on_catcher(lv_event_t *e)
{
    lv_event_code_t c = lv_event_get_code(e);
    if (c == LV_EVENT_PRESSED) screen_wake();
    else if ((c == LV_EVENT_RELEASED || c == LV_EVENT_PRESS_LOST) && !app.screen_off) ui_show(app.wake_catcher, false);
}

static void on_touch(lv_event_t *e)
{
    lv_event_code_t c = lv_event_get_code(e);
    if (c == LV_EVENT_PRESSED || c == LV_EVENT_PRESSING || c == LV_EVENT_RELEASED) app.touch_ms = now_ms();
}

static void screen_init(void)
{
    app.wake_catcher = ui_box(lv_layer_top());
    lv_obj_set_size(app.wake_catcher, SCREEN_W, SCREEN_H);
    lv_obj_add_flag(app.wake_catcher, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(app.wake_catcher, on_catcher, LV_EVENT_ALL, NULL);
    ui_show(app.wake_catcher, false);
    for (lv_indev_t *i = lv_indev_get_next(NULL); i; i = lv_indev_get_next(i))
        if (lv_indev_get_type(i) == LV_INDEV_TYPE_POINTER) lv_indev_add_event_cb(i, on_touch, LV_EVENT_ALL, NULL);
}

void mytoki_motion(float ax, float ay, float az)
{
    motion_push(ax, ay, az, lv_tick_get());
    screen_watch();
}

void mytoki_button(void)
{
    app.touch_ms = now_ms();
    if (app.screen_off) { screen_wake(); return; }   /* a press on a dark screen only lights it */
    if (!app.have_plan) return;
    /* away from Home (another page, something over the day, Playtime): the button brings the child
     * home to the pet, and does nothing else. Biscuit says keeps it: "Button" is part of the game. */
    if (play_in_game() && game_current() == GAME_SAYS) { play_button(); return; }
    if (app.page != 1 || overlays_any_open() || play_is_open()) {
        if (play_is_open()) play_close();
        overlays_close_all();
        go_page(1, true);
        if (app.state == ST_FREE) { app.free_pet_view = true; app.pet_view_at = 0; }
        hal_play(HAL_SOUND_TICK);
        tick(NULL);
        return;
    }
    const int f = app.focus;
    switch (app.state) {
    case ST_TASK: {
        day_task_t *t = &app.plan->tasks[f];
        if (t->fun) return;
        if (schedule_is_open()) overlays_close_all();
        go_page(1, true);
        if (t->nsteps && !steps_all(f)) {
            set_step(f, steps_for_button(f), true);
            break;
        }
        app.steps_peek = -1;
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
    case ST_FREE:
        /* free time: the button goes home, to Biscuit's room (from the wheel, or another page);
         * it no longer starts the next task early */
        if (app.free_pet_view && app.page == 1) return;
        app.free_pet_view = true;
        app.pet_view_at = 0;
        go_page(1, true);
        hal_play(HAL_SOUND_TICK);
        break;
    case ST_EVENT_PREP: {
        day_task_t *t = &app.plan->tasks[f];
        if (!t->nsteps || steps_all(f)) return;
        go_page(1, true);
        set_step(f, steps_for_button(f), true);
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

void mytoki_show_wheel(void)
{
    app.free_pet_view = false;
    app.pet_view_at = 0;
    go_page(1, false);
}

void mytoki_debug(const char *cmd)
{
    if (!strcmp(cmd, "refresh")) { request_plan(); return; }
    if (!strcmp(cmd, "sleep")) { app.sleep_test = true; return; }   /* the simulator tries the screen going off */
    /* the simulator jumped straight to a task after wake-up: the child is up (and home), so the
     * task shows at once instead of the alarm; the jump back in time doesn't start the morning over */
    if (!strcmp(cmd, "awake")) {
        app.alarm_ack = app.welcome_ack = true;
        app.imup_until = 0;
        app.snooze_until = 0;
        app.last_now_s = INT32_MIN / 2;
        save_progress();
        return;
    }
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

/* My pet: a long tap on the pet when nothing is on (free time, waiting, the day done, a free or
 * rest day): choose the buddy, dress it up. Not during a task, an event or school. */
void mytoki_open_pet(void)
{
    if (play_is_open() || !app.have_plan) return;
    switch (app.state) {
    case ST_FREE: case ST_FREE_DAY: case ST_WAITING: case ST_ALL_DONE: case ST_REST: case ST_WELCOME: break;
    default: return;
    }
    pet_react(home_pet(), PET_CLIP_WAVE);
    play_open_pet(app.plan->child.pet, on_outfit, on_character);
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
