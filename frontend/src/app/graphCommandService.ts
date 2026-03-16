import { DEFAULT_POLICY_VERSION, DEFAULT_USERS, OWNER_ID } from "../domain/constants";
import { applyGraphAction } from "../domain/engine";
import { revalidateGraph } from "../domain/graph/revalidateGraph";
import { evaluateReviewSession } from "../domain/scoring/sessionEvaluator";
import { DEFAULT_SCORING_POLICY } from "../domain/scoring/policy";
import type {
  DomainDecision,
  DomainEvent,
  GraphAction,
  GraphLinkEntity,
  GraphNodeEntity,
  GraphState,
  PerformanceReadModel,
  ReviewSession,
  ScoreLedgerEntry,
  UserId,
  UserSessionEvaluation,
  UserTrustProfile,
  VoteLocksByUser,
  VotesByUser,
} from "../domain/types";
import { buildPerformanceReadModel } from "../analytics/readModels";

export type GraphRepository = {
  loadState(): GraphState;
  saveState(state: GraphState): void;
  appendEvents(events: DomainEvent[]): void;
  replaceEvents(events: DomainEvent[]): void;
  loadEvents(): DomainEvent[];
  saveReviewSession(session: ReviewSession): void;
  replaceReviewSessions(sessions: ReviewSession[]): void;
  loadReviewSessions(): ReviewSession[];
  appendLedgerEntries(entries: ScoreLedgerEntry[]): void;
  replaceLedgerEntries(entries: ScoreLedgerEntry[]): void;
  loadLedgerEntries(): ScoreLedgerEntry[];
  saveUserEvaluations(evaluations: UserSessionEvaluation[]): void;
  replaceUserEvaluations(evaluations: UserSessionEvaluation[]): void;
  loadUserEvaluations(): UserSessionEvaluation[];
  saveTrustProfiles(profiles: UserTrustProfile[]): void;
  replaceTrustProfiles(profiles: UserTrustProfile[]): void;
  loadTrustProfiles(): UserTrustProfile[];
};

export type ExecuteCommandResult = {
  decision: DomainDecision;
  reviewSession?: ReviewSession;
  performanceReadModel?: PerformanceReadModel;
};

function emptyDecision(state: GraphState, reason: string): DomainDecision {
  return {
    allowed: true,
    reason,
    nextState: state,
    events: [],
    warnings: [],
  };
}

function filterOutUserVote(votesByUser: VotesByUser, userId: UserId): VotesByUser {
  return Object.fromEntries(
    Object.entries(votesByUser).filter(([actorId]) => actorId !== userId)
  ) as VotesByUser;
}

function filterOutUserLock(voteLocksByUser: VoteLocksByUser, userId: UserId): VoteLocksByUser {
  return Object.fromEntries(
    Object.entries(voteLocksByUser).filter(([actorId]) => actorId !== userId)
  ) as VoteLocksByUser;
}

function removeOwnerVotesFromNodes(nodes: GraphNodeEntity[], onlyNodeIds?: Set<string>): GraphNodeEntity[] {
  return nodes.map((node) => {
    if (onlyNodeIds && !onlyNodeIds.has(node.id)) {
      return node;
    }

    return {
      ...node,
      votesByUser: filterOutUserVote(node.votesByUser, OWNER_ID),
      updatedAt: new Date().toISOString(),
    };
  });
}

function removeOwnerVotesFromLinks(
  links: GraphLinkEntity[],
  options?: {
    onlyLinkIds?: Set<string>;
    clearGlobalLocks?: boolean;
  }
): GraphLinkEntity[] {
  const { onlyLinkIds, clearGlobalLocks = false } = options ?? {};

  return links.map((link) => {
    if (onlyLinkIds && !onlyLinkIds.has(link.id)) {
      return link;
    }

    return {
      ...link,
      votesByUser: filterOutUserVote(link.votesByUser, OWNER_ID),
      voteLocksByUser: filterOutUserLock(link.voteLocksByUser, OWNER_ID),
      globalVoteLocked: clearGlobalLocks ? false : link.globalVoteLocked,
      updatedAt: new Date().toISOString(),
    };
  });
}

