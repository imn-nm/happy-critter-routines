/*
 * The Playtime games. The first five are ported from src/components/pets/playtime (*.tsx game
 * classes); the three motion games (Roll home, Biscuit says, Carrot stack) read the
 * accelerometer through app/motion.h and live only here. Play never pays stars and nothing
 * can be failed.
 */
#pragma once
#include "stage.h"

typedef enum {
    GAME_DRESSUP, GAME_BATH, GAME_CARROT, GAME_BUBBLES, GAME_PEEKABOO,
    GAME_ROLL, GAME_SAYS, GAME_STACK,
    GAME_COUNT
} game_id_t;

/* What the screen around the stage shows. */
typedef struct {
    char line1[72], line2[72];
    int step;          /* Bath time: 0 scrub, 1 rinse, 2 dry, 3 done */
    float progress;    /* Bath time: 0..1; Biscuit says: the answer window left */
    int state;         /* Carrot catch: 0 ready, 1 playing, 2 end; the motion games' state too */
    int score;         /* carrots caught, bubbles popped, times Biscuit was found, the run, the height */
    int best;          /* the personal best, when the game keeps one */
    bool found;        /* Peekaboo: he's just been found */
    char cue_icon[20]; /* Biscuit says: the move he is calling (icon + word), empty otherwise */
    char cue[16];
} game_ui_t;

void game_start(game_id_t id, const char *pet_name);
game_id_t game_current(void);
void game_update(float dt);
void game_draw(stage_t *s);
void game_press(float x, float y);
void game_move(float x, float y);
void game_release(void);
/* The hardware button at 1 o'clock (Biscuit says: "Button"). */
void game_button(void);
/* Is the button part of the game right now (a Biscuit says round)? Otherwise it leaves the game. */
bool game_wants_button(void);
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
