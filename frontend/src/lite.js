// Mode allégé : téléphones, écrans tactiles, « réduire les animations » ou peu de mémoire
export function isLite() {
  try {
    return (
      window.matchMedia("(max-width: 860px), (pointer: coarse), (prefers-reduced-motion: reduce)").matches ||
      (navigator.deviceMemory && navigator.deviceMemory <= 4)
    );
  } catch {
    return false;
  }
}
