import { canAddLink, getNodeById } from "./selectors";

import type {
  GraphState,
} from "./types";

export function revalidateGraph(state: GraphState): GraphState {
  const deletions: string[] = [];

  for (const link of state.links) {
    const source = getNodeById(state.nodes, link.sourceId);
    const target = getNodeById(state.nodes, link.targetId);

    if (!source || !target) {
      deletions.push(link.id);
      continue;
    }

    const stillValid = canAddLink(source, target, link.creatorId);

    if (!stillValid) {
      deletions.push(link.id);
    }
  }

  if (deletions.length === 0) {
    return state;
  }

  return {
    ...state,
    links: state.links.filter((link) => !deletions.includes(link.id)),
  };
}