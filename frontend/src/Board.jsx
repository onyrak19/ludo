import React from "react";
import { COLORS, START, SAFE, HEX, LIGHT, DARK, TRACK, HOME, BASES, QUADRANTS, pawnXY } from "./board.js";

export default function Board({ state, shown, myIndex, busy, onPawn }) {
  const canPlay = state.status === "playing" && state.turn === myIndex && state.dice !== null && !busy;
  const turnColor = state.status === "playing" ? state.players[state.turn].color : null;

  // Positions affichées, avec léger décalage quand plusieurs pions partagent une case
  const raw = [];
  state.players.forEach((pl, i) => {
    const ci = COLORS.indexOf(pl.color);
    shown[i].forEach((p, k) => {
      const [x, y] = pawnXY(ci, p, k);
      raw.push({ i, k, ci, x, y, p, walking: p !== state.pawns[i][k] });
    });
  });
  const groups = {};
  raw.forEach((r) => { (groups[`${r.x.toFixed(2)},${r.y.toFixed(2)}`] ||= []).push(r); });
  Object.values(groups).forEach((g) => g.forEach((r, idx) => {
    if (g.length > 1 && r.p !== -1) {
      const a = (idx / g.length) * Math.PI * 2;
      r.x += Math.cos(a) * 0.2; r.y += Math.sin(a) * 0.2; r.s = 0.78;
    }
  }));
  raw.sort((a, b) => Number(a.walking) - Number(b.walking));

  return (
    <svg className="board" viewBox="0 0 15 15" role="img" aria-label="Plateau de Ludo">
      <defs>
        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="0.14" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {COLORS.map((c) => (
          <radialGradient key={c} id={`orb-${c}`} cx="0.35" cy="0.3" r="0.85">
            <stop offset="0" stopColor={LIGHT[c]} />
            <stop offset="0.45" stopColor={HEX[c]} />
            <stop offset="1" stopColor={DARK[c]} />
          </radialGradient>
        ))}
      </defs>

      <rect width="15" height="15" rx="0.5" fill="#060c24" stroke="#22e1ff" strokeOpacity="0.35" strokeWidth="0.08" />

      {QUADRANTS.map(([x, y], ci) => {
        const c = COLORS[ci];
        return (
          <g key={ci}>
            <rect x={x + 0.1} y={y + 0.1} width="5.8" height="5.8" rx="0.6" fill={HEX[c]} fillOpacity="0.12"
              stroke={HEX[c]} strokeOpacity={turnColor === c ? 1 : 0.5} strokeWidth="0.08"
              className={turnColor === c ? "quad turn" : "quad"} filter="url(#glow)" />
            {BASES[ci].map(([bx, by], k) => (
              <circle key={k} cx={bx} cy={by} r="0.55" fill="#060c24" stroke={HEX[c]} strokeOpacity="0.45" strokeWidth="0.05" />
            ))}
          </g>
        );
      })}

      {TRACK.map(([c, r], i) => {
        const so = START.indexOf(i);
        return (
          <g key={i}>
            <rect x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.14"
              fill={so >= 0 ? HEX[COLORS[so]] : "#0e1842"} fillOpacity={so >= 0 ? 0.8 : 1}
              stroke={so >= 0 ? HEX[COLORS[so]] : "#2b4390"} strokeOpacity="0.8" strokeWidth="0.04" />
            {SAFE.has(i) && so < 0 && (
              <text x={c + 0.5} y={r + 0.72} textAnchor="middle" fontSize="0.65" fill="#22e1ff" opacity="0.8">✦</text>
            )}
          </g>
        );
      })}

      {HOME.map((cells, ci) => cells.map(([c, r], j) => (
        <rect key={`${ci}-${j}`} x={c + 0.04} y={r + 0.04} width="0.92" height="0.92" rx="0.14"
          fill={HEX[COLORS[ci]]} fillOpacity="0.5" stroke={HEX[COLORS[ci]]} strokeWidth="0.04" />
      )))}

      <g filter="url(#glow)" opacity="0.92">
        <polygon points="6,6 7.5,7.5 6,9" fill={HEX.red} />
        <polygon points="6,6 9,6 7.5,7.5" fill={HEX.green} />
        <polygon points="9,6 9,9 7.5,7.5" fill={HEX.yellow} />
        <polygon points="6,9 9,9 7.5,7.5" fill={HEX.blue} />
      </g>

      {raw.map((p) => {
        const pl = state.players[p.i];
        const clickable = canPlay && p.i === myIndex && state.movable.includes(p.k);
        return (
          <g key={`${p.i}-${p.k}`} className={`pawn${clickable ? " can" : ""}${p.walking ? " walking" : ""}`}
            opacity={pl.out ? 0.3 : 1} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
            onClick={clickable ? () => onPawn(p.k) : undefined}>
            <ellipse cy="0.3" rx="0.3" ry="0.12" fill="#000" opacity="0.5" />
            <g className="hop">
              {clickable && <circle r="0.56" fill="none" stroke="#fff" strokeWidth="0.06" strokeDasharray="0.2 0.14" className="ring" />}
              <circle r={0.36 * (p.s || 1)} fill={`url(#orb-${pl.color})`} stroke={LIGHT[pl.color]} strokeWidth="0.05" filter="url(#glow)" />
              <ellipse cx="-0.1" cy="-0.14" rx="0.1" ry="0.06" fill="#fff" opacity="0.7" />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
