import {
  canAddLink,
  getLinkCanonicalStatus,
  getNodeCanonicalStatus,
  isEntityAuthoritativeByOrigin,
} from "./selectors";

import type { GraphLinkEntity, GraphNodeEntity, UserId } from "./types";

export type GuardResult = { allowed: true } | { allowed: false; reason: string };

export function canVoteNode(
  node: GraphNodeEntity,
  userId: UserId
): GuardResult {
  if (isEntityAuthoritativeByOrigin(node)) {
    return {
      allowed: false,
      reason: "Authoritative nodes are not voteable.",
    };
  }

  if (node.creatorId === userId) {
    return {
      allowed: false,
      reason: "You cannot vote on your own node.",
    };
  }

  if (userId !== "O" && getNodeCanonicalStatus(node) !== "none") {
    return {
      allowed: false,
      reason: "Guests cannot vote after the owner has canonized the node.",
    };
  }

  return { allowed: true };
}

export function canVoteLink(
  link: GraphLinkEntity,
  userId: UserId
): GuardResult {
  if (isEntityAuthoritativeByOrigin(link)) {
    return {
      allowed: false,
      reason: "Authoritative links are not voteable.",
    };
  }

  if (link.creatorId === userId) {
    return {
      allowed: false,
      reason: "You cannot vote on your own link.",
    };
  }

  if (link.globalVoteLocked) {
    return {
      allowed: false,
      reason: "This link is globally vote-locked.",
    };
  }

  if (link.voteLocksByUser[userId]) {
    return {
      allowed: false,
      reason: "Your voting on this link is locked.",
    };
  }

  if (userId !== "O" && getLinkCanonicalStatus(link) !== "none") {
    return {
      allowed: false,
      reason: "Guests cannot vote after the owner has canonized the link.",
    };
  }

  return { allowed: true };
}

export function canCreateLink(
  sourceNode: GraphNodeEntity,
  targetNode: GraphNodeEntity,
  userId: UserId
): GuardResult {
  if (!canAddLink(sourceNode, targetNode, userId)) {
    return {
      allowed: false,
      reason: "User must support both source and target nodes.",
    };
  }

  return { allowed: true };
}
