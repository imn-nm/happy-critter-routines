#include "fx.h"
#include "wheel.h"
#include "theme.h"
#include "widgets.h"
#include "icons.h"
#include "../hal.h"
#include <math.h>
#include <string.h>
#include <ctype.h>
#include <stdio.h>

#define PI_F 3.14159265f
#define SIZE 300          /* the widget; the wheel is centred in it */
#define SLICE_R 133       /* Figma (2026-10-12): a 266 px wheel of dark slices inside the time ring */
#define ICON_R 88         /* a slice's icon, along its middle */
#define LABEL_R 63        /* its word */
#define HUB_RING_R 42     /* ink ring round the hub */
#define HUB_R 38          /* the lime Spin button */
#define MAXOPT 8

/* The icons' colours, clockwise from the top: Draw sky, Lego lavender, Read carrot, Outside mint,
 * Puzzle pink, Dance coral. More options go on in the same order. The slices themselves alternate
 * surface/line and surface/card. */
static const uint32_t COLORS[] = { 0x879BFF, 0xA89AF0, 0xF7945A, 0x65CDAA, 0xEAB5DE, 0xFF8F91, C_BUTTER, C_SKY };

typedef struct {
    char opt[MAXOPT][20];
    int n;
    float angle;          /* degrees the wheel has turned (clockwise) */
    int result;           /* -1 = not spun yet */
    bool spinning;
    wheel_result_cb_t cb;
    lv_obj_t *hub, *hub_label;
    /* the result card */
    lv_obj_t *card, *card_icon, *card_name, *card_line, *again;
    uint32_t flash_until;   /* the bulbs all blink after a spin */
} wheel_t;

uint32_t wheel_color(int i) { return COLORS[i % (int)(sizeof COLORS / sizeof COLORS[0])]; }

static bool has(const char *s, const char *w)
{
    char low[40];
    size_t i = 0;
    for (; s[i] && i < sizeof low - 1; i++) low[i] = (char)tolower((unsigned char)s[i]);
    low[i] = 0;
    return strstr(low, w) != NULL;
}

const char *wheel_icon_for(const char *o)
{
    if (has(o, "draw") || has(o, "paint") || has(o, "colo")) return "pencil";
    if (has(o, "lego") || has(o, "build") || has(o, "block")) return "brick";
    if (has(o, "read") || has(o, "book") || has(o, "story")) return "book";
    if (has(o, "outside") || has(o, "garden") || has(o, "park")) return "tree";
    if (has(o, "puzzle")) return "puzzle";
    if (has(o, "danc") || has(o, "music") || has(o, "sing")) return "music";
    if (has(o, "ball") || has(o, "soccer")) return "ball";
    if (has(o, "bubble")) return "bubble";
    if (has(o, "bake") || has(o, "cook")) return "meal";
    return "sparkles";
}

/* "Time to build!" */
static const char *invitation_for(const char *o)
{
    if (has(o, "draw") || has(o, "paint") || has(o, "colo")) return "Time to draw!";
    if (has(o, "lego") || has(o, "build") || has(o, "block")) return "Time to build!";
    if (has(o, "read") || has(o, "book") || has(o, "story")) return "Time for a story!";
    if (has(o, "outside") || has(o, "garden") || has(o, "park")) return "Let\xE2\x80\x99s go outside!";
    if (has(o, "puzzle")) return "Puzzle time!";
    if (has(o, "danc") || has(o, "music") || has(o, "sing")) return "Let\xE2\x80\x99s dance!";
    return "Let\xE2\x80\x99s do it!";
}

/* The slice under the pointer, given how far the wheel has turned. */
static int under_pointer(const wheel_t *w)
{
    float slice = 360.0f / w->n;
    float a = fmodf(-w->angle + slice / 2 + 3600.0f, 360.0f);
    return ((int)(a / slice)) % w->n;
}

static int32_t norm360(float a)
{
    int32_t v = (int32_t)lroundf(a) % 360;
    return v < 0 ? v + 360 : v;
}

