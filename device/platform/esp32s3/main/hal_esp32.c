/*
 * The MyToki HAL (device/app/hal.h) on the Waveshare ESP32-S3-Touch-AMOLED-1.75C.
 *
 *  - time:    SNTP once Wi-Fi is up, the server's Date header as a fallback, and the
 *             firmware's build time if neither has arrived (so the demo runs offline).
 *  - plan:    GET CONFIG_MYTOKI_DAY_URL, or the built-in demo day when that's empty.
 *  - send:    POST to CONFIG_MYTOKI_EVENTS_URL; kept in NVS and retried while offline.
 *  - store:   NVS namespace "mytoki".
 *  - button:  CONFIG_MYTOKI_BUTTON_GPIO (BOOT, GPIO0, active low) until the shell's button exists.
 *  - sound:   simple chimes synthesised into the ES8311 speaker codec.
 *  - motion:  the board's QMI8658 accelerometer over I2C at 100 Hz (CONFIG_MYTOKI_IMU);
 *             the product's LIS2DH12 goes behind the same mytoki_motion() call.
 * Every call into the app (mytoki_*) happens with the LVGL lock held. The button and motion
 * are queued and handed to the app from an LVGL timer, so they run on LVGL's own (big) stack.
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <math.h>
#include <sys/time.h>
#include <time.h>
#include "freertos/FreeRTOS.h"
#include "freertos/queue.h"
#include "freertos/task.h"
#include "esp_log.h"
#include "esp_random.h"
#include "esp_event.h"
#include "esp_netif.h"
#include "esp_netif_sntp.h"
#include "esp_wifi.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "nvs_flash.h"
#include "esp_partition.h"
#include "esp_pm.h"
#include "esp_timer.h"
#include "nvs.h"
#include "driver/gpio.h"
#include "driver/i2c_master.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "lvgl.h"
#include "esp_codec_dev.h"
#include "esp_heap_caps.h"
#include "cJSON.h"
#include "hal.h"
#include "mytoki.h"
#include "hal_esp32.h"

static const char *TAG = "mytoki-hal";

extern const char demo_day_start[] asm("_binary_school_day_json_start");
extern const char demo_day_end[] asm("_binary_school_day_json_end");

static nvs_handle_t nvs;
static volatile bool wifi_up;
static QueueHandle_t net_q, sound_q, input_q;

typedef struct { int kind; char *json; } net_msg_t; /* kind 0: fetch the plan, 1: send */
typedef struct { int kind; float x, y, z; } input_t; /* kind 0: the button, 1: a motion sample */

/* ================================================================ app lock helpers */
static void with_lock_day(const char *json, size_t len)
{
    if (bsp_display_lock(-1) == ESP_OK) {
        mytoki_day_received(json, len);
        bsp_display_unlock();
    }
}

static void with_lock_fail(int reason)
{
    if (bsp_display_lock(-1) == ESP_OK) {
        mytoki_day_failed(reason);
        bsp_display_unlock();
    }
}

/* ================================================================ time */
static bool clock_is_set(void)
{
    time_t now = time(NULL);
    struct tm tm;
    localtime_r(&now, &tm);
    return tm.tm_year + 1900 >= 2024;
}

static time_t utc_mktime(struct tm *t)
{
    /* days from civil (Howard Hinnant) */
    int y = t->tm_year + 1900, m = t->tm_mon + 1;
    y -= m <= 2;
    int era = (y >= 0 ? y : y - 399) / 400;
    unsigned yoe = (unsigned)(y - era * 400);
    unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + t->tm_mday - 1;
    unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    long days = era * 146097L + (long)doe - 719468L;
    return (time_t)(days * 86400L + t->tm_hour * 3600 + t->tm_min * 60 + t->tm_sec);
}

/* "Tue, 06 Oct 2026 22:31:05 GMT" from the server, when SNTP hasn't answered yet */
static bool clock_from_http_date(const char *v)
{
    static const char *MON = "JanFebMarAprMayJunJulAugSepOctNovDec";
    char mon[4] = { 0 };
    struct tm t = { 0 };
    if (sscanf(v, "%*3s, %d %3s %d %d:%d:%d", &t.tm_mday, mon, &t.tm_year, &t.tm_hour, &t.tm_min, &t.tm_sec) != 6) return false;
    const char *p = strstr(MON, mon);
    if (!p) return false;
    t.tm_mon = (int)(p - MON) / 3;
    t.tm_year -= 1900;
    struct timeval tv = { .tv_sec = utc_mktime(&t) };
    settimeofday(&tv, NULL);
    ESP_LOGI(TAG, "clock set from the server: %s", v);
    return true;
}

/* The firmware's build time: better than 1970 for a demo with no network. CONFIG_MYTOKI_DEMO_TIME
 * moves it to another time of day. */
static void clock_from_build(void)
{
    static const char *MON = "JanFebMarAprMayJunJulAugSepOctNovDec";
    char mon[4] = { 0 };
    struct tm t = { 0 };
    sscanf(__DATE__, "%3s %d %d", mon, &t.tm_mday, &t.tm_year);
    sscanf(__TIME__, "%d:%d:%d", &t.tm_hour, &t.tm_min, &t.tm_sec);
    int h, m;
    if (sscanf(CONFIG_MYTOKI_DEMO_TIME, "%d:%d", &h, &m) == 2) { t.tm_hour = h; t.tm_min = m; t.tm_sec = 0; }
    t.tm_mon = (int)(strstr(MON, mon) - MON) / 3;
    t.tm_year -= 1900;
    t.tm_isdst = -1;
    struct timeval tv = { .tv_sec = mktime(&t) };
    settimeofday(&tv, NULL);
}

