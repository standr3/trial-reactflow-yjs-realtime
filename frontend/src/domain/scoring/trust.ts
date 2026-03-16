import type { ScoringPolicy } from "./policy";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeSessionTrustSignal(
  performancePercent: number,
  initiativeIndex: number,
  riskIndex: number,
  accuracyIndex: number
): number {
  const normalizedPerformance = performancePercent / 100;
  const signal =
    normalizedPerformance * 0.5 +
    accuracyIndex * 0.25 +
    initiativeIndex * 0.15 +
    riskIndex * 0.1;

  return signal * 100;
}

export function updateTrustFactor(
  previousTrust: number,
  sessionSignal: number,
  policy: ScoringPolicy
): number {
  const alpha = policy.trust.smoothingAlpha;
  const next = previousTrust * (1 - alpha) + sessionSignal * alpha;
  return clamp(next, policy.trust.minTrust, policy.trust.maxTrust);
}
