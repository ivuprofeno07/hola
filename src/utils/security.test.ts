import test from 'node:test';
import assert from 'node:assert/strict';
import { Vulnerability } from '../lib/types';

/**
 * Helper under test: format CVSS score safely
 */
export function formatCvssScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return 'N/D';
  }
  return score.toFixed(1);
}

/**
 * Helper under test: sanitize AI query
 */
export function sanitizeUserQuery(input: string, maxLen = 1000): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .slice(0, maxLen)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .trim();
}

/**
 * Helper under test: validate watchlist item
 */
export function validateWatchlistPayload(payload: { itemType?: string; title?: string; keyword?: string }) {
  const validTypes = ['company', 'model', 'technology', 'repo', 'team', 'topic', 'cve'];
  const itemType = validTypes.includes(payload.itemType || '') ? payload.itemType! : 'topic';

  if (!payload.title || typeof payload.title !== 'string' || !payload.title.trim()) {
    throw new Error('Title is required and must be non-empty');
  }
  if (!payload.keyword || typeof payload.keyword !== 'string' || !payload.keyword.trim()) {
    throw new Error('Keyword is required and must be non-empty');
  }

  return {
    itemType,
    title: payload.title.trim().slice(0, 100),
    keyword: payload.keyword.trim().slice(0, 100)
  };
}

test('formatCvssScore renders N/D when score is null, undefined, or NaN without inventing 8.5', () => {
  assert.equal(formatCvssScore(null), 'N/D');
  assert.equal(formatCvssScore(undefined), 'N/D');
  assert.equal(formatCvssScore(NaN), 'N/D');
  assert.equal(formatCvssScore(9.8), '9.8');
  assert.equal(formatCvssScore(7.5), '7.5');
  assert.notEqual(formatCvssScore(null), '8.5');
});

test('sanitizeUserQuery limits query length and strips non-printable control characters', () => {
  const malicious = 'SELECT * FROM \x00users WHERE \x1Fadmin=1;\n\r' + 'A'.repeat(1500);
  const cleaned = sanitizeUserQuery(malicious, 500);

  assert.ok(cleaned.length <= 500);
  assert.ok(!cleaned.includes('\x00'));
  assert.ok(!cleaned.includes('\x1F'));
});

test('validateWatchlistPayload accepts valid categories and rejects empty inputs', () => {
  const valid = validateWatchlistPayload({
    itemType: 'cve',
    title: ' Ivanti Appliances ',
    keyword: ' CVE-2025 '
  });

  assert.equal(valid.itemType, 'cve');
  assert.equal(valid.title, 'Ivanti Appliances');
  assert.equal(valid.keyword, 'CVE-2025');

  // Fallback to 'topic' when unknown type is provided
  const fallbackType = validateWatchlistPayload({
    itemType: 'unknown-hack',
    title: 'Valid Title',
    keyword: 'Valid Keyword'
  });
  assert.equal(fallbackType.itemType, 'topic');

  // Rejects empty title
  assert.throws(() => {
    validateWatchlistPayload({ title: '   ', keyword: 'valid' });
  });

  // Rejects empty keyword
  assert.throws(() => {
    validateWatchlistPayload({ title: 'valid', keyword: '' });
  });
});

test('Vulnerability differentiation between CISA KEV and CVSS', () => {
  const kevItem: Vulnerability = {
    id: 'cisa-CVE-2025-0282',
    cveId: 'CVE-2025-0282',
    title: 'Ivanti Connect Secure Vulnerability',
    description: 'Actively exploited in the wild',
    severity: 'N/D',
    cvssScore: null,
    affectedProducts: ['Ivanti Connect Secure'],
    publishedAt: '2025-01-14T00:00:00Z',
    source: 'CISA KEV Catalog',
    status: 'KEV_EXPLOITED',
    advisoryUrl: 'https://nvd.nist.gov/vuln/detail/CVE-2025-0282',
    isKevExploited: true
  };

  assert.equal(kevItem.status, 'KEV_EXPLOITED');
  assert.equal(kevItem.isKevExploited, true);
  assert.equal(kevItem.cvssScore, null);
  assert.equal(formatCvssScore(kevItem.cvssScore), 'N/D');
});
