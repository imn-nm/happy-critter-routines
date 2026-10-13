#include "games.h"
#include "../pet/pet.h"
#include "../hal.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define N(a) ((int)(sizeof(a) / sizeof((a)[0])))

static game_id_t cur;
static char nick[24] = "Biscuit";
static float now;
static parts_t parts;
static actor_t actor;

/* ================================================================ Peekaboo */
#define BUSH_W 22
#define BUSH_H 15
#define BUSH_TOP (FLOOR - 15)
#define PEEK_Y (BUSH_TOP - 4)
static const int SPOTS[3] = { 4, 37, 70 };
static char bush[BUSH_H][BUSH_W + 1];
static const char *const HEART[] = { ".PP.PP.", "PPPPPPP", "PFPPPPP", ".PPPPP.", "..PPP..", "...P..." };
static const char *const FLY_OPEN[] = { "YY.YY", "YYkYY", ".y.y." };
static const char *const FLY_SHUT[] = { "..Y..", ".YkY.", "..y.." };

enum { PK_HIDDEN, PK_FOUND, PK_SHUFFLE };
static struct {
    int state, spot, found;
    float t, rustle[3], say_t, say_at;
    struct { float x, y, t; } flies[6];
    int nflies;
} pk;

static void make_bush(void)
{
    static const float BLOBS[3][3] = { { 6, 8, 6 }, { 11, 6, 6.5f }, { 16, 8, 6 } };
    for (int y = 0; y < BUSH_H; y++) {
        for (int x = 0; x < BUSH_W; x++) {
            bool in = false;
            for (int b = 0; b < 3; b++) {
                float dx = x + 0.5f - BLOBS[b][0], dy = y + 0.5f - BLOBS[b][1];
                if (dx * dx + dy * dy <= BLOBS[b][2] * BLOBS[b][2]) in = true;
            }
            if (!in && !(y >= 8 && x >= 1 && x <= 20)) bush[y][x] = '.';
            else bush[y][x] = y > 11 || (x * 3 + y * 5) % 7 == 0 ? 'g' : 'G';
        }
        bush[y][BUSH_W] = 0;
    }
    bush[5][5] = 'X'; bush[7][15] = 'X'; bush[10][9] = 'X';
}

static void pk_shuffled(void *ctx) { (void)ctx; pk.state = PK_SHUFFLE; pk.t = 0; }

static void pk_start(void)
{
    memset(&pk, 0, sizeof pk);
    make_bush();
    pk.spot = (int)(frand() * 3) % 3;
}

static void pk_update(float dt)
{
    pk.t += dt;
    for (int i = 0; i < 3; i++) pk.rustle[i] = fmaxf(0, pk.rustle[i] - dt);
    if (pk.say_at > 0 && now >= pk.say_at) { pk.say_t = 1900; pk.say_at = 0; }
    pk.say_t = fmaxf(0, pk.say_t - dt);
    int k = 0;
    for (int i = 0; i < pk.nflies; i++) { pk.flies[i].t += dt; if (pk.flies[i].t < 1600) pk.flies[k++] = pk.flies[i]; }
    pk.nflies = k;
    if (pk.state == PK_SHUFFLE && pk.t > 1000) {
        /* tucked in somewhere new while the leaves were rustling */
        int others[2], n = 0;
        for (int i = 0; i < 3; i++) if (i != pk.spot) others[n++] = i;
        pk.spot = others[(int)(frand() * 2) % 2];
        pk.state = PK_HIDDEN;
        pk.t = 0;
    }
}

static bool pk_peeking(void) { return pk.state == PK_HIDDEN && pk.t > 2500 && fmodf(pk.t - 2500, 3200) < 700; }

static void pk_tap(float x, float y)
{
    if (pk.state != PK_HIDDEN || y < BUSH_TOP - 14) return;
    int i = -1;
    for (int k = 0; k < 3; k++) if (x >= SPOTS[k] - 2 && x <= SPOTS[k] + BUSH_W + 2) i = k;
    if (i < 0) return;
    if (i != pk.spot) {
        /* not here: the bush rustles and a butterfly flutters out */
        pk.rustle[i] = 450;
        if (pk.nflies < N(pk.flies)) pk.flies[pk.nflies++] = (__typeof__(pk.flies[0])){ (float)SPOTS[i] + 9, BUSH_TOP + 2, 0 };
        return;
    }
    pk.state = PK_FOUND;
    pk.found++;
    hal_play(HAL_SOUND_DONE);
    int x0 = SPOTS[pk.spot];
    actor.n = 0;
    act_add(&actor, 1, PET_POSE_F_HAPPY_YAY_BLUSH, 1, 1, x0, PEEK_Y - 6);
    act_add(&actor, 1, PET_POSE_F_HAPPY_YAY_BLUSH, 1, 1, x0, PEEK_Y - 14);
    act_add(&actor, 1, PET_POSE_F_T_YAY, 1, 1, x0, SY - 5);
    act_burst(&actor, x0 + 11, SY + 6, 7);
    act_add(&actor, 2, PET_POSE_F_T_YAY, 1, 1, x0, SY - 6);
    act_add(&actor, 1, PET_POSE_F_T_YAY, 1, 1, x0, SY - 3);
    for (int k = 0; k < 16; k++) act_add(&actor, 1, k % 8 < 5 ? PET_POSE_F_HAPPY_SMILE_BLUSH : PET_POSE_F_SMILE_BLUSH, 1, 1, x0, SY);
    act_add(&actor, 1, PET_POSE_F_HAPPY_SMILE, 1, 1, x0, SY + 8);
    act_add(&actor, 1, PET_POSE_F_HAPPY, 1, 1, x0, PEEK_Y);
    actor_play(&actor, pk_shuffled, NULL);
    pk.say_at = now + 170;
}

