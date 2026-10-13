/*
 * MyToki on the Waveshare ESP32-S3-Touch-AMOLED-1.75C.
 *
 * The board support package brings up the CO5300 AMOLED (466 x 466, QSPI), the CST9217
 * touch panel and LVGL; hal_esp32.c does Wi-Fi, the clock, storage, the button and sound.
 * Everything the child sees is device/app, the same code the simulator runs.
 */
#include "esp_log.h"
#include "bsp/esp-bsp.h"
#include "bsp/display.h"
#include "lvgl.h"
#include "mytoki.h"
#include "hal_esp32.h"

static const char *TAG = "mytoki";

void app_main(void)
{
    hal_esp32_init();

    lv_display_t *disp = bsp_display_start();
    if (!disp) {
        ESP_LOGE(TAG, "display did not start");
        return;
    }
    bsp_display_brightness_set(100);

    if (bsp_display_lock(-1) == ESP_OK) {
        mytoki_start();
        bsp_display_unlock();
    }
    hal_esp32_start(); /* button, network and sound tasks: they call into the app under the lock */
    ESP_LOGI(TAG, "running");
}
