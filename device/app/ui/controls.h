/*
 * The pull-down, over every screen: the battery, and two big sliders for brightness and sound. A
 * pull down from the top edge (SWIPE_PULL_EDGE) brings it with the finger; a flick up or sideways,
 * a tap off the sliders or the button puts it away.
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef struct {
    int battery;        /* 0..100 */
    bool charging;      /* plugged in */
    int brightness;     /* CONTROLS_BRIGHT_MIN..100: how much of the screen's usual brightness */
    int volume;         /* 0..100 */
} controls_values_t;

#define CONTROLS_BRIGHT_MIN 10   /* never dark: the screen still shows at the bottom of the slider */

/* get: the values when it opens; set: as a slider moves (done = false) and as it's let go (done =
 * true, keep them). */
typedef void (*controls_get_t)(controls_values_t *v);
typedef void (*controls_set_t)(const controls_values_t *v, bool done);
void controls_init(controls_get_t get, controls_set_t set);

/* From swipe_set_pull: the finger's travel down, then end = true as it lifts. */
void controls_pull(int32_t dy, bool end);
/* The battery changed while it's open. */
void controls_battery(int battery, bool charging);
bool controls_is_open(void);
void controls_close(void);
