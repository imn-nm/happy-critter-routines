/*
 * Biscuit's Playtime games on the LED stage: Dress up (in My pet), Bath time, Carrot catch and
 * Bubble pop, ported from src/components/pets/playtime (*.tsx game classes) and grown since. Roll
 * home and the classic games are drawn crisp in classic.c. Play never pays stars.
 */
#pragma once
#include "stage.h"

typedef enum {
    GAME_DRESSUP, GAME_BATH, GAME_CARROT, GAME_BUBBLES,
    GAME_COUNT
} game_id_t;

/* What the screen around the stage shows. */
typedef struct {
    char line1[72], line2[72];
    int step;          /* Bath time: 0 scrub, 1 rinse, 2 dry, 3 done */
    float progress;    /* Bath time: how far the step has got, 0..1 */
    int state;         /* Carrot catch, Bubble pop: 0 ready, 1 playing, 2 end */
    int score;         /* carrots caught, bubbles popped */
    int best;          /* the personal best, when the game keeps one */
    bool record;       /* the round just ended with a new best */
} game_ui_t;

void game_start(game_id_t id, const char *pet_name);
game_id_t game_current(void);
void game_update(float dt);
void game_draw(stage_t *s);
void game_press(float x, float y);
void game_move(float x, float y);
void game_release(void);
void game_ui(game_ui_t *ui);
/* Does a drag on the stage belong to the game (so it must not close the screen)? */
bool game_drags(void);
/* Is that drag game under way right now (Carrot catch playing, Bath time not finished)? */
bool game_drag_active(void);

/* Carrot catch */
void carrot_play(void);
/* Dress up: wear (or take off) an accessory; returns true if it changed. */
bool dressup_wear(int acc);
/* Biscuit facing the child in the Playtime menu, waving now and then */
void menu_draw(stage_t *s, float now);
