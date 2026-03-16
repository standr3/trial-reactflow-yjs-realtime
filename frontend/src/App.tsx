import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useReactFlow,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeChange,
  type Connection,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./App.css";

import * as Y from "yjs";

import { useHocuspocusProvider } from "./hooks/use-hocuspocus-provider";

import { getGraphYDoc, readGraphState } from "./collab/yjs-graph-doc";
import {
  mapGraphLinksToReactFlowEdges,
  mapGraphNodesToReactFlowNodes,
} from "./collab/reactflow-mappers";
import { runGraphAction } from "./collab/graph-action-runner";

import { buildPerformanceReadModel } from "./analytics/readModels";

import {
  DEFAULT_GRAPH_ID,
  GOVERNANCE_AUTHORITATIVE,
  GOVERNANCE_COMMUNITY,
} from "./domain/constants";

import {
  getLinkCanonicalStatus,
  getNodeCanonicalStatus,
  resolveNodeStance,
} from "./domain/selectors";

import type { ExecuteCommandResult } from "./app/graphCommandService";

import type {
  GraphLinkEntity,
  GraphNodeEntity,
  GraphNodeLayout,
  PerformanceReadModel,
  ReviewSession,
  ScoreLedgerEntry,
  UserId,
  UserSessionEvaluation,
  UserTrustProfile,
} from "./domain/types";

import { GraphNode } from "./ui/GraphNode";
import { GraphEdge } from "./ui/GraphEdge";
import { PerformanceStatsPanel } from "./ui/PerformanceStatsPanel";
import { ReviewSessionsPanel } from "./ui/ReviewSessionsPanel";
import { SessionReviewToolbar } from "./ui/SessionReviewToolbar";

type CursorPosition = { x: number; y: number };

type AwarenessUserData = {
  userName: string;
  cursorPosition: CursorPosition;
};

type EventLogItem = {
  ts: string;
  message: string;
};

const nodeTypes = {
  graphNode: GraphNode,
};

const edgeTypes = {
  graphEdge: GraphEdge,
};

function resolveCurrentUser(userName: string): UserId {
  const normalized = userName.trim().toLowerCase();

  if (normalized === "o" || normalized === "owner") return "O";
  if (normalized === "g_1" || normalized === "g1" || normalized === "guest1")
    return "G_1";
  if (normalized === "g_2" || normalized === "g2" || normalized === "guest2")
    return "G_2";
  if (normalized === "g_3" || normalized === "g3" || normalized === "guest3")
    return "G_3";

  return "G_1";
}

function seedGraphIfEmpty(ydoc: Y.Doc): boolean {
  const graphDoc = getGraphYDoc(ydoc);

  if (graphDoc.nodesMap.size > 0) {
    return false;
  }

  const now = new Date().toISOString();

  const initialNodes: GraphNodeEntity[] = [
    {
      id: "n-owner",
      label: "Owner concept",
      creatorId: "O",
      governanceMode: GOVERNANCE_AUTHORITATIVE,
      votesByUser: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "n-guest-1",
      label: "Guest 1 concept",
      creatorId: "G_1",
      governanceMode: GOVERNANCE_COMMUNITY,
      votesByUser: {},
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "n-guest-2",
      label: "Guest 2 concept",
      creatorId: "G_2",
      governanceMode: GOVERNANCE_COMMUNITY,
      votesByUser: {},
      createdAt: now,
      updatedAt: now,
    },
  ];

  graphDoc.ydoc.transact(() => {
    graphDoc.metaMap.set("graphId", DEFAULT_GRAPH_ID);
    graphDoc.metaMap.set("revision", 0);

    for (const node of initialNodes) {
      graphDoc.nodesMap.set(node.id, node);
    }

    graphDoc.layoutMap.set("n-owner", {
      nodeId: "n-owner",
      x: 160,
      y: 140,
    });

    graphDoc.layoutMap.set("n-guest-1", {
      nodeId: "n-guest-1",
      x: 500,
      y: 140,
    });

    graphDoc.layoutMap.set("n-guest-2", {
      nodeId: "n-guest-2",
      x: 330,
      y: 360,
    });
  });

  return true;
}

