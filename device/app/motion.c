#include "motion.h"
#include <math.h>
#include <string.h>

static struct {
    float gx, gy, gz;        /* gravity (low-passed) */
    float mx, my, mz;        /* gravity's direction at motion_mark() */
    float shake;             /* peak-held high-pass energy, 0..1 */
    float e;                 /* the last sample's high-pass energy, g */
    uint32_t last_ms;        /* when the last sample arrived; 0 = never */
    uint32_t still_ms;
    uint32_t rest_ms;
    bool marked;
    uint32_t turn_ms, lift_ms;   /* since motion_mark: turned past MOTION_TURN_G, moving past MOTION_PICKUP_G */
    uint32_t face_down_ms;
    uint32_t tap_pending_ms; /* a spike seen, waiting for it to settle */
    uint32_t tap_last_ms;
    int taps;
    bool have_gravity;
    float lx[3], ly[3];      /* level: the screen's right and up across the tilt plane (motion_level) */
    bool have_level;
} m;

/* gravity's part along the level's right and up (flat: just gx and gy) */
static void level_parts(float *px, float *py)
{
    if (!m.have_level) { *px = m.gx; *py = m.gy; return; }
    *px = m.gx * m.lx[0] + m.gy * m.lx[1] + m.gz * m.lx[2];
    *py = m.gx * m.ly[0] + m.gy * m.ly[1] + m.gz * m.ly[2];
}

