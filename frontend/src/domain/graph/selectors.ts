import {
  GOVERNANCE_AUTHORITATIVE,
  OWNER_ID,
  VOTE_DOWN,
  VOTE_NONE,
  VOTE_UP,
} from "../constants";
import type {
  CanonicalStatus,
  GraphLinkEntity,
  GraphNodeEntity,
  UserId,
  Vote,
} from "../types";

export function getVoteForUser(
  entity: Pick<GraphNodeEntity | GraphLinkEntity, "votesByUser">,
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
): GraphNodeEntity | undefined {
  return nodes.find((node) => node.id === nodeId);
}

export function getLinkById(
  links: GraphLinkEntity[],
  linkId: string
): GraphLinkEntity | undefined {
  return links.find((link) => link.id === linkId);
}

export function isEntityAuthoritativeByOrigin(
  entity: GraphNodeEntity | GraphLinkEntity
): boolean {
  return entity.governanceMode === GOVERNANCE_AUTHORITATIVE;
}

export function getOwnerCanonicalVote(
  entity: GraphNodeEntity | GraphLinkEntity
): Vote | null {
  return entity.votesByUser[OWNER_ID] ?? null;
}

export function getEntityCanonicalStatus(
  entity: GraphNodeEntity | GraphLinkEntity
): CanonicalStatus {
  if (isEntityAuthoritativeByOrigin(entity)) {
    return "canonical_true";
  }

  const ownerVote = getOwnerCanonicalVote(entity);

  if (ownerVote === VOTE_UP) return "canonical_true";
  if (ownerVote === VOTE_DOWN) return "canonical_false";

  return "none";
}

export function getNodeCanonicalStatus(node: GraphNodeEntity): CanonicalStatus {
  return getEntityCanonicalStatus(node);
}

export function getLinkCanonicalStatus(link: GraphLinkEntity): CanonicalStatus {
  return getEntityCanonicalStatus(link);
}

export function resolveNodeStance(
  node: GraphNodeEntity,
  userId: UserId
): "canonical_true" | "canonical_false" | "local_true" | "local_false" | "undecided" {
  const canonicalStatus = getNodeCanonicalStatus(node);
  if (canonicalStatus === "canonical_true") return "canonical_true";
  if (canonicalStatus === "canonical_false") return "canonical_false";

  if (node.creatorId === userId) {
    return "local_true";
  }

  const vote = getNodeVote(node, userId);

  if (vote === VOTE_UP) return "local_true";
  if (vote === VOTE_DOWN) return "local_false";

  return "undecided";
}

export function userSupportsNode(
  node: GraphNodeEntity,
  userId: UserId
): boolean {
  const stance = resolveNodeStance(node, userId);
  return stance === "local_true" || stance === "canonical_true";
}

export function canAddLink(
  sourceNode: GraphNodeEntity,
  targetNode: GraphNodeEntity,
  userId: UserId
): boolean {
  return userSupportsNode(sourceNode, userId) && userSupportsNode(targetNode, userId);
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
  return link.creatorId === userId && userId !== OWNER_ID && linkHasForeignReviews(link);
}
