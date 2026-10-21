# MyToki on the device

The child's round screen, built for the **Waveshare ESP32-S3-Touch-AMOLED-1.75C** (466 × 466 AMOLED, CO5300 over QSPI, CST9217 touch, ES8311 speaker, 8 MB PSRAM). It follows the Figma section **Child UI · New UI** (node 1052:5356) and its **MyToki 2** design system: the whole day from the morning alarm to the night clock on the dock, the button at 1 o'clock, the carousel, picture view and Playtime. Biscuit's room fills the round screen and shrinks into the middle circle once fewer than 10 minutes are left; a dashed timer runs round the rim (mint, amber under 10 minutes, coral when running late); the hill at the bottom says what's next and opens the day. Today's schedule, Chores and Other things to finish are wheels: the row now sits on the focus line, the ones before and after are smaller and fainter, and the list scrolls under the finger and always stops on a row: a flick moves exactly one row, a longer drag lands on the row nearest the line (`wheel_released` in `ui/widgets.c`). The shared parts (Header, Pill, Timer, Hill, Note, Speech, Side nav, Button, Tab) are placed and coloured as the Figma components are; `platform/sim/snap.mjs` renders every screen so it can be laid next to its Figma frame.

The same C code runs in two places:

- **The simulator**: compiled to WebAssembly, running in a browser with a clickable housing, a controllable clock and demo days.
- **The board**: an ESP-IDF project built on Waveshare's own board support package.

The only differences live in `platform/`.

```
device/
  app/                 the child app: portable C on LVGL 9.5 (identical on both platforms)
    mytoki.c             controller: today's plan, progress, which screen, the button, sounds
    day.c, logic.c     the day plan, and the live day (a port of ChildInterface + timeReserve.ts)
    ui/                MyToki 2 screens: Home, Rewards, Chores, schedule, overlays, the wheel
    pet/               the pet: behaviour engine (port of SpritePet.tsx) + the LED-field renderer; the frames
                       of Biscuit, the Robot and the Fox, each in four colours (pet_data.c, from tools/pet_export.mjs)
    play/              Playtime: menu (two pages), Dress up, Bath time, Carrot catch, Bubble pop, Peekaboo,
                       Roll home, Biscuit says, Carrot stack (the motion games, see app/motion.h), and My buddy
                       (the child picks their character and its colour; saved as pet_type + pet_color)
    assets/            generated fonts and line icons
    vendor/cjson/      cJSON (MIT)
    hal.h              what a platform provides (clock, network, storage, sound, speech)
    motion.c           the accelerometer's signals: tilt, shake, knocks, holding still
  platform/
    sim/               browser simulator: main_sim.c, web/ (page, housing, demo plans), build.py
    esp32s3/           ESP-IDF project for the board: main.c, hal_esp32.c, sdkconfig.defaults
  tools/               generators: fonts.mjs, icons.mjs, pet_export.mjs, setup.py
  docs/day-plan.md     the JSON the device reads every day
```

## On the web app

The same firmware is the child view: `/child/:childId` draws the Circle on a canvas (the older list view is at `/child/:childId/list`) and feeds it the child's real day, built by `src/lib/dayPlan.ts` from the same schedule the list view uses (`src/utils/todaysSchedule.ts`). What the child does on it (a task or chore done, a reward asked for, an outfit, their buddy) is saved the way the list view saves it. The device draws Biscuit, the Robot and the Fox; a child whose character is not on the device yet (Dino, Dragon) sees Biscuit there. After changing `app/`, run `npm run circle:build` to rebuild `public/mytoki.wasm`.

## The server (for the handheld)

A handheld gets the same plan from the `mytoki-device` Supabase Edge Function (`supabase/functions/mytoki-device`). `GET` answers with today's plan: it loads what the browser's hooks load and builds it with the browser's own code (`src/lib/devicePlan.ts`, bundled into the function's `plan.js` by `npm run device:function`). `POST` takes one event (`docs/day-plan.md`) and saves it as `ChildCircleView` does, after checking the task, reward or note is this child's. An event keeps its own date and time, so what the child did offline lands when it happened. What can never be saved is answered 200 "ignored", since the handheld retries anything else, oldest first.

