# Streaks

"Stay in bed 5 nights in a row → ★ 5." A parent picks a habit, how many days
in a row, and the stars it pays. Each day they answer once on their phone.
The child watches star beads fill up on the round screen, and the last one,
the big star, pays the stars.

## Parent (phone)

- **Set up** (parent home → Streaks → New, or a child's page → ••• → Streaks):
  pick a picture tile (Stay in bed, Dry night, Brush teeth, Use the potty,
  Try veggies, Get dressed, Kind hands, Tidy up) or type your own, then choose
  how many days in a row (3 · 5 · 7 · 10) and the stars at the end (defaults
  to the number of days). A live round preview shows what the child will see.
  With two or more children, one sheet can start the same streak for each.
- **Check in** (parent home): one card per streak with **Yes** / **Not this
  time**. Night streaks ask about "Last night" and start the morning after
  they're made; day streaks ask about "Today". **Undo** clears the answer.
- Finishing a round shows a toast ("Maya did it! 5 nights in a row… ★ 5
  added"). Tap a card to edit, pause or delete it.

## Rules (the database decides)

`settle_streak()` in `supabase/migrations/20260930040000_streaks.sql` replays
the answers in date order:

| Answer | Beads |
|---|---|
| Yes | +1 bead |
| Yes that reaches the target | pays `reward_stars`, beads go back to 0, `rounds_completed` +1 |
| Not this time | beads go back to 0 (no stars move) |
| No answer that day | nothing: the streak just waits |

- Stars move by the difference from what each day already paid, so answering
  twice changes nothing and an undo or a corrected answer takes back or pays
  exactly what changed. The balance never goes below 0.
- Changing the days or the stars settles every answer before the current
  run of beads (`counting_from`), so rounds already paid are never re-priced.
  Lowering the target below the beads showing finishes the round right away.
- `mark_streak_day(streak, date, kept)` is the only way answers are written;
  `kept = null` is undo. Errors: `streak_not_found`, `streak_paused`,
  `day_settled`, `day_in_future`.
- Dates are the family's Pacific date, like the rest of the app.

Tests: `scripts/sql/streaks.test.sql` (on a scratch Postgres; instructions at
the top of the file) and `node --test scripts/streaks.test.mjs`.

## Child (round screen)

`src/components/round/RoundStreakScreen.tsx` is the reference for the device.
Everything is in percent of the screen or in `cqi` (1% of the screen width,
4.66 px on the 466 px panel), so the same numbers work at any size. See it
live at `/preview/streaks` (dev builds).

### What the device reads

One query, read-only:

```
streaks?child_id=eq.<child>&is_active=eq.true&order=sort_order,created_at
```

Fields used: `name`, `icon` (a task icon key), `moment` (`day` / `night`),
`target_days`, `current_count`, `reward_stars`, `rounds_completed`, plus the
child's `current_coins` for big kids' star count. No streak logic runs on the
device.

### When to celebrate

Keep `{rounds, count}` per streak in device storage (the web app uses
`localStorage`, see `streakSeen.ts`). On each sync, compare with the new row:

- more `rounds_completed` → play **round** (even though beads went back to 0)
- same rounds, more `current_count` → play **bead**
- anything else (a "Not this time", a parent's undo) → show the new state
  with no animation and update storage
- a streak seen for the first time → just remember it

Play it the next time the screen is awake, then store the new numbers.

### Layout (466 px)

| Element | Little (2–5) | Big (6–10) |
|---|---|---|
| Top | habit picture: cream circle Ø 21cqi at y 19.5%, icon 12cqi navy, tilted −8° with a slow bob | ★ balance pill at y 8.6%; icon 6.4cqi + name (Andika bold 6.6cqi, 5.4cqi past 14 characters, 2 lines max) at y 18.5%; "3 of 5" (Andika bold 5cqi, muted) at y 27.5% |
| Pet | 77 × 56 stage, 44cqi tall, centred at y 46% | 38cqi tall at y 54% |
| Beads | smile under the pet (below) | same, and the big star shows the reward number |
| Night streaks | crescent at (17%, 20%) and five twinkling sparkles | same |
| Page dots | 1.9cqi squares, bottom 2.6%, when there's more than one streak | same |

**Bead smile.** `n = target_days` slots; the last is the big star. Small
beads are 10cqi (n ≤ 5), 8.6cqi (n ≤ 7) or 7.2cqi; the big star is 1.7× that,
max 17cqi. Radius r = 33% (n ≤ 5) or 35%, gap 2.2cqi. Walking left to right,
the angle between neighbours is `(size_i/2 + size_i+1/2 + gap) / r`; centre
the whole arc on 90° (the bottom), with y pointing down.

**Bead states.** Filled: Star Amber `#FAB047` with a white shine. Next (the
one they're going for): navy with a lavender `#A89AF0` outline, breathing
1 → 1.12 every 1.6 s. Still to come: surface `#2C3558`. Big star still to
win: raised `#3C4770` with a small amber sparkle twinkling at its corner.

### Celebrations

| Time | Bead | Round |
|---|---|---|
| 0 ms | pet plays Celebrate; the new bead leaves the pet (scale 0.35), hops up and over | same, the big star hops |
| 570 ms | Piko chime: G5 → C6, triangle wave | same |
| 650 ms | lands (1.15 → 0.88 → 1), six sparkles fly out; little kids get a "Yay!" bubble beside the pet, big kids read "Yay!" | |
| 800 ms | | every bead bounces, 90 ms apart; big kids read "All done!" |
| 1500 ms | | the top steps aside; the big star flies up to y 21% (27% big) at 26cqi with a glow and 12 sparkles; "+5" on it for big kids; the ★ count ticks up now; streak-done notes G5 C6 G5 C6 |
| 1700 ms | done | |
| 4300 ms | | beads quietly empty for the next round |
| 5000 ms | | done |

Reduced motion: no hops or flights, the end state and the chime only.

### Words

Little kids see one word at most ("Yay!"). Big kids see the habit's name, "3
of 5", "Yay!" and "All done!". Nothing on the child's screen ever mentions a
missed day: after "Not this time" the beads are simply empty again.

**Numbers use Andika, not Pixelify Sans.** In Pixelify the 5 and the S are
the same glyph, and at 22 px the 2 reads as an 8. Worth a note in the brand
book's type section.
