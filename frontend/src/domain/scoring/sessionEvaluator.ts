import { EARLY_SIGNAL_EVENT_THRESHOLD, OWNER_ID } from "../constants";
import type {
  DomainEvent,
  GraphLinkEntity,
  GraphNodeEntity,
  ReviewSession,
  ScoreLedgerEntry,
  ScoringReasonCode,
  UserId,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../types";
import { buildSessionOpportunities, buildUserOpportunitySummary } from "./opportunities";
import type { ScoringPolicy } from "./policy";
import { computeSessionTrustSignal, updateTrustFactor } from "./trust";

export type SessionEvaluationInput = {
  graphId: string;
  session: ReviewSession;
  users: UserId[];
  nodes: GraphNodeEntity[];
  links: GraphLinkEntity[];
  eventsInSession: DomainEvent[];
  trustProfilesBefore: UserTrustProfile[];
  policy: ScoringPolicy;
};

function makeLedgerEntry(params: {
  graphId: string;
  sessionId: string;
  userId: UserId;
  entityId: string;
  entityType: "node" | "link";
  reasonCode: ScoringReasonCode;
  pointsDelta: number;
  explanation: string;
  relatedEventIds: string[];
  createdAt: string;
}): ScoreLedgerEntry {
  return {
    entryId: crypto.randomUUID(),
    ...params,
  };
}

function getTrustBefore(userId: UserId, trustProfilesBefore: UserTrustProfile[], defaultTrust: number): number {
  return trustProfilesBefore.find((profile) => profile.userId === userId)?.trustFactor ?? defaultTrust;
}

export function evaluateReviewSession(
  input: SessionEvaluationInput
): {
  ledgerEntries: ScoreLedgerEntry[];
  evaluations: UserSessionEvaluation[];
  trustProfilesAfter: UserTrustProfile[];
} {
  const {
    graphId,
    session,
    users,
    nodes,
    links,
    eventsInSession,
    trustProfilesBefore,
    policy,
  } = input;

  const opportunities = buildSessionOpportunities({
    session,
    users,
    nodes,
    links,
    events: eventsInSession,
  });

  const ledgerEntries: ScoreLedgerEntry[] = [];

  for (const opportunity of opportunities) {
    if (opportunity.userId === OWNER_ID) continue;

    const trustBefore = getTrustBefore(
      opportunity.userId,
      trustProfilesBefore,
      policy.trust.defaultTrust
    );

    const relatedEventCount = opportunity.relatedEventIds.length;
    const earlySignalBonus = relatedEventCount <= EARLY_SIGNAL_EVENT_THRESHOLD
      ? policy.basePoints.earlyCorrectSignal
      : policy.basePoints.lateCorrectSignal;

    let reasonCode: ScoringReasonCode;
    let pointsDelta = 0;
    let explanation = "";

    switch (opportunity.kind) {
      case "initiate_node":
      case "initiate_link": {
        const isTrue = opportunity.canonicalStatus === "canonical_true";
        reasonCode = isTrue ? "INITIATIVE_CONFIRMED_TRUE" : "INITIATIVE_CONFIRMED_FALSE";
        const base = isTrue
          ? policy.basePoints.initiativeConfirmedTrue
          : policy.basePoints.initiativeConfirmedFalse;
        pointsDelta = Math.round(base * policy.multipliers.initiativeRiskMultiplier);
        explanation = isTrue
          ? "Created an entity that was later canonized as true by the owner."
          : "Created an entity that was later canonized as false by the owner.";
        break;
      }
      case "support_node":
      case "support_link": {
        const isTrue = opportunity.canonicalStatus === "canonical_true";
        reasonCode = isTrue ? "AGREED_WITH_TRUE" : "AGREED_WITH_FALSE";
        pointsDelta = isTrue
          ? policy.basePoints.agreedWithTrue + earlySignalBonus
          : policy.basePoints.agreedWithFalse;

        const boost = Math.min(
          policy.multipliers.lowTrustAuthorBoostCap,
          1 + (50 - trustBefore) / 100
        );

        if (isTrue && trustBefore < 50) {
          reasonCode = "SUPPORTED_LOW_TRUST_AUTHOR_TRUE";
          pointsDelta = Math.round((policy.basePoints.supportedLowTrustAuthorTrue + earlySignalBonus) * boost);
          explanation = "Supported a low-trust line of reasoning that was later confirmed by the owner.";
        } else if (!isTrue && trustBefore < 50) {
          reasonCode = "SUPPORTED_LOW_TRUST_AUTHOR_FALSE";
          pointsDelta = Math.round(policy.basePoints.supportedLowTrustAuthorFalse * boost);
          explanation = "Supported a low-trust line of reasoning that was later rejected by the owner.";
        } else {
          explanation = isTrue
            ? "Supported an entity that was later canonized as true."
            : "Supported an entity that was later canonized as false.";
        }
        break;
      }
      case "reject_node":
      case "reject_link": {
        const isFalse = opportunity.canonicalStatus === "canonical_false";
        reasonCode = isFalse ? "CORRECT_REJECTION" : "INCORRECT_REJECTION";
        pointsDelta = isFalse
          ? policy.basePoints.correctRejection + earlySignalBonus
          : policy.basePoints.incorrectRejection;
        explanation = isFalse
          ? "Rejected an entity that was later canonized as false."
          : "Rejected an entity that was later canonized as true.";
        break;
      }
      case "abstain_node":
      case "abstain_link":
      default: {
        reasonCode = "MISSED_OPPORTUNITY_UNDECIDED";
        pointsDelta = policy.basePoints.missedOpportunityUndecided;
        explanation = "Remained undecided on an entity reviewed during the session.";
      }
    }

    ledgerEntries.push(
      makeLedgerEntry({
        graphId,
        sessionId: session.sessionId,
        userId: opportunity.userId,
        entityId: opportunity.entityId,
        entityType: opportunity.entityType,
        reasonCode,
        pointsDelta,
        explanation,
        relatedEventIds: opportunity.relatedEventIds,
        createdAt: session.closedAt,
      })
    );
  }

  const evaluations: UserSessionEvaluation[] = [];
  const trustProfilesAfter: UserTrustProfile[] = [];

  for (const userId of users) {
    if (userId === OWNER_ID) continue;

    const userEntries = ledgerEntries.filter((entry) => entry.userId === userId);
    const userOpportunitySummary = buildUserOpportunitySummary(userId, ledgerEntries, opportunities);
    const opportunityCount = Math.max(userOpportunitySummary.opportunityCount, 1);

    const rewardPoints = userOpportunitySummary.rewardPoints;
    const penaltyPoints = userOpportunitySummary.penaltyPoints;
    const netPoints = rewardPoints - penaltyPoints;
    const maxPossiblePoints = opportunityCount * policy.basePoints.initiativeConfirmedTrue;
    const performancePercent = Math.max(0, Math.min(100, (rewardPoints / Math.max(maxPossiblePoints, 1)) * 100));

    const initiativeIndex = userOpportunitySummary.initiativeCount / opportunityCount;
    const decisivenessIndex = userOpportunitySummary.decisiveCount / opportunityCount;
    const accuracyIndex = userEntries.length === 0
      ? 0
      : userEntries.filter((entry) => entry.pointsDelta > 0).length / userEntries.length;
    const riskIndex = initiativeIndex;
    const influenceScore = initiativeIndex * 100 + accuracyIndex * 25;

    const trustBefore = getTrustBefore(userId, trustProfilesBefore, policy.trust.defaultTrust);
    const trustSignal = computeSessionTrustSignal(
      performancePercent,
      initiativeIndex,
      riskIndex,
      accuracyIndex
    );
    const trustAfter = updateTrustFactor(trustBefore, trustSignal, policy);

    evaluations.push({
      graphId,
      sessionId: session.sessionId,
      userId,
      rewardPoints,
      penaltyPoints,
      netPoints,
      maxPossiblePoints,
      performancePercent,
      initiativeScore: initiativeIndex * 100,
      agreementScore: accuracyIndex * 100,
      correctionScore: accuracyIndex * 100,
      undecidedRate: 1 - decisivenessIndex,
      influenceScore,
      trustBefore,
      trustAfter,
      trustDelta: trustAfter - trustBefore,
      riskIndex,
      initiativeIndex,
      decisivenessIndex,
      accuracyIndex,
    });

    const previousProfile = trustProfilesBefore.find((profile) => profile.userId === userId);

    trustProfilesAfter.push({
      graphId,
      userId,
      trustFactor: trustAfter,
      sessionsCount: (previousProfile?.sessionsCount ?? 0) + 1,
      lifetimeRewardPoints: (previousProfile?.lifetimeRewardPoints ?? 0) + rewardPoints,
      lifetimePenaltyPoints: (previousProfile?.lifetimePenaltyPoints ?? 0) + penaltyPoints,
      lifetimeNetPoints: (previousProfile?.lifetimeNetPoints ?? 0) + netPoints,
      initiativeIndex,
      riskIndex,
      decisivenessIndex,
      accuracyIndex,
      influenceIndex: influenceScore / 100,
      lastUpdatedAt: session.closedAt,
    });
  }

  return {
    ledgerEntries,
    evaluations,
    trustProfilesAfter,
  };
}
