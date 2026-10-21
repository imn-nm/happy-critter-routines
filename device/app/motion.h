/*
 * Motion: what the accelerometer tells the app. The platform pushes raw samples (g units,
 * 50 to 100 Hz) through mytoki_motion(); the games read the signals below. Only acceleration
 * is used (the product has a 3-axis LIS2DH12, no gyro): gravity for tilt, the high-frequency
 * part for shakes and knocks, quiet for holding still.
 *
 * Device frame: +x to the right of the screen, +y toward 12 o'clock, +z out of the screen.
 * Flat and screen up reads (0, 0, +1). Lowering the right edge gives ax < 0; lowering the
 * bottom edge gives ay > 0.
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

/* one sample, in g, with the LVGL tick it arrived on */
void motion_push(float ax, float ay, float az, uint32_t now_ms);

/* Tilt in screen space, each -1..1: x > 0 the right edge is low, y > 0 the bottom edge is low.
 * Full tilt (1.0) is MOTION_TILT_FULL_G of gravity, about 30 degrees. Measured from level, which is
 * lying flat until motion_level() says otherwise. */
void motion_tilt(float *x, float *y);
/* How far from level, in g (0 = level). */
float motion_lean(void);
/* However it is held now counts as level (a child holds it tipped towards them, not flat): a game
 * calls it as it starts, so tipping it any way from there tilts. */
void motion_level(void);
/* Shaking, 0..1: peak-held, fading in about MOTION_SHAKE_DECAY_MS. */
float motion_shake(void);
/* Knocks (sharp taps on the body) since the last call; the count is cleared. */
int motion_taps(void);
/* A platform with a hardware click detector (the LIS2DH12 interrupt) adds them here. */
void motion_add_taps(int n);
/* How long it has been quiet, in ms. */
uint32_t motion_still_ms(void);
/* How long it has lain still, in ms: quieter than a hand holding it (put down on a table). */
uint32_t motion_rest_ms(void);
/* The last sample's movement, in g (gravity taken out): a pickup is well over MOTION_PICKUP_G. */
float motion_energy(void);
/* Screen facing down. */
bool motion_face_down(void);
/* A sample arrived within MOTION_STALE_MS: the platform has a sensor. */
bool motion_alive(uint32_t now_ms);
/* At a game start: forget shakes, knocks and the stillness so far. */
void motion_reset(void);

#define MOTION_GRAV_TAU_MS 120.0f    /* gravity low-pass */
#define MOTION_TILT_FULL_G 0.50f     /* 30 degrees reads as full tilt */
#define MOTION_TILT_DEAD_G 0.06f     /* under this it is level */
#define MOTION_SHAKE_FLOOR_G 0.35f   /* high-pass energy below this is not a shake */
#define MOTION_SHAKE_FULL_G 1.5f     /* energy that reads as shake 1.0 */
#define MOTION_SHAKE_DECAY_MS 300.0f
#define MOTION_TAP_G 1.1f            /* a spike that may be a knock */
#define MOTION_TAP_SETTLE_MS 120     /* it must go quiet again within this, else it was a shake */
#define MOTION_TAP_GAP_MS 200        /* two knocks closer than this count once */
#define MOTION_STILL_G 0.08f         /* quiet threshold */
#define MOTION_REST_G 0.02f          /* put down: under a hand's tremble, over the sensor's own noise */
#define MOTION_PICKUP_G 0.06f        /* picked up (or the table knocked) */
#define MOTION_FACE_DOWN_G -0.5f
#define MOTION_DT_MIN_MS 4
#define MOTION_DT_MAX_MS 100
#define MOTION_STALE_MS 600
