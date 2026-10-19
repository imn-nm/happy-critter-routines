/*
 * MyToki 2's shared parts (Figma "MyToki 2 · Design system" in section 1052:5356), placed on the
 * 466 x 466 round screen as in Figma: Header, Pill, Timer, Hill (Next / Button / Text / Switch),
 * Page dots, Side nav, Button, Speech, Note, Tab.
 */
#pragma once
#include "lvgl.h"
#include "theme.h"

/* ---- MyToki 2 Timer: the dashed arc round the rim, open at the bottom (80 px dashes, 14 px gaps,
 * 9 px wide, round ends, 223 px out). Lit dashes are the time left, from the bottom-left end. ---- */
typedef enum { TIMER_PLENTY, TIMER_HURRY, TIMER_LATE, TIMER_NIGHT } timer_tone_t;
lv_obj_t *timer_create(lv_obj_t *parent);
/* left: 0..1000 of the arc lit. pulse: running over, the lit dashes breathe. */
void timer_set(lv_obj_t *timer, timer_tone_t tone, int16_t left, bool pulse);

/* ---- Pill: time left, a status or a count under the title ---- */
typedef enum { PILL_CALM, PILL_HURRY, PILL_LATE, PILL_NIGHT, PILL_STAR, PILL_DONE, PILL_SYSTEM, PILL_ACTION } pill_tone_t;
typedef struct { lv_obj_t *root, *icon, *text; pill_tone_t tone; } pill_t;
void pill_create(lv_obj_t *parent, pill_t *p);
void pill_set(pill_t *p, pill_tone_t tone, const char *icon, const char *text);

/* ---- Header: the clock, the title, then a Pill or a quiet line; 340 wide, centred at y 18 ---- */
typedef enum { HEADER_NONE, HEADER_PILL, HEADER_TEXT } header_below_t;
typedef struct { lv_obj_t *root, *clock, *title, *text; pill_t pill; } header_t;
void header_create(lv_obj_t *parent, header_t *h);
/* clock or title NULL/"" = hidden. */
void header_set(header_t *h, const char *clock, const char *title, header_below_t below,
                pill_tone_t tone, const char *icon, const char *text);

/* ---- Hill: the dark curve at the bottom (y 368) with what comes next, one button, a quiet line or
 * the Spin / Play switch, and the carousel's page dots ---- */
typedef enum { HILL_EMPTY, HILL_NEXT, HILL_BUTTON, HILL_TEXT, HILL_SWITCH } hill_kind_t;
typedef struct {
    lv_obj_t *root, *curve, *col;
    lv_obj_t *next, *next_time, *next_icon, *next_task;
    lv_obj_t *button, *button_icon, *button_label;
    lv_obj_t *text;
    lv_obj_t *sw, *sw_spin, *sw_play;
    lv_obj_t *dots;
    hill_kind_t kind;
    int page;
} hill_t;
/* on_tap fires with HILL_TAP_* as the event's user data cast. */
typedef enum { HILL_TAP_NEXT, HILL_TAP_BUTTON, HILL_TAP_SPIN, HILL_TAP_PLAY } hill_tap_t;
typedef void (*hill_cb_t)(hill_tap_t tap);
void hill_create(lv_obj_t *parent, hill_t *h, hill_cb_t cb);
void hill_set_next(hill_t *h, const char *icon, const char *title, const char *time);
void hill_set_button(hill_t *h, const char *icon, const char *label);
void hill_set_text(hill_t *h, const char *text);
void hill_set_switch(hill_t *h, bool play);
void hill_set_empty(hill_t *h);
/* page: -1 = no dots, 0 Rewards, 1 Home, 2 Chores */
void hill_set_dots(hill_t *h, int page);

/* ---- the graphic's frame: the faint empty circle (running late), the top fade under the header ---- */
lv_obj_t *faint_circle_create(lv_obj_t *parent);
lv_obj_t *scrim_create(lv_obj_t *parent);
lv_obj_t *list_fade_create(lv_obj_t *parent, int32_t y);

/* ---- the old dot ring: still used by the loading comet, the reward spotlight and the halos ---- */
typedef struct {
    uint8_t count;          /* dots round the whole ring (60) */
    uint8_t lit;            /* dots lit, clockwise from 12 o'clock */
    uint32_t lit_color, dim_color;
    float lit_r, dim_r;
    lv_opa_t lit_opa, dim_opa;
    bool pulse;             /* the ring breathes */
    bool comet;             /* loading: a comet of dots runs round */
    bool confetti;          /* celebrations: lit dots in the kit's colours */
    bool arc;               /* 49 dots on an open arc, the gap at the bottom */
    float edge;             /* a dark rim round every dot; 0 = none */
    uint32_t edge_color;
} ring_style_t;

