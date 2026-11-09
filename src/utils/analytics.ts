/**
 * Calculates trending velocity score for GitHub repos or technologies.
 * Takes stars, forks, and days since update into account.
 */
export function calculateTrendingScore(stars: number, forks: number, daysSinceUpdate: number): number {
  if (stars <= 0) return 0;
  // Recency penalty: decay exponent as days grow
  const recencyMultiplier = Math.max(0.2, 1 / (1 + daysSinceUpdate * 0.05));
  const baseWeight = Math.log10(stars + 1) * 20 + Math.log10(forks + 1) * 8;
  const score = Math.round(baseWeight * recencyMultiplier * 10) / 10;
  return Math.min(100, Math.max(1, score));
}

/**
 * Converts a CVSS score (0.0 - 10.0) into its official NVD/CISA severity tier.
 */
export function getCvssSeverity(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 9.0) return 'CRITICAL';
  if (score >= 7.0) return 'HIGH';
  if (score >= 4.0) return 'MEDIUM';
  return 'LOW';
}

/**
 * Classifies radar ring based on maturity and enterprise adoption indicators.
 */
export function classifyRadarRing(
  maturityLevel: 'experimental' | 'growing' | 'production' | 'legacy',
  trendingScore: number
): 'adopt' | 'trial' | 'assess' | 'hold' {
  if (maturityLevel === 'legacy') return 'hold';
  if (maturityLevel === 'production' && trendingScore >= 60) return 'adopt';
  if (trendingScore >= 75 || maturityLevel === 'growing') return 'trial';
  return 'assess';
}
