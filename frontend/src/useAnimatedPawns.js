import { useEffect, useRef, useState } from "react";

export const STEP_MS = 400; // durée d'une case : lent pour un rendu réaliste

const same = (a, b) => a.every((row, i) => row.every((p, k) => p === b[i][k]));

function step(cur, tgt) {
  const moving = cur.some((row, i) => row.some((p, k) => tgt[i][k] !== -1 && p !== tgt[i][k]));
  return cur.map((row, i) => row.map((p, k) => {
    const t = tgt[i][k];
    if (p === t) return p;
    if (t === -1) return moving ? p : -1;   // un pion capturé repart une fois le coup terminé
    if (p === -1) return 0;                 // sortie de la base
    return p + 1;                           // avance d'une case
  }));
}

/** Fait avancer les pions case par case vers l'état reçu du serveur. */
export function useAnimatedPawns(target) {
  const [shown, setShown] = useState(target);
  const cur = useRef(shown);
  const tgt = useRef(target);
  const last = useRef(0);
  cur.current = shown;
  tgt.current = target;
  const busy = !same(shown, target);

  useEffect(() => {
    if (same(cur.current, tgt.current)) return;
    const delay = Math.max(0, STEP_MS - (Date.now() - last.current));
    const id = setTimeout(() => {
      last.current = Date.now();
      setShown(step(cur.current, tgt.current));
    }, delay);
    return () => clearTimeout(id);
  }, [shown, target]);

  return { shown, busy };
}
