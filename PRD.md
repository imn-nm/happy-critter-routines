# PetPals — Product Requirements Document

## 1. Overview

PetPals (codename: happy-critter-routines) is a mobile-first, gamified task
management app for families. Children follow a daily routine with the help of a
virtual pet; parents configure the schedule, monitor progress, and approve
rewards. The app blends habit-building, time awareness, and reward-based
motivation so kids can work through their day with light, kid-friendly
structure while parents keep oversight.

## 2. Problem Statement

Structured routines help children build independence and reduce parent–child
friction around daily transitions (wake-up, homework, chores, bedtime).
Existing tools either over-burden parents (calendar apps), under-motivate kids
(chore charts), or punish missed tasks (nagging alarms). PetPals aims for a
middle path: a kid-readable, live timeline with a gamified loop that makes the
cost of delay visible — without being punitive.

## 3. Target Users

- **Primary user — Children (ages ~5–12):** complete tasks on a phone or
  tablet, earn coins, care for a virtual pet, redeem rewards.
- **Primary user — Parents:** set up child profiles, build the daily routine,
  configure rewards, review progress reports.
- **Usage context:** Mobile-first (phones and tablets). Children interact in
  short bursts between activities; parents use the dashboard weekly for setup
  and daily for quick checks.

## 4. Goals & Non-Goals

### Goals
- Kids can independently see "what am I supposed to be doing right now?" and
  act on it without parent prompting.
- Make the **consequence of delay visible** (shrinking free time, overdue
  timer) rather than issuing reminders or penalties.
- Keep parent setup low-touch: configure once per week, adjust daily as
  needed.
- Provide a rewarding feedback loop (coins, pet happiness, celebrations) that
  reinforces completion without turning the app into a game to grind.

### Non-Goals
- Not a calendar. Tasks are routine-centric, not event-centric.
- Not a messaging or social platform.
- Not a screen-time manager.
- No punitive features (no red buzzing alarms, no "you failed" messaging).

## 5. User Roles

| Role | Capability |
|---|---|
| **Parent** | Create/edit children, tasks, schedules, rewards. View reports. Approve/deny reward purchases. |
| **Child** | View today's timeline, start/finish tasks, redeem rewards, care for pet. Cannot edit structural data. |

Authentication is parent-account based; children use a dedicated child view
keyed by `childId` without separate login.

## 6. Core Concepts

### 6.1 Children
Each child has a profile with:
- Name, pet type (fox / panda / owl), current coins, pet happiness.
- A weekly schedule of **system tasks**: Wake Up, Breakfast, School, Lunch,
  Dinner, Bedtime — each with per-day time and duration.
- Optional rest days (no tasks required).
- Holidays (skip school-related tasks on specified dates).

### 6.2 Tasks
Four task types, chosen when the parent creates a task:

| Type | Meaning | Behavior |
|---|---|---|
| **scheduled** | Fixed time (e.g. 5 pm Ayat Homework) | Appears at a set time on the timeline; drives the live "current task" flow. |
| **regular** | Recurring routine item | Same as scheduled but typically system-generated. |
| **flexible** | Anytime within the day | Child can start it whenever; can absorb bonus time saved from finishing other tasks early. |
| **floating** (chore) | Anytime within a window | Shown as a floating sidebar card; one tap to complete. |

Each task carries: name, type, coin value, duration, recurrence (days of the
week), optional day-specific schedule overrides, and an **Important** flag.

### 6.3 The Important Flag
Marks a task that the child cannot skip. Important tasks:
- Do **not** auto-advance when the timer hits zero.
- Must be explicitly marked **Done** by the child.
- If not done on time, they become **overdue** and stay as the current task
  with a timer running into negative — blocking later tasks until resolved.

### 6.4 Task Completions & Sessions
- **task_completions**: one row per completed task per day; records coins
  earned and time spent.
- **task_sessions**: tracks active timing (start / end), used when a task is
  in-flight.