function buildReadModel(repository: GraphRepository, graphId: string, currentSessionId?: string) {
  return buildPerformanceReadModel({
    graphId,
    currentSessionId,
    evaluations: repository.loadUserEvaluations(),
    trustProfiles: repository.loadTrustProfiles(),
    ledgerEntries: repository.loadLedgerEntries(),
    reviewSessions: repository.loadReviewSessions(),
  });
}

export class GraphCommandService {
  constructor(private readonly repository: GraphRepository) {}

  private executeResetReviewHistory(): ExecuteCommandResult {
    const currentState = this.repository.loadState();

    this.repository.replaceEvents([]);
    this.repository.replaceReviewSessions([]);
    this.repository.replaceLedgerEntries([]);
    this.repository.replaceUserEvaluations([]);
    this.repository.replaceTrustProfiles([]);

    return {
      decision: emptyDecision(currentState, "Review sessions and derived statistics were reset."),
      performanceReadModel: buildReadModel(this.repository, currentState.graphId),
    };
  }

  private executeResetCurrentSessionOwnerReviews(): ExecuteCommandResult {
    const currentState = this.repository.loadState();
    const allEvents = this.repository.loadEvents();
    const reviewSessions = this.repository.loadReviewSessions();

    const lastClosedRevision = reviewSessions.length
      ? reviewSessions[reviewSessions.length - 1].endRevisionInclusive
      : 0;

    const currentSessionEvents = allEvents.filter((event) => event.revision > lastClosedRevision);
    const nodeIdsTouchedByOwner = new Set(
      currentSessionEvents
        .filter(
          (event): event is Extract<DomainEvent, { type: "NODE_VOTE_CHANGED" }> =>
            event.actorId === OWNER_ID && event.type === "NODE_VOTE_CHANGED"
        )
        .map((event) => event.nodeId)
    );

    const linkIdsTouchedByOwner = new Set(
      currentSessionEvents
        .filter(
          (event): event is
            | Extract<DomainEvent, { type: "LINK_VOTE_CHANGED" }>
            | Extract<DomainEvent, { type: "LINK_VOTE_LOCKED" }> =>
            event.actorId === OWNER_ID &&
            (event.type === "LINK_VOTE_CHANGED" || event.type === "LINK_VOTE_LOCKED")
        )
        .map((event) => event.linkId)
    );

    const nextStatePreValidation: GraphState = {
      ...currentState,
      nodes: removeOwnerVotesFromNodes(currentState.nodes, nodeIdsTouchedByOwner),
      links: removeOwnerVotesFromLinks(currentState.links, {
        onlyLinkIds: linkIdsTouchedByOwner,
        clearGlobalLocks: true,
      }),
    };

    const revalidated = revalidateGraph(nextStatePreValidation).nextState;
    this.repository.saveState(revalidated);

    const filteredEvents = allEvents.filter((event) => {
      if (event.revision <= lastClosedRevision) return true;
      if (event.actorId !== OWNER_ID) return true;
      return ![
        "NODE_VOTE_CHANGED",
        "LINK_VOTE_CHANGED",
        "LINK_VOTE_LOCKED",
      ].includes(event.type);
    });

    this.repository.replaceEvents(filteredEvents);

    return {
      decision: emptyDecision(
        revalidated,
        "Owner reviews from the current open session were reset."
      ),
      performanceReadModel: buildReadModel(
        this.repository,
        revalidated.graphId,
        reviewSessions.at(-1)?.sessionId
      ),
    };
  }