Each handheld has its own token, tied to one child in `mytoki_devices`. The table keeps only the token's SHA-256, and the parent sees the token once, when they connect it in the child's settings (`src/components/MyTokiConnect.tsx`). The gateway's JWT check is off for this function (`supabase/config.toml`), as the function checks the token itself.

After changing the plan code, run `npm run device:function`, then deploy:

```bash
npx supabase@2.121.0 functions deploy mytoki-device --project-ref xbtgkklhdhgwxtzbcvgd --no-verify-jwt --use-api
```

## Run the simulator

You need Python 3.10+ and git. Node is only needed to regenerate assets.

```bash
python device/tools/setup.py
```

```bash
python device/platform/sim/run.py
```

`setup.py` fetches the Zig C compiler (from PyPI, into `device/.tools`) and LVGL v9.5.0 (into `device/third_party`). `run.py` builds `mytoki.wasm` and opens http://localhost:5190.

Using the simulator:

- **Touch:** click the round screen. Drag to swipe.
- **Real size:** a switch in the panel (and "Real size 1.75″" under the web app's Circle) draws the screen 1.75 inches across, the handheld's own size (CSS inches, so true on a screen at 100 % zoom).
- **The button at 1 o'clock:** the green cap on the housing, or <kbd>Space</kbd>.
- **Clock:** use the slider, the ±5 min / ±1 h buttons, the jumps to each task, and the speed (up to 300×).
- **Demo plans:** a school day, running late, a weekend, a free day and a rest day. There are toggles for picture view (under 7), for no internet, and for whether the device is paired with a grown-up's app (unpaired shows the pairing code).
- **The handheld:** a toggle for sitting on its dock (the night clock from Goodnight on, and charging), a battery level (10% and below shows "Put me on my dock"), and the pretend accelerometer: a round **Tilt** pad (or the arrow keys while the page has focus), **Shake** (600 ms of 1.5 g wobble) and **Knock** (one sharp spike). They drive the motion games on Playtime's second page: Roll home (tilt), Biscuit says (tilt, shake, tap, the button, hold still) and Carrot stack (hold still, tilt). Carrot catch runs on tilt too.
- **Grown-up actions:** approve a reward, say no to one, give a star, give a streak star, the last streak star, the crash screen.
- **The morning:** the alarm sounds at wake-up time and the ring turns from sky to lime as the room lights up; the button is "I'm up"; a quick drag down snoozes it for five minutes (twice at most, and nothing on screen says so).

What the device sends (tasks done, chores, reward requests, outfits) appears under **Sent to the server**. The page plays the server's part, so a reload keeps it.

### Headless snapshots

`platform/sim/snap.mjs` runs the same `mytoki.wasm` in Node with a scripted clock and taps, and writes PNGs. It's how every screen was checked against the Figma frames:

```bash
node device/platform/sim/snap.mjs shots.json device/build/snaps
```

## Run it on the board

Install ESP-IDF 5.5 (it builds with 5.5.6). On Windows, Espressif's installer does it in one go and adds an "ESP-IDF PowerShell" shortcut, the terminal to run `idf.py` in:

```bash
winget install Espressif.EIM-CLI
```

```bash
eim install -i v5.5.6 -t esp32s3
```

Plug the board in with a USB-C cable that carries data (hold BOOT while plugging in if no COM port appears), then:

```bash
cd device/platform/esp32s3
```

```bash
idf.py set-target esp32s3
```

```bash
idf.py menuconfig
```

```bash
idf.py -p COM5 build flash monitor
```

Use the board's own port in place of COM5. <kbd>Ctrl</kbd>+<kbd>]</kbd> leaves the monitor. Menuconfig can be skipped for the demo day. Under **MyToki** in menuconfig:

- **Wi-Fi network and password.**
- **Day plan URL, Events URL and Device token:** "Connect a MyToki" in the child's settings (Settings → the child's edit button, or the settings sheet on their dashboard) gives the token, shown once, and the URL, the same for both (the `mytoki-device` Edge Function, below). Leave the URL empty to run the built-in demo day with no server.
- **Time zone:** Pacific by default, the same as the web app.
- **Start time with no network:** empty starts the clock at the firmware's build time; a time like 15:20 starts the demo day there (after school: school hours lock the carousel).
- **Button GPIO:** BOOT (GPIO0) until the enclosure's own button is wired.

