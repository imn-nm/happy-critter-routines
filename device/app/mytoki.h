/*
 * The MyToki child app: entry points a platform calls. See hal.h for what the platform provides.
 * All of these run on the LVGL thread (on the board: with the display lock held).
 */
#pragma once
#include <stddef.h>

/* Build the screen and ask for today's plan. Call once, after LVGL, the display and touch exist. */
void mytoki_start(void);

/* The hardware button at 1 o'clock was pressed. */
void mytoki_button(void);

/* Today's day plan arrived (JSON, device/docs/day-plan.md). The text is copied. */
void mytoki_day_received(const char *json, size_t len);

/* The plan could not be fetched. reason: 0 = no network, 3 = not paired yet (the device shows its
 * pairing code), otherwise a server or parse error. */
void mytoki_day_failed(int reason);

/* Developer hooks used by the simulator's panel ("crash", "approved", "star", ...). */
void mytoki_debug(const char *command);
