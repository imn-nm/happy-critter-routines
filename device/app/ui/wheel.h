/*
 * The free-time wheel (Figma "Free time · Spin"): a game-show wheel of six solid slices, a rim
 * of bulbs that chase while it turns, a lime pointer at the top and a lime Spin hub. After the
 * spin the wheel gives way to the chosen activity (Figma "Spin result"): its icon, its name,
 * an invitation, and a round "Spin again".
 */
#pragma once
#include "lvgl.h"

typedef void (*wheel_result_cb_t)(int index);

lv_obj_t *wheel_create(lv_obj_t *parent, wheel_result_cb_t on_result);
void wheel_set_options(lv_obj_t *wheel, const char options[][20], int n);
/* Back to "Spin" (a new free-time window). */
void wheel_reset(lv_obj_t *wheel);
int wheel_result(lv_obj_t *wheel);
/* The younger child's wheel (Figma "Wheel · Pictures"): the pictures alone (34), the go arrow in the
 * hub, and Spin again as its picture alone. */
void wheel_set_pictures(lv_obj_t *wheel, bool pictures);
/* The icon and colour the wheel uses for an option ("Lego" -> brick, lavender). */
const char *wheel_icon_for(const char *option);
uint32_t wheel_color(int index);
