import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTrendingScore, getCvssSeverity, classifyRadarRing } from './analytics';

test('calculateTrendingScore scales properly with high stars and recent activity', () => {
  const highTrending = calculateTrendingScore(50000, 4000, 1);
  const lowTrending = calculateTrendingScore(50, 2, 90);
  assert.ok(highTrending > lowTrending, 'High star recent repo must score higher');
  assert.ok(highTrending <= 100);
  assert.ok(lowTrending >= 0);
});

test('getCvssSeverity maps scores according to FIRST CVSS v3.1 specification', () => {
  assert.equal(getCvssSeverity(9.8), 'CRITICAL');
  assert.equal(getCvssSeverity(9.0), 'CRITICAL');
  assert.equal(getCvssSeverity(8.5), 'HIGH');
  assert.equal(getCvssSeverity(7.1), 'HIGH');
  assert.equal(getCvssSeverity(5.4), 'MEDIUM');
  assert.equal(getCvssSeverity(3.2), 'LOW');
});

test('classifyRadarRing assigns correct rings', () => {
  assert.equal(classifyRadarRing('production', 85), 'adopt');
  assert.equal(classifyRadarRing('legacy', 20), 'hold');
  assert.equal(classifyRadarRing('growing', 80), 'trial');
  assert.equal(classifyRadarRing('experimental', 30), 'assess');
});