static void pk_draw(stage_t *s)
{
    stage_clear(s, PET_GAME_GARDEN);
    const pose_t *a = actor_pose(&actor, &parts);
    pose_t p;
    if (a) p = *a;
    else if (pk_peeking()) {
        int wiggle = ((int)(pk.t / 140)) % 2;
        p = (pose_t){ blinking(now, 3600, 0) ? PET_POSE_F_BLINK : PET_POSE_F_REST, 1, 1, SPOTS[pk.spot] + wiggle, PEEK_Y };
    } else p.pose = PET_POSE_COUNT;
    if (p.pose != PET_POSE_COUNT) stage_pose(s, &p, FLOOR); /* behind the bushes */
    const char *rows[BUSH_H];
    for (int y = 0; y < BUSH_H; y++) rows[y] = bush[y];
    for (int i = 0; i < 3; i++) {
        bool shaking = pk.rustle[i] > 0 || pk.state == PK_SHUFFLE;
        int dx = shaking ? (((int)(now / 70) + i) % 2 ? 1 : -1) : 0;
        stage_stamp(s, rows, BUSH_H, SPOTS[i] + dx, BUSH_TOP, 0);
        /* the bush hides him: clear his cells under the leaves */
        for (int y = 0; y < BUSH_H; y++)
            for (int x = 0; x < BUSH_W; x++)
                if (bush[y][x] != '.') {
                    int gx = SPOTS[i] + dx + x + ST_OX, gy = BUSH_TOP + y + ST_OY;
                    if (gx >= 0 && gx < ST_W && gy >= 0 && gy < ST_H) s->body[gy * ST_W + gx] = 0;
                }
    }
    for (int i = 0; i < pk.nflies; i++) {
        float k = pk.flies[i].t / 1600;
        int fx = (int)lroundf(pk.flies[i].x + 30 * k + 3 * sinf(pk.flies[i].t / 120)), fy = (int)lroundf(pk.flies[i].y - 40 * k);
        stage_stamp(s, ((int)(pk.flies[i].t / 90)) % 2 == 0 ? FLY_OPEN : FLY_SHUT, 3, fx, fy, 0);
    }
    parts_draw(&parts, s);
    if (pk.say_t > 0) {
        int x0 = SPOTS[pk.spot] + 23;
        if (x0 > LW - 26) x0 = LW - 26;
        int w = stage_text_width("BOO!");
        stage_bubble(s, "BOO!", x0 < LW - w - 8 ? x0 : LW - w - 8, 2);
    }
    stage_stamp(s, HEART, N(HEART), 3, 2, 0);
    char n[8];
    snprintf(n, sizeof n, "%d", pk.found);
    stage_text(s, n, 12, 3, 'H');
}

/* ================================================================ Bubble pop */
#define RX 64
#define WAND_X (RX - 5)
#define WAND_Y (SY + 20)
#define CHEER_EVERY 10
static const char COLOURS[4] = { 'f', 'R', 'Z', 'B' };
static const char *const BUBBLE_ICON[] = { ".ffff.", "fF...f", "fF...f", "f....f", "f....f", ".ffff." };

static struct {
    struct { float x, y, vx, vy, r, size, age, sway; char c; bool gold; } b[9];
    int nb, popped;
    float spawn_t, blow_t, happy_t;
} bp;

static void bp_start(void) { memset(&bp, 0, sizeof bp); bp.spawn_t = 300; }

static void bp_update(float dt)
{
    bp.blow_t = fmaxf(0, bp.blow_t - dt);
    bp.happy_t = fmaxf(0, bp.happy_t - dt);
    bp.spawn_t -= dt;
    if (bp.spawn_t <= 0 && !actor_busy(&actor) && bp.nb < N(bp.b)) {
        bp.spawn_t = 650 + frand() * 450;
        bp.blow_t = 320;
        __typeof__(bp.b[0]) *b = &bp.b[bp.nb++];
        memset(b, 0, sizeof *b);
        b->x = WAND_X; b->y = WAND_Y;
        b->vx = -4 - frand() * 16; b->vy = -5 - frand() * 7;
        b->size = 3 + frand() * 4; b->sway = frand() * 6;
        b->c = COLOURS[(int)(frand() * 4) % 4];
        b->gold = frand() < 0.1f;
    }
    int k = 0;
    for (int i = 0; i < bp.nb; i++) {
        __typeof__(bp.b[0]) *b = &bp.b[i];
        b->age += dt;
        b->r = fminf(b->size, b->age / 600 * b->size);
        b->x += b->vx * dt / 1000 + sinf(b->age / 380 + b->sway) * 0.05f;
        b->y += b->vy * dt / 1000;
        /* ones that float away just drift off; nothing is ever missed */
        if (b->y > -8 && b->x > -8 && b->age < 12000) bp.b[k++] = *b;
    }
    bp.nb = k;
}

static void bp_tap(float x, float y)
{
    int best = -1;
    float best_d = 1e9f;
    for (int i = 0; i < bp.nb; i++) {
        float d = hypotf(bp.b[i].x - x, bp.b[i].y - y);
        if (d <= bp.b[i].r + 4 && d < best_d) { best = i; best_d = d; }
    }
    if (best < 0) { parts_add(&parts, PT_SPLASH, x, y, 0, 0, 0, 200, 0, NULL); return; }
    __typeof__(bp.b[0]) b = bp.b[best];
    bp.b[best] = bp.b[--bp.nb];
    bp.popped++;
    bp.happy_t = 500;
    hal_play(HAL_SOUND_TICK);
    for (int i = 0; i < 6; i++) {
        float a = i / 6.0f * 6.2831853f;
        parts_add(&parts, PT_CRUMB, b.x, b.y, cosf(a) * 22, sinf(a) * 22, 0, 320, b.gold ? 'Y' : b.c, NULL);
    }
    if (b.gold) parts_burst(&parts, b.x, b.y, 5);
    if (bp.popped % CHEER_EVERY == 0) {
        actor.n = 0;
        act_turn_to_you(&actor, RX, false);
        act_cheer(&actor, front_x_for(RX, false));
        actor_play(&actor, NULL, NULL);
        hal_play(HAL_SOUND_DONE);
    }
}

