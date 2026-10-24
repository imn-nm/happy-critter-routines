/*
 * The browser simulator's platform layer. The page (web/sim.js) loads mytoki.wasm, drives
 * sim_step() from requestAnimationFrame, copies the frame buffer to a canvas, and answers
 * the HAL calls below. On the board, platform/esp32s3/main/ plays the same role.
 */
#include <stdint.h>
#include <string.h>
#include <stdlib.h>
#include "lvgl.h"
#include "hal.h"
#include "mytoki.h"
#include "pet/pet.h"
#include "ui/home.h"

#define W 466
#define H 466
#define IMPORT(name) __attribute__((import_module("mytoki"), import_name(#name)))
#define EXPORT(name) __attribute__((export_name(#name)))

/* ---- calls into the page ---- */
IMPORT(time_now) void js_time_now(int32_t *out7);
IMPORT(request_day) void js_request_day(void);
IMPORT(send) void js_send(const char *json, int32_t len);
IMPORT(store_get) int32_t js_store_get(const char *key, int32_t klen, char *buf, int32_t len);
IMPORT(store_set) void js_store_set(const char *key, int32_t klen, const char *val, int32_t vlen);
IMPORT(play) void js_play(int32_t sound);
IMPORT(speak) void js_speak(const char *text, int32_t len);
IMPORT(brightness) void js_brightness(int32_t percent);
IMPORT(random) uint32_t js_random(void);
IMPORT(online) int32_t js_online(void);
IMPORT(docked) int32_t js_docked(void);
IMPORT(battery) int32_t js_battery(void);
IMPORT(volume) void js_volume(int32_t percent);

/* ---- HAL ---- */
void hal_time_now(hal_time_t *t)
{
    int32_t v[8];
    js_time_now(v);
    t->year = v[0]; t->month = v[1]; t->day = v[2];
    t->hour = v[3]; t->minute = v[4]; t->second = v[5]; t->ms = v[6]; t->weekday = v[7];
}
void hal_request_day(void) { js_request_day(); }
void hal_send(const char *json) { js_send(json, (int32_t)strlen(json)); }
bool hal_store_get(const char *key, char *buf, size_t len)
{
    return js_store_get(key, (int32_t)strlen(key), buf, (int32_t)len) > 0;
}
void hal_store_set(const char *key, const char *value)
{
    js_store_set(key, (int32_t)strlen(key), value, (int32_t)strlen(value));
}
void hal_play(hal_sound_t s) { js_play((int32_t)s); }
void hal_set_volume(uint8_t p) { js_volume(p); }
void hal_speak(const char *text) { js_speak(text, (int32_t)strlen(text)); }
void hal_set_brightness(uint8_t p) { js_brightness(p); }
uint32_t hal_random_u32(void) { return js_random(); }
bool hal_online(void) { return js_online() != 0; }
bool hal_docked(void) { return js_docked() != 0; }
int hal_battery(void) { return (int)js_battery(); }
bool hal_charging(void) { return js_docked() != 0; }   /* the panel's Docked box: on its charger */

/* ---- display: LVGL renders into a partial buffer, flush copies it into the frame buffer ---- */
static uint16_t fb[W * H];
static uint8_t draw_buf[W * 80 * 2];
static int32_t dirty[4] = { W, H, -1, -1 }; /* x1, y1, x2, y2 */

static void flush(lv_display_t *d, const lv_area_t *a, uint8_t *px)
{
    int32_t w = lv_area_get_width(a);
    const uint16_t *src = (const uint16_t *)px;
    for (int32_t y = a->y1; y <= a->y2; y++) memcpy(&fb[y * W + a->x1], &src[(y - a->y1) * w], (size_t)w * 2);
    if (a->x1 < dirty[0]) dirty[0] = a->x1;
    if (a->y1 < dirty[1]) dirty[1] = a->y1;
    if (a->x2 > dirty[2]) dirty[2] = a->x2;
    if (a->y2 > dirty[3]) dirty[3] = a->y2;
    lv_display_flush_ready(d);
}

