/* LVGL config for the browser simulator. Keep in step with
 * platform/esp32s3/sdkconfig.defaults so both builds draw the same. */
#ifndef LV_CONF_H
#define LV_CONF_H

#define LV_COLOR_DEPTH 16
#define LV_USE_STDLIB_MALLOC LV_STDLIB_CLIB
#define LV_USE_STDLIB_STRING LV_STDLIB_CLIB
#define LV_USE_STDLIB_SPRINTF LV_STDLIB_CLIB
#define LV_DEF_REFR_PERIOD 15
#define LV_DPI_DEF 200
#define LV_USE_OS LV_OS_NONE
#define LV_USE_LOG 1
#define LV_LOG_LEVEL LV_LOG_LEVEL_WARN
#define LV_LOG_PRINTF 1
#define LV_USE_ASSERT_NULL 1
#define LV_USE_ASSERT_MALLOC 1
#define LV_FONT_MONTSERRAT_14 1
#define LV_USE_FONT_COMPRESSED 1
#define LV_USE_CANVAS 1
#define LV_USE_FLEX 1
#define LV_USE_THEME_DEFAULT 0
#define LV_USE_SYSMON 0
#define LV_BUILD_EXAMPLES 0
#define LV_BUILD_DEMOS 0

#endif
