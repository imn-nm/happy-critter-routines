# MyToki PRD

Oct 9, 2026 · @Imaan Naeem

## Summary

MyToki is a small handheld companion that helps a child get through their day on their own. Biscuit the rabbit lives on a round screen the child carries from wake-up to bedtime, showing what is happening now, what comes next, and how much time is left. Parents plan the day from their phone. At night the handheld sits in a dock and becomes the bedside clock.

The one thing MyToki does that others do not is show the squeeze: when a must-finish task runs long, the child can watch it eat into the fun time that comes after. Stars only ever come from a parent, the pet is never sad, and nothing is ever marked as failed.

Today the product exists as a web app that works as the test bed (`/child/:id` is the child's screen, `/parent` the parent side), a Figma set of 43 round screens, and C firmware for the first board that runs in a browser simulator. MyToki is the working name as of 2026-09-28; the app still says MyToki in places.

## The problem

Mornings and evenings in a family with young children run on nagging. The parent says "shoes" five times, the child has no feel for how long five minutes is, and everyone arrives at school or bed cross. The child cannot see the day, so the parent has to be the clock.

What families use today each solves part of this and misses the rest:

| What they use | What it does | What it misses |
| --- | --- | --- |
| Chore charts and sticker charts | Lists what to do | Nothing about when, or how long; no feel for time passing |
| Calendar and reminder apps on the parent's phone | Keeps the plan | The child never sees it; the parent still has to relay it |
| Routine apps on a tablet (Goally, Joon, Brili) | Shows the child a routine with a timer | A screen the child cannot carry around, and more screen time; Brili's free time only shifts inside one routine |
| Routine watches (Octopus, Garmin) | On the wrist all day | Tiny screen, no character, nothing to care about |
| Virtual pets (Tamagotchi, Bitzee) | A pet the child loves and carries | No link to the real day |
| Pet alarm clocks (PawPal) | A pet on the bedside that wakes the child | Stays on the shelf; covers only wake-up and bedtime |

None of them show the child the consequence of dawdling in a way a seven-year-old can feel. MyToki's answer is a pet the child carries, a day the child can read, and a visible squeeze when one thing runs long.

## Who it is for

MyToki is for a household with one to three children of roughly school age, and one or two parents who plan the day.

| Who | What they do with MyToki | What they need |
| --- | --- | --- |
| Younger child, under 7 | Looks at the picture path, hears things read aloud by tapping, presses the button when done, plays with Biscuit in free time | Big icons, very little text, one thing at a time, a friendly face |
| Older child, 7 to 12 | Reads the schedule, ticks steps, watches the time arc and the squeeze, asks for rewards, dresses Biscuit | Honest time, a feeling of running their own day, no nagging |
| Parent planning the day | Sets up each child in a few minutes, adjusts the day from the phone, gives stars, approves rewards, adds a game or a dentist visit | Few questions, sensible defaults, changes that stick, nothing to babysit |
| Co-parent | Joins by invite, sees the same children, gives stars and approves rewards too | One shared household, no second setup |

The child never signs in. Each child's screen is their own device, or a browser tab on a tablet while the web app is the test bed. A shared iPad or computer can show up to three children side by side.

Parents choose a display mode per child, and MyToki suggests picture view for anyone under 7.

## Goals and non-goals

**Goals**

- A child can answer "what am I meant to be doing now, and what's next?" by glancing at Biscuit, without a parent saying it.
- A child can feel time passing and see that taking longer on one thing leaves less for the next.
- A parent sets up a child's whole week in under ten minutes and changes a single day in under a minute.
- Stars, rewards and the pet make the child want to come back, without turning the day into a game to grind.
- Fewer parent prompts and calmer mornings and bedtimes, measured in the pilot.
- Works all day on a battery the child carries, and keeps working when the Wi-Fi drops.

**Non-goals**

- Not a clock and not a smartwatch. The dock makes it a bedside clock at night, but the day routine is the product.
- Not a screen-time manager, a tracker, or a punishment. No red alarms, no "you failed", no missed-task counts shown to the child.
- Not a chatbot for children. Any AI help lives on the parent side and parents approve every draft.
- Not a social product. No friends, leaderboards or sharing between families.
- Not a full calendar for parents. MyToki exports to Google Calendar; it does not try to replace it.
- No streaks shown to the child. Streaks are rewards in disguise, and rewards come from parents.

## Product principles

These are decisions already made. New work follows them unless the product owner changes them.

1. **Stars only come from parents.** Nothing on the child's side ever pays a star: not finishing a task, not a chore, not a game. A parent gives a task's stars with one tap after it is done, and can take them back.
2. **Biscuit is never sad.** The pet encourages and cheers. It never looks worried, never mentions a missed step, and its energy only rises during the day and resets overnight.
3. **Tasks are never required.** An undone task simply passes with the clock; the child never sees a missed state. Any task can be finished early, and the rest of its time becomes free time. Chores are opt-in.
4. **The child can only do a few things.** See stars, look at and ask for rewards, say "I'm done", tick steps, spin the wheel, play with Biscuit and dress him up. No editing the day, no pet picker, no way into the parent side.
5. **Free time is screen-free.** It opens on the activity wheel when there are more than ten minutes, with the pet one tap away. The last five minutes before the next task are get-ready time with no games. Free time is a kite, never a gamepad.
6. **The reward loop always closes.** Ask for a reward, parent gets an alert, parent approves or gently declines, stars move in one step, Biscuit celebrates on the child's screen without a reload.
7. **The day ends at midnight.** Nothing runs past it, bedtime cannot be after it, and the day starts fresh. No two things ever start at the same minute.
8. **Calm, not busy.** One lime action per screen. Lavender means the device is telling you something; cream means Biscuit is speaking. Nothing a child reads is smaller than 14 px. Picture view is icon-first on every screen, including games and the shop.
9. **Plain words.** Parent forms ask few questions, never two that mean the same thing, and show only the caption for the chosen answer. Copy sounds like a person, not a manual.
10. **Child and parent always agree.** One shared set of rules lays out the day on the child's screen, the parent's timeline and the device, so what the parent sees is what the child gets.

## The product

MyToki is four things that work together: a handheld the child carries, a dock it sleeps in, a parent app on the phone, and a server in the middle that keeps the family's data and lays out each child's day.

&#91;embedded content: how the parts fit · parent phone, server, handheld, dock\]

The parent's plan goes to the server; the handheld fetches its day plan every five minutes and at midnight, and sends back what the child did. If the Wi-Fi drops, the handheld keeps running the day on its own clock and sends the news when it is back.

| Part | What it is | Where it stands today |
| --- | --- | --- |
| MyToki handheld | A toy-sized device with a round screen, one button, a speaker and a battery for a full day; Biscuit lives on it | Firmware written in C and running in a browser simulator; not yet compiled on the board |
| Dock | Charges the handheld overnight and turns it into the bedside clock: ok-to-wake, night light, wake-up chime | Not designed yet |
| Parent app | Setup, the day and month planners, stars, rewards, alerts, household settings | Lives in the web app at `/parent`; a phone app is the goal |
| Server | Supabase: Postgres, sign-in, live updates, Google Calendar sync | Running; the day-plan endpoint for the handheld is still to build |
| Web test app | The same child screen in a browser tab; up to three children side by side on an iPad | Running; this is where families test today |

## Core concepts

A child's day is a list of things laid out between wake-up and bedtime. The same rules lay it out on the child's screen, the parent's timeline and the handheld, so everyone sees the same day.

| Concept | What it is | The rules |
| --- | --- | --- |
| Built-in rows | Wake Up, Breakfast, School, Lunch, Dinner, Bedtime | One of each per child. Weekday and weekend times. Breakfast follows wake-up. Bedtime lasts until wake-up. A row can be skipped for one day, or added to a day it is not usually on. |
| Task | Something the child does, at a set time or whenever there is room | One question, "when time is tight": must finish, keep its time, can be shortened (down to a minimum), or can be skipped. A "fun time" switch (TV, gaming) means no done button. Optional steps, ticked one at a time. A star value the parent gives after it is done. |
| Chore | Something to do any time inside a window, like feeding the fish between 3 and 7 | One tap to finish. Opt-in, never blocks anything. Chores whose windows overlap share the space. |
| Event | A game, class or outing at a set time | No done button and no stars. Optional get-ready time with its own steps before it. Hides any meal it covers and pushes bedtime past its end. Goes out to Google Calendar. |
| Routine | A named group of tasks, like School morning, After school or Bedtime | Starter packs at setup. Tasks sit "after" one another, so moving one moves the rest. Runs on school days, every day, or chosen days. Can be copied to another child. |
| Free time | Whatever is left between things | Finishing early frees the rest of that window. Opens on the activity wheel when longer than ten minutes. |
| The squeeze | What happens when a must-finish task runs late | It eats free time first, then tasks that can be skipped, then shortens tasks to their minimum. Must-finish tasks never give up time. The child watches the worm eat the bar. |
| Weekend times | Later wake-up, meals and bedtime on days off | Wake-up and meals use the weekend time on days with no school. Bedtime uses it the night before a day off, so Sunday is still a school night. |
| Day ties | What moves with what | The morning routine follows that day's wake-up. The bedtime routine follows bedtime. Events replace the meals they cover. |
| One-day changes | A change to a repeating task on one date only | Move, skip or restore it for that day; "every day" is one tap away. Nothing is deleted by accident. |
| Quiet days | Rest days, no-school holidays, day notes | A rest day has no timed tasks but keeps chores and rewards. A no-school day drops School. Notes sit on a date for the parent. |
| Parent events | Appointments only parents see, like a teacher meeting | Never shown to the child. Listed on the dashboard and the month view. |
| Stars | The only currency | Given by a parent per done task, adjusted by hand, taken back with undo. Spent on rewards. Every move is one atomic step on the server. |
| Rewards | A per-child shop of things to save for, like an ice cream trip | The child asks; the parent approves or gently declines; the child sees the answer live. Past rewards stay on the "mine" shelf. |

Two hard limits apply everywhere: nothing runs past midnight, and no two things start at the same minute.

## The child's experience

The child's screen must always answer three things at a glance: what now, what next, and how long. Everything else is one tap or one swipe away.

**Home**

- Home shows the current thing's icon and name, a time pill, Biscuit in the middle, and a time arc around the top that drains as the minutes go.
- A Next pill at the bottom names what comes next and when, with the rest of the day peeking behind it. Tapping it opens the day as a sheet.
- Biscuit's speech bubble says hello, reacts to what the child does, and gives the only nudges there are ("Time to get ready").
- There is no greeting line, no stars on Home, and no star amounts on tasks.

**Doing things**

- The child finishes a task or ticks the current step with the hardware button (a slide on the web app). The rim lights up only when the button does something.
- Steps show one at a time: "2 of 4 · Put on your pants".
- Finishing early frees the rest of the window as free time. Finishing is always allowed, except on events, fun time and bedtime.
- A must-finish task that runs late stays in focus with a gentle late tag and the worm eating the free-time bar. Nothing is ever shown as failed, and the day flows on past anything left undone.
- Chores live on their own page: a card each, one tap to finish, a short "oops, not done yet" undo, and a "done!" in mint.
- Events show "get ready for soccer" with its steps, a countdown, "you're ready!" with a cheer, then a plain timer while the event runs. An event takes focus over anything late.

**Free time and play**

- With more than ten minutes free, the screen opens on the activity wheel of parent-set ideas (starter ideas until the parent adds some). A switch flips to Play with Biscuit.
- Playing is tapping Biscuit; there is no gamepad anywhere. The games never fail and never pay stars.
- Five minutes before the next thing, play ends with a goodbye and the screen turns to get-ready mode. No wheel, no games.

**Rewards**

- The shop shows the star balance and each reward on a shelf with its cost, whether the child can buy it, and how many more stars it needs.
- The child asks for a reward; it shows as "asked" and the stars are set aside. When the parent approves, the child gets a celebration screen and Biscuit cheers. A decline is gentle and the stars come back.
- Stars are only visible in the shop, never on celebration screens.

**Night and quiet days**

- Before wake-up the screen is a sleeping Biscuit, not free time. When the bedtime routine is done the goodnight screen follows straight away.
- A rest day is a cozy day with Biscuit and the chores and shop still there.

**For younger children (picture view)**

- Large icons, very little text, big buttons. The day is a picture path: done, now (big, with a lime ring), next, later.
- Tapping any picture or text reads it aloud. Biscuit's bubbles become emoji.
- Clock times still show. Nothing a child reads is smaller than 14 px.

**Always on**

- The screen keeps running the day on its own clock if the network drops, saves "done" locally, and catches up when it is back.
- A parent's change shows up on the child's screen within seconds, without a reload.
- No adult error messages ever appear on a child's screen; a connection problem is a calm "can't connect" note that retries itself.
- On an iPad or computer, up to three children's screens sit side by side, each with its own Biscuit and its own personality.

## The parent's experience

The parent side is for planning in minutes and checking in seconds. It asks few questions, offers good defaults, and never lets a quick edit wipe out a whole week.

**Setting up a child**

1. Name and age.
2. Pick starter routines: School morning, After school, Bedtime.
3. Enter only the times those routines need (wake-up, school, meals, bedtime).
4. See the child's real screen as a live preview, pick picture or detailed view, and finish.

The whole thing takes under ten minutes. Backing out of the preview leaves nothing behind.

**The family home**

- One card per child with what they are doing now, what is next, and their stars. "Getting ready for soccer" and "Rest day" read as such.
- Upcoming events: the children's games and classes plus the parents' own appointments.
- Alerts: reward requests waiting for an answer, and must-finish tasks that were missed. Alerts can be dismissed for the day and never show on rest days.
- Settings are reachable even with no children yet, and a load problem says "we couldn't load your family" rather than an empty page.

**Planning a day**

- The Day view is a timeline from wake-up to bedtime with free time, get-ready rows and chores laid out as the child will see them. Overlaps show an amber warning.
- Drag a task to move it; a repeating task moves on that day only, with "every day" offered in the toast. Dropping where nothing fits is refused.
- Edit a repeating task "only on this date", "every weekday", "every weekend" or "every day"; the dialog says when an edit cannot be one-day only.
- Deleting asks "only on this day" or "every day"; built-in rows can only be skipped for a day, and skipped days can be restored.
- Give stars with one tap on a done row or chore, and take them back with undo.

**Planning a month**

- The Month view shows events, holidays, rest days and notes. A day opens a sheet with tiles to add an event, note, task, holiday or rest day.
- Mark a no-school day and School comes off that day. Any number of rest days.
- Manage the school schedule per weekday.

**Adding to the schedule**

- One sheet, three kinds: Task, Chore, Event. Typing a name like "Soccer game" or "Brush teeth" picks the kind, icon, length and steps.
- A task asks when it happens (at a set time, or whenever there is room), which days, and what to do when time is tight. Fun time is a switch. Steps are optional and suggested by age.
- An event asks when it starts and ends and whether to add get-ready time with steps.
- A chore asks for its window.
- The sheet refuses two things at the same minute, anything past midnight, and names that belong to built-in rows.
- Any task can be copied to a sibling.

**Rewards**

- Set up each child's shop together with them: name, icon, star cost.
- Approve or decline requests from the alert; stars move atomically and the child sees the answer live.
- Redeem a reward for the child by hand. Removing a reward keeps its past purchases.

**Reports**

- Per child: tasks done, stars given, rewards bought, over days and weeks.

**Household**

- Invite a co-parent by link or email. An invitee who already set up children is offered to bring them along. Owners can remove members; anyone can leave.
- A parent PIN keeps children out of the parent side. It is hashed on the server, and five wrong tries pause it.
- Connect Google Calendar: children's events and parents' appointments go out with the child's name in front; siblings' shared events merge into one entry.
- Sound and speech switches, timezone (Pacific for now), sign out on this device only.

## Biscuit, the pet

Biscuit is the reason a child picks MyToki up. The pet has to feel alive, like a Tamagotchi, not like a mascot stuck on a timer.

**Character**

- Biscuit is a retro pixel rabbit drawn from the product owner's own pixel art: a three-quarter pose by default, turning to face the child only when they interact (a wave, a cheer, dress-up, bath time). One flopped ear is Biscuit's special thing.
- Each child's Biscuit has its own personality, seeded from the child: its own habits, pace and favourite free-time activities, so siblings' rabbits drift apart side by side.
- Biscuit is always encouraging. Never sad, never worried, never mentions what was missed. Energy rises through the day and resets overnight. Pets have no gender in the brand rules; the product owner says "he" for Biscuit, and that is still open.

**Alive at rest**

- Blinks with both eyes, sniffs, waves, yawns near bedtime, looks around, and reacts to a tap. Every clip starts and ends on the neutral pose so nothing jumps.
- During a task Biscuit does what the child is doing, in a little room: reads a book during reading, kicks a ball during soccer practice, brushes teeth, plays a game on a TV during fun time. Activities loop seamlessly and are not interrupted by habits.
- At bedtime Biscuit reads a story and gets drowsy; overnight he sleeps in a loaf with the outfit in a pile beside the bed; at wake-up the room turns to dawn.
- Celebrations: a jump with lime sparkles when a task is done, a bigger one when a reward is approved. Speech bubbles are cream and only ever carry Biscuit's own words.

**Dress-up**

- Eighteen outfit items across head, face and neck: hats, glasses, a clown nose, a lei, a medal, a hero cape and more. The outfit follows Biscuit everywhere, including asleep and on the parent's dashboard.

**Playtime**

Five games, all no-fail, none paying stars, all screen-free in spirit (short and gentle):

| Game | What happens |
| --- | --- |
| Dress up | Pick an outfit; it saves for everywhere Biscuit appears |
| Bath time | Scrub, rinse, towel |
| Carrot catch | Thirty seconds of catching carrots; gold ones count three; a personal best |
| Bubble pop | Biscuit blows bubbles, the child pops them; a cheer every ten |
| Peekaboo | Three bushes; ears peek as a hint; Biscuit pops up with "boo" |

Play ends on its own five minutes before the next thing, with a goodbye instead of a nag.

**On the handheld**

- The same rabbit, frame for frame: the clips, outfits, Playtime poses and rooms are exported from the app's code into the firmware.
- Biscuit is drawn solid; the room behind him is drawn as lit LED dots with darker walls and floors so he stands out. No glow under his feet.

**More pets later**

- The logo is deliberately not an animal so that more pets can come. New pets follow Biscuit's grid, square eyes and chibi arms, and each gets one special thing of its own.

## The handheld and the dock

The handheld is a toy the child carries, not a watch and not a clock. It must survive a school bag, last a full day on one charge, and keep working with no Wi-Fi.

**Hardware (first board)**

| Part | Spec |
| --- | --- |
| Screen | 1.75 inch round AMOLED, 466 × 466, touch |
| Board | Waveshare ESP32-S3 with 8 MB PSRAM, Wi-Fi |
| Sound | Small speaker for chimes; speech later |
| Input | One hardware button at 1 o'clock on the rim, plus touch |
| Motion | 3-axis accelerometer: wakes the screen when picked up, lets Biscuit react to a shake or a tap, knows when it is in the dock |
| Housing | Navy with a green button (moodboard: handheld toys, orange cables, dot-matrix screens) |

The first board is a development kit. The product version needs a battery sized for a full day, a lanyard point, a drop-proof shell, and a quiet mode for school.

**How the round screen works**

- Three pages in a carousel: Rewards on the left, Home in the middle, Chores on the right. Swipe between them or tap the side icons; dots at the bottom show the page.
- The Next pill opens today's schedule as a sheet that slides up. It shows three rows like a wheel, the middle one biggest, with chores after the timed things.
- The hardware button finishes the current thing or ticks the current step. A lime arc on the rim shows only when pressing it does something. There are no on-screen done controls.
- Anything opened by a tap closes with a sideways swipe. No X and no back buttons.
- One lime action per screen. Lavender cards are the device talking; cream bubbles are Biscuit. Mint is free time and done; amber is stars; coral is late; sky is night.
- Text sizes are set for children: nothing under 14 px, titles 22, items 19, buttons 18. Montserrat for titles and messages, Poppins for everything else.

**What the device does on its own**

- Fetches its day plan from the server every five minutes and at midnight, with the plan already laid out (built-in rows, weekend times, day ties, get-ready time, auto-placed tasks, overlaps clamped, nothing past midnight).
- Runs the live day on its own clock: now and next, free time and the squeeze, the late focus, the last five minutes, bedtime and day over.
- Sends back "task done", "chore done", "reward asked" and the outfit, keeps them in flash while offline, and retries every twenty seconds.
- Remembers the day's progress and which celebrations it has shown, so a reboot or a reload shows nothing twice.
- Gets its clock from the network, falls back to the server's time, and runs the built-in demo day with no server at all.
- Chimes for start, done, tick, "soon", bedtime, and the MyToki chime (G5 then C6). Dims at night.

**The dock**

- Charges the handheld overnight and stands it up as the bedside clock.
- At night: a dim clock face and a night light. In the morning: ok-to-wake colour and a wake-up chime at the child's wake time. Stories are a possible addition.
- The dock is in the box; an extra dock is sold separately for a second bedroom.

**Firmware**

- Portable C on LVGL 9.5. The same app code runs in a browser simulator (compiled to WebAssembly) with a clickable housing, a controllable clock, demo days and headless screenshots used to check every screen against the Figma frames.
- The board build targets ESP-IDF 5.5 with Waveshare's board support package. It has not yet been compiled on real hardware.

**Still to build**

- A server endpoint that builds the day plan and accepts the events.
- Pairing and Wi-Fi setup from the parent app (today it is a build-time setting).
- Speech on the board, the night dock mode, the product enclosure and battery.

## Data, sync and integrations

Everything lives in one Supabase project ("Routines"): Postgres for the data, its sign-in for parents, live updates for the screens, and edge functions for the calendar.

**What is stored**

| Group | Tables | Notes |
| --- | --- | --- |
| Family | profiles, households, household\_members, household\_invites, household\_pins | One household per parent; invites by link or email; the PIN is a bcrypt hash no client can read |
| Children | children, routines, checklist\_templates | Times for built-in rows (weekday and weekend), school days, rest dates, display mode, pet outfit, stars |
| The day | tasks, task\_completions, task\_sessions, holidays, day\_notes, parent\_events | Tasks carry kind, timing, days, late policy, steps, get-ready minutes, one-day moves and skips |
| Rewards | rewards, reward\_purchases | Purchases carry pending, approved, denied |
| Calendar | google\_calendar\_connections, google\_calendar\_events | One connection per parent; a map of what was pushed |

**Rules that keep the data honest**

- Stars move only through server functions: give stars for a completion, undo it, approve or refund a reward, redeem one for the child, adjust by hand. Each is one atomic step that checks the balance and cannot run twice.
- One completion per task per day, enforced by the database. A second "done" reuses the first row.
- Built-in row names are reserved, and there is exactly one of each per child.
- Every table is protected by household membership. Members can only read and write their own family; children's screens read through the same rule.
- Sign-out on a parent's phone never signs out a child's device.

**Live updates**

- Child and parent screens subscribe to changes on tasks, completions, children, rewards, purchases, holidays, notes and parent events. A parent edit shows on the child's screen within seconds.
- Every screen refetches on reconnect, when it comes back online, and every five minutes, because an always-on screen never gets a tab-visibility event.
- Parent-side pollers run only while the tab is visible, so a forgotten tab cannot drain the database.

**Google Calendar**

- Parents connect their own Google account. Children's events (one-off and repeating, with skipped and moved days handled) and parents' appointments are pushed out with the child's name in front. Siblings' shared events merge into one entry.
- Sync is one way, out of MyToki. Importing is planned for MyToki Assist.
- Sync runs after each relevant edit and on a schedule; failures are shown in Settings with a reconnect button.

**For the handheld (to build)**

- A day-plan endpoint that lays out one child's day (the same rules as the child's web screen) and returns it as JSON, keyed by a device token.
- An events endpoint that accepts task done, chore done, reward asked and outfit changes from the device.
- Device pairing: a parent claims a device for a child from the app, and the device gets its Wi-Fi settings and token.

