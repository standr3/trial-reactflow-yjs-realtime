import type { GraphUser, UserId, Vote } from "./types";

export const OWNER_ID: UserId = "O";

export const VOTE_NONE: Vote = "none";
export const VOTE_UP: Vote = "up";
export const VOTE_DOWN: Vote = "down";

export const GOVERNANCE_AUTHORITATIVE = "authoritative" as const;
export const GOVERNANCE_COMMUNITY = "community" as const;

export const DEFAULT_USERS: GraphUser[] = [
  { id: "O", name: "Owner" },
  { id: "G_1", name: "Guest 1" },
  { id: "G_2", name: "Guest 2" },
  { id: "G_3", name: "Guest 3" },
];

export const DEFAULT_GRAPH_ID = "graph-truth-sandbox";
export const DEFAULT_POLICY_VERSION = "policy-v1";
export const DEFAULT_REVIEW_LABEL_PREFIX = "Performance review";

export const MAX_TRUST_FACTOR = 100;
export const MIN_TRUST_FACTOR = 0;
export const DEFAULT_TRUST_FACTOR = 50;

export const EARLY_SIGNAL_EVENT_THRESHOLD = 2;
