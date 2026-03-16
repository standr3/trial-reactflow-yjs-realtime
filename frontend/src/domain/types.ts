export type UserId = "O" | `G_${number}`;

export type Vote = "none" | "up" | "down";

export type GovernanceMode = "authoritative" | "community";

export type SupportType = "local" | "canonical";

export type EntityType = "node" | "link";

export type CanonicalStatus = "canonical_true" | "canonical_false" | "none";

export type NodeStance =
  | "canonical_true"
  | "canonical_false"
  | "local_true"
  | "local_false"
  | "undecided";

export type VotesByUser = Partial<Record<UserId, Vote>>;

export type VoteLocksByUser = Partial<Record<UserId, boolean>>;

export type GraphUser = {
  id: UserId;
  name: string;
};

export type GraphNodeLayout = {
  nodeId: string;
  x: number;
  y: number;
};

export type GraphNodeEntity = {
  id: string;
  label: string;
  creatorId: UserId;
  governanceMode: GovernanceMode;
  votesByUser: VotesByUser;
  createdAt: string;
  updatedAt: string;
};

export type GraphLinkEntity = {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  creatorId: UserId;
  governanceMode: GovernanceMode;
  supportType: SupportType;
  votesByUser: VotesByUser;
  voteLocksByUser: VoteLocksByUser;
  globalVoteLocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GraphState = {
  graphId: string;
  revision: number;
  nodes: GraphNodeEntity[];
  links: GraphLinkEntity[];
};

export type NodeVoteChange = {
  nodeId: string;
  userId: UserId;
  previousVote: Vote;
  nextVote: Vote;
};

export type LinkVoteChange = {
  linkId: string;
  userId: UserId;
  previousVote: Vote;
  nextVote: Vote;
};

export type LinkDeletion = {
  linkId: string;
  reason: string;
};

export type VoteLock = {
  linkId: string;
  userId?: UserId;
  global?: boolean;
  reason: string;
};

export type AddNodeAction = {
  type: "ADD_NODE";
  userId: UserId;
  label?: string;
};

export type AddLinkAction = {
  type: "ADD_LINK";
  userId: UserId;
  sourceId: string;
  targetId: string;
  label?: string;
};

export type DeleteLinkAction = {
  type: "DELETE_LINK";
  userId: UserId;
  linkId: string;
};

export type ToggleNodeVoteAction = {
  type: "TOGGLE_NODE_VOTE";
  userId: UserId;
  nodeId: string;
  direction: "up" | "down";
};

export type ToggleLinkVoteAction = {
  type: "TOGGLE_LINK_VOTE";
  userId: UserId;
  linkId: string;
  direction: "up" | "down";
};

export type CloseReviewSessionAction = {
  type: "CLOSE_REVIEW_SESSION";
  userId: UserId;
  sessionLabel?: string;
};

export type ResetReviewHistoryAction = {
  type: "RESET_REVIEW_HISTORY";
  userId: UserId;
};

export type ResetCurrentSessionOwnerReviewsAction = {
  type: "RESET_CURRENT_SESSION_OWNER_REVIEWS";
  userId: UserId;
};

export type ResetAllOwnerReviewsAction = {
  type: "RESET_ALL_OWNER_REVIEWS";
  userId: UserId;
};

export type GraphAction =
  | AddNodeAction
  | AddLinkAction
  | DeleteLinkAction
  | ToggleNodeVoteAction
  | ToggleLinkVoteAction
  | CloseReviewSessionAction
  | ResetReviewHistoryAction
  | ResetCurrentSessionOwnerReviewsAction
  | ResetAllOwnerReviewsAction;

export type DomainEventBase = {
  eventId: string;
  graphId: string;
  revision: number;
  actorId: UserId;
  occurredAt: string;
};

export type NodeCreatedEvent = DomainEventBase & {
  type: "NODE_CREATED";
  nodeId: string;
  label: string;
};

export type LinkCreatedEvent = DomainEventBase & {
  type: "LINK_CREATED";
  linkId: string;
  sourceId: string;
  targetId: string;
  label: string;
  supportType: SupportType;
};

export type LinkDeletedEvent = DomainEventBase & {
  type: "LINK_DELETED";
  linkId: string;
  reason: string;
};

export type NodeVoteChangedEvent = DomainEventBase & {
  type: "NODE_VOTE_CHANGED";
  nodeId: string;
  previousVote: Vote;
  nextVote: Vote;
};

export type LinkVoteChangedEvent = DomainEventBase & {
  type: "LINK_VOTE_CHANGED";
  linkId: string;
  previousVote: Vote;
  nextVote: Vote;
};

export type LinkVoteLockedEvent = DomainEventBase & {
  type: "LINK_VOTE_LOCKED";
  linkId: string;
  scope: "global" | "user";
  targetUserId?: UserId;
  reason: string;
};

export type ReviewSessionClosedEvent = DomainEventBase & {
  type: "REVIEW_SESSION_CLOSED";
  sessionId: string;
  sessionLabel: string;
  startRevisionExclusive: number;
  endRevisionInclusive: number;
};

export type DomainEvent =
  | NodeCreatedEvent
  | LinkCreatedEvent
  | LinkDeletedEvent
  | NodeVoteChangedEvent
  | LinkVoteChangedEvent
  | LinkVoteLockedEvent
  | ReviewSessionClosedEvent;

export type DomainDecision = {
  allowed: boolean;
  reason: string;
  nextState: GraphState;
  events: DomainEvent[];
  warnings: string[];
};

export type ReviewSession = {
  sessionId: string;
  graphId: string;
  label: string;
  ownerId: UserId;
  policyVersion: string;
  startRevisionExclusive: number;
  endRevisionInclusive: number;
  openedAt: string;
  closedAt: string;
};

export type OpportunityKind =
  | "initiate_node"
  | "initiate_link"
  | "support_node"
  | "reject_node"
  | "support_link"
  | "reject_link"
  | "abstain_node"
  | "abstain_link";

export type ScoringReasonCode =
  | "INITIATIVE_CONFIRMED_TRUE"
  | "INITIATIVE_CONFIRMED_FALSE"
  | "AGREED_WITH_TRUE"
  | "AGREED_WITH_FALSE"
  | "CORRECT_REJECTION"
  | "INCORRECT_REJECTION"
  | "MISSED_OPPORTUNITY_UNDECIDED"
  | "SUPPORTED_LOW_TRUST_AUTHOR_TRUE"
  | "SUPPORTED_LOW_TRUST_AUTHOR_FALSE"
  | "EARLY_CORRECT_SIGNAL"
  | "LATE_CORRECT_SIGNAL"
  | "CASCADE_LOCK_PENALTY_AVOIDED"
  | "CANONICAL_DOWN_BY_OWNER"
  | "CANONICAL_UP_BY_OWNER";

export type ScoreLedgerEntry = {
  entryId: string;
  graphId: string;
  sessionId: string;
  userId: UserId;
  entityId: string;
  entityType: EntityType;
  reasonCode: ScoringReasonCode;
  pointsDelta: number;
  explanation: string;
  relatedEventIds: string[];
  createdAt: string;
};

export type UserSessionEvaluation = {
  graphId: string;
  sessionId: string;
  userId: UserId;
  rewardPoints: number;
  penaltyPoints: number;
  netPoints: number;
  maxPossiblePoints: number;
  performancePercent: number;
  initiativeScore: number;
  agreementScore: number;
  correctionScore: number;
  undecidedRate: number;
  influenceScore: number;
  trustBefore: number;
  trustAfter: number;
  trustDelta: number;
  riskIndex: number;
  initiativeIndex: number;
  decisivenessIndex: number;
  accuracyIndex: number;
};

export type UserTrustProfile = {
  graphId: string;
  userId: UserId;
  trustFactor: number;
  sessionsCount: number;
  lifetimeRewardPoints: number;
  lifetimePenaltyPoints: number;
  lifetimeNetPoints: number;
  initiativeIndex: number;
  riskIndex: number;
  decisivenessIndex: number;
  accuracyIndex: number;
  influenceIndex: number;
  lastUpdatedAt: string;
};

export type PerformanceQuickStats = {
  userId: UserId;
  trustFactor: number;
  rewardPoints: number;
  penaltyPoints: number;
  netPoints: number;
  performancePercent: number;
  trendVsPreviousSession: number;
};

export type SessionHistoryItem = {
  sessionId: string;
  label: string;
  closedAt: string;
  averagePerformancePercent: number;
  averageTrustAfter: number;
  totalRewardPoints: number;
  totalPenaltyPoints: number;
  topPerformerUserId?: UserId;
};

export type OverallPerformanceStats = {
  sessionsCount: number;
  participantsCount: number;
  averagePerformancePercent: number;
  averageTrustFactor: number;
  totalRewardPoints: number;
  totalPenaltyPoints: number;
  totalNetPoints: number;
  bestTrustUserId?: UserId;
  bestPerformanceUserId?: UserId;
};

export type PerformanceReadModel = {
  graphId: string;
  currentSessionId?: string;
  quickStats: PerformanceQuickStats[];
  latestEvaluations: UserSessionEvaluation[];
  allEvaluations: UserSessionEvaluation[];
  trustProfiles: UserTrustProfile[];
  recentLedgerEntries: ScoreLedgerEntry[];
  reviewSessions: ReviewSession[];
  sessionHistory: SessionHistoryItem[];
  overallStats: OverallPerformanceStats;
};
