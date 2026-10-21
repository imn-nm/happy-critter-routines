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
#include "nvs.h"
#include "driver/gpio.h"
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
static void clock_from_http_date(const char *v)
{
    static const char *MON = "JanFebMarAprMayJunJulAugSepOctNovDec";
    char mon[4] = { 0 };
    struct tm t = { 0 };
    if (sscanf(v, "%*3s, %d %3s %d %d:%d:%d", &t.tm_mday, mon, &t.tm_year, &t.tm_hour, &t.tm_min, &t.tm_sec) != 6) return;
    const char *p = strstr(MON, mon);
    if (!p) return;
    t.tm_mon = (int)(p - MON) / 3;
    t.tm_year -= 1900;
    struct timeval tv = { .tv_sec = utc_mktime(&t) };
    settimeofday(&tv, NULL);
    ESP_LOGI(TAG, "clock set from the server: %s", v);
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
int hal_battery(void) { return 100; }
void hal_speak(const char *text) { ESP_LOGI(TAG, "say: %s", text); /* no voice on the board yet */ }
void hal_set_brightness(uint8_t percent) { bsp_display_brightness_set(percent < 5 ? 5 : percent); }

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

static esp_err_t on_http(esp_http_client_event_t *e)
{
    body_t *b = e->user_data;
    if (e->event_id == HTTP_EVENT_ON_HEADER && !strcasecmp(e->header_key, "Date") && !clock_is_set()) clock_from_http_date(e->header_value);
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

static int http(const char *url, const char *post, body_t *body)
{
    esp_http_client_config_t cfg = {
        .url = url,
        .event_handler = on_http,
        .user_data = body,
        .timeout_ms = 10000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .method = post ? HTTP_METHOD_POST : HTTP_METHOD_GET,
    };
    esp_http_client_handle_t c = esp_http_client_init(&cfg);
    if (!c) return -1;
    if (CONFIG_MYTOKI_DEVICE_TOKEN[0]) {
        char auth[160];
        snprintf(auth, sizeof auth, "Bearer %s", CONFIG_MYTOKI_DEVICE_TOKEN);
        esp_http_client_set_header(c, "Authorization", auth);
    }
    if (post) {
        esp_http_client_set_header(c, "Content-Type", "application/json");
        esp_http_client_set_post_field(c, post, (int)strlen(post));
    }
    esp_err_t err = esp_http_client_perform(c);
    int status = err == ESP_OK ? esp_http_client_get_status_code(c) : -1;
    esp_http_client_cleanup(c);
    return status;
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

static void outbox_flush(void)
{
    if (!CONFIG_MYTOKI_EVENTS_URL[0] || !wifi_up) return;
    bool changed = false;
    while (outbox_n) {
        int st = http(CONFIG_MYTOKI_EVENTS_URL, outbox[0], NULL);
        if (st < 200 || st >= 300) break;
        free(outbox[0]);
        memmove(outbox, outbox + 1, sizeof(char *) * (size_t)--outbox_n);
        changed = true;
    }
    if (changed) outbox_save();
}

static void fetch_day(void)
{
    if (!CONFIG_MYTOKI_DAY_URL[0]) {
        /* no server yet: the built-in demo day */
        with_lock_day(demo_day_start, (size_t)(demo_day_end - demo_day_start));
        return;
    }
    if (!CONFIG_MYTOKI_DEVICE_TOKEN[0]) { with_lock_fail(3); return; } /* not paired: the device shows its code */
    /* asked just after start-up: give Wi-Fi a moment to join before saying "Let's reconnect" */
    for (int i = 0; i < 100 && !wifi_up && CONFIG_MYTOKI_WIFI_SSID[0]; i++) vTaskDelay(pdMS_TO_TICKS(100));
    if (!wifi_up) { with_lock_fail(0); return; }
    body_t b = { 0 };
    int st = http(CONFIG_MYTOKI_DAY_URL, NULL, &b);
    if (st == 200 && b.buf) with_lock_day(b.buf, b.len);
    else {
        ESP_LOGW(TAG, "day plan: HTTP %d", st);
        with_lock_fail(st < 0 ? 0 : 1);
    }
    free(b.buf);
}

static void net_task(void *arg)
{
    (void)arg;
    net_msg_t m;
    for (;;) {
        if (xQueueReceive(net_q, &m, pdMS_TO_TICKS(20000)) == pdTRUE) {
            if (m.kind == 0) fetch_day();
            else if (m.json) {
                if (outbox_n == OUTBOX_MAX) { free(outbox[0]); memmove(outbox, outbox + 1, sizeof(char *) * (OUTBOX_MAX - 1)); outbox_n--; }
                outbox[outbox_n++] = m.json;
                outbox_save();
            }
        }
        outbox_flush();
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
    esp_sntp_config_t sntp = ESP_NETIF_SNTP_DEFAULT_CONFIG("pool.ntp.org");
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
        vTaskDelay(pdMS_TO_TICKS(10));
    }
}

/* ================================================================ motion */
#ifdef CONFIG_MYTOKI_IMU
#include "driver/i2c_master.h"

/* QMI8658 (QST), the dev board's 6-axis IMU; only the accelerometer is read. Register codes
 * from the datasheet; check them against the BSP's own qmi8658 component once ESP-IDF is here. */
#define QMI_ADDR 0x6B           /* 0x6A when SA0 is pulled low */
#define QMI_WHO_AM_I 0x00       /* reads 0x05 */
#define QMI_CTRL1 0x02          /* 0x40: address auto-increment */
#define QMI_CTRL2 0x03          /* 0x23: accel +-4 g, 100 Hz */
#define QMI_CTRL7 0x08          /* 0x01: accel on */
#define QMI_AX_L 0x35
/* Which sensor axis is the screen's x (right), y (12 o'clock), z (out of the screen), and its
 * sign: set on the bench by tilting the board and watching the log. */
#define IMU_AX 0
#define IMU_AY 1
#define IMU_AZ 2
#define IMU_SX 1
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
    imu_write(QMI_CTRL2, 0x23);
    imu_write(QMI_CTRL7, 0x01);
    ESP_LOGI(TAG, "motion: QMI8658 at 100 Hz");
    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(10));
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
static const note_t SOUNDS[][3] = {
    [HAL_SOUND_START] = { { 659, 0, 180, .5f }, { 880, 120, 250, .5f } },
    [HAL_SOUND_DONE] = { { 784, 0, 140, .5f }, { 988, 100, 140, .5f }, { 1319, 200, 350, .5f } },
    [HAL_SOUND_TICK] = { { 1175, 0, 90, .35f } },
    [HAL_SOUND_SOON] = { { 880, 0, 300, .5f }, { 659, 280, 400, .5f } },
    [HAL_SOUND_CHIME] = { { 784, 0, 350, .5f }, { 1047, 220, 600, .5f } }, /* the MyToki chime: G5 then C6 */
    [HAL_SOUND_BEDTIME] = { { 523, 0, 500, .35f }, { 392, 400, 800, .35f } },
};

void hal_play(hal_sound_t s)
{
    if (sound_q) xQueueSend(sound_q, &s, 0);
}

static void sound_task(void *arg)
{
    (void)arg;
    const int rate = 22050;
    esp_codec_dev_handle_t spk = bsp_audio_codec_speaker_init();
    if (!spk) { ESP_LOGW(TAG, "no speaker"); vTaskDelete(NULL); return; }
    esp_codec_dev_set_out_vol(spk, 55);
    esp_codec_dev_sample_info_t fs = { .sample_rate = rate, .channel = 2, .bits_per_sample = 16 };
    esp_codec_dev_open(spk, &fs);
    const int max_ms = 1300;
    int16_t *pcm = heap_caps_malloc((size_t)rate * max_ms / 1000 * 2 * sizeof(int16_t), MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    hal_sound_t s;
    for (;;) {
        if (xQueueReceive(sound_q, &s, portMAX_DELAY) != pdTRUE || !pcm || s >= sizeof SOUNDS / sizeof SOUNDS[0]) continue;
        int end_ms = 0;
        for (int k = 0; k < 3; k++) if (SOUNDS[s][k].f > 0 && SOUNDS[s][k].at + SOUNDS[s][k].dur > end_ms) end_ms = SOUNDS[s][k].at + SOUNDS[s][k].dur;
        if (end_ms > max_ms) end_ms = max_ms;
        int n = rate * end_ms / 1000;
        for (int i = 0; i < n; i++) {
            float v = 0, t = (float)i / rate;
            for (int k = 0; k < 3; k++) {
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
    esp_err_t err = nvs_flash_init();
    if (err == ESP_ERR_NVS_NO_FREE_PAGES || err == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        nvs_flash_erase();
        nvs_flash_init();
    }
    nvs_open("mytoki", NVS_READWRITE, &nvs);
    setenv("TZ", CONFIG_MYTOKI_TIMEZONE, 1);
    tzset();
    /* the chip keeps its clock through a reset, so a demo start time is applied on every boot */
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
}

void hal_esp32_start(void)
{
    input_q = xQueueCreate(32, sizeof(input_t));
    if (bsp_display_lock(-1) == ESP_OK) {
        lv_timer_create(input_timer, 5, NULL);
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
