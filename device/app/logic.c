#include "logic.h"
#include <string.h>

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

static int32_t start_s(const day_task_t *t) { return t->start * 60; }
static bool done(const day_task_t *t) { return t->done_at >= 0; }

/* The real windows (eff_end[]) are worked out first and read by everything below. */
static const int16_t *g_eff_end;
static int32_t total_s(const day_task_t *t, int i) { return (g_eff_end[i] - t->start) * 60; }
static bool stretched(const day_task_t *t, int i) { return g_eff_end[i] > t->end; }

bool logic_fixed(const day_task_t *t) { return t->fixed || t->event || t->system != SYS_NONE; }

/* How much of a task a running-late day may take (timeReserve.ts giveableSeconds). */
static int32_t giveable(const day_task_t *t, int i)
{
    if (t->important) return 0;
    if (stretched(t, i)) return 0;   /* running on the child's own Start: keeps its full length */
    if (t->late == LATE_SKIP) return total_s(t, i);
    if (t->late == LATE_SHORTEN) return MAX(0, total_s(t, i) - t->min_minutes * 60);
    return 0;
}

/* A task finished early only occupies the day until it was done (whole minutes). */
static int32_t busy_until(const day_task_t *t, int i)
{
    int32_t end = start_s(t) + total_s(t, i);
    if (!done(t)) return end;
    return MAX(start_s(t), MIN(end, (t->done_at / 60) * 60));
}

/* A meal, school or event in the way of a started task: it stops for it and carries on after. */
static bool pauser(const day_task_t *f) { return logic_fixed(f) && f->system != SYS_BEDTIME && f->system != SYS_WAKE; }

/*
 * utils/liveDay.ts runWindows: a task that needs the button (or was started by it) runs its full
 * length from the press, or from now while it waits; meals and events in the way pause it; nothing
 * past bedtime.
 */
static void windows(const day_plan_t *p, int32_t now_s, logic_now_t *o)
{
    const int now_m = now_s / 60;
    int cap = 24 * 60;
    for (int i = 0; i < p->ntasks; i++) if (p->tasks[i].system == SYS_BEDTIME) { cap = MIN(cap, p->tasks[i].start); break; }
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        o->eff_end[i] = t->end;
        o->run_start[i] = -1;
        if (logic_fixed(t) && !t->needs_start) continue;
        bool started = t->started_at >= 0;
        if (!t->needs_start && !started) continue;
        if (done(t) && !started) continue;
        int run;
        if (started) run = MAX(t->start, t->started_at / 60);
        else if (now_m > t->start) { run = now_m; o->waiting[i] = true; }
        else continue;
        int end = run + (t->end - t->start);
        for (int j = 0; j < p->ntasks; j++) {
            const day_task_t *f = &p->tasks[j];
            if (j == i || !pauser(f) || f->end <= run || f->start >= end) continue;
            end += f->end - MAX(f->start, run);
        }
        o->run_start[i] = (int16_t)run;
        o->eff_end[i] = (int16_t)MAX(MIN(end, cap), t->end);
    }
}

int32_t logic_run_remaining(const logic_now_t *n, const day_plan_t *p, int task, int32_t now_s)
{
    const day_task_t *t = &p->tasks[task];
    int32_t dur = (t->end - t->start) * 60;
    if (n->run_start[task] < 0 || n->waiting[task]) return dur;
    int32_t run = n->run_start[task] * 60, paused = 0;
    for (int j = 0; j < p->ntasks; j++) {
        const day_task_t *f = &p->tasks[j];
        if (j == task || !pauser(f) || f->end * 60 <= run || f->start > n->eff_end[task]) continue;
        paused += MAX(0, MIN(now_s, f->end * 60) - MAX(f->start * 60, run));
    }
    return dur - (now_s - run - paused);
}

