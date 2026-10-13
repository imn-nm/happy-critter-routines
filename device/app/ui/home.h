/*
 * Home: the middle page of the carousel. Most of the MyToki Circle screens are this one layout
 * (header, dot ring round Biscuit's room, a message card, the Next pill) in different states,
 * so the controller (mytoki.c) fills a view and Home draws it.
 */
#pragma once
#include "lvgl.h"
#include "widgets.h"
#include "../pet/pet.h"

typedef enum { MID_PET, MID_WHEEL, MID_OVERDUE, MID_NONE } home_mid_t;   /* NONE: a steps card sits in Biscuit's place */
typedef enum { BOTTOM_NONE, BOTTOM_NEXT, BOTTOM_PLAY, BOTTOM_WHEEL, BOTTOM_NOTE, BOTTOM_STARS } home_bottom_t;
typedef enum { CARDPOS_NONE, CARDPOS_TOP, CARDPOS_LOW, CARDPOS_BOTTOM, CARDPOS_MID } home_cardpos_t;  /* y 75 (99 in picture view), 314, 368, 213 */
/* What sits under the title (Figma Header "Below"): a plain line, a Time pill, a Status pill. */
typedef enum { BELOW_TEXT, BELOW_TIME, BELOW_STATUS, BELOW_FREE } home_below_t;   /* FREE: the time pill and the Play (or Spin) pill, no title */

typedef struct {
    /* header */
    bool clock;                 /* the night clock: big digits take the header (docked) */
    char clock_text[8];
    char icon[20];
    uint32_t icon_color;
    char title[48];
    uint32_t title_color;
    lv_opa_t title_opa;
    home_below_t below;
    char status[48];            /* the line, or the pill's words */
    char status_icon[20];       /* the pill's icon ("" = none) */
    uint32_t status_color;      /* the line's colour, or the pill's tone */
    bool late_chip;             /* a coral "Late" tag instead */
    uint8_t free_mode;          /* BELOW_FREE: 0 = Spin selected, 1 = Play */
    /* the ring and the middle */
    bool ring_show;
    ring_style_t ring;
    home_mid_t mid;
    char overdue_text[72];
    uint8_t worm_eaten;         /* of 5 free-time dots */
    /* Biscuit */
    pet_mood_t mood;
    pet_activity_t activity;
    int force_clip;             /* -1 none */
    uint8_t pet_dim;
    bool room_off;              /* the last minutes of a task: the room goes dark, Biscuit stays */
    int16_t pet_d, pet_xy;      /* 0 = the usual 286 px circle at (90, 90); the alarm fills the screen (446 at 10) */
    bool pet_wide;              /* the room carries on past its grid to the rim (the alarm) */
    bool say_low;               /* `say` as a bubble at the bottom instead (the alarm, over the full-screen room) */
    int8_t chores_left;         /* at an event: a small "N to finish" pill under Biscuit that opens the list */
    bool wake;                  /* the alarm: he sits up and stretches, the room at dawn */
    bool tap_ring;              /* Biscuit can be tapped to play: the lime ring that pulses round him */
    char say[48];               /* speech bubble next to him, "" for none */
    char say_top[48];           /* a bubble under him with the tail on top (Goodnight) */
    /* message card */
    home_cardpos_t card;
    char card_icon[20];
    char card_text[56];
    card_end_t card_end;
    bool card_lime;             /* a lime card with no ring: tapping it opens something */
    int8_t steps_total, steps_done;
    bool steps_list;            /* older kids: the numbered steps in Biscuit's place (card_text is this step) */
    char step_prev[56], step_next[56];   /* the step before (done, mint) and the one after, dimmed; "" for none */
    /* bottom */
    home_bottom_t bottom;
    char next_icon[20], next_title[44], next_time[8];
    int8_t peeks;
    char note[96];
    lv_opa_t note_opa;
    /* BOTTOM_STARS: tonight's star under Biscuit (night streaks) */
    char star_icon[20];
    uint8_t star_goal, star_count;
    int16_t star_prize;
    /* picture view (under 7): bigger icons, clock times, a speaker, a big Play */
    bool picture;
    bool title_big;             /* the free-time countdown as the title */
    bool speaker;               /* reads the task out */
    bool big_play;              /* lime Play with Biscuit's face + the wheel as an icon */
    /* chrome */
    bool cue, sides, dots;
    bool rewards_only;          /* at bedtime: Rewards stays, no chores */
} home_view_t;

typedef enum {
    HOME_TAP_REWARDS, HOME_TAP_CHORES, HOME_TAP_NEXT, HOME_TAP_CARD, HOME_TAP_PET,
    HOME_TAP_PLAY, HOME_TAP_WHEEL, HOME_WHEEL_RESULT, HOME_TAP_SPEAKER, HOME_TAP_PLAYTIME,
} home_event_t;

typedef void (*home_cb_t)(home_event_t ev, int arg);

void home_create(lv_obj_t *page, home_cb_t cb);
void home_render(const home_view_t *v);
void home_set_wheel(const char options[][20], int n);
void home_wheel_reset(void);
lv_obj_t *home_pet(void);

typedef enum { HOME_FX_DONE, HOME_FX_BIG, HOME_FX_SPARKLE } home_fx_t;
void home_celebrate(home_fx_t kind);