static void dot(lv_layer_t *layer, float x, float y, float r, uint32_t c, lv_opa_t opa)
{
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.bg_color = COL(c);
    d.bg_opa = opa;
    d.radius = LV_RADIUS_CIRCLE;
    int32_t dia = (int32_t)lroundf(r * 2);
    lv_area_t a = { (int32_t)lroundf(x - r), (int32_t)lroundf(y - r), 0, 0 };
    a.x2 = a.x1 + dia - 1;
    a.y2 = a.y1 + dia - 1;
    lv_draw_rect(layer, &d, &a);
}

static void wheel_draw(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    wheel_t *w = lv_obj_get_user_data(obj);
    if (!w->n || (w->result >= 0 && !w->spinning)) return;   /* the result card is shown instead */
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t c;
    lv_obj_get_coords(obj, &c);
    const float cx = c.x1 + SIZE / 2.0f, cy = c.y1 + SIZE / 2.0f;
    const float slice = 360.0f / w->n;

    /* the slices: filled sectors (LVGL: 0 degrees = 3 o'clock), line and card by turns */
    for (int i = 0; i < w->n; i++) {
        float mid = i * slice + w->angle;
        lv_draw_arc_dsc_t a;
        lv_draw_arc_dsc_init(&a);
        a.center.x = (int32_t)lroundf(cx);
        a.center.y = (int32_t)lroundf(cy);
        a.color = COL(i % 2 == 0 ? C_LINE : C_GLASS);
        a.opa = LV_OPA_COVER;
        a.width = SLICE_R;
        a.radius = SLICE_R;
        a.rounded = 0;
        a.start_angle = norm360(mid - slice / 2 - 90);
        a.end_angle = norm360(mid + slice / 2 - 90);
        lv_draw_arc(layer, &a);
    }
    /* the seams between slices: 2 px of ink */
    for (int i = 0; i < w->n; i++) {
        float sa = (i * slice + w->angle - slice / 2) * PI_F / 180;
        lv_draw_line_dsc_t ln;
        lv_draw_line_dsc_init(&ln);
        ln.color = COL(C_INK);
        ln.width = 2;
        ln.round_start = ln.round_end = 1;
        ln.p1.x = cx + HUB_RING_R * sinf(sa);
        ln.p1.y = cy - HUB_RING_R * cosf(sa);
        ln.p2.x = cx + SLICE_R * sinf(sa);
        ln.p2.y = cy - SLICE_R * cosf(sa);
        lv_draw_line(layer, &ln);
    }
    /* the icon and word on each slice, upright */
    for (int i = 0; i < w->n; i++) {
        float ma = (i * slice + w->angle) * PI_F / 180;
        float ix = cx + ICON_R * sinf(ma), iy = cy - ICON_R * cosf(ma);
        lv_draw_image_dsc_t im;
        lv_draw_image_dsc_init(&im);
        im.src = icon_find(wheel_icon_for(w->opt[i]), 26);
        im.recolor = COL(wheel_color(i));
        im.recolor_opa = LV_OPA_COVER;
        lv_area_t ia = { (int32_t)ix - 13, (int32_t)iy - 13, (int32_t)ix + 12, (int32_t)iy + 12 };
        lv_draw_image(layer, &im, &ia);
        float lx = cx + LABEL_R * sinf(ma), ly = cy - LABEL_R * cosf(ma);
        lv_draw_label_dsc_t lb;
        lv_draw_label_dsc_init(&lb);
        lb.font = F_LABEL;
        lb.color = COL(C_BONE);
        lb.align = LV_TEXT_ALIGN_CENTER;
        lb.text = w->opt[i];
        lv_area_t la = { (int32_t)lx - 45, (int32_t)ly - 12, (int32_t)lx + 45, (int32_t)ly + 12 };
        lv_draw_label(layer, &lb, &la);
    }
    /* the ink ring round the hub (the hub itself is a child) */
    dot(layer, cx, cy, HUB_RING_R, C_INK, LV_OPA_COVER);
    /* the pointer: a lime triangle with an ink edge over the top of the wheel (Figma: 24 px at y 86) */
    lv_draw_triangle_dsc_t t;
    lv_draw_triangle_dsc_init(&t);
    t.color = COL(C_INK);
    t.opa = LV_OPA_COVER;
    t.p[0].x = cx - 16; t.p[0].y = cy - 149;
    t.p[1].x = cx + 16; t.p[1].y = cy - 149;
    t.p[2].x = cx;      t.p[2].y = cy - 119;
    lv_draw_triangle(layer, &t);
    t.color = COL(C_LIME);
    t.p[0].x = cx - 12; t.p[0].y = cy - 146;
    t.p[1].x = cx + 12; t.p[1].y = cy - 146;
    t.p[2].x = cx;      t.p[2].y = cy - 123;
    lv_draw_triangle(layer, &t);
}

