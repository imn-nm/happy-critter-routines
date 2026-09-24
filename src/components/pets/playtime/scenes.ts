import { LH, LW, makeScene } from "./stage";

/** Backdrops for the three activities, drawn once. */

const CARROT_PIC = [[16, 12], [17, 12], [15, 13], [16, 13], [14, 14], [15, 14], [13, 15], [14, 15], [13, 16]];

export const denScene = makeScene((R) => {
  R(0, 0, LW, LH, "#2b4843");
  R(0, 38, LW, 14, "#264039");
  R(0, 38, LW, 1, "#355650");
  R(7, 8, 16, 14, "#6d5238");
  R(8, 9, 14, 7, "#5d8f93");
  R(8, 16, 14, 5, "#4a7d4f");
  for (const [x, y] of CARROT_PIC) R(x, y, 1, 1, "#f7945a");
  for (const [x, y] of [[17, 11], [18, 10], [18, 11]]) R(x, y, 1, 1, "#8fd16a");
  R(70, 7, 20, 17, "#6d5238");
  R(71, 8, 18, 15, "#8ec5e0");
  R(79, 8, 1, 15, "#6d5238");
  R(71, 15, 18, 1, "#6d5238");
  R(73, 11, 5, 2, "#f4fbff");
  R(74, 10, 2, 1, "#f4fbff");
  R(82, 18, 5, 2, "#f4fbff");
  R(69, 24, 22, 1, "#7d6655");
  R(0, 52, LW, 12, "#1b2d2a");
  R(0, 52, LW, 1, "#243b37");
  R(0, 61, LW, 1, "#20342f");
  R(22, 55, 52, 5, "#3a5c56");
  R(20, 56, 56, 3, "#3a5c56");
  R(24, 57, 48, 1, "#46716a");
});

export const bathScene = makeScene((R) => {
  R(0, 0, LW, 52, "#29435f");
  for (let x = 2; x < LW; x += 6) R(x, 0, 1, 52, "#2f4d6c");
  for (let y = 5; y < 52; y += 6) R(0, y, LW, 1, "#2f4d6c");
  R(6, 5, 15, 23, "#7fa2c0");
  R(5, 6, 17, 21, "#7fa2c0");
  R(6, 6, 15, 21, "#3b6282");
  for (let i = 0; i < 7; i++) {
    R(8 + i, 17 - i, 1, 1, "#5d89ab");
    R(11 + i, 19 - i, 1, 1, "#5d89ab");
  }
  R(76, 12, 16, 1, "#7fa2c0");
  R(78, 13, 11, 16, "#f6adc3");
  R(78, 25, 11, 1, "#f17097");
  R(78, 27, 11, 1, "#f17097");
  R(0, 52, LW, 12, "#1c3047");
  R(0, 52, LW, 1, "#284260");
});

export const gardenScene = makeScene((R) => {
  R(0, 0, LW, 48, "#3b6a78");
  R(8, 7, 12, 2, "#5b8c98");
  R(11, 6, 5, 1, "#5b8c98");
  R(60, 12, 14, 2, "#5b8c98");
  R(63, 11, 7, 1, "#5b8c98");
  R(0, 38, LW, 10, "#2f5a4d");
  R(4, 35, 24, 3, "#2f5a4d");
  R(10, 33, 12, 2, "#2f5a4d");
  R(56, 36, 34, 2, "#2f5a4d");
  R(64, 34, 16, 2, "#2f5a4d");
  R(0, 46, LW, 18, "#3b6f43");
  R(0, 46, LW, 1, "#4c8752");
  for (const [x, y, col] of [[6, 50, "#f17097"], [14, 54, "#ffe07a"], [80, 52, "#ffe07a"], [88, 49, "#f6adc3"]] as const) {
    R(x, y + 1, 1, 4, "#2e5e35");
    R(x - 1, y, 3, 1, col);
    R(x, y - 1, 1, 3, col);
    R(x, y, 1, 1, "#ffe07a");
  }
});

/** The tub sits in front of the rabbit; rows 44 and below are bath. */
export function drawTub(R: (x: number, y: number, w: number, h: number, c: string) => void, foamy: boolean, now: number) {
  R(23, 44, 50, 1, "#ffffff");
  R(22, 45, 52, 2, "#eef3f8");
  R(23, 47, 50, 9, "#dfe6ee");
  R(23, 47, 3, 9, "#c9d3de");
  R(70, 47, 3, 9, "#c9d3de");
  R(24, 55, 48, 1, "#c9d3de");
  R(27, 56, 4, 3, "#c7a86b");
  R(65, 56, 4, 3, "#c7a86b");
  for (let x = 24; x < 72; x++) {
    const h = (x * 5 + Math.floor(now / 260)) % 4;
    if (foamy) {
      R(x, 43, 1, 1, h % 2 ? "#ffffff" : "#bfe6f7");
      if (h === 0) R(x, 42, 1, 1, "#ffffff");
    } else R(x, 43, 1, 1, h === 0 ? "#bfe6f7" : "#9fd3ef");
  }
}
