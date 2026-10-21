#include "stage.h"
#include "../pet/led.h"
#include "../pet/pet.h"
#include "../hal.h"
#include <math.h>
#include <string.h>

float frand(void) { return (float)(hal_random_u32() >> 8) / 16777216.0f; }
bool blinking(float now, float period, float offset) { return fmodf(now + offset, period) < 150.0f; }
int front_x_for(int side_x, bool mirror) { return side_x + (mirror ? 5 : 2); }

uint8_t stage_key(char key) { return (unsigned char)key < 128 ? pet_pal_key[(unsigned char)key] : 0; }

void stage_clear(stage_t *s, pet_game_room_t room)
{
    memset(s->room, 0, sizeof s->room);
    memset(s->body, 0, sizeof s->body);
    memset(s->walls, 0, sizeof s->walls);
    led_blit(s->room, ST_W, ST_H, pet_game_rooms[room], ST_OX, ST_OY);
    led_blit(s->walls, ST_W, ST_H, pet_game_room_walls[room], ST_OX, ST_OY);
    /* the room carries on past the stage's edges to fill the circle: its edge cells, stretched */
    for (int y = 0; y < ST_H; y++) {
        int sy = y < ST_OY ? ST_OY : y >= ST_OY + LH ? ST_OY + LH - 1 : y;
        for (int x = 0; x < ST_W; x++) {
            int sx = x < ST_OX ? ST_OX : x >= ST_OX + LW ? ST_OX + LW - 1 : x;
            if (sx == x && sy == y) continue;
            int from = sy * ST_W + sx;
            s->walls[y * ST_W + x] = s->walls[from] ? s->walls[from] : s->room[from];
        }
    }
}

void stage_set(stage_t *s, int x, int y, uint8_t col)
{
    x += ST_OX;
    y += ST_OY;
    if (x < 0 || y < 0 || x >= ST_W || y >= ST_H || !col) return;
    s->room[y * ST_W + x] = col;
}

void stage_rect(stage_t *s, int x, int y, int w, int h, uint8_t col)
{
    for (int yy = y; yy < y + h; yy++) for (int xx = x; xx < x + w; xx++) stage_set(s, xx, yy, col);
}

void stage_stamp(stage_t *s, const char *const *rows, int n, int x, int y, char color)
{
    for (int j = 0; j < n; j++)
        for (int i = 0; rows[j][i]; i++)
            if (rows[j][i] != '.' && rows[j][i] != ' ') stage_set(s, x + i, y + j, stage_key(color ? color : rows[j][i]));
}

/* ---------------------------------------------------------------- the 3 x 5 font (pixelText.ts) */
typedef struct { char ch; const char *rows[5]; } glyph_t;
static const glyph_t FONT[] = {
    { 'A', { ".#.", "#.#", "###", "#.#", "#.#" } }, { 'B', { "##.", "#.#", "##.", "#.#", "##." } },
    { 'C', { ".##", "#..", "#..", "#..", ".##" } }, { 'D', { "##.", "#.#", "#.#", "#.#", "##." } },
    { 'E', { "###", "#..", "##.", "#..", "###" } }, { 'F', { "###", "#..", "##.", "#..", "#.." } },
    { 'G', { ".##", "#..", "#.#", "#.#", ".##" } }, { 'H', { "#.#", "#.#", "###", "#.#", "#.#" } },
    { 'I', { "###", ".#.", ".#.", ".#.", "###" } }, { 'K', { "#.#", "#.#", "##.", "#.#", "#.#" } },
    { 'L', { "#..", "#..", "#..", "#..", "###" } }, { 'M', { "#.#", "###", "###", "#.#", "#.#" } },
    { 'N', { "##.", "#.#", "#.#", "#.#", "#.#" } }, { 'O', { ".#.", "#.#", "#.#", "#.#", ".#." } },
    { 'P', { "##.", "#.#", "##.", "#..", "#.." } }, { 'R', { "##.", "#.#", "##.", "#.#", "#.#" } },
    { 'S', { ".##", "#..", ".#.", "..#", "##." } }, { 'T', { "###", ".#.", ".#.", ".#.", ".#." } },
    { 'U', { "#.#", "#.#", "#.#", "#.#", "###" } }, { 'W', { "#.#", "#.#", "###", "###", "#.#" } },
    { 'Y', { "#.#", "#.#", ".#.", ".#.", ".#." } }, { '0', { "###", "#.#", "#.#", "#.#", "###" } },
    { '1', { ".#.", "##.", ".#.", ".#.", "###" } }, { '2', { "##.", "..#", ".#.", "#..", "###" } },
    { '3', { "##.", "..#", ".#.", "..#", "##." } }, { '4', { "#.#", "#.#", "###", "..#", "..#" } },
    { '5', { "###", "#..", "##.", "..#", "##." } }, { '6', { ".##", "#..", "###", "#.#", "###" } },
    { '7', { "###", "..#", ".#.", ".#.", ".#." } }, { '8', { "###", "#.#", "###", "#.#", "###" } },
    { '9', { "###", "#.#", "###", "..#", "##." } }, { '!', { "#", "#", "#", ".", "#" } },
    { '+', { "...", ".#.", "###", ".#.", "..." } }, { ':', { ".", "#", ".", "#", "." } },
    { '.', { ".", ".", ".", ".", "#" } },
};

static const glyph_t *glyph(char c)
{
    for (unsigned i = 0; i < sizeof FONT / sizeof FONT[0]; i++) if (FONT[i].ch == c) return &FONT[i];
    return NULL;
}

int stage_text_width(const char *t)
{
    int w = -1;
    for (; *t; t++) { const glyph_t *g = glyph(*t); w += (g ? (int)strlen(g->rows[0]) : 2) + 1; }
    return w;
}

void stage_text(stage_t *s, const char *t, int x, int y, char key)
{
    for (; *t; t++) {
        const glyph_t *g = glyph(*t);
        if (g) { stage_stamp(s, g->rows, 5, x, y, key); x += (int)strlen(g->rows[0]) + 1; }
        else x += 3;
    }
}

int stage_bubble(stage_t *s, const char *t, int x, int y)
{
    int w = stage_text_width(t) + 6, h = 11;
    uint8_t H = stage_key('H');
    for (int yy = 0; yy < h; yy++)
        for (int xx = 0; xx < w; xx++)
            if (!((xx == 0 || xx == w - 1) && (yy == 0 || yy == h - 1))) stage_set(s, x + xx, y + yy, H);
    stage_set(s, x + 1, y + h, H); stage_set(s, x + 2, y + h, H); stage_set(s, x, y + h + 1, H); stage_set(s, x - 1, y + h + 2, H);
    stage_text(s, t, x + 3, y + 3, 'h');
    return w;
}

/* ---------------------------------------------------------------- Biscuit */
#define PG (PET_CROP_W * PET_CROP_H)
static uint8_t pose_tmp[PG];

void stage_pose_cells(pet_pose_id_t pose, uint8_t *grid, bool dressed)
{
    memset(grid, 0, PG);
    const pet_pose_t *ps = pet_pose_of(pose);
    led_blit(grid, PET_CROP_W, PET_CROP_H, ps->body, 0, 0);
    if (!dressed) return;
    int o[3];
    pet_get_outfit(&o[0], &o[1], &o[2]);
    static const int LAYER[3] = { 2, 1, 0 }; /* neck, then face, then head */
    for (int k = 0; k < 3; k++) {
        int acc = o[LAYER[k]];
        if (acc >= 0 && acc < PET_ACC_COUNT && pet_acc_slot[acc] == LAYER[k])
            led_blit(grid, PET_CROP_W, PET_CROP_H, ps->acc[acc], 0, 0);
    }
}

/* A cell of the pet, in the child's chosen colour (pet_apply_colour, one cell at a time). */
static void put_body(stage_t *s, int x, int y, uint8_t c, int clip_below)
{
    if (clip_below >= 0 && y >= clip_below) return;
    x += ST_OX;
    y += ST_OY;
    if (x < 0 || y < 0 || x >= ST_W || y >= ST_H) return;
    pet_apply_colour(&c, 1);
    s->body[y * ST_W + x] = c;
}

/* pix.ts squash: nearest-neighbour squash and stretch, anchored at the feet. */
static void draw_grid(stage_t *s, const uint8_t *g, int px, int py, float sx, float sy, int clip_below)
{
    int x0 = 1 << 20, x1 = -(1 << 20), y0 = 1 << 20, y1 = -(1 << 20);
    for (int y = 0; y < PET_CROP_H; y++)
        for (int x = 0; x < PET_CROP_W; x++)
            if (g[y * PET_CROP_W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < x0) return;
    const int O = PET_POSE_O;
    if ((sx == 1.0f && sy == 1.0f) || sx <= 0 || sy <= 0) {
        for (int y = y0; y <= y1; y++)
            for (int x = x0; x <= x1; x++) {
                uint8_t c = g[y * PET_CROP_W + x];
                if (c) put_body(s, px + x - O, py + y - O, c, clip_below);
            }
        return;
    }
    float ax = (x0 + x1 + 1) / 2.0f, ay = y1 + 1.0f;
    int X0 = (int)floorf(ax + (x0 - ax) * sx) - 1, X1 = (int)ceilf(ax + (x1 + 1 - ax) * sx) + 1;
    int Y0 = (int)floorf(ay + (y0 - ay) * sy) - 1;
    for (int y = Y0; y <= y1; y++)
        for (int x = X0; x <= X1; x++) {
            int gx = (int)floorf(ax + (x + 0.5f - ax) / sx), gy = (int)floorf(ay + (y + 0.5f - ay) / sy);
            if (gx < 0 || gy < 0 || gx >= PET_CROP_W || gy >= PET_CROP_H) continue;
            uint8_t c = g[gy * PET_CROP_W + gx];
            if (c) put_body(s, px + x - O, py + y - O, c, clip_below);
        }
}

void stage_pose(stage_t *s, const pose_t *p, int clip_below)
{
    stage_pose_cells(p->pose, pose_tmp, true);
    draw_grid(s, pose_tmp, p->x, p->y, p->sx ? p->sx : 1, p->sy ? p->sy : 1, clip_below);
}

void stage_pose_grid(stage_t *s, const uint8_t *grid, int x, int y) { draw_grid(s, grid, x, y, 1, 1, -1); }

led_rect_t stage_render(const stage_t *s, uint16_t *buf, led_cache_t *cache)
{
    led_args_t a = {
        .buf = buf, .d = STAGE_D, .pitch = STAGE_D / 116.0f,
        .room = s->room, .body = s->body, .fx = NULL, .walls = s->walls, .gw = ST_W, .gh = ST_H,
        .cx = LW / 2 + ST_OX, .cy = LH / 2 + ST_OY, .dim = 0, .bg = 0x040605, .sparkles = -1, .solid = true,
        .cache = cache,
    };
    return led_render(&a);
}

/* ---------------------------------------------------------------- particles */
static const char *const STAR_BIG[] = { "..Y..", "..Y..", "YYFYY", "..Y..", "..Y.." };
static const char *const STAR_SMALL[] = { ".Y.", "YFY", ".Y." };
static const char *const RING0[] = { "f" };
static const char *const RING1[] = { "ff", "ff" };
static const char *const RING2[] = { ".f.", "f.f", ".f." };
static const char *const RING3[] = { ".ff.", "fF.f", "f..f", ".ff." };

void parts_add(parts_t *ps, part_kind_t kind, float x, float y, float vx, float vy, float g, float life, char c, const char *str)
{
    if (ps->n >= MAX_PARTS) return;
    part_t *p = &ps->p[ps->n++];
    memset(p, 0, sizeof *p);
    p->kind = kind; p->x = x; p->y = y; p->vx = vx; p->vy = vy; p->g = g; p->life = life; p->c = c;
    if (str) { strncpy(p->s, str, sizeof p->s - 1); }
}

void parts_burst(parts_t *ps, float x, float y, int n)
{
    for (int i = 0; i < n; i++) {
        float a = 3.14159265f * (0.1f + 0.8f * i / (n > 1 ? n - 1 : 1));
        parts_add(ps, PT_STAR, x, y, cosf(a) * 26, -sinf(a) * 30, 40, 900, 0, NULL);
    }
}

void parts_step(parts_t *ps, float dt)
{
    int k = 0;
    for (int i = 0; i < ps->n; i++) {
        part_t *p = &ps->p[i];
        p->t += dt;
        p->vy += p->g * dt / 1000;
        p->x += p->vx * dt / 1000;
        p->y += p->vy * dt / 1000;
        if (p->t < p->life) ps->p[k++] = *p;
    }
    ps->n = k;
}

void parts_draw(const parts_t *ps, stage_t *s)
{
    for (int i = 0; i < ps->n; i++) {
        const part_t *p = &ps->p[i];
        int x = (int)lroundf(p->x), y = (int)lroundf(p->y);
        float a = p->t / p->life;
        switch (p->kind) {
        case PT_STAR:
            if (a < 0.7f) {
                if (((int)(p->t / 120)) % 2) stage_stamp(s, STAR_SMALL, 3, x - 2, y - 2, 0);
                else stage_stamp(s, STAR_BIG, 5, x - 2, y - 2, 0);
            } else if (((int)(p->t / 80)) % 2) stage_set(s, x, y, stage_key('Y'));
            break;
        case PT_BUBBLE: {
            int r = (int)(a * 4);
            if (r > 3) r = 3;
            const char *const *rows[] = { RING0, RING1, RING2, RING3 };
            stage_stamp(s, rows[r], r + 1, x, y, 0);
            break;
        }
        case PT_SPLASH: stage_set(s, x - 1, y, stage_key('f')); stage_set(s, x + 1, y - 1, stage_key('f')); break;
        case PT_CRUMB: stage_set(s, x, y, stage_key(p->c ? p->c : 'O')); break;
        case PT_TEXT: stage_text(s, p->s, x, y, p->c ? p->c : 'H'); break;
        }
    }
}

/* ---------------------------------------------------------------- the actor */
#define FRAME_MS (1000.0f / 12)

void act_add(actor_t *a, int count, pet_pose_id_t pose, float sx, float sy, int x, int y)
{
    for (int i = 0; i < count && a->n < (int)(sizeof a->f / sizeof a->f[0]); i++) {
        act_frame_t *f = &a->f[a->n++];
        memset(f, 0, sizeof *f);
        f->pose = (pose_t){ pose, sx, sy, x, y };
    }
}

void act_burst(actor_t *a, int bx, int by, int n)
{
    if (!a->n) return;
    act_frame_t *f = &a->f[a->n - 1];
    f->flags |= ACT_BURST;
    f->bx = (int8_t)bx; f->by = (int8_t)by; f->bn = (int8_t)n;
}

void actor_play(actor_t *a, void (*done)(void *), void *ctx)
{
    a->t = 0;
    a->last = -1;
    a->done = done;
    a->ctx = ctx;
}

void actor_stop(actor_t *a) { a->n = 0; }
bool actor_busy(const actor_t *a) { return a->n > 0; }
void actor_step(actor_t *a, float dt) { if (a->n) a->t += dt; }

const pose_t *actor_pose(actor_t *a, parts_t *ps)
{
    if (!a->n) return NULL;
    int i = (int)(a->t / FRAME_MS);
    if (i >= a->n) {
        a->n = 0;
        if (a->done) a->done(a->ctx);
        return NULL;
    }
    a->fresh = i != a->last;
    a->last = i;
    act_frame_t *f = &a->f[i];
    if (a->fresh && (f->flags & ACT_BURST) && ps) parts_burst(ps, f->bx, f->by, f->bn);
    return &f->pose;
}

void act_turn_to_you(actor_t *a, int sx, bool mirror)
{
    int fx0 = front_x_for(sx, mirror);
    act_add(a, 3, mirror ? PET_POSE_S_PERK_M : PET_POSE_S_PERK, 1, 1, sx, SY);
    act_add(a, 1, mirror ? PET_POSE_S_REST_M : PET_POSE_S_REST, 1.08f, 0.9f, sx, SY);
    act_add(a, 2, PET_POSE_F_REST, 0.96f, 1.05f, fx0, SY - 3);
    act_add(a, 1, PET_POSE_F_REST, 1.08f, 0.9f, fx0, SY);
}

void act_cheer(actor_t *a, int fx0)
{
    static const int8_t UP3[3] = { 6, 7, 6 };
    act_add(a, 2, PET_POSE_F_SMILE, 1.1f, 0.86f, fx0, SY);
    act_add(a, 1, PET_POSE_F_T_YAY, 0.94f, 1.08f, fx0, SY - 3);
    act_burst(a, fx0 + 11, SY + 8, 7);
    for (int i = 0; i < 3; i++) act_add(a, 1, PET_POSE_F_T_YAY, 1, 1, fx0, SY - UP3[i]);
    act_add(a, 1, PET_POSE_F_T_YAY, 1, 1, fx0, SY - 3);
    act_add(a, 2, PET_POSE_F_T_YAY, 1.1f, 0.88f, fx0, SY);
    act_add(a, 1, PET_POSE_F_T_YAY, 0.94f, 1.08f, fx0, SY - 3);
    act_burst(a, fx0 + 11, SY + 8, 5);
    act_add(a, 2, PET_POSE_F_T_YAY, 1, 1, fx0, SY - 5);
    act_add(a, 1, PET_POSE_F_T_YAY, 1, 1, fx0, SY - 2);
    act_add(a, 2, PET_POSE_F_T_YAY, 1.1f, 0.88f, fx0, SY);
}
