/*
 * The carousel's side pages: Rewards (left of Home) and Chores (right of Home), as on the
 * Figma board 609:2719 (Rewards · 01 · Shop, Chores).
 */
#pragma once
#include "lvgl.h"
#include "../day.h"

typedef void (*page_cb_t)(int index);   /* reward tapped / chore ticked */

/* The shop: Biscuit's shelves with the rewards on them. Tapping one opens "Want this reward?". */
void rewards_page_create(lv_obj_t *page, page_cb_t on_tap);
/* stars: what the child has to spend (asked-for rewards already taken off). */
void rewards_page_render(const day_plan_t *p, int stars, bool picture);

void chores_page_create(lv_obj_t *page, page_cb_t on_done);
void chores_page_render(const day_plan_t *p, int now_min, bool picture);
/* Biscuit lives in his room along the bottom of the chores page: let him rest while it's off screen. */
void chores_page_visible(bool visible);
/* His scene on the chores page (to cheer when a chore is ticked). */
lv_obj_t *chores_page_pet(void);

/* The page is t screens from the middle of the carousel (0 at rest): the scene hangs back, the
 * header leads, so the turn has depth. */
void rewards_page_parallax(float t);
void chores_page_parallax(float t);

/* The icon name for a reward's key ("book", "movie", "surprise"). */
const char *reward_icon(const char *icon);
