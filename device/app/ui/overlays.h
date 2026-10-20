/*
 * Screens that open over Home and close with a swipe left or right (or by themselves).
 */
#pragma once
#include "lvgl.h"
#include "../day.h"
#include "../logic.h"

typedef void (*overlay_cb_t)(int arg);
typedef void (*schedule_cb_t)(int chore_index);

/* Today's schedule (Figma "Day · Today's schedule"): a wheel of three rows over Home, opened from
 * the Next pill. Swipe up or down to turn it, sideways to close. Tap a chore's ring to tick it. */
void schedule_open(const day_plan_t *p, const logic_now_t *n, int now_min, bool picture, schedule_cb_t on_chore);
/* What the sheet covers (the Home page): it sits back, smaller and dimmer, while the sheet is on
 * its way up or being pulled down. */
void overlay_set_backdrop(lv_obj_t *under);
/* The day changed (a chore was ticked): redraw, keeping the row in the middle. */
void schedule_refresh(const day_plan_t *p, const logic_now_t *n, int now_min);
bool schedule_is_open(void);
void schedule_close(void);

/* Rewards · 02 · Choose and ask: the reward bigger, its price, Ask for this / Not now.
 * on_ask(index) when the child asks. */
void reward_choose_open(const day_reward_t *r, int index, int stars, overlay_cb_t on_ask);
/* Rewards · 03 · Waiting: "Asked!", the stars saved for it, Back to shop. */
void reward_asked_open(const day_reward_t *r);

/* Other things to finish: late must-finish tasks waiting while an event or bedtime is on. */
void others_open(const day_plan_t *p, const logic_now_t *n, int32_t now_s, overlay_cb_t on_done);
void others_refresh(const day_plan_t *p, const logic_now_t *n, int32_t now_s);
bool others_is_open(void);

/* "Dinner soon" (Figma Free time · Dinner soon): once per free window, five minutes before the
 * next thing; a tap or 15 s closes it. */
void reminder_open(const char *next_icon, const char *next_title, const char *next_time, int32_t seconds_left, bool picture);
void reminder_update(int32_t seconds_left);
bool reminder_is_open(void);

/* A grown-up said yes to a reward (Figma Rewards · 05 · Approved!). */
void approved_open(const day_reward_t *r, const char *child_name, const char *pet_name);

/* A grown-up said no, or later (Rewards · 06 · Not this time). note: their short reason, or "".
 * on_shop opens Rewards. */
void denied_open(const day_reward_t *r, const char *note, overlay_cb_t on_shop);
/* The note for reward `reward_id` came after its "Not this time" opened: put it in, if that screen
 * is still up. False when it isn't. */
bool denied_set_note(const char *reward_id, const char *note);

/* A grown-up gave stars (Rewards · 07 · You got a star!): how many just arrived, the new total,
 * and their reason (or ""). */
void stars_open(int delta, int total, const char *note);
/* The grown-up's reason came after "You got a star!" opened without one: show it there, if that
 * screen is still up. False when it isn't (or already has a reason). */
bool stars_set_note(const char *note);

/* A streak star: `big` when the row is complete. on_shop opens Rewards. */
void streak_open(const day_streak_t *s, bool big, const char *shop_line, overlay_cb_t on_shop, bool picture);

/* The battery is low (Connection · Battery low): "Put me on my dock". Closes after 20 s, when
 * docked, or with a swipe. */
void battery_open(int percent);
void battery_close(void);
bool battery_is_open(void);

typedef enum { SYS_SCREEN_NONE, SYS_SCREEN_LOADING, SYS_SCREEN_OFFLINE, SYS_SCREEN_ERROR, SYS_SCREEN_PAIRING } sys_screen_t;
/* detail: Loading = the title ("Hello, Amira!") or NULL; Pairing = the code ("48 21"). */
void system_show(sys_screen_t which, const char *detail, overlay_cb_t on_retry);
sys_screen_t system_showing(void);

void overlays_close_all(void);
/* Left alone for a while: the schedule and the to-finish list slide away. */
void overlays_close_idle(void);
