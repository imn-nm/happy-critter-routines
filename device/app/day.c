#include "day.h"
#include "cJSON.h"
#include <stdlib.h>
#include <string.h>

int day_parse_hhmm(const char *s)
{
    if (!s) return -1;
    int h = 0, m = 0, n = 0;
    while (*s >= '0' && *s <= '9') { h = h * 10 + (*s++ - '0'); n++; }
    if (!n || *s != ':') return -1;
    s++;
    n = 0;
    while (*s >= '0' && *s <= '9') { m = m * 10 + (*s++ - '0'); n++; }
    if (!n || h > 24 || m > 59) return -1;
    return h * 60 + m;
}

static void copy(char *dst, size_t n, const cJSON *obj, const char *key)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, key);
    dst[0] = 0;
    if (cJSON_IsString(v) && v->valuestring) {
        strncpy(dst, v->valuestring, n - 1);
        dst[n - 1] = 0;
    }
}

static int num(const cJSON *obj, const char *key, int def)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, key);
    return cJSON_IsNumber(v) ? (int)v->valuedouble : def;
}

static bool flag(const cJSON *obj, const char *key)
{
    return cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(obj, key));
}

static int hhmm(const cJSON *obj, const char *key)
{
    const cJSON *v = cJSON_GetObjectItemCaseSensitive(obj, key);
    return cJSON_IsString(v) ? day_parse_hhmm(v->valuestring) : -1;
}

static const char *ACTIVITIES[] = { "", "brushing", "eating", "reading", "gaming", "sleeping", "sports", "drawing", "bubbles", "outside",
    "waking", "handwashing", "shower", "dressing", "tidying", "homework", "music", "basketball" };

static int cmp_task(const void *a, const void *b)
{
    const day_task_t *x = a, *y = b;
    return x->start - y->start;
}