void motion_level(void)
{
    float n = sqrtf(m.gx * m.gx + m.gy * m.gy + m.gz * m.gz);
    if (!m.have_gravity || n < 0.5f) return;
    float z[3] = { m.gx / n, m.gy / n, m.gz / n };   /* "up" when level */
    /* the screen's right, laid flat across that plane (its up, when it's held on its side) */
    float e[3] = { 1, 0, 0 };
    if (fabsf(z[0]) > 0.9f) { e[0] = 0; e[1] = 1; }
    float d = e[0] * z[0] + e[1] * z[1] + e[2] * z[2];
    float v[3] = { e[0] - d * z[0], e[1] - d * z[1], e[2] - d * z[2] };
    float vn = sqrtf(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
    for (int i = 0; i < 3; i++) v[i] /= vn;
    float *x = m.lx, *y = m.ly;
    if (e[0] == 1) {   /* v is the right; up = z x right */
        for (int i = 0; i < 3; i++) x[i] = v[i];
        y[0] = z[1] * x[2] - z[2] * x[1]; y[1] = z[2] * x[0] - z[0] * x[2]; y[2] = z[0] * x[1] - z[1] * x[0];
    } else {           /* v is the up; right = up x z */
        for (int i = 0; i < 3; i++) y[i] = v[i];
        x[0] = y[1] * z[2] - y[2] * z[1]; x[1] = y[2] * z[0] - y[0] * z[2]; x[2] = y[0] * z[1] - y[1] * z[0];
    }
    m.have_level = true;
}

void motion_reset(void)
{
    m.shake = 0;
    m.e = 0;
    m.still_ms = 0;
    m.tap_pending_ms = 0;
    m.taps = 0;
}

void motion_push(float ax, float ay, float az, uint32_t now_ms)
{
    uint32_t dt = m.last_ms ? now_ms - m.last_ms : MOTION_DT_MAX_MS;
    if (dt < MOTION_DT_MIN_MS) dt = MOTION_DT_MIN_MS;
    if (dt > MOTION_DT_MAX_MS) dt = MOTION_DT_MAX_MS;
    m.last_ms = now_ms ? now_ms : 1;

    /* gravity: a time-based low-pass, so an uneven sample rate never changes the feel */
    if (!m.have_gravity) { m.gx = ax; m.gy = ay; m.gz = az; m.have_gravity = true; }
    float k = 1 - expf(-(float)dt / MOTION_GRAV_TAU_MS);
    m.gx += (ax - m.gx) * k;
    m.gy += (ay - m.gy) * k;
    m.gz += (az - m.gz) * k;

    /* the rest is movement */
    float hx = ax - m.gx, hy = ay - m.gy, hz = az - m.gz;
    float e = sqrtf(hx * hx + hy * hy + hz * hz);
    m.e = e;

    float s = (e - MOTION_SHAKE_FLOOR_G) / (MOTION_SHAKE_FULL_G - MOTION_SHAKE_FLOOR_G);
    if (s < 0) s = 0;
    if (s > 1) s = 1;
    float decayed = m.shake * expf(-(float)dt / MOTION_SHAKE_DECAY_MS);
    m.shake = s > decayed ? s : decayed;

    /* a knock: one sharp spike that goes quiet again at once (a shake keeps going) */
    if (m.tap_pending_ms) {
        if (now_ms - m.tap_pending_ms > MOTION_TAP_SETTLE_MS) m.tap_pending_ms = 0;        /* it kept moving: not a knock */
        else if (e < MOTION_TAP_G * 0.5f && m.shake < 0.5f) {
            m.tap_pending_ms = 0;
            if (now_ms - m.tap_last_ms >= MOTION_TAP_GAP_MS) { m.taps++; m.tap_last_ms = now_ms; }
        }
    } else if (e > MOTION_TAP_G && decayed < 0.3f) m.tap_pending_ms = now_ms ? now_ms : 1;

    if (e < MOTION_STILL_G) m.still_ms += dt;
    else m.still_ms = 0;
    if (e < MOTION_REST_G) m.rest_ms += dt;
    else m.rest_ms = 0;

    if (m.gz < MOTION_FACE_DOWN_G) m.face_down_ms += dt;
    else m.face_down_ms = 0;

    if (m.marked) {
        if (motion_turned() > MOTION_TURN_G) m.turn_ms += dt;
        else m.turn_ms = 0;
        /* a lift lets up for a sample now and then: it leaks away as fast as it builds */
        if (e > MOTION_PICKUP_G) m.lift_ms += dt;
        else m.lift_ms = m.lift_ms > dt ? m.lift_ms - dt : 0;
    }
}

void motion_tilt(float *x, float *y)
{
    float px, py;
    level_parts(&px, &py);
    float tx = -px / MOTION_TILT_FULL_G, ty = py / MOTION_TILT_FULL_G;
    float dead = MOTION_TILT_DEAD_G / MOTION_TILT_FULL_G;
    if (fabsf(tx) < dead) tx = 0;
    if (fabsf(ty) < dead) ty = 0;
    if (tx > 1) tx = 1;
    if (tx < -1) tx = -1;
    if (ty > 1) ty = 1;
    if (ty < -1) ty = -1;
    if (x) *x = tx;
    if (y) *y = ty;
}

void motion_fall(float *x, float *y)
{
    if (x) *x = -m.gx;
    if (y) *y = m.gy;
}

float motion_lean(void)
{
    float px, py;
    level_parts(&px, &py);
    return sqrtf(px * px + py * py);
}
float motion_shake(void) { return m.shake; }

int motion_taps(void)
{
    int n = m.taps;
    m.taps = 0;
    return n;
}

void motion_add_taps(int n) { m.taps += n; }
uint32_t motion_still_ms(void) { return m.still_ms; }
uint32_t motion_rest_ms(void) { return m.rest_ms; }

void motion_mark(void)
{
    float n = sqrtf(m.gx * m.gx + m.gy * m.gy + m.gz * m.gz);
    if (n < 0.5f) n = 1;
    m.mx = m.gx / n; m.my = m.gy / n; m.mz = m.gz / n;
    m.marked = true;
    m.turn_ms = m.lift_ms = 0;
}

bool motion_picked_up(void)
{
    return m.marked && (m.turn_ms >= MOTION_TURN_HOLD_MS || m.lift_ms >= MOTION_PICKUP_MS);
}

float motion_turned(void)
{
    float n = sqrtf(m.gx * m.gx + m.gy * m.gy + m.gz * m.gz);
    if (n < 0.5f) return 0;
    float dx = m.gx / n - m.mx, dy = m.gy / n - m.my, dz = m.gz / n - m.mz;
    return sqrtf(dx * dx + dy * dy + dz * dz);
}
float motion_energy(void) { return m.e; }
bool motion_face_down(void) { return m.face_down_ms >= 300; }
bool motion_alive(uint32_t now_ms) { return m.last_ms && now_ms - m.last_ms < MOTION_STALE_MS; }
