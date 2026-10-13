#pragma once
#include "lvgl.h"

/* The icon for an app task-icon key or a device icon name at `size` px (nearest size made).
 * Unknown names fall back to a star, the app's default. */
const lv_image_dsc_t *icon_find(const char *name, int size);
/* Whether a name or key has its own icon. */
bool icon_exists(const char *name);
