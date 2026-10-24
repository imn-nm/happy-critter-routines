#pragma once
#include "esp_lcd_panel_io.h"

/* Storage, time zone, Wi-Fi. Call before the display starts. */
void hal_esp32_init(void);

/* The tasks that call into the app (button, network, sound). Call after mytoki_start(). */
void hal_esp32_start(void);

/* The panel's command line, so the screen can put the panel itself to sleep while it's dark. */
void hal_esp32_set_panel_io(esp_lcd_panel_io_handle_t io);
