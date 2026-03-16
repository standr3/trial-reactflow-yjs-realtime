import { VOTE_DOWN, VOTE_NONE, VOTE_UP } from "../constants";
import type { Vote } from "../types";

export function transitionVote(
  currentVote: Vote,
  clickedVote: "up" | "down"
): Vote {
  if (clickedVote === "up") {
    if (currentVote === VOTE_UP) return VOTE_NONE;
    return VOTE_UP;
  }

  if (currentVote === VOTE_DOWN) return VOTE_NONE;
  return VOTE_DOWN;
}
