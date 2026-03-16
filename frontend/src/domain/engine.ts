import {
  DEFAULT_REVIEW_LABEL_PREFIX,
  GOVERNANCE_AUTHORITATIVE,
  GOVERNANCE_COMMUNITY,
  OWNER_ID,
  VOTE_DOWN,
  VOTE_NONE,
} from "./constants";
import { canCreateLink, canVoteLink, canVoteNode } from "./graph/guards";
import { revalidateGraph } from "./graph/revalidateGraph";
import {
  
  getLinkById,
  getNodeById,
  isGuestLinkCreatorReviewLockedByForeignReviews,
  resolveNodeStance,
} from "./graph/selectors";
import { transitionVote } from "./graph/voteStateMachine";
import type {
  DomainDecision,
  DomainEvent,
  GraphAction,
  
  GraphNodeEntity,
  GraphState,
  SupportType,
  UserId,
} from "./types";

function cloneState(state: GraphState): GraphState {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({
      ...node,
      votesByUser: { ...node.votesByUser },
    })),
    links: state.links.map((link) => ({
      ...link,
      votesByUser: { ...link.votesByUser },
      voteLocksByUser: { ...link.voteLocksByUser },
    })),
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function resolveGovernanceMode(creatorId: UserId) {
  return creatorId === OWNER_ID ? GOVERNANCE_AUTHORITATIVE : GOVERNANCE_COMMUNITY;
}

function resolveLinkSupportType(
  sourceNode: GraphNodeEntity,
  targetNode: GraphNodeEntity,
  userId: UserId
): SupportType {
  const sourceStance = resolveNodeStance(sourceNode, userId);
  const targetStance = resolveNodeStance(targetNode, userId);

  return sourceStance === "canonical_true" && targetStance === "canonical_true"
    ? "canonical"
    : "local";
}

function createBaseEvent(
  graphId: string,
  revision: number,
  actorId: UserId
): Pick<DomainEvent, "eventId" | "graphId" | "revision" | "actorId" | "occurredAt"> {
  return {
    eventId: crypto.randomUUID(),
    graphId,
    revision,
    actorId,
    occurredAt: nowIso(),
  };
}

function withRevisionIncrement(state: GraphState): GraphState {
  return {
    ...state,
    revision: state.revision + 1,
  };
}

