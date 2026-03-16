import type { PerformanceReadModel } from "../domain/types";

export type PerformanceStatsPanelProps = {
  performance: PerformanceReadModel;
  expandedUserId?: string | null;
  onToggleExpand?: (userId: string) => void;
};
