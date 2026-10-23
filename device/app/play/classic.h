/*
 * The classic games (Figma "13 · Classic games", 1291:4897): Snack Trail, Brick Bounce, Pet Pairs and
 * Snack Drop, and Roll home (a marble maze). Drawn crisp on the whole display (not Biscuit's LED
 * stage), inside Playtime's frame: its header, play time pill, timer and status pill. Made for a
 * 10-year-old: easy to understand, not easy to win; each keeps its best. Touch where it plays best
 * (Brick Bounce takes a tilt too, Roll home is all tilt); only the button at 1 o'clock leaves a game.
 */
#pragma once
#include <stdbool.h>
#include <stddef.h>
#include "lvgl.h"

typedef enum { CL_TRAIL, CL_BRICKS, CL_PAIRS, CL_DROP, CL_ROLL, CL_COUNT } classic_id_t;

/* The game's drawing surface: the whole display, hidden until a game starts. */
lv_obj_t *classic_create(lv_obj_t *parent);
void classic_start(classic_id_t id);
/* The game stops (its timer goes); the surface hides. */
void classic_stop(void);
bool classic_running(void);
classic_id_t classic_current(void);
/* What the status pill shows (icon, words); false: no pill (the game draws its own, or none now). */
bool classic_status(char *icon, size_t icon_n, char *text, size_t text_n);
/* Where the status pill's top goes (Brick Bounce: above the paddle's track). */
int classic_status_y(void);
/* Roll home's maze fills the screen: its header is the clock and the play time pill, no name. */
bool classic_wide(void);