/* ---- the screen off (put down): the simulator only does it for a test (mytoki_debug "sleep") ---- */
bool hal_screen_sleeps(void) { return false; }
bool hal_oled(void) { return false; }   /* the pictures stay put, so screenshots line up with the Figma */
void hal_screen(bool on)
{
    lv_display_t *d = lv_display_get_default();
    if (!on) {
        lv_display_enable_invalidation(d, false);
        lv_refr_now(d);   /* what was already waiting to be drawn, then black */
        memset(fb, 0, sizeof fb);
        dirty[0] = 0; dirty[1] = 0; dirty[2] = W - 1; dirty[3] = H - 1;
        return;
    }
    lv_display_enable_invalidation(d, true);
    lv_obj_invalidate(lv_display_get_screen_active(d));
    lv_obj_invalidate(lv_display_get_layer_top(d));
}

/* ---- touch ---- */
/* Every pointer sample the page sends is queued and handed to LVGL one by one (continue_reading),
 * so a quick tap or a fast flick is seen in full, as a touch controller reports it on the board. */
typedef struct { int16_t x, y; uint8_t down; } sample_t;
static sample_t queue[128], last;
static int q_head, q_len;

static void touch_read(lv_indev_t *i, lv_indev_data_t *data)
{
    (void)i;
    if (q_len) {
        last = queue[q_head];
        q_head = (q_head + 1) % 128;
        q_len--;
    }
    data->point.x = last.x;
    data->point.y = last.y;
    data->state = last.down ? LV_INDEV_STATE_PRESSED : LV_INDEV_STATE_RELEASED;
    data->continue_reading = q_len > 0;
}

/* ---- exports for the page ---- */
EXPORT(sim_fb) uint16_t *sim_fb(void) { return fb; }
EXPORT(sim_dirty) int32_t *sim_dirty(void) { return dirty; }
EXPORT(sim_clear_dirty) void sim_clear_dirty(void) { dirty[0] = W; dirty[1] = H; dirty[2] = -1; dirty[3] = -1; }
EXPORT(sim_alloc) void *sim_alloc(int32_t n) { return malloc((size_t)n); }
EXPORT(sim_free) void sim_free(void *p) { free(p); }

EXPORT(sim_init) void sim_init(void)
{
    lv_init();
    lv_display_t *disp = lv_display_create(W, H);
    lv_display_set_color_format(disp, LV_COLOR_FORMAT_RGB565);
    lv_display_set_buffers(disp, draw_buf, NULL, sizeof(draw_buf), LV_DISPLAY_RENDER_MODE_PARTIAL);
    lv_display_set_flush_cb(disp, flush);
    lv_indev_t *touch = lv_indev_create();
    lv_indev_set_type(touch, LV_INDEV_TYPE_POINTER);
    lv_indev_set_read_cb(touch, touch_read);
    mytoki_start();
}

EXPORT(sim_step) void sim_step(int32_t ms)
{
    lv_tick_inc((uint32_t)ms);
    lv_timer_handler();
}

EXPORT(sim_pointer) void sim_pointer(int32_t x, int32_t y, int32_t down)
{
    if (q_len == 128) { q_head = (q_head + 1) % 128; q_len--; }
    queue[(q_head + q_len) % 128] = (sample_t){ (int16_t)x, (int16_t)y, (uint8_t)(down != 0) };
    q_len++;
}

EXPORT(sim_button) void sim_button(void) { mytoki_button(); }

/* the page's pretend accelerometer: the tilt pad, Shake and Knock, 50 Hz */
EXPORT(sim_motion) void sim_motion(float ax, float ay, float az) { mytoki_motion(ax, ay, az); }

EXPORT(sim_day) void sim_day(const char *json, int32_t len) { mytoki_day_received(json, (size_t)len); }
EXPORT(sim_day_failed) void sim_day_failed(int32_t reason) { mytoki_day_failed(reason); }
EXPORT(sim_debug) void sim_debug(const char *cmd) { mytoki_debug(cmd); }
/* The clip the home screen's pet is playing ("Homework"), or "" while he's off screen, for the
 * panel and tests. */
EXPORT(sim_clip) const char *sim_clip(void) { return pet_is_paused(home_pet()) ? "" : pet_current_clip_name(home_pet()); }
