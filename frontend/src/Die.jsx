import React, { useEffect, useRef, useState } from "react";

// Rotation du cube pour montrer chaque face de face (mode 3D, ordinateur)
const BASE = { 1: [0, 0], 6: [0, 180], 2: [0, -90], 5: [0, 90], 3: [-90, 0], 4: [90, 0] };
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

const Pips = ({ v }) =>
  Array.from({ length: 9 }, (_, c) => (PIPS[v].includes(c) ? <i key={c} /> : <span key={c} />));

/**
 * size : taille du dé en pixels, mesurée par le parent (pas d'unités CSS récentes).
 * lite : dé plat 2D (téléphones), sans 3D ni effets coûteux.
 */
export default function Die({ last, color, canRoll, onRoll, size, lite }) {
  const n = last?.n ?? 0;
  const value = last?.value ?? 1;

  // --- Mode 3D : tours complets en plus à chaque lancer ---
  const seen3d = useRef(n);
  const spins = useRef(0);
  if (seen3d.current !== n) { seen3d.current = n; spins.current += 1; }
  const [bx, by] = BASE[value];
  const x = bx + spins.current * 720;
  const y = by + spins.current * 1080;

  // --- Mode allégé : le dé tourne en 2D et change de face avant de se poser ---
  const seenLite = useRef(n);
  const [face, setFace] = useState(value);
  const [rolling, setRolling] = useState(false);
  useEffect(() => {
    if (!lite) return undefined;
    if (seenLite.current === n) { setFace(value); return undefined; }
    seenLite.current = n;
    setRolling(true);
    const iv = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    const to = setTimeout(() => { clearInterval(iv); setFace(value); setRolling(false); }, 1000);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [n, value, lite]);

  return (
    <div className={`die-slot${canRoll ? " ready" : ""}`} style={{ "--c": color, "--s": `${Math.round(size)}px` }}>
      {lite ? (
        <div className={`flatdie${rolling ? " rolling" : ""}`}><Pips v={face} /></div>
      ) : (
        <div className={spins.current ? `toss t${spins.current % 2}` : "toss"}>
          <div className="cube" style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)` }}>
            {[1, 2, 3, 4, 5, 6].map((v) => <div key={v} className={`face f${v}`}><Pips v={v} /></div>)}
          </div>
        </div>
      )}
      {/* Zone de clic plate, plus large que le dé : fiable au doigt */}
      <button className="die-hit" disabled={!canRoll} onClick={onRoll} aria-label="Lancer le dé" />
    </div>
  );
}
