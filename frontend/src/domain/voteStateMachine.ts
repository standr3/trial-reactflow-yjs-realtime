import { VOTE_DOWN, VOTE_NONE, VOTE_UP } from "./constants";
import type { Vote } from "./types";

export function transitionVote(currentVote: Vote, clickedVote: Vote): Vote {
  let nextVote = currentVote;

  if (clickedVote === VOTE_UP) {
    if (currentVote === VOTE_NONE) nextVote = VOTE_UP;
    else if (currentVote === VOTE_UP) nextVote = VOTE_NONE;
    else if (currentVote === VOTE_DOWN) nextVote = VOTE_UP;
  }

  if (clickedVote === VOTE_DOWN) {
    if (currentVote === VOTE_NONE) nextVote = VOTE_DOWN;
    else if (currentVote === VOTE_DOWN) nextVote = VOTE_NONE;
    else if (currentVote === VOTE_UP) nextVote = VOTE_DOWN;
  }

  return nextVote;
}