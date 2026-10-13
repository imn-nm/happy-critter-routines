/*
 * Playtime: five games around Biscuit in his den, opened from free time. Swipe left or right
 * to go back (a game -> the menu -> the day). Five minutes before the next thing it stops and
 * Biscuit says "See you later!".
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef void (*play_outfit_cb_t)(void);

void play_open(int32_t seconds_left, const char *next_title, const char *next_icon, const char *next_time, const char *pet_name, play_outfit_cb_t on_outfit);
/* Called every tick while open: play time left (free time minus the 5-minute get-ready). */
void play_set_time_left(int32_t seconds_left);
bool play_is_open(void);
void play_close(void);