The component manager fetches Waveshare's BSP (`waveshare/esp32_s3_touch_amoled_1_75c` ^3.0.0) and LVGL 9.5.0, the versions Waveshare's `02_lvgl_demo_v9` uses.

What the board layer does (`main/main.c`, `main/hal_esp32.c`):

| | |
|---|---|
| Display, touch | the BSP's panel and touch (`bsp_display_new`, `bsp_touch_new`: CO5300 QSPI at 40 MHz + CST9217) handed to LVGL by `main.c` with its own draw buffers: two of 64 rows in internal RAM, which the SPI driver sends straight out (it can't from PSRAM: 466 px rows never meet its 64-byte alignment, so it tried to copy every strip into internal RAM and failed). LVGL runs in the adapter's task with a 16 KB stack; every call into the app takes `bsp_display_lock` |
| Clock | SNTP when online; the server's `Date` header as a fallback; the firmware's build time with no network, so the demo runs offline |
| Day plan | `GET` the plan URL with `Authorization: Bearer <token>`, refreshed every 5 minutes and at midnight |
| Events | `POST` to the events URL; kept in NVS and retried every 20 s while offline |
| Storage | NVS namespace `mytoki`: the day's progress, celebrations already shown, the outfit, the game bests (`carrot-best`, `maze-best-0..2`, `says-best`, `stack-best`) |
| Button | GPIO, active low, 30 ms debounce; queued and handed to the app by an LVGL timer, like motion |
| Motion | the board's QMI8658 over the BSP's I2C bus at 100 Hz (`CONFIG_MYTOKI_IMU`), handed to `mytoki_motion()` in LVGL's task; the product's LIS2DH12 swaps in behind the same call, its click interrupt feeding `motion_add_taps()`. The axis mapping (`IMU_AX/AY/AZ`, `IMU_S*`) is set on the bench |
| Sound | chimes synthesised into the ES8311 (start, done, tick, "soon", the MyToki chime G5→C6, bedtime) |
| Speech | not on the board yet (picture view's read-aloud is a no-op there; the simulator uses the browser's voice) |
| Brightness | `bsp_display_brightness_set`: dimmed at night |
| Memory | internal RAM is kept for what needs it (the draw buffers, task stacks, the speaker's and the panel's DMA, Wi-Fi): the app's static buffers (Biscuit's room grids, the game stage, ~126 KB) live in PSRAM through `main/linker.lf`, LVGL allocates from PSRAM first (`main/lv_mem_psram.c`), and LVGL's code stays in flash rather than IRAM. Wi-Fi starts last, after the display has its buffers, with its code out of IRAM, fewer buffers than PSRAM's defaults (6 RX, 8 TX, RX window 6) and TLS buffers in PSRAM: with the defaults the display, then Wi-Fi, failed to start |

Runs on the board (first flashed 2026-10-20): screen, touch, the speaker, the QMI8658 and the demo day all come up. Changing `sdkconfig.defaults` doesn't touch an existing `sdkconfig`: delete it (it is generated and git-ignored) to pick the defaults up again.

