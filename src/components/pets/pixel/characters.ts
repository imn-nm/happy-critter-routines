import { Pix } from "./pix";
import { eyes as eyeShape, mouth as mouthShape, type Eyes, type Mouth } from "./sprites";
import type { AccessorySlot, PetView } from "./accessories";

/*
 * The friends beside Biscuit: robot, fox, dino and dragon. Their resting
 * drawings are the ones in assets/pets/pets.svg (5 px cells there, one cell
 * here); each has its colour options from assets/pets/pets-colors.svg.
 *
 * They have Biscuit's poses: resting (the 3/4 view facing left), facing you,
 * cheer (her chunky T-pose arms), wave (the left arm tilted up) and asleep (the
 * robot dozes standing, its box head pitched forward; the rest lie down, their
 * own resting heads lowered to the floor). Feet sit on row 39 throughout.
 * Drawn in Illustrator and converted cell for cell: the dragon facing you
 * (assets/pets/dragon_front.svg) and the robot asleep (assets/pets/robot_sleep.svg,
 * colours folded into the robot's parts, the closed eyes made single lines).
 *
 * A grid's letters are the character's own parts; a colour option swaps the
 * colour of a part, so the shapes never change. Eyes are drawn with the
 * rabbit's eye shapes, so every look she has (blink, happy, up, down) works.
 */

export type FriendId = "robot" | "fox" | "dino" | "dragon";
export type FriendPose = "rest" | "front" | "cheer" | "wave" | "sleep";

export interface ColourOption {
  name: string;
  /** Part letter (or the rabbit's palette key) to colour. */
  colours: Record<string, string>;
}

/** Where Biscuit's outfit pieces go on a friend: moved from her drawing in the same view by (dx, dy). */
export interface Fit {
  dx: number;
  dy: number;
  /** Glasses whose lenses sit further apart or closer: cells from column `at` move by this instead. */
  split?: { at: number; dx: number };
}

export interface PoseArt {
  /** Rows of part letters; "." is empty. The grid's first cell is at (left, top). */
  grid: readonly string[];
  left: number;
  top: number;
  /** Top-left of each 4x4 eye; empty when the drawing has them closed. */
  eyes: readonly (readonly [number, number])[];
  /** Where a mouth (under the nose at x) and rosy cheeks go, as on Biscuit. */
  face?: { nose: number; mouth: number; cheeks: readonly (readonly [number, number])[] };
}

export interface Friend {
  id: FriendId;
  name: string;
  parts: Record<string, { name: string; colour: string }>;
  /** The eyes' part and what shows round them when they close. */
  eyePart: string;
  eyeBack: string;
  /** The part arms and a held paw take their colour from. */
  fur: string;
  rest: PoseArt;
  front: PoseArt;
  asleep: PoseArt;
  /** Facing you: the body's left and right columns and the row the arms start at. */
  /** waveGap: the waving arm keeps a dark line of space under a head wider than the body. */
  arms: { left: number; right: number; top: number; waveGap?: boolean };
  fits: Record<PetView, Record<AccessorySlot | "hold", Fit>>;
  colours: ColourOption[];
}

