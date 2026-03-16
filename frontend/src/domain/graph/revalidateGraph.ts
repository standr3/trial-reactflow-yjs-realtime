import type { GraphState, LinkDeletion } from "../types";
import { canAddLink, getNodeById } from "./selectors";

export type RevalidationResult = {
  nextState: GraphState;
  deletions: LinkDeletion[];
};

export function revalidateGraph(state: GraphState): RevalidationResult {
  const deletions: LinkDeletion[] = [];

  for (const link of state.links) {
    const source = getNodeById(state.nodes, link.sourceId);
    const target = getNodeById(state.nodes, link.targetId);

    if (!source || !target) {
      deletions.push({
        linkId: link.id,
        reason: "Link endpoint missing during revalidation.",
      });
      continue;
    }

    if (!canAddLink(source, target, link.creatorId)) {
      deletions.push({
        linkId: link.id,
        reason: "Creator no longer supports both endpoints.",
      });
    }
  }

  if (deletions.length === 0) {
    return { nextState: state, deletions };
  }

  const deletionSet = new Set(deletions.map((item) => item.linkId));

  return {
    deletions,
    nextState: {
      ...state,
      links: state.links.filter((link) => !deletionSet.has(link.id)),
    },
  };
}
