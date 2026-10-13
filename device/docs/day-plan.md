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
- the morning alarm, snooze and "I'm up" (from `child.wake` or the Wake Up row), "Off to school" and the quiet school hours (the `school` row), "Welcome home" after it, "Bedtime soon" ten minutes before the bedtime routine;
- bedtime, the night clock when the handheld is on its dock, and day over.

Examples: `platform/sim/web/demo/*.json`.

```jsonc
{
  "v": 1,
  "date": "2026-10-06",              // the plan's day (the device asks again when its own date changes)
  "child": {
    "id": "uuid",                    // also seeds Biscuit's personality (personality.ts)
    "name": "Amira",
    "pet": "Biscuit",
    "picture": false,                // picture view (display_mode, or under 7)
    "stars": 41,                     // current_coins; asked-for rewards are taken off on the device
    "wake": "07:00",                 // today's wake-up (the Wake Up row wins if there is one)
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
      "done_at": "07:24"             // first task_completions.completed_at today, if any
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

Every message also carries `child_id`. Step ticks stay on the device, like the web app (localStorage there, NVS here).

## Celebrations

- A reward whose `state` turns `approved` plays "Woohoo, you earned it!" once; one that turns `denied` shows "Not this time" with the note, and its stars come back.
- `child.stars` going up plays "You got a star!" with `star_note` (several at once: "3 new stars!").
- A streak whose `count` goes up plays "Yay, another star!".
- Reaching `goal` plays the big star.

The device remembers what it has already shown, so the server just reports the current state.
