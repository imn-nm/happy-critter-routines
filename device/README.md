# MyToki on the device

The child's round screen, built for the **Waveshare ESP32-S3-Touch-AMOLED-1.75C** (466 × 466 AMOLED, CO5300 over QSPI, CST9217 touch, ES8311 speaker, 8 MB PSRAM). It follows the Figma board **Circle Display Updated** (node 609:2719) and its **MyToki Circle** design system: the whole day from the morning alarm to the night clock on the dock, the button at 1 o'clock, the carousel, picture view and Playtime. The shared parts (header, time pill, message cards, Biscuit's bubble, side buttons, the Next pill) are placed and coloured as the Figma components are; `platform/sim/snap.mjs` renders every screen so it can be laid next to its Figma frame.

The same C code runs in two places:

- **The simulator**: compiled to WebAssembly, running in a browser with a clickable housing, a controllable clock and demo days.
- **The board**: an ESP-IDF project built on Waveshare's own board support package.

The only differences live in `platform/`.

```
device/
  app/                 the child app: portable C on LVGL 9.5 (identical on both platforms)
    mytoki.c             controller: today's plan, progress, which screen, the button, sounds
    day.c, logic.c     the day plan, and the live day (a port of ChildInterface + timeReserve.ts)
    ui/                Field Kit screens: Home, Rewards, Chores, schedule, overlays, the wheel
    pet/               Biscuit: behaviour engine (port of SpritePet.tsx) + the LED-field renderer
    play/              Playtime: menu (two pages), Dress up, Bath time, Carrot catch, Bubble pop, Peekaboo,
                       Roll home, Biscuit says, Carrot stack (the motion games, see app/motion.h)
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

The same firmware runs inside the child view: `/child/:childId/circle` (the round button at the top of the child's screen) draws the Circle on a canvas and feeds it the child's real day, built by `src/lib/dayPlan.ts` from the same schedule the list view uses (`src/utils/todaysSchedule.ts`). What the child does on it (a task or chore done, a reward asked for, an outfit) is saved the way the list view saves it. After changing `app/`, run `npm run circle:build` to rebuild `public/mytoki.wasm`.

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

Install ESP-IDF 5.5 (or 6.0), then:

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
idf.py build flash monitor
```

Under **MyToki** in menuconfig:

- **Wi-Fi network and password.**
- **Day plan URL:** leave it empty to run the built-in demo day with no server.
- **Events URL.**
- **Device token.**
- **Time zone:** Pacific by default, the same as the web app.
- **Button GPIO:** BOOT (GPIO0) until the enclosure's own button is wired.

The component manager fetches Waveshare's BSP (`waveshare/esp32_s3_touch_amoled_1_75c` ^3.0.0) and LVGL 9.5.0, the versions Waveshare's `02_lvgl_demo_v9` uses.

What the board layer does (`main/hal_esp32.c`):

| | |
|---|---|
| Display, touch | the BSP (`bsp_display_start`, CO5300 QSPI + CST9217); LVGL runs in the BSP's task, and every call into the app takes `bsp_display_lock` |
| Clock | SNTP when online; the server's `Date` header as a fallback; the firmware's build time with no network, so the demo runs offline |
| Day plan | `GET` the plan URL with `Authorization: Bearer <token>`, refreshed every 5 minutes and at midnight |
| Events | `POST` to the events URL; kept in NVS and retried every 20 s while offline |
| Storage | NVS namespace `mytoki`: the day's progress, celebrations already shown, the outfit, the game bests (`carrot-best`, `maze-best-0..2`, `says-best`, `stack-best`) |
| Button | GPIO, active low, 30 ms debounce |
| Motion | the board's QMI8658 over the BSP's I2C bus at 100 Hz (`CONFIG_MYTOKI_IMU`), handed to `mytoki_motion()`; the product's LIS2DH12 swaps in behind the same call, its click interrupt feeding `motion_add_taps()`. The axis mapping (`IMU_AX/AY/AZ`, `IMU_S*`) is set on the bench |
| Sound | chimes synthesised into the ES8311 (start, done, tick, "soon", the MyToki chime G5→C6, bedtime) |
| Speech | not on the board yet (picture view's read-aloud is a no-op there; the simulator uses the browser's voice) |
| Brightness | `bsp_display_brightness_set`: dimmed at night |

> **Not yet built on hardware.** The board project was written against the BSP 3.0.0 API but hasn't been compiled here: this machine has no ESP-IDF. The simulator build compiles the same `app/` code with Clang and no warnings.

## How it's put together

- **Biscuit is the web app's rabbit, frame for frame.** `tools/pet_export.mjs` bundles `src/components/pets/pixel` with esbuild and exports two things as C data (`app/pet/pet_data.c`, about 450 KB of flash):
  - every frame of the 15 clips, plus a per-frame overlay for each of the 18 outfit items;
  - 36 Playtime poses and the three Playtime rooms.

  `pet/pet.c` ports SpritePet's behaviour engine: moods, habits, intro/loop/outro, taps, personality from the child's id. `pet/led.c` draws the Field Kit LED field: unlit dots, lit room features, Biscuit solid, a mint glow under his feet, and the lime sparkles when he cheers.
- **The day.** The server does what `getTodaysSchedule` does (built-in rows, weekend times, `tieDay`, events with get-ready time, auto-placement) and sends concrete times (`docs/day-plan.md`). The device does the live part on its own clock (`logic.c`): finishing early frees the rest of the window, a must-finish task running late eats free time first (the worm), now/next, overdue focus and "other things to finish", the last 5 minutes, bedtime, day over.
- **Screens** follow the MyToki Circle components pixel for pixel: Montserrat for titles and messages, Poppins for labels and pills, Lucide line icons, lavender message cards (lime for steps and checklists), cream speech bubbles, the dot ring, the lime arc at 1 o'clock. Today's schedule is the board's three-row wheel (swipe up or down to turn it, sideways to close; chores after the timed rows, tap a ring to tick one); the rewards page is Biscuit's shop (the shelves and bunting are the Figma scene sampled into an LED grid by `tools/art.py`, the pictures its Reward art); the free-time wheel is the game-show wheel with the Spin / Play switch; Playtime fills the display with its scene. The older Unbounded and Space Grotesk fonts are still compiled in but no screen uses them.
- **Motion** lives in `app/ui/fx.c` and follows the Reward Unlocked mock (`artifacts/reward-burst/index.html`). An approved reward and a new star play the whole sequence: the icon arrives in the middle while 24 dots charge round it; at 0.7 s the burst (a flash, three dot shockwaves, faint rays, a hundred pieces of confetti, the chime, the screen jolts), Biscuit's window switches on from the centre and he springs out in his Celebrate clip, the icon flies up to the header (the star flies into the stars pill and the count ticks up), three dot rings spring into place and keep twinkling, the title's words pop in one after another, his bubble rises; then the party keeps going until the child swipes it away: every landing throws sparks from his paws and a little confetti drizzles down. The same pieces, smaller, play elsewhere: the burst over the scene when a task, an event's get-ready or the whole day is done (the day adds the halo), a window-on and a hop for I'm up and Welcome home, a popping tick with a shockwave and pieces for a chore (Biscuit jumps for it), a popping dot and a ripple for a step, the wheel's result springing in while the bulbs all blink, the Playtime circles springing in, score pills popping, reward and reminder screens fading up, the bubble hopping on new words. It is all LVGL animations on plain objects plus one custom-drawn burst object; LVGL 9 applies opacity to children, so fades need no layers, and only small things scale. Biscuit's landings come from his own frames (`pet_set_on_land`), so sparks fall exactly where his paws touch down. `node platform/sim/fxtour.mjs [scene...]` renders frames of each moment into `build/fx/`, and `python tools/frames.py [scene...]` lays them out in rows.
- **Assets** are generated and checked in, so the board build needs no Node:
  - `node tools/fonts.mjs`
  - `node tools/icons.mjs`
  - `node tools/pet_export.mjs` (re-run when the rabbit's clips change)
  - `python tools/art.py` (the shop's pictures and shelves, from the Figma renders in `tools/art/`)

  Run `python tools/setup.py --assets` first.

## Not done yet

- **A server endpoint for the plan.** Today the simulator and the board use demo plans. The next step is a Supabase Edge Function that builds `docs/day-plan.md` from the parent's data and accepts the events.
- **Device pairing and Wi-Fi setup.** With no device token the board shows its pairing code (`mytoki_day_failed(3)`); the app side that turns the code into a token does not exist yet, and Wi-Fi still comes from menuconfig.
- **Motion on hardware.** The QMI8658 task is written against the datasheet and the esp-bsp I2C helpers (`bsp_i2c_init`, `bsp_i2c_get_handle`) but has never run; the axis signs need a bench test, and knocks may need the sensor's own click detector.
- **Speech on the board.** The dock and the battery are read through `hal_docked()` and `hal_battery()`, which the board answers with "no" and 100% until the enclosure's charger-detect pin and fuel gauge exist.
