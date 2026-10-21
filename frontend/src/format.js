export const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " Ar";

// Même calcul que le serveur : commission arrondie à l'inférieur
export function preview(stake, n, percent) {
  const pot = stake * n;
  const commission = Math.floor((pot * percent) / 100);
  return { pot, commission, prize: pot - commission };
}