bool logic_can_pull(const day_plan_t *p, int task, int32_t now_s)
{
    const day_task_t *t = &p->tasks[task];
    return task >= 0 && !logic_fixed(t) && !done(t) && t->started_at < 0 && t->start > now_s / 60;
}

void logic_pull_forward(day_plan_t *p, int task, int32_t now_s)
{
    if (!logic_can_pull(p, task, now_s)) return;
    day_task_t *t = &p->tasks[task];
    int to = now_s / 60, delta = t->start - to;
    t->end = (int16_t)(to + (t->end - t->start));
    t->start = (int16_t)to;
    t->started_at = to * 60;
    int prev_end = t->end;
    for (int j = task + 1; j < p->ntasks; j++) {
        day_task_t *r = &p->tasks[j];
        if (logic_fixed(r)) break;
        if (done(r)) continue;
        if (r->started_at >= 0) break;   /* a task the child already started stays where it is */
        int orig = r->start, next = MAX(orig - delta, prev_end);
        if (next >= orig) break;
        r->end = (int16_t)(next + (r->end - orig));
        r->start = (int16_t)next;
        delta = orig - next;   /* the chain tightens: later rows move by what this one moved */
        prev_end = r->end;
    }
    /* keep the plan sorted by start (day.c cmp_task) */
    for (int a = 1; a < p->ntasks; a++) {
        day_task_t tmp = p->tasks[a];
        int b = a - 1;
        while (b >= 0 && p->tasks[b].start > tmp.start) { p->tasks[b + 1] = p->tasks[b]; b--; }
        p->tasks[b + 1] = tmp;
    }
}

typedef struct {
    int task;              /* -1 for a gap */
    int32_t start, total, capacity, lost;
} res_t;

static void reserve(const day_plan_t *p, int32_t now, reserve_t *out)
{
    memset(out, 0, sizeof(*out));
    out->reserve_task = -1;
    res_t rs[DAY_MAX_TASKS * 2];
    int n = 0;
    /* gaps between busy blocks become free time */
    if (p->ntasks) {
        int32_t occupied = busy_until(&p->tasks[0], 0);
        for (int i = 1; i < p->ntasks; i++) {
            const day_task_t *t = &p->tasks[i];
            if (start_s(t) > occupied) rs[n++] = (res_t){ -1, occupied, start_s(t) - occupied, start_s(t) - occupied, 0 };
            occupied = MAX(occupied, busy_until(t, i));
        }
    }
    int ngaps = n;
    /* then tasks that may give up time: "skip" before "shorten", then list order */
    for (int rank = 0; rank < 2; rank++)
        for (int i = 0; i < p->ntasks; i++) {
            const day_task_t *t = &p->tasks[i];
            if (giveable(t, i) <= 0 || (rank == 0) != (t->late == LATE_SKIP)) continue;
            rs[n++] = (res_t){ i, start_s(t), total_s(t, i), giveable(t, i), 0 };
        }
    /* replay today's late spans: a must-finish task past its end until done (or now), and the stretch
     * a waiting or started task takes beyond the length set (known ahead); overlapping spans count once */
    int32_t iv_start[DAY_MAX_TASKS], iv_end[DAY_MAX_TASKS];
    int niv = 0;
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        if (!t->important && !stretched(t, i)) continue;
        int32_t s = t->end * 60, eff = g_eff_end[i] * 60;
        int32_t e = done(t) ? MIN(now, t->done_at) : t->important ? MAX(eff, now) : eff;
        if (e > s) {
            int k = niv++;
            while (k > 0 && iv_start[k - 1] > s) { iv_start[k] = iv_start[k - 1]; iv_end[k] = iv_end[k - 1]; k--; }
            iv_start[k] = s;
            iv_end[k] = e;
        }
    }
    int32_t accounted = 0;
    for (int k = 0; k < niv; k++) {
        int32_t from = MAX(iv_start[k], accounted);
        int32_t debt = MAX(0, iv_end[k] - from);
        accounted = MAX(accounted, iv_end[k]);
        for (int r = 0; r < n && debt > 0; r++) {
            if (rs[r].start + rs[r].total <= from) continue; /* already over: can't be eaten */
            int32_t loss = MIN(debt, rs[r].capacity - rs[r].lost);
            rs[r].lost += loss;
            debt -= loss;
        }
    }
    int32_t free_total = 0, free_left = 0;
    for (int r = 0; r < ngaps; r++) {
        out->win[out->nwin++] = (free_window_t){ rs[r].start, rs[r].start + rs[r].lost, rs[r].start + rs[r].total };
        if (rs[r].start + rs[r].total > now) {
            free_total += rs[r].total;
            free_left += MAX(0, rs[r].total - MAX(rs[r].lost, now - rs[r].start));
        }
    }
    for (int r = ngaps; r < n; r++) out->loss[rs[r].task] = rs[r].lost;
    if (free_left > 0) {
        out->free_reserve = true;
        out->reserve_total = free_total;
        out->reserve_remaining = free_left;
        return;
    }
    int sel = -1, last = -1;
    for (int r = ngaps; r < n; r++) {
        const day_task_t *t = &p->tasks[rs[r].task];
        if (done(t) || rs[r].start + rs[r].total <= now) continue;
        last = r;
        if (sel < 0 && rs[r].capacity > rs[r].lost) sel = r;
    }
    if (sel < 0) sel = last;
    if (sel >= 0) {
        out->reserve_task = rs[sel].task;
        out->reserve_total = rs[sel].total;
        out->reserve_remaining = MAX(0, MIN(rs[sel].total - rs[sel].lost, rs[sel].start + rs[sel].total - now));
    }
}

