/*
 * Home: the middle page of the carousel. Most of the MyToki 2 screens are this one layout in
 * different states (Figma "Child UI · New UI"): the room behind everything (full screen, or the
 * small circle once fewer than 10 minutes are left), the dashed timer round the rim, the header,
 * the side buttons, Biscuit's bubble, a note, and the hill with what comes next. The controller
 * (mytoki.c) fills a view and Home draws it.
 */
#pragma once
#include "lvgl.h"
#include "widgets.h"
#include "../pet/pet.h"

/* MID_STEPS: a checklist that turns like a wheel instead of the room (Figma Going out · Get ready,
 * and every task with steps: Morning · Get dressed, the bedtime routine) */
typedef enum { MID_PET, MID_WHEEL, MID_OVERDUE, MID_NONE, MID_STEPS } home_mid_t;
#define HOME_STEPS_MAX 10
/* BOTTOM_GAMES: the outline Games button that opens Playtime (Figma Free time · Spin) */
typedef enum { BOTTOM_NONE, BOTTOM_NEXT, BOTTOM_PLAY, BOTTOM_WHEEL, BOTTOM_NOTE, BOTTOM_STARS, BOTTOM_GAMES } home_bottom_t;
typedef enum { CARDPOS_NONE, CARDPOS_TOP, CARDPOS_LOW, CARDPOS_BOTTOM, CARDPOS_MID } home_cardpos_t;   /* MyToki 2: every note sits at y 322 */
typedef enum { BELOW_TEXT, BELOW_TIME, BELOW_STATUS, BELOW_FREE } home_below_t;
/* MyToki 2 Graphic: Full = the room fills the screen; Small = the 298 circle (under 10 min left);
 * Empty = no room, a faint circle (running late); None = nothing behind (the wheel, lists). */
typedef enum { GRAPHIC_FULL, GRAPHIC_SMALL, GRAPHIC_EMPTY, GRAPHIC_NONE } home_graphic_t;

typedef struct {
    /* header */
    bool clock;                 /* the night clock: the big digits take the header (docked) */
    char clock_text[8];
    char clock_line[12];        /* the small clock above the title ("3:18pm"); "" = none */
    char icon[20];
    uint32_t icon_color;
    char title[48];
    uint32_t title_color;
    lv_opa_t title_opa;
    home_below_t below;
    char status[48];            /* the line, or the pill's words */
    char status_icon[20];
    uint32_t status_color;      /* the line's colour, or (old) the pill's tone colour */
    pill_tone_t pill_tone;      /* the pill's tone */
    bool late_chip;             /* the coral "Late" pill instead */
    uint8_t free_mode;          /* free time: 0 = the wheel (Spin), 1 = Biscuit (Play) */
    /* the graphic and the timer */
    home_graphic_t graphic;
    bool timer_show;
    timer_tone_t timer_tone;
    int16_t timer_left;         /* 0..1000 of the arc lit */
    bool timer_pulse;
    bool ring_show;             /* (old) */
    ring_style_t ring;          /* (old) */
    home_mid_t mid;
    char overdue_text[72];
    uint8_t worm_eaten;         /* of 5 free-time dots */
    char worm_icon[20];         /* what it's eating, in the ring at the end: "kite" (free time) or the task's icon */
    /* Biscuit */
    pet_mood_t mood;
    pet_activity_t activity;
    int force_clip;             /* -1 none */
    uint8_t pet_dim;
    uint8_t room_fade;          /* the room faded behind him, he stays solid (Free time · Last 5 minutes: 179 = 30%) */
    bool room_off;              /* (old) */
    int16_t pet_d, pet_xy;      /* (old) */
    bool pet_wide;              /* (old) */
    bool say_low;               /* (old) */
    int8_t chores_left;         /* at an event: a note "N to finish" that opens the list */
    bool wake;                  /* the alarm: he sits up and stretches, the room at dawn */
    bool tap_ring;              /* Biscuit can be tapped to play: his room glows round him (the halo), stars twinkle */
    char say[48];               /* his bubble, "" for none */
    char say_top[48];           /* (old) the same bubble */
    /* note */
    home_cardpos_t card;
    char card_icon[20];
    char card_text[56];
    card_end_t card_end;
    bool card_lime;
    int8_t steps_total;
    uint16_t steps_ticked;      /* MID_STEPS: bit i = step i is checked (in any order) */
    char step_prev[56], step_next[56];
    char step_text[HOME_STEPS_MAX][56];   /* MID_STEPS: every step, in order */
    /* bottom: the hill */
    home_bottom_t bottom;
    char next_icon[20], next_title[44], next_time[8];
    int8_t peeks;
    char note[96];
    lv_opa_t note_opa;
    char star_icon[20];
    uint8_t star_goal, star_count;
    int16_t star_prize;
    /* picture view (under 7) */
    bool picture;
    bool title_big;
    bool speaker;
    bool big_play;
    /* chrome */
    bool cue, sides, dots;
    char cue_text[40];
    char cue_sub[16];
    uint8_t cue_ring;
    bool cue_dark;
    bool rewards_only;          /* at bedtime: Rewards stays, no chores */
} home_view_t;

typedef enum {
    HOME_TAP_REWARDS, HOME_TAP_CHORES, HOME_TAP_NEXT, HOME_TAP_CARD, HOME_TAP_PET,
    HOME_TAP_PLAY, HOME_TAP_WHEEL, HOME_WHEEL_RESULT, HOME_TAP_SPEAKER, HOME_TAP_PLAYTIME,
    HOME_TAP_STEP,              /* arg: the step tapped, to check or uncheck */
    HOME_HOLD_PET,              /* a long tap on the pet: My pet (choose the buddy, dress it up) */
} home_event_t;

typedef void (*home_cb_t)(home_event_t ev, int arg);

void home_create(lv_obj_t *page, home_cb_t cb);
void home_render(const home_view_t *v);
void home_set_wheel(const char options[][20], int n);
void home_wheel_reset(void);
lv_obj_t *home_pet(void);
/* The step on the checklist's line, or -1 with no checklist showing. */
int home_steps_current(void);
/* The page is t screens from the middle of the carousel (0 at rest): layers shift for depth. */
void home_parallax(float t);

typedef enum { HOME_FX_DONE, HOME_FX_BIG, HOME_FX_SPARKLE } home_fx_t;
void home_celebrate(home_fx_t kind);