export function applyGraphAction(
  state: GraphState,
  action: GraphAction,
  currentReviewStartRevision = 0
): DomainDecision {
  const workingState = cloneState(state);
  const warnings: string[] = [];

  if (action.type === "ADD_NODE") {
    const timestamp = nowIso();
    const nextState = withRevisionIncrement({
      ...workingState,
      nodes: [
        {
          id: crypto.randomUUID(),
          label: action.label?.trim() || `Concept ${workingState.nodes.length + 1}`,
          creatorId: action.userId,
          governanceMode: resolveGovernanceMode(action.userId),
          votesByUser: {},
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...workingState.nodes,
      ],
    });

    const created = nextState.nodes[0];

    return {
      allowed: true,
      reason: "Node created.",
      nextState,
      warnings,
      events: [
        {
          ...createBaseEvent(nextState.graphId, nextState.revision, action.userId),
          type: "NODE_CREATED",
          nodeId: created.id,
          label: created.label,
        },
      ],
    };
  }

  if (action.type === "ADD_LINK") {
    const sourceNode = getNodeById(workingState.nodes, action.sourceId);
    const targetNode = getNodeById(workingState.nodes, action.targetId);

    if (!sourceNode || !targetNode) {
      return {
        allowed: false,
        reason: "Cannot add link because one endpoint does not exist.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    if (sourceNode.id === targetNode.id) {
      return {
        allowed: false,
        reason: "Cannot add self-loop link.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    if (
      workingState.links.some(
        (link) => link.sourceId === sourceNode.id && link.targetId === targetNode.id
      )
    ) {
      return {
        allowed: false,
        reason: "Directional link already exists.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    const guard = canCreateLink(sourceNode, targetNode, action.userId);
    if (!guard.allowed) {
      return {
        allowed: false,
        reason: guard.reason,
        nextState: state,
        warnings,
        events: [],
      };
    }

    const timestamp = nowIso();
    const supportType = resolveLinkSupportType(sourceNode, targetNode, action.userId);
    const nextState = withRevisionIncrement({
      ...workingState,
      links: [
        {
          id: crypto.randomUUID(),
          sourceId: sourceNode.id,
          targetId: targetNode.id,
          label: action.label?.trim() || "relation",
          creatorId: action.userId,
          governanceMode: resolveGovernanceMode(action.userId),
          supportType,
          votesByUser: {},
          voteLocksByUser: {},
          globalVoteLocked: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        ...workingState.links,
      ],
    });

    const created = nextState.links[0];

    return {
      allowed: true,
      reason: "Link created.",
      nextState,
      warnings,
      events: [
        {
          ...createBaseEvent(nextState.graphId, nextState.revision, action.userId),
          type: "LINK_CREATED",
          linkId: created.id,
          sourceId: created.sourceId,
          targetId: created.targetId,
          label: created.label,
          supportType: created.supportType,
        },
      ],
    };
  }

  if (action.type === "DELETE_LINK") {
    const link = getLinkById(workingState.links, action.linkId);
    if (!link) {
      return {
        allowed: false,
        reason: "Link not found.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    if (link.creatorId !== action.userId) {
      return {
        allowed: false,
        reason: "Only the creator can delete the link.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    if (isGuestLinkCreatorReviewLockedByForeignReviews(link, action.userId)) {
      return {
        allowed: false,
        reason: "Link is review-locked because it already has foreign reviews.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    const nextState = withRevisionIncrement({
      ...workingState,
      links: workingState.links.filter((item) => item.id !== link.id),
    });

    return {
      allowed: true,
      reason: "Link deleted.",
      nextState,
      warnings,
      events: [
        {
          ...createBaseEvent(nextState.graphId, nextState.revision, action.userId),
          type: "LINK_DELETED",
          linkId: link.id,
          reason: "Deleted by creator.",
        },
      ],
    };
  }

  if (action.type === "TOGGLE_NODE_VOTE") {
    const node = getNodeById(workingState.nodes, action.nodeId);
    if (!node) {
      return {
        allowed: false,
        reason: "Node not found.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    const guard = canVoteNode(node, action.userId);
    if (!guard.allowed) {
      return {
        allowed: false,
        reason: guard.reason,
        nextState: state,
        warnings,
        events: [],
      };
    }

    const previousVote = node.votesByUser[action.userId] ?? VOTE_NONE;
    const nextVote = transitionVote(previousVote, action.direction);
    const timestamp = nowIso();

    let events: DomainEvent[] = [];
    let links = workingState.links.map((link) => ({ ...link }));

    const updatedNodes = workingState.nodes.map((item) =>
      item.id !== node.id
        ? item
        : {
            ...item,
            votesByUser:
              nextVote === VOTE_NONE
                ? Object.fromEntries(
                    Object.entries(item.votesByUser).filter(([userId]) => userId !== action.userId)
                  )
                : { ...item.votesByUser, [action.userId]: nextVote },
            updatedAt: timestamp,
          }
    );

    if (nextVote === VOTE_DOWN && previousVote !== VOTE_DOWN) {
      links = links.map((link) => {
        if (link.sourceId !== node.id) return link;

        const nextVotes = { ...link.votesByUser, [action.userId]: VOTE_DOWN };

        if (action.userId === OWNER_ID) {
          events.push({
            ...createBaseEvent(state.graphId, state.revision + 1, action.userId),
            type: "LINK_VOTE_LOCKED",
            linkId: link.id,
            scope: "global",
            reason: "Owner downvote on source node propagated to link.",
          });

          return {
            ...link,
            votesByUser: nextVotes,
            globalVoteLocked: true,
            updatedAt: timestamp,
          };
        }

        events.push({
          ...createBaseEvent(state.graphId, state.revision + 1, action.userId),
          type: "LINK_VOTE_LOCKED",
          linkId: link.id,
          scope: "user",
          targetUserId: action.userId,
          reason: "Guest downvote on source node propagated to link.",
        });

        return {
          ...link,
          votesByUser: nextVotes,
          voteLocksByUser: { ...link.voteLocksByUser, [action.userId]: true },
          updatedAt: timestamp,
        };
      });
    }

    const nextStatePreValidation = withRevisionIncrement({
      ...workingState,
      nodes: updatedNodes,
      links,
    });

    const revalidation = revalidateGraph(nextStatePreValidation);

    for (const deletion of revalidation.deletions) {
      events.push({
        ...createBaseEvent(
          nextStatePreValidation.graphId,
          nextStatePreValidation.revision,
          action.userId
        ),
        type: "LINK_DELETED",
        linkId: deletion.linkId,
        reason: deletion.reason,
      });
      warnings.push(`Cascade deleted link ${deletion.linkId}: ${deletion.reason}`);
    }

    events = [
      {
        ...createBaseEvent(revalidation.nextState.graphId, revalidation.nextState.revision, action.userId),
        type: "NODE_VOTE_CHANGED",
        nodeId: node.id,
        previousVote,
        nextVote,
      },
      ...events,
    ];

    return {
      allowed: true,
      reason: "Node vote updated.",
      nextState: revalidation.nextState,
      warnings,
      events,
    };
  }

  if (action.type === "TOGGLE_LINK_VOTE") {
    const link = getLinkById(workingState.links, action.linkId);
    if (!link) {
      return {
        allowed: false,
        reason: "Link not found.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    const guard = canVoteLink(link, action.userId);
    if (!guard.allowed) {
      return {
        allowed: false,
        reason: guard.reason,
        nextState: state,
        warnings,
        events: [],
      };
    }

    const previousVote = link.votesByUser[action.userId] ?? VOTE_NONE;
    const nextVote = transitionVote(previousVote, action.direction);
    const timestamp = nowIso();

    const updatedLinks = workingState.links.map((item) =>
      item.id !== link.id
        ? item
        : {
            ...item,
            votesByUser:
              nextVote === VOTE_NONE
                ? Object.fromEntries(
                    Object.entries(item.votesByUser).filter(([userId]) => userId !== action.userId)
                  )
                : { ...item.votesByUser, [action.userId]: nextVote },
            updatedAt: timestamp,
          }
    );

    const nextState = withRevisionIncrement({
      ...workingState,
      links: updatedLinks,
    });

    return {
      allowed: true,
      reason: "Link vote updated.",
      nextState,
      warnings,
      events: [
        {
          ...createBaseEvent(nextState.graphId, nextState.revision, action.userId),
          type: "LINK_VOTE_CHANGED",
          linkId: link.id,
          previousVote,
          nextVote,
        },
      ],
    };
  }

  if (action.type === "CLOSE_REVIEW_SESSION") {
    if (action.userId !== OWNER_ID) {
      return {
        allowed: false,
        reason: "Only the owner can close a review session.",
        nextState: state,
        warnings,
        events: [],
      };
    }

    const nextState = withRevisionIncrement(workingState);
    const sessionId = crypto.randomUUID();
    
    

    return {
      allowed: true,
      reason: "Review session closed.",
      nextState,
      warnings,
      events: [
        {
          ...createBaseEvent(nextState.graphId, nextState.revision, action.userId),
          type: "REVIEW_SESSION_CLOSED",
          sessionId,
          sessionLabel: action.sessionLabel || `${DEFAULT_REVIEW_LABEL_PREFIX} ${nextState.revision}`,
          startRevisionExclusive: currentReviewStartRevision,
          endRevisionInclusive: nextState.revision,
        },
      ],
    };
  }

  return {
    allowed: false,
    reason: "Unknown action type.",
    nextState: state,
    warnings,
    events: [],
  };
}