int16_t logic_start(const logic_now_t *n, const day_plan_t *p, int task)
{
    (void)p;
    return n->start[task];
}

int logic_minutes_left(const logic_now_t *n, const day_plan_t *p, int task, int32_t now_s)
{
    int32_t left = n->run_start[task] >= 0 ? logic_run_remaining(n, p, task, now_s) : p->tasks[task].end * 60 - now_s;
    return left <= 0 ? 0 : (left + 59) / 60;
}

void logic_now(const day_plan_t *p, int32_t now_s, logic_now_t *o)
{
    memset(o, 0, sizeof(*o));
    o->current = -1;
    o->paused = -1;
    const int now_m = now_s / 60;
    windows(p, now_s, o);
    g_eff_end = o->eff_end;
    reserve(p, now_s, &o->reserve);

    /* time given up to a late day delays the start; the end stays fixed */
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        int32_t lost = o->reserve.loss[i];
        int dur = o->eff_end[i] - t->start;
        int lost_m = lost ? MIN(dur, (lost + 59) / 60) : 0;
        o->start[i] = (int16_t)(t->start + lost_m);
    }
    /* tasks a started (or waiting) task ran over completely: "didn't get to it" (never must-finish ones) */
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        if (done(t) || t->important || logic_fixed(t) || o->run_start[i] >= 0) continue;
        for (int w = 0; w < p->ntasks; w++) {
            if (o->run_start[w] < 0 || done(&p->tasks[w]) || o->eff_end[w] <= p->tasks[w].end) continue;
            if (o->run_start[w] <= o->start[i] && t->end <= o->eff_end[w]) { o->missed[i] = true; break; }
        }
    }

    o->wake = p->child.wake >= 0 ? p->child.wake : 7 * 60;
    for (int i = 0; i < p->ntasks; i++) if (p->tasks[i].system == SYS_WAKE) { o->wake = o->start[i]; break; }
    o->before_wake = now_m < o->wake;
    o->has_timed = p->ntasks > 0;
    if (p->ntasks) o->day_over = now_m >= p->tasks[p->ntasks - 1].end;
    for (int i = 0; i < p->ntasks; i++) {
        if (p->tasks[i].system != SYS_BEDTIME) continue;
        int until = o->start[i] - now_m;
        o->drowsy = until > 0 && until <= 40;
        break;
    }
    if (o->day_over) return;

    /* categorizeTasks */
    int up[DAY_MAX_TASKS], nup = 0, late[DAY_MAX_TASKS], nlate = 0;
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        if (done(t) || o->missed[i]) continue;
        int s = o->start[i], e = o->eff_end[i];
        if (now_m >= e) {
            if (t->important) late[nlate++] = i;   /* must-finish tasks stay in play */
            continue;
        }
        if (o->current < 0 && now_m >= s && now_m < e) o->current = i;
        else up[nup++] = i;
    }
    /* A started (or waiting) task stops for a meal or event: that row takes the screen, the task carries on after. */
    if (o->current >= 0 && o->run_start[o->current] >= 0) {
        for (int k = 0; k < nup; k++) {
            const day_task_t *f = &p->tasks[up[k]];
            if (!pauser(f) || now_m < o->start[up[k]] || now_m >= f->end) continue;
            int paused = o->current;
            o->current = up[k];
            memmove(up + 1, up, sizeof(int) * (size_t)k);
            up[0] = paused;
            o->paused = paused;
            break;
        }
    }
    /* Done with the bedtime routine and bed is next: straight to bed, no free time between. */
    if (o->current < 0 && nup && p->tasks[up[0]].system == SYS_BEDTIME) {
        int bed = up[0], before = -1;
        for (int i = 0; i < p->ntasks; i++) if (o->start[i] < o->start[bed]) before = i;
        if (before >= 0 && p->tasks[before].bedtime_routine && (done(&p->tasks[before]) || now_m >= o->start[before])) {
            o->current = bed;
            memmove(up, up + 1, sizeof(int) * (size_t)--nup);
        }
    }
    /* Keep the unfinished must-finish task in focus, except over bedtime and events. */
    o->nstill = 0;
    if (nlate) {
        const day_task_t *cur = o->current >= 0 ? &p->tasks[o->current] : NULL;
        if (!cur || (cur->system != SYS_BEDTIME && !cur->event)) {
            if (o->current >= 0) { memmove(up + 1, up, sizeof(int) * (size_t)nup); up[0] = o->current; nup++; }
            o->current = late[0];
            for (int k = 1; k < nlate; k++) o->still[o->nstill++] = late[k];
        } else {
            for (int k = 0; k < nlate; k++) o->still[o->nstill++] = late[k];
        }
    }
    o->nupcoming = MIN(nup, 3);
    for (int k = 0; k < o->nupcoming; k++) o->upcoming[k] = up[k];
    if (o->current >= 0) {
        const day_task_t *c = &p->tasks[o->current];
        o->overdue = o->run_start[o->current] >= 0
                   ? (!o->waiting[o->current] && logic_run_remaining(o, p, o->current, now_s) < 0)
                   : (c->important && now_m >= c->end);
        return;
    }

    /* getFreeTimeCountdown */
    if (!o->nupcoming) return;
    int next = o->upcoming[0];
    for (int w = 0; w < o->reserve.nwin; w++) {
        const free_window_t *fw = &o->reserve.win[w];
        if (now_s >= fw->original_start && now_s < fw->end) {
            if (now_s < fw->start) return; /* the worm already ate this part */
            o->free = true;
            o->free_total = fw->end - fw->start;
            o->free_remaining = fw->end - now_s;
            return;
        }
    }
    for (int i = 0; i < p->ntasks; i++) {
        int32_t lost = o->reserve.loss[i];
        if (lost && now_s >= start_s(&p->tasks[i]) && now_s < start_s(&p->tasks[i]) + lost) return;
    }
    int32_t next_start = o->start[next] * 60;
    o->free = true;
    o->free_remaining = MAX(0, next_start - now_s);
    o->free_total = MAX(60, o->free_remaining);
}
