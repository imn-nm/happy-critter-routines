/*
 * The Playtime stage: the web app's 96 x 64 pixel stage (src/components/pets/playtime/stage.ts),
 * drawn in the Field Kit LED style on a 332 px circle. Biscuit is solid; the room, the props and
 * the effects are LED dots. Coordinates are stage pixels, feet on row FLOOR.
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>
#include "../pet/pet_data.h"
#include "../pet/led.h"

#define LW 96
#define LH 64
#define FLOOR 58
#define SY (FLOOR - 40)
/* The grid covers the whole circle: stage x -12..107, y -28..91. */
#define ST_W 120
#define ST_H 120
#define ST_OX 12
#define ST_OY 28
#define STAGE_D 466   /* the whole display (Figma "Scene · full display") */

typedef struct {
    uint8_t room[ST_W * ST_H];   /* backdrop features, props, effects: dots */
    uint8_t walls[ST_W * ST_H];  /* the room's plain walls and floors: softer dots */
    uint8_t body[ST_W * ST_H];   /* Biscuit: solid */
} stage_t;

void stage_clear(stage_t *s, pet_game_room_t room);
uint8_t stage_key(char key);             /* app palette key ('Y' gold) -> palette index */
void stage_set(stage_t *s, int x, int y, uint8_t col);
void stage_rect(stage_t *s, int x, int y, int w, int h, uint8_t col);
/* Rows of palette keys; '.' is empty; `color` (if not 0) overrides every cell. */
void stage_stamp(stage_t *s, const char *const *rows, int n, int x, int y, char color);
int stage_text_width(const char *t);
void stage_text(stage_t *s, const char *t, int x, int y, char key);
/* A white speech bubble with its tail down-left; returns its width. */
int stage_bubble(stage_t *s, const char *t, int x, int y);

/* Biscuit in a pose; sx, sy squash and stretch (1 = none), anchored at the feet. */
typedef struct { pet_pose_id_t pose; float sx, sy; int x, y; } pose_t;
void stage_pose(stage_t *s, const pose_t *p, int clip_below);   /* clip_below: rows >= this hidden (-1: none) */
/* A pose as a cell grid you can change (Bath time paints mud, soap and wet fur on it).
 * Grid is PET_CROP_W x PET_CROP_H with the pose's (0,0) at (PET_POSE_O, PET_POSE_O). */
void stage_pose_cells(pet_pose_id_t pose, uint8_t *grid, bool dressed);
void stage_pose_grid(stage_t *s, const uint8_t *grid, int x, int y);

/* Render to a STAGE_D x STAGE_D RGB565 buffer; with a cache only what changed since the last
 * render into buf is painted. Returns the pixels that changed. */
led_rect_t stage_render(const stage_t *s, uint16_t *buf, led_cache_t *cache);

/* ---- little things that fly about (particles.ts) ---- */
typedef enum { PT_STAR, PT_BUBBLE, PT_SPLASH, PT_CRUMB, PT_TEXT } part_kind_t;
typedef struct { part_kind_t kind; float x, y, vx, vy, g, t, life; char c; char s[6]; } part_t;
#define MAX_PARTS 48
typedef struct { part_t p[MAX_PARTS]; int n; } parts_t;
void parts_add(parts_t *ps, part_kind_t kind, float x, float y, float vx, float vy, float g, float life, char c, const char *s);
void parts_burst(parts_t *ps, float x, float y, int n);
void parts_step(parts_t *ps, float dt);
void parts_draw(const parts_t *ps, stage_t *s);

/* ---- short 12 fps sequences on top of a game's own pose (actions.ts Actor) ---- */
#define ACT_BURST 1
typedef struct { pose_t pose; uint8_t flags; int8_t bx, by, bn; } act_frame_t;
typedef struct {
    act_frame_t f[48];
    int n;
    float t;
    int last;
    bool fresh;
    void (*done)(void *ctx);
    void *ctx;
} actor_t;
void actor_play(actor_t *a, void (*done)(void *), void *ctx);   /* after adding frames with act_add */
void act_add(actor_t *a, int count, pet_pose_id_t pose, float sx, float sy, int x, int y);
void act_burst(actor_t *a, int bx, int by, int n);              /* on the last added frame */
void actor_stop(actor_t *a);
bool actor_busy(const actor_t *a);
void actor_step(actor_t *a, float dt);
/* The current frame (NULL when idle); fires bursts into `ps` once per frame. */
const pose_t *actor_pose(actor_t *a, parts_t *ps);
/* Hop round from the 3/4 view to face the child, then two cheering jumps (actions.ts). */
void act_turn_to_you(actor_t *a, int sx, bool mirror);
void act_cheer(actor_t *a, int fx0);
int front_x_for(int side_x, bool mirror);
bool blinking(float now, float period, float offset);
float frand(void);
