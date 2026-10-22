/*
 * What the MyToki app needs from the device it runs on.
 *
 * Everything under device/app is the same code on the simulator and on the Waveshare
 * ESP32-S3-Touch-AMOLED-1.75C. A platform (device/platform/sim or device/platform/esp32s3)
 * creates the LVGL display and touch input, implements these functions, and calls the
 * mytoki_* entry points in mytoki.h. Nothing here may block the LVGL thread.
 */
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Local wall-clock time. weekday: 0 = Sunday. */
typedef struct {
    int year, month, day;
    int hour, minute, second, ms;
    int weekday;
} hal_time_t;

void hal_time_now(hal_time_t *out);

/* Ask for today's day plan (JSON, see device/docs/day-plan.md). The answer arrives later
 * through mytoki_day_received() or mytoki_day_failed(), called on the LVGL thread. */
void hal_request_day(void);

/* Hand a change to the server: a task done, a chore done, a reward asked for, an outfit.
 * Must return at once; the platform keeps it and retries while offline. */
void hal_send(const char *json);

/* Small persistent store: NVS on the board, localStorage in the simulator. */
bool hal_store_get(const char *key, char *buf, size_t len);
void hal_store_set(const char *key, const char *value);

typedef enum {
    HAL_SOUND_START,     /* a task begins */
    HAL_SOUND_DONE,      /* the button finished something */
    HAL_SOUND_TICK,      /* a step ticked */
    HAL_SOUND_SOON,      /* 5 minutes to go */
    HAL_SOUND_CHIME,     /* the MyToki chime: G5 then C6 (a new star, approved) */
    HAL_SOUND_BEDTIME,
    HAL_SOUND_ALARM,     /* the morning alarm: a music-box phrase (C5 E5 G5 E5), looped while it rings */
    HAL_SOUND_ALARM_SOFT,   /* the same phrase, quiet: the alarm's first 20 seconds */
    HAL_SOUND_ALARM_MID,    /* and a little louder: the next 20 */
    /* the games: short and quiet, under the chimes */
    HAL_SOUND_POP,       /* a bubble, a brick, a good tap */
    HAL_SOUND_EAT,       /* a snack eaten, a pair found */
    HAL_SOUND_BOUNCE,    /* off the paddle, into a wall */
    HAL_SOUND_FLIP,      /* a card turned, a little dot munched */
    HAL_SOUND_MISS,      /* a slip: soft, two notes down */
    HAL_SOUND_WIN,       /* a maze or a wall cleared */
    HAL_SOUND_LOSE,      /* the game is over: gentle, three notes down */
    HAL_SOUND_POWER,     /* a power-up: four notes up */
} hal_sound_t;
void hal_play(hal_sound_t sound);
/* How loud the sounds play, 0-100 (0: silent); the child sets it in the pull-down. */
void hal_set_volume(uint8_t percent);

/* Picture view reads things out. A platform without a voice may do nothing. */
void hal_speak(const char *text);

/* Panel brightness, 0-100. Night drops it. */
void hal_set_brightness(uint8_t percent);

uint32_t hal_random_u32(void);

/* The handheld is sitting on its dock (charging): the night clock. */
bool hal_docked(void);

/* Whether the screen goes off when the handheld is put down (the board; not the simulator or the
 * web app). hal_screen turns it off, and stops drawing, or back on; on, it lights up once the
 * screen is redrawn, at the brightness last asked for. */
bool hal_screen_sleeps(void);
void hal_screen(bool on);

/* Battery charge, 0-100 (100 when the platform can't tell). */
int hal_battery(void);
/* A charger is plugged in (on the dock, or a cable). */
bool hal_charging(void);

/* Whether the network is up right now (for the "Saved here" note). */
bool hal_online(void);
