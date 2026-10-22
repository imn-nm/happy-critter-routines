# The day plan

What the device reads: one JSON document per child per day. The server does the scheduling that the web app does in `ChildInterface.getTodaysSchedule`:

- the built-in rows and their per-day times (weekend times, breakfast following wake-up);
- `tieDay`;
- events widened by their get-ready time;
- auto-placing untimed tasks;
- clamping overlaps;
- nothing past midnight.

The device takes the plan's times as they are. It works out the rest on its own clock (`app/logic.c`):

- free time and the worm;
- now and next;
- overdue focus;
- the last five minutes;
- the morning alarm, snooze and "I'm up" (from `child.wake` or the Wake Up row; none when `child.alarm` is false), "Off to school" and the quiet school hours (the `school` row), "Welcome home" after it, "Bedtime soon" ten minutes before the bedtime routine;
- bedtime, the night clock when the handheld is on its dock, and day over.

Examples: `platform/sim/web/demo/*.json`.

```jsonc
{
  "v": 1,
  "date": "2026-10-06",              // the plan's day (the device asks again when its own date changes)
  "child": {
    "id": "uuid",                    // also seeds Biscuit's personality (personality.ts)
    "name": "Amira",
    "pet": "Biscuit",                // the character's name
    "character": "rabbit",           // pet_type: rabbit | robot | fox (others draw as the rabbit for now)
    "color": "cocoa",                // pet_color: one of the character's colour names, or "" for its own
    "picture": false,                // picture view (display_mode, or under 7)
    "stars": 41,                     // current_coins; asked-for rewards are taken off on the device
    "wake": "07:00",                 // today's wake-up (the Wake Up row wins if there is one)
    "alarm": true,                   // the alarm rings at wake-up today (a parent can turn it off for weekdays or weekends)
    "next_wake": "08:30",            // tomorrow's wake-up and alarm: the night screens before midnight show
    "next_alarm": true,              //   "Alarm set for 8:30", or "Wake up at 8:30" with no alarm
    "alarm_test": "2026-10-21 23:10:04",  // a grown-up's "Ring MyToki now" (Pacific), "" for never: MyToki rings
                                     //   the morning alarm if it's new and from the last two minutes
    "outfit": { "head": "wizard", "face": null, "neck": "cape" },  // pet_outfit
    "star_note": "For tidying up without asking"   // why the last stars were given: shown with "You got a star!"
  },
  "rest_day": false,                 // isRestDate: "Cozy rest day"
  "tasks": [                         // every timed row today, any order (the device sorts by start)
    {
      "id": "uuid",
      "title": "Get Dressed",
      "icon": "shirt",               // a task-icon key from src/utils/taskIcon.tsx (ICON_OPTIONS)
      "start": "07:15",              // after per-day overrides; events: when get-ready starts
      "end": "07:30",
      "steps": [{ "id": "s1", "text": "Put on your pants" }],   // tasks.subtasks, ticked by the button
      "important": false,            // is_important: must finish (runs late, eats free time)
      "fun": false,                  // is_fun_time: no done button
      "late": "keep",                // late_policy: keep | shorten | skip
      "min": 0,                      // min_duration (minutes) for "shorten"
      "event": false,                // is_event
      "event_start": "16:15",        // events only: when the event itself starts
      "system": "wake",              // built-in rows: wake | breakfast | school | lunch | dinner | bedtime
      "bedtime_routine": false,      // isBedtimeRoutine: straight to bed when it's done
      "activity": "reading",         // optional: what Biscuit does (activityForTask); else guessed from the title
      "say": "",                     // optional: what Biscuit says
      "done_at": "07:24",            // first task_completions.completed_at today, if any
      "fixed": false,                // a set-time task: never pulled forward, and it pauses a started task
      "needs_start": false,          // tasks.needs_start: waits for the button; its timer runs from the press
      "started_at": "16:12"          // today's task_sessions.started_at for it (Start, or pulled forward with "next now")
    }
  ],
  "chores": [                        // type = floating
    { "id": "uuid", "title": "Feed Fish", "icon": "pet", "from": "15:00", "to": "19:00", "done": false }
  ],
  "rewards": [
    { "id": "uuid", "title": "Ice Cream Trip", "icon": "icecream", "color": "#F59A76", "cost": 20,
      "state": null,                 // null | "waiting" (pending) | "approved" (today) | "denied" (today)
      "note": "Maybe at the weekend!" }   // denied: the grown-up's short reason, shown on "Not this time"
  ],
  "streaks": [                       // optional; not in the database yet (the Figma's night streaks)
    { "id": "bedtime", "title": "Bedtime", "icon": "bed", "goal": 5, "count": 3, "prize": 5, "night": true }
  ],
  "wheel": ["Draw", "Lego", "Read", "Outside", "Puzzle", "Dance"]   // spinning_wheel_options (2+), else the starters
}
```

## What the device sends

`POST` to the events URL, one JSON object each. Kept and retried while offline.

| `type` | fields | the web app's equivalent |
|---|---|---|
| `task_done` | `task_id`, `date`, `at` ("HH:MM"), `value` (seconds spent) | `useTasks.completeTask` → `task_completions` |
| `chore_done` | `task_id`, `date`, `at` | `markChoreDone` |
| `reward_request` | `reward_id`, `value` (cost) | `purchaseReward(..., "pending")` → `reward_purchases` |
| `outfit` | `outfit: {head, face, neck}` | `updateChild({ pet_outfit })` |
| `character` | `pet_type`, `pet_color` ("" for the original) | `updateChild({ petType, pet_color })`: My buddy in Playtime |
| `task_start` | `task_id`, `date`, `at` | `useTaskSessions.startSession(id, "start")`: the button on a task that waits for it |
| `next_now` | `task_id`, `date`, `at` | `useTaskSessions.startSession(id, "next_now")`: finished early, the next task starts now |

## What the child does with the day (src/utils/liveDay.ts, app/logic.c)

The server applies "next now" pulls to the plan's times (the pulled task and the movable tasks behind it move up, stopping at the next meal, event, bedtime or set-time task; the minutes saved are the gap left before it). The device does the same locally the moment the button is pressed, so the screen never waits for the plan to come back.

A task with `needs_start` waits on the screen ("Press to start") until the button; while it waits the clock still runs, so the wait counts like running late: its full length still has to fit after now, and the reserve is eaten in the usual order (free time, then skip-if-needed, then shorten-if-needed). From the press its full length runs; a meal or event in the way pauses it (that row takes the screen, "Homework after this!") and it carries on after. Nothing moves past bedtime; a task it ran over completely is "didn't get to it" and never becomes current (must-finish tasks stay in play instead).

The button always does what the lime words next to it say: "Press to start" (waiting), "Press when done" (running; steps still tick), "Press for Homework / or play" with the ring shrinking over five seconds (done early, with `N min saved`), "Press to start Homework" (free time with a next task that can move). At an event the mark is dark with no words: a press does nothing.

Every message also carries `child_id`. Step ticks stay on the device, like the web app (localStorage there, NVS here).

## Celebrations

- A reward whose `state` turns `approved` plays "Woohoo, you earned it!" once; one that turns `denied` shows "Not this time" with the note, and its stars come back.
- `child.stars` going up plays "You got a star!" with `star_note` (several at once: "3 new stars!").
- A streak whose `count` goes up plays "Yay, another star!".
- Reaching `goal` plays the big star.

The device remembers what it has already shown, so the server just reports the current state.
