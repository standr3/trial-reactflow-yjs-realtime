import {
  GOVERNANCE_AUTHORITATIVE,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "./constants";

import type {
  GraphLinkEntity,
  GraphNodeEntity,
  UserId,
  Vote,
} from "./types";

export function getVoteForUser(
  entity: GraphNodeEntity | GraphLinkEntity,
  userId: UserId
): Vote {
  return entity.votesByUser[userId] ?? VOTE_NONE;
}

export function getNodeVote(node: GraphNodeEntity, userId: UserId): Vote {
  return getVoteForUser(node, userId);
}

export function getLinkVote(link: GraphLinkEntity, userId: UserId): Vote {
  return getVoteForUser(link, userId);
}

export function getNodeById(
  nodes: GraphNodeEntity[],
  nodeId: string
): GraphNodeEntity | null {
  return nodes.find((node) => node.id === nodeId) ?? null;
}

export function isEntityAuthoritativeByOrigin(
  entity: GraphNodeEntity | GraphLinkEntity
): boolean {
  return entity.governanceMode === GOVERNANCE_AUTHORITATIVE;
}

export function isNodeAuthoritativeByOrigin(node: GraphNodeEntity): boolean {
  return isEntityAuthoritativeByOrigin(node);
}

export function isLinkAuthoritativeByOrigin(link: GraphLinkEntity): boolean {
  return isEntityAuthoritativeByOrigin(link);
}

export function getOwnerCanonicalVote(
  entity: GraphNodeEntity | GraphLinkEntity
): Vote | null {
  return entity.votesByUser["O"] ?? null;
}

export function isEntityCanonizedByOwner(
  entity: GraphNodeEntity | GraphLinkEntity
): boolean {
  const ownerVote = getOwnerCanonicalVote(entity);
  return ownerVote === VOTE_UP || ownerVote === VOTE_DOWN;
}

export function getEntityCanonicalStatus(
  entity: GraphNodeEntity | GraphLinkEntity
): "canonical_true" | "canonical_false" | "none" {
  if (isEntityAuthoritativeByOrigin(entity)) return "canonical_true";

  const ownerVote = getOwnerCanonicalVote(entity);

  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";

  return "none";
}

export function getNodeCanonicalStatus(
  node: GraphNodeEntity
): "canonical_true" | "canonical_false" | "none" {
  return getEntityCanonicalStatus(node);
}

export function getLinkCanonicalStatus(
  link: GraphLinkEntity
): "canonical_true" | "canonical_false" | "none" {
  return getEntityCanonicalStatus(link);
}

export function resolveNodeStance(
  node: GraphNodeEntity,
  userId: UserId
): "canonical_true" | "canonical_false" | "local_true" | "local_false" | "undecided" {
  if (isEntityAuthoritativeByOrigin(node)) return "canonical_true";

  const ownerVote = getOwnerCanonicalVote(node);

  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";

  if (node.creatorId === userId) return "local_true";

  const userVote = getNodeVote(node, userId);

  if (userVote === VOTE_UP) return "local_true";
  if (userVote === VOTE_DOWN) return "local_false";

  return "undecided";
}

export function userSupportsNode(
  node: GraphNodeEntity,
  userId: UserId
): boolean {
  const stance = resolveNodeStance(node, userId);
  return stance === "canonical_true" || stance === "local_true";
}

export function canAddLink(
  sourceNode: GraphNodeEntity,
  targetNode: GraphNodeEntity,
  userId: UserId
): boolean {
  const sourceStance = resolveNodeStance(sourceNode, userId);
  const targetStance = resolveNodeStance(targetNode, userId);

  const sourceAllowed =
    sourceStance === "canonical_true" || sourceStance === "local_true";

  const targetAllowed =
    targetStance === "canonical_true" || targetStance === "local_true";

  return sourceAllowed && targetAllowed;
}

export function linkHasForeignReviews(link: GraphLinkEntity): boolean {
  return Object.entries(link.votesByUser).some(
    ([reviewerId, vote]) => reviewerId !== link.creatorId && vote !== VOTE_NONE
  );
}

export function isGuestLinkCreatorReviewLockedByForeignReviews(
  link: GraphLinkEntity,
  userId: UserId
): boolean {
  return (
    link.creatorId === userId &&
    link.creatorId !== "O" &&
    linkHasForeignReviews(link)
  );
}

export function isNodeReviewLockedByReviewedUserLink(
  nodeId: string,
  links: GraphLinkEntity[],
  userId: UserId
): boolean {
  return links.some(
    (link) =>
      link.creatorId === userId &&
      link.creatorId !== "O" &&
      linkHasForeignReviews(link) &&
      (link.sourceId === nodeId || link.targetId === nodeId)
  );
}

export function getEntityVoteControlsMode(
  entity: GraphNodeEntity | GraphLinkEntity,
  userId: UserId
): "hidden" | "disabled" | "enabled" {
  if (isEntityAuthoritativeByOrigin(entity)) return "hidden";
  if (entity.creatorId === userId) return "hidden";
  if (userId !== "O" && isEntityCanonizedByOwner(entity)) return "disabled";
  return "enabled";
}

export function getVoteControlsMode(
  node: GraphNodeEntity,
  userId: UserId,
  links: GraphLinkEntity[] = []
): "hidden" | "disabled" | "enabled" {
  const baseMode = getEntityVoteControlsMode(node, userId);

  if (baseMode === "hidden") return "hidden";

  if (isNodeReviewLockedByReviewedUserLink(node.id, links, userId)) {
    return "disabled";
  }

  return baseMode;
}

export function getLinkVoteControlsMode(
  link: GraphLinkEntity,
  userId: UserId
): "hidden" | "disabled" | "enabled" {
  if (isEntityAuthoritativeByOrigin(link)) return "hidden";
  if (link.creatorId === userId) return "hidden";
  if (link.globalVoteLocked) return "disabled";
  if (link.voteLocksByUser[userId]) return "disabled";
  if (userId !== "O" && isEntityCanonizedByOwner(link)) return "disabled";
  return "enabled";
}

export function getLinkDeleteMode(
  link: GraphLinkEntity,
  userId: UserId
): "hidden" | "disabled" | "enabled" {
  if (link.creatorId !== userId) return "hidden";

  if (isGuestLinkCreatorReviewLockedByForeignReviews(link, userId)) {
    return "disabled";
  }

  return "enabled";
}

export function getLinkDeleteReason(
  link: GraphLinkEntity,
  userId: UserId
): string {
  if (link.creatorId !== userId) return "";

  if (isGuestLinkCreatorReviewLockedByForeignReviews(link, userId)) {
    return "delete blocked: this guest link has reviews from other users";
  }

  return "delete allowed";
}