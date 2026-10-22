#include "theme.h"
#include "icons.h"
#include <stdio.h>
#include <string.h>

lv_obj_t *ui_box(lv_obj_t *parent)
{
    lv_obj_t *o = lv_obj_create(parent);
    lv_obj_remove_style_all(o);
    lv_obj_remove_flag(o, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    return o;
}

lv_obj_t *ui_row(lv_obj_t *parent, int32_t gap)
{
    lv_obj_t *o = ui_box(parent);
    lv_obj_set_size(o, LV_SIZE_CONTENT, LV_SIZE_CONTENT);
    lv_obj_set_flex_flow(o, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(o, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(o, gap, 0);
    return o;
}

lv_obj_t *ui_label(lv_obj_t *parent, const lv_font_t *font, uint32_t color, const char *text)
{
    lv_obj_t *l = lv_label_create(parent);
    lv_obj_set_style_text_font(l, font, 0);
    lv_obj_set_style_text_color(l, COL(color), 0);
    lv_label_set_text(l, text ? text : "");
    return l;
}

int ui_label_fit(lv_obj_t *label, const lv_font_t *font, const lv_font_t *small, int32_t width, int max_lines)
{
    const char *t = lv_label_get_text(label);
    lv_label_set_long_mode(label, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_line_space(label, 0, 0);
    for (int k = 0; k < 2; k++) {
        const lv_font_t *f = k ? small : font;
        lv_point_t sz;
        lv_text_get_size(&sz, t, f, 0, 0, LV_COORD_MAX, LV_TEXT_FLAG_NONE);
        if (sz.x <= width) {
            lv_obj_set_style_text_font(label, f, 0);
            lv_obj_set_height(label, lv_font_get_line_height(f));
            return 1;
        }
    }
    /* lines: n of them stand n * (line + space) - space high */
    int32_t lh = lv_font_get_line_height(small), step = lh + UI_FIT_SPACE;
    lv_point_t sz;
    lv_text_get_size(&sz, t, small, 0, UI_FIT_SPACE, width, LV_TEXT_FLAG_NONE);
    int n = (int)((sz.y + UI_FIT_SPACE + step / 2) / step);
    if (n < 2) n = 2;
    if (n > max_lines) n = max_lines;
    lv_obj_set_style_text_font(label, small, 0);
    lv_obj_set_style_text_line_space(label, UI_FIT_SPACE, 0);
    lv_obj_set_height(label, n * step - UI_FIT_SPACE);
    return n;
}

void ui_set_text(lv_obj_t *label, const char *text)
{
    if (!label) return;
    if (!text) text = "";
    const char *cur = lv_label_get_text(label);
    if (cur && strcmp(cur, text) == 0) return;
    lv_label_set_text(label, text);
}

void ui_set_color(lv_obj_t *obj, uint32_t color)
{
    lv_color_t c = COL(color);
    if (lv_obj_check_type(obj, &lv_image_class)) {
        if (!lv_color_eq(lv_obj_get_style_image_recolor(obj, 0), c)) lv_obj_set_style_image_recolor(obj, c, 0);
    } else if (!lv_color_eq(lv_obj_get_style_text_color(obj, 0), c)) {
        lv_obj_set_style_text_color(obj, c, 0);
    }
}

lv_obj_t *ui_icon(lv_obj_t *parent, const char *name, int size, uint32_t color)
{
    lv_obj_t *img = lv_image_create(parent);
    lv_obj_set_style_image_recolor(img, COL(color), 0);
    lv_obj_set_style_image_recolor_opa(img, LV_OPA_COVER, 0);
    ui_icon_set(img, name, size);
    return img;
}

void ui_icon_set(lv_obj_t *img, const char *name, int size)
{
    const lv_image_dsc_t *d = icon_find(name, size);
    if (d && lv_image_get_src(img) != d) lv_image_set_src(img, d);
}

void ui_show(lv_obj_t *obj, bool show)
{
    if (!obj) return;
    if (show == lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN)) {
        if (show) lv_obj_remove_flag(obj, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
    }
}

void ui_style_card(lv_obj_t *obj, uint32_t bg, int32_t radius, uint32_t border, lv_opa_t border_opa)
{
    lv_obj_set_style_bg_color(obj, COL(bg), 0);
    lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(obj, radius, 0);
    if (border_opa) {
        lv_obj_set_style_border_width(obj, 1, 0);
        lv_obj_set_style_border_color(obj, COL(border), 0);
        lv_obj_set_style_border_opa(obj, border_opa, 0);
    }
}

void ui_fmt_time(char *buf, size_t n, int minutes)
{
    int h = (minutes / 60) % 24, m = minutes % 60;
    int h12 = h % 12 == 0 ? 12 : h % 12;
    snprintf(buf, n, "%d:%02d", h12, m);
}

const char *ui_ampm(int minutes) { return (minutes / 60) % 24 < 12 ? "am" : "pm"; }

void ui_fmt_clock(char *buf, size_t n, int minutes)
{
    char t[8];
    ui_fmt_time(t, sizeof t, minutes);
    snprintf(buf, n, "%s%s", t, minutes / 60 % 24 < 12 ? "am" : "pm");   /* "3:18pm" (Figma "MyToki 2 / Header") */
}
