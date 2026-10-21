import React, { useRef } from "react";

// Rotation du cube pour montrer chaque face de face
const BASE = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export default function Die({ last, color, canRoll, onRoll }) {
  const n = last?.n ?? 0;
  const seen = useRef(n);
  const spins = useRef(0);
  if (seen.current !== n) { seen.current = n; spins.current += 1; }

  const [bx, by] = BASE[last?.value ?? 1];
  const x = bx + spins.current * 720;     // tours complets en plus : le dé roule réellement
  const y = by + spins.current * 1080;

  return (
    <div className={`die-slot${canRoll ? " ready" : ""}`} style={{ "--c": color }}>
      <button className="die-btn" disabled={!canRoll} onClick={onRoll} aria-label="Lancer le dé">
        <div className={spins.current ? `toss t${spins.current % 2}` : "toss"}>
          <div className="cube" style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)` }}>
            {[1, 2, 3, 4, 5, 6].map((v) => (
              <div key={v} className={`face f${v}`}>
                {Array.from({ length: 9 }, (_, c) => (PIPS[v].includes(c) ? <i key={c} /> : <span key={c} />))}
              </div>
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