void hal_time_now(hal_time_t *out)
{
    struct timeval tv;
    gettimeofday(&tv, NULL);
    struct tm tm;
    localtime_r(&tv.tv_sec, &tm);
    out->year = tm.tm_year + 1900;
    out->month = tm.tm_mon + 1;
    out->day = tm.tm_mday;
    out->hour = tm.tm_hour;
    out->minute = tm.tm_min;
    out->second = tm.tm_sec;
    out->ms = (int)(tv.tv_usec / 1000);
    out->weekday = tm.tm_wday;
}

/* ================================================================ storage */
bool hal_store_get(const char *key, char *buf, size_t len)
{
    size_t n = len;
    return nvs && nvs_get_str(nvs, key, buf, &n) == ESP_OK;
}

void hal_store_set(const char *key, const char *value)
{
    if (!nvs) return;
    if (nvs_set_str(nvs, key, value) == ESP_OK) nvs_commit(nvs);
    else ESP_LOGW(TAG, "could not save %s", key);
}

/* ================================================================ misc */
uint32_t hal_random_u32(void) { return esp_random(); }
bool hal_online(void) { return wifi_up; }
/* TODO: the dock's charger-detect pin and the fuel gauge once the enclosure exists. */
bool hal_docked(void) { return false; }
void hal_speak(const char *text) { ESP_LOGI(TAG, "say: %s", text); /* no voice on the board yet */ }

/* ================================================================ the battery */
/* The board's power chip (an AXP2101 on the shared I2C bus): its fuel gauge's percentage, and
 * whether a charger is plugged in. The net task reads it every 20 s. Without the chip, or without a
 * battery, MyToki reads full and unplugged, as before. */
#define AXP_ADDR 0x34
#define AXP_STATUS1 0x00      /* bit 5: a charger (VBUS) is in, bit 3: a battery is there */
#define AXP_CHIP_ID 0x03      /* reads 0x4A */
#define AXP_GAUGE_CTRL 0x18   /* bit 3: the fuel gauge on */
#define AXP_BAT_PERCENT 0xA4
static i2c_master_dev_handle_t axp;
static bool axp_tried;
static volatile int bat_percent = 100;
static volatile bool bat_plugged;

static bool axp_read(uint8_t reg, uint8_t *v) { return i2c_master_transmit_receive(axp, &reg, 1, v, 1, 50) == ESP_OK; }

static void power_poll(void)
{
    static int64_t next_us;
    if (esp_timer_get_time() < next_us) return;
    next_us = esp_timer_get_time() + 20 * 1000000LL;
    if (!axp_tried) {
        axp_tried = true;
        i2c_master_bus_handle_t bus = NULL;
        if (bsp_i2c_init() != ESP_OK || (bus = bsp_i2c_get_handle()) == NULL) return;
        i2c_device_config_t cfg = { .dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = AXP_ADDR, .scl_speed_hz = 400000 };
        if (i2c_master_bus_add_device(bus, &cfg, &axp) != ESP_OK) { axp = NULL; return; }
        uint8_t id = 0, g = 0;
        if (!axp_read(AXP_CHIP_ID, &id) || id != 0x4A) {
            ESP_LOGW(TAG, "no AXP2101 (id 0x%02x): the battery reads full", id);
            i2c_master_bus_rm_device(axp);
            axp = NULL;
            return;
        }
        if (axp_read(AXP_GAUGE_CTRL, &g) && !(g & 0x08)) {
            uint8_t w[2] = { AXP_GAUGE_CTRL, (uint8_t)(g | 0x08) };
            i2c_master_transmit(axp, w, 2, 50);
        }
    }
    if (!axp) return;
    uint8_t s1 = 0, pct = 0;
    if (!axp_read(AXP_STATUS1, &s1)) return;
    bool battery = s1 & 0x08;
    bat_plugged = battery && (s1 & 0x20);
    if (!battery) bat_percent = 100;
    else if (axp_read(AXP_BAT_PERCENT, &pct) && pct <= 100) bat_percent = pct;
    static bool told;
    if (!told) { told = true; ESP_LOGI(TAG, "power: AXP2101, %s, %d%%%s", battery ? "a battery" : "no battery", bat_percent, bat_plugged ? ", charging" : ""); }
}

int hal_battery(void) { return bat_percent; }
bool hal_charging(void) { return bat_plugged; }

/* The screen off when put down: dark and not drawing. Back on, it lights once the first frame is
 * redrawn (the panel still holds the old one), at the brightness last asked for. */
static uint8_t bright_want = 100;
static bool screen_dark, screen_waking;
static lv_timer_t *input_tmr;   /* the button and motion into the app (below): every 5 ms, 50 ms while dark */

/* While the screen is off the chip should sleep: the button, motion, touch and the app's input are
 * looked at less often (a touch or a pickup still wakes it within a tenth of a second). */
