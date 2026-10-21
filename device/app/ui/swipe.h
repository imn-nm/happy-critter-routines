/*
 * Swipe left or right to close a screen that was opened by a tap (Field Kit rule: no ✕ or back
 * buttons). Measured on the input device from press to release, so a slow swipe counts, and a
 * swipe over a list that scrolls a little still counts. The swipe goes to the topmost screen on
 * lv_layer_top() that asked for swipes; the button the finger started on doesn't also get a tap.
 */
#pragma once
#include "lvgl.h"

#define SWIPE_LEFT (-1)
#define SWIPE_RIGHT 1
#define SWIPE_DOWN 2      /* a quick flick down: puts the schedule sheet away, snoozes the alarm */
#define SWIPE_UP 3        /* a quick flick up: lifts the schedule sheet from Home */
/* A flick up or down that scrolled a list (the checklist, the schedule) is only a scroll. */

/* dir: SWIPE_LEFT, SWIPE_RIGHT, SWIPE_DOWN or SWIPE_UP; start: where the finger went down (screen px).
 * Called twice: first with commit = false, as the finger lifts, to ask whether it's a swipe for
 * this screen (return false for a drag that belongs to a game); then with commit = true, once the
 * touch has been handled, to act on it. */
typedef bool (*swipe_cb_t)(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit);

/* Hook every pointer input device (call once, after the touch input exists). */
void swipe_init(void);

/* `owner` gets the swipes while it's the topmost screen; forgotten when it's deleted. */
void swipe_add(lv_obj_t *owner, swipe_cb_t cb, void *user);

/* Swipes when nothing is open over the day (the carousel); owner is NULL in the call. */
void swipe_set_base(swipe_cb_t cb);

/* The finger's travel while it is down on the day (nothing open over it): called as it moves,
 * then once more with end = true as it lifts. The day can lean with it before the swipe lands. */
typedef void (*swipe_drag_cb_t)(int32_t dx, int32_t dy, bool end);
void swipe_set_drag(swipe_drag_cb_t cb);
/* Where the finger went down (the press now, or the last one). */
lv_point_t swipe_start(void);