static void spin_exec(void *obj, int32_t v)
{
    wheel_t *w = lv_obj_get_user_data(obj);
    w->angle = v / 10.0f;
    lv_obj_invalidate(obj);
}

/* Figma "Spin result": the chosen activity in a lavender-rimmed circle, with Spin again. */
static void show_result(wheel_t *w)
{
    bool decided = w->result >= 0 && !w->spinning;
    ui_show(w->hub, !decided);
    ui_show(w->card, decided);
    if (!decided) return;
    const char *opt = w->opt[w->result];
    ui_icon_set(w->card_icon, wheel_icon_for(opt), 40);
    char name[24];
    snprintf(name, sizeof name, "%s!", opt);
    ui_set_text(w->card_name, name);
    ui_set_text(w->card_line, invitation_for(opt));
}

static void flash_exec(void *var, int32_t v) { (void)v; lv_obj_invalidate(var); }

static void spin_done(lv_anim_t *a)
{
    lv_obj_t *obj = a->var;
    wheel_t *w = lv_obj_get_user_data(obj);
    w->spinning = false;
    w->result = under_pointer(w);
    show_result(w);
    lv_obj_invalidate(obj);
    hal_play(HAL_SOUND_DONE);
    fx_spring(w->card, 0);
    int32_t cx = lv_obj_get_x(obj) + lv_obj_get_width(obj) / 2, cy = lv_obj_get_y(obj) + lv_obj_get_height(obj) / 2;
    fx_burst_cfg_t cfg = { .waves = 2, .wave_r0 = 40, .wave_span = 190 };
    fx_burst_create(lv_obj_get_parent(obj), cx, cy, &cfg);
    fx_confetti(lv_obj_get_parent(obj), cx, cy, 40, FX_PARTY, 6, 200);
    w->flash_until = lv_tick_get() + 1400;
    lv_anim_t fa;
    lv_anim_init(&fa);
    lv_anim_set_var(&fa, obj);
    lv_anim_set_exec_cb(&fa, flash_exec);
    lv_anim_set_values(&fa, 0, 100);
    lv_anim_set_duration(&fa, 1400);
    lv_anim_start(&fa);
    if (w->cb) w->cb(w->result);
}

static void on_hub(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_user_data(e);
    wheel_t *w = lv_obj_get_user_data(obj);
    if (w->spinning || !w->n) return;
    int target = (int)(hal_random() % (uint32_t)w->n);
    float slice = 360.0f / w->n;
    /* land the target's centre under the pointer after 3 to 4 whole turns */
    float base = w->angle - fmodf(w->angle, 360.0f);
    float end = base + 360.0f * (3 + (int)(hal_random() % 2)) - target * slice;
    end += ((int)(hal_random() % 60) - 30) / 100.0f * slice;
    w->spinning = true;
    w->result = -1;
    show_result(w);
    hal_play(HAL_SOUND_TICK);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, obj);
    lv_anim_set_exec_cb(&a, spin_exec);
    lv_anim_set_values(&a, (int32_t)(w->angle * 10), (int32_t)(end * 10));
    lv_anim_set_duration(&a, 3200);
    lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
    lv_anim_set_completed_cb(&a, spin_done);
    lv_anim_start(&a);
}

static void on_again(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_user_data(e);
    wheel_t *w = lv_obj_get_user_data(obj);
    w->result = -1;
    show_result(w);
    lv_obj_invalidate(obj);
    on_hub(e);
}

static void on_delete(lv_event_t *e)
{
    lv_obj_t *obj = lv_event_get_target(e);
    lv_anim_delete(obj, spin_exec);
    lv_free(lv_obj_get_user_data(obj));
}