static void input_pace(bool dark)
{
    if (input_tmr) lv_timer_set_period(input_tmr, dark ? 50 : 5);
    for (lv_indev_t *i = lv_indev_get_next(NULL); i; i = lv_indev_get_next(i)) {
        lv_timer_t *t = lv_indev_get_read_timer(i);
        if (t) lv_timer_set_period(t, dark ? 100 : LV_DEF_REFR_PERIOD);   /* the touch is read this often */
    }
}
static int64_t look_next_us;   /* the quick look's next time (below): picked up, it looks at once */
void hal_set_brightness(uint8_t percent)
{
    bright_want = percent < 5 ? 5 : percent;
    if (!screen_dark) bsp_display_brightness_set(bright_want);
}
bool hal_screen_sleeps(void) { return true; }
static void screen_drawn(lv_event_t *e)
{
    (void)e;
    if (!screen_waking) return;
    screen_waking = false;
    screen_dark = false;
    bsp_display_brightness_set(bright_want);
}
void hal_screen(bool on)
{
    lv_display_t *d = lv_display_get_default();
    if (!d) return;
    static bool hooked;
    if (!hooked) { hooked = true; lv_display_add_event_cb(d, screen_drawn, LV_EVENT_REFR_READY, NULL); }
    if (!on) {
        screen_dark = true;
        screen_waking = false;
        bsp_display_brightness_set(0);
        lv_display_enable_invalidation(d, false);
        input_pace(true);
        return;
    }
    if (!screen_dark) return;
    screen_waking = true;
    look_next_us = 0;
    input_pace(false);
    lv_display_enable_invalidation(d, true);
    lv_obj_invalidate(lv_display_get_screen_active(d));
    lv_obj_invalidate(lv_display_get_layer_top(d));
}

/* ================================================================ network */
void hal_request_day(void)
{
    net_msg_t m = { 0, NULL };
    xQueueSend(net_q, &m, 0);
}

void hal_send(const char *json)
{
    net_msg_t m = { 1, strdup(json) };
    if (!m.json || xQueueSend(net_q, &m, 0) != pdTRUE) free(m.json);
}

typedef struct { char *buf; size_t len, cap; } body_t;

static char got_etag[84];          /* the day's ETag, as the last answer gave it */
static volatile bool clock_good;   /* SNTP, the server's Date, or kept through a reset: not the build time */

static esp_err_t on_http(esp_http_client_event_t *e)
{
    body_t *b = e->user_data;
    if (e->event_id == HTTP_EVENT_ON_HEADER && !strcasecmp(e->header_key, "Date") && !clock_good && clock_from_http_date(e->header_value)) clock_good = true;
    if (e->event_id == HTTP_EVENT_ON_HEADER && !strcasecmp(e->header_key, "ETag")) snprintf(got_etag, sizeof got_etag, "%s", e->header_value);
    if (e->event_id == HTTP_EVENT_ON_DATA && b) {
        if (b->len + e->data_len + 1 > b->cap) {
            size_t cap = (b->len + e->data_len + 1) * 2;
            char *nb = realloc(b->buf, cap);
            if (!nb) return ESP_FAIL;
            b->buf = nb;
            b->cap = cap;
        }
        memcpy(b->buf + b->len, e->data, e->data_len);
        b->len += e->data_len;
        b->buf[b->len] = 0;
    }
    return ESP_OK;
}

/* One connection kept open to the server (the day plan every 30 s, and the events): a fresh secure
 * connection each time would cost the board a TLS handshake. Only the net task uses it. When the
 * server has closed it meanwhile, the request goes again on a new one (only then: a request that
 * failed on a fresh connection waits for the next try, so a struggling server isn't asked twice). */
static esp_http_client_handle_t conn;

/* rest: the database's REST API (the quick look), which takes the project's public key; anything
 * else is the mytoki-device function, which takes this handheld's own token. */
static esp_err_t http_once(const char *url, const char *post, const char *if_none_match, body_t *body, bool rest)
{
    if (!conn) {
        esp_http_client_config_t cfg = {
            .url = url,
            .event_handler = on_http,
            .timeout_ms = 10000,
            .crt_bundle_attach = esp_crt_bundle_attach,
            .keep_alive_enable = true,
            .buffer_size_tx = 1536,   /* the quick look sends the public key twice (apikey, Authorization): 512 is too small */
        };
        conn = esp_http_client_init(&cfg);
        if (!conn) return ESP_FAIL;
    }
    char auth[400];
    snprintf(auth, sizeof auth, "Bearer %s", rest ? CONFIG_MYTOKI_ANON_KEY : CONFIG_MYTOKI_DEVICE_TOKEN);
    if (rest || CONFIG_MYTOKI_DEVICE_TOKEN[0]) esp_http_client_set_header(conn, "Authorization", auth);
    else esp_http_client_delete_header(conn, "Authorization");
    if (rest) esp_http_client_set_header(conn, "apikey", CONFIG_MYTOKI_ANON_KEY);
    else esp_http_client_delete_header(conn, "apikey");
    esp_http_client_set_url(conn, url);
    esp_http_client_set_user_data(conn, body);
    esp_http_client_set_method(conn, post ? HTTP_METHOD_POST : HTTP_METHOD_GET);
    if (post) esp_http_client_set_header(conn, "Content-Type", "application/json");
    else esp_http_client_delete_header(conn, "Content-Type");
    if (if_none_match) esp_http_client_set_header(conn, "If-None-Match", if_none_match);
    else esp_http_client_delete_header(conn, "If-None-Match");
    esp_http_client_set_post_field(conn, post, post ? (int)strlen(post) : 0);
    esp_err_t err = esp_http_client_perform(conn);
    if (err != ESP_OK) { esp_http_client_cleanup(conn); conn = NULL; }
    return err;
}

