import * as Y from "yjs";
import type {
  DomainEvent,
  GraphLinkEntity,
  GraphNodeEntity,
  GraphNodeLayout,
  GraphState,
  ReviewSession,
  ScoreLedgerEntry,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../domain/types";

export type GraphYDoc = {
  ydoc: Y.Doc;
  nodesMap: Y.Map<GraphNodeEntity>;
  linksMap: Y.Map<GraphLinkEntity>;
  layoutMap: Y.Map<GraphNodeLayout>;
  metaMap: Y.Map<unknown>;
  eventsArray: Y.Array<DomainEvent>;
  reviewSessionsArray: Y.Array<ReviewSession>;
  ledgerArray: Y.Array<ScoreLedgerEntry>;
  evaluationsArray: Y.Array<UserSessionEvaluation>;
  trustProfilesArray: Y.Array<UserTrustProfile>;
};

export function getGraphYDoc(ydoc: Y.Doc): GraphYDoc {
  return {
    ydoc,
    nodesMap: ydoc.getMap<GraphNodeEntity>("graph_nodes"),
    linksMap: ydoc.getMap<GraphLinkEntity>("graph_links"),
    layoutMap: ydoc.getMap<GraphNodeLayout>("graph_node_layout"),
    metaMap: ydoc.getMap("graph_meta"),
    eventsArray: ydoc.getArray<DomainEvent>("graph_events"),
    reviewSessionsArray: ydoc.getArray<ReviewSession>("graph_review_sessions"),
    ledgerArray: ydoc.getArray<ScoreLedgerEntry>("graph_score_ledger"),
    evaluationsArray: ydoc.getArray<UserSessionEvaluation>("graph_session_evaluations"),
    trustProfilesArray: ydoc.getArray<UserTrustProfile>("graph_trust_profiles"),
  };
}

export function readGraphState(doc: GraphYDoc): GraphState {
  const revisionRaw = doc.metaMap.get("revision");
  const graphIdRaw = doc.metaMap.get("graphId");

  return {
    graphId: typeof graphIdRaw === "string" ? graphIdRaw : "graph-truth-sandbox",
    revision: typeof revisionRaw === "number" ? revisionRaw : 0,
    nodes: Array.from(doc.nodesMap.values()),
    links: Array.from(doc.linksMap.values()),
  };
}

export function writeGraphState(doc: GraphYDoc, state: GraphState): void {
  doc.ydoc.transact(() => {
    doc.metaMap.set("graphId", state.graphId);
    doc.metaMap.set("revision", state.revision);

    doc.nodesMap.clear();
    doc.linksMap.clear();

    for (const node of state.nodes) {
      doc.nodesMap.set(node.id, node);
    }

    for (const link of state.links) {
      doc.linksMap.set(link.id, link);
    }
  });
}