**Operating notes**

- The project is on Supabase's free tier, which has run out of burst budget after heavy days. Launch needs a paid tier.
- The Google OAuth app is still in testing mode, so refresh tokens expire after a week and parents have to reconnect. Publishing the app fixes this.
- The web app is served by Netlify and runs as a PWA. Times are fixed to Pacific for now.

## Pricing and business assumptions

These numbers come from the September market study, the October cost model and the October competitor analysis, and they are proposals to test, not decisions. The study's verdict: MyToki is worth a focused test, and it is too early to claim product-market fit. Full detail is in the [MyToki Market Study](https://claude.ai/code/artifact/25be0a9a-372d-4acf-81f9-fefabbe5a5db), the [cost model](https://claude.ai/code/artifact/e340ecd7-b6e8-4dc4-a9e2-89343c636ffe) and the [competitor analysis](https://claude.ai/code/artifact/16b66468-4448-499a-9c20-a7bbf3bc2dcb).

| What | Price | Note |
| --- | --- | --- |
| MyToki handheld with its dock | $79 | Test $59 and $89 too; early-bird around $59 to $65 |
| Two-pack, each MyToki with its own dock | $139 | Save $19; every extra MyToki is $60 |
| Three-pack, each MyToki with its own dock | $199 | Save $38 |
| Extra dock | $19 | For a second bedroom or the grandparents |
| MyToki Assist (per household, optional) | $4.99 a month or $39 a year | Optional. AI-planned schedules, school email and calendar import, new pets and games. The product is complete without it |