lv_obj_t *ring_create(lv_obj_t *parent, int32_t radius);
void ring_set(lv_obj_t *ring, const ring_style_t *style);
ring_style_t ring_style(uint8_t lit, uint32_t lit_color, uint32_t dim_color);
/* The clock the headers show ("3:18pm"), kept up to date by the controller. */
void ui_set_clock(int minutes);
const char *ui_clock(void);
/* Picture view (younger kids). Set when the day loads. */
void ui_set_picture(bool picture);
bool ui_picture(void);
void ring_set_scale(lv_obj_t *ring, int32_t permille);
void ring_set_wave(lv_obj_t *ring, bool wave, int8_t drift);

/* ---- the arc at 1 o'clock (MyToki 2 leaves it to the housing's own green button; kept for Playtime) ---- */
lv_obj_t *cue_create(lv_obj_t *parent);
void cue_set(lv_obj_t *cue, uint8_t ring, bool dark);

/* ---- Side nav: Rewards (left) and Chores (right), 54 px at (24, 206) and (388, 206) ---- */
lv_obj_t *side_button_create(lv_obj_t *parent, bool left, const char *icon);

/* ---- the carousel's page dots (0 Rewards, 1 Home, 2 Chores), centred at y 446 ---- */
lv_obj_t *page_dots_create(lv_obj_t *parent, int page);
void page_dots_set(lv_obj_t *dots, int page);

/* ---- Note: lavender, the device telling you something (Plain: an icon; Step: "2/4" and a ring
 * the button ticks). The old "lime card" names stay. ---- */
typedef enum {
    CARD_END_NONE,
    CARD_END_BUTTON,   /* ring: the hardware button ticks it */
    CARD_END_TAP,      /* ring: tap it */
    CARD_END_DONE,     /* filled navy circle with a tick */
    CARD_END_OK,       /* lime "OK" pill: closes it */
} card_end_t;

typedef struct {
    lv_obj_t *root, *icon, *steps, *text, *spacer, *end, *end_dot, *end_label;
    card_end_t end_kind;
    int done_shown;
    bool step_look;
} lime_card_t;
void lime_card_create(lv_obj_t *parent, lime_card_t *c, int32_t width);
void lime_card_set(lime_card_t *c, const char *icon, const char *text, card_end_t end);
/* Step: "done+1/total" in front of the words. */
void lime_card_set_steps(lime_card_t *c, int total, int done);
void lime_card_set_color(lime_card_t *c, uint32_t bg);
void lime_card_wrap(lime_card_t *c, int32_t max_text);

/* ---- Speech: Biscuit's own words, a cream bubble with its tail pointing down-left at him ---- */
typedef struct { lv_obj_t *root, *label, *tail; bool top; } bubble_t;
void bubble_create(lv_obj_t *parent, bubble_t *b);
/* x, y: the bubble's top left (kept inside the round screen). */
void bubble_say(bubble_t *b, const char *text, int32_t x, int32_t y);
/* MyToki 2's place for it: up and right of Biscuit's head, the tail's tip at (x + 22, 206). */
void bubble_say_pet(bubble_t *b, const char *text);
void bubble_say_top(bubble_t *b, const char *text, int32_t y);
void bubble_hide(bubble_t *b);

/* ---- the old pill names, on the MyToki 2 Pill (the tone is read from the colour) ---- */
typedef pill_t time_pill_t;
void time_pill_create(lv_obj_t *parent, time_pill_t *p);
void time_pill_set(time_pill_t *p, const char *icon, const char *text, uint32_t tone);
lv_obj_t *status_pill_create(lv_obj_t *parent, const char *icon, const char *text, uint32_t color);

/* ---- Button: Primary (lime), Secondary (lime outline), Tertiary (lime words); 48 / 40 high ---- */
typedef enum { BTN_PRIMARY, BTN_SECONDARY, BTN_TERTIARY } button_kind_t;
lv_obj_t *button_create(lv_obj_t *parent, button_kind_t kind, bool small, const char *icon, const char *label);

