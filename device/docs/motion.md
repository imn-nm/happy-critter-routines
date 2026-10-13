# Motion: the accelerometer and the games that use it

MyToki has a 3-axis accelerometer (ST LIS2DH12 on the product; the Waveshare dev board carries a QMI8658, of which only the accelerometer is read). There is no gyro, so everything comes from acceleration alone.

## The device frame

+x to the right of the screen, +y toward 12 o'clock, +z out of the screen. Flat and screen up reads (0, 0, +1) g. Lowering the right edge gives ax < 0; lowering the bottom edge gives ay > 0.

The platform pushes samples at 50 to 100 Hz through `mytoki_motion(ax, ay, az)` (in g). `app/motion.c` turns them into:

| Signal | What it is | Starting values |
| --- | --- | --- |
| `motion_tilt(&x, &y)` | gravity through a 120 ms low-pass, as screen-space tilt -1..1 (x > 0: right edge low, y > 0: bottom edge low); 0.5 g (about 30 degrees) is full tilt, under 0.06 g is level | `MOTION_GRAV_TAU_MS`, `MOTION_TILT_FULL_G`, `MOTION_TILT_DEAD_G` |
| `motion_shake()` | the high-pass energy, peak-held and fading in 300 ms; 0.35 g is nothing, 1.5 g is 1.0 | `MOTION_SHAKE_*` |
| `motion_taps()` | knocks: one spike over 1.1 g that goes quiet within 120 ms (a shake keeps going); 200 ms between two | `MOTION_TAP_*` |
| `motion_still_ms()` | how long the high-pass energy has stayed under 0.08 g | `MOTION_STILL_G` |
| `motion_lean()` | distance from level, in g | |
| `motion_alive()` | a sample arrived in the last 600 ms (the platform has a sensor) | `MOTION_STALE_MS` |

Every filter is time-based with the sample gap clamped to 4..100 ms, so an uneven rate (several samples per LVGL tick, or a throttled browser tab) never changes the feel. `motion_reset()` at a game start forgets shakes, knocks and stillness.

## The games (Playtime, page 2)

- **Roll home**: tilt rolls a carrot (90 px/s² at full tilt, damped 1.8/s, 40 px/s at most) through a 13 x 11 hedge maze of 5 px cells; the carrot moves half a pixel at a time, one axis at a time, so it slides along hedges. Arriving in the gap in the right wall stops the clock; `maze-best-N` keeps the best milliseconds per maze.
- **Biscuit says**: a call every round; the answer window shrinks from 2.5 s to 1 s. Tilt moves need 0.4 of change from the tilt at the start of the window (the other axis under 0.3) and are ignored while shaking; a shake must stay over 0.6 for 150 ms; a tap is a screen tap or a knock; "Hold still" wins when the window ends quiet. `says-best`.
- **Carrot stack**: level (lean under 0.2 g) and quiet (shake under 0.2) for 1.5 s lands a carrot; the stack leans 1.2 px per level per unit of tilt and a level pushed past 4.5 px slides off with everything above it. `stack-best`.
- **Carrot catch**: tilt (over 0.12) runs Biscuit at up to 70 px/s; a touch wins for 800 ms.

## Testing it

- Simulator page: the Tilt pad, the arrow keys, Shake and Knock in "The handheld".
- Headless: `snap.mjs` steps `tilt: [x, y]`, `shake: ms`, `knock: n`, `still: ms`; recipes in `build/motion/shots.json`, contact sheet with `python device/build/motion/sheet.py`.
- Board: `CONFIG_MYTOKI_IMU` starts a 100 Hz task; set `IMU_AX/AY/AZ` and the signs in `hal_esp32.c` on the bench.