**What it costs us**

- Making and shipping one MyToki with its dock to a US warehouse is about $40 at 10,000 a year, $29 at 50,000 and $26 at 100,000 if customs treats it as a toy, and about $7 more if it is taxed as a Wi-Fi device. At 1,000 a year the molds and certification alone are $60 a unit, so a first run of 1,000 is a paid pilot, not a product.
- The $30 target needs about 50,000 a year with the AMOLED, or a 1.6-inch LCD, simpler audio and a plainer dock at 10,000, and the toy classification either way.
- Finding each family is planned at $40 to $80. At $79 and $40 to make, about $39 is left per unit before that cost at 10,000, or $32 after card fees and pick-and-pack; $50 at 50,000. On its own that does not pay for finding a family at 10,000. A two-pack ($51 after fees) or a three-pack ($69) does, and so does Assist taken by a third of buyers.
- A retailer's cut of 30 to 50% leaves $0 to $15 over cost at 10,000, so MyToki sells direct until volume brings the cost under $30.

**MyToki Assist**

- Optional, and the product is complete without it. Nothing a family needs to run the day ever moves behind the plan.
- What it does: plans and re-times the day from how the days actually go, drafts routines, turns a school email, flyer or calendar into the week's plan, imports Google Calendar, and brings new pets, outfits and games.
- Parents approve every draft. There is no chatbot for children.
- $4.99 a month or $39 a year per household. The AI costs about $0.30 to $1 per subscriber per month; after that and 60% renewal, Assist adds about $9 to $11 per buyer over two years at 20% uptake and $15 to $20 at 35%. That is what makes $79 pay for finding a family at 10,000 a year.