**Speed on the board.** A frame where the whole screen changes (a page turn, the day's sheet rising) takes about 60 ms to draw, so those run at roughly 16 to 20 frames a second; Biscuit animating on Home costs about 7 ms a frame plus a ~10 ms partial redraw. What it took, and what to keep in mind when adding screens:

- `UI_DEPTH 0` (set in `main/CMakeLists.txt`): no effects that draw through a layer of their own every frame. The carousel slides flat instead of the pyramid (which managed 3 frames a turn), and the wheels' rows fade part by part without shrinking (`ui_row_scale`, `ui_row_fade`). Scaling something, `opa_layered`, blend modes and bitmap masks each cost a full off-screen render on this chip.
- Biscuit's rooms and the Playtime stage repaint only the cells that changed since the last frame and invalidate only that rectangle (`led_cache_t` in `pet/led.h`). Repainting the whole 466 px room took 64 ms a frame. The simulator and the web app keep invalidating the whole room, so they look exactly as before.
- LVGL calls a draw handler once per 64-row strip, so handlers that draw many small shapes skip the ones outside the strip (`ui_in_strip`): the timer's dashes alone made 500 draw tasks a frame.

To profile on the board, turn on LVGL's built-in profiler in `sdkconfig` (`CONFIG_LV_USE_PROFILER`, `CONFIG_LV_PROFILER_DRAW`, with `CONFIG_LV_PROFILER_INCLUDE="src/misc/lv_profiler_builtin.h"`, as the component folder isn't called `lvgl`) and give it a buffer of 1 MB in PSRAM, so it doesn't print mid-frame over the 115200-baud console.

## How it's put together

- **Biscuit is the web app's rabbit, frame for frame.** `tools/pet_export.mjs` bundles `src/components/pets/pixel` with esbuild and exports two things as C data (`app/pet/pet_data.c`, about 450 KB of flash):
  - every frame of the 15 clips, plus a per-frame overlay for each of the 15 outfit items;
  - 36 Playtime poses and the three Playtime rooms.

  `pet/pet.c` ports SpritePet's behaviour engine: moods, habits, intro/loop/outro, taps, personality from the child's id. `pet/led.c` draws the Field Kit LED field: unlit dots, lit room features, Biscuit solid, a mint glow under his feet, and the lime sparkles when he cheers.
