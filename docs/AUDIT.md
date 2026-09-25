# App audit — corner cases and UX (2026-09-25)

Merged from two reviews (Claude Code and Codex) of the whole app, parent and
child sides. Ranked by harm: data loss and wrong star counts first, then the
always-on child screen, then parent tools, then polish. Tick items as they
land. `C` = found by Claude, `X` = found by Codex, `CX` = both.

## 1. Fix first — data loss, star counts, security

- [x] **Tasks named like built-in rows get deleted.** A task named Wake Up,
  Breakfast, Lunch, Dinner, School or Bedtime is treated as the built-in row,
  and every child-screen load deletes all but one copy (with its completions).
  `src/utils/systemTasks.ts` `cleanupDuplicateSystemTasks`. (C)
- [x] **Built-in rows open the full task form**, but saving keeps only time,
  days and length; rename/stars/type are silently lost. (C)
- [x] **Reward approval isn't atomic.** Status flips to approved, then stars
  are deducted in a second request; if that fails the reward is approved
  unpaid and retry says "already handled". No balance check (the balance
  function floors at 0, so a short balance is silently under-charged). Same
  for parent Redeem. `src/hooks/useRewards.ts`. (CX)
- [x] **Undo and Give ★ race.** Undo deletes the completion and subtracts stars
  read from the screen's copy; two parents can take stars back twice, or none.
  `/tasks` Undo never takes stars back. (C)
- [x] **Duplicate "done" rows.** No unique constraint on
  `task_completions (task_id, date)`; double taps and parent+child at once
  insert twice (8 duplicate rows exist today). (C)
- [x] **Household rules too loose.** Any signed-in user can insert themselves
  into any household by id; any member can remove any other, including the
  owner. (C)
- [x] **Two households per parent.** Membership lookups use `.limit(1)` with no
  order; a failed household lookup creates a second household client-side;
  an invitee who added a child first keeps their own household. (C)
- [x] **Sign-out on the phone signs out the child's device** (global scope,
  no confirm). (C)
- [x] **Children can reach parent mode.** "Grown-ups" and "Child not found →
  Back" open the parent dashboard; parent routes don't enforce the PIN,
  including browser Back and direct links. PIN is plain text. (CX)
- [x] **Dev auto-login isn't limited to dev builds** (`VITE_DEV_AUTOLOGIN`
  only); a locally built `dist` signs visitors into the test account. (C)

## 2. The always-on child screen

- [x] **Night shows "Free Time".** Before wake-up the screen offers a multi-hour
  free-time countdown, the wheel, Playtime and chores. Needs a sleeping state. (C)
- [x] **Playtime reopens by itself** at the next free-time window (`playOpen`
  never reset when the next task takes over). (C)
- [x] **Checklist ticks carry past midnight** on a screen that never reloads. (C)
- [x] **Never catches up after a network drop** — refetch only on tab
  visibility, which an always-on screen never triggers. (C)
- [x] **Offline at startup → permanent "Child not found"**; the name picker
  shows "No children profiles yet" and suggests setup. Needs a
  "couldn't load — try again" state. (CX)
- [x] **Celebrates before the save lands.** Offline "I'm done" plays the
  celebration, then a red adult error, then the task comes back. Show
  saving / done / tap to retry. (CX)
- [x] **Adult error toasts on the child screen** ("Failed to purchase reward",
  "Failed to update child"). (C)
- [x] **Double-tapping a chore** records it twice and replays the sound. (C)
- [x] **No undo for an accidental chore tap** on the child side (safe: stars only
  come from parents). (X)
- [x] **Per-day wake times ignored** for the sleepy / free-time logic. (C)
- [x] **Rest day hides the reward loop** — no star chip, shop, approval
  celebration or chores. (C)
- [x] **Chores disappear** in the "Next up" and "All done" states; a day with no
  timed tasks says "All done for today!" from the morning. (C)
- [x] **Free time eaten by the worm** drops to a bare list with no pet. (C)
- [x] **Bedtime after midnight / tasks past midnight** — decided: the day
  starts fresh at midnight. The child screen cuts anything off at midnight;
  the task form refuses times that run past it and a Bedtime after midnight.
  The still-to-do chime no longer plays with the bedtime one. (C)
- [x] **Shop numbers** — header shows all stars while cards subtract pending asks;
  a pending ask for a removed reward holds stars invisibly; evening denials
  show next day (UTC vs Pacific); parent Redeem never celebrates. (C)