bool day_parse(const char *json, size_t len, day_plan_t *out)
{
    cJSON *root = cJSON_ParseWithLength(json, len);
    if (!root || !cJSON_IsObject(root)) { cJSON_Delete(root); return false; }
    const cJSON *child = cJSON_GetObjectItemCaseSensitive(root, "child");
    const cJSON *tasks = cJSON_GetObjectItemCaseSensitive(root, "tasks");
    if (!cJSON_IsObject(child) || (tasks && !cJSON_IsArray(tasks))) { cJSON_Delete(root); return false; }

    day_plan_t *p = calloc(1, sizeof(day_plan_t));
    if (!p) { cJSON_Delete(root); return false; }
    copy(p->date, sizeof p->date, root, "date");
    copy(p->child.id, sizeof p->child.id, child, "id");
    copy(p->child.name, sizeof p->child.name, child, "name");
    copy(p->child.pet, sizeof p->child.pet, child, "pet");
    copy(p->child.character, sizeof p->child.character, child, "character");
    copy(p->child.color, sizeof p->child.color, child, "color");
    if (!p->child.pet[0]) strcpy(p->child.pet, "Biscuit");
    p->child.picture = flag(child, "picture");
    p->child.stars = (int16_t)num(child, "stars", 0);
    p->child.wake = (int16_t)hhmm(child, "wake");
    copy(p->child.star_note, sizeof p->child.star_note, child, "star_note");
    copy(p->child.star_note_id, sizeof p->child.star_note_id, child, "star_note_id");
    p->child.star_note_stars = (int16_t)num(child, "star_note_stars", 1);
    const cJSON *outfit = cJSON_GetObjectItemCaseSensitive(child, "outfit");
    if (cJSON_IsObject(outfit)) {
        copy(p->child.outfit[0], sizeof p->child.outfit[0], outfit, "head");
        copy(p->child.outfit[1], sizeof p->child.outfit[1], outfit, "face");
        copy(p->child.outfit[2], sizeof p->child.outfit[2], outfit, "neck");
    }
    p->rest_day = flag(root, "rest_day");

    const cJSON *t;
    cJSON_ArrayForEach(t, tasks) {
        if (p->ntasks >= DAY_MAX_TASKS) break;
        int start = hhmm(t, "start"), end = hhmm(t, "end");
        if (start < 0 || end <= start) continue;
        day_task_t *k = &p->tasks[p->ntasks++];
        copy(k->id, sizeof k->id, t, "id");
        copy(k->title, sizeof k->title, t, "title");
        copy(k->icon, sizeof k->icon, t, "icon");
        copy(k->say, sizeof k->say, t, "say");
        k->start = (int16_t)start;
        k->end = (int16_t)end;
        k->event = flag(t, "event");
        k->event_start = (int16_t)(k->event ? hhmm(t, "event_start") : -1);
        if (k->event && k->event_start < 0) k->event_start = k->start;
        k->important = flag(t, "important");
        k->fun = flag(t, "fun");
        k->fixed = flag(t, "fixed");
        k->needs_start = flag(t, "needs_start");
        int started = hhmm(t, "started_at");
        k->started_at = started >= 0 ? started * 60 : -1;
        k->bedtime_routine = flag(t, "bedtime_routine");
        char sys[16], late[12], act[16];
        copy(sys, sizeof sys, t, "system");
        k->system = !strcmp(sys, "wake") ? SYS_WAKE : !strcmp(sys, "breakfast") ? SYS_BREAKFAST
                  : !strcmp(sys, "school") ? SYS_SCHOOL : !strcmp(sys, "lunch") ? SYS_LUNCH
                  : !strcmp(sys, "dinner") ? SYS_DINNER : !strcmp(sys, "bedtime") ? SYS_BEDTIME : SYS_NONE;
        copy(late, sizeof late, t, "late");
        k->late = !strcmp(late, "skip") ? LATE_SKIP : !strcmp(late, "shorten") ? LATE_SHORTEN
                : (!late[0] && k->fun) ? LATE_SKIP : LATE_KEEP;
        k->min_minutes = (int16_t)num(t, "min", 0);
        copy(act, sizeof act, t, "activity");
        k->activity = -1;
        for (int i = 1; i < (int)(sizeof ACTIVITIES / sizeof ACTIVITIES[0]); i++)
            if (!strcmp(act, ACTIVITIES[i])) k->activity = (int8_t)i;
        const cJSON *steps = cJSON_GetObjectItemCaseSensitive(t, "steps"), *s;
        cJSON_ArrayForEach(s, steps) {
            if (k->nsteps >= DAY_MAX_STEPS) break;
            day_step_t *st = &k->steps[k->nsteps++];
            copy(st->id, sizeof st->id, s, "id");
            copy(st->text, sizeof st->text, s, "text");
        }
        int done = hhmm(t, "done_at");
        k->done_at = done >= 0 ? done * 60 : -1;
    }
    qsort(p->tasks, p->ntasks, sizeof(day_task_t), cmp_task);

    const cJSON *c;
    cJSON_ArrayForEach(c, cJSON_GetObjectItemCaseSensitive(root, "chores")) {
        if (p->nchores >= DAY_MAX_CHORES) break;
        day_chore_t *k = &p->chores[p->nchores++];
        copy(k->id, sizeof k->id, c, "id");
        copy(k->title, sizeof k->title, c, "title");
        copy(k->icon, sizeof k->icon, c, "icon");
        k->from = (int16_t)hhmm(c, "from");
        k->to = (int16_t)hhmm(c, "to");
        k->done = flag(c, "done");
    }

    const cJSON *r;
    cJSON_ArrayForEach(r, cJSON_GetObjectItemCaseSensitive(root, "rewards")) {
        if (p->nrewards >= DAY_MAX_REWARDS) break;
        day_reward_t *k = &p->rewards[p->nrewards++];
        copy(k->id, sizeof k->id, r, "id");
        copy(k->title, sizeof k->title, r, "title");
        copy(k->icon, sizeof k->icon, r, "icon");
        k->cost = (int16_t)num(r, "cost", 0);
        copy(k->note, sizeof k->note, r, "note");
        copy(k->note_id, sizeof k->note_id, r, "note_id");
        char col[12], state[12];
        copy(col, sizeof col, r, "color");
        k->color = col[0] == '#' ? (uint32_t)strtoul(col + 1, NULL, 16) : 0xEEE9DA;
        copy(state, sizeof state, r, "state");
        k->state = !strcmp(state, "waiting") || !strcmp(state, "pending") ? REWARD_WAITING
                 : !strcmp(state, "approved") ? REWARD_APPROVED : !strcmp(state, "denied") ? REWARD_DENIED : REWARD_NONE;
    }

    const cJSON *s;
    cJSON_ArrayForEach(s, cJSON_GetObjectItemCaseSensitive(root, "streaks")) {
        if (p->nstreaks >= DAY_MAX_STREAKS) break;
        day_streak_t *k = &p->streaks[p->nstreaks++];
        copy(k->id, sizeof k->id, s, "id");
        copy(k->title, sizeof k->title, s, "title");
        copy(k->icon, sizeof k->icon, s, "icon");
        k->goal = (uint8_t)num(s, "goal", 5);
        k->count = (uint8_t)num(s, "count", 0);
        k->prize = (int16_t)num(s, "prize", 0);
        k->night = flag(s, "night");
    }

    const cJSON *w;
    cJSON_ArrayForEach(w, cJSON_GetObjectItemCaseSensitive(root, "wheel")) {
        if (p->nwheel >= DAY_MAX_WHEEL || !cJSON_IsString(w)) continue;
        strncpy(p->wheel[p->nwheel], w->valuestring, sizeof p->wheel[0] - 1);
        p->nwheel++;
    }
    if (p->nwheel < 2) {
        /* lib/spinningWheel.ts STARTER_WHEEL_OPTIONS until a grown-up adds two or more */
        static const char *STARTER[] = { "Draw", "Lego", "Read", "Outside", "Puzzle", "Dance" };
        p->nwheel = 6;
        for (int i = 0; i < 6; i++) strcpy(p->wheel[i], STARTER[i]);
    }

    cJSON_Delete(root);
    memcpy(out, p, sizeof(*p));
    free(p);
    return true;
}

int day_task_index(const day_plan_t *p, const char *id)
{
    for (int i = 0; i < p->ntasks; i++) if (!strcmp(p->tasks[i].id, id)) return i;
    return -1;
}