**Closest rivals**

- **Pets and trackers under $50** (Tamagotchi Paradise $45, Bitzee $30, Octopus $49 plus a plan): no Wi-Fi, made for $10 to $20. MyToki cannot match their price and competes on being a pet that also runs the day.
- **Screens with Wi-Fi at $70 to $90** (PawPal $69.99 on sale and $99.99 list, Hatch Rest $69.99, Yoto Mini $79.99, Garmin vivofit jr 3 $89.99): MyToki's band. They likely cost $20 to $40 to make, so a price war below $69 is one they survive and MyToki cannot until 50,000 a year. MyToki wins on the whole day, the squeeze and the dock, not on price. Like Hatch and Yoto, MyToki sells a complete product and offers a plan on top.
- **Routine systems at $170 and up, or that need a plan** (Cozyla Routie $169.99 plus $59.99 a year, Goally $189 to $249 plus $15 to $20 a month, Joon $89.99 a year, Brili $49.99 a year): MyToki undercuts all of them over two years with nothing a family has to subscribe to. Brili already shifts free time inside one routine on a tablet; MyToki's edge is the whole day and a pet the child carries.
- The real threat is not a price cut but Hatch or Yoto adding the day to a $70 device they already sell. MyToki's answer is what is hard to bolt on: the carried pet, the squeeze, and a day laid out by rules that keep parent and child in step. The full table is in the [competitor analysis](https://claude.ai/code/artifact/16b66468-4448-499a-9c20-a7bbf3bc2dcb).