### 6.5 Rewards
Per-child catalog of redeemable items (e.g. "30 minutes of Roblox — 50
coins"). Purchases are logged as transactions.

### 6.6 Virtual Pet
Each child has one pet with happiness tied to daily completion rate. Pet shows
emotions: encouraging, happy, excited, resting. Pet avatar changes size/state
contextually (e.g. sleeping at bedtime, celebrating on early completion).

## 7. Core Flows

### 7.1 Child — Daily Flow
1. Child opens their view. Pet greets them with a contextual emotion.
2. A **Current Task card** shows front and center:
   - Task name, a circular timer, and a primary action button.
   - If no task is scheduled right now, a **Free Time** card with the same
     layout counts down to the next task.
3. The timer runs continuously. Child can tap **Next** to finish early.
4. On timer = 0:
   - **Non-important task** → auto-advances to the next task.
   - **Important task** → does not advance; enters **overdue** mode.
5. **Overdue mode**:
   - Card gains a red ring and glow.
   - Banner: "Overdue — please do this now".
   - Timer keeps running into negative (e.g. `-5:23`) in red.
   - Subtitle: "Free time is shrinking — next up is [Task] at [time]".
   - Button label changes from **Next** to **Done**.
   - All later scheduled tasks wait in the upcoming list until the child taps
     **Done** on the overdue task.
6. Completing a task pops coins onto the child's balance, may trigger an owl
   celebration for early finish, and transfers bonus time to the next
   flexible task if any.
7. **Chores** appear as a floating sidebar beside upcoming tasks — one tap
   completes them anytime within their window.
8. At the last task's end, the day ends with a goodnight screen (sleeping pet,
   completion summary).

### 7.2 Parent — Setup Flow
1. Auth (development mode auto-logs in; production uses Supabase Auth).
2. Dashboard lists all children with today's progress.
3. Parent creates / edits a child profile: name, pet, per-day schedule for
   system tasks (wake/meals/school/bedtime).
4. Parent opens the task list for a child and adds scheduled, flexible, or
   floating tasks. Each task can be marked **Important**.
5. Parent configures rewards (name, cost in coins, icon).
6. Parent can drag-and-drop reorder tasks (mobile-supported via long-press).

### 7.3 Parent — Monitoring Flow
1. Dashboard shows each child's today view side-by-side with the child's own
   Current Task, upcoming list, and coin balance.
2. Reports page shows per-child history: tasks completed, coins earned,
   reward purchases.
3. Timeline views (Week, Month, Day) visualize completion patterns.

## 8. Data Model (Supabase / PostgreSQL)

```
profiles            — parent accounts
children            — child profiles; per-day system-task schedule
                      (wake_*, breakfast_*, lunch_*, dinner_*, school_*,
                      bedtime_* time/duration columns), pet_type,
                      current_coins, happiness, rest_day_date
tasks               — task definitions; child_id, name, type, scheduled_time,
                      duration, coins, is_recurring, recurring_days[],
                      task_date, schedule_overrides (per-day), window_start/end,
                      is_important, is_active
task_completions    — child_id, task_id, completed_date, coins_earned,
                      duration_minutes
task_sessions       — active timing; task_id, start_time, end_time
rewards             — child_id, name, cost_coins, icon
reward_purchases    — child_id, reward_id, purchased_at, cost_coins
holidays            — child_id, date, is_no_school, label
```

Real-time subscriptions on `children` and `tasks` keep the child view fresh
when the parent edits something from the dashboard.

## 9. UX Principles

- **Kid-readable first.** Big text, large tap targets, short labels, limited
  color palette. A child should be able to understand the Current Task card
  without reading a full sentence.
- **Make time visible, not punitive.** No alarms, no red flashing. Negative
  timers, ring colors, and the "shrinking free time" subtitle communicate
  urgency through visual contrast rather than notifications.
