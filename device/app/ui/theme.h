/*
 * MyToki Circle look (Figma "MyToki Circle · Design System", 609:2719): colours each have one job,
 * titles and messages in Montserrat, labels and pills in Poppins.
 */
#pragma once
#include "lvgl.h"
#include "../assets/fonts/fonts.h"

#define SCREEN_W 466
#define SCREEN_H 466
#define CENTER 233

/* colours (the MyToki · Circle variables) */
#define C_INK       0x040605  /* surface/screen */
#define C_GLASS     0x181E36  /* surface/card: pills, side buttons, the Next pill */
#define C_DEEP      0x0E1221  /* surface/sunken: the cards peeking behind Next, done rows */
#define C_LINE      0x2C3558  /* surface/line: outlines, used-up ring dots */
#define C_LIME      0xDCEF70  /* role/action: buttons, time left, step cards, the button cue */
#define C_CARD_LIME 0xDCEF70  /* step and checklist cards (the same lime) */
#define C_LAVENDER  0xA89AF0  /* role/system: the device telling you something */
#define C_NAVY      0x20294A  /* text/on-color: words on lime, lavender and cream */
#define C_BONE      0xF9F5E1  /* text/primary, Biscuit's bubble */
#define C_MUTED     0x9A9DAB  /* text/muted */
#define C_MINT      0x65CDAA  /* status/free: free time, done */
#define C_BUTTER    0xFAB047  /* status/star: stars only */
#define C_CORAL     0xFF8F91  /* status/alert: running late */
#define C_SKY       0x879BFF  /* status/night */
#define C_SALMON    0xF59A76  /* the schedule sheet's Now row (not in the Circle kit yet) */
#define C_ORANGE    C_LIME    /* the arc at 1 o'clock */
#define C_DOT_OFF   C_LINE    /* used-up ring dots */
#define C_NIGHT_DOT C_LINE    /* the night ring's dim dots */
#define C_DOTS_BG   0x08011A  /* the carousel dots' pill */

#define COL(hex) lv_color_hex(hex)

/* type (MyToki Circle text styles) */
#define F_DISPLAY    (&font_mon600_28)   /* Display 28 */
#define F_TITLE      (&font_mon600_22)   /* Title 22 */
#define F_TITLE_S    (&font_mon600_22)
#define F_PAGE_TITLE (&font_mon600_22)
#define F_CLOCK      (&font_mon600_48)   /* Clock 48: the night clock, the pairing code (digits) */
#define F_MESSAGE    (&font_mon500_17)   /* Message 17: cards, bubbles, the Next pill's task, notes */
#define F_ROW_TITLE  (&font_mon500_17)
#define F_CARD       (&font_mon500_17)
#define F_BUBBLE     (&font_mon500_17)
#define F_BODY       (&font_mon500_17)
#define F_LABEL      (&font_pop700_16)   /* Label 16: time pills, status pills, the line under a title */
#define F_STATUS     (&font_pop700_16)
#define F_TAG        (&font_pop700_14)   /* Tag 14: "Next", Late, Now, Done */
#define F_SMALL_B    (&font_pop700_14)
#define F_BUTTON     (&font_pop700_18)   /* Button 18 */
#define F_NUMBER     (&font_pop700_24)   /* Number 24 */
#define F_ITEM       (&font_pop500_19)   /* Item 19 */
#define F_BODY_P     (&font_pop500_18)   /* Body 18 */
#define F_CAPTION    (&font_pop500_15)   /* Caption 15 */
#define F_SMALL      (&font_pop500_15)
#define F_NOTE       (&font_pop500_15)

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
