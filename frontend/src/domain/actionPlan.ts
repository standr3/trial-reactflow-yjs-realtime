export type ActionPlan = {
  allowed: boolean;
  reason: string;
  nodeChanges: Array<{
    nodeId: string;
    userId: string;
    vote: "up" | "down" | null;
  }>;
  linkChanges: Array<{
    linkId: string;
    userId: string;
    vote: "up" | "down" | null;
  }>;
  deletions: Array<{
    linkId: string;
  }>;
  locks: Array<{
    linkId: string;
    userId?: string;
    global?: boolean;
  }>;
};

export function createActionPlan(): ActionPlan {
  return {
    allowed: true,
    reason: "",
    nodeChanges: [],
    linkChanges: [],
    deletions: [],
    locks: [],
  };
}

export function denyPlan(reason: string): ActionPlan {
  return {
    allowed: false,
    reason,
    nodeChanges: [],
    linkChanges: [],
    deletions: [],
    locks: [],
  };
}
