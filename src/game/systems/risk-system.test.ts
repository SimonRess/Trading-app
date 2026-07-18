import { describe, it, expect } from 'vitest';
import { buildInitialRiskState, driftRiskState, routeRiskModifier, cityRiskModifier } from './risk-system.ts';
import { ROUTES, routeKey } from '../data/routes.ts';

describe('buildInitialRiskState', () => {
  it('starts every route and harvest city at modifier 1.0', () => {
    const risk = buildInitialRiskState();
    for (const route of ROUTES) {
      expect(risk.routeModifiers[routeKey(route.from, route.to)]).toBe(1.0);
    }
    expect(risk.cityModifiers['danzig']).toBe(1.0);
  });
});

describe('driftRiskState', () => {
  it('keeps every modifier within [0.5, 1.8]', () => {
    let risk = buildInitialRiskState();
    for (let i = 0; i < 200; i++) {
      risk = driftRiskState(risk);
      for (const value of Object.values(risk.routeModifiers)) {
        expect(value).toBeGreaterThanOrEqual(0.5);
        expect(value).toBeLessThanOrEqual(1.8);
      }
      for (const value of Object.values(risk.cityModifiers)) {
        expect(value).toBeGreaterThanOrEqual(0.5);
        expect(value).toBeLessThanOrEqual(1.8);
      }
    }
  });

  it('changes at least one modifier over many drifts (not frozen)', () => {
    let risk = buildInitialRiskState();
    for (let i = 0; i < 10; i++) {
      risk = driftRiskState(risk);
    }
    const changed = Object.values(risk.routeModifiers).some(v => v !== 1.0);
    expect(changed).toBe(true);
  });
});

describe('routeRiskModifier / cityRiskModifier', () => {
  it('reads the modifier for a route regardless of direction', () => {
    const risk = buildInitialRiskState();
    risk.routeModifiers[routeKey('lubeck', 'danzig')] = 1.5;
    expect(routeRiskModifier(risk, 'lubeck', 'danzig')).toBe(1.5);
    expect(routeRiskModifier(risk, 'danzig', 'lubeck')).toBe(1.5);
  });

  it('defaults to 1.0 for an unknown route or city', () => {
    const risk = buildInitialRiskState();
    expect(routeRiskModifier(risk, 'hamburg', 'riga')).toBe(1.0); // no direct route, but defaults sanely
    expect(cityRiskModifier(risk, 'malmo')).toBe(1.0); // not a harvest city
  });
});
