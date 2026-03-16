import type * as Y from "yjs";

import {
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "../domain/constants";
import { planLinkVoteCascade } from "../domain/planners";
import {
  getLinkCanonicalStatus,
  getLinkDeleteMode,
  getLinkDeleteReason,
  getLinkVote,
  getLinkVoteControlsMode,
  getNodeCanonicalStatus,
  getNodeVote,
  getVoteControlsMode,
  isLinkAuthoritativeByOrigin,
  isNodeAuthoritativeByOrigin,
  resolveNodeStance,
} from "../domain/selectors";

import type {
  GraphLinkEntity,
  GraphNodeEntity,
  GraphNodeLayout,
  UserId,
} from "../domain/types";

import type { GraphFlowNode } from "../ui/GraphNode";
import type { GraphFlowEdge } from "../ui/GraphEdge";

function getNodeVoteReason(
  node: GraphNodeEntity,
  currentUser: UserId,
  links: GraphLinkEntity[]
): string {
  const voteControlsMode = getVoteControlsMode(node, currentUser, links);

  if (isNodeAuthoritativeByOrigin(node)) {
    return "authoritative node by origin: voting unavailable";
  }

  if (node.creatorId === currentUser) {
    return "own node: you cannot vote on it";
  }

  const canonicalStatus = getNodeCanonicalStatus(node);

  if (voteControlsMode === "disabled") {
    if (canonicalStatus === "canonical_true") {
      return currentUser === "O"
        ? "you marked this node as canonical truth"
        : "canonical truth decided by owner • voting locked";
    }

    if (canonicalStatus === "canonical_false") {
      return currentUser === "O"
        ? "you marked this node as canonical falsehood"
        : "canonical falsehood decided by owner • voting locked";
    }

    return "review locked: one of your guest-created links on this node has external reviews";
  }

  return "vote allowed";
}

function getLinkVoteReason(
  link: GraphLinkEntity,
  currentUser: UserId
): string {
  const voteControlsMode = getLinkVoteControlsMode(link, currentUser);

  if (isLinkAuthoritativeByOrigin(link)) {
    return "authoritative link by origin: voting unavailable";
  }

  if (link.creatorId === currentUser) {
    return "own link: you cannot vote on it";
  }

  if (voteControlsMode === "disabled") {
    if (link.globalVoteLocked) {
      return "this link is globally vote-locked";
    }

    if (link.voteLocksByUser[currentUser]) {
      return "your voting on this link is locked";
    }

    const canonicalStatus = getLinkCanonicalStatus(link);

    if (canonicalStatus === "canonical_true") {
      return currentUser === "O"
        ? "you marked this link as canonical truth"
        : "canonical truth decided by owner • voting locked";
    }

    if (canonicalStatus === "canonical_false") {
      return currentUser === "O"
        ? "you marked this link as canonical falsehood"
        : "canonical falsehood decided by owner • voting locked";
    }
  }

  return "vote allowed";
}

export function mapGraphNodesToReactFlowNodes(
  graphNodes: GraphNodeEntity[],
  layouts: Map<string, GraphNodeLayout>,
  ydoc: Y.Doc,
  currentUser: UserId,
  onLog?: (message: string) => void,
  allLinks: GraphLinkEntity[] = []
): GraphFlowNode[] {
  return graphNodes.map((node) => {
    const layout = layouts.get(node.id);

    const upVotes = Object.entries(node.votesByUser)
      .filter(([, v]) => v === VOTE_UP)
      .map(([u]) => u);

    const downVotes = Object.entries(node.votesByUser)
      .filter(([, v]) => v === VOTE_DOWN)
      .map(([u]) => u);

    const voteControlsMode = getVoteControlsMode(node, currentUser, allLinks);
    const currentVote = getNodeVote(node, currentUser);

    return {
      id: node.id,
      type: "graphNode",
      position: layout ? { x: layout.x, y: layout.y } : { x: 120, y: 120 },
      data: {
        nodeId: node.id,
        label: node.label,
        creator: node.creatorId,
        status: getNodeCanonicalStatus(node),
        stance: resolveNodeStance(node, currentUser),
        myVote: currentVote ?? VOTE_NONE,
        voteReason: getNodeVoteReason(node, currentUser, allLinks),
        voteControlsMode,
        canVoteUp: voteControlsMode === "enabled",
        canVoteDown: voteControlsMode === "enabled",
        votes: {
          up: upVotes,
          down: downVotes,
        },
        ydoc,
        currentUser,
        onLog,
      },
      draggable: true,
    };
  });
}

export function mapGraphLinksToReactFlowEdges(
  graphLinks: GraphLinkEntity[],
  ydoc: Y.Doc,
  currentUser: UserId,
  onLog?: (message: string) => void,
  allNodes: GraphNodeEntity[] = []
): GraphFlowEdge[] {
  return graphLinks.map((link) => {
    const voteControlsMode = getLinkVoteControlsMode(link, currentUser);
    const myVote = getLinkVote(link, currentUser);

    const upActionMode =
      voteControlsMode === "enabled"
        ? planLinkVoteCascade(link, currentUser, "up", allNodes).allowed
          ? "enabled"
          : "disabled"
        : voteControlsMode;

    const downActionMode =
      voteControlsMode === "enabled"
        ? planLinkVoteCascade(link, currentUser, "down", allNodes).allowed
          ? "enabled"
          : "disabled"
        : voteControlsMode;

    const deleteMode = getLinkDeleteMode(link, currentUser);

    return {
      id: link.id,
      type: "graphEdge",
      source: link.sourceId,
      target: link.targetId,
      label: link.label || "relation",
      data: {
        linkId: link.id,
        creator: link.creatorId,
        status: getLinkCanonicalStatus(link),
        supportType: link.supportType,
        myVote: myVote ?? VOTE_NONE,
        voteReason: getLinkVoteReason(link, currentUser),
        voteControlsMode,
        canVoteUp: upActionMode === "enabled",
        canVoteDown: downActionMode === "enabled",
        deleteMode,
        canDelete: deleteMode === "enabled",
        deleteReason: getLinkDeleteReason(link, currentUser),
        ydoc,
        currentUser,
        onLog,
      },
      selectable: true,
    };
  });
}