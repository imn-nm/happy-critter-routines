/*
 * Biscuit: a port of src/components/pets/SpritePet.tsx (the behaviour engine) plus the
 * Field Kit LED renderer (artifacts/field-kit-scenes/ledstyle.js). The frames themselves
 * come from pet_data.c, exported from the app's pixel code by device/tools/pet_export.mjs.
 *
 * The three rules from the app still hold:
 *  1. Nothing interrupts a movement: clips change only at a loop boundary or when a
 *     one-shot ends (except from Idle, whose frames are all near-neutral).
 *  2. He does things on his own, at random, after a pause that is never the same twice.
 *  3. He reacts when touched.
 */
#include "pet.h"
#include "led.h"
#include "../hal.h"
#include "../ui/theme.h"
#include <math.h>
#include <stdlib.h>
#include <string.h>

#define FRAME_MS (1000 / PET_FPS)
#define MAX_START_DELAY 24
#define LEAF_CHASE_MIN_MS 16000
#define LEAF_CHASE_MAX_MS 26000

/* ---------------------------------------------------------------- moods (spriteClips.ts MOOD_PLAN) */
typedef struct { pet_clip_id_t clip; float weight; } life_t;
typedef struct {
    pet_clip_id_t base;
    const life_t *life;
    uint8_t nlife;
    uint16_t pause_min, pause_max;   /* ms / 10 */
    const pet_clip_id_t *tap;
    uint8_t ntap;
    bool still;
} plan_t;

static const life_t LIFE_IDLE[] = { { PET_CLIP_CURIOUS, 3 }, { PET_CLIP_WAVE, 1 } };
static const life_t LIFE_HAPPY[] = { { PET_CLIP_CURIOUS, 2 }, { PET_CLIP_ENCOURAGE, 2 }, { PET_CLIP_WAVE, 1 } };
static const life_t LIFE_EXCITED[] = { { PET_CLIP_WAVE, 2 }, { PET_CLIP_CELEBRATE, 1 }, { PET_CLIP_CURIOUS, 1 } };
static const life_t LIFE_DROWSY[] = { { PET_CLIP_SLEEPY, 2 }, { PET_CLIP_CURIOUS, 1 } };
static const pet_clip_id_t TAP_IDLE[] = { PET_CLIP_WAVE, PET_CLIP_CURIOUS };
static const pet_clip_id_t TAP_HAPPY[] = { PET_CLIP_WAVE, PET_CLIP_CURIOUS, PET_CLIP_ENCOURAGE };
static const pet_clip_id_t TAP_EXCITED[] = { PET_CLIP_CELEBRATE, PET_CLIP_WAVE, PET_CLIP_CURIOUS };
static const pet_clip_id_t TAP_DROWSY[] = { PET_CLIP_CURIOUS, PET_CLIP_WAVE };
static const pet_clip_id_t TAP_CELEBRATE[] = { PET_CLIP_CELEBRATE, PET_CLIP_WAVE };
#define N(a) ((uint8_t)(sizeof(a) / sizeof((a)[0])))

static const plan_t PLANS[] = {
    [PET_MOOD_NONE] = { PET_CLIP_IDLE, NULL, 0, 0, 0, NULL, 0, true },
    [PET_MOOD_IDLE] = { PET_CLIP_IDLE, LIFE_IDLE, N(LIFE_IDLE), 600, 1400, TAP_IDLE, N(TAP_IDLE), false },
    [PET_MOOD_HAPPY] = { PET_CLIP_IDLE, LIFE_HAPPY, N(LIFE_HAPPY), 500, 1200, TAP_HAPPY, N(TAP_HAPPY), false },
    [PET_MOOD_EXCITED] = { PET_CLIP_IDLE, LIFE_EXCITED, N(LIFE_EXCITED), 400, 900, TAP_EXCITED, N(TAP_EXCITED), false },
    [PET_MOOD_DROWSY] = { PET_CLIP_IDLE, LIFE_DROWSY, N(LIFE_DROWSY), 800, 1600, TAP_DROWSY, N(TAP_DROWSY), false },
    [PET_MOOD_CELEBRATE] = { PET_CLIP_CELEBRATE, NULL, 0, 0, 0, TAP_CELEBRATE, N(TAP_CELEBRATE), false },
    [PET_MOOD_SLEEP] = { PET_CLIP_SLEEPY, NULL, 0, 0, 0, TAP_DROWSY, N(TAP_DROWSY), false },
    [PET_MOOD_EATING] = { PET_CLIP_EATING, NULL, 0, 0, 0, TAP_DROWSY, N(TAP_DROWSY), false },
};

