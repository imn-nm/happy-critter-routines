/*
 * MyToki on the Waveshare ESP32-S3-Touch-AMOLED-1.75C.
 *
 * The board support package brings up the CO5300 AMOLED (466 x 466, QSPI) and the CST9217
 * touch panel; display_start() hands them to LVGL. hal_esp32.c does Wi-Fi, the clock,
 * storage, the button, motion and sound.
 * Everything the child sees is device/app, the same code the simulator runs.
 */
#include "esp_log.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "bsp/touch.h"
#include "esp_lv_adapter.h"
#include "lvgl.h"
#include "mytoki.h"
#include "hal_esp32.h"

static const char *TAG = "mytoki";

/* Rows per draw buffer (two of them, ~60 KB each). They live in internal RAM so the SPI driver
 * sends them straight to the panel: from PSRAM it needs 64-byte aligned chunks, which 466 px rows
 * never are, and copies each into a fresh internal buffer that soon can't be found. Bigger is
 * faster (LVGL redoes its bookkeeping for every strip): 64 rows draw a full frame in 8 strips. */
#define DRAW_ROWS 64

/* The CO5300 takes areas that start on an even pixel and end on an odd one. */
static void round_area(lv_event_t *e)
{
    lv_area_t *a = lv_event_get_param(e);
    a->x1 &= ~1;
    a->y1 &= ~1;
    a->x2 |= 1;
    a->y2 |= 1;
}

/* bsp_display_start() with our own draw buffers (the BSP's are 50 rows in PSRAM, see DRAW_ROWS)
 * and a bigger LVGL task: the whole app runs in it (the tick, the button, motion, Biscuit's
 * drawing), not just LVGL's own work. */
static lv_display_t *display_start(void)
{
    esp_lv_adapter_config_t adapter = ESP_LV_ADAPTER_DEFAULT_CONFIG();
    adapter.task_stack_size = 16 * 1024;
    if (esp_lv_adapter_init(&adapter) != ESP_OK) return NULL;

    const bsp_display_config_t panel_cfg = { .max_transfer_sz = BSP_LCD_H_RES * BSP_LCD_V_RES * BSP_LCD_BITS_PER_PIXEL / 8 };
    esp_lcd_panel_handle_t panel = NULL;
    esp_lcd_panel_io_handle_t io = NULL;
    if (bsp_display_new(&panel_cfg, &panel, &io) != ESP_OK) return NULL;

    esp_lv_adapter_display_config_t disp_cfg = {
        .panel = panel,
        .panel_io = io,
        .profile = {
            .interface = ESP_LV_ADAPTER_PANEL_IF_OTHER,
            .rotation = ESP_LV_ADAPTER_ROTATE_0,
            .hor_res = BSP_LCD_H_RES,
            .ver_res = BSP_LCD_V_RES,
            .buffer_height = DRAW_ROWS,
            .use_psram = false,
            .enable_ppa_accel = false,
            .require_double_buffer = true,
        },
        .tear_avoid_mode = ESP_LV_ADAPTER_TEAR_AVOID_MODE_NONE,
    };
    lv_display_t *disp = esp_lv_adapter_register_display(&disp_cfg);
    if (!disp) return NULL;
    lv_display_add_event_cb(disp, round_area, LV_EVENT_INVALIDATE_AREA, NULL);

    const bsp_display_cfg_t touch_cfg = { .touch_flags = { .swap_xy = 0, .mirror_x = 1, .mirror_y = 1 } };
    esp_lcd_touch_handle_t tp = NULL;
    if (bsp_touch_new(&touch_cfg, &tp) != ESP_OK) return NULL;
    const esp_lv_adapter_touch_config_t tc = ESP_LV_ADAPTER_TOUCH_DEFAULT_CONFIG(disp, tp);
    if (!esp_lv_adapter_register_touch(&tc)) return NULL;

    bsp_display_brightness_init();
    if (esp_lv_adapter_start() != ESP_OK) return NULL;
    return disp;
}

void app_main(void)
{
    hal_esp32_init();

    lv_display_t *disp = display_start();
    if (!disp) {
        ESP_LOGE(TAG, "display did not start");
        return;
    }

    if (bsp_display_lock(-1) == ESP_OK) {
        mytoki_start();
        bsp_display_unlock();
    }
    hal_esp32_start(); /* button, motion, network and sound tasks, then Wi-Fi */
    ESP_LOGI(TAG, "running");
}
