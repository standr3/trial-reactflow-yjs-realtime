import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type * as Y from "yjs";

import { runGraphAction } from "../collab/graph-action-runner";
import { VOTE_DOWN, VOTE_UP } from "../domain/constants";
import type { UserId } from "../domain/types";

export type GraphNodeData = {
  nodeId: string;
  label: string;
  creator?: string;
  status?: string;
  stance?: string;
  myVote?: string;
  voteReason?: string;
  voteControlsMode?: "hidden" | "disabled" | "enabled";
  canVoteUp: boolean;
  canVoteDown: boolean;
  votes?: {
    up: string[];
    down: string[];
  };
  ydoc: Y.Doc;
  currentUser: UserId;
  onLog?: (message: string) => void;
};

export type GraphFlowNode = Node<GraphNodeData, "graphNode">;

function getStatusColor(status?: string) {
  switch (status) {
    case "canonical_true":
      return "#22c55e";
    case "canonical_false":
      return "#ef4444";
    case "local_true":
      return "#3b82f6";
    case "local_false":
      return "#f97316";
    default:
      return "#9ca3af";
  }
}

function getVoteButtonStyle(
  direction: "up" | "down",
  myVote?: string,
  disabled?: boolean
) {
  const isToggled =
    (direction === "up" && myVote === VOTE_UP) ||
    (direction === "down" && myVote === VOTE_DOWN);

  const activeBg = direction === "up" ? "#16a34a" : "#dc2626";
  const activeBorder = direction === "up" ? "#15803d" : "#b91c1c";

  if (isToggled && disabled) {
    return {
      background: activeBg,
      border: `1px solid ${activeBorder}`,
      color: "#ffffff",
      cursor: "not-allowed",
      opacity: 0.58,
      fontWeight: 800,
    };
  }

  if (isToggled) {
    return {
      background: activeBg,
      border: `1px solid ${activeBorder}`,
      color: "#ffffff",
      cursor: "pointer",
      opacity: 1,
      fontWeight: 800,
    };
  }

  if (disabled) {
    return {
      background: "#f3f4f6",
      border: "1px solid #d1d5db",
      color: "#9ca3af",
      cursor: "not-allowed",
      opacity: 0.7,
      fontWeight: 600,
    };
  }

  return {
    background: "#ffffff",
    border: "1px solid #d1d5db",
    color: "#111827",
    cursor: "pointer",
    opacity: 1,
    fontWeight: 600,
  };
}

function getResultMessage(result: unknown): string {
  const value = result as {
    decision?: { reason?: string };
  };

  return value.decision?.reason ?? "action executed";
}

function GraphNodeComponent({ data }: NodeProps<GraphFlowNode>) {
  const handleUp = () => {
    if (!data.canVoteUp) return;

    const result = runGraphAction(data.ydoc, {
      type: "TOGGLE_NODE_VOTE",
      userId: data.currentUser,
      nodeId: data.nodeId,
      direction: "up",
    });

    data.onLog?.(
      `[${data.currentUser}] TOGGLE_NODE_VOTE up ${data.nodeId} :: ${getResultMessage(result)}`
    );
  };

  const handleDown = () => {
    if (!data.canVoteDown) return;

    const result = runGraphAction(data.ydoc, {
      type: "TOGGLE_NODE_VOTE",
      userId: data.currentUser,
      nodeId: data.nodeId,
      direction: "down",
    });

    data.onLog?.(
      `[${data.currentUser}] TOGGLE_NODE_VOTE down ${data.nodeId} :: ${getResultMessage(result)}`
    );
  };

  const statusColor = getStatusColor(data.status);
  const controlsHidden = data.voteControlsMode === "hidden";
  const upDisabled = !data.canVoteUp;
  const downDisabled = !data.canVoteDown;

  return (
    <div
      style={{
        position: "relative",
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 10,
        minWidth: 220,
        fontSize: 12,
        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ width: 10, height: 10 }} />
      <Handle type="source" position={Position.Bottom} style={{ width: 10, height: 10 }} />

      <div style={{ fontWeight: 600 }}>{data.label}</div>

      {data.creator && <div style={{ fontSize: 11, color: "#666" }}>creator: {data.creator}</div>}

      {data.status && (
        <div
          style={{
            marginTop: 4,
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: 4,
            fontSize: 10,
            background: statusColor,
            color: "white",
          }}
        >
          {data.status}
        </div>
      )}

      {data.stance && <div style={{ marginTop: 4, fontSize: 11, color: "#4b5563" }}>stance: {data.stance}</div>}
      {data.myVote && <div style={{ marginTop: 4, fontSize: 11, color: "#4b5563" }}>my vote: {data.myVote}</div>}

      {data.votes && (
        <div style={{ marginTop: 6 }}>
          <div>↑ {data.votes.up.join(", ") || "-"}</div>
          <div>↓ {data.votes.down.join(", ") || "-"}</div>
        </div>
      )}

      {!controlsHidden ? (
        <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <button
            style={{
              flex: 1,
              padding: "2px 4px",
              ...getVoteButtonStyle("up", data.myVote, upDisabled),
            }}
            onClick={handleUp}
            disabled={upDisabled}
          >
            ↑
          </button>

          <button
            style={{
              flex: 1,
              padding: "2px 4px",
              ...getVoteButtonStyle("down", data.myVote, downDisabled),
            }}
            onClick={handleDown}
            disabled={downDisabled}
          >
            ↓
          </button>
        </div>
      ) : null}

      {data.voteReason && (
        <div style={{ marginTop: 6, fontSize: 11, color: "#6b7280" }}>{data.voteReason}</div>
      )}
    </div>
  );
}

export const GraphNode = memo(GraphNodeComponent);