static const pet_clip_id_t ACTIVITY_CLIP[] = {
    [PET_ACT_NONE] = PET_CLIP_IDLE,
    [PET_ACT_BRUSHING] = PET_CLIP_BRUSHING_TEETH,
    [PET_ACT_EATING] = PET_CLIP_EATING,
    [PET_ACT_READING] = PET_CLIP_READING,
    [PET_ACT_GAMING] = PET_CLIP_GAMING,
    [PET_ACT_SLEEPING] = PET_CLIP_SLEEPY,
    [PET_ACT_SPORTS] = PET_CLIP_SOCCER,
    [PET_ACT_DRAWING] = PET_CLIP_DRAWING,
    [PET_ACT_BUBBLES] = PET_CLIP_BUBBLES,
    [PET_ACT_OUTSIDE] = PET_CLIP_OUTSIDE,
    [PET_ACT_WAKING] = PET_CLIP_WAKE_UP,
    [PET_ACT_HANDWASHING] = PET_CLIP_WASH_HANDS,
    [PET_ACT_SHOWER] = PET_CLIP_SHOWER,
    [PET_ACT_DRESSING] = PET_CLIP_GET_DRESSED,
    [PET_ACT_TIDYING] = PET_CLIP_TIDY,
    [PET_ACT_HOMEWORK] = PET_CLIP_HOMEWORK,
    [PET_ACT_MUSIC] = PET_CLIP_PIANO,
    [PET_ACT_BASKETBALL] = PET_CLIP_BASKETBALL,
};

/* ---------------------------------------------------------------- personality (personality.ts) */
static struct {
    float likes[PET_CLIP_COUNT];
    float pace;
    uint8_t lag_every;
    pet_activity_t fav[5];
} personality = { .pace = 1.0f, .fav = { PET_ACT_READING, PET_ACT_SPORTS, PET_ACT_DRAWING, PET_ACT_BUBBLES, PET_ACT_OUTSIDE } };

static float rand01(void) { return (float)(hal_random_u32() >> 8) / 16777216.0f; }

void pet_set_personality(const char *seed)
{
    for (int i = 0; i < PET_CLIP_COUNT; i++) personality.likes[i] = 1.0f;
    personality.pace = 1.0f;
    personality.lag_every = 0;
    static const pet_activity_t FREE[5] = { PET_ACT_READING, PET_ACT_SPORTS, PET_ACT_DRAWING, PET_ACT_BUBBLES, PET_ACT_OUTSIDE };
    if (!seed || !*seed) {
        memcpy(personality.fav, FREE, sizeof(FREE));
        return;
    }
    uint32_t h = 2166136261u;
    for (const char *c = seed; *c; c++) { h ^= (uint8_t)*c; h *= 16777619u; }
    switch (h % 4) {
    case 0: personality.likes[PET_CLIP_WAVE] = 3; personality.likes[PET_CLIP_ENCOURAGE] = 1.5f; personality.pace = 0.9f; break; /* friendly */
    case 1: personality.likes[PET_CLIP_CURIOUS] = 3; break;                                                                     /* curious */
    case 2: personality.likes[PET_CLIP_CELEBRATE] = 3; personality.likes[PET_CLIP_ENCOURAGE] = 2; personality.pace = 0.7f; break; /* bouncy */
    default: personality.likes[PET_CLIP_CURIOUS] = 1.5f; personality.likes[PET_CLIP_WAVE] = 1.5f; personality.pace = 1.4f; break; /* calm */
    }
    int shift = (int)((h >> 4) % 5);
    for (int i = 0; i < 5; i++) personality.fav[i] = FREE[(i + shift) % 5];
    if ((h >> 9) & 1) { pet_activity_t t = personality.fav[0]; personality.fav[0] = personality.fav[1]; personality.fav[1] = t; }
    static const uint8_t LAGS[3] = { 0, 9, 13 };
    personality.lag_every = LAGS[(h >> 12) % 3];
}

pet_activity_t pet_pick_free_time_activity(void)
{
    float r = rand01();
    return personality.fav[r < 0.5f ? 0 : r < 0.8f ? 1 : 2];
}

/* ---------------------------------------------------------------- character and colour */
static int character = 0, colour = 0;
static uint8_t swap_lut[256];   /* palette index -> index, for the colour chosen */
static bool lut_ready;
static void mark_all_dirty(void);
static void repaint_faces(void);

static void build_lut(void)
{
    for (int i = 0; i < 256; i++) swap_lut[i] = (uint8_t)i;
    const pet_char_t *c = &pet_chars[character];
    for (int r = 0; r < c->nroles; r++) swap_lut[c->roles[r]] = c->colours[colour].to[r];
    lut_ready = true;
}

void pet_set_character(int ch, int col)
{
    if (ch < 0 || ch >= PET_CHAR_COUNT) ch = 0;
    if (col < 0 || col >= PET_COLOUR_COUNT) col = 0;
    character = ch;
    colour = col;
    build_lut();
    mark_all_dirty();
    repaint_faces();
}
void pet_get_character(int *ch, int *col)
{
    if (ch) *ch = character;
    if (col) *col = colour;
}
int pet_char_by_id(const char *id)
{
    if (!id) return -1;
    for (int i = 0; i < PET_CHAR_COUNT; i++) if (strcmp(pet_chars[i].id, id) == 0) return i;
    return -1;
}
static bool same_word(const char *a, const char *b)
{
    for (; *a && *b; a++, b++) {
        char x = *a, y = *b;
        if (x >= 'A' && x <= 'Z') x = (char)(x + 32);
        if (y >= 'A' && y <= 'Z') y = (char)(y + 32);
        if (x != y) return false;
    }
    return *a == *b;
}
int pet_colour_by_name(int ch, const char *name)
{
    if (!name || !*name || ch < 0 || ch >= PET_CHAR_COUNT) return 0;
    for (int i = 0; i < PET_COLOUR_COUNT; i++) if (same_word(pet_chars[ch].colours[i].name, name)) return i;
    return 0;
}
const pet_frame_t *pet_frame_of(int frame) { return &pet_frames[pet_chars[character].first_frame + frame]; }
const uint16_t *pet_frame_outfit_of(int frame) { return pet_frame_outfit[pet_chars[character].first_frame + frame]; }
const pet_pose_t *pet_pose_of(pet_pose_id_t pose) { return &pet_poses[pet_chars[character].first_pose + pose]; }
void pet_apply_colour(uint8_t *grid, int n)
{
    if (!lut_ready) build_lut();
    for (int i = 0; i < n; i++) grid[i] = swap_lut[grid[i]];
}
bool pet_is_body(uint8_t idx)
{
    const pet_char_t *c = &pet_chars[character];
    for (int i = 0; i < c->nbody; i++) if (c->body[i] == idx) return true;
    return false;
}

/* ---------------------------------------------------------------- outfit */
static int outfit[3] = { -1, -1, -1 }; /* head, face, neck */

void pet_set_outfit(int head, int face, int neck)
{
    outfit[0] = head; outfit[1] = face; outfit[2] = neck;
}
void pet_get_outfit(int *head, int *face, int *neck)
{
    if (head) *head = outfit[0];
    if (face) *face = outfit[1];
    if (neck) *neck = outfit[2];
}
int pet_acc_by_name(const char *name)
{
    if (!name) return -1;
    for (int i = 0; i < PET_ACC_COUNT; i++) if (strcmp(pet_acc_names[i], name) == 0) return i;
    return -1;
}

/* ---------------------------------------------------------------- one pet */
typedef enum { PH_FULL, PH_INTRO, PH_LOOP, PH_OUTRO } phase_t;

typedef struct pet {
    lv_obj_t *obj;
    uint16_t *buf;
    int32_t d;
    led_cache_t cache;      /* what's in buf, so a frame repaints only his cells */
    pet_look_t look;
    pet_mood_t mood;
    pet_activity_t act;
    int forced;
    /* what is playing */
    pet_clip_id_t playing;
    bool once;
    phase_t phase;
    int frame;
    bool holding;
    int queued;
    /* habits */
    uint32_t habit_at, chase_at;
    int start_delay;
    uint32_t ticks;
    bool paused, tappable, dirty;
    bool wake;          /* holding the last frame of the Sleepy outro (the alarm) */
    int8_t ground, prev_bottom;   /* the row he stands on, and where his feet were last frame */
    int8_t paw_l, paw_r, paw_y;   /* his feet in grid cells */
    struct pet *next;
} pet_t;

static void (*land_cb)(lv_obj_t *, void *);
static void *land_user;

static pet_t *pets;
static lv_timer_t *ticker;
static bool frozen;   /* pet_freeze_all: the ticker stays paused */

static bool has_loop(pet_clip_id_t c) { return pet_clips[c].loop_start >= 0; }

static pet_clip_id_t base_of(const pet_t *p)
{
    if (p->forced >= 0) return (pet_clip_id_t)p->forced;
    if (p->act != PET_ACT_NONE) return ACTIVITY_CLIP[p->act];
    return PLANS[p->mood].base;
}
static bool busy(const pet_t *p) { return has_loop(base_of(p)); }
static bool still(const pet_t *p) { return PLANS[p->mood].still && p->act == PET_ACT_NONE && p->forced < 0; }

static void range(const pet_t *p, int *from, int *to)
{
    const pet_clip_t *c = &pet_clips[p->playing];
    bool loop = c->loop_start >= 0;
    if (loop && p->phase == PH_INTRO) { *from = 0; *to = c->loop_start; }
    else if (loop && p->phase == PH_LOOP) { *from = c->loop_start; *to = c->loop_end; }
    else if (loop && p->phase == PH_OUTRO) { *from = c->loop_end; *to = c->count - 1; }
    else { *from = 0; *to = c->count - 1; }
}

