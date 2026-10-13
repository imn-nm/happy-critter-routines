/*
 * The live part of the day, recomputed every second on the device's own clock. A port of the
 * web app's child screen (src/pages/ChildInterface.tsx: categorizeTasks, getFreeTimeCountdown,
 * isDayOver, drowsy) and src/utils/timeReserve.ts (calculateTimeReserve: finishing early frees
 * the rest of a task's window; a must-finish task running late eats free time first, then
 * "skip if needed" tasks, then "shorten if needed" ones).
 */
#pragma once
#include "day.h"

typedef struct {
    int32_t original_start, start, end;   /* seconds of the day */
} free_window_t;

typedef struct {
    free_window_t win[DAY_MAX_TASKS];
    int nwin;
    int32_t loss[DAY_MAX_TASKS];          /* seconds each task gave up to a late day */
    bool free_reserve;                    /* the worm eats free time (else an optional task) */
    int reserve_task;                     /* when not free time: the task being eaten, or -1 */
    int32_t reserve_total, reserve_remaining;
} reserve_t;

typedef struct {
    int16_t start[DAY_MAX_TASKS];         /* starts after losses (a late day delays them) */
    int current;                          /* task index or -1 */
    int upcoming[3];
    int nupcoming;
    int still[DAY_MAX_TASKS];             /* late must-finish tasks waiting: "Other things to finish" */
    int nstill;
    bool day_over, before_wake, drowsy, has_timed;
    bool overdue;                         /* the current task is must-finish and past its end */
    bool free;                            /* in a free-time window */
    int32_t free_total, free_remaining;   /* seconds */
    int16_t wake;                         /* today's wake-up, minutes */
    reserve_t reserve;
} logic_now_t;

void logic_now(const day_plan_t *p, int32_t now_s, logic_now_t *out);

/* Minutes of the task's window still to go (rounded up), from now. */
int logic_minutes_left(const logic_now_t *n, const day_plan_t *p, int task, int32_t now_s);
int16_t logic_start(const logic_now_t *n, const day_plan_t *p, int task);
