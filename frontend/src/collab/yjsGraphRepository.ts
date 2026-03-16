import type {
  DomainEvent,
  GraphState,
  ReviewSession,
  ScoreLedgerEntry,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../domain/types";
import type { GraphRepository } from "../app/graphCommandService";
import { getGraphYDoc, readGraphState, writeGraphState } from "./yjs-graph-doc";
import type * as Y from "yjs";

export class YjsGraphRepository implements GraphRepository {
  constructor(private readonly ydoc: Y.Doc) {}

  loadState(): GraphState {
    return readGraphState(getGraphYDoc(this.ydoc));
  }

  saveState(state: GraphState): void {
    writeGraphState(getGraphYDoc(this.ydoc), state);
  }

  appendEvents(events: DomainEvent[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.eventsArray.push(events);
    });
  }

  replaceEvents(events: DomainEvent[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.eventsArray.delete(0, doc.eventsArray.length);
      if (events.length > 0) {
        doc.eventsArray.push(events);
      }
    });
  }

  loadEvents(): DomainEvent[] {
    return getGraphYDoc(this.ydoc).eventsArray.toArray();
  }

  saveReviewSession(session: ReviewSession): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.reviewSessionsArray.push([session]);
    });
  }

  replaceReviewSessions(sessions: ReviewSession[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.reviewSessionsArray.delete(0, doc.reviewSessionsArray.length);
      if (sessions.length > 0) {
        doc.reviewSessionsArray.push(sessions);
      }
    });
  }

  loadReviewSessions(): ReviewSession[] {
    return getGraphYDoc(this.ydoc).reviewSessionsArray.toArray();
  }

  appendLedgerEntries(entries: ScoreLedgerEntry[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.ledgerArray.push(entries);
    });
  }

  replaceLedgerEntries(entries: ScoreLedgerEntry[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.ledgerArray.delete(0, doc.ledgerArray.length);
      if (entries.length > 0) {
        doc.ledgerArray.push(entries);
      }
    });
  }

  loadLedgerEntries(): ScoreLedgerEntry[] {
    return getGraphYDoc(this.ydoc).ledgerArray.toArray();
  }

  saveUserEvaluations(evaluations: UserSessionEvaluation[]): void {
    const doc = getGraphYDoc(this.ydoc);
    const sessionIds = new Set(evaluations.map((item) => item.sessionId));

    doc.ydoc.transact(() => {
      const kept = doc.evaluationsArray
        .toArray()
        .filter((item) => !sessionIds.has(item.sessionId));
      doc.evaluationsArray.delete(0, doc.evaluationsArray.length);
      doc.evaluationsArray.push([...kept, ...evaluations]);
    });
  }

  replaceUserEvaluations(evaluations: UserSessionEvaluation[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.evaluationsArray.delete(0, doc.evaluationsArray.length);
      if (evaluations.length > 0) {
        doc.evaluationsArray.push(evaluations);
      }
    });
  }

  loadUserEvaluations(): UserSessionEvaluation[] {
    return getGraphYDoc(this.ydoc).evaluationsArray.toArray();
  }

  saveTrustProfiles(profiles: UserTrustProfile[]): void {
    const doc = getGraphYDoc(this.ydoc);
    const byUser = new Map(
      doc.trustProfilesArray.toArray().map((profile) => [profile.userId, profile])
    );
    for (const profile of profiles) {
      byUser.set(profile.userId, profile);
    }

    doc.ydoc.transact(() => {
      doc.trustProfilesArray.delete(0, doc.trustProfilesArray.length);
      doc.trustProfilesArray.push(Array.from(byUser.values()));
    });
  }

  replaceTrustProfiles(profiles: UserTrustProfile[]): void {
    const doc = getGraphYDoc(this.ydoc);
    doc.ydoc.transact(() => {
      doc.trustProfilesArray.delete(0, doc.trustProfilesArray.length);
      if (profiles.length > 0) {
        doc.trustProfilesArray.push(profiles);
      }
    });
  }

  loadTrustProfiles(): UserTrustProfile[] {
    return getGraphYDoc(this.ydoc).trustProfilesArray.toArray();
  }
}
