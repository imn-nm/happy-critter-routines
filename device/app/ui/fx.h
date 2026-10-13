/*
 * Motion for the Circle screens, after artifacts/reward-burst/index.html (the Reward Unlocked
 * mock): a charge, a burst with a flash, dot shockwaves, rays and confetti, Biscuit springing
 * out of his window, halo rings that spring into place and twinkle, words that pop in, and a
 * party loop with sparks from his paws and a drizzle of confetti.
 *
 * Everything is LVGL animations and a few custom-drawn objects; translate and opacity cost
 * nothing extra (LVGL 9 applies opa to children), scale only on small things. Pieces delete
 * themselves. A timeline is a handful of fx_at() calls that die with their owner.
 */
#pragma once
#include "lvgl.h"
#include <stdint.h>
#include <stdbool.h>

/* confetti colours (the mock's palette: lime, salmon, lavender, mint, sky, bone) */
/* The brand's friends, mixed at random into every dot, star and confetti piece: lavender, mint,
 * bubblegum, coral, sky, carrot, amber. FX_PARTY and FX_STARS are the same mix (kept for callers). */
extern const uint32_t FX_BRAND[7];
extern const uint32_t FX_PARTY[6];
extern const uint32_t FX_STARS[4];

/* ---- timeline ---- */
typedef void (*fx_cb_t)(lv_obj_t *owner, void *user);
/* Call fn after ms, unless owner is deleted first. */
void fx_at(lv_obj_t *owner, uint32_t ms, fx_cb_t fn, void *user);

/* ---- confetti ---- */
typedef struct {
    float speed_min, speed_max;   /* px per second */
    float angle_deg, spread_deg;  /* fly out around this heading (−90 = up), ± spread; 360 = everywhere */
    float lift;                   /* px/s taken off vy (a little upward kick) */
    float g, k;                   /* gravity px/s², air drag */
    float life_min, life_max;     /* seconds */
    bool dots_only;               /* sparks: just dots, no strips or stars */
} fx_shoot_t;
/* n pieces fly out of (cx, cy) in parent: dots, strips and butter stars that tumble, slow in the
 * air, fall and fade. spread scales the default speeds (300 = the mock). */
void fx_confetti(lv_obj_t *parent, int32_t cx, int32_t cy, int n, const uint32_t *colors, int ncolors, int32_t spread);
void fx_confetti_ex(lv_obj_t *parent, int32_t cx, int32_t cy, int n, const uint32_t *colors, int ncolors, const fx_shoot_t *s);
/* Little sparks from a paw: side −1 flies left, +1 right. */
void fx_sparks(lv_obj_t *parent, int32_t x, int32_t y, int side);
/* A light drizzle of confetti from the top for ms (0 = until parent goes). */
void fx_drizzle(lv_obj_t *parent, uint32_t ms, const uint32_t *colors, int ncolors);

/* ---- the burst (one custom-drawn object over the parent, gone when it is over) ---- */
typedef struct {
    bool charge;         /* 24 dots light up round the centre before the burst, then squeeze in */
    uint32_t burst_at;   /* ms after creation */
    int32_t flash_r;     /* the flash's reach in px (0 = no flash) */
    int waves;           /* dot shockwaves, up to 3 */
    int32_t wave_r0;     /* where the waves start (0 = the mock's 48/30/30) */
    int32_t wave_span;   /* how far they travel (0 = 300) */
    bool rays;           /* 16 faint rays turning slowly */
} fx_burst_cfg_t;
lv_obj_t *fx_burst_create(lv_obj_t *parent, int32_t cx, int32_t cy, const fx_burst_cfg_t *cfg);

/* ---- entrances ---- */
void fx_rise(lv_obj_t *obj, int32_t dy, uint32_t delay_ms);           /* up from dy lower while fading in */
void fx_rise_children(lv_obj_t *parent, int32_t dy, uint32_t stagger_ms);
void fx_slide(lv_obj_t *obj, int32_t dy, uint32_t delay_ms);          /* like rise, no fade */
void fx_spring(lv_obj_t *obj, uint32_t delay_ms);                     /* scale from 40 % with a spring, fading in (small things) */
void fx_spring_children(lv_obj_t *parent, uint32_t stagger_ms);
void fx_pop(lv_obj_t *obj, uint32_t delay_ms);                        /* a quick grow from 60 % */
void fx_bounce(lv_obj_t *obj, int32_t height, uint32_t delay_ms);     /* a hop up and back */
void fx_jolt(lv_obj_t *obj, int32_t amp, uint32_t ms, uint32_t delay_ms);   /* the whole screen shaken by the burst */
/* The words of text pop in one after another (the mock's title), centred at y. */
void fx_words(lv_obj_t *parent, const char *text, const lv_font_t *font, uint32_t color, int32_t y, uint32_t delay_ms, uint32_t stagger_ms);
/* An image flies from one centre to another while it scales (image scale units: 256 = 1x). */
void fx_fly(lv_obj_t *img, int32_t x0, int32_t y0, int32_t x1, int32_t y1, int32_t scale0, int32_t scale1, uint32_t ms, uint32_t delay_ms, bool twirl);
/* Biscuit's window switches on from the centre outwards (the pet is put back as it was after). */
void fx_iris(lv_obj_t *pet, uint32_t ms, uint32_t delay_ms);
/* Three dot rings (radius 132/145/157) spring into place round the centre and keep twinkling;
 * life_ms > 0 fades them out after that long. */
void fx_halo(lv_obj_t *parent, const uint32_t colors[3], const lv_opa_t opas[3], uint32_t delay_ms, uint32_t life_ms);

/* ---- small touches ---- */
void fx_ripple(lv_obj_t *parent, int32_t cx, int32_t cy, int32_t r0, int32_t r1, uint32_t color);
void fx_ripple_from(lv_obj_t *around, int32_t r0, int32_t r1, uint32_t color);
void fx_twinkle(lv_obj_t *parent, int32_t cx, int32_t cy, int32_t radius, int n, uint32_t color, uint32_t ms);
void fx_count(lv_obj_t *label, int from, int to, const char *fmt, uint32_t ms);
