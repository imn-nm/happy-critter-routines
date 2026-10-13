/*
 * Playtime: eight games around Biscuit in his den, opened from free time, on two pages (the
 * five tapping games, then the three motion games). Swipe left for the second page and right
 * for the first; a game swipes back to the menu; swiping right from the first page leaves.
 * Five minutes before the next thing it stops and Biscuit says "See you later!".
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
/* The hardware button while Playtime is open (Biscuit says: "Button"; the goodbye: close). */
void play_button(void);