static void restart(pet_t *p)
{
    int from, to;
    range(p, &from, &to);
    const pet_clip_t *c = &pet_clips[p->playing];
    p->frame = still(p) ? (c->loop_start >= 0 ? c->loop_start : 0) : from;
    p->holding = false;
    p->dirty = true;
}

static void play(pet_t *p, pet_clip_id_t name, bool once)
{
    p->playing = name;
    p->once = once;
    p->phase = !once && has_loop(name) ? PH_INTRO : PH_FULL;
    restart(p);
}

static void set_phase(pet_t *p, phase_t ph)
{
    p->phase = ph;
    restart(p);
}

/* Start something now if he's only idling, otherwise queue it. */
static void request(pet_t *p, pet_clip_id_t name)
{
    if (p->playing == PET_CLIP_IDLE && !p->once) play(p, name, true);
    else p->queued = name;
}

/* A loop boundary or the end of a one-shot: the only moments a clip changes. */
static void at_boundary(pet_t *p)
{
    if (p->wake) {   /* the alarm: up out of bed, then the big stretch, then he stays there, awake */
        if (p->playing == PET_CLIP_SLEEPY) play(p, PET_CLIP_WAKE_UP, true);
        return;
    }
    pet_clip_id_t base = base_of(p);
    bool leaving = p->playing != base || p->queued >= 0;
    if (p->phase == PH_INTRO) { set_phase(p, leaving ? PH_OUTRO : PH_LOOP); return; }
    if (p->phase == PH_LOOP) { if (leaving) set_phase(p, PH_OUTRO); return; }
    if (p->queued >= 0) {
        pet_clip_id_t next = (pet_clip_id_t)p->queued;
        p->queued = -1;
        play(p, next, true);
        return;
    }
    if (p->once || p->phase == PH_OUTRO || p->playing != base) play(p, base, false);
}

static uint32_t pause_ms(const pet_t *p)
{
    const plan_t *pl = &PLANS[p->mood];
    float lo = pl->pause_min * 10.0f * personality.pace, hi = pl->pause_max * 10.0f * personality.pace;
    return (uint32_t)(lo + rand01() * (hi - lo));
}

static bool has_habits(const pet_t *p)
{
    return p->forced < 0 && p->act == PET_ACT_NONE && !busy(p) && PLANS[p->mood].nlife && !still(p);
}

/* In the timer ring, a resting rabbit chases a leaf every so often (CritterPet.tsx). */
static bool chases_leaves(const pet_t *p)
{
    return p->forced < 0 && p->act == PET_ACT_NONE &&
           (p->mood == PET_MOOD_IDLE || p->mood == PET_MOOD_HAPPY || p->mood == PET_MOOD_EXCITED);
}

static void arm_habits(pet_t *p)
{
    uint32_t now = lv_tick_get();
    p->habit_at = has_habits(p) ? now + pause_ms(p) : 0;
    p->chase_at = chases_leaves(p) ? now + LEAF_CHASE_MIN_MS + (uint32_t)(rand01() * (LEAF_CHASE_MAX_MS - LEAF_CHASE_MIN_MS)) : 0;
}

static pet_clip_id_t pick_weighted(const life_t *opts, int n)
{
    float total = 0;
    for (int i = 0; i < n; i++) total += opts[i].weight * personality.likes[opts[i].clip];
    float r = rand01() * total;
    for (int i = 0; i < n; i++) {
        r -= opts[i].weight * personality.likes[opts[i].clip];
        if (r <= 0) return opts[i].clip;
    }
    return opts[n - 1].clip;
}

/* Mood, activity or forced clip changed, which means the screen moved on (a new task, the cheer
 * over): start the new base at once. Its room comes with it, so this reads as a cut to the next
 * scene; waiting for the old clip to wind down (a whole carrot, a cheer) left him doing the last
 * task for seconds under the new task's title. */
static void base_changed(pet_t *p)
{
    pet_clip_id_t base = base_of(p);
    p->wake = false;
    p->queued = -1;
    p->start_delay = 0;
    arm_habits(p);
    if (p->playing == base && !p->once) { p->dirty = true; return; }
    play(p, base, false);
}

/* ---------------------------------------------------------------- drawing (led.c) */
#define GRID (PET_CROP_W * PET_CROP_H)
static uint8_t g_room[GRID], g_body[GRID], g_fx[GRID], g_walls[GRID];

static void blit(uint8_t *grid, uint16_t sprite) { led_blit(grid, PET_CROP_W, PET_CROP_H, sprite, 0, 0); }

static uint16_t rgb565(uint32_t hex)
{
    return (uint16_t)((((hex >> 19) & 0x1F) << 11) | (((hex >> 10) & 0x3F) << 5) | ((hex >> 3) & 0x1F));
}

