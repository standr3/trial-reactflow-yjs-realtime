import { OWNER_ID, VOTE_DOWN, VOTE_NONE, VOTE_UP } from "../constants";
import type {
  CanonicalStatus,
  DomainEvent,
  EntityType,
  GraphLinkEntity,
  GraphNodeEntity,
  OpportunityKind,
  ReviewSession,
  ScoreLedgerEntry,
  UserId,
} from "../types";
import {
  getLinkCanonicalStatus,
  getNodeCanonicalStatus,
  getVoteForUser,
} from "../graph/selectors";

export type Opportunity = {
  userId: UserId;
  entityId: string;
  entityType: EntityType;
  kind: OpportunityKind;
  canonicalStatus: CanonicalStatus;
  relatedEventIds: string[];
};

export type OpportunityInput = {
  session: ReviewSession;
  users: UserId[];
  nodes: GraphNodeEntity[];
  links: GraphLinkEntity[];
  events: DomainEvent[];
};

export function buildSessionOpportunities(input: OpportunityInput): Opportunity[] {
  const { users, nodes, links, events } = input;
  const opportunities: Opportunity[] = [];

  for (const node of nodes) {
    const status = getNodeCanonicalStatus(node);
    if (status === "none") continue;

    const relatedEventIds = events
      .filter((event) => {
        if (event.type === "NODE_CREATED" || event.type === "NODE_VOTE_CHANGED") {
          return event.nodeId === node.id;
        }
        return false;
      })
      .map((event) => event.eventId);

    for (const userId of users) {
      if (userId === OWNER_ID) continue;

      if (node.creatorId === userId) {
        opportunities.push({
          userId,
          entityId: node.id,
          entityType: "node",
          kind: "initiate_node",
          canonicalStatus: status,
          relatedEventIds,
        });
        continue;
      }

      const vote = getVoteForUser(node, userId);
      opportunities.push({
        userId,
        entityId: node.id,
        entityType: "node",
        kind:
          vote === VOTE_UP
            ? "support_node"
            : vote === VOTE_DOWN
              ? "reject_node"
              : "abstain_node",
        canonicalStatus: status,
        relatedEventIds,
      });
    }
  }

  for (const link of links) {
    const status = getLinkCanonicalStatus(link);
    if (status === "none") continue;

    const relatedEventIds = events
      .filter((event) => {
        if (event.type === "LINK_CREATED" || event.type === "LINK_VOTE_CHANGED") {
          return event.linkId === link.id;
        }
        return false;
      })
      .map((event) => event.eventId);

    for (const userId of users) {
      if (userId === OWNER_ID) continue;

      if (link.creatorId === userId) {
        opportunities.push({
          userId,
          entityId: link.id,
          entityType: "link",
          kind: "initiate_link",
          canonicalStatus: status,
          relatedEventIds,
        });
        continue;
      }

      const vote = getVoteForUser(link, userId);
      opportunities.push({
        userId,
        entityId: link.id,
        entityType: "link",
        kind:
          vote === VOTE_UP
            ? "support_link"
            : vote === VOTE_DOWN
              ? "reject_link"
              : "abstain_link",
        canonicalStatus: status,
        relatedEventIds,
      });
    }
  }

  return opportunities;
}

export function buildUserOpportunitySummary(
  userId: UserId,
  entries: ScoreLedgerEntry[],
  opportunities: Opportunity[]
) {
  const userEntries = entries.filter((entry) => entry.userId === userId);
  const userOpportunities = opportunities.filter((opportunity) => opportunity.userId === userId);

  const initiativeCount = userOpportunities.filter((item) => item.kind.startsWith("initiate")).length;
  const decisiveCount = userOpportunities.filter(
    (item) => !item.kind.startsWith("abstain")
  ).length;

  const rewardPoints = userEntries
    .filter((item) => item.pointsDelta > 0)
    .reduce((sum, item) => sum + item.pointsDelta, 0);

  const penaltyPoints = Math.abs(
    userEntries
      .filter((item) => item.pointsDelta < 0)
      .reduce((sum, item) => sum + item.pointsDelta, 0)
  );

  return {
    initiativeCount,
    opportunityCount: userOpportunities.length,
    decisiveCount,
    rewardPoints,
    penaltyPoints,
  };
}
