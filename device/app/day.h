/*
 * Today's plan as the device receives it (device/docs/day-plan.md). The server does the
 * scheduling the web app does in ChildInterface.getTodaysSchedule (built-in rows, weekend
 * times, tieDay, events with get-ready time, auto-placement, clamping), so the device gets
 * concrete times. The device then does the live part on its own clock (logic.h).
 */
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define DAY_MAX_TASKS 40
#define DAY_MAX_STEPS 10
#define DAY_MAX_CHORES 16
#define DAY_MAX_REWARDS 12
#define DAY_MAX_STREAKS 4
#define DAY_MAX_WHEEL 8

typedef enum { SYS_NONE, SYS_WAKE, SYS_BREAKFAST, SYS_SCHOOL, SYS_LUNCH, SYS_DINNER, SYS_BEDTIME } day_system_t;
typedef enum { LATE_KEEP, LATE_SHORTEN, LATE_SKIP } day_late_t;

typedef struct {
    char id[40];
    char text[56];
} day_step_t;

typedef struct {
    char id[40];
    char title[44];
    char icon[20];
    char say[48];              /* optional: what Biscuit says (else from the task) */
    int16_t start, end;        /* minutes of the day; events include their get-ready time */
    int16_t event_start;       /* events: when the event itself starts; -1 otherwise */
    bool event;
    bool important;            /* must finish */
    bool fun;                  /* fun time: no done button, gives way when running late */
    bool fixed;                /* a set-time task: never pulled forward, pauses a started task */
    bool needs_start;          /* waits for the button; its timer runs from the press (logic.c) */
    int32_t started_at;        /* seconds of the day the child started it (Start, or "next now"), or -1 */
    bool bedtime_routine;
    day_system_t system;
    day_late_t late;
    int16_t min_minutes;       /* "shorten": the least it may take */
    int8_t activity;           /* pet_activity_t, or -1: guess from the title */
    uint8_t nsteps;
    day_step_t steps[DAY_MAX_STEPS];
    int32_t done_at;           /* seconds of the day it was first marked done, or -1 */
} day_task_t;

typedef struct {
    char id[40];
    char title[44];
    char icon[20];
    int16_t from, to;          /* window, or -1 = any time today */
    bool done;
} day_chore_t;

typedef enum { REWARD_NONE, REWARD_WAITING, REWARD_APPROVED, REWARD_DENIED } day_reward_state_t;

typedef struct {
    char id[40];
    char title[44];
    char icon[20];
    uint32_t color;            /* its icon colour */
    int16_t cost;
    day_reward_state_t state;
    char note[128];            /* denied: the grown-up's short reason ("Maybe at the weekend!") */
    char note_id[40];          /* that note's id: the device says "note_seen" once it has shown it */
} day_reward_t;

typedef struct {
    char id[40];
    char title[32];
    char icon[20];
    uint8_t goal, count;       /* stars in the row, how many so far */
    int16_t prize;             /* stars the big star gives */
    bool night;                /* a bedtime streak: tonight's star shows at bedtime */
} day_streak_t;

typedef struct {
    char date[11];             /* YYYY-MM-DD */
    struct {
        char id[40];
        char name[24];
        char pet[16];
        char character[12];    /* pet_type: rabbit, robot, fox (others draw as the rabbit) */
        char color[12];        /* pet_color: the colour option's name, or "" for its own */
        bool picture;          /* picture view (under 7) */
        int16_t stars;
        int16_t wake;          /* today's wake-up, minutes */
        char outfit[3][12];    /* head, face, neck accessory ids */
        char star_note[128];   /* why the last stars were given ("For tidying up without asking") */
        char star_note_id[40]; /* that note's id ("note_seen" once shown), or "" */
        int16_t star_note_stars; /* how many stars it came with (to replay them if it comes late) */
    } child;
    bool rest_day;
    uint8_t ntasks, nchores, nrewards, nstreaks, nwheel;
    day_task_t tasks[DAY_MAX_TASKS];          /* sorted by start */
    day_chore_t chores[DAY_MAX_CHORES];
    day_reward_t rewards[DAY_MAX_REWARDS];
    day_streak_t streaks[DAY_MAX_STREAKS];
    char wheel[DAY_MAX_WHEEL][20];
} day_plan_t;

/* Parse a plan. Returns false (and leaves *out untouched) if the JSON is not a plan. */
bool day_parse(const char *json, size_t len, day_plan_t *out);

/* "07:15" -> 435, or -1. */
int day_parse_hhmm(const char *s);

int day_task_index(const day_plan_t *p, const char *id);
