/*
 * MyToki 2 look (Figma "Child UI · New UI", 1052:5356, and its "MyToki 2 · Color" variables):
 * the room fills the round screen, a dashed timer runs round the rim, the header sits on top and
 * the dark hill at the bottom holds what comes next. Colours each have one job; titles and
 * messages in Montserrat, everything else in Poppins, the Next block in Space Grotesk.
 */
#pragma once
#include "lvgl.h"
#include "../assets/fonts/fonts.h"

#define SCREEN_W 466
#define SCREEN_H 466
#define CENTER 233

/* Effects that draw through a layer of their own every frame: the carousel's pyramid (pages sink
 * back, smaller and clipped to their circles, as they turn) and the wheels' rows shrinking and
 * fading as one piece (ui_row_scale, ui_row_fade). A platform that can't afford them (the board)
 * sets this to 0: the pages slide flat and the rows only fade, part by part. */
#ifndef UI_DEPTH
#define UI_DEPTH 1
#endif

/* ---- colours: the MyToki 2 · Color tokens ---- */
#define C_SCREEN    0x000000  /* bg/screen */
#define C_HILL      0x0E1221  /* bg/hill: the curve at the bottom, sunken rows */
#define C_RAISED    0x181E36  /* bg/raised: nav buttons, cards, rows */
#define C_CHIP      0x2C3558  /* bg/chip: calm pills, unlit dots, outlines */
#define C_HILL_LINE 0x4F5884  /* line/hill: the hairline on the hill */
#define C_FAINT     0x20294A  /* line/faint: the empty graphic circle */
#define C_TEXT      0xF9F5E1  /* text/primary */
#define C_TEXT_MUTED 0x9A9DAB /* text/muted */
#define C_CLOCK     0xFFFFFF  /* the time, on every screen (the header's clock, the night clock): pure white */
#define C_NEXT_LABEL 0x6C6F95 /* text/next-label: "Next" and its time */
#define C_NEXT_TASK 0xAAB4FF  /* text/next-task: the next task and its icon */
#define C_CALM      0xBDB5F5  /* text/calm: words in a calm pill */
#define C_ON_COLOR  0x20294A  /* text/on-color: words on lime, amber, coral, lavender, cream */
#define C_TRACK     0x181E36  /* timer/track: the unlit dashes */
#define C_PLENTY    0x65CDAA  /* timer/plenty: 10 min or more left */
#define C_HURRY     0xFAB047  /* timer/hurry: under 10 min */
#define C_LATE_RING 0xFF5C5F  /* timer/late: running over */
#define C_NIGHT     0x879BFF  /* timer/night, status/night */
#define C_ACTION    0xDCEF70  /* role/action: anything you tap to do something, nav icons */
#define C_SYSTEM    0xA89AF0  /* role/system: the device telling you something */
#define C_PET       0xF9F5E1  /* role/pet: Biscuit's bubble */
#define C_DONE      0x65CDAA  /* status/done: done, free time */
#define C_STAR      0xFAB047  /* status/star: stars */
#define C_LATE      0xFF8F91  /* status/late: the Late pill */
#define C_PINK      0xEAB5DE  /* decor/pink */
#define C_CARROT    0xF7945A  /* decor/carrot */

/* the names the screens grew up with, now on the MyToki 2 tokens */
#define C_INK       C_SCREEN
#define C_GLASS     C_RAISED
#define C_DEEP      C_HILL
#define C_LINE      C_CHIP
#define C_LIME      C_ACTION
#define C_CARD_LIME C_ACTION
#define C_LAVENDER  C_SYSTEM
#define C_NAVY      C_ON_COLOR
#define C_BONE      C_TEXT
#define C_MUTED     C_TEXT_MUTED
#define C_MINT      C_DONE
#define C_BUTTER    C_STAR
#define C_CORAL     C_LATE
#define C_SKY       C_NIGHT
#define C_SALMON    0xF59A76
#define C_ORANGE    C_ACTION
#define C_DOT_OFF   C_CHIP
#define C_NIGHT_DOT C_CHIP
#define C_DOTS_BG   C_SCREEN

