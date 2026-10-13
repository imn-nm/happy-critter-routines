#include "icons.h"
#include "../assets/icons/icons_data.h"
#include <stdlib.h>
#include <string.h>

static const char *resolve(const char *name)
{
    for (int i = 0; i < icon_alias_count; i++)
        if (strcmp(icon_aliases[i].key, name) == 0) return icon_aliases[i].name;
    return name;
}

static const lv_image_dsc_t *find(const char *name, int size)
{
    const lv_image_dsc_t *best = NULL;
    int best_d = 1 << 20;
    for (int i = 0; i < icon_table_count; i++) {
        if (strcmp(icon_table[i].name, name) != 0) continue;
        int d = abs(icon_table[i].size - size);
        if (d < best_d) { best_d = d; best = icon_table[i].img; }
        if (!d) break;
    }
    return best;
}

const lv_image_dsc_t *icon_find(const char *name, int size)
{
    if (!name || !*name) name = "star-line";
    /* an app task-icon key first ("smile" is the toothbrush), then a device icon name */
    const lv_image_dsc_t *d = find(resolve(name), size);
    if (!d) d = find(name, size);
    if (!d) d = find("star-line", size);
    return d;
}

bool icon_exists(const char *name)
{
    return name && (find(name, 16) || find(resolve(name), 16));
}
