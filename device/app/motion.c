#include "motion.h"
#include <math.h>
#include <string.h>

static struct {
    float gx, gy, gz;        /* gravity (low-passed) */
    float shake;             /* peak-held high-pass energy, 0..1 */
    float e;                 /* the last sample's high-pass energy, g */
    uint32_t last_ms;        /* when the last sample arrived; 0 = never */
    uint32_t still_ms;
    uint32_t face_down_ms;
    uint32_t tap_pending_ms; /* a spike seen, waiting for it to settle */
    uint32_t tap_last_ms;
    int taps;
    bool have_gravity;
} m;

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

    if (m.gz < MOTION_FACE_DOWN_G) m.face_down_ms += dt;
    else m.face_down_ms = 0;
}

void motion_tilt(float *x, float *y)
{
    float tx = -m.gx / MOTION_TILT_FULL_G, ty = m.gy / MOTION_TILT_FULL_G;
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

float motion_lean(void) { return sqrtf(m.gx * m.gx + m.gy * m.gy); }
float motion_shake(void) { return m.shake; }

int motion_taps(void)
{
    int n = m.taps;
    m.taps = 0;
    return n;
}

void motion_add_taps(int n) { m.taps += n; }
uint32_t motion_still_ms(void) { return m.still_ms; }
bool motion_face_down(void) { return m.face_down_ms >= 300; }
bool motion_alive(uint32_t now_ms) { return m.last_ms && now_ms - m.last_ms < MOTION_STALE_MS; }
