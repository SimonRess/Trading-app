// Shared mortality formula for both the player and their children — see
// docs/design/family-succession.md "Health & Mortality". eventModifier is
// reserved for future health-affecting events (storms, plague hitting the
// player) and is always 0 for now.
//
// Revised 2026-07-25 (was age/10 + random(0,5)) — the original rate made
// child mortality before heir-eligible age (10) near-certain; reduced by
// roughly 10x on both terms.
export function rollHealthDecay(age: number, eventModifier = 0): number {
  return age / 40 + Math.random() * 0.5 + eventModifier;
}

export function applyHealthDecay(currentHealth: number, age: number, eventModifier = 0): number {
  return Math.max(0, currentHealth - rollHealthDecay(age, eventModifier));
}
