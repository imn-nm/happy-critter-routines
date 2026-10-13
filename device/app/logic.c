#include "logic.h"
#include <string.h>

#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

static int32_t start_s(const day_task_t *t) { return t->start * 60; }
static int32_t total_s(const day_task_t *t) { return (t->end - t->start) * 60; }
static bool done(const day_task_t *t) { return t->done_at >= 0; }

/* How much of a task a running-late day may take (timeReserve.ts giveableSeconds). */
static int32_t giveable(const day_task_t *t)
{
    if (t->important) return 0;
    if (t->late == LATE_SKIP) return total_s(t);
    if (t->late == LATE_SHORTEN) return MAX(0, total_s(t) - t->min_minutes * 60);
    return 0;
}

/* A task finished early only occupies the day until it was done (whole minutes). */
static int32_t busy_until(const day_task_t *t)
{
    int32_t end = start_s(t) + total_s(t);
    if (!done(t)) return end;
    return MAX(start_s(t), MIN(end, (t->done_at / 60) * 60));
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
        int32_t occupied = busy_until(&p->tasks[0]);
        for (int i = 1; i < p->ntasks; i++) {
            const day_task_t *t = &p->tasks[i];
            if (start_s(t) > occupied) rs[n++] = (res_t){ -1, occupied, start_s(t) - occupied, start_s(t) - occupied, 0 };
            occupied = MAX(occupied, busy_until(t));
        }
    }
    int ngaps = n;
    /* then tasks that may give up time: "skip" before "shorten", then list order */
    for (int rank = 0; rank < 2; rank++)
        for (int i = 0; i < p->ntasks; i++) {
            const day_task_t *t = &p->tasks[i];
            if (giveable(t) <= 0 || (rank == 0) != (t->late == LATE_SKIP)) continue;
            rs[n++] = (res_t){ i, start_s(t), total_s(t), giveable(t), 0 };
        }
    /* replay today's late spans of must-finish tasks; overlapping spans count once */
    int32_t iv_start[DAY_MAX_TASKS], iv_end[DAY_MAX_TASKS];
    int niv = 0;
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        if (!t->important) continue;
        int32_t s = start_s(t) + total_s(t);
        int32_t e = done(t) ? MIN(now, t->done_at) : now;
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
    (void)n;
    int32_t left = p->tasks[task].end * 60 - now_s;
    return left <= 0 ? 0 : (left + 59) / 60;
}

void logic_now(const day_plan_t *p, int32_t now_s, logic_now_t *o)
{
    memset(o, 0, sizeof(*o));
    o->current = -1;
    const int now_m = now_s / 60;
    reserve(p, now_s, &o->reserve);

    /* time given up to a late day delays the start; the end stays fixed */
    for (int i = 0; i < p->ntasks; i++) {
        const day_task_t *t = &p->tasks[i];
        int32_t lost = o->reserve.loss[i];
        int dur = t->end - t->start;
        int lost_m = lost ? MIN(dur, (lost + 59) / 60) : 0;
        o->start[i] = (int16_t)(t->start + lost_m);
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
        if (done(t)) continue;
        int s = o->start[i], e = t->end;
        if (now_m >= e) {
            if (t->important) late[nlate++] = i;   /* must-finish tasks stay in play */
            continue;
        }
        if (o->current < 0 && now_m >= s && now_m < e) o->current = i;
        else up[nup++] = i;
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
        o->overdue = c->important && now_m >= c->end;
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
