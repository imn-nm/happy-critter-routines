#pragma once

/* Storage, time zone, Wi-Fi. Call before the display starts. */
void hal_esp32_init(void);

/* The tasks that call into the app (button, network, sound). Call after mytoki_start(). */
void hal_esp32_start(void);
