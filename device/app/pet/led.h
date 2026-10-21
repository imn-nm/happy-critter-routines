/*
 * The Field Kit "LED field" (artifacts/field-kit-scenes/ledstyle.js), drawn into an RGB565
 * canvas: a dim unlit dot everywhere, only the room's features lit, Biscuit as solid squares
 * on the same grid, effects as lit dots.
 * Used by Biscuit's round scenes (pet.c) and the Playtime stage (play/stage.c).
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

/* What the last solid render left in a canvas, so the next one repaints only the cells that changed
 * (from one of Biscuit's frames to the next that's him, not the room). Zero it to start; free
 * `cells` with lv_free. */
typedef struct {
    uint8_t *cells;         /* the palette index each cell shows */
    int cap;
    uint32_t key;           /* everything else that decides the picture */
} led_cache_t;

/* The pixels a render changed, [x0, x1) x [y0, y1); empty when x1 <= x0. */
typedef struct { int x0, y0, x1, y1; } led_rect_t;

typedef struct {
    uint16_t *buf;          /* d x d RGB565 */
    int d;
    float pitch;            /* px between LEDs */
    const uint8_t *room, *body, *fx;   /* cell grids of palette indices (0 = nothing); fx may be NULL */
    const uint8_t *walls;   /* the room's plain walls and floors: softer dots (may be NULL) */
    int gw, gh;             /* grid size */
    int cx, cy;             /* the grid cell under the canvas centre */
    uint8_t dim;            /* 0 = full brightness, 255 = black */
    uint32_t bg;            /* 0xRRGGBB behind the round field */
    int sparkles;           /* >= 0: Celebrate's five lime sparkles, twinkling with this frame */
    const uint32_t *palette; /* 0xRRGGBB per index, or NULL for Biscuit's pet_palette */
    bool extend;            /* a wide room: the walls carry on sideways past the grid */
    bool room_off;          /* draw only Biscuit and his effects; no walls, features or unlit dots */
    bool solid;             /* MyToki 2: plain pixel art, every cell a full square in its own colour (no LED dots) */
    led_cache_t *cache;     /* solid only: repaint just what changed since the last render into buf (NULL: all of it) */
} led_args_t;

led_rect_t led_render(const led_args_t *a);

/* Copy a run-length sprite (pet_data.h format) into a grid, shifted by (dx, dy). */
void led_blit(uint8_t *grid, int gw, int gh, uint16_t sprite, int dx, int dy);
