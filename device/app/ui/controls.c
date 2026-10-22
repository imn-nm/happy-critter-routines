#include "controls.h"
#include "theme.h"
#include "widgets.h"
#include "swipe.h"
#include <stdio.h>

/* Not in Figma yet; made of the MyToki 2 parts: solid black over everything, the battery in a pill at
 * the top, two tall rounded sliders that fill lime from the bottom (an icon at their foot, a word
 * under them), and "Swipe up to close" over a little handle. */
#define OPEN_DY 110          /* pulled further than this, it stays down */
#define TRACK_W 120
#define TRACK_H 224
#define TRACK_Y 104
#define TRACK_GAP 32
#define TRACK_ICON 36
#define LABEL_Y (TRACK_Y + TRACK_H + 12)

typedef struct { lv_obj_t *track, *icon; int value, min; bool icon_dark; } slider_t;

static controls_get_t get_cb;
static controls_set_t set_cb;
static lv_obj_t *ctl;
static pill_t bat;
static slider_t bright, sound;
static controls_values_t vals;

void controls_init(controls_get_t get, controls_set_t set)
{
    get_cb = get;
    set_cb = set;
}

bool controls_is_open(void) { return ctl != NULL; }

/* ---- a slider: the track, the lime fill from the bottom (flat on top), the icon ---- */
static void slider_draw(lv_event_t *e)
{
    slider_t *s = lv_event_get_user_data(e);
    lv_layer_t *layer = lv_event_get_layer(e);
    lv_area_t a;
    lv_obj_get_coords(s->track, &a);
    lv_draw_rect_dsc_t d;
    lv_draw_rect_dsc_init(&d);
    d.radius = TRACK_W / 2;
    d.bg_color = COL(C_RAISED);
    d.bg_opa = LV_OPA_COVER;
    lv_draw_rect(layer, &d, &a);
    int32_t h = lv_area_get_height(&a) * s->value / 100;
    if (h <= 0) return;
    /* the same rounded shape in lime, cut off at the fill's top: flat there, round at the foot */
    lv_area_t keep = layer->_clip_area, clip = keep;
    if (clip.y1 < a.y2 - h + 1) clip.y1 = a.y2 - h + 1;
    if (clip.y1 > clip.y2) return;
    layer->_clip_area = clip;
    d.bg_color = COL(C_ACTION);
    lv_draw_rect(layer, &d, &a);
    layer->_clip_area = keep;
}

/* the icon sits in the lime once the fill covers it: dark there, light on the bare track */
static void slider_icon(slider_t *s)
{
    bool dark = s->value * TRACK_H / 100 >= 28 + TRACK_ICON;
    if (dark == s->icon_dark) return;
    s->icon_dark = dark;
    ui_set_color(s->icon, dark ? C_ON_COLOR : C_TEXT);
}

static void slider_set(slider_t *s, int v)
{
    if (v < s->min) v = s->min;
    if (v > 100) v = 100;
    if (v == s->value) return;
    s->value = v;
    slider_icon(s);
    lv_obj_invalidate(s->track);
}

/* A finger on it sets it where it is: the top full, the foot empty (or its least). */
static void slider_touch(lv_event_t *e)
{
    lv_event_code_t c = lv_event_get_code(e);
    if (c != LV_EVENT_PRESSED && c != LV_EVENT_PRESSING && c != LV_EVENT_RELEASED && c != LV_EVENT_PRESS_LOST) return;
    slider_t *s = lv_event_get_user_data(e);
    lv_indev_t *in = lv_indev_active();
    if (in && c != LV_EVENT_PRESS_LOST) {
        lv_point_t p;
        lv_indev_get_point(in, &p);
        lv_area_t a;
        lv_obj_get_coords(s->track, &a);
        slider_set(s, (int)((a.y2 - p.y) * 100 / lv_area_get_height(&a)));
    }
    vals.brightness = bright.value;
    vals.volume = sound.value;
    if (set_cb) set_cb(&vals, c == LV_EVENT_RELEASED || c == LV_EVENT_PRESS_LOST);
}

static void slider_create(slider_t *s, int32_t x, const char *icon, const char *word, int value, int min)
{
    s->min = min;
    s->value = value < min ? min : value > 100 ? 100 : value;
    s->icon_dark = false;
    s->track = ui_box(ctl);
    lv_obj_set_size(s->track, TRACK_W, TRACK_H);
    lv_obj_set_pos(s->track, x, TRACK_Y);
    lv_obj_add_flag(s->track, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(s->track, slider_draw, LV_EVENT_DRAW_MAIN, s);
    lv_obj_add_event_cb(s->track, slider_touch, LV_EVENT_ALL, s);
    s->icon = ui_icon(s->track, icon, TRACK_ICON, C_TEXT);
    lv_obj_align(s->icon, LV_ALIGN_BOTTOM_MID, 0, -28);
    slider_icon(s);
    lv_obj_t *l = ui_label(ctl, F_DETAIL, C_TEXT_MUTED, word);
    lv_obj_set_width(l, TRACK_W + TRACK_GAP);
    lv_obj_set_style_text_align(l, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_pos(l, x - TRACK_GAP / 2, LABEL_Y);
}

static bool on_slider(lv_point_t p)
{
    const slider_t *ss[] = { &bright, &sound };
    for (int i = 0; i < 2; i++) {
        lv_area_t a;
        lv_obj_get_coords(ss[i]->track, &a);
        if (p.x >= a.x1 && p.x <= a.x2 && p.y >= a.y1 && p.y <= a.y2) return true;
    }
    return false;
}

/* ---- the battery ---- */
static void battery_pill(void)
{
    char t[24];
    if (vals.charging) snprintf(t, sizeof t, "%d%% \xC2\xB7 Charging", vals.battery);
    else snprintf(t, sizeof t, "%d%%", vals.battery);
    pill_tone_t tone = vals.charging ? PILL_DONE : vals.battery <= 20 ? PILL_LATE : PILL_CALM;
    pill_set(&bat, tone, vals.charging ? "charging" : "battery", t);
    lv_obj_update_layout(bat.root);
    lv_obj_align(bat.root, LV_ALIGN_TOP_MID, 0, 42);
}

void controls_battery(int battery, bool charging)
{
    if (!ctl || (battery == vals.battery && charging == vals.charging)) return;
    vals.battery = battery;
    vals.charging = charging;
    battery_pill();
}

/* ---- in and out ---- */
static void ty_exec(void *o, int32_t v) { lv_obj_set_style_translate_y(o, v, 0); }
static void gone(lv_anim_t *a) { lv_obj_delete(a->var); }

static void slide_to(int32_t to, bool close)
{
    lv_anim_delete(ctl, ty_exec);
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, ctl);
    lv_anim_set_exec_cb(&a, ty_exec);
    lv_anim_set_values(&a, lv_obj_get_style_translate_y(ctl, 0), to);
    lv_anim_set_duration(&a, close ? 220 : 280);
    lv_anim_set_path_cb(&a, close ? lv_anim_path_ease_in : ui_path_out);
    if (close) {
        lv_anim_set_completed_cb(&a, gone);
        ctl = NULL;   /* gone as far as anyone asks; deleted when it's off the screen */
    }
    lv_anim_start(&a);
}

void controls_close(void)
{
    if (ctl) slide_to(-SCREEN_H, true);
}

static bool ctl_swipe(lv_obj_t *owner, int dir, lv_point_t start, void *user, bool commit)
{
    (void)owner; (void)user;
    if (dir == SWIPE_DOWN || on_slider(start)) return false;   /* up and down on a slider moves it */
    if (commit) controls_close();
    return true;
}

static void on_backdrop(lv_event_t *e)
{
    (void)e;
    controls_close();   /* a tap off the sliders */
}

static void build(void)
{
    if (get_cb) get_cb(&vals);
    ctl = ui_box(lv_layer_top());
    lv_obj_set_size(ctl, SCREEN_W, SCREEN_H);
    lv_obj_set_style_bg_color(ctl, COL(C_SCREEN), 0);
    lv_obj_set_style_bg_opa(ctl, LV_OPA_COVER, 0);   /* solid: nothing of the screen under it shows through the words */
    lv_obj_add_flag(ctl, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(ctl, on_backdrop, LV_EVENT_CLICKED, NULL);
    lv_obj_set_style_translate_y(ctl, -SCREEN_H, 0);
    swipe_add(ctl, ctl_swipe, NULL);

    pill_create(ctl, &bat);
    battery_pill();
    int32_t x0 = CENTER - TRACK_GAP / 2 - TRACK_W;
    slider_create(&bright, x0, "sun", "Brightness", vals.brightness, CONTROLS_BRIGHT_MIN);
    slider_create(&sound, CENTER + TRACK_GAP / 2, "volume", "Sound", vals.volume, 0);

    lv_obj_t *hint = ui_label(ctl, F_DETAIL, C_TEXT_MUTED, "Swipe up to close");
    lv_obj_align(hint, LV_ALIGN_TOP_MID, 0, LABEL_Y + 42);
    lv_obj_t *handle = ui_box(ctl);
    lv_obj_set_size(handle, 44, 5);
    lv_obj_set_style_radius(handle, 3, 0);
    lv_obj_set_style_bg_color(handle, COL(C_CHIP), 0);
    lv_obj_set_style_bg_opa(handle, LV_OPA_COVER, 0);
    lv_obj_align(handle, LV_ALIGN_TOP_MID, 0, LABEL_Y + 84);
}

void controls_pull(int32_t dy, bool end)
{
    if (!end) {
        if (!ctl) build();
        lv_anim_delete(ctl, ty_exec);
        int32_t ty = dy - SCREEN_H;
        lv_obj_set_style_translate_y(ctl, ty > 0 ? 0 : ty, 0);
        return;
    }
    if (!ctl) return;
    if (dy >= OPEN_DY) slide_to(0, false);
    else controls_close();
}
