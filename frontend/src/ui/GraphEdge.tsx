import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import type * as Y from "yjs";

import { runGraphAction } from "../collab/graph-action-runner";
import { VOTE_DOWN, VOTE_UP } from "../domain/constants";
import type { UserId } from "../domain/types";

export type GraphEdgeData = {
  linkId: string;
  creator?: string;
  status?: string;
  supportType?: string;
  myVote?: string;
  voteReason?: string;
  voteControlsMode?: "hidden" | "disabled" | "enabled";
  deleteMode?: "hidden" | "disabled" | "enabled";
  deleteReason?: string;
  canVoteUp: boolean;
  canVoteDown: boolean;
  canDelete: boolean;
  ydoc: Y.Doc;
  currentUser: UserId;
  onLog?: (message: string) => void;
};

export type GraphFlowEdge = Edge<GraphEdgeData, "graphEdge">;

function getStatusColor(status?: string) {
  switch (status) {
    case "canonical_true":
      return "#22c55e";
    case "canonical_false":
      return "#ef4444";
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

function getDeleteButtonStyle(disabled?: boolean) {
  if (disabled) {
    return {
      background: "#fef2f2",
      border: "1px solid #fecaca",
      color: "#fca5a5",
      cursor: "not-allowed",
      opacity: 0.7,
      fontWeight: 700,
    };
  }

  return {
    background: "#fff1f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    cursor: "pointer",
    opacity: 1,
    fontWeight: 700,
  };
}

function getResultMessage(result: unknown): string {
  const value = result as {
    decision?: { reason?: string };
  };

  return value.decision?.reason ?? "action executed";
}

function GraphEdgeComponent(props: EdgeProps<GraphFlowEdge>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    data,
    selected,
  } = props;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleUp = () => {
    if (!data?.canVoteUp) return;

    const result = runGraphAction(data.ydoc, {
      type: "TOGGLE_LINK_VOTE",
      userId: data.currentUser,
      linkId: data.linkId,
      direction: "up",
    });

    data.onLog?.(
      `[${data.currentUser}] TOGGLE_LINK_VOTE up ${data.linkId} :: ${getResultMessage(result)}`
    );
  };

  const handleDown = () => {
    if (!data?.canVoteDown) return;

    const result = runGraphAction(data.ydoc, {
      type: "TOGGLE_LINK_VOTE",
      userId: data.currentUser,
      linkId: data.linkId,
      direction: "down",
    });

    data.onLog?.(
      `[${data.currentUser}] TOGGLE_LINK_VOTE down ${data.linkId} :: ${getResultMessage(result)}`
    );
  };

  const handleDelete = () => {
    if (!data?.canDelete) return;

    const result = runGraphAction(data.ydoc, {
      type: "DELETE_LINK",
      userId: data.currentUser,
      linkId: data.linkId,
    });

    data.onLog?.(
      `[${data.currentUser}] DELETE_LINK ${data.linkId} :: ${getResultMessage(result)}`
    );
  };

  const statusColor = getStatusColor(data?.status);
  const controlsHidden = data?.voteControlsMode === "hidden";
  const deleteHidden = data?.deleteMode === "hidden";
  const upDisabled = !data?.canVoteUp;
  const downDisabled = !data?.canVoteDown;
  const deleteDisabled = !data?.canDelete;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: selected ? "#111827" : "#6b7280",
          strokeWidth: selected ? 2.5 : 1.5,
        }}
      />

      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: "all",
            background: "#fff",
            border: "1px solid #d1d5db",
            borderRadius: 8,
            padding: 8,
            minWidth: 190,
            fontSize: 11,
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 600 }}>{props.label || "relation"}</div>

          {data?.creator && <div style={{ color: "#6b7280", marginTop: 2 }}>creator: {data.creator}</div>}

          {data?.status && (
            <div
              style={{
                marginTop: 4,
                display: "inline-block",
                padding: "2px 6px",
                borderRadius: 4,
                fontSize: 10,
                background: statusColor,
                color: "#fff",
              }}
            >
              {data.status}
            </div>
          )}

          {data?.supportType && <div style={{ marginTop: 4, color: "#4b5563" }}>support: {data.supportType}</div>}
          {data?.myVote && <div style={{ marginTop: 4, color: "#4b5563" }}>my vote: {data.myVote}</div>}

          {!controlsHidden ? (
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <button
                onClick={handleUp}
                disabled={upDisabled}
                style={{ flex: 1, ...getVoteButtonStyle("up", data?.myVote, upDisabled) }}
              >
                ↑
              </button>

              <button
                onClick={handleDown}
                disabled={downDisabled}
                style={{ flex: 1, ...getVoteButtonStyle("down", data?.myVote, downDisabled) }}
              >
                ↓
              </button>

              {!deleteHidden ? (
                <button
                  onClick={handleDelete}
                  disabled={deleteDisabled}
                  style={{ flex: 1, ...getDeleteButtonStyle(deleteDisabled) }}
                >
                  del
                </button>
              ) : null}
            </div>
          ) : !deleteHidden ? (
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              <button
                onClick={handleDelete}
                disabled={deleteDisabled}
                style={{ flex: 1, ...getDeleteButtonStyle(deleteDisabled) }}
              >
                del
              </button>
            </div>
          ) : null}

          {data?.voteReason && <div style={{ marginTop: 6, color: "#6b7280" }}>{data.voteReason}</div>}
          {data?.deleteReason && !deleteHidden ? (
            <div style={{ marginTop: 4, color: "#6b7280" }}>{data.deleteReason}</div>
          ) : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export const GraphEdge = memo(GraphEdgeComponent);
