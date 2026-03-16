import type { ActionPlan } from "./actionPlan";
import { createActionPlan, denyPlan } from "./actionPlan";
import { VOTE_DOWN, VOTE_UP } from "./constants";
import { canCreateLink, canVoteLink, canVoteNode } from "./guards";
import {
  getLinkVote,
  getNodeById,
  getNodeVote,
  resolveNodeStance,
} from "./selectors";
import { stanceToLevel } from "./stanceLevel";
import { transitionVote } from "./voteStateMachine";

import type {
  GraphLinkEntity,
  GraphNodeEntity,
  UserId,
  Vote,
} from "./types";

/**
 * Normalizează Vote ("up" | "down" | "none") -> "up" | "down" | null
 */
function toPlannedVote(vote: Vote | null): "up" | "down" | null {
  if (vote === VOTE_UP) return "up";
  if (vote === VOTE_DOWN) return "down";
  return null;
}

/**
 * PLAN NODE VOTE
 */
export function planNodeVote(
  node: GraphNodeEntity,
  userId: UserId,
  clickedVote: "up" | "down"
): ActionPlan {
  const guard = canVoteNode(node, userId);

  if (!guard.allowed) {
    return denyPlan(guard.reason);
  }

  const currentVote = getNodeVote(node, userId);
  const nextVote = transitionVote(currentVote, clickedVote);

  const plan = createActionPlan();

  plan.nodeChanges.push({
    nodeId: node.id,
    userId,
    vote: toPlannedVote(nextVote),
  });

  return plan;
}

/**
 * PLAN LINK VOTE
 */
export function planLinkVote(
  link: GraphLinkEntity,
  userId: UserId,
  clickedVote: "up" | "down"
): ActionPlan {
  const guard = canVoteLink(link, userId);

  if (!guard.allowed) {
    return denyPlan(guard.reason);
  }

  const currentVote = getLinkVote(link, userId);
  const nextVote = transitionVote(currentVote, clickedVote);

  const plan = createActionPlan();

  plan.linkChanges.push({
    linkId: link.id,
    userId,
    vote: toPlannedVote(nextVote),
  });

  return plan;
}

/**
 * PLAN LINK CREATION
 */
export function planLinkCreation(
  sourceNode: GraphNodeEntity,
  targetNode: GraphNodeEntity,
  userId: UserId
): ActionPlan {
  const guard = canCreateLink(sourceNode, targetNode, userId);

  if (!guard.allowed) {
    return denyPlan(guard.reason);
  }

  return createActionPlan();
}

/**
 * PLAN ENDPOINT TRANSITION
 */
function planEndpointTransition(
  node: GraphNodeEntity,
  userId: UserId,
  desiredDirection: "up" | "down"
): { allowed: boolean; action: string; nextVote: "up" | "down" | null } {
  const stance = resolveNodeStance(node, userId);
  const level = stanceToLevel(stance);

  if (desiredDirection === "up") {
    if (level === -2) {
      return { allowed: false, action: "blocked", nextVote: null };
    }

    if (level >= 1) {
      return { allowed: true, action: "noop", nextVote: null };
    }

    if (level === 0) {
      return { allowed: true, action: "set_up_local", nextVote: "up" };
    }

    if (level === -1) {
      return { allowed: true, action: "flip_to_up_local", nextVote: "up" };
    }
  }

  if (desiredDirection === "down") {
    if (level === 2) {
      return { allowed: false, action: "blocked", nextVote: null };
    }

    if (level <= -1) {
      return { allowed: true, action: "noop", nextVote: null };
    }

    if (level === 0) {
      return { allowed: true, action: "set_down_local", nextVote: "down" };
    }

    if (level === 1) {
      return { allowed: true, action: "flip_to_down_local", nextVote: "down" };
    }
  }

  return { allowed: false, action: "blocked", nextVote: null };
}

/**
 * PLAN LINK VOTE CASCADE
 */
export function planLinkVoteCascade(
  link: GraphLinkEntity,
  userId: UserId,
  direction: "up" | "down",
  nodes: GraphNodeEntity[]
): ActionPlan {
  const plan = createActionPlan();

  const sourceNode = getNodeById(nodes, link.sourceId);
  const targetNode = getNodeById(nodes, link.targetId);

  if (!sourceNode || !targetNode) {
    return denyPlan("missing endpoint");
  }

  const sourcePlan = planEndpointTransition(sourceNode, userId, direction);
  const targetPlan = planEndpointTransition(targetNode, userId, direction);

  if (!sourcePlan.allowed || !targetPlan.allowed) {
    return denyPlan("cascade impossible");
  }

  if (sourcePlan.nextVote) {
    plan.nodeChanges.push({
      nodeId: sourceNode.id,
      userId,
      vote: sourcePlan.nextVote,
    });
  }

  if (targetPlan.nextVote) {
    plan.nodeChanges.push({
      nodeId: targetNode.id,
      userId,
      vote: targetPlan.nextVote,
    });
  }

  plan.linkChanges.push({
    linkId: link.id,
    userId,
    vote: direction === "up" ? "up" : "down",
  });

  return plan;
}