static void bp_draw(stage_t *s)
{
    stage_clear(s, PET_GAME_GARDEN);
    const pose_t *a = actor_pose(&actor, &parts);
    pose_t p;
    if (a) p = *a;
    else {
        bool happy = bp.happy_t > 0, blow = bp.blow_t > 0;
        p = (pose_t){ blow ? PET_POSE_S_WAND_BLOW : happy ? PET_POSE_S_WAND_HAPPY
                      : blinking(now, 3600, 0) ? PET_POSE_S_WAND_BLINK : PET_POSE_S_WAND_UP, 1, 1, RX, SY };
    }
    stage_pose(s, &p, -1);
    for (int i = 0; i < bp.nb; i++) {
        const __typeof__(bp.b[0]) *b = &bp.b[i];
        int cx = (int)lroundf(b->x), cy = (int)lroundf(b->y);
        char c = b->gold ? 'Y' : b->c;
        if (b->r < 1) { stage_set(s, cx, cy, stage_key(c)); continue; }
        int steps = (int)fmaxf(8, lroundf(b->r * 8));
        for (int k = 0; k < steps; k++) {
            float an = k / (float)steps * 6.2831853f;
            stage_set(s, (int)lroundf(cx + cosf(an) * b->r), (int)lroundf(cy + sinf(an) * b->r), stage_key(c));
        }
        if (b->r >= 2) {
            int h = (int)lroundf(b->r / 2);
            stage_set(s, cx - h, cy - h, stage_key('F'));
            if (b->r >= 4) stage_set(s, cx - h + 1, cy - h, stage_key('F'));
        }
    }
    parts_draw(&parts, s);
    stage_stamp(s, BUBBLE_ICON, N(BUBBLE_ICON), 3, 2, 0);
    char n[8];
    snprintf(n, sizeof n, "%d", bp.popped);
    stage_text(s, n, 11, 3, 'H');
}

/* ================================================================ Carrot catch */
#define ROUND_MS 30000.0f
static const char *const CARROT[] = { "G.g.G", ".GgG.", ".OOO.", ".OOo.", ".OOo.", "..Oo.", "..O.." };
static const char *const GOLD[] = { "G.g.G", ".GgG.", ".YYY.", ".YYy.", ".YYy.", "..Yy.", "..Y.." };
static const char *const HUD_CARROT[] = { ".G.", "GgG", ".O.", "OOo", "OO.", ".O." };

enum { CC_READY, CC_PLAYING, CC_END };
static struct {
    int state, score, best;
    float time, spawn_t, x, hop, munch;
    int dir;
    bool has_target, moving, record;
    float target;
    int end_fx0;
    struct { float x, y, vy, t; bool gold; int st; } c[16];   /* st: 0 fall, 1 bounce */
    int nc;
    char label[16];
} cc;

static void cc_start(void)
{
    memset(&cc, 0, sizeof cc);
    cc.x = 34;
    cc.dir = -1;
    cc.time = ROUND_MS;
    char buf[12];
    if (hal_store_get("carrot-best", buf, sizeof buf)) cc.best = atoi(buf);
}

void carrot_play(void)
{
    if (cur != GAME_CARROT || cc.state == CC_PLAYING) return;
    int best = cc.best;
    cc_start();
    cc.best = best;
    cc.state = CC_PLAYING;
    cc.spawn_t = 400;
    actor.n = 0;
    parts.n = 0;
    hal_play(HAL_SOUND_START);
}

static void cc_finish(void)
{
    cc.state = CC_END;
    cc.moving = false;
    cc.has_target = false;
    cc.nc = 0;
    snprintf(cc.label, sizeof cc.label, "YUM! %d", cc.score);
    bool mirror = cc.dir > 0;
    cc.end_fx0 = front_x_for((int)lroundf(cc.x), mirror);
    actor.n = 0;
    act_turn_to_you(&actor, (int)lroundf(cc.x), mirror);
    act_cheer(&actor, cc.end_fx0);
    actor_play(&actor, NULL, NULL);
    hal_play(HAL_SOUND_DONE);
    if (cc.score > cc.best) {
        cc.best = cc.score;
        cc.record = true;
        char buf[12];
        snprintf(buf, sizeof buf, "%d", cc.best);
        hal_store_set("carrot-best", buf);
    }
}

static void cc_update(float dt)
{
    cc.munch = fmaxf(0, cc.munch - dt);
    if (cc.state != CC_PLAYING) return;
    cc.time -= dt;
    if (cc.time <= 0) { cc.time = 0; cc_finish(); return; }
    float elapsed = ROUND_MS - cc.time;
    cc.spawn_t -= dt;
    if (cc.spawn_t <= 0 && cc.nc < N(cc.c)) {
        cc.spawn_t = 900 - 350 * (elapsed / ROUND_MS);
        __typeof__(cc.c[0]) *c = &cc.c[cc.nc++];
        c->x = 6 + frand() * (LW - 12);
        c->y = -8;
        c->vy = 16 + 12 * (elapsed / ROUND_MS);
        c->gold = frand() < 0.12f;
        c->st = 0;
        c->t = 0;
    }
    /* follow the finger */
    int v = 0;
    if (cc.has_target) {
        float d = cc.target - cc.x;
        if (fabsf(d) > 0.6f) v = d > 0 ? 1 : -1;
        else cc.has_target = false;
    }
    if (v) {
        cc.dir = v;
        float step = 46 * dt / 1000, move = cc.has_target ? fminf(step, fabsf(cc.target - cc.x)) : step;
        cc.x = fmaxf(-2, fminf(LW - 27, cc.x + v * move));
        cc.hop += dt;
        cc.moving = true;
    } else cc.moving = false;
    float hx0 = cc.x + (cc.dir < 0 ? 0 : 6), hy0 = SY + 10;
    int k = 0;
    for (int i = 0; i < cc.nc; i++) {
        __typeof__(cc.c[0]) *c = &cc.c[i];
        c->t += dt;
        bool gone = false;
        if (c->st == 0) {
            c->y += c->vy * dt / 1000;
            float tx = c->x, ty = c->y + 6;
            if (tx >= hx0 - 1 && tx <= hx0 + 23 && ty >= hy0 && ty <= hy0 + 16) {
                gone = true;
                int n = c->gold ? 3 : 1;
                cc.score += n;
                cc.munch = 520;
                char t[6];
                snprintf(t, sizeof t, "+%d", n);
                parts_add(&parts, PT_TEXT, tx - 3, hy0 - 6, 0, -14, 0, 800, c->gold ? 'Y' : 'H', t);
                for (int j = 0; j < 3; j++)
                    parts_add(&parts, PT_CRUMB, cc.x + (cc.dir < 0 ? 6 : 22), SY + 24, (frand() - 0.5f) * 18, -8, 90, 500, c->gold ? 'Y' : 'O', NULL);
                if (c->gold) parts_burst(&parts, tx, hy0, 4);
                hal_play(HAL_SOUND_TICK);
            } else if (c->y + 7 >= FLOOR) {
                /* a missed carrot just bounces away */
                c->st = 1;
                c->vy = -22;
                c->t = 0;
                c->y = FLOOR - 7;
            }
        } else {
            c->vy += 80 * dt / 1000;
            c->y = fminf(FLOOR - 7, c->y + c->vy * dt / 1000);
            if (c->t > 900) gone = true;
        }
        if (!gone) cc.c[k++] = *c;
    }
    cc.nc = k;
}

static void cc_press(float x, float y)
{
    (void)y;
    if (cc.state != CC_PLAYING) return;
    cc.target = fmaxf(-2, fminf(LW - 27, x - 13));
    cc.has_target = true;
}

static void cc_draw(stage_t *s)
{
    stage_clear(s, PET_GAME_GARDEN);
    for (int i = 0; i < cc.nc; i++) {
        const __typeof__(cc.c[0]) *c = &cc.c[i];
        if (c->st == 1 && c->t > 500 && ((int)(c->t / 90)) % 2) continue;
        stage_stamp(s, c->gold ? GOLD : CARROT, N(CARROT), (int)lroundf(c->x) - 2, (int)lroundf(c->y), 0);
        if (c->gold && ((int)(now / 150)) % 2) stage_set(s, (int)lroundf(c->x) + 3, (int)lroundf(c->y) + 1, stage_key('F'));
    }
    const pose_t *a = actor_pose(&actor, &parts);
    pose_t p;
    bool mirror = cc.dir > 0;
    int x = (int)lroundf(cc.x);
    if (a) p = *a;
    else if (cc.state == CC_END) p = (pose_t){ blinking(now, 2800, 0) ? PET_POSE_F_T_BLINK_YAY : PET_POSE_F_T_YAY, 1, 1, cc.end_fx0, SY };
    else if (cc.munch > 0) {
        bool m = ((int)(cc.munch / 100)) % 2;
        p = (pose_t){ m ? (mirror ? PET_POSE_S_MUNCH_O_M : PET_POSE_S_MUNCH_O) : (mirror ? PET_POSE_S_MUNCH_CHEEK_M : PET_POSE_S_MUNCH_CHEEK), 1, 1, x, SY };
    } else if (cc.moving) {
        static const int8_t HOP[6] = { 0, -1, -2, -2, -1, 0 };
        int ph = ((int)(cc.hop / 70)) % 6;
        p = (pose_t){ mirror ? PET_POSE_S_REST_M : PET_POSE_S_REST, ph == 0 ? 1.04f : 1, ph == 0 ? 0.95f : 1, x, SY + HOP[ph] };
    } else {
        bool b = blinking(now, 3600, 0);
        p = (pose_t){ b ? (mirror ? PET_POSE_S_BLINK_M : PET_POSE_S_BLINK) : (mirror ? PET_POSE_S_REST_M : PET_POSE_S_REST), 1, 1, x, SY };
    }
    stage_pose(s, &p, -1);
    parts_draw(&parts, s);
    stage_stamp(s, HUD_CARROT, N(HUD_CARROT), 3, 2, 0);
    char n[12];
    snprintf(n, sizeof n, "%d", cc.score);
    stage_text(s, n, 8, 3, 'H');
    if (cc.state != CC_END) {
        int secs = (int)ceilf(cc.time / 1000);
        char clock[8];
        snprintf(clock, sizeof clock, "0:%02d", secs);
        bool flash = secs <= 5 && cc.state == CC_PLAYING && ((int)(now / 250)) % 2;
        stage_text(s, clock, LW - stage_text_width(clock) - 3, 3, flash ? 'Y' : 'H');
    }
    if (cc.state == CC_READY) stage_bubble(s, "TAP TO PLAY!", 48, 8);
    if (cc.state == CC_END && !actor_busy(&actor)) {
        int w = stage_text_width(cc.label) + 6;
        int bx = cc.end_fx0 + 24;
        if (bx > LW - w - 8) bx = LW - w - 8;
        stage_bubble(s, cc.label, bx, 2);
    }
}

/* ================================================================ Bath time */
#define BX 37
#define BY 13
static const int8_t MUD[][2] = {
    { 5, 6 }, { 6, 6 }, { 6, 7 }, { 17, 3 }, { 18, 3 }, { 18, 4 }, { 8, 13 }, { 9, 13 }, { 9, 14 }, { 18, 22 }, { 19, 22 }, { 19, 23 },
    { 2, 22 }, { 3, 22 }, { 7, 28 }, { 8, 28 }, { 8, 29 }, { 13, 27 }, { 14, 27 },
};
static const char *const DUCK[] = { ".YYY...", "YYkYOO.", ".YYY...", "YYYYYYY", "YYYYYYy", ".yyyyy." };
static const char *const SPONGE[] = { "YYYYYYY", "YyYYYyY", "YYYyYYY", "yYYYYYy" };
static const char *const SHOWER[] = { "..LL..", "..LL..", ".LLLL.", "LLLLLL", "fLfLfL" };
static const char *const TOWEL[] = { "RRRRRRR", "RFRRRRR", "RRRRRRR", "PPPPPPP", "RRRRRRR" };

enum { BT_SCRUB, BT_RINSE, BT_DRY, BT_DONE };
#define PGW PET_CROP_W
#define PGH PET_CROP_H
enum { F_VIS = 1, F_MUD = 2, F_SOAP = 4, F_WET = 8 };
static struct {
    int phase, nvis, nsoap, nwet, nmud, soap_start;
    float busy, drop_t, done_t, px, py;
    bool has_p, down;
    struct { float x, y; } drops[64];
    int nd;
} bt;
static uint8_t bt_flag[PGW * PGH];
static uint8_t bt_grid[PGW * PGH];

static int gidx(int lx, int ly) { return (ly + PET_POSE_O) * PGW + lx + PET_POSE_O; }

static void bt_start(void)
{
    memset(&bt, 0, sizeof bt);
    memset(bt_flag, 0, sizeof bt_flag);
    /* the fur that shows above the water: the front pose, rows 0..30 */
    stage_pose_cells(PET_POSE_F_REST, bt_grid, false);
    for (int k = 0; k < PGW * PGH; k++) {
        int ly = k / PGW - PET_POSE_O;
        if (bt_grid[k] && ly <= 30) { bt_flag[k] |= F_VIS; bt.nvis++; }
    }
    for (int i = 0; i < N(MUD); i++) {
        int k = gidx(MUD[i][0], MUD[i][1]);
        if (bt_flag[k] & F_VIS) { bt_flag[k] |= F_MUD; bt.nmud++; }
    }
    bt.soap_start = 1;
}

static float bt_progress(void)
{
    switch (bt.phase) {
    case BT_SCRUB: return fminf(1, bt.nsoap / (float)bt.nvis / 0.7f) * (bt.nmud ? 0.95f : 1);
    case BT_RINSE: return 1 - bt.nsoap / (float)(bt.soap_start > 0 ? bt.soap_start : 1);
    case BT_DRY: return 1 - bt.nwet / (float)bt.nvis;
    default: return 1;
    }
}

typedef void (*bt_fn)(int k, bool *hit);
static void around(float x, float y, float r, int mode, bool *hit)
{
    float cx = x - BX, cy = y - BY;
    for (int yy = (int)floorf(cy - r); yy <= cy + r; yy++)
        for (int xx = (int)floorf(cx - r); xx <= cx + r; xx++) {
            float dx = xx + 0.5f - cx, dy = yy + 0.5f - cy;
            if (dx * dx + dy * dy > r * r) continue;
            if (xx + PET_POSE_O < 0 || yy + PET_POSE_O < 0 || xx + PET_POSE_O >= PGW || yy + PET_POSE_O >= PGH) continue;
            int k = gidx(xx, yy);
            uint8_t *f = &bt_flag[k];
            if (!(*f & F_VIS)) continue;
            if (mode == 0) {          /* scrub: soap on, mud off */
                if (!(*f & F_SOAP)) { *f |= F_SOAP; bt.nsoap++; *hit = true; }
                if (*f & F_MUD) { *f &= (uint8_t)~F_MUD; bt.nmud--; }
            } else if (mode == 1) {   /* rinse: soap off, wet on */
                if (*f & F_SOAP) { *f &= (uint8_t)~F_SOAP; bt.nsoap--; *hit = true; }
                if (!(*f & F_WET)) { *f |= F_WET; bt.nwet++; }
            } else {                  /* dry */
                if (*f & F_WET) { *f &= (uint8_t)~F_WET; bt.nwet--; *hit = true; }
            }
        }
}

static void bt_finish(void)
{
    bt.phase = BT_DONE;
    for (int k = 0; k < PGW * PGH; k++) bt_flag[k] &= (uint8_t)~F_WET;
    bt.nwet = 0;
    bt.down = false;
    bt.done_t = 0;
    actor.n = 0;
    act_add(&actor, 2, PET_POSE_F_BLINK_SMILE, 1.1f, 1.08f, BX, BY);
    for (int i = 0; i < 6; i++) act_add(&actor, 1, PET_POSE_F_BLINK_SMILE, 1, 1, BX + (i % 2 ? 1 : -1), BY);
    act_add(&actor, 2, PET_POSE_F_HAPPY_YAY_BLUSH, 1, 1, BX, BY);
    act_burst(&actor, BX + 10, BY + 6, 7);
    actor_play(&actor, NULL, NULL);
    hal_play(HAL_SOUND_DONE);
}

static void bt_move(float x, float y)
{
    bt.px = x;
    bt.py = y;
    bt.has_p = true;
    if (!bt.down) return;
    bool hit = false;
    if (bt.phase == BT_SCRUB) {
        around(x, y, 2.7f, 0, &hit);
        if (hit) {
            bt.busy = 350;
            if (frand() < 0.25f) parts_add(&parts, PT_BUBBLE, x + frand() * 6 - 3, y, frand() * 6 - 3, -14, 0, 1300, 0, NULL);
        }
        if (bt.nsoap >= bt.nvis * 0.7f && bt.nmud == 0) {
            bt.phase = BT_RINSE;
            bt.soap_start = bt.nsoap;
            bt.down = false;
            hal_play(HAL_SOUND_TICK);
        }
    } else if (bt.phase == BT_DRY) {
        around(x, y, 3, 2, &hit);
        if (hit) bt.busy = 350;
        if (bt.nwet <= bt.nvis * 0.03f) bt_finish();
    }
}

static void bt_press(float x, float y)
{
    if (bt.phase == BT_DONE) {
        if (!actor_busy(&actor) && x >= BX && x <= BX + 21 && y >= BY && y <= 44) {
            actor.n = 0;
            act_add(&actor, 8, PET_POSE_F_HAPPY_YAY_BLUSH, 1, 1, BX, BY - 1);
            actor_play(&actor, NULL, NULL);
            parts_burst(&parts, BX + 10, BY + 4, 4);
        }
        return;
    }
    bt.down = true;
    bt_move(x, y);
}

static void bt_update(float dt)
{
    bt.busy = fmaxf(0, bt.busy - dt);
    if (bt.phase == BT_DONE) bt.done_t += dt;
    if (bt.phase == BT_RINSE && bt.down && bt.has_p) {
        bt.drop_t -= dt;
        while (bt.drop_t <= 0) {
            bt.drop_t += 26;
            if (bt.nd < N(bt.drops)) { bt.drops[bt.nd].x = bt.px + frand() * 6 - 3; bt.drops[bt.nd].y = bt.py + 3; bt.nd++; }
        }
    }
    int k = 0;
    for (int i = 0; i < bt.nd; i++) {
        bt.drops[i].y += 70 * dt / 1000;
        if (bt.phase == BT_RINSE) {
            bool hit = false;
            around(bt.drops[i].x, bt.drops[i].y, 1.7f, 1, &hit);
            if (hit) bt.busy = 300;
        }
        if (bt.drops[i].y >= 43) { parts_add(&parts, PT_SPLASH, bt.drops[i].x, 42, 0, 0, 0, 160, 0, NULL); continue; }
        bt.drops[k++] = bt.drops[i];
    }
    bt.nd = k;
    if (bt.phase == BT_RINSE && bt.nsoap <= (bt.nvis * 0.03f > 4 ? bt.nvis * 0.03f : 4)) {
        bt.phase = BT_DRY;
        for (int j = 0; j < PGW * PGH; j++) {
            bt_flag[j] &= (uint8_t)~F_SOAP;
            if (bt_flag[j] & F_VIS) bt_flag[j] |= F_WET;
        }
        bt.nsoap = 0;
        bt.nwet = bt.nvis;
        bt.down = false;
        hal_play(HAL_SOUND_TICK);
    }
}

static void bt_tub(stage_t *s, bool foamy)
{
    /* the tub sits in front of him: it hides what's below the waterline */
    for (int y = 42; y < 60; y++)
        for (int x = 22; x < 74; x++) {
            int gx = x + ST_OX, gy = y + ST_OY;
            s->body[gy * ST_W + gx] = 0;
        }
    uint8_t W = pet_color_index(0xffffff), E = pet_color_index(0xeef3f8), D = pet_color_index(0xdfe6ee), C = pet_color_index(0xc9d3de);
    uint8_t LEG = pet_color_index(0xc7a86b), FOAM = pet_color_index(0xbfe6f7), WATER = pet_color_index(0x9fd3ef);
    stage_rect(s, 23, 44, 50, 1, W);
    stage_rect(s, 22, 45, 52, 2, E);
    stage_rect(s, 23, 47, 50, 9, D);
    stage_rect(s, 23, 47, 3, 9, C);
    stage_rect(s, 70, 47, 3, 9, C);
    stage_rect(s, 24, 55, 48, 1, C);
    stage_rect(s, 27, 56, 4, 3, LEG);
    stage_rect(s, 65, 56, 4, 3, LEG);
    for (int x = 24; x < 72; x++) {
        int h = (x * 5 + (int)(now / 260)) % 4;
        if (foamy) {
            stage_set(s, x, 43, h % 2 ? W : FOAM);
            if (h == 0) stage_set(s, x, 42, W);
        } else stage_set(s, x, 43, h == 0 ? FOAM : WATER);
    }
}

static void bt_draw(stage_t *s)
{
    stage_clear(s, PET_GAME_BATH);
    const pose_t *a = actor_pose(&actor, &parts);
    if (a) stage_pose(s, a, -1);
    else {
        bool busy = bt.busy > 0, blink = blinking(now, 3600, 0);
        pet_pose_id_t pose;
        switch (bt.phase) {
        case BT_DONE: pose = blinking(now, 3000, 0) ? PET_POSE_F_BLINK_SMILE : PET_POSE_F_HAPPY_SMILE_BLUSH; break;
        case BT_SCRUB: pose = busy ? PET_POSE_F_HAPPY_YAY : blink ? PET_POSE_F_BLINK_SMILE : PET_POSE_F_SMILE; break;
        case BT_RINSE: pose = busy || blink ? PET_POSE_F_BLINK_SMILE : PET_POSE_F_SMILE; break;
        default: pose = busy ? PET_POSE_F_HAPPY_SMILE : blink ? PET_POSE_F_BLINK_O : PET_POSE_F_O; break;
        }
        stage_pose_cells(pose, bt_grid, false);
        const uint8_t W = stage_key('W'), O = stage_key('O');
        for (int k = 0; k < PGW * PGH; k++) {
            if (!(bt_flag[k] & F_VIS)) continue;
            uint8_t base = bt_grid[k];
            if (base != W && base != O) continue;
            int x = k % PGW, y = k / PGW;
            if (bt_flag[k] & F_MUD) bt_grid[k] = stage_key((x + y) % 2 ? 'u' : 'U');
            else if (bt_flag[k] & F_SOAP) {
                bool edge = false;
                static const int8_t D4[4][2] = { { 1, 0 }, { -1, 0 }, { 0, 1 }, { 0, -1 } };
                for (int d = 0; d < 4; d++) {
                    int n = k + D4[d][1] * PGW + D4[d][0];
                    if ((bt_flag[n] & F_VIS) && !(bt_flag[n] & F_SOAP)) edge = true;
                }
                bt_grid[k] = stage_key(edge || (x * 3 + y * 5) % 11 == 0 ? 'f' : 'F');
            } else if (bt_flag[k] & F_WET) bt_grid[k] = stage_key((x * 5 + y * 3) % 7 == 0 ? 'f' : 'w');
        }
        /* foam puffs out past the silhouette */
        for (int k = 0; k < PGW * PGH; k++) {
            if (!(bt_flag[k] & F_SOAP)) continue;
            int x = k % PGW, y = k / PGW;
            for (int dx = -1; dx <= 1; dx += 2) {
                int nx = x + dx;
                if (nx < 0 || nx >= PGW || bt_grid[y * PGW + nx] || (nx * 3 + y) % 2) continue;
                bt_grid[y * PGW + nx] = stage_key((nx + y) % 3 ? 'F' : 'f');
            }
        }
        int wiggle = bt.phase == BT_SCRUB && busy ? (((int)(now / 110)) % 2 ? 1 : -1) : 0;
        stage_pose_grid(s, bt_grid, BX + wiggle, BY);
    }
    bt_tub(s, bt.phase == BT_SCRUB || bt.phase == BT_RINSE);
    stage_stamp(s, DUCK, N(DUCK), 62, 38 + ((int)(now / 600)) % 2, 0);
    for (int i = 0; i < bt.nd; i++) {
        stage_set(s, (int)lroundf(bt.drops[i].x), (int)lroundf(bt.drops[i].y), stage_key('f'));
        stage_set(s, (int)lroundf(bt.drops[i].x), (int)lroundf(bt.drops[i].y) - 1, stage_key('B'));
    }
    parts_draw(&parts, s);
    if (bt.phase == BT_DONE && bt.done_t < 2600) stage_bubble(s, "SO FLUFFY!", LW - stage_text_width("SO FLUFFY!") - 8, 4);
    if (bt.has_p && bt.phase != BT_DONE) {
        const char *const *tool = bt.phase == BT_SCRUB ? SPONGE : bt.phase == BT_RINSE ? SHOWER : TOWEL;
        int rows = bt.phase == BT_SCRUB ? N(SPONGE) : bt.phase == BT_RINSE ? N(SHOWER) : N(TOWEL);
        int tx = (int)lroundf(bt.px), ty = (int)lroundf(bt.py);
        stage_stamp(s, tool, rows, tx - 3, ty - 2, 0);
        if (bt.phase == BT_RINSE && bt.down)
            for (int i = -2; i <= 2; i += 2) stage_set(s, tx + i, ty + 3 + ((int)(now / 60) + i + 4) % 2, stage_key('f'));
    }
}

/* ================================================================ Dress up */
#define DX 37
static const int SLOT_Y[3] = { 6, 17, 27 }; /* head, face, neck */

static void du_hop(void)
{
    actor.n = 0;
    act_add(&actor, 1, PET_POSE_F_HAPPY, 1.08f, 0.9f, DX, SY);
    act_add(&actor, 2, PET_POSE_F_HAPPY_YAY, 1, 1, DX, SY - 3);
    act_add(&actor, 1, PET_POSE_F_HAPPY_YAY, 1.08f, 0.9f, DX, SY);
    act_add(&actor, 5, PET_POSE_F_HAPPY_SMILE_BLUSH, 1, 1, DX, SY);
    actor_play(&actor, NULL, NULL);
}

static void du_twirl(void)
{
    if (actor_busy(&actor)) return;
    actor.n = 0;
    act_add(&actor, 1, PET_POSE_F_REST, 1.08f, 0.9f, DX, SY);
    act_add(&actor, 2, PET_POSE_S_REST, 1, 1, DX - 2, SY - 2);
    act_add(&actor, 2, PET_POSE_S_HAPPY_M, 1, 1, DX - 5, SY - 3);
    act_add(&actor, 1, PET_POSE_F_HAPPY, 1, 1, DX, SY - 2);
    act_add(&actor, 1, PET_POSE_F_HAPPY, 1.08f, 0.9f, DX, SY);
    act_add(&actor, 6, PET_POSE_F_HAPPY_SMILE_BLUSH, 1, 1, DX, SY);
    actor_play(&actor, NULL, NULL);
}

bool dressup_wear(int acc)
{
    if (acc < 0 || acc >= PET_ACC_COUNT) return false;
    int o[3];
    pet_get_outfit(&o[0], &o[1], &o[2]);
    int slot = pet_acc_slot[acc];
    o[slot] = o[slot] == acc ? -1 : acc;
    pet_set_outfit(o[0], o[1], o[2]);
    du_hop();
    if (o[slot] >= 0) parts_burst(&parts, DX + 10, SY + SLOT_Y[slot], 5);
    hal_play(HAL_SOUND_TICK);
    return true;
}

static void du_draw(stage_t *s)
{
    stage_clear(s, PET_GAME_DEN);
    const pose_t *a = actor_pose(&actor, &parts);
    pose_t p = a ? *a : (pose_t){ blinking(now, 3200, 0) ? PET_POSE_F_BLINK_SMILE : PET_POSE_F_SMILE, 1, 1, DX, SY };
    stage_pose(s, &p, -1);
    parts_draw(&parts, s);
}