static void render(pet_t *p)
{
    const pet_clip_t *clip = &pet_clips[p->playing];
    int gframe = clip->first + p->frame;
    if (p->frame >= clip->count) gframe = clip->first + clip->count - 1;

    /* the room: an activity keeps its own room; anything else uses the base's room */
    pet_clip_id_t room_clip = p->phase == PH_FULL ? base_of(p) : p->playing;
    pet_scene_t scene = pet_clips[room_clip].scene;
    memset(g_room, 0, sizeof g_room);
    memset(g_walls, 0, sizeof g_walls);
    blit(g_walls, pet_room_walls[scene]);
    if (scene == PET_SCENE_BEDROOM) {
        int t = p->playing == PET_CLIP_SLEEPY ? p->frame - pet_clips[PET_CLIP_SLEEPY].loop_end : -1;
        /* waking up and getting dressed happen in the morning (scenes.ts MORNING) */
        if (room_clip == PET_CLIP_WAKE_UP || room_clip == PET_CLIP_GET_DRESSED) t = PET_BEDROOM_DAWN_COUNT - 1;
        if (t < 0) blit(g_room, pet_bedroom_night[p->frame % PET_BEDROOM_NIGHT_COUNT]);
        else blit(g_room, pet_bedroom_dawn[t < PET_BEDROOM_DAWN_COUNT - 1 ? t : PET_BEDROOM_DAWN_COUNT - 1]);
    } else {
        blit(g_room, pet_room[scene]);
    }

    memset(g_body, 0, sizeof g_body);
    blit(g_body, pet_frame_of(gframe)->body);
    static const int LAYER[3] = { 2, 1, 0 }; /* neck, then face, then head */
    for (int k = 0; k < 3; k++) {
        int acc = outfit[LAYER[k]];
        if (acc >= 0 && acc < PET_ACC_COUNT && pet_acc_slot[acc] == LAYER[k]) blit(g_body, pet_frame_outfit_of(gframe)[acc]);
    }
    pet_apply_colour(g_body, GRID);
    /* where he stands: the lowest row of his body, for landings and his paws */
    int bottom = -1, l = PET_CROP_W, r = -1;
    for (int y = PET_CROP_H - 1; y >= 0 && bottom < 0; y--)
        for (int x = 0; x < PET_CROP_W; x++) if (g_body[y * PET_CROP_W + x]) { bottom = y; break; }
    if (bottom >= 0) for (int x = 0; x < PET_CROP_W; x++) if (g_body[bottom * PET_CROP_W + x]) { if (x < l) l = x; if (x > r) r = x; }
    if (p->frame == 0 || p->ground < 0) p->ground = (int8_t)bottom;
    bool landed = p->prev_bottom >= 0 && bottom >= 0 && p->prev_bottom < p->ground - 2 && bottom >= p->ground - 1;
    p->prev_bottom = (int8_t)bottom;
    p->paw_l = (int8_t)l;
    p->paw_r = (int8_t)r;
    p->paw_y = (int8_t)bottom;

    bool celebrate = p->playing == PET_CLIP_CELEBRATE;
    memset(g_fx, 0, sizeof g_fx);
    if (!celebrate) blit(g_fx, pet_frame_of(gframe)->fx);

    led_args_t a = {
        .buf = p->buf, .d = p->d, .pitch = p->look.pitch,
        .room = g_room, .body = g_body, .fx = g_fx, .walls = g_walls, .gw = PET_CROP_W, .gh = PET_CROP_H,
        .cx = PET_RING_CX + p->look.dx, .cy = PET_RING_CY + p->look.dy,
        .dim = p->look.dim, .room_off = p->look.room_off,
        .bg = lv_color_to_u32(p->look.bg) & 0xFFFFFF, .sparkles = celebrate ? p->frame : -1,
        .palette = NULL, .extend = p->look.wide, .solid = p->look.solid, .room_fade = p->look.room_fade,
        .cache = &p->cache,
    };
    led_rect_t px = led_render(&a);
    if (UI_DEPTH) {
        /* The whole room, as before: with layered rows (UI_DEPTH) LVGL can leave a pixel row of a
         * fading row behind, which this repaint 12 times a second cleaned up. The browser can afford
         * it; the board (UI_DEPTH 0, no layered rows) repaints only what changed. */
        lv_obj_invalidate(p->obj);
    } else if (px.x1 > px.x0 && px.y1 > px.y0) {
        /* only what changed: from one frame to the next that's him, not the whole room */
        lv_area_t at;
        lv_obj_get_coords(p->obj, &at);
        lv_area_t changed = { at.x1 + px.x0, at.y1 + px.y0, at.x1 + px.x1 - 1, at.y1 + px.y1 - 1 };
        lv_obj_invalidate_area(p->obj, &changed);
    }
    p->dirty = false;
    if (landed && land_cb) land_cb(p->obj, land_user);
}

void pet_set_on_land(void (*cb)(lv_obj_t *, void *), void *user) { land_cb = cb; land_user = user; }

static void mark_all_dirty(void)
{
    for (pet_t *p = pets; p; p = p->next) p->dirty = true;
}


/* ---------------------------------------------------------------- the clock */
static void step(pet_t *p)
{
    uint32_t now = lv_tick_get();
    if (p->habit_at && (int32_t)(now - p->habit_at) >= 0) {
        const plan_t *pl = &PLANS[p->mood];
        request(p, pick_weighted(pl->life, pl->nlife));
        p->habit_at = now + pause_ms(p);
    }
    if (p->chase_at && (int32_t)(now - p->chase_at) >= 0) {
        request(p, PET_CLIP_LEAF_CHASE);
        p->chase_at = now + LEAF_CHASE_MIN_MS + (uint32_t)(rand01() * (LEAF_CHASE_MAX_MS - LEAF_CHASE_MIN_MS));
    }
    if (still(p) || p->holding) return;
    if (p->start_delay > 0) { p->start_delay--; return; }
    if (personality.lag_every && ++p->ticks % personality.lag_every == 0) return;
    int from, to;
    range(p, &from, &to);
    if (to <= from) { at_boundary(p); return; }
    int f = p->frame + 1;
    if (p->playing == PET_CLIP_SLEEPY && p->phase == PH_INTRO && f + 1 < to) f++;   /* nodding off, at double speed: in bed in under 2 s */
    if (f < to) { p->frame = f; p->dirty = true; return; }
    bool repeats = p->phase == PH_LOOP || (p->phase == PH_FULL && !p->once);
    if (repeats) p->frame = from;
    else { p->frame = to; p->holding = true; }
    p->dirty = true;
    at_boundary(p);
}

static void tick(lv_timer_t *t)
{
    (void)t;
    for (pet_t *p = pets; p; p = p->next) {
        if (p->paused) continue;
        step(p);
        if (p->dirty) render(p);
    }
}

/* ---------------------------------------------------------------- the widget */
static void on_event(lv_event_t *e)
{
    pet_t *p = lv_event_get_user_data(e);
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_DELETE) {
        for (pet_t **pp = &pets; *pp; pp = &(*pp)->next) if (*pp == p) { *pp = p->next; break; }
        lv_free(p->buf);
        lv_free(p->cache.cells);
        lv_free(p);
        if (!pets && ticker) { lv_timer_delete(ticker); ticker = NULL; }
    } else if (code == LV_EVENT_CLICKED && p->tappable) {
        const plan_t *pl = &PLANS[p->mood];
        if (p->forced < 0 && !busy(p) && pl->ntap) request(p, pl->tap[hal_random_u32() % pl->ntap]);
    }
}

pet_look_t pet_default_look(int32_t diameter)
{
    /* MyToki 2: the same cell size at any diameter; the window sits two cells right of the ring's
     * old centre, and PET_LOW_CELLS up it, so the pet stands 40 px lower than the Figma scenes had
     * him (there was little on the floor; user, 2026-10-22). Playtime keeps the Figma height. */
    (void)diameter;
    pet_look_t l = { .pitch = PET_PITCH, .dim = 0, .bg = lv_color_hex(0x000000), .dx = 2, .dy = 2 - PET_LOW_CELLS, .wide = true, .solid = true };
    return l;
}

