// Shared mortality formula for both the player and their children — see
// docs/design/family-succession.md "Health & Mortality". eventModifier is
// reserved for future health-affecting events (storms, plague hitting the
// player) and is always 0 for now.
export function rollHealthDecay(age: number, eventModifier = 0): number {
  return age / 10 + Math.random() * 5 + eventModifier;
}

export function applyHealthDecay(currentHealth: number, age: number, eventModifier = 0): number {
  return Math.max(0, currentHealth - rollHealthDecay(age, eventModifier));
}
