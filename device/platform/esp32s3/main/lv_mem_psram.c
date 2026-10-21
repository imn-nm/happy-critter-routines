/*
 * LVGL's allocator on the board (CONFIG_LV_USE_CUSTOM_MALLOC): PSRAM first, internal RAM only
 * when PSRAM is full. With plain malloc every object, style and label went to internal RAM
 * first (malloc keeps blocks under 16 KB internal), and building the screens left a few bytes
 * for the display's and the speaker's DMA. The simulator keeps LVGL's C-library allocator.
 */
#include "esp_heap_caps.h"
#include "lvgl.h"

#define PSRAM_FIRST 2, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT, MALLOC_CAP_DEFAULT

void lv_mem_init(void) {}
void lv_mem_deinit(void) {}

lv_mem_pool_t lv_mem_add_pool(void *mem, size_t bytes)
{
    LV_UNUSED(mem);
    LV_UNUSED(bytes);
    return NULL;
}

void lv_mem_remove_pool(lv_mem_pool_t pool) { LV_UNUSED(pool); }

void *lv_malloc_core(size_t size) { return heap_caps_malloc_prefer(size, PSRAM_FIRST); }
void *lv_realloc_core(void *p, size_t new_size) { return heap_caps_realloc_prefer(p, new_size, PSRAM_FIRST); }
void lv_free_core(void *p) { heap_caps_free(p); }

void lv_mem_monitor_core(lv_mem_monitor_t *mon_p) { LV_UNUSED(mon_p); }
lv_result_t lv_mem_test_core(void) { return LV_RESULT_OK; }