static int http(const char *url, const char *post, const char *if_none_match, body_t *body, bool rest)
{
    bool reused = conn != NULL;
    esp_err_t err = http_once(url, post, if_none_match, body, rest);
    if (err != ESP_OK && reused) {
        if (body) body->len = 0;
        err = http_once(url, post, if_none_match, body, rest);
    }
    return err == ESP_OK ? esp_http_client_get_status_code(conn) : -1;
}

/* What couldn't be sent yet, kept across restarts. */
#define OUTBOX_MAX 32
static char *outbox[OUTBOX_MAX];
static int outbox_n;

static void outbox_save(void)
{
    cJSON *a = cJSON_CreateArray();
    for (int i = 0; i < outbox_n; i++) cJSON_AddItemToArray(a, cJSON_CreateString(outbox[i]));
    char *s = cJSON_PrintUnformatted(a);
    if (s) { hal_store_set("outbox", s); cJSON_free(s); }
    cJSON_Delete(a);
}

static void outbox_load(void)
{
    static char buf[3800];
    if (!hal_store_get("outbox", buf, sizeof buf)) return;
    cJSON *a = cJSON_Parse(buf);
    const cJSON *it;
    cJSON_ArrayForEach(it, a) if (cJSON_IsString(it) && outbox_n < OUTBOX_MAX) outbox[outbox_n++] = strdup(it->valuestring);
    cJSON_Delete(a);
}

/* After the server fails to take one, the next try waits 20 s, then twice as long each time up to
 * 5 minutes (a server in trouble isn't asked every 20 s); something new the child does tries at once. */
#define OUTBOX_WAIT_MS 20000
#define OUTBOX_WAIT_MAX_MS (5 * 60 * 1000)
static uint32_t outbox_wait_ms;
static int64_t outbox_next_us;

static void outbox_flush(void)
{
    if (!CONFIG_MYTOKI_EVENTS_URL[0] || !wifi_up || !outbox_n || esp_timer_get_time() < outbox_next_us) return;
    bool changed = false;
    while (outbox_n) {
        int st = http(CONFIG_MYTOKI_EVENTS_URL, outbox[0], NULL, NULL, false);
        if (st < 200 || st >= 300) {
            outbox_wait_ms = !outbox_wait_ms ? OUTBOX_WAIT_MS : outbox_wait_ms * 2 > OUTBOX_WAIT_MAX_MS ? OUTBOX_WAIT_MAX_MS : outbox_wait_ms * 2;
            outbox_next_us = esp_timer_get_time() + (int64_t)outbox_wait_ms * 1000;
            break;
        }
        outbox_wait_ms = 0;
        free(outbox[0]);
        memmove(outbox, outbox + 1, sizeof(char *) * (size_t)--outbox_n);
        changed = true;
    }
    if (changed) outbox_save();
}

/* ================================================================ the last day, kept */
/* The day as the server last sent it, with its ETag: sent back with the next ask, so while nothing
 * has changed the server answers 304 (one small query) and the app gets this copy again. It is kept
 * in its own flash partition ("plan") too: after a restart while the server can't be reached,
 * MyToki carries on with it (the app takes it only if it is today's) instead of waiting on
 * "Getting your day ready". */
#define PLAN_MAGIC 0x4d544b31u   /* "MTK1" */
typedef struct { uint32_t magic, len, hash; char etag[84]; } plan_head_t;
static char *day_body;            /* PSRAM */
static size_t day_len;
static uint32_t day_saved_hash;
static char day_etag[84];
static bool cache_offered;

static uint32_t fnv1a(const char *s, size_t n)
{
    uint32_t h = 2166136261u;
    for (size_t i = 0; i < n; i++) h = (h ^ (uint8_t)s[i]) * 16777619u;
    return h;
}

static const esp_partition_t *plan_partition(void)
{
    return esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, "plan");
}

static void plan_cache_load(void)
{
    const esp_partition_t *pt = plan_partition();
    plan_head_t h;
    if (!pt || esp_partition_read(pt, 0, &h, sizeof h) != ESP_OK) return;
    if (h.magic != PLAN_MAGIC || !h.len || sizeof h + h.len > pt->size) return;
    char *b = heap_caps_malloc(h.len + 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!b) return;
    if (esp_partition_read(pt, sizeof h, b, h.len) != ESP_OK || fnv1a(b, h.len) != h.hash) { free(b); return; }
    b[h.len] = 0;
    day_body = b;
    day_len = h.len;
    day_saved_hash = h.hash;
    h.etag[sizeof h.etag - 1] = 0;
    snprintf(day_etag, sizeof day_etag, "%s", h.etag);
    ESP_LOGI(TAG, "kept day: %u bytes", (unsigned)h.len);
}

/* Written only when the day has changed (a few times a day): erasing stalls the screen a moment. */
static void plan_cache_save(void)
{
    const esp_partition_t *pt = plan_partition();
    uint32_t hash = fnv1a(day_body, day_len);
    if (!pt || hash == day_saved_hash || sizeof(plan_head_t) + day_len > pt->size) return;
    plan_head_t h = { .magic = PLAN_MAGIC, .len = (uint32_t)day_len, .hash = hash };
    snprintf(h.etag, sizeof h.etag, "%s", day_etag);
    size_t erase = (sizeof h + day_len + pt->erase_size - 1) / pt->erase_size * pt->erase_size;
    if (esp_partition_erase_range(pt, 0, erase) != ESP_OK) return;
    /* the header last: a write cut short leaves no header, so no half a day */
    if (esp_partition_write(pt, sizeof h, day_body, day_len) == ESP_OK && esp_partition_write(pt, 0, &h, sizeof h) == ESP_OK)
        day_saved_hash = hash;
}