#define COL(hex) lv_color_hex(hex)

/* ---- type: the MyToki 2/ text styles ---- */
#define F_CLOCK_LINE (&font_pop500_22)   /* Clock 22 ("You earned it!") */
#define F_HEADER_CLOCK (&font_pop500_18) /* the Header's clock above the title: 18, muted */
#define F_TITLE      (&font_pop700_30)   /* Title 30, Poppins Bold */
#define F_DISPLAY    (&font_mon700_32)   /* Display 32: celebrations */
#define F_CLOCK      (&font_mon600_52)   /* Big number 52: the night clock, the pairing code (digits) */
#define F_MESSAGE    (&font_mon500_21)   /* Message 21: a sentence in the middle of the screen */
#define F_PILL       (&font_pop500_24)   /* Pill 24: time pills and tags */
#define F_NEXT_LABEL (&font_sg500_22)    /* "Next" on the hill */
#define F_NEXT_TIME  (&font_sg700_22)    /* its start time */
#define F_NEXT_TASK  (&font_sg700_24)    /* its name */
#define F_ITEM       (&font_pop600_24)   /* Item 24: row titles */
#define F_ITEM_BIG   (&font_pop600_32)   /* the picture view's row now (Today's schedule · Younger) */
#define F_BODY_P     (&font_pop500_22)   /* Body 22 */
#define F_DETAIL     (&font_pop500_20)   /* Detail 20: second lines, the smallest a child reads */
#define F_BUTTON     (&font_pop700_22)   /* Button 22 */
#define F_SPEECH     (&font_pop500_20)   /* Speech 20: Biscuit's bubble */
#define F_LABEL      (&font_pop600_20)   /* Label 20: wheels, tabs, tiles */
#define F_NUMBER     (&font_pop700_24)   /* a count */

/* the older names */
#define F_TITLE_S    F_TITLE
#define F_PAGE_TITLE F_TITLE
#define F_ROW_TITLE  F_ITEM
#define F_CARD       F_DETAIL
#define F_BUBBLE     F_SPEECH
#define F_BODY       F_BODY_P
#define F_STATUS     F_LABEL
#define F_TAG        F_LABEL
#define F_SMALL_B    F_LABEL
#define F_CAPTION    F_DETAIL
#define F_SMALL      F_DETAIL
#define F_NOTE       F_DETAIL

/* A plain box: no theme styles, no scrolling, not clickable. */
lv_obj_t *ui_box(lv_obj_t *parent);
/* A box laid out as a row, sized to its content. */
lv_obj_t *ui_row(lv_obj_t *parent, int32_t gap);
lv_obj_t *ui_label(lv_obj_t *parent, const lv_font_t *font, uint32_t color, const char *text);
/* Change text only when it differs (saves a redraw). */
void ui_set_text(lv_obj_t *label, const char *text);
void ui_set_color(lv_obj_t *obj, uint32_t color);
/* A line icon (tools/icons.mjs) tinted with `color`. */
lv_obj_t *ui_icon(lv_obj_t *parent, const char *name, int size, uint32_t color);
void ui_icon_set(lv_obj_t *icon, const char *name, int size);
void ui_show(lv_obj_t *obj, bool show);
/* A filled rounded rectangle. */
void ui_style_card(lv_obj_t *obj, uint32_t bg, int32_t radius, uint32_t border, lv_opa_t border_opa);
/* Time as the child reads it: "7:15" (12-hour, no am/pm). */
void ui_fmt_time(char *buf, size_t n, int minutes);
const char *ui_ampm(int minutes);
/* The header's clock: "3:18pm". */
void ui_fmt_clock(char *buf, size_t n, int minutes);