- **Single primary action.** The Current Task card has exactly one CTA
  (**Next** or **Done**). Settings and edits live on the parent side.
- **Mobile-first, touch-native.** Drag uses a dedicated grip handle so the
  page still scrolls normally; long-press on the handle initiates drag.
- **Glass-card aesthetic.** Dark gradient background, translucent cards,
  rounded 3xl corners, soft purple/pink glow accents. Pet art is the focal
  motif on every screen.

## 10. Technical Stack

- **Frontend:** React 18 + TypeScript + Vite
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS with custom gradient
  theme
- **State:** TanStack Query for server state; local `useState`/`useEffect`
  for UI concerns
- **Forms:** React Hook Form + Zod
- **Drag & Drop:** @dnd-kit (PointerSensor + TouchSensor for mobile long-press)
- **Backend:** Supabase (Postgres, Auth, Realtime)
- **Routing:** React Router DOM
- **Time handling:** All schedule logic normalizes to PST via custom helpers
  (`getPSTDate`, `getPSTTimeString`, `getPSTDayName`).

## 11. Routes

| Route | Purpose |
|---|---|
| `/` | Landing / entry |
| `/dashboard` | Parent overview of all children |
| `/setup` | Child profile creation |
| `/child/:childId` | Child-facing interface (primary child view) |
| `/child-dashboard/:childId` | Parent detail view for a specific child |
| `/tasks` | Task management for parents |
| `/reports/:childId` | Progress report for a child |

## 12. Key UI Components

- `TodaysScheduleTimeline`, `VisualTimeline`, `TimelineScheduleView` —
  timeline presentations for the child's day (single-day focus)
- `TaskCard`, `TaskForm`, `TaskList`, `DragDropTaskList` — task CRUD
- `ChildCard`, `ChildProfileEdit` — child management
- `CircularTimer` — countdown with overtime support (negative values render in
  red when `status="overtime"`)
- `PetAvatar`, `OwlCelebration` — pet/emotion system
- `WeekView`, `MonthView` — parent-side progress views
- `RewardsManagement` — rewards catalog

## 13. Success Metrics

- **Daily completion rate** per child (target: ≥70 % of scheduled tasks).
- **Parent setup time** (target: first functional routine in under 10
  minutes).
- **Important-task on-time rate** — how often important tasks are marked Done
  before going overdue.
- **Child self-direction** — percentage of tasks completed without a
  parent-side edit or prompt that day (qualitative, from parent feedback).
- **Session shape** — child sessions should be short and frequent (open app,
  complete one task, close). Long sessions suggest the child is "waiting out"
  a timer rather than actually working.

## 14. Known Constraints & Edge Cases

- **Tab wake-up after overnight** — `visibilitychange` handler refetches
  tasks so the first morning open shows today's schedule, not yesterday's.
- **Holidays** — tasks flagged school-related are filtered out when the day
  is a no-school holiday.
- **Rest days** — short-circuits the normal flow with a cozy rest screen.
- **Lunch during school** — lunch is hidden if its scheduled time falls
  inside the school block.
- **Cold-start on an overdue important task** — the current-task selection
  logic promotes the overdue important task as the focus regardless of
  whether the app was just opened or has been live all day.
- **Bonus time** — saved time from finishing a task early is redistributed
  only to the next flexible task, not pooled globally.

## 15. Out of Scope (V1)

- Multi-parent / co-parent accounts.
- Parent-to-child in-app messaging.
- Social / sharing features (friends, leaderboards).
- Streaks across weeks (only per-day happiness is tracked).
- Push notifications — the app relies on kids opening it, not on interrupting
  them.

## 16. Future Considerations

- Audio cues / gentle chimes at task transitions (opt-in).
- Printable weekly report.
- Apple Watch / wearable companion for a wrist-level "what's next" glance.
- Shared family pet (combined happiness across siblings).
- Voice-guided transitions for pre-readers.