export const FRIENDS: Record<FriendId, Friend> = {
  robot: {
    id: "robot",
    name: "Robot",
    parts: {
      s: { name: "Shell", colour: "#b9c4d8" },
      d: { name: "Shell side", colour: "#6784b8" },
      t: { name: "Shell face", colour: "#c4cfe4" },
      k: { name: "Screen", colour: "#2c2838" },
      e: { name: "Eyes", colour: "#ffffff" },
    },
    eyePart: "e",
    eyeBack: "k",
    fur: "s",
    rest: {
      left: -3,
      top: 6,
      grid: [
        ".sssssssssssssssssssddddddddd.",
        "ssssssssssssssssssssdddddddddd",
        "ssskkkkkkkkkkkkkksssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkeeeekkkkeeeekkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "sskkkkkkkkkkkkkkkkssdddddddddd",
        "ssskkkkkkkkkkkkkksssdddddddddd",
        "ssssssssssssssssssssdddddddddd",
        ".sssssssssssssssssssddddddddd.",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        "........sssssssssssdddd.......",
        ".........ssssssssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........",
        ".........sssss.ssssddd........",
      ],
      eyes: [[1, 15], [9, 15]],
    },
    front: {
      left: -1,
      top: 6,
      grid: [
        ".ssssssssssssssssssssss.",
        "dssssssssssssssssssssssd",
        "dssskkkkkkkkkkkkkkkksssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkeeeekkkkeeeekkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dsskkkkkkkkkkkkkkkkkkssd",
        "dssskkkkkkkkkkkkkkkksssd",
        "dssssssssssssssssssssssd",
        ".ssssssssssssssssssssss.",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        ".....sdssssssssssds.....",
        "......dssssssssssd......",
        ".......ssssssssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss.......",
        ".......ssss..ssss.......",
      ],
      eyes: [[5, 15], [13, 15]],
    },
    asleep: {
      left: -6,
      top: 4,
      grid: [
        ".......ssssssssssssssssssd......",
        ".......sssssssssssssssssddd.....",
        "......ssssssssssssssssssddd.....",
        ".....ssssssssssssssssssddddd....",
        "....ssssssssssssssssssdddddd....",
        "....sssssssssssssssssddddddd....",
        "...sssssssssssssssssddddddddd...",
        "..ssssssssssssssssssddddddddd...",
        ".ssssssssssssssssssdddddddddd...",
        ".tttttttttttttttttdddddddddddd..",
        "ttttttttttttttttttttdddddddddd..",
        ".ttkkkkkkkkkkkkkktttdddddddddd..",
        ".ttkkkkkkkkkkkkkkkttddddddddddd.",
        ".ttkkkkkkkkkkkkkkkktddddddddddd.",
        "..tkkkkkkkkkkkkkkkkttdddddddddd.",
        "..ttkkkkkkkkkkkkkkkttddddddddddd",
        "..ttkkkkkkkkkkkkkkkktddddddddddd",
        "...tkkkkkkkkkkkkkkkkttdddddddddd",
        "...ttkkeeeekkkeeeekkttddddddddd.",
        "...ttkkkkkkkkkkkkkkkktdddddddd..",
        "....tkkkkkkkkkkkkkkkkttddddddd..",
        "....ttkkkkkkkkkkkkkkkttdddddd...",
        "....ttkkkkkkkkkkkkkkkktddddd....",
        ".....tkkkkkkkkkkkkkkkkttddd.....",
        ".....ttkkkkkkkkkkkkkkkttddd.....",
        ".....ttkkkkkkkkkkkkkkkttdd......",
        "......tttttttttttttttttttd......",
        ".......tttttttttttttttttdd......",
        "...........sssssssssssdddd......",
        "...........sssssssssssdddd......",
        "...........sssssssssssdddd......",
        "............ssssssssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd.......",
        "............sssss.ssssddd.......",
      ],
      eyes: [],
    },
    arms: {left: 5, right: 16, top: 28, waveGap: true},
    // Its head is taller and its eyes closer together than Biscuit's.
    fits: {
      side: { head: {dx: 0, dy: -6}, face: {dx: -1, dy: -1, split: {at: 9, dx: -2}}, neck: {dx: -1, dy: 2}, hold: {dx: 0, dy: 1} },
      front: { head: {dx: 0, dy: -6}, face: {dx: 1, dy: -1, split: {at: 11, dx: -1}}, neck: {dx: 0, dy: 2}, hold: {dx: 0, dy: 0} },
      sleep: { head: {dx: 0, dy: 19}, face: {dx: 0, dy: 19}, neck: {dx: 0, dy: 19}, hold: {dx: 0, dy: 19} },
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Mint", colours: { s: "#c6ead9", d: "#4fae8e", t: "#d3f0e3" } },
      { name: "Sunny", colours: { s: "#ffe28a", d: "#f0a93b", t: "#ffe9a6" } },
      { name: "Coral", colours: { s: "#ffc4b5", d: "#e0584f", t: "#ffd0c4" } },
    ],
  },
  fox: {
    id: "fox",
    name: "Fox",
    parts: {
      f: { name: "Fur", colour: "#f7935a" },
      c: { name: "Cream", colour: "#f8f4e1" },
      t: { name: "Tips", colour: "#8f6546" },
      e: { name: "Eyes", colour: "#010101" },
      n: { name: "Nose", colour: "#000000" },
    },
    eyePart: "e",
    eyeBack: "f",
    fur: "f",
    rest: {
      left: 0,
      top: 2,
      grid: [
        ".....t.........tt..............",
        ".....tt.......ttt..............",
        ".....ff.......ffff.............",
        "....ffff.....fffff.............",
        "....fcff.....ffcff.............",
        "....fccff...ffccff.............",
        "...fcccff...ffcccff............",
        "...fccccff.ffccccff............",
        "...ffffffffffffffff............",
        "...ffffffffffffffff............",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "..fffffffffffffffffff..........",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "ffeeeefffffeeeefffffffff.......",
        "fccccccnnccccccccfffffff.......",
        "cccccccnnccccccccfffffff.......",
        "ccccccccccccccccccffffff...cc..",
        "ccccccccccccccccccffffff..ccc..",
        "..cccccccccccccffffff....ccccc.",
        "..cccccccccccccffffff....ccccc.",
        ".......cccccccffffff....cccccc.",
        ".......cccccccffffff....ffffff.",
        ".....ffcccccccffffffff..fffffff",
        ".....ffcccccccffffffff..fffffff",
        ".....fccccccffffffffff.ffffffff",
        ".....fccccccffffffffff.ffffffff",
        ".....fccccffffffffffff.ffffffff",
        ".....fccccffffffffffff.ffffffff",
        ".....ffccfffffffffffff.ffffffff",
        ".....ffccfffffffffffff.ffffffff",
        ".....fffffffffffffffffffffffff.",
        ".....ffffffffffffffffffffffff..",
        "...ttttttfffffffttttttffffff...",
        "...ttttttfffffffttttttfffff....",
      ],
      eyes: [[2, 16], [11, 16]],
      face: { nose: 7, mouth: 22, cheeks: [[2, 21], [3, 21], [13, 21], [14, 21]] },
    },
    front: {
      left: -1,
      top: 2,
      grid: [
        ".....t............t.....",
        ".....tt..........tt.....",
        "....fff..........fff....",
        "....ffff........ffff....",
        "....fcff........ffcf....",
        "...ffccff......ffccff...",
        "...ffcccf......fcccff...",
        "...ffcccff....ffcccff...",
        "...ffccccff..ffccccff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        "...ffffffffffffffffff...",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeeffffffeeeeffff.",
        ".ffffeeeecccccceeeeffff.",
        ".ccccccccccnncccccccccc.",
        "cccccccccccnnccccccccccc",
        "cccccccccccccccccccccccc",
        "cccccccccccccccccccccccc",
        "...cccccccccccccccccc...",
        "...cccccccccccccccccc...",
        "......fffccccccfff......",
        "......fffccccccfff...cc.",
        ".....ffffccccccffff.cccc",
        ".....ffffccccccffff.cccc",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....ffffccccccfffffffff",
        ".....fffffffffffffffffff",
        ".....fffffffffffffffffff",
        ".....tttttt..tttttt.....",
        ".....tttttt..tttttt.....",
      ],
      eyes: [[4, 16], [14, 16]],
      face: { nose: 10, mouth: 22, cheeks: [[3, 21], [4, 21], [17, 21], [18, 21]] },
    },
    asleep: {
      left: 0,
      top: 16,
      grid: [
        ".....t.........tt....................",
        ".....tt.......ttt....................",
        ".....ff.......ffff...................",
        "....ffff.....fffff...................",
        "....fcff.....ffcff...................",
        "....fccff...ffccff...................",
        "...fcccff...ffcccff..................",
        "...fccccff.ffccccff..................",
        "...ffffffffffffffff..................",
        "...ffffffffffffffff..................",
        "..fffffffffffffffffff................",
        "..fffffffffffffffffff................",
        "..fffffffffffffffffffffffffffffff....",
        "..fffffffffffffffffffffffffffffff....",
        "ffffffffffffffffffffffffffffffffff...",
        "ffffffffffffffffffffffffffffffffff...",
        "ffeeeefffffeeeeffffffffffffffffffffff",
        "fffffffffffffffffffffffffffffffffffff",
        "fccccccnnccccccccffffffffffffffffffff",
        "cccccccnnccccccccffffffffffffffffffff",
        "cccccccccccccccccccffffffffffffffffff",
        "cccccccccccccccccccffffffffffffffffff",
        "..ttttttcccccccccccffffffffffffffffff",
        "..ttttttcccccccccccffffffffffffffffff",
      ],
      eyes: [],
    },
    arms: {left: 4, right: 17, top: 28},
    // Its head and eyes sit where Biscuit's do.
    fits: {
      side: { head: {dx: 0, dy: 0}, face: {dx: 0, dy: 0}, neck: {dx: 0, dy: 0}, hold: {dx: 0, dy: 0} },
      front: { head: {dx: 0, dy: 0}, face: {dx: 0, dy: 0}, neck: {dx: 0, dy: 0}, hold: {dx: 0, dy: 0} },
      sleep: { head: {dx: 0, dy: 19}, face: {dx: 0, dy: 19}, neck: {dx: 0, dy: 19}, hold: {dx: 0, dy: 19} },
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Arctic", colours: { f: "#dfe6ef", c: "#ffffff", t: "#8e9bb0" } },
      { name: "Golden", colours: { f: "#eda93a", c: "#fffbf2", t: "#5b3a24" } },
      { name: "Midnight", colours: { f: "#4f5fb8", c: "#f8f4e1", t: "#fee07b" } },
    ],
  },
  dino: {
    id: "dino",
    name: "Dino",
    parts: {
      b: { name: "Body", colour: "#7cc35b" },
      d: { name: "Nostrils", colour: "#4e9a44" },
      p: { name: "Plates", colour: "#f7935a" },
      e: { name: "Eyes", colour: "#000000" },
    },
    eyePart: "e",
    eyeBack: "b",
    fur: "b",
    rest: {
      left: 0,
      top: 5,
      grid: [
        ".......................ppp...........",
        ".......bbbbbbbbbbbbbbbbbpp...........",
        ".......bbbbbbbbbbbbbbbbbpp...........",
        ".....bbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbppp.........",
        ".....beeeebbbbbeeeebbbbbbb...........",
        ".....beeeebbbbbeeeebbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp.........",
        "bdbbbdbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp......bbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbppp....ppbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......ppbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......bbbbb",
        ".....bbbbbbbbbbbbbbbbbbbbbb...ppbbbb.",
        "..........bbbbbbbbbbbbbbbbb...ppbbbb.",
        "..........bbbbbbbbbbbbbbbbb..bbbbbbb.",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbbbb.",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbbbbb...",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".........bbbbbbbbbbbbbbbbbbbbbb......",
        ".......bbbbbbbb....bbbbbbb...........",
        ".......bbbbbbbb....bbbbbbb...........",
      ],
      eyes: [[6, 11], [15, 11]],
    },
    front: {
      left: 1,
      top: 1,
      grid: [
        "........pppp...........",
        "........pppp...........",
        ".......pppppp..........",
        ".......pppppp..........",
        ".......pppppp..........",
        "...bbbbbbbbbbbbbb......",
        "...bbbbbbbbbbbbbb......",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..beeeebbbbbbeeeeb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb.....",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbdbbbbbbdbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        "bbbbbbbbbbbbbbbbbbbb...",
        ".bbbbbbbbbbbbbbbbbb....",
        ".bbbbbbbbbbbbbbbbbb....",
        "....bbbbbbbbbbbb.......",
        "....bbbbbbbbbbbb.......",
        "..bbbbbbbbbbbbbbbb.....",
        "..bbbbbbbbbbbbbbbb..ppp",
        "..bbbbbbbbbbbbbbbb..ppp",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbbbbbbbbbbbbbbbb",
        "..bbbbbbb..bbbbbbb.....",
        "..bbbbbbb..bbbbbbb.....",
      ],
      eyes: [[4, 10], [14, 10]],
    },
    asleep: {
      left: 0,
      top: 20,
      grid: [
        ".......................ppp...................",
        ".......bbbbbbbbbbbbbbbbbpp...................",
        ".......bbbbbbbbbbbbbbbbbpp...................",
        ".....bbbbbbbbbbbbbbbbbbbbb...................",
        ".....bbbbbbbbbbbbbbbbbbbbb...................",
        ".....bbbbbbbbbbbbbbbbbbbbppp.................",
        ".....bbbbbbbbbbbbbbbbbbbbpppp................",
        ".....bbbbbbbbbbbbbbbbbbbbpppp.ppp............",
        ".....beeeebbbbbeeeebbbbbbbppp.ppp............",
        ".....bbbbbbbbbbbbbbbbbbbbbbbbbbbbb...........",
        ".....bbbbbbbbbbbbbbbbbbbbpppbbbbbb...........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbppp........",
        "bdbbbdbbbbbbbbbbbbbbbbbbbpppbbbbbbppp........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbppp........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbb....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbb.ppp",
        "bbbbbbbbbbbbbbbbbbbbbbbbbpppbbbbbbbbbbbbbbbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      ],
      eyes: [],
    },
    arms: {left: 3, right: 18, top: 28},
    // Box head higher than Biscuit's; in 3/4 it is further right too, the snout in front.
    fits: {
      side: { head: {dx: 4, dy: -6}, face: {dx: 4, dy: -5}, neck: {dx: 5, dy: 0}, hold: {dx: 4, dy: 1} },
      front: { head: {dx: 0, dy: -6}, face: {dx: 0, dy: -6}, neck: {dx: 0, dy: 0}, hold: {dx: 0, dy: 0} },
      sleep: { head: {dx: 0, dy: 19}, face: {dx: 0, dy: 19}, neck: {dx: 0, dy: 19}, hold: {dx: 0, dy: 19} },
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Sky", colours: { b: "#6fb6ea", d: "#3f80bf", p: "#ffe07b" } },
      { name: "Lava", colours: { b: "#e45f52", d: "#a8372f", p: "#ffd166" } },
      { name: "Sunny", colours: { b: "#f7cf4f", d: "#c79a1e", p: "#35b8a8" } },
    ],
  },
  dragon: {
    id: "dragon",
    name: "Dragon",
    parts: {
      b: { name: "Body", colour: "#7962ab" },
      d: { name: "Horns and spikes", colour: "#5c429a" },
      g: { name: "Wings and belly", colour: "#fee07b" },
      h: { name: "Belly stripes", colour: "#f5b543" },
      e: { name: "Eyes", colour: "#000000" },
    },
    eyePart: "e",
    eyeBack: "b",
    fur: "b",
    rest: {
      left: 0,
      top: 2,
      grid: [
        "........dd.........dd.................",
        "........dd.........dd.................",
        ".......dddd.......dddd................",
        ".......dddd.......dddd................",
        ".......bbbbbbbbbbbbbbbbb..............",
        ".......bbbbbbbbbbbbbbbbb..............",
        ".....bbbbbbbbbbbbbbbbbbbbb............",
        ".....bbbbbbbbbbbbbbbbbbbbb............",
        ".....bbbbbbbbbbbbbbbbbbbbbdd..........",
        ".....beeeebbbbbeeeebbbbbbbdd..........",
        ".....beeeebbbbbeeeebbbbbbbdd........bb",
        ".....beeeebbbbbeeeebbbbbbbdd.......bbg",
        ".....beeeebbbbbeeeebbbbbbbdd......bbgg",
        ".....bbbbbbbbbbbbbbbbbbbbbdd.....bbggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb......bbgggg",
        "bdbbbdbbbbbbbbbbbbbbbbbbbb.....bbggggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbb..bbgggggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbb..bbggggbgg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb..bbggggbggg",
        "bbbbbbbbbbbbbbbbbbbbbbbbbb.bbggggbgggb",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb.",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb..",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbggggbgggb...",
        ".....bbbbbbbbbbbbbbbbbbbbgggbgggg..dd.",
        "..........bggggggbbbbbbbgggbbggb...dd.",
        "..........bhhhhhhbbbbbbb..........bbb.",
        ".........bbggggggbbbbbbbbb......ddbbb.",
        ".........bbggggggbbbbbbbbb......ddbbb.",
        ".........bbhhhhhhbbbbbbbbbb....bbbbbb.",
        ".........bbggggggbbbbbbbbbb..ddbbbbbb.",
        ".........bbggggggbbbbbbbbbb..ddbbbbb..",
        ".........bbhhhhhhbbbbbbbbbbbbbbbbbbb..",
        ".........bbggggggbbbbbbbbbbbbbbbbbbb..",
        ".........bbggggggbbbbbbbbbbbbbbbbbbb..",
        ".........bbhhhhhhbbbbbbbbbbbbbbbb.....",
        ".........bbbbbbbbbbbbbbbbbbbbbbbb.....",
        ".......bbbbbbbb....bbbbbbb............",
        ".......bbbbbbbb....bbbbbbb............",
      ],
      eyes: [[6, 11], [15, 11]],
    },
    front: {
      left: -9,
      top: 2,
      grid: [
        "..............dd........dd..............",
        "..............dd........dd..............",
        ".............dddd......dddd.............",
        ".............dddd......dddd.............",
        ".............bbbbbbbbbbbbbb.............",
        ".............bbbbbbbbbbbbbb.............",
        "..........bbbbbbbbbbbbbbbbbbbb..........",
        "..........bbbbbbbbbbbbbbbbbbbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "..........bbbeeeebbbbbbeeeebbb..........",
        "........bbbbbbbbbbbbbbbbbbbbbbbb........",
        "....b...bbbbbbbbbbbbbbbbbbbbbbbb...b....",
        "...bbb..bbbbbbbbbbbbbbbbbbbbbbbb...bb...",
        "..bbbgggbbbbbbbbbbbbbbbbbbbbbbbbgggbbb..",
        ".bbggggggbbbbbbbdbbbbbbdbbbbbbbggggggbb.",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggbbbbbbbbbbbbbbbbbbbbbbgggggggbb",
        "bbgggggggggbbbbbbbbbbbbbbbbbbgggggggggbb",
        "bbgggggggggbbbbbbbbbbbbbbbbbbgggggggggbb",
        "bbggggggggggg.bbbggggggbbb.gggggggggggbb",
        "bb..gg..ggggg.bbbhhhhhhbbb.ggggg..gg..bb",
        "........gg...bbbbggggggbbbb...gg........",
        ".............bbbbggggggbbbb.............",
        ".............bbbbhhhhhhbbbb.....dd......",
        ".............bbbbggggggbbbbbb...dd......",
        ".............bbbbggggggbbbbbb...bb......",
        ".............bbbbhhhhhhbbbbbbbbbbb......",
        ".............bbbbggggggbbbbbbbbbbb......",
        ".............bbbbggggggbbbbbbbbbbb......",
        ".............bbbbhhhhhhbbbbbbbbbbb......",
        ".............bbbbbbbbbbbbbbbbbbbbb......",
        ".............bbbbbb..bbbbbb.............",
        ".............bbbbbb..bbbbbb.............",
      ],
      eyes: [[4, 10], [14, 10]],
    },
    asleep: {
      left: 0,
      top: 17,
      grid: [
        "........dd.........dd..........................",
        "........dd.........dd..........................",
        ".......dddd.......dddd.........................",
        ".......dddd.......dddd.........................",
        ".......bbbbbbbbbbbbbbbbb.......................",
        ".......bbbbbbbbbbbbbbbbb.......................",
        ".....bbbbbbbbbbbbbbbbbbbbb..bb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbbbgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddgb.................",
        ".....beeeebbbbbeeeebbbbbbbddgb.................",
        ".....bbbbbbbbbbbbbbbbbbbbbddbbbbbb.............",
        ".....bbbbbbbbbbbbbbbbbbbbbddbbbbbb.............",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.............",
        "bdbbbdbbbbbbbbbbbbbbbbbbbbbbbbbbbb..dd.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..dd.........",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb......",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbd.....",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbd..ddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbgbbbbbbbbbbbbbbbbddd",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbggbbbbbbbbbbbbbbbbb..",
      ],
      eyes: [],
    },
    arms: {left: 4, right: 17, top: 28},
    // The same head as the dino's.
    fits: {
      side: { head: {dx: 4, dy: -6}, face: {dx: 4, dy: -5}, neck: {dx: 5, dy: 0}, hold: {dx: 4, dy: 1} },
      front: { head: {dx: 0, dy: -6}, face: {dx: 0, dy: -6}, neck: {dx: 0, dy: 0}, hold: {dx: 0, dy: 0} },
      sleep: { head: {dx: 0, dy: 19}, face: {dx: 0, dy: 19}, neck: {dx: 0, dy: 19}, hold: {dx: 0, dy: 19} },
    },
    colours: [
      { name: "Original", colours: {} },
      { name: "Emerald", colours: { b: "#4fae6b", d: "#2f7a47", g: "#fee07b", h: "#f5b543" } },
      { name: "Ruby", colours: { b: "#d9534f", d: "#9c2f2f", g: "#ffd27a", h: "#f0a33a" } },
      { name: "Ocean", colours: { b: "#3f8fd2", d: "#2a5f9e", g: "#9ff0dd", h: "#5cc9b5" } },
    ],
  },
};

/** Biscuit's colour options, keyed by her palette keys: W fur, O inner ears, P nose. */
export const RABBIT_COLOURS: ColourOption[] = [
  { name: "Original", colours: {} },
  { name: "Cocoa", colours: { W: "#9c6d4c", O: "#f6c9a8", P: "#f17097" } },
  { name: "Storm", colours: { W: "#a9b2c3", O: "#f7945a", P: "#f17097" } },
  { name: "Blush", colours: { W: "#f5d7cf", O: "#c06866", P: "#c94f79" } },
];

/** A copy of `p` with some colours swapped (palette keys or part colours). */
export function recolour(p: Pix, swap: Record<string, string>) {
  const out = new Pix();
  p.each((x, y, c) => out.set(x, y, swap[c] ?? c));
  return out;
}

/** Which of Biscuit's views a pose's outfit is drawn in. */
export const poseView = (pose: FriendPose): PetView => (pose === "rest" ? "side" : pose === "sleep" ? "sleep" : "front");

/**
 * Biscuit's chunky T-pose arms at the sides of a body, or for a wave only the
 * left one, tilted up (one row of lift per column out from the body at full
 * tilt); as on Biscuit, the other arm stays down at its side.
 */
function addArms(p: Pix, { left, right, top, waveGap }: Friend["arms"], c: string, tilt = 0) {
  // The head is everything above the arms' row. With waveGap the waving arm stays out of it and
  // leaves one empty row under it, so arm and head read apart (the robot's box).
  const head = (x: number, y: number) => y < top && !!p.get(x, y);
  const gap = (x: number, y: number) => head(x, y) || head(x, y - 1);
  // the thin arm drawn at its side lifts with it, so clear its top cell under the head too
  if (tilt && waveGap) for (let x = left - 5; x < left; x++) if (gap(x, top)) p.del(x, top);
  for (let i = 0; i < 5; i++) {
    const y0 = i === 4 ? top + 1 : top, y1 = i === 4 ? top + 4 : top + 5;
    const lift = Math.round(tilt * i);
    for (let y = y0; y <= y1; y++) {
      const x = left - 1 - i, yy = y - lift;
      if (!(tilt && waveGap && gap(x, yy))) p.set(x, yy, c);
      if (!tilt) p.set(right + 1 + i, y, c);
    }
  }
}

export interface FriendOpts {
  pose?: FriendPose;
  /** A colour option's name; the original colours when missing. */
  colour?: string;
  eyes?: Eyes;
  mouth?: Mouth;
  blush?: boolean;
  /** Waving: how far the arm is tilted up, 1 at the top of the wave (Biscuit's waveLow is 0.5). */
  armTilt?: number;
}

/** A friend in a pose, cells coloured (as "#rrggbb"). */
export function friend(id: FriendId, o: FriendOpts = {}) {
  const f = FRIENDS[id];
  const pose = o.pose ?? "rest";
  const a = pose === "rest" ? f.rest : pose === "sleep" ? f.asleep : f.front;
  const option = f.colours.find(c => c.name === o.colour) ?? f.colours[0];
  const colourOf = (part: string) => option.colours[part] ?? f.parts[part]?.colour ?? part;
  const p = new Pix();
  a.grid.forEach((row, y) => [...row].forEach((c, x) => p.set(x + a.left, y + a.top, c === "." ? null : c)));
  if (pose === "cheer" || pose === "wave") addArms(p, f.arms, f.fur, pose === "wave" ? o.armTilt ?? 1 : 0);
  // Close or move the eyes with the rabbit's shapes.
  const kind = o.eyes ?? "open";
  if (kind !== "open" && a.eyes.length) {
    for (const [ex, ey] of a.eyes) for (let y = ey; y < ey + 4; y++) for (let x = ex; x < ex + 4; x++) p.set(x, y, f.eyeBack);
    const e = new Pix();
    eyeShape(e, kind, a.eyes.map(([x]) => x), a.eyes[0][1]);
    e.each((x, y, c) => { if (c === "K") p.set(x, y, f.eyePart); });
  }
  const out = recolour(p, Object.fromEntries(Object.keys(f.parts).map(k => [k, colourOf(k)])));
  if (a.face) {
    if (o.mouth) mouthShape(out, o.mouth, a.face.nose, a.face.mouth);
    if (o.blush) for (const [x, y] of a.face.cheeks) out.set(x, y, "R");
  }
  return out;
}

/** The colour a held paw should take on this friend, in a colour option. */
export function furColour(id: FriendId, colour?: string) {
  const f = FRIENDS[id];
  const option = f.colours.find(c => c.name === colour) ?? f.colours[0];
  return option.colours[f.fur] ?? f.parts[f.fur].colour;
}
