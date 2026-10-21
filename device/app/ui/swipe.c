#include "swipe.h"
#include <stdlib.h>

#define MIN_DX 56          /* px across */
#define MAX_SLOPE 0.75f    /* |dy| / |dx|: mostly sideways */
#define MAX_MS 1500        /* a slow swipe still counts; a long drag doesn't */
#define FLICK_DY 70        /* a flick down: this far, this fast */
#define FLICK_MS 400
#define MAX_OWNERS 8
#define TAP_SLOP 24        /* px: a finger that travelled further was a drag, not a tap */

typedef struct { lv_obj_t *owner; swipe_cb_t cb; void *user; } entry_t;

static entry_t owners[MAX_OWNERS];
static swipe_cb_t base;
static int nowners;
static lv_point_t start;
static uint32_t start_ms;
static bool swallow;       /* a swipe happened, or the finger travelled: the press doesn't also count as a tap */
static bool scrolled;      /* a list took the finger: its flick up or down only scrolled it */

static int find(lv_obj_t *o)
{
    for (int i = 0; i < nowners; i++) if (owners[i].owner == o) return i;
    return -1;
}

static void forget(lv_event_t *e)
{
    int i = find(lv_event_get_target(e));
    if (i < 0) return;
    owners[i] = owners[--nowners];
}

void swipe_add(lv_obj_t *owner, swipe_cb_t cb, void *user)
{
    if (find(owner) >= 0 || nowners == MAX_OWNERS) return;
    owners[nowners++] = (entry_t){ owner, cb, user };
    lv_obj_add_event_cb(owner, forget, LV_EVENT_DELETE, NULL);
}

typedef struct { int dir; lv_point_t start; lv_obj_t *owner; } pending_t;
static pending_t pending;

/* The topmost visible screen on the top layer (NULL: nothing is open over the day). */
static lv_obj_t *topmost(void)
{
    lv_obj_t *top = lv_layer_top();
    for (int32_t i = (int32_t)lv_obj_get_child_count(top) - 1; i >= 0; i--) {
        lv_obj_t *c = lv_obj_get_child(top, i);
        if (!lv_obj_has_flag(c, LV_OBJ_FLAG_HIDDEN)) return c;
    }
    return NULL;
}

void swipe_set_base(swipe_cb_t cb) { base = cb; }
lv_point_t swipe_start(void) { return start; }

static swipe_drag_cb_t drag;
static bool dragging;      /* the press began on the day itself */
void swipe_set_drag(swipe_drag_cb_t cb) { drag = cb; }

/* After the input device has finished with the release. */
static void dispatch(void *unused)
{
    (void)unused;
    if (!pending.owner) { if (base) base(NULL, pending.dir, pending.start, NULL, true); return; }
    int k = find(pending.owner);
    if (k >= 0) owners[k].cb(owners[k].owner, pending.dir, pending.start, owners[k].user, true);
}

static void on_indev(lv_event_t *e)
{
    lv_event_code_t code = lv_event_get_code(e);
    lv_indev_t *indev = lv_event_get_target(e);
    if (code == LV_EVENT_PRESSED) {
        lv_indev_get_point(indev, &start);
        start_ms = lv_tick_get();
        swallow = false;
        scrolled = false;
        dragging = drag && !topmost();
    } else if (code == LV_EVENT_PRESSING) {
        if (lv_indev_get_scroll_obj(indev)) scrolled = true;
        if (!dragging) return;
        lv_point_t p;
        lv_indev_get_point(indev, &p);
        drag(p.x - start.x, p.y - start.y, false);
    } else if (code == LV_EVENT_PRESS_LOST) {
        if (dragging) { dragging = false; drag(0, 0, true); }
    } else if (code == LV_EVENT_RELEASED) {
        lv_point_t p;
        lv_indev_get_point(indev, &p);
        int32_t dx = p.x - start.x, dy = p.y - start.y;
        uint32_t ms = lv_tick_elaps(start_ms);
        if (dragging) { dragging = false; drag(dx, dy, true); }
        swallow = abs(dx) > TAP_SLOP || abs(dy) > TAP_SLOP;
        int dir;
        if (abs(dx) >= MIN_DX && abs(dy) <= abs(dx) * MAX_SLOPE && ms <= MAX_MS) dir = dx < 0 ? SWIPE_LEFT : SWIPE_RIGHT;
        else if (dy >= FLICK_DY && abs(dx) <= dy * MAX_SLOPE && ms <= FLICK_MS) dir = SWIPE_DOWN;
        else if (dy <= -FLICK_DY && abs(dx) <= -dy * MAX_SLOPE && ms <= FLICK_MS) dir = SWIPE_UP;
        else return;
        if (scrolled && (dir == SWIPE_UP || dir == SWIPE_DOWN)) return;
        lv_obj_t *top = topmost();
        if (top) {
            int k = find(top);
            if (k < 0 || !owners[k].cb(top, dir, start, owners[k].user, false)) return;
        } else if (!base || !base(NULL, dir, start, NULL, false)) {
            return;
        }
        swallow = true;
        pending = (pending_t){ dir, start, top };
        lv_indev_stop_processing(indev);
        lv_async_call(dispatch, NULL);
    } else if (swallow && (code == LV_EVENT_CLICKED || code == LV_EVENT_SHORT_CLICKED)) {
        lv_indev_stop_processing(indev); /* the button under the finger isn't tapped */
    }
}

void swipe_init(void)
{
    for (lv_indev_t *i = lv_indev_get_next(NULL); i; i = lv_indev_get_next(i))
        if (lv_indev_get_type(i) == LV_INDEV_TYPE_POINTER) lv_indev_add_event_cb(i, on_indev, LV_EVENT_ALL, NULL);
}