  private executeResetAllOwnerReviews(): ExecuteCommandResult {
    const currentState = this.repository.loadState();

    const nextStatePreValidation: GraphState = {
      ...currentState,
      nodes: removeOwnerVotesFromNodes(currentState.nodes),
      links: removeOwnerVotesFromLinks(currentState.links, {
        clearGlobalLocks: true,
      }),
    };

    const revalidated = revalidateGraph(nextStatePreValidation).nextState;
    this.repository.saveState(revalidated);
    this.repository.replaceEvents([]);
    this.repository.replaceReviewSessions([]);
    this.repository.replaceLedgerEntries([]);
    this.repository.replaceUserEvaluations([]);
    this.repository.replaceTrustProfiles([]);

    return {
      decision: emptyDecision(
        revalidated,
        "All owner reviews, review sessions, and derived statistics were reset."
      ),
      performanceReadModel: buildReadModel(this.repository, revalidated.graphId),
    };
  }

  execute(action: GraphAction): ExecuteCommandResult {
    if (action.type === "RESET_REVIEW_HISTORY") {
      return this.executeResetReviewHistory();
    }

    if (action.type === "RESET_CURRENT_SESSION_OWNER_REVIEWS") {
      return this.executeResetCurrentSessionOwnerReviews();
    }

    if (action.type === "RESET_ALL_OWNER_REVIEWS") {
      return this.executeResetAllOwnerReviews();
    }

    const currentState = this.repository.loadState();
    const reviewSessions = this.repository.loadReviewSessions();
    const currentReviewStartRevision = reviewSessions.length
      ? reviewSessions[reviewSessions.length - 1].endRevisionInclusive
      : 0;

    const decision = applyGraphAction(currentState, action, currentReviewStartRevision);

    if (!decision.allowed) {
      return { decision };
    }

    this.repository.saveState(decision.nextState);
    this.repository.appendEvents(decision.events);

    if (action.type !== "CLOSE_REVIEW_SESSION") {
      return {
        decision,
        performanceReadModel: buildReadModel(
          this.repository,
          decision.nextState.graphId,
          reviewSessions.at(-1)?.sessionId
        ),
      };
    }

    const reviewClosedEvent = decision.events.find(
      (event): event is Extract<DomainEvent, { type: "REVIEW_SESSION_CLOSED" }> =>
        event.type === "REVIEW_SESSION_CLOSED"
    );

    if (!reviewClosedEvent) {
      return { decision };
    }

    const reviewSession: ReviewSession = {
      sessionId: reviewClosedEvent.sessionId,
      graphId: decision.nextState.graphId,
      label: reviewClosedEvent.sessionLabel,
      ownerId: OWNER_ID,
      policyVersion: DEFAULT_POLICY_VERSION,
      startRevisionExclusive: reviewClosedEvent.startRevisionExclusive,
      endRevisionInclusive: reviewClosedEvent.endRevisionInclusive,
      openedAt: reviewClosedEvent.occurredAt,
      closedAt: reviewClosedEvent.occurredAt,
    };

    this.repository.saveReviewSession(reviewSession);

    const allEvents = this.repository.loadEvents();
    const sessionEvents = allEvents.filter(
      (event) =>
        event.revision > reviewSession.startRevisionExclusive &&
        event.revision <= reviewSession.endRevisionInclusive
    );

    const trustProfilesBefore = this.repository.loadTrustProfiles();

    const evaluation = evaluateReviewSession({
      graphId: decision.nextState.graphId,
      session: reviewSession,
      users: DEFAULT_USERS.map((user) => user.id as UserId),
      nodes: decision.nextState.nodes,
      links: decision.nextState.links,
      eventsInSession: sessionEvents,
      trustProfilesBefore,
      policy: DEFAULT_SCORING_POLICY,
    });

    this.repository.appendLedgerEntries(evaluation.ledgerEntries);
    this.repository.saveUserEvaluations(evaluation.evaluations);
    this.repository.saveTrustProfiles(evaluation.trustProfilesAfter);

    return {
      decision,
      reviewSession,
      performanceReadModel: buildReadModel(
        this.repository,
        decision.nextState.graphId,
        reviewSession.sessionId
      ),
    };
  }
}
