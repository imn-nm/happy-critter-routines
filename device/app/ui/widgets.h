/*
 * The MyToki Circle's shared parts, positioned on the 466 x 466 round screen exactly as in Figma
 * (609:2719: Header, Time pill, System message, Pet speech, Nav button, Next Task, Carousel dots,
 * Button, Status pill, Tag).
 */
#pragma once
#include "lvgl.h"
#include "theme.h"

/* ---- the dot ring: 60 dots round the scene; lit dots are the minutes left ---- */
typedef struct {
    uint8_t count;          /* dots round the whole ring (60) */
    uint8_t lit;            /* dots lit, clockwise from 12 o'clock */
    uint32_t lit_color, dim_color;
    float lit_r, dim_r;
    lv_opa_t lit_opa, dim_opa;
    bool pulse;             /* running over: the ring breathes */
    bool comet;             /* loading: a comet of dots runs round */
    bool confetti;          /* celebrations: lit dots in the kit's colours */
    bool arc;               /* the time ring: 49 dots on an open arc, the gap at the bottom; lit from the bottom-left end clockwise */
    float edge;             /* a dark rim round every dot (px past the dot) so it reads over the scene; 0 = none */
    uint32_t edge_color;
} ring_style_t;

lv_obj_t *ring_create(lv_obj_t *parent, int32_t radius);
void ring_set(lv_obj_t *ring, const ring_style_t *style);
/* The Figma Time ring (2026-10-12): 49 dots on an open arc 156 px out, 3.55 px with an ink rim.
 * `lit` is still on the old 0..60 scale and is mapped onto the 49 dots. */
ring_style_t ring_style(uint8_t lit, uint32_t lit_color, uint32_t dim_color);
/* Picture view (younger kids): headers keep their icon and sit lower. Set when the day loads. */
void ui_set_picture(bool picture);
bool ui_picture(void);
/* celebrations: the ring springs in (its size in permille) and twinkles while it drifts round (deg/10 per tick, 0 = still) */
void ring_set_scale(lv_obj_t *ring, int32_t permille);
void ring_set_wave(lv_obj_t *ring, bool wave, int8_t drift);

/* ---- the arc at 1 o'clock: the hardware button does something ---- */
lv_obj_t *cue_create(lv_obj_t *parent);
/* ring: 0 = the full arc; 1..100 = that much of it left (it shrinks over the five seconds after an early
 * finish). dark: a press does nothing useful here (an event): the mark is dark, no text. */
void cue_set(lv_obj_t *cue, uint8_t ring, bool dark);

/* ---- Nav buttons: Rewards (left) and Chores (right), 44 px at (8, 211) and (414, 211) ---- */
lv_obj_t *side_button_create(lv_obj_t *parent, bool left, const char *icon);

/* ---- the carousel's page dots (0 Rewards, 1 Home, 2 Chores), centred at y 444 ---- */
lv_obj_t *page_dots_create(lv_obj_t *parent, int page);

/* ---- "Next" + the Next pill (opens the day) with two cards peeking behind ---- */
typedef struct {
    lv_obj_t *label, *pill, *icon, *title, *time, *peek2, *peek3;
} next_block_t;
void next_block_create(lv_obj_t *parent, next_block_t *nb, lv_event_cb_t on_tap, void *user);
void next_block_set(next_block_t *nb, const char *icon, const char *title, const char *time, int peeks);
void next_block_show(next_block_t *nb, bool show);

/* ---- the system message: lavender for a plain message, lime for steps and checklists ---- */
typedef enum {
    CARD_END_NONE,
    CARD_END_BUTTON,   /* ring: the hardware button ticks it (a lime card) */
    CARD_END_TAP,      /* ring: tap it (a lime card) */
    CARD_END_DONE,     /* filled navy circle with a tick */
    CARD_END_OK,       /* lime "OK" pill: closes it (a lavender card with an action) */
} card_end_t;

typedef struct {
    lv_obj_t *root, *icon, *steps, *text, *spacer, *end, *end_dot, *end_label;
    card_end_t end_kind;
    int done_shown;            /* steps ticked the last time (the next tick pops) */
} lime_card_t;
/* width 0 = fit the content; otherwise a fixed width with the end pushed right. */
void lime_card_create(lv_obj_t *parent, lime_card_t *c, int32_t width);
void lime_card_set(lime_card_t *c, const char *icon, const char *text, card_end_t end);
/* Step dots instead of an icon: `total` steps, `done` of them ticked. */
void lime_card_set_steps(lime_card_t *c, int total, int done);
void lime_card_set_color(lime_card_t *c, uint32_t bg);
void lime_card_wrap(lime_card_t *c, int32_t max_text);

/* ---- Biscuit's speech bubble (cream, navy words, tail bottom-left) ---- */
typedef struct { lv_obj_t *root, *label, *tail; bool top; } bubble_t;
void bubble_create(lv_obj_t *parent, bubble_t *b);
void bubble_say(bubble_t *b, const char *text, int32_t x, int32_t y);
/* Centred, with the tail on top pointing up at Biscuit (Figma Tail=Top): the bubble's top at y. */
void bubble_say_top(bubble_t *b, const char *text, int32_t y);
void bubble_hide(bubble_t *b);

/* ---- Time pill: the time under a title. Tone colour: lime task, mint free, sky night, coral late ---- */
typedef struct { lv_obj_t *root, *icon, *text; } time_pill_t;
void time_pill_create(lv_obj_t *parent, time_pill_t *p);
void time_pill_set(time_pill_t *p, const char *icon, const char *text, uint32_t tone);

/* ---- Status pill: a count or state you read but don't tap (cream, mint for done, amber for stars) ---- */
lv_obj_t *status_pill_create(lv_obj_t *parent, const char *icon, const char *text, uint32_t color);

/* ---- Button: Primary (filled lime), Secondary (lime outline), Tertiary (lime words); Large 44 / Small 32 ---- */
typedef enum { BTN_PRIMARY, BTN_SECONDARY, BTN_TERTIARY } button_kind_t;
lv_obj_t *button_create(lv_obj_t *parent, button_kind_t kind, bool small, const char *icon, const char *label);

/* ---- small things ---- */
/* A Tag: Late (coral), Now (lime outline), Done (mint). bg 0 = outline only, in fg. */
lv_obj_t *chip_create(lv_obj_t *parent, uint32_t bg, uint32_t fg, const char *text);
/* A dotted rounded outline (free time in the schedule). */
lv_obj_t *dotted_outline_create(lv_obj_t *parent, uint32_t color, int32_t radius);
/* Two quiet centred lines under Biscuit (260 wide). */
lv_obj_t *note_create(lv_obj_t *parent, int32_t y);

/* Swipe left or right to close: calls `on_close(user)` after the slide. */
void swipe_to_close(lv_obj_t *screen, void (*on_close)(void *user), void *user);
/* A full-screen layer over everything (an overlay), black and round. */
lv_obj_t *overlay_create(void);
/* How an overlay arrives: pushed in from the right (it was opened by a tap, and backs out the same
 * way) or rising while it fades in (it came up on its own: a reminder, a system screen). */
void overlay_enter_push(lv_obj_t *overlay);
void overlay_enter_rise(lv_obj_t *overlay);
/* How it goes: sliding out sideways (dir -1 left, +1 right, after a swipe or a back), or fading. */
void overlay_slide_away(lv_obj_t *overlay, int dir);
void overlay_fade_away(lv_obj_t *overlay);
