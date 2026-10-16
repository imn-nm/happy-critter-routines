/*
 * Biscuit on the device: the app's behaviour engine (SpritePet.tsx) driving the frames exported
 * from the app's own pixel code (pet_data.c), drawn in the Field Kit "LED field" style:
 * dim unlit dots, the room's features lit, Biscuit solid on the same grid, effects as lit dots.
 */
#pragma once
#include "lvgl.h"
#include "pet_data.h"

typedef enum {
    PET_MOOD_NONE,      /* hold still */
    PET_MOOD_IDLE,
    PET_MOOD_HAPPY,
    PET_MOOD_EXCITED,
    PET_MOOD_DROWSY,    /* the last 40 minutes before bed: yawns now and then */
    PET_MOOD_CELEBRATE,
    PET_MOOD_SLEEP,
    PET_MOOD_EATING,
} pet_mood_t;

typedef enum {
    PET_ACT_NONE,
    PET_ACT_BRUSHING,
    PET_ACT_EATING,
    PET_ACT_READING,
    PET_ACT_GAMING,
    PET_ACT_SLEEPING,
    PET_ACT_SPORTS,
    PET_ACT_DRAWING,
    PET_ACT_BUBBLES,
    PET_ACT_OUTSIDE,
} pet_activity_t;

typedef struct {
    float pitch;        /* LED pitch in px: 3.8 on the 232 px ring */
    uint8_t dim;        /* 0 = full brightness, 255 = black (night) */
    lv_color_t bg;      /* the screen behind the round scene */
    int8_t dx, dy;      /* shift the LED window over the grid, in cells */
    bool wide;          /* a strip across the screen: the room's walls carry on sideways */
    bool room_off;      /* only Biscuit (and his effects): the room's LEDs stay dark */
    bool solid;         /* MyToki 2: plain pixel art, full squares (no LED dots) */
} pet_look_t;

/* MyToki 2 (Figma "Scene"): Biscuit is the same size in every room, 3.609 px per cell, the room
 * drawn solid and carried on to the rim. */
#define PET_PITCH 3.609f

/* A round scene `diameter` px wide (MyToki 2: 466 fills the screen, 298 is the small circle under
 * 10 min left). Tapping it makes him react (see pet_set_tappable). */
lv_obj_t *pet_create(lv_obj_t *parent, int32_t diameter);
void pet_set_look(lv_obj_t *pet, const pet_look_t *look);
pet_look_t pet_default_look(int32_t diameter);

void pet_set_mood(lv_obj_t *pet, pet_mood_t mood);
void pet_set_activity(lv_obj_t *pet, pet_activity_t act);
/* Play one clip forever (or -1 to go back to mood and activity). */
void pet_force_clip(lv_obj_t *pet, int clip);
/* A one-shot reaction (a wave when the child comes back, a peek at the clock). */
void pet_react(lv_obj_t *pet, pet_clip_id_t clip);
void pet_set_tappable(lv_obj_t *pet, bool on);
/* The morning alarm: he sits up and stretches (the Sleepy clip's outro, the room at dawn) and
 * holds there until the next mood or clip. */
void pet_wake_up(lv_obj_t *pet);
/* Skip straight into the loop of a looping clip (waking up the device at night: he's already asleep). */
void pet_skip_intro(lv_obj_t *pet);
/* He landed from a jump (Celebrate): sparks from his paws, say. One callback for every pet. */
void pet_set_on_land(void (*cb)(lv_obj_t *pet, void *user), void *user);
/* Where his paws are, in his parent's coordinates. */
void pet_paws(lv_obj_t *pet, int32_t *left_x, int32_t *right_x, int32_t *y);
/* Hold the current frame (e.g. while a page is off screen). */
void pet_set_paused(lv_obj_t *pet, bool paused);
const char *pet_current_clip_name(lv_obj_t *pet);

/* Which character the child has (pet_chars) and in which of its colours, everywhere. Saved by the
 * caller. Every scene redraws at once. */
void pet_set_character(int character, int colour);
void pet_get_character(int *character, int *colour);
int pet_char_by_id(const char *id);          /* "robot" -> index, or -1 */
int pet_colour_by_name(int character, const char *name);   /* "mint" (any case) -> index, or 0 */
/* The current character's frame and pose; the colour swap for a grid of palette indices. */
const pet_frame_t *pet_frame_of(int frame);
const uint16_t *pet_frame_outfit_of(int frame);
const pet_pose_t *pet_pose_of(pet_pose_id_t pose);
void pet_apply_colour(uint8_t *grid, int n);
/* Is this palette entry the current character's body (where mud and soap show)? */
bool pet_is_body(uint8_t idx);

/* What he wears, everywhere: an accessory per slot, or -1. Saved by the caller. */
void pet_set_outfit(int head, int face, int neck);
void pet_get_outfit(int *head, int *face, int *neck);
int pet_acc_by_name(const char *name);

/* Each child's rabbit has its own ways (personality.ts): from the child's id. */
void pet_set_personality(const char *seed);
/* A free-time activity this rabbit loves: usually its favourite, sometimes the next two. */
pet_activity_t pet_pick_free_time_activity(void);

/* Change the scene's size (the waiting clock's room is a little smaller). */
void pet_set_size(lv_obj_t *pet, int32_t diameter);

/* The pet's face as plain pixel art, `cell` px per pixel, on `bg` (the Play pill, the wheel's hub). */
lv_obj_t *pet_face_create(lv_obj_t *parent, int cell, lv_color_t bg);
/* Any character's face in one of its colours (the buddy picker's tiles). */
lv_obj_t *pet_face_create_of(lv_obj_t *parent, int character, int colour, int cell, lv_color_t bg);
