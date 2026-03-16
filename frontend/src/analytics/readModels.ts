import type {
  OverallPerformanceStats,
  PerformanceQuickStats,
  PerformanceReadModel,
  ReviewSession,
  ScoreLedgerEntry,
  SessionHistoryItem,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../domain/types";

export type BuildReadModelInput = {
  graphId: string;
  currentSessionId?: string;
  evaluations: UserSessionEvaluation[];
  trustProfiles: UserTrustProfile[];
  ledgerEntries: ScoreLedgerEntry[];
  reviewSessions?: ReviewSession[];
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildPerformanceReadModel(
  input: BuildReadModelInput
): PerformanceReadModel {
  const {
    graphId,
    currentSessionId,
    evaluations,
    trustProfiles,
    ledgerEntries,
    reviewSessions = [],
  } = input;

  const sortedReviewSessions = [...reviewSessions].sort((a, b) =>
    a.closedAt < b.closedAt ? -1 : 1
  );

  const sortedEvaluations = [...evaluations].sort((a, b) => {
    if (a.sessionId === b.sessionId) return a.userId < b.userId ? -1 : 1;
    return a.sessionId < b.sessionId ? -1 : 1;
  });

  const latestSessionId =
    currentSessionId ?? sortedReviewSessions.at(-1)?.sessionId ?? sortedEvaluations.at(-1)?.sessionId;

  const latestEvaluations = latestSessionId
    ? sortedEvaluations.filter((evaluation) => evaluation.sessionId === latestSessionId)
    : [];

  const quickStats: PerformanceQuickStats[] = latestEvaluations.map((evaluation) => {
    const previousEvaluation = [...sortedEvaluations]
      .reverse()
      .find(
        (item) =>
          item.userId === evaluation.userId && item.sessionId !== evaluation.sessionId
      );

    return {
      userId: evaluation.userId,
      trustFactor: evaluation.trustAfter,
      rewardPoints: evaluation.rewardPoints,
      penaltyPoints: evaluation.penaltyPoints,
      netPoints: evaluation.netPoints,
      performancePercent: evaluation.performancePercent,
      trendVsPreviousSession:
        evaluation.performancePercent - (previousEvaluation?.performancePercent ?? 0),
    };
  });

  const sessionHistory: SessionHistoryItem[] = sortedReviewSessions.map((session) => {
    const sessionEvaluations = sortedEvaluations.filter(
      (evaluation) => evaluation.sessionId === session.sessionId
    );

    const topPerformer = [...sessionEvaluations].sort(
      (a, b) => b.performancePercent - a.performancePercent
    )[0];

    return {
      sessionId: session.sessionId,
      label: session.label,
      closedAt: session.closedAt,
      averagePerformancePercent: average(
        sessionEvaluations.map((item) => item.performancePercent)
      ),
      averageTrustAfter: average(sessionEvaluations.map((item) => item.trustAfter)),
      totalRewardPoints: sessionEvaluations.reduce(
        (sum, item) => sum + item.rewardPoints,
        0
      ),
      totalPenaltyPoints: sessionEvaluations.reduce(
        (sum, item) => sum + item.penaltyPoints,
        0
      ),
      topPerformerUserId: topPerformer?.userId,
    };
  });

  const bestTrustUser = [...trustProfiles].sort((a, b) => b.trustFactor - a.trustFactor)[0];
  const bestPerformanceUser = [...latestEvaluations].sort(
    (a, b) => b.performancePercent - a.performancePercent
  )[0];

  const overallStats: OverallPerformanceStats = {
    sessionsCount: sortedReviewSessions.length,
    participantsCount: trustProfiles.length,
    averagePerformancePercent: average(
      latestEvaluations.map((evaluation) => evaluation.performancePercent)
    ),
    averageTrustFactor: average(trustProfiles.map((profile) => profile.trustFactor)),
    totalRewardPoints: trustProfiles.reduce(
      (sum, profile) => sum + profile.lifetimeRewardPoints,
      0
    ),
    totalPenaltyPoints: trustProfiles.reduce(
      (sum, profile) => sum + profile.lifetimePenaltyPoints,
      0
    ),
    totalNetPoints: trustProfiles.reduce(
      (sum, profile) => sum + profile.lifetimeNetPoints,
      0
    ),
    bestTrustUserId: bestTrustUser?.userId,
    bestPerformanceUserId: bestPerformanceUser?.userId,
  };

  return {
    graphId,
    currentSessionId: latestSessionId,
    quickStats,
    latestEvaluations,
    allEvaluations: sortedEvaluations,
    trustProfiles,
    recentLedgerEntries: ledgerEntries.slice(-60).reverse(),
    reviewSessions: sortedReviewSessions,
    sessionHistory: [...sessionHistory].reverse(),
    overallStats,
  };
}