/* ---- Tab: a choice in a row; selected = lime outline and lime words ---- */
lv_obj_t *tab_create(lv_obj_t *parent, const char *icon, const char *label);
void tab_select(lv_obj_t *tab, bool selected);
/* A row of tabs on a night pill (Tab bar, Mode switch). */
lv_obj_t *tab_bar_create(lv_obj_t *parent);

/* ---- small things ---- */
lv_obj_t *chip_create(lv_obj_t *parent, uint32_t bg, uint32_t fg, const char *text);
lv_obj_t *dotted_outline_create(lv_obj_t *parent, uint32_t color, int32_t radius);
/* A quiet centred line (260 wide), Detail 20. */
lv_obj_t *note_create(lv_obj_t *parent, int32_t y);

/* Swipe left or right to close: calls `on_close(user)` after the slide. */
void swipe_to_close(lv_obj_t *screen, void (*on_close)(void *user), void *user);
lv_obj_t *overlay_create(void);
void overlay_enter_push(lv_obj_t *overlay);
void overlay_enter_rise(lv_obj_t *overlay);
void overlay_slide_away(lv_obj_t *overlay, int dir);
void overlay_fade_away(lv_obj_t *overlay);

/* ---- a list that turns like a wheel (Today's schedule, Chores, Other things to finish): the row
 * at the focus line is full size; rows above and below shrink and fade the further they are. It
 * scrolls under the finger with momentum and settles a row on the line. ---- */
/* Figma "Checkbox": d 48 (Large) or 24 (Small). Unchecked: a 2 px line/hill ring; Checked: a
 * filled navy circle with a lime tick (28 or 16). */
lv_obj_t *checkbox_create(lv_obj_t *parent, int32_t d, bool checked);
/* An unchecked box ticks itself: the navy fill grows out of the middle, the tick pops in and a
 * mint ripple goes out. The same tick wherever a child finishes something. */
void checkbox_tick(lv_obj_t *box);

/* ---- motion shared by every move on the Circle ---- */
/* ui_path_out: quick off the mark, a soft landing (a cubic ease-out, snappier than LVGL's).
 * ui_path_settle: lands a touch past the mark and settles back (about 3 %): rows, ticks, pills. */
int32_t ui_path_out(const lv_anim_t *a);
int32_t ui_path_settle(const lv_anim_t *a);
/* A card's colour drifts from one colour to another (a chore turning from lavender to done). */
void card_recolor(lv_obj_t *card, uint32_t from, uint32_t to, uint32_t ms);
/* The controller registers how to draw the whole screen again; a page calls ui_render_now() when a
 * change it held back (a row ticked in place) is ready to be laid out. */
void ui_set_render(void (*fn)(void));
void ui_render_now(void);

typedef struct {
    lv_obj_t *list;          /* the scrolling column; add rows with wheel_list_add */
    int32_t focus_y;         /* the focus line, in the list's coordinates */
    int32_t row_h;           /* the slot every row sits in */
    float shrink, fade;      /* per row away from the line (0.16 and 0.30 unless changed) */
    /* when set, it styles each row instead: d is how many rows the row is from the line (signed) */
    void (*style)(lv_obj_t *card, float d);
} wheel_list_t;
void wheel_list_create(lv_obj_t *parent, wheel_list_t *w, int32_t x, int32_t y, int32_t width, int32_t height,
                       int32_t focus_y, int32_t row_h);
/* An empty slot for a row; put the row's card in it. */
lv_obj_t *wheel_list_add(wheel_list_t *w);
/* Bring row i to the focus line (no animation when anim is false). */
void wheel_list_focus(wheel_list_t *w, int i, bool anim);
/* Turn to row i after delay_ms, with the settle. */
void wheel_list_turn(wheel_list_t *w, int i, uint32_t delay_ms);
/* The row on the focus line now. */
int wheel_list_current(const wheel_list_t *w);
void wheel_list_clear(wheel_list_t *w);
/* Rows that move when a list is rebuilt slide from where they were to where they are now, instead
 * of jumping: give each slot a key (its user data, not 0), take the marks before clearing the list,
 * rebuild, then flip. Rows without an old place fade in. */
typedef struct { intptr_t key; int32_t y; } wheel_mark_t;
int wheel_list_mark(wheel_list_t *w, wheel_mark_t *marks, int max);
void wheel_list_flip(wheel_list_t *w, const wheel_mark_t *marks, int n);