lv_obj_t *pet_create(lv_obj_t *parent, int32_t diameter)
{
    pet_t *p = lv_malloc_zeroed(sizeof(pet_t));
    p->d = diameter;
    p->buf = lv_malloc((size_t)diameter * diameter * 2);
    p->obj = lv_canvas_create(parent);
    lv_canvas_set_buffer(p->obj, p->buf, diameter, diameter, LV_COLOR_FORMAT_RGB565);
    lv_obj_add_flag(p->obj, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_remove_flag(p->obj, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_user_data(p->obj, p);
    lv_obj_add_event_cb(p->obj, on_event, LV_EVENT_ALL, p);
    p->look = pet_default_look(diameter);
    p->mood = PET_MOOD_IDLE;
    p->act = PET_ACT_NONE;
    p->forced = -1;
    p->queued = -1;
    p->tappable = true;
    p->start_delay = (int)(hal_random_u32() % MAX_START_DELAY);
    p->ground = -1;
    p->prev_bottom = -1;
    play(p, PET_CLIP_IDLE, false);
    arm_habits(p);
    p->next = pets;
    pets = p;
    if (!ticker) {
        ticker = lv_timer_create(tick, FRAME_MS, NULL);
        if (frozen) lv_timer_pause(ticker);
    }
    render(p);
    return p->obj;
}

static pet_t *get(lv_obj_t *obj) { return obj ? lv_obj_get_user_data(obj) : NULL; }

void pet_set_look(lv_obj_t *obj, const pet_look_t *look)
{
    pet_t *p = get(obj);
    if (!p) return;
    p->look = *look;
    render(p);
}

void pet_set_mood(lv_obj_t *obj, pet_mood_t mood)
{
    pet_t *p = get(obj);
    if (!p || p->mood == mood) return;
    p->mood = mood;
    base_changed(p);
}

void pet_set_activity(lv_obj_t *obj, pet_activity_t act)
{
    pet_t *p = get(obj);
    if (!p || p->act == act) return;
    p->act = act;
    base_changed(p);
}

void pet_force_clip(lv_obj_t *obj, int clip)
{
    pet_t *p = get(obj);
    if (!p || p->forced == clip) return;
    p->forced = clip;
    p->wake = false;
    if (clip >= 0) { p->start_delay = 0; play(p, (pet_clip_id_t)clip, false); arm_habits(p); }
    else base_changed(p);
}

void pet_paws(lv_obj_t *obj, int32_t *lx, int32_t *rx, int32_t *y)
{
    pet_t *p = get(obj);
    if (!p) return;
    float cx = PET_RING_CX + p->look.dx, cy = PET_RING_CY + p->look.dy;
    int32_t ox = lv_obj_get_x(obj) + p->d / 2, oy = lv_obj_get_y(obj) + p->d / 2;
    if (lx) *lx = ox + (int32_t)((p->paw_l - cx) * p->look.pitch);
    if (rx) *rx = ox + (int32_t)((p->paw_r + 1 - cx) * p->look.pitch);
    if (y) *y = oy + (int32_t)((p->paw_y + 1 - cy) * p->look.pitch);
}

void pet_wake_up(lv_obj_t *obj)
{
    pet_t *p = get(obj);
    if (!p || p->wake) return;
    p->wake = true;
    p->forced = -1;
    p->queued = -1;
    p->habit_at = p->chase_at = 0;
    p->start_delay = 0;
    if ((p->playing == PET_CLIP_SLEEPY && p->phase == PH_OUTRO) || p->playing == PET_CLIP_WAKE_UP) return;   /* already getting up */
    p->playing = PET_CLIP_SLEEPY;
    p->once = true;
    p->phase = PH_OUTRO;
    p->frame = pet_clips[PET_CLIP_SLEEPY].loop_end;
    p->holding = false;
    p->dirty = true;
}

void pet_react(lv_obj_t *obj, pet_clip_id_t clip)
{
    pet_t *p = get(obj);
    if (!p || busy(p) || p->forced >= 0) return;
    request(p, clip);
}

void pet_set_tappable(lv_obj_t *obj, bool on)
{
    pet_t *p = get(obj);
    if (p) p->tappable = on;
}

void pet_freeze_all(bool f)
{
    frozen = f;
    if (!ticker) return;
    if (f) lv_timer_pause(ticker);
    else lv_timer_resume(ticker);
}

void pet_set_paused(lv_obj_t *obj, bool paused)
{
    pet_t *p = get(obj);
    if (p) p->paused = paused;
}

bool pet_is_paused(lv_obj_t *obj)
{
    pet_t *p = get(obj);
    return !p || p->paused;
}

const char *pet_current_clip_name(lv_obj_t *obj)
{
    pet_t *p = get(obj);
    return p ? pet_clip_names[p->playing] : "";
}

void pet_set_size(lv_obj_t *obj, int32_t diameter)
{
    pet_t *p = get(obj);
    if (!p || p->d == diameter) return;
    lv_free(p->buf);
    p->d = diameter;
    p->buf = lv_malloc((size_t)diameter * diameter * 2);
    lv_canvas_set_buffer(p->obj, p->buf, diameter, diameter, LV_COLOR_FORMAT_RGB565);
    render(p);
}

/* ---------------------------------------------------------------- the face */
/* The small faces (the Play tab, the wheel's hub) keep up with the character the child picks;
 * the picker's own tiles show a fixed character and colour. */
typedef struct face {
    lv_obj_t *cv;
    uint16_t *buf;
    int cell, ch, col;
    int box;                /* a round portrait box px square (0: the plain 13-row crop) */
    lv_color_t bg;
    bool follow;
    struct face *next;
} face_t;
static face_t *faces;

static void face_paint(face_t *fc)
{
    int ch = fc->follow ? character : fc->ch, col = fc->follow ? colour : fc->col;
    const pet_char_t *c = &pet_chars[ch];
    /* the Wave clip faces the child and smiles on frame 8 */
    const pet_frame_t *f = &pet_frames[c->first_frame + pet_clips[PET_CLIP_WAVE].first + 8];
    memset(g_body, 0, sizeof g_body);
    blit(g_body, f->body);
    uint8_t lut[256];
    for (int i = 0; i < 256; i++) lut[i] = (uint8_t)i;
    for (int r = 0; r < c->nroles; r++) lut[c->roles[r]] = c->colours[col].to[r];
    for (int i = 0; i < GRID; i++) g_body[i] = lut[g_body[i]];
    int x0 = PET_CROP_W, x1 = -1, y0 = PET_CROP_H;
    for (int y = 0; y < PET_CROP_H; y++)
        for (int x = 0; x < PET_CROP_W; x++)
            if (g_body[y * PET_CROP_W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; }
    /* the head: Biscuit's from the ears' inner colour down to the chin (13 rows), as in the Figma hub;
     * each character says where its own starts */
    int top = y0 + c->face_top, rows = 13;
    int cols = x1 - x0 + 1;
    if (cols > 24) cols = 24;
    int w = cols * fc->cell, h = rows * fc->cell, ox = 0, oy = 0;
    if (fc->box) {
        /* the portrait: from three rows above the face (the ears) down to what fits in the box,
         * centred across it, 2 px in from the top */
        top -= 3;
        if (top < y0) top = y0;
        rows = (fc->box - 2) / fc->cell;
        if (top + rows > PET_CROP_H) rows = PET_CROP_H - top;
        w = h = fc->box;
        ox = (fc->box - cols * fc->cell) / 2;
        oy = 2;
    }
    lv_free(fc->buf);
    fc->buf = lv_malloc((size_t)w * h * 2);
    uint16_t bg565 = lv_color_to_u16(fc->bg);
    for (int i = 0; i < w * h; i++) fc->buf[i] = bg565;
    for (int y = 0; y < rows; y++)
        for (int x = 0; x < cols; x++) {
            uint8_t cc = g_body[(top + y) * PET_CROP_W + x0 + x];
            if (!cc) continue;
            uint16_t v = rgb565(pet_palette[cc]);
            for (int dy = 0; dy < fc->cell; dy++)
                for (int dx = 0; dx < fc->cell; dx++) {
                    int px = ox + x * fc->cell + dx, py = oy + y * fc->cell + dy;
                    if (px >= 0 && px < w && py >= 0 && py < h) fc->buf[py * w + px] = v;
                }
        }
    lv_canvas_set_buffer(fc->cv, fc->buf, w, h, LV_COLOR_FORMAT_RGB565);
    lv_obj_invalidate(fc->cv);
}

static void face_delete(lv_event_t *e)
{
    face_t *fc = lv_event_get_user_data(e);
    for (face_t **pp = &faces; *pp; pp = &(*pp)->next) if (*pp == fc) { *pp = fc->next; break; }
    lv_free(fc->buf);
    lv_free(fc);
}

static void repaint_faces(void)
{
    for (face_t *fc = faces; fc; fc = fc->next) if (fc->follow) face_paint(fc);
}

static lv_obj_t *face_create(lv_obj_t *parent, int ch, int col, bool follow, int cell, lv_color_t bg)
{
    if (ch < 0 || ch >= PET_CHAR_COUNT) ch = 0;
    if (col < 0 || col >= PET_COLOUR_COUNT) col = 0;
    face_t *fc = lv_malloc_zeroed(sizeof(face_t));
    fc->cv = lv_canvas_create(parent);
    fc->cell = cell;
    fc->ch = ch;
    fc->col = col;
    fc->bg = bg;
    fc->follow = follow;
    fc->next = faces;
    faces = fc;
    face_paint(fc);
    lv_obj_add_event_cb(fc->cv, face_delete, LV_EVENT_DELETE, fc);
    lv_obj_remove_flag(fc->cv, LV_OBJ_FLAG_CLICKABLE);
    return fc->cv;
}

lv_obj_t *pet_face_create(lv_obj_t *parent, int cell, lv_color_t bg)
{
    return face_create(parent, character, colour, true, cell, bg);
}

lv_obj_t *pet_face_create_of(lv_obj_t *parent, int ch, int col, int cell, lv_color_t bg)
{
    return face_create(parent, ch, col, false, cell, bg);
}

lv_obj_t *pet_face_create_round(lv_obj_t *parent, int ch, int col, int d, lv_color_t bg)
{
    lv_obj_t *cv = face_create(parent, ch, col, false, 2, bg);
    face_t *fc = faces;   /* the one just made */
    fc->box = d;
    face_paint(fc);
    lv_obj_set_style_radius(cv, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_clip_corner(cv, true, 0);
    return cv;
}

void pet_skip_intro(lv_obj_t *obj)
{
    pet_t *p = get(obj);
    if (!p) return;
    p->start_delay = 0;
    if (p->phase == PH_INTRO && has_loop(p->playing)) set_phase(p, PH_LOOP);
}