lv_obj_t *wheel_create(lv_obj_t *parent, wheel_result_cb_t cb)
{
    lv_obj_t *obj = ui_box(parent);
    lv_obj_set_size(obj, SIZE, SIZE);
    wheel_t *w = lv_malloc_zeroed(sizeof(wheel_t));
    w->result = -1;
    w->cb = cb;
    lv_obj_set_user_data(obj, w);
    lv_obj_add_event_cb(obj, wheel_draw, LV_EVENT_DRAW_MAIN, NULL);
    lv_obj_add_event_cb(obj, on_delete, LV_EVENT_DELETE, NULL);

    /* the lime Spin hub (Figma: 76 px, "Spin" in Button 18 navy) */
    w->hub = ui_box(obj);
    lv_obj_set_size(w->hub, HUB_R * 2, HUB_R * 2);
    lv_obj_center(w->hub);
    ui_style_card(w->hub, C_LIME, LV_RADIUS_CIRCLE, 0, 0);
    lv_obj_set_style_bg_color(w->hub, COL(C_BONE), LV_STATE_PRESSED);
    lv_obj_add_flag(w->hub, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(w->hub, 6);
    lv_obj_add_event_cb(w->hub, on_hub, LV_EVENT_CLICKED, obj);
    w->hub_label = ui_label(w->hub, F_BUTTON, C_NAVY, "Spin");
    lv_obj_center(w->hub_label);

    /* the result card: a 256 px circle, card colour, lavender rim */
    w->card = ui_box(obj);
    lv_obj_set_size(w->card, 256, 256);
    lv_obj_center(w->card);
    ui_style_card(w->card, C_GLASS, LV_RADIUS_CIRCLE, C_LAVENDER, LV_OPA_COVER);
    lv_obj_set_style_border_width(w->card, 2, 0);
    w->card_icon = ui_icon(w->card, "brick", 40, C_LAVENDER);
    lv_obj_align(w->card_icon, LV_ALIGN_TOP_MID, 0, 34);
    w->card_name = ui_label(w->card, F_DISPLAY, C_BONE, "");
    lv_obj_set_width(w->card_name, 210);
    lv_obj_set_style_text_align(w->card_name, LV_TEXT_ALIGN_CENTER, 0);
    lv_label_set_long_mode(w->card_name, LV_LABEL_LONG_DOT);
    lv_obj_align(w->card_name, LV_ALIGN_TOP_MID, 0, 98);
    w->card_line = ui_label(w->card, F_BODY_P, C_MUTED, "");
    lv_obj_set_width(w->card_line, 210);
    lv_obj_set_style_text_align(w->card_line, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_align(w->card_line, LV_ALIGN_TOP_MID, 0, 134);
    w->again = ui_box(w->card);
    lv_obj_set_size(w->again, 60, 60);
    lv_obj_align(w->again, LV_ALIGN_TOP_MID, 0, 168);
    lv_obj_set_style_radius(w->again, LV_RADIUS_CIRCLE, 0);
    lv_obj_set_style_border_width(w->again, 2, 0);
    lv_obj_set_style_border_color(w->again, COL(C_LIME), 0);
    lv_obj_set_style_border_opa(w->again, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(w->again, COL(C_LINE), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(w->again, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_add_flag(w->again, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_set_ext_click_area(w->again, 8);
    lv_obj_add_event_cb(w->again, on_again, LV_EVENT_CLICKED, obj);
    lv_obj_t *re = ui_icon(w->again, "retry", 20, C_LIME);
    lv_obj_center(re);
    show_result(w);
    return obj;
}

void wheel_set_options(lv_obj_t *obj, const char options[][20], int n)
{
    wheel_t *w = lv_obj_get_user_data(obj);
    if (n > MAXOPT) n = MAXOPT;
    bool same = n == w->n;
    for (int i = 0; same && i < n; i++) same = !strcmp(w->opt[i], options[i]);
    if (same) return;
    w->n = n;
    for (int i = 0; i < n; i++) { strncpy(w->opt[i], options[i], 19); w->opt[i][19] = 0; }
    w->result = -1;
    w->angle = 0;
    show_result(w);
    lv_obj_invalidate(obj);
}

void wheel_reset(lv_obj_t *obj)
{
    wheel_t *w = lv_obj_get_user_data(obj);
    if (w->spinning) return;
    w->result = -1;
    show_result(w);
    lv_obj_invalidate(obj);
}

int wheel_result(lv_obj_t *obj)
{
    wheel_t *w = lv_obj_get_user_data(obj);
    return w->spinning ? -1 : w->result;
}
