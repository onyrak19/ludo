// Géométrie du plateau (grille 15x15). Les indices suivent exactement ceux du backend (ludo.py).
export const COLORS = ["red", "green", "yellow", "blue"];
export const START = [0, 13, 26, 39];
export const SAFE = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
export const HEX = { red: "#ff3b5c", green: "#2bff9c", yellow: "#ffd23f", blue: "#2fa8ff" };
export const LIGHT = { red: "#ffb0bd", green: "#c4ffe4", yellow: "#fff2b0", blue: "#b3e0ff" };
export const DARK = { red: "#8f0026", green: "#007a49", yellow: "#a87c00", blue: "#00479a" };

const seq = (a, b) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => (a <= b ? a + i : a - i));

export const TRACK = [
  ...seq(1, 5).map((c) => [c, 6]),
  ...seq(5, 0).map((r) => [6, r]),
  [7, 0], [8, 0],
  ...seq(1, 5).map((r) => [8, r]),
  ...seq(9, 14).map((c) => [c, 6]),
  [14, 7], [14, 8],
  ...seq(13, 9).map((c) => [c, 8]),
  ...seq(9, 14).map((r) => [8, r]),
  [7, 14], [6, 14],
  ...seq(13, 9).map((r) => [6, r]),
  ...seq(5, 0).map((c) => [c, 8]),
  [0, 7], [0, 6],
];

export const HOME = [
  seq(1, 5).map((c) => [c, 7]),
  seq(1, 5).map((r) => [7, r]),
  seq(13, 9).map((c) => [c, 7]),
  seq(13, 9).map((r) => [7, r]),
];

export const BASES = [
  [[1.5, 1.5], [3.5, 1.5], [1.5, 3.5], [3.5, 3.5]],
  [[10.5, 1.5], [12.5, 1.5], [10.5, 3.5], [12.5, 3.5]],
  [[10.5, 10.5], [12.5, 10.5], [10.5, 12.5], [12.5, 12.5]],
  [[1.5, 10.5], [3.5, 10.5], [1.5, 12.5], [3.5, 12.5]],
];

const CENTER = [[6.55, 7.5], [7.5, 6.55], [8.45, 7.5], [7.5, 8.45]];
export const QUADRANTS = [[0, 0], [9, 0], [9, 9], [0, 9]];

export function pawnXY(ci, p, k) {
  if (p === -1) return BASES[ci][k];
  if (p <= 50) { const [c, r] = TRACK[(START[ci] + p) % 52]; return [c + 0.5, r + 0.5]; }
  if (p <= 55) { const [c, r] = HOME[ci][p - 51]; return [c + 0.5, r + 0.5]; }
  const [x, y] = CENTER[ci];
  return [x + (k % 2) * 0.12 - 0.06, y + Math.floor(k / 2) * 0.12 - 0.06];
}
