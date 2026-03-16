export type ScoringPolicy = {
  version: string;
  basePoints: {
    initiativeConfirmedTrue: number;
    initiativeConfirmedFalse: number;
    agreedWithTrue: number;
    agreedWithFalse: number;
    correctRejection: number;
    incorrectRejection: number;
    missedOpportunityUndecided: number;
    supportedLowTrustAuthorTrue: number;
    supportedLowTrustAuthorFalse: number;
    earlyCorrectSignal: number;
    lateCorrectSignal: number;
  };
  multipliers: {
    initiativeRiskMultiplier: number;
    lowTrustAuthorBoostCap: number;
    recencyAlpha: number;
    historicalWeight: number;
    recentWeight: number;
  };
  trust: {
    defaultTrust: number;
    minTrust: number;
    maxTrust: number;
    smoothingAlpha: number;
  };
};

export const DEFAULT_SCORING_POLICY: ScoringPolicy = {
  version: "policy-v1",
  basePoints: {
    initiativeConfirmedTrue: 14,
    initiativeConfirmedFalse: -16,
    agreedWithTrue: 7,
    agreedWithFalse: -8,
    correctRejection: 7,
    incorrectRejection: -8,
    missedOpportunityUndecided: -3,
    supportedLowTrustAuthorTrue: 5,
    supportedLowTrustAuthorFalse: -5,
    earlyCorrectSignal: 3,
    lateCorrectSignal: 1,
  },
  multipliers: {
    initiativeRiskMultiplier: 1.4,
    lowTrustAuthorBoostCap: 1.75,
    recencyAlpha: 0.7,
    historicalWeight: 0.65,
    recentWeight: 0.35,
  },
  trust: {
    defaultTrust: 50,
    minTrust: 0,
    maxTrust: 100,
    smoothingAlpha: 0.25,
  },
};
