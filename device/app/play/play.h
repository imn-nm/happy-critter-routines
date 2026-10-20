/*
 * Playtime: seven games, opened from free time, on two pages (the four tapping games, then the
 * three motion games). My pet (play_open_pet) is not a game: a long tap on the pet opens it any
 * time, to pick the character and its colour and to dress it up. Swipe left for the second page
 * and right for the first; a game swipes back to the menu; swiping right from the first page leaves.
 * Five minutes before the next thing it stops and Biscuit says "See you later!".
 */
#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef void (*play_outfit_cb_t)(void);
/* The child picked a character or colour (pet_get_character has it). */
typedef void (*play_character_cb_t)(void);

void play_open(int32_t seconds_left, const char *next_title, const char *next_icon, const char *next_time, const char *pet_name,
               play_outfit_cb_t on_outfit, play_character_cb_t on_character);
/* Called every tick while open: play time left (free time minus the 5-minute get-ready). */
void play_set_time_left(int32_t seconds_left);
/* The whole play time (for the timer round the rim); call after play_open. */
void play_set_time_total(int32_t seconds);
/* My pet: choose the buddy and dress it up (a long tap on the pet, any time). */
void play_open_pet(const char *pet_name, play_outfit_cb_t on_outfit, play_character_cb_t on_character);
bool play_is_open(void);
/* The games menu is showing (not a game, My pet or See you later). */
bool play_in_menu(void);
void play_close(void);
/* The hardware button while Playtime is open (Biscuit says: "Button"; the goodbye: close). */
void play_button(void);
