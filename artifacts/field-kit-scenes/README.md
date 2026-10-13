# Field Kit scenes

Renders Biscuit's scenes from the app's own code for the Figma "Circle Display · Field Kit" section.
Each cell is marked as Biscuit (`s`, drawn solid in Figma), an effect (`f`, a lit dot) or room (`d`).

- `node build.js`: bundles `src/components/pets/pixel` and the playtime games with esbuild into `app.cjs`.
- `node render.js`: writes `scenes.json` (14 ring scenes at 80x80, the timer crop; 5 playtime stills at 96x64).
- `node preview.js`: writes `preview.png` using `ledstyle.js`, the same layout the Figma components use, so you can check it before sending to Figma.

To add a scene, add `[clip, frame]` to `RINGS` in `render.js` (frames are the same numbers the app uses).

## How the scenes are drawn in Figma (2026-10-06, LED field)

The style matches the illustration 589:2078. `ledstyle.js` holds the exact rules.

- The scene is a grid of LEDs: pitch 3.8 on the 232 ring scenes, 332/116 on the 332 playtime scenes. There is no ground fill (the component is transparent, clipped to a circle).
- **Unlit:** every LED is a dim #1B2721 dot, a little bigger toward the centre.
- **Room:** only the room's features light up, as dots in their own colours. Plain walls and floors (the `PLAIN` lists) stay unlit.
- **Biscuit:** solid squares on the same grid, so Biscuit is LED-sized.
- **Effects** (stars, notes, bubbles): full-size lit dots.
- **Celebrate:** the clip's own stars are left out. It gets 5 plus-shaped sparkles in #DCEF70 instead.
- **Floor glow:** a mint (#5FD9A0, 85%) patch of dots under Biscuit's feet, fading out to the sides and downward. The ring scenes have it, except the sleepy scenes; the games don't.
- Figma layers per scene: `LED · unlit`, `LED · room · <colour>`, `LED · floor glow`, `Biscuit · <colour>`, `LED · sparkle · <colour>`.

## Full-screen scenes in the device look (2026-10-07)

`node full.js Reading-15` writes `full-Reading-15.json` and a preview PNG. It follows the device renderer (`device/app/pet/led.c`), not the dark field above:

- The room fills the whole 466 screen. Cells past the room's box (scenes.ts X0..X1, Y0..Y1) repeat its edge cells and read as walls, the same rule as the Playtime stage.
- Walls and floors light up as softer dots with lifted colour (`vivid` 0.22/1.75/1.3); features use 0.08/1.3/1.2.
- Every lit LED sits on a square panel of its own colour, at 42% brightness in the middle and 20% at the rim. In Figma that's the "Panel shade" radial gradient over the panels.
- Biscuit stays solid on the 3.8 px grid, so he's the same size as in the ring. There's no floor glow.

In Figma: "Field Kit / Scene · Full screen / Reading-15" (613:3217), used by Task · In progress (609:3152).

`node full.js Reading-15 dim` gives the same full-screen field in the dim Figma style instead (the ledstyle.js rules over all 466 px). Only the room's features are lit; walls, floors and everything past the room's box stay as unlit dots, and the mint floor glow stays. In Figma it's "Field Kit / Scene · Full screen · dim / Reading-15" (627:3347), used by the standalone Task · In progress copy (625:5568).

### Bright → off fade (2026-10-07)

`node full.js Reading-15 both` exports each cell's kind and original colour. The Figma script then fades the device look out in one halftone transition (d = px from the centre of the 466 screen):

- **Full brightness** to d = 110, which covers the circle in the middle. This is the device look: panels, lifted colours and the "Panel shade" gradient.
- **From 110 to 196**, every LED shrinks about its own centre, its panel square and its dot together. Size is pitch × √(1 − smoothstep(110, 196, d)), so the lit area falls off smoothly.
- Colours never change, so there are no bands. The screen is black by 196, before the arc timer's dots at ~200.
- (A first try with a separate dim ring and 4 colour steps looked choppy.)

In Figma: "Field Kit / Scene · Full screen · fade / Reading-15" (632:3482), used by 625:6032.

A quick variant keeps the room in the ~122 px circle inside the dotted time ring and only softens its edge, like a halftone of round dots on black:

- From d = 100 to 130 each dot shrinks to ~45% of its size and dims to an unlit LED (#1b2721), in 10 colour steps from a quarter of the way in.
- The panels behind the dots stay full size, and their shade gradient reaches solid black by 130, so no square texture shows.
- Nothing is drawn past 130 (the ring's dots start at ~131).

In Figma: "Field Kit / Scene · Full screen · quick fade / Reading-15" (638:3712), used by 636:6663.

## Circle scenes, used across "Circle Display Updated" (2026-10-07)

`node circle.js` (after build.js and render.js) writes `circle.json`, every scene in the style of Task · In progress (636:7024). The style is the device's bright LED look (led.c) inside a hard-edged circle.

- **The 14 ring scenes:** a 244 circle at pitch 3.8, so Biscuit is the same size as in the old 232 scene. Dot size and the panel shade follow the full 466 screen, as in 636:7024: the shade runs from 0.58 in the middle to ~0.70 at the edge.
- **The 5 games:** a 332 circle at pitch 332/116. The stage's edge cells are stretched to fill it, as the device does. The shade runs 0.58 → 0.80.
- **Components:** "Field Kit / Scene · Circle / <name>" in the "Parts · Scenes · Circle" frame (643:3930) on that section's kit board.
- **Screens:** scenes are swapped in with the same centre and scaled by 244/232. Six screens keep their old circle size: Playtime · Menu (332, to match the games), and five whose dotted rings sit close to the scene (See you later, both New star!, Get-ready reminder, Loading).

**Darker walls, no panels (2026-10-07).** The user tuned three frames by hand (Still sleepy time, Wake Up, Homework): they removed the colour panels and darkened the wall and floor dots. All 19 circle components now match:

- No `Panel · …` layers and no "Panel shade". The dots sit straight on ink.
- Wall and floor dots use the user's exact colours for the den, bedroom and study. In the den: #2b4843 → #476d67, #1b2d2a and #20342f → #255149, #243b37 → #32665c, and the bands #264039 → #14352c, #355650 → #29534b. In the bedroom: #22244a → #363973, #17182f → #1e1f51. In the study: #34304e → #443b83, #221f35 → #1d145e. The bedroom and study floors (#202144, #2c2842) keep their lifted colour.
- Every other room's walls take the feature colour (`vivid` 0.08/1.3/1.2) instead of the lifted wall colour, which is close to the user's picks.

## Circle 286 (2026-10-12)

The screens moved Biscuit's circle from 244 to 286 (Figma "Section 5" 901:12472: the time ring became a 49-dot open arc at r 160 with the gap at the bottom, older-child headers lost their icon). Rather than re-render, the 14 ring scenes were extended in Figma: "Field Kit / Scene · Circle 286 / <name>" (new rows in "Parts · Scenes · Circle" 643:3930) keeps every dot of the 244 scene on the same 3.8 px grid, offset by 21, and fills the outer band (r 122 to 143) by copying the nearest wall, floor or band cell further in along the same row (or column above and below). Small room features are not extended, so a bookshelf does not smear outward. Biscuit, sparkles and the glow are unchanged. Screens place it at (90, 90); the time ring vector sits at (73, 73).