- [x] **Removing a reward hides past purchases** from the "Mine" shelf. (CX)
- [x] **Free time choices** — decided: free time opens on Biscuit; with more
  than 10 minutes left the child can pick "Spin the wheel" instead. Five
  minutes before the next task Biscuit says "Time to get ready", on top of
  the wheel or Playtime. (X)
- [x] Small: the tiny "Show pet instead" link, the no-school filter dropping
  anything containing "school", the dead realtime channel. Two tasks can no
  longer start at the same time (decided: never allowed; every save path
  checks, see `src/utils/startClash.ts`). (C)

## 3. Parent scheduling

- [ ] **"Only this date" edits** keep only time/length (rename, stars, type
  dropped); "All recurring" after a one-day change spreads that day's time. (C)
- [ ] **School schedule** unticking a day doesn't remove School that day; can't
  set under 60 minutes. (C)
- [ ] **Planner delete** — one-offs delete without confirm; Cancel on "only
  Mon?" leads to "Delete ALL recurring?". (C)
- [x] **"Also add to" another child drops the date** (lands on today). (C)
- [ ] **Chore tiles stack** exactly on top of each other (default 3–6pm). (C)
- [ ] **Can't give stars for Normal tasks** though the form offers stars. (C)
- [ ] **Drag moves every day** of a recurring task; skipped dates can't be
  restored. (C)
- [ ] **Suggested time ignores the chosen day.** (C)
- [ ] **Only one rest day per child**; adding another silently moves it. Support
  ranges/multiple dates for illness and trips. (CX)
- [ ] **Holiday form remembers the previous holiday.** (C)
- [ ] **Missing checks** — chore window end before start, meals outside the
  waking day or out of order at setup, unlimited stars (open). Done: nothing
  may run past midnight; two tasks can't start at the same time. (CX)
- [ ] **Calendar looks connected when sync fails** — show last successful sync
  and a Reconnect state. (CX)

## 4. Parent account, rewards, alerts

- [ ] **Invitee who already has children** ends up in two households; the app
  now picks the most recently joined one. Needs a switcher, or merging the
  children in on accept. (follow-up from section 1)
- [ ] **Parent PIN is stored in plain text** in `households.parent_pin` and
  compared on the device; hash it and check it server-side. (follow-up)
- [ ] **Invites** — redeemed on page load with no "Join?" confirm; email not
  checked; no revoke/remove/leave; email sign-up loses the token; lands on
  the kids' picker. (C)
- [ ] **Password-reset form never closes** (separate `useAuth` instances). (C)
- [x] **Deleting a reward leaves pending requests stuck** holding stars. (C)
- [ ] **Missed-important alerts** fire on rest days, can't be dismissed, can
  stop firing after a Give ★. (C)
- [ ] **Empty dashboard dead end** — no Settings/Alerts/Sign out with zero
  children (open). Load errors now show "We couldn't load your family". (C)
- [ ] **Connect Google Calendar may switch accounts** (`signInWithOAuth` instead
  of `linkIdentity`) — unverified. (C)
- [ ] **Deleting a child from its page** leaves "Child not found". (C)
- [ ] **Profile edit form keeps stale data**; save overwrites another parent's
  edits. (C)
- [ ] **Dashboard Now/Next** ignores overrides and rest days; "Pack lunch" hidden
  from upcoming. (C)

## 5. Consistency and polish

- [ ] **Words** — onboarding: Daily routine / Must finish / Chores / nice to
  have; form: Task|Chore, Normal / Must finish / Free time (hidden under More
  options). Product name: PetPals / Happy Critter Routines / Taskie. (CX)
- [ ] **Timezone fixed to Los Angeles** — show the family's timezone; decide
  what happens when travelling. (X)
- [ ] **Errors titled "Conflict"** for any save failure. (C)
- [ ] **No star ledger** — manual ± not recorded; deleting a task erases its
  star history; Reports can't reconcile. (C)
- [ ] **Service worker** caches Supabase GETs and force-reloads the child screen
  after deploys. (C)
- [ ] **Small tap targets** — invite copy buttons, 32px edit buttons. (C)

## Hygiene still open (from 2026-09-09)

- [ ] Old service-role key in git history (old project) — rotate or delete it.
- [x] `types.ts` regenerated from the live database (all tables and functions).
- [x] `adjust_child_coins` checked into `supabase/migrations`.
- [ ] Base tables (children, tasks, rewards…) still missing from
  `supabase/migrations`.
- [ ] Almost no tests.