## Success metrics

The pilot answers one question: does a child with MyToki get through the day with fewer prompts than the same child with the app on a tablet?

| Measure | Target | How and when |
| --- | --- | --- |
| Families still using it | 60% or more use it 4+ days a week in week 8 | 8-week pilot, 30 families, MyToki against the same app on a tablet |
| Parent prompts | Down by a quarter | Parent diary at week 1 and week 8 |
| Morning length | Shorter, from the parent's own count | Same diary |
| Setup time | A working week in under 10 minutes | Timed in the app from first screen to preview |
| Tasks done on time | Half or more of must-finish tasks done before they run late | From completions |
| Reward loop | Every request answered within a day | From purchases |
| Price | 3% or more of visitors reserve at $79, and half of them complete the purchase | $10 reservation test at $59, $79 and $89 |
| MyToki Assist | 10 or more paying households, 60% or more renew | Paid trial |
| Finding families | Under $25 per first order | Channel test |

Two signals to watch, not to target: child sessions should be short and frequent (look, act, put it down), and star counts should match the parent's memory of what they gave. Long sessions mean the child is waiting out a timer; mismatched stars mean a bug.

## Scope by release

The web app is done enough to test with families today. The device comes next, then a pilot decides whether to launch. Nothing below the pilot is funded until the pilot passes.