/* The kept day to the app, once, while it has none and the clock can tell whether it's today's. */
static void plan_cache_offer(void)
{
    if (cache_offered || !day_body || !clock_good) return;
    cache_offered = true;
    if (bsp_display_lock(-1) == ESP_OK) {
        mytoki_day_cached(day_body, day_len);
        bsp_display_unlock();
    }
}

/* How often the quick look (below) asks, balanced against the battery: the radio is what drains it.
 * On the charger every 5 s; in a hand (the screen on) every 10 s; put down (the screen dark) every
 * 30 s, as often as the day was asked for before the quick look; on a low battery once a minute. */
static uint32_t look_every_ms(void)
{
    if (bat_plugged) return 5000;
    if (bat_percent <= 15) return 60000;
    return screen_dark ? 30000 : 10000;
}

/* The app asks for the day every 30 s. While the quick look has just found nothing new, the kept day
 * answers without the radio; a real ask still goes at least every 5 minutes (a new build of the
 * plan code changes the day without changing its number). */
#define DAY_ASK_MAX_US (5 * 60 * 1000000LL)
static int64_t look_same_us, day_asked_us;

static void fetch_day(bool changed)
{
    if (!CONFIG_MYTOKI_DAY_URL[0]) {
        /* no server yet: the built-in demo day */
        with_lock_day(demo_day_start, (size_t)(demo_day_end - demo_day_start));
        return;
    }
    if (!CONFIG_MYTOKI_DEVICE_TOKEN[0]) { with_lock_fail(3); return; } /* not paired: the device shows its code */
    int64_t now = esp_timer_get_time();
    if (!changed && day_body && day_etag[0] && look_same_us && now - look_same_us < (look_every_ms() + 2000) * 1000LL &&
        now - day_asked_us < DAY_ASK_MAX_US) {
        with_lock_day(day_body, day_len);
        return;
    }
    plan_cache_offer();
    /* asked just after start-up: give Wi-Fi a moment to join before saying "Let's reconnect" */
    for (int i = 0; i < 100 && !wifi_up && CONFIG_MYTOKI_WIFI_SSID[0]; i++) vTaskDelay(pdMS_TO_TICKS(100));
    if (!wifi_up) { plan_cache_offer(); with_lock_fail(0); return; }
    outbox_flush();   /* what the child did goes first, so the day that comes back has it */
    body_t b = { 0 };
    got_etag[0] = 0;
    day_asked_us = esp_timer_get_time();
    int st = http(CONFIG_MYTOKI_DAY_URL, NULL, day_body && day_etag[0] ? day_etag : NULL, &b, false);
    if (st == 304 && day_body) with_lock_day(day_body, day_len);   /* nothing changed */
    else if (st == 200 && b.buf) {
        char *keep = heap_caps_malloc(b.len + 1, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
        if (keep) {
            memcpy(keep, b.buf, b.len + 1);
            free(day_body);
            day_body = keep;
            day_len = b.len;
            snprintf(day_etag, sizeof day_etag, "%s", got_etag);
        }
        with_lock_day(b.buf, b.len);
        if (keep) plan_cache_save();
    } else {
        ESP_LOGW(TAG, "day plan: HTTP %d", st);
        plan_cache_offer();   /* the server's answer may have set the clock */
        with_lock_fail(st < 0 ? 0 : 1);
    }
    free(b.buf);
}

/* ================================================================ the quick look */
/* While there's a day: has it changed? One small call to the database
 * (rest/v1/rpc/mytoki_plan_version, on the day plan's host) with this handheld's token returns its
 * child's change number; the whole day is fetched only when that has moved past the kept day's
 * ETag ("<build>-<date>-<child>-<number>"), or the date has. A grown-up's test ring or new time so
 * shows within seconds, for one index lookup a look and no function call. Paced by look_every_ms;
 * after a failure it waits twice as long each time, from 5 s up to 5 minutes. */
#define LOOK_MS 5000
#define LOOK_MAX_MS (5 * 60 * 1000)
static char look_url[160];
static uint32_t look_wait_ms = LOOK_MS;

static void look_init(void)
{
    const char *f = strstr(CONFIG_MYTOKI_DAY_URL, "/functions/v1/");
    if (!f || !CONFIG_MYTOKI_ANON_KEY[0] || !CONFIG_MYTOKI_DEVICE_TOKEN[0]) return;
    snprintf(look_url, sizeof look_url, "%.*s/rest/v1/rpc/mytoki_plan_version", (int)(f - CONFIG_MYTOKI_DAY_URL), CONFIG_MYTOKI_DAY_URL);
}

/* The kept day's ETag: its date and change number. */
static bool etag_parts(char date[11], long long *number)
{
    const char *q = strchr(day_etag, '"');
    const char *dash = q ? strchr(q + 1, '-') : NULL;
    const char *last = q ? strrchr(q + 1, '-') : NULL;
    if (!dash || !last || last == dash) return false;
    snprintf(date, 11, "%.10s", dash + 1);
    *number = strtoll(last + 1, NULL, 10);
    return true;
}

static void quick_look(void)
{
    if (!look_url[0] || !wifi_up || !day_body || !day_etag[0] || esp_timer_get_time() < look_next_us) return;
    char date[11], today[11], post[160];
    long long have = 0;
    if (!etag_parts(date, &have)) return;
    snprintf(post, sizeof post, "{\"p_token\":\"%s\"}", CONFIG_MYTOKI_DEVICE_TOKEN);
    body_t b = { 0 };
    int st = http(look_url, post, NULL, &b, true);
    bool ok = st == 200 && b.buf && b.buf[0] >= '0' && b.buf[0] <= '9';   /* "null": this token is unknown */
    long long now_number = ok ? strtoll(b.buf, NULL, 10) : 0;
    free(b.buf);
    look_wait_ms = ok ? LOOK_MS : look_wait_ms * 2 > LOOK_MAX_MS ? LOOK_MAX_MS : look_wait_ms * 2;
    look_next_us = esp_timer_get_time() + (int64_t)(ok ? look_every_ms() : look_wait_ms) * 1000;
    if (!ok) { look_same_us = 0; return; }
    snprintf(today, sizeof today, "%s", date);
    if (clock_good) {
        time_t t = time(NULL);
        struct tm tm;
        localtime_r(&t, &tm);
        strftime(today, sizeof today, "%Y-%m-%d", &tm);
    }
    if (now_number != have || strcmp(today, date)) { look_same_us = 0; fetch_day(true); }
    else look_same_us = esp_timer_get_time();
}

static void net_task(void *arg)
{
    (void)arg;
    net_msg_t m;
    for (;;) {
        power_poll();
        if (xQueueReceive(net_q, &m, pdMS_TO_TICKS(LOOK_MS)) == pdTRUE) {
            if (m.kind == 0) fetch_day(false);
            else if (m.json) {
                if (outbox_n == OUTBOX_MAX) { free(outbox[0]); memmove(outbox, outbox + 1, sizeof(char *) * (OUTBOX_MAX - 1)); outbox_n--; }
                outbox[outbox_n++] = m.json;
                outbox_save();
                outbox_next_us = 0;
            }
        }
        outbox_flush();
        quick_look();
    }
}

static void on_wifi(void *arg, esp_event_base_t base, int32_t id, void *data)
{
    (void)arg; (void)data;
    if (base == WIFI_EVENT && id == WIFI_EVENT_STA_START) esp_wifi_connect();
    else if (base == WIFI_EVENT && id == WIFI_EVENT_STA_DISCONNECTED) { wifi_up = false; esp_wifi_connect(); }
    else if (base == IP_EVENT && id == IP_EVENT_STA_GOT_IP) {
        wifi_up = true;
        ESP_LOGI(TAG, "online");
        hal_request_day();
    }
}

static void on_sntp(struct timeval *tv)
{
    (void)tv;
    if (!CONFIG_MYTOKI_DEMO_TIME[0]) clock_good = true;
}

static void wifi_start(void)
{
    if (!CONFIG_MYTOKI_WIFI_SSID[0]) { ESP_LOGW(TAG, "no Wi-Fi set (menuconfig > MyToki): offline"); return; }
    esp_netif_init();
    esp_event_loop_create_default();
    esp_netif_create_default_wifi_sta();
    wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
    esp_wifi_init(&cfg);
    esp_event_handler_register(WIFI_EVENT, ESP_EVENT_ANY_ID, on_wifi, NULL);
    esp_event_handler_register(IP_EVENT, IP_EVENT_STA_GOT_IP, on_wifi, NULL);
    wifi_config_t wc = { 0 };
    strncpy((char *)wc.sta.ssid, CONFIG_MYTOKI_WIFI_SSID, sizeof wc.sta.ssid - 1);
    strncpy((char *)wc.sta.password, CONFIG_MYTOKI_WIFI_PASSWORD, sizeof wc.sta.password - 1);
    esp_wifi_set_mode(WIFI_MODE_STA);
    esp_wifi_set_config(WIFI_IF_STA, &wc);
    esp_wifi_start();
    esp_wifi_set_ps(WIFI_PS_MIN_MODEM);   /* the radio sleeps between the access point's beacons */
    esp_sntp_config_t sntp = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
    sntp.sync_cb = on_sntp;
    esp_netif_sntp_init(&sntp);
}

/* ================================================================ the button at 1 o'clock */
static void button_task(void *arg)
{
    (void)arg;
    const gpio_num_t pin = (gpio_num_t)CONFIG_MYTOKI_BUTTON_GPIO;
    gpio_config_t io = { .pin_bit_mask = 1ULL << pin, .mode = GPIO_MODE_INPUT, .pull_up_en = GPIO_PULLUP_ENABLE };
    gpio_config(&io);
    int last = 1, stable = 0;
    for (;;) {
        int v = gpio_get_level(pin);
        if (v != last) { stable = 0; last = v; }
        else if (++stable == 3 && v == 0) { /* pressed for 30 ms */
            input_t in = { 0 };
            xQueueSend(input_q, &in, 0);
        }
        vTaskDelay(pdMS_TO_TICKS(screen_dark ? 25 : 10));   /* dark: three looks are still a short press */
    }
}

/* ================================================================ motion */
#ifdef CONFIG_MYTOKI_IMU

/* QMI8658 (QST), the dev board's 6-axis IMU; only the accelerometer is read. Register codes
 * from the datasheet; check them against the BSP's own qmi8658 component once ESP-IDF is here. */
#define QMI_ADDR 0x6B           /* 0x6A when SA0 is pulled low */
#define QMI_WHO_AM_I 0x00       /* reads 0x05 */
#define QMI_CTRL1 0x02          /* 0x40: address auto-increment */
#define QMI_CTRL2 0x03          /* 0x16: accel +-4 g (full scale bits 6:4 = 001), 125 Hz (ODR 0110); 0x23 was +-8 g, halving every reading */
#define QMI_CTRL7 0x08          /* 0x01: accel on */
#define QMI_AX_L 0x35
/* Which sensor axis is the screen's x (right), y (12 o'clock), z (out of the screen), and its
 * sign. Tilted on the board (2026-10-20): the chip sits a quarter turn from the screen, so the
 * right edge down raises the sensor's y and the bottom edge down raises its x; screen up reads +z. */
#define IMU_AX 1
#define IMU_AY 0
#define IMU_AZ 2
#define IMU_SX -1
#define IMU_SY 1
#define IMU_SZ 1

static i2c_master_dev_handle_t imu;

static bool imu_write(uint8_t reg, uint8_t val)
{
    uint8_t b[2] = { reg, val };
    return i2c_master_transmit(imu, b, 2, 50) == ESP_OK;
}

static bool imu_read(uint8_t reg, uint8_t *buf, size_t n)
{
    return i2c_master_transmit_receive(imu, &reg, 1, buf, n, 50) == ESP_OK;
}

static void motion_task(void *arg)
{
    (void)arg;
    i2c_master_bus_handle_t bus = NULL;
    if (bsp_i2c_init() != ESP_OK || (bus = bsp_i2c_get_handle()) == NULL) { ESP_LOGW(TAG, "no I2C bus: no motion"); vTaskDelete(NULL); return; }
    i2c_device_config_t cfg = { .dev_addr_length = I2C_ADDR_BIT_LEN_7, .device_address = QMI_ADDR, .scl_speed_hz = 400000 };
    if (i2c_master_bus_add_device(bus, &cfg, &imu) != ESP_OK) { ESP_LOGW(TAG, "no IMU device: no motion"); vTaskDelete(NULL); return; }
    uint8_t who = 0;
    if (!imu_read(QMI_WHO_AM_I, &who, 1) || who != 0x05) { ESP_LOGW(TAG, "QMI8658 not found (who am I 0x%02x): no motion", who); vTaskDelete(NULL); return; }
    imu_write(QMI_CTRL1, 0x40);
    imu_write(QMI_CTRL2, 0x16);
    imu_write(QMI_CTRL7, 0x01);
    ESP_LOGI(TAG, "motion: QMI8658 at 100 Hz");
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(screen_dark ? 40 : 10));   /* dark: 25 Hz still sees a pickup */
        uint8_t raw[6];
        if (!imu_read(QMI_AX_L, raw, 6)) continue;
        float a[3];
        for (int i = 0; i < 3; i++) a[i] = (int16_t)(raw[i * 2] | (raw[i * 2 + 1] << 8)) * (4.0f / 32768.0f);
        input_t in = { 1, IMU_SX * a[IMU_AX], IMU_SY * a[IMU_AY], IMU_SZ * a[IMU_AZ] };
        xQueueSend(input_q, &in, 0); /* full: a dropped sample costs nothing */
    }
}
#endif

