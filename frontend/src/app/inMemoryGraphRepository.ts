import type {
  DomainEvent,
  GraphState,
  ReviewSession,
  ScoreLedgerEntry,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../domain/types";
import type { GraphRepository } from "./graphCommandService";

export class InMemoryGraphRepository implements GraphRepository {
  private state: GraphState;
  private events: DomainEvent[] = [];
  private reviewSessions: ReviewSession[] = [];
  private ledgerEntries: ScoreLedgerEntry[] = [];
  private evaluations: UserSessionEvaluation[] = [];
  private trustProfiles: UserTrustProfile[] = [];

  constructor(initialState: GraphState) {
    this.state = initialState;
  }

  loadState(): GraphState {
    return structuredClone(this.state);
  }

  saveState(state: GraphState): void {
    this.state = structuredClone(state);
  }

  appendEvents(events: DomainEvent[]): void {
    this.events.push(...structuredClone(events));
  }

  loadEvents(): DomainEvent[] {
    return structuredClone(this.events);
  }

  saveReviewSession(session: ReviewSession): void {
    this.reviewSessions.push(structuredClone(session));
  }

  loadReviewSessions(): ReviewSession[] {
    return structuredClone(this.reviewSessions);
  }

  appendLedgerEntries(entries: ScoreLedgerEntry[]): void {
    this.ledgerEntries.push(...structuredClone(entries));
  }

  loadLedgerEntries(): ScoreLedgerEntry[] {
    return structuredClone(this.ledgerEntries);
  }

  saveUserEvaluations(evaluations: UserSessionEvaluation[]): void {
    const sessionId = new Set(evaluations.map((item) => item.sessionId));
    this.evaluations = this.evaluations.filter((item) => !sessionId.has(item.sessionId));
    this.evaluations.push(...structuredClone(evaluations));
  }

  loadUserEvaluations(): UserSessionEvaluation[] {
    return structuredClone(this.evaluations);
  }

  saveTrustProfiles(profiles: UserTrustProfile[]): void {
    const byUser = new Map(this.trustProfiles.map((profile) => [profile.userId, profile]));
    for (const profile of profiles) {
      byUser.set(profile.userId, structuredClone(profile));
    }
    this.trustProfiles = Array.from(byUser.values());
  }

  loadTrustProfiles(): UserTrustProfile[] {
    return structuredClone(this.trustProfiles);
  }
}