- **The day.** The server does what `getTodaysSchedule` does (built-in rows, weekend times, `tieDay`, events with get-ready time, auto-placement) and sends concrete times (`docs/day-plan.md`). The device does the live part on its own clock (`logic.c`): finishing early frees the rest of the window, a must-finish task running late eats free time first (the worm), now/next, overdue focus and "other things to finish", the last 5 minutes, bedtime, day over.
- **Screens** follow the MyToki Circle components pixel for pixel: Montserrat for titles and messages, Poppins for labels and pills, Lucide line icons, lavender message cards (lime for steps and checklists), cream speech bubbles, the dot ring, the lime arc at 1 o'clock. Today's schedule is the board's three-row wheel (swipe up or down to turn it, sideways to close; chores after the timed rows, tap a ring to tick one); the rewards page is Biscuit's shop (the wall and bunting are the Figma scene sampled into an LED grid by `tools/art.py`; the rewards stand on shelves of three and two, and more shelves scroll up under the header, since 2026-10-19, so there is no cap on rewards: left and right always mean another screen, up and down always mean more of this one); the free-time wheel is the game-show wheel with the Spin / Play switch; Playtime fills the display with its scene. The older Unbounded and Space Grotesk fonts are still compiled in but no screen uses them.
- **Motion** lives in `app/ui/fx.c` and follows the Reward Unlocked mock (`artifacts/reward-burst/index.html`). An approved reward and a new star play the whole sequence: the icon arrives in the middle while 24 dots charge round it; at 0.7 s the burst (a flash, three dot shockwaves, faint rays, a hundred pieces of confetti, the chime, the screen jolts), Biscuit's window switches on from the centre and he springs out in his Celebrate clip, the icon flies up to the header (the star flies into the stars pill and the count ticks up), three dot rings spring into place and keep twinkling, the title's words pop in one after another, his bubble rises; then the party keeps going until the child swipes it away: every landing throws sparks from his paws and a little confetti drizzles down. The same pieces, smaller, play elsewhere: the burst over the scene when a task, an event's get-ready or the whole day is done (the day adds the halo), a window-on and a hop for I'm up and Welcome home, a popping tick with a shockwave and pieces for a chore (Biscuit jumps for it), a popping dot and a ripple for a step, the wheel's result springing in while the bulbs all blink, the Playtime circles springing in, score pills popping, reward and reminder screens fading up, the bubble hopping on new words. It is all LVGL animations on plain objects plus one custom-drawn burst object; LVGL 9 applies opacity to children, so fades need no layers, and only small things scale. Biscuit's landings come from his own frames (`pet_set_on_land`), so sparks fall exactly where his paws touch down. `node platform/sim/fxtour.mjs [scene...]` renders frames of each moment into `build/fx/`, and `python tools/frames.py [scene...]` lays them out in rows.
- **Moving between screens** is one connected piece of motion rather than cuts. The carousel's three round screens sit like a little pyramid: the one in front is full size on top, the ones beside it lower, smaller and dimmer, each clipped to its circle, and a swipe slides the next one up into place while the last one sinks back (the finger drives it, then a quick-off-the-mark, soft-landing turn finishes it; `UI_DEPTH 0` in `theme.h` keeps the plain slide for a board that can't afford the layers). Dragging up on Home leans the day up a little before the flick lifts the schedule sheet; the sheet then carries Home on up and dims it under a scrim, and pulling the sheet down by its header brings it back the same way. A tick never jumps: the ring fills from the middle, the tick pops in with a mint ripple, the row drifts to its done colour where it is, and only after a beat do the rows slide to their new places (a finished chore slides down to the end, a finished "other thing" fades and the rest close up, a ticked step turns the wheel to the next one). Every part comes and goes with motion rather than appearing: `ui_reveal` fades a part in while it rises and settles, and fades it out as it sinks (Home's room, timer, header, note, side buttons, the checklist, the wheel, Biscuit's bubble); the hill's words rise in when they change, a pill bounces when its mood changes, a note slides when its words change, the room eases into its new size, shelves pop when restocked, a fresh list's rows arrive one after another, a sheet's rows come up a beat behind its header. The easings are shared and physical: `ui_path_out` (quick off the mark, soft landing), `ui_path_settle` (a touch past the mark, then back) and `ui_path_spring` (a damped spring, for pops); dismissals keep the finger's speed. The turn has parallax: on each page the scene hangs back a little and the header, side buttons and hill lead (`home_parallax`, `rewards_page_parallax`, `chores_page_parallax`). The in-place tick is `checkbox_tick`, and the sliding re-sort is `wheel_list_mark` / `wheel_list_flip`.
- **Assets** are generated and checked in, so the board build needs no Node:
  - `node tools/fonts.mjs`
  - `node tools/icons.mjs`
  - `node tools/pet_export.mjs` (re-run when the rabbit's clips change)
  - `python tools/art.py` (the shop's pictures and shelves, from the Figma renders in `tools/art/`)

  Run `python tools/setup.py --assets` first.

## Not done yet

- **Device pairing and Wi-Fi setup.** A handheld is connected by pasting its token into menuconfig, and Wi-Fi comes from there too. The pairing the board was built for (it shows a 4-digit code with no token, `mytoki_day_failed(3)`, and the app sends Wi-Fi over Bluetooth) needs an app side that turns the code into a token.
- **Motion on hardware.** The QMI8658 answers on the board (who-am-I 0x05) and streams at 100 Hz, but the axis signs (`IMU_S*`) still need a bench test with the motion games, and knocks may need the sensor's own click detector.
- **Smoother full-screen motion.** Page turns and the day's sheet run at 16 to 20 frames a second on the board (see Speed on the board). The next step would be to draw each moving page once into a picture as the gesture starts and slide the pictures, rather than redrawing everything every frame.
- **Speech on the board.** The dock and the battery are read through `hal_docked()` and `hal_battery()`, which the board answers with "no" and 100% until the enclosure's charger-detect pin and fuel gauge exist.
