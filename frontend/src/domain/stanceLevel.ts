import type { NodeStance } from "./types";

export const LEVEL_CANONICAL_FALSE = -2;
export const LEVEL_LOCAL_FALSE = -1;
export const LEVEL_UNDECIDED = 0;
export const LEVEL_LOCAL_TRUE = 1;
export const LEVEL_CANONICAL_TRUE = 2;

export function stanceToLevel(stance: NodeStance): number {
  switch (stance) {
    case "canonical_false":
      return LEVEL_CANONICAL_FALSE;

    case "local_false":
      return LEVEL_LOCAL_FALSE;

    case "undecided":
      return LEVEL_UNDECIDED;

    case "local_true":
      return LEVEL_LOCAL_TRUE;

    case "canonical_true":
      return LEVEL_CANONICAL_TRUE;

    default:
      throw new Error(`Unknown stance: ${stance}`);
  }
}