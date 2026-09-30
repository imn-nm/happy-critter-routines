# Streaks

"Stay in bed 5 nights in a row → ★ 5." A parent picks a habit, how many days
in a row, and the stars it pays. Each day they answer once on their phone.
Every yes adds a star to the child's row; the last one, the big star, pays
its stars into the child's ★, which they spend in the Rewards shop like any
other stars.

**One loop, one currency.** Grown-ups give stars (for tasks, and for
streaks) → the child's ★ → the Rewards shop (ask, a grown-up approves). A
streak is just a way to earn a bunch of stars at once, so on the child's side
it lives where the stars live and never gets a page of its own.

**One streak at a time per child.** One row of stars is what little ones can
follow. Starting (or turning back on) a streak pauses the one that's going;
the sheet says so first.

## Parent (phone)

- **Set up** (parent home → Streaks → New, or a child's page → ••• → Streaks):
  pick a picture tile (Stay in bed, Dry night, Brush teeth, Use the potty,
  Try veggies, Get dressed, Kind hands, Tidy up) or type your own, then choose
  how many days in a row (3 · 5 · 7 · 10) and the stars at the end (defaults
  to the number of days). Under the stars, what they're worth in the child's
  shop ("Ice Cream Trip is ★ 10 in Maya's shop"). A preview shows the row the
  child will see in their shop. With two children, one sheet can start the
  same streak for each.
- **Check in** (parent home): one card per streak with **Yes** / **Not this
  time**. Night streaks ask about "Last night" and start the morning after
  they're made; day streaks ask about "Today". **Undo** clears the answer.
- Finishing a round shows a toast ("Maya did it! 5 nights in a row… ★ 5
  added"). Tap a card to edit, pause or delete it.

## Rules (the database decides)

`settle_streak()` in `supabase/migrations/20260930040000_streaks.sql` replays
the answers in date order:

| Answer | Stars in the row |
|---|---|
| Yes | +1 |
| Yes that reaches the target | pays `reward_stars` into `children.current_coins`, the row goes back to 0, `rounds_completed` +1 |
| Not this time | the row goes back to 0 (no stars move) |
| No answer that day | nothing: the streak just waits |

- Stars move by the difference from what each day already paid, so answering
  twice changes nothing and an undo or a corrected answer takes back or pays
  exactly what changed. The balance never goes below 0.
- Changing the days or the stars settles every answer before the current
  run (`counting_from`), so rounds already paid are never re-priced. Lowering
  the target below the stars showing finishes the round right away.
- `mark_streak_day(streak, date, kept)` is the only way answers are written;
  `kept = null` is undo. Errors: `streak_not_found`, `streak_paused`,
  `day_settled`, `day_in_future`.
- One active streak per child: unique index `streaks_one_active_per_child`.
  The app pauses the current one first; a race between two phones gets a
  friendly "Only one streak at a time".
- Dates are the family's Pacific date, like the rest of the app.

Tests: `scripts/sql/streaks.test.sql` (on a scratch Postgres; instructions at
the top of the file) and `node --test scripts/streaks.test.mjs`.

## Child (round screen and the web child screen)

Three places, no page of its own. Figma: Circle Display, row 09.

1. **The Rewards page / Rewards shop**: the streak's row under the ★ count:
   the habit's picture and its stars, the big star last (it shows its stars
   for big kids). Nothing to press; grown-ups answer. Web:
   `src/components/streaks/StreakRow.tsx` in `RewardsShop.tsx`.
2. **Two moments** that pop over whatever is showing, once, then close
   (like "Rewards · Approved!"). Web: `src/components/round/StreakMoment.tsx`
   (the reference for the device), played by `StreakMoments.tsx`.
   - **New star** (a grown-up said yes): "Yay, another star!" (picture view:
     "Yay!"), "4 of 5 nights", Biscuit in their lime ring, and the new star
     hops out of the ring into the row with the Piko chime.
   - **Big star** (the round is done): "5 nights in a row!" (picture view:
     "Yay!"), a burst of stars around Biscuit, "★ 5 stars" (picture view:
     five star pictures), then a button to the shop: "You can get Ice Cream
     Trip!" when the stars now cover a reward, else "3 more for Movie Night".
     Tapping it opens the Rewards page.
3. **Tonight's star** on the bedtime screens (Bedtime, Goodnight, Still
   sleepy time) for a night streak: the row, with a moon. Web:
   `src/components/streaks/TonightsStar.tsx`.

After "Not this time" the row is simply empty the next time the child
looks. No animation and no words about it: Biscuit never mentions a missed
night.

### What the device reads

One query, read-only:

```
streaks?child_id=eq.<child>&is_active=eq.true
```

Fields used: `name`, `icon` (a task icon key), `moment` (`day` / `night`),
`target_days`, `current_count`, `reward_stars`, `rounds_completed`; plus the
child's `current_coins` and their rewards for the shop button. No streak
logic runs on the device.

### When to play a moment

Keep `{rounds, count}` per streak in device storage (the web app uses
`localStorage`, see `streakSeen.ts`). On each sync, compare with the row:

- more `rounds_completed` → **big star** (even though the row went back to 0)
- same rounds, more `current_count` → **new star**
- anything else (a "Not this time", a parent's undo) → store it, no moment
- a streak seen for the first time → just remember it

Play it the next time the child is looking and awake (not before wake-up or
after the day is over), then store the new numbers.

### Moment layout (466 px)

Positions are percent of the screen; sizes in `cqi` (1% of the width).
Black screen, Inter, Focus colours (lime `#DCEF70` stars, lavender
`#A89AF0` next, raised `#3C4770` still to come).

| Element | New star | Big star |
|---|---|---|
| Top | habit icon 4.3cqi at 9.4%; title 4.3cqi semibold at 15% (picture: "Yay!" 5.6cqi); "4 of 5 nights" 2.8cqi muted at 21% | title at 16.3% |
| Biscuit | ring Ø 46.4cqi centred at (50%, 49.8%), 1.1cqi lime edge, Biscuit in their room | ring Ø 49.4cqi at (50.2%, 50%), 14 burst stars around it (Figma positions) |
| Stars | smile under the ring: r 33.9%, small 6.4cqi, big 11.2cqi, gap 2.6cqi (picture: r 35.4%, 8.2 / 13.3cqi) | "★ 5 stars" 3.9cqi lime at 80.2% (picture: up to five stars) |
| Bottom | | shop button at 88%, lime edge when a reward is affordable |

**Star smile.** `n = target_days` slots; the last is the big star. Walking
left to right, the angle between neighbours is
`(size_i/2 + size_i+1/2 + gap) / r`; centre the arc on 90° (the bottom), y
pointing down.

### Timings

| Time | New star | Big star |
|---|---|---|
| 0 ms | Biscuit cheers; the new star leaves the ring (scale 0.35), hops up and over | Biscuit cheers; burst stars pop in 40 ms apart |
| 150 ms | | streak-done notes G5 C6 G5 C6 |
| 570 ms | Piko chime G5 → C6 | |
| 650 ms | lands (1.15 → 1), six sparkles fly out | |
| 450 ms | | "★ 5 stars" springs in |
| 1100 ms | | shop button fades in |
| 2000 ms / 4200 ms | done; closes 0.9 s later | done; closes 3.5 s later unless tapped |

Reduced motion: no hops or bursts, the end state and the sound only.

Picture view speaks "Yay! Another star!" / "Yay! You did it!" on the web.
