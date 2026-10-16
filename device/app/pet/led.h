/*
 * The Field Kit "LED field" (artifacts/field-kit-scenes/ledstyle.js), drawn into an RGB565
 * canvas: a dim unlit dot everywhere, only the room's features lit, Biscuit as solid squares
 * on the same grid, effects as lit dots.
 * Used by Biscuit's round scenes (pet.c) and the Playtime stage (play/stage.c).
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

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
} led_args_t;

void led_render(const led_args_t *a);

/* Copy a run-length sprite (pet_data.h format) into a grid, shifted by (dx, dy). */
void led_blit(uint8_t *grid, int gw, int gh, uint16_t sprite, int dx, int dy);