static void du_press(float x, float y)
{
    if (x >= DX - 1 && x <= DX + 21 && y >= SY && y <= SY + 40) du_twirl();
}

/* ================================================================ the menu's Biscuit */
void menu_draw(stage_t *s, float t)
{
    stage_clear(s, PET_GAME_DEN);
    /* he faces the child and waves now and then */
    int ph = ((int)(t / 166)) % 24;
    pet_pose_id_t pose = ph < 8 ? ((ph / 2) % 2 ? PET_POSE_F_WAVE_LOW : PET_POSE_F_WAVE)
                       : blinking(t, 3600, 0) ? PET_POSE_F_BLINK_SMILE : PET_POSE_F_HAPPY_SMILE_BLUSH;
    pose_t p = { pose, 1, 1, DX, SY };
    stage_pose(s, &p, -1);
}

/* ================================================================ the host */
void game_start(game_id_t id, const char *pet_name)
{
    cur = id;
    now = 0;
    memset(&parts, 0, sizeof parts);
    memset(&actor, 0, sizeof actor);
    if (pet_name && *pet_name) snprintf(nick, sizeof nick, "%s", pet_name);
    switch (id) {
    case GAME_PEEKABOO: pk_start(); break;
    case GAME_BUBBLES: bp_start(); break;
    case GAME_CARROT: cc_start(); break;
    case GAME_BATH: bt_start(); break;
    default: break;
    }
}

game_id_t game_current(void) { return cur; }

void game_update(float dt)
{
    now += dt;
    actor_step(&actor, dt);
    parts_step(&parts, dt);
    switch (cur) {
    case GAME_PEEKABOO: pk_update(dt); break;
    case GAME_BUBBLES: bp_update(dt); break;
    case GAME_CARROT: cc_update(dt); break;
    case GAME_BATH: bt_update(dt); break;
    default: break;
    }
}

void game_draw(stage_t *s)
{
    switch (cur) {
    case GAME_PEEKABOO: pk_draw(s); break;
    case GAME_BUBBLES: bp_draw(s); break;
    case GAME_CARROT: cc_draw(s); break;
    case GAME_BATH: bt_draw(s); break;
    case GAME_DRESSUP: du_draw(s); break;
    default: break;
    }
}

void game_press(float x, float y)
{
    switch (cur) {
    case GAME_PEEKABOO: pk_tap(x, y); break;
    case GAME_BUBBLES: bp_tap(x, y); break;
    case GAME_CARROT: cc_press(x, y); break;
    case GAME_BATH: bt_press(x, y); break;
    case GAME_DRESSUP: du_press(x, y); break;
    default: break;
    }
}

void game_move(float x, float y)
{
    if (cur == GAME_CARROT) cc_press(x, y);
    else if (cur == GAME_BATH) bt_move(x, y);
}

void game_release(void)
{
    if (cur == GAME_BATH) bt.down = false;
}

bool game_drags(void) { return cur == GAME_CARROT || cur == GAME_BATH; }

bool game_drag_active(void)
{
    return (cur == GAME_CARROT && cc.state == CC_PLAYING) || (cur == GAME_BATH && bt.phase != BT_DONE);
}

void game_ui(game_ui_t *ui)
{
    memset(ui, 0, sizeof *ui);
    switch (cur) {
    case GAME_PEEKABOO:
        ui->score = pk.found;
        ui->found = pk.state == PK_FOUND;
        if (pk.state == PK_FOUND) snprintf(ui->line1, sizeof ui->line1, "Boo! You found %s!", nick);
        else if (pk.state == PK_SHUFFLE) snprintf(ui->line1, sizeof ui->line1, "%s is hiding again\xE2\x80\xA6", nick);
        else snprintf(ui->line1, sizeof ui->line1, "Where\xE2\x80\x99s %s? Tap a bush!", nick);
        if (pk.found && pk.state == PK_HIDDEN) snprintf(ui->line2, sizeof ui->line2, "Found %d %s so far.", pk.found, pk.found == 1 ? "time" : "times");
        break;
    case GAME_BUBBLES:
        ui->score = bp.popped;
        if (bp.popped) snprintf(ui->line1, sizeof ui->line1, "Popped %d. Keep going!", bp.popped);
        else snprintf(ui->line1, sizeof ui->line1, "Tap the bubbles!");
        snprintf(ui->line2, sizeof ui->line2, "Gold ones burst into stars.");
        break;
    case GAME_CARROT:
        ui->state = cc.state;
        ui->score = cc.score;
        if (cc.state == CC_END) snprintf(ui->line1, sizeof ui->line1, cc.record ? "A new best!" : "Yum, %d carrot%s!", cc.score, cc.score == 1 ? "" : "s");
        else snprintf(ui->line1, sizeof ui->line1, "Catch as many as you can!");
        snprintf(ui->line2, sizeof ui->line2, "Carrots %d  \xC2\xB7  Best %d", cc.score, cc.best);
        break;
    case GAME_BATH:
        ui->step = bt.phase;
        ui->progress = bt_progress();
        switch (bt.phase) {
        case BT_SCRUB: snprintf(ui->line1, sizeof ui->line1, "Scrub-a-dub! Rub the sponge over the muddy spots."); break;
        case BT_RINSE: snprintf(ui->line1, sizeof ui->line1, "All soapy! Hold the shower over %s to rinse.", nick); break;
        case BT_DRY: snprintf(ui->line1, sizeof ui->line1, "Brrr, wet! Rub the towel over %s to dry off.", nick); break;
        default: snprintf(ui->line1, sizeof ui->line1, "So fresh and fluffy! Tap %s for a snuggle.", nick); break;
        }
        break;
    default:
        break;
    }
}