&#91;embedded content: roadmap · 6 steps, 5 gates\]

Each band is a step; the diamond under it is the gate the step has to pass before the next one starts. Dates are not set.

**In v1**

- Everything in the child and parent sections above, on the handheld and the phone.
- The dock as a bedside clock with ok-to-wake and a night light.
- Up to three children per household; two parents.
- Google Calendar export.

**Not in v1**

- The room radar. Any health or breathing wording, ever.
- A child-facing chatbot or voice assistant.
- Collectible add-ons beyond the lanyard and the extra dock. The board keeps space for NFC.
- A second pet. The art rules for one are written; the pet is not.

## Open questions and risks

**Open questions**

- [ ] Is MyToki the final name? The app still says MyToki, Happy Critter Routines and Taskie in places.
- [ ] Do pets have a gender? The brand rules say no; Biscuit is called "he" in practice.
- [ ] On the handheld's schedule wheel, do chores sit inside the wheel or as one "chores to do" row that opens the Chores page?
- [ ] Which of the remaining round screens need a younger-child version? Today only the schedule has one.
- [ ] Should the on-screen 1 o'clock cue be lime (the action colour) or match the green housing button?
- [ ] What happens to the day when the family travels across time zones? Everything is Pacific today.
- [ ] Does the dock tell stories, or is that a later add-on?
- [ ] Round LCD or AMOLED for the product version? This decides whether the cost target is reachable.