function Cursor({ cursorPosition, userName }: AwarenessUserData) {
  return (
    <div
      style={{
        position: "fixed",
        left: cursorPosition.x,
        top: cursorPosition.y,
        pointerEvents: "none",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#ef4444",
        }}
      />
      <div
        style={{
          marginTop: 4,
          background: "#111827",
          color: "#ffffff",
          fontSize: 11,
          padding: "2px 6px",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        {userName}
      </div>
    </div>
  );
}

function InspectorPanel({
  selectedNode,
  selectedLink,
  currentUser,
}: {
  selectedNode: GraphNodeEntity | null;
  selectedLink: GraphLinkEntity | null;
  currentUser: UserId;
}) {
  if (!selectedNode && !selectedLink) {
    return (
      <div
        style={{
          position: "fixed",
          left: 16,
          top: 16,
          width: 340,
          maxHeight: 260,
          overflow: "auto",
          background: "#ffffff",
          border: "1px solid #d1d5db",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          fontSize: 12,
          zIndex: 20,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Inspector</div>
        <div style={{ color: "#6b7280" }}>No entity selected</div>
        <div style={{ marginTop: 10, color: "#6b7280" }}>
          Current user: {currentUser}
        </div>
      </div>
    );
  }

  if (selectedNode) {
    const stance = resolveNodeStance(selectedNode, currentUser);
    const canonicalStatus = getNodeCanonicalStatus(selectedNode);

    return (
      <div
        style={{
          position: "fixed",
          left: 16,
          top: 16,
          width: 340,
          maxHeight: 320,
          overflow: "auto",
          background: "#ffffff",
          border: "1px solid #d1d5db",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          fontSize: 12,
          zIndex: 20,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Node inspector</div>

        <div>
          <strong>id:</strong> {selectedNode.id}
        </div>
        <div>
          <strong>label:</strong> {selectedNode.label}
        </div>
        <div>
          <strong>creatorId:</strong> {selectedNode.creatorId}
        </div>
        <div>
          <strong>governanceMode:</strong> {selectedNode.governanceMode}
        </div>
        <div>
          <strong>canonical status:</strong> {canonicalStatus}
        </div>
        <div>
          <strong>your stance:</strong> {stance}
        </div>
        <div>
          <strong>createdAt:</strong> {selectedNode.createdAt}
        </div>
        <div>
          <strong>updatedAt:</strong> {selectedNode.updatedAt}
        </div>

        <div style={{ marginTop: 10, fontWeight: 700 }}>votesByUser</div>
        <pre
          style={{
            marginTop: 6,
            padding: 8,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            borderRadius: 6,
            overflowX: "auto",
            fontSize: 11,
            lineHeight: 1.4,
          }}
        >
          {JSON.stringify(selectedNode.votesByUser, null, 2)}
        </pre>
      </div>
    );
  }

  const link = selectedLink!;
  const canonicalStatus = getLinkCanonicalStatus(link);

  return (
    <div
      style={{
        position: "fixed",
        left: 16,
        top: 16,
        width: 340,
        maxHeight: 320,
        overflow: "auto",
        background: "#ffffff",
        border: "1px solid #d1d5db",
        borderRadius: 12,
        padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        fontSize: 12,
        zIndex: 20,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Link inspector</div>

      <div>
        <strong>id:</strong> {link.id}
      </div>
      <div>
        <strong>label:</strong> {link.label || "relation"}
      </div>
      <div>
        <strong>sourceId:</strong> {link.sourceId}
      </div>
      <div>
        <strong>targetId:</strong> {link.targetId}
      </div>
      <div>
        <strong>creatorId:</strong> {link.creatorId}
      </div>
      <div>
        <strong>supportType:</strong> {link.supportType}
      </div>
      <div>
        <strong>governanceMode:</strong> {link.governanceMode}
      </div>
      <div>
        <strong>globalVoteLocked:</strong> {String(link.globalVoteLocked)}
      </div>
      <div>
        <strong>canonical status:</strong> {canonicalStatus}
      </div>
      <div>
        <strong>createdAt:</strong> {link.createdAt}
      </div>
      <div>
        <strong>updatedAt:</strong> {link.updatedAt}
      </div>

      <div style={{ marginTop: 10, fontWeight: 700 }}>votesByUser</div>
      <pre
        style={{
          marginTop: 6,
          padding: 8,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          overflowX: "auto",
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        {JSON.stringify(link.votesByUser, null, 2)}
      </pre>

      <div style={{ marginTop: 10, fontWeight: 700 }}>voteLocksByUser</div>
      <pre
        style={{
          marginTop: 6,
          padding: 8,
          background: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: 6,
          overflowX: "auto",
          fontSize: 11,
          lineHeight: 1.4,
        }}
      >
        {JSON.stringify(link.voteLocksByUser, null, 2)}
      </pre>
    </div>
  );
}

function emptyPerformance(graphId: string): PerformanceReadModel {
  return {
    graphId,
    currentSessionId: undefined,
    quickStats: [],
    latestEvaluations: [],
    recentLedgerEntries: [],
    trustProfiles: [],
    allEvaluations: [],
    reviewSessions: [],
    sessionHistory: [],
    overallStats: {} as PerformanceReadModel["overallStats"],
  };
}
export const App = () => {
  const { provider, userName } = useHocuspocusProvider();
  const { flowToScreenPosition, screenToFlowPosition } = useReactFlow();

  const ydoc = provider?.document ?? null;

  const currentUser = useMemo<UserId>(() => {
    return resolveCurrentUser(userName);
  }, [userName]);

  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [awareness, setAwareness] = useState<AwarenessUserData[]>([]);
  const [eventLog, setEventLog] = useState<EventLogItem[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [graphNodesSnapshot, setGraphNodesSnapshot] = useState<
    GraphNodeEntity[]
  >([]);
  const [graphLinksSnapshot, setGraphLinksSnapshot] = useState<
    GraphLinkEntity[]
  >([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [performance, setPerformance] = useState<PerformanceReadModel | null>(
    null,
  );
  const [reviewCount, setReviewCount] = useState(0);

  const [reviewSessions, setReviewSessions] = useState<ReviewSession[]>([]);
  const [allEvaluations, setAllEvaluations] = useState<UserSessionEvaluation[]>(
    [],
  );
  const [allTrustProfiles, setAllTrustProfiles] = useState<UserTrustProfile[]>(
    [],
  );
  const [allLedgerEntries, setAllLedgerEntries] = useState<ScoreLedgerEntry[]>(
    [],
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    null,
  );

  const lastLayoutSyncRef = useRef<Record<string, number>>({});

  const pushLog = useCallback((message: string) => {
    setEventLog((current) =>
      [
        {
          ts: new Date().toLocaleTimeString(),
          message,
        },
        ...current,
      ].slice(0, 40),
    );
  }, []);

  const pushCommandResult = useCallback(
    (label: string, result: ExecuteCommandResult) => {
      pushLog(`${label} :: ${result.decision.reason}`);

      if (result.decision.warnings.length > 0) {
        for (const warning of result.decision.warnings) {
          pushLog(`warning :: ${warning}`);
        }
      }

      if (result.reviewSession) {
        pushLog(
          `review closed :: ${result.reviewSession.label} (${result.reviewSession.sessionId})`,
        );
      }

      if (result.performanceReadModel) {
        setPerformance(result.performanceReadModel);
      }
    },
    [pushLog],
  );

  useEffect(() => {
    if (!ydoc) return;

    const graphDoc = getGraphYDoc(ydoc);

    const syncFromGraphDoc = () => {
      seedGraphIfEmpty(ydoc);

      const graphState = readGraphState(graphDoc);
      const layouts = new Map<string, GraphNodeLayout>();

      graphDoc.layoutMap.forEach((layout) => {
        layouts.set(layout.nodeId, layout);
      });

      setGraphNodesSnapshot(graphState.nodes);
      setGraphLinksSnapshot(graphState.links);

      setNodes(
        mapGraphNodesToReactFlowNodes(
          graphState.nodes,
          layouts,
          ydoc,
          currentUser,
          pushLog,
          graphState.links,
        ),
      );

      setEdges(
        mapGraphLinksToReactFlowEdges(
          graphState.links,
          ydoc,
          currentUser,
          pushLog,
          graphState.nodes,
        ),
      );

      const nextReviewSessions =
        graphDoc.reviewSessionsArray.toArray() as ReviewSession[];
      const nextEvaluations =
        graphDoc.evaluationsArray.toArray() as UserSessionEvaluation[];
      const nextTrustProfiles =
        graphDoc.trustProfilesArray.toArray() as UserTrustProfile[];
      const nextLedgerEntries =
        graphDoc.ledgerArray.toArray() as ScoreLedgerEntry[];

      setReviewSessions(nextReviewSessions);
      setAllEvaluations(nextEvaluations);
      setAllTrustProfiles(nextTrustProfiles);
      setAllLedgerEntries(nextLedgerEntries);
      setReviewCount(nextReviewSessions.length);

      if (!selectedSessionId && nextReviewSessions.length > 0) {
        setSelectedSessionId(
          nextReviewSessions[nextReviewSessions.length - 1].sessionId,
        );
      }

      if (
        nextReviewSessions.length === 0 &&
        nextEvaluations.length === 0 &&
        nextTrustProfiles.length === 0 &&
        nextLedgerEntries.length === 0
      ) {
        setPerformance(emptyPerformance(graphState.graphId));
      } else {
        setPerformance(
          buildPerformanceReadModel({
            graphId: graphState.graphId,
            currentSessionId: nextReviewSessions.at(-1)?.sessionId,
            evaluations: nextEvaluations,
            trustProfiles: nextTrustProfiles,
            ledgerEntries: nextLedgerEntries,
            reviewSessions: nextReviewSessions,
          }),
        );
      }
    };

    syncFromGraphDoc();

    const observer = () => {
      syncFromGraphDoc();
    };

    graphDoc.nodesMap.observe(observer);
    graphDoc.linksMap.observe(observer);
    graphDoc.layoutMap.observe(observer);
    graphDoc.reviewSessionsArray.observe(observer);
    graphDoc.ledgerArray.observe(observer);
    graphDoc.evaluationsArray.observe(observer);
    graphDoc.trustProfilesArray.observe(observer);

    return () => {
      graphDoc.nodesMap.unobserve(observer);
      graphDoc.linksMap.unobserve(observer);
      graphDoc.layoutMap.unobserve(observer);
      graphDoc.reviewSessionsArray.unobserve(observer);
      graphDoc.ledgerArray.unobserve(observer);
      graphDoc.evaluationsArray.unobserve(observer);
      graphDoc.trustProfilesArray.unobserve(observer);
    };
  }, [ydoc, currentUser, pushLog, selectedSessionId]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, []);

  const onNodeDrag = useCallback(
    (_event: MouseEvent | globalThis.MouseEvent, node: Node) => {
      if (!ydoc) return;

      const now = Date.now();
      const lastSync = lastLayoutSyncRef.current[node.id] ?? 0;

      if (now - lastSync < 40) return;

      lastLayoutSyncRef.current[node.id] = now;

      const graphDoc = getGraphYDoc(ydoc);

      graphDoc.layoutMap.set(node.id, {
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
      });
    },
    [ydoc],
  );

  const onNodeDragStop = useCallback(
    (_event: MouseEvent | globalThis.MouseEvent, node: Node) => {
      if (!ydoc) return;

      const graphDoc = getGraphYDoc(ydoc);

      graphDoc.layoutMap.set(node.id, {
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
      });
    },
    [ydoc],
  );

  const onNodeClick = useCallback<NodeMouseHandler<Node>>((_event, node) => {
    setSelectedNodeId(node.id);
    setSelectedLinkId(null);
  }, []);

  const onEdgeClick = useCallback<EdgeMouseHandler<Edge>>((_event, edge) => {
    setSelectedNodeId(null);
    setSelectedLinkId(edge.id);
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!ydoc || !connection.source || !connection.target) return;

      const result = runGraphAction(ydoc, {
        type: "ADD_LINK",
        userId: currentUser,
        sourceId: connection.source,
        targetId: connection.target,
      });

      pushCommandResult(
        `[${currentUser}] ADD_LINK ${connection.source} -> ${connection.target}`,
        result,
      );
    },
    [ydoc, currentUser, pushCommandResult],
  );

  const closeReviewSession = useCallback(() => {
    if (!ydoc) return;

    const result = runGraphAction(ydoc, {
      type: "CLOSE_REVIEW_SESSION",
      userId: currentUser,
      sessionLabel: `Performance review ${reviewCount + 1}`,
    });

    pushCommandResult(`[${currentUser}] CLOSE_REVIEW_SESSION`, result);
  }, [ydoc, currentUser, reviewCount, pushCommandResult]);

  const resetCurrentOwnerReviews = useCallback(() => {
    if (!ydoc) return;

    const result = runGraphAction(ydoc, {
      type: "RESET_CURRENT_SESSION_OWNER_REVIEWS",
      userId: currentUser,
    });

    pushCommandResult(
      `[${currentUser}] RESET_CURRENT_SESSION_OWNER_REVIEWS`,
      result,
    );
  }, [ydoc, currentUser, pushCommandResult]);

  const resetReviewSessions = useCallback(() => {
    if (!ydoc) return;

    const result = runGraphAction(ydoc, {
      type: "RESET_REVIEW_HISTORY",
      userId: currentUser,
    });

    pushCommandResult(`[${currentUser}] RESET_REVIEW_HISTORY`, result);
  }, [ydoc, currentUser, pushCommandResult]);

  const resetAllOwnerReviews = useCallback(() => {
    if (!ydoc) return;

    const result = runGraphAction(ydoc, {
      type: "RESET_ALL_OWNER_REVIEWS",
      userId: currentUser,
    });

    pushCommandResult(`[${currentUser}] RESET_ALL_OWNER_REVIEWS`, result);
  }, [ydoc, currentUser, pushCommandResult]);

  const updateAwareness = useCallback(
    (event: MouseEvent | globalThis.MouseEvent) => {
      const awareness = provider?.awareness;

      if (!awareness) return;

      const cursorPosition = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      awareness.setLocalStateField("userMetadata", {
        userName,
        cursorPosition,
      });
    },
    [provider, screenToFlowPosition, userName],
  );

  useEffect(() => {
    const awareness = provider?.awareness;

    if (!awareness) return;

    const awarenessObserver = () => {
      const states = awareness.getStates();
      const updatedAwareness: AwarenessUserData[] = [];

      for (const [clientId, state] of states.entries()) {
        const userMetadata = state.userMetadata as
          | AwarenessUserData
          | undefined;

        if (clientId === awareness.clientID || !userMetadata) continue;

        updatedAwareness.push({
          userName: userMetadata.userName,
          cursorPosition: flowToScreenPosition(userMetadata.cursorPosition),
        });
      }

      setAwareness(updatedAwareness);
    };

    awareness.on("update", awarenessObserver);

    return () => {
      awareness.off("update", awarenessObserver);
    };
  }, [provider, flowToScreenPosition]);

  const selectedNode =
    graphNodesSnapshot.find((node) => node.id === selectedNodeId) ?? null;

  const selectedLink =
    graphLinksSnapshot.find((link) => link.id === selectedLinkId) ?? null;

  return (
    <div className="app-shell">
      <div className="app-main-grid">
        <section className="flow-pane">
          <div className="flow-surface">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onNodeDrag={(event, node) => {
                updateAwareness(event);
                onNodeDrag(event, node);
              }}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onMouseMove={updateAwareness}
              fitView
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>
        </section>

        <aside className="right-sidebar">
          <div className="sidebar-section sidebar-controls">
            <SessionReviewToolbar
              currentUser={currentUser}
              onCloseReviewSession={closeReviewSession}
              onResetCurrentOwnerReviews={resetCurrentOwnerReviews}
              onResetReviewSessions={resetReviewSessions}
              onResetAllOwnerReviews={resetAllOwnerReviews}
              currentSessionId={performance?.currentSessionId}
              reviewsCount={reviewCount}
              disabled={!ydoc}
            />
          </div>

          <div className="sidebar-section sidebar-performance">
            <PerformanceStatsPanel
              performance={performance}
              expandedUserId={expandedUserId}
              onToggleExpand={(userId) =>
                setExpandedUserId((current) =>
                  current === userId ? null : userId,
                )
              }
              embedded
            />
          </div>

          <div className="sidebar-section sidebar-reviews">
            <ReviewSessionsPanel
              reviewSessions={reviewSessions}
              evaluations={allEvaluations}
              trustProfiles={allTrustProfiles}
              ledgerEntries={allLedgerEntries}
              selectedSessionId={selectedSessionId}
              onSelectSession={setSelectedSessionId}
              embedded
            />
          </div>
        </aside>
      </div>

      {awareness.map(({ cursorPosition, userName }, index) => (
        <Cursor
          key={`${userName}-${index}`}
          cursorPosition={cursorPosition}
          userName={userName}
        />
      ))}

      <InspectorPanel
        selectedNode={selectedNode}
        selectedLink={selectedLink}
        currentUser={currentUser}
      />

      <div className="event-log-panel">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Event log</div>

        {eventLog.length === 0 ? (
          <div style={{ color: "#6b7280" }}>No events yet</div>
        ) : (
          eventLog.map((item, index) => (
            <div
              key={`${item.ts}-${index}`}
              style={{
                padding: "6px 0",
                borderBottom: "1px solid #f3f4f6",
              }}
            >
              <div style={{ color: "#6b7280", fontSize: 11 }}>{item.ts}</div>
              <div>{item.message}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