/* ================================================================ chimes */
typedef struct { float f; int at, dur; float gain; } note_t;
static const note_t SOUNDS[][4] = {
    [HAL_SOUND_START] = { { 659, 0, 180, .5f }, { 880, 120, 250, .5f } },
    [HAL_SOUND_DONE] = { { 784, 0, 140, .5f }, { 988, 100, 140, .5f }, { 1319, 200, 350, .5f } },
    [HAL_SOUND_TICK] = { { 1175, 0, 90, .35f } },
    [HAL_SOUND_SOON] = { { 880, 0, 300, .5f }, { 659, 280, 400, .5f } },
    [HAL_SOUND_CHIME] = { { 784, 0, 350, .5f }, { 1047, 220, 600, .5f } }, /* the MyToki chime: G5 then C6 */
    [HAL_SOUND_BEDTIME] = { { 523, 0, 500, .35f }, { 392, 400, 800, .35f } },
    /* the morning alarm: a music-box phrase that loops every 2 s while it rings, soft, then a little
     * louder, then as loud as it gets (still softer than the chimes) */
    [HAL_SOUND_ALARM] = { { 523, 0, 600, .3f }, { 659, 220, 600, .3f }, { 784, 440, 600, .3f }, { 659, 660, 600, .3f } },
    [HAL_SOUND_ALARM_SOFT] = { { 523, 0, 600, .12f }, { 659, 220, 600, .12f }, { 784, 440, 600, .12f }, { 659, 660, 600, .12f } },
    [HAL_SOUND_ALARM_MID] = { { 523, 0, 600, .2f }, { 659, 220, 600, .2f }, { 784, 440, 600, .2f }, { 659, 660, 600, .2f } },
};