**Risks**

| Risk | Why it matters | What we do about it |
| --- | --- | --- |
| The board has never been compiled | The firmware is written against the board's support package but has only run in the simulator | Get the board and a machine with ESP-IDF; budget a week for surprises |
| Unit cost is above target | $40 a unit at 10,000 a year against a $30 target; under $30 takes 50,000 a year or a cheaper screen, and customs could add $7 by calling MyToki a Wi-Fi device | Get the toy customs ruling, quote a 1.6-inch LCD, sell direct, and make Assist the margin at 10,000 |
| Brili already does a form of the squeeze | Weakens the "nobody else does this" claim on a tablet | Lead with the whole day, the pet and the carried device; test side by side |
| PawPal owns the bedside pet idea | A cheaper, stationary rival for the docked half | Never sell MyToki as a clock; compare on the day routine |
| Free-tier database | It has already fallen over after heavy days | Move to a paid tier before the pilot |
| No star ledger | Manual adjustments are not recorded and deleting a task erases its history, so reports cannot reconcile | Add a ledger before the pilot |
| Few automated tests | Scheduling rules live in several places and regress easily | Grow the Node tests around the day layout and the squeeze |
| Google OAuth in testing mode | Parents must reconnect their calendar every week | Publish the OAuth app |
| Base tables missing from migrations | A fresh environment cannot be rebuilt from the repo | Capture the base schema as a migration |