static volatile uint8_t volume_want = 55;   /* the pull-down's sound slider; the sound task applies it */
void hal_set_volume(uint8_t percent) { volume_want = percent > 100 ? 100 : percent; }

void hal_play(hal_sound_t s)
{
    if (sound_q && volume_want) xQueueSend(sound_q, &s, 0);
}

static void sound_task(void *arg)
{
    (void)arg;
    const int rate = 22050;
    esp_codec_dev_handle_t spk = bsp_audio_codec_speaker_init();
    if (!spk) { ESP_LOGW(TAG, "no speaker"); vTaskDelete(NULL); return; }
    uint8_t volume_now = 55;
    esp_codec_dev_set_out_vol(spk, volume_now);
    esp_codec_dev_sample_info_t fs = { .sample_rate = rate, .channel = 2, .bits_per_sample = 16 };
    esp_codec_dev_open(spk, &fs);
    const int max_ms = 1300;
    int16_t *pcm = heap_caps_malloc((size_t)rate * max_ms / 1000 * 2 * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    hal_sound_t s;
    for (;;) {
        if (xQueueReceive(sound_q, &s, portMAX_DELAY) != pdTRUE || !pcm || s >= sizeof SOUNDS / sizeof SOUNDS[0]) continue;
        if (volume_now != volume_want) { volume_now = volume_want; esp_codec_dev_set_out_vol(spk, volume_now); }
        if (!volume_now) continue;
        int end_ms = 0;
        for (int k = 0; k < 4; k++) if (SOUNDS[s][k].f > 0 && SOUNDS[s][k].at + SOUNDS[s][k].dur > end_ms) end_ms = SOUNDS[s][k].at + SOUNDS[s][k].dur;
        if (end_ms > max_ms) end_ms = max_ms;
        int n = rate * end_ms / 1000;
        for (int i = 0; i < n; i++) {
            float v = 0, t = (float)i / rate;
            for (int k = 0; k < 4; k++) {
                const note_t *nt = &SOUNDS[s][k];
                if (nt->f <= 0) continue;
                float lt = t - nt->at / 1000.0f, d = nt->dur / 1000.0f;
                if (lt < 0 || lt > d) continue;
                float env = lt < 0.015f ? lt / 0.015f : expf(-5.0f * (lt - 0.015f) / d);
                v += nt->gain * env * sinf(2 * 3.14159265f * nt->f * lt);
            }
            int16_t x = (int16_t)(v * 9000);
            pcm[i * 2] = x;
            pcm[i * 2 + 1] = x;
        }
        esp_codec_dev_write(spk, pcm, n * 2 * (int)sizeof(int16_t));
    }
}

/* ================================================================ button and motion into the app */
/* Runs in LVGL's task, which already holds the lock. */
static void input_timer(lv_timer_t *t)
{
    (void)t;
    input_t in;
    while (xQueueReceive(input_q, &in, 0) == pdTRUE) {
        if (in.kind == 0) mytoki_button();
        else mytoki_motion(in.x, in.y, in.z);
    }
}

/* ================================================================ start-up */
void hal_esp32_init(void)
{
#if CONFIG_PM_ENABLE
    /* the chip slows to 80 MHz and light-sleeps whenever every task is waiting; Wi-Fi keeps its
     * connection, waking for the access point's beacons. Not while a computer is on the USB port
     * (CONFIG_USJ_NO_AUTO_LS_ON_CONNECTION), so logs and flashing still work. */
    esp_pm_config_t pm = { .max_freq_mhz = 240, .min_freq_mhz = 80, .light_sleep_enable = true };
    esp_err_t pm_err = esp_pm_configure(&pm);
    if (pm_err != ESP_OK) ESP_LOGW(TAG, "power saving off: %s", esp_err_to_name(pm_err));
#endif
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
    nvs_open("mytoki", NVS_READWRITE, &nvs);
    setenv("TZ", CONFIG_MYTOKI_TIMEZONE, 1);
    tzset();
    /* the chip keeps its clock through a reset, so a demo start time is applied on every boot (and
     * stays: the server's Date doesn't move it) */
    clock_good = clock_is_set() || CONFIG_MYTOKI_DEMO_TIME[0];
    if (!clock_is_set() || CONFIG_MYTOKI_DEMO_TIME[0]) {
        clock_from_build();
        time_t now = time(NULL);
        struct tm tm;
        localtime_r(&now, &tm);
        ESP_LOGI(TAG, "clock starts at %02d:%02d (%s)", tm.tm_hour, tm.tm_min, CONFIG_MYTOKI_DEMO_TIME[0] ? "demo start time" : "build time");
    }
    net_q = xQueueCreate(16, sizeof(net_msg_t));
#ifdef CONFIG_MYTOKI_SOUND
    sound_q = xQueueCreate(4, sizeof(hal_sound_t));
#endif
    outbox_load();
    plan_cache_load();
    look_init();
}


void hal_esp32_start(void)
{
    input_q = xQueueCreate(32, sizeof(input_t));
    if (bsp_display_lock(-1) == ESP_OK) {
        input_tmr = lv_timer_create(input_timer, 5, NULL);
        bsp_display_unlock();
    }
    xTaskCreate(button_task, "mytoki-button", 4096, NULL, 5, NULL);
    xTaskCreate(net_task, "mytoki-net", 12288, NULL, 4, NULL);
    if (sound_q) xTaskCreate(sound_task, "mytoki-sound", 6144, NULL, 3, NULL);
#ifdef CONFIG_MYTOKI_IMU
    xTaskCreate(motion_task, "mytoki-motion", 3072, NULL, 4, NULL);
#endif
    /* last: the display's draw buffers took their internal RAM first (main.c), Wi-Fi gets the rest */
    wifi_start();
}
