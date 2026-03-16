import { useMemo } from "react";
import type { PerformanceReadModel } from "../domain/types";

type PerformanceStatsPanelProps = {
  performance: PerformanceReadModel | null;
  expandedUserId?: string | null;
  onToggleExpand?: (userId: string) => void;
  embedded?: boolean;
};

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getTrendArrow(delta: number): string {
  if (delta > 0) return "↑";
  if (delta < 0) return "↓";
  return "→";
}

export function PerformanceStatsPanel({
  performance,
  expandedUserId,
  onToggleExpand,
  embedded = false,
}: PerformanceStatsPanelProps) {
  const ledgerByUser = useMemo(() => {
    const map = new Map<string, NonNullable<PerformanceReadModel["recentLedgerEntries"]>>();

    if (!performance) {
      return map;
    }

    for (const entry of performance.recentLedgerEntries) {
      const existing = map.get(entry.userId) ?? [];
      existing.push(entry);
      map.set(entry.userId, existing);
    }

    return map;
  }, [performance]);

  const containerStyle = embedded
    ? {
        width: "100%",
        height: "100%",
        overflow: "auto" as const,
        padding: 16,
      }
    : {
        width: 380,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto" as const,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      };

  return (
    <aside style={containerStyle}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Performance stats</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Trust, performance, rewards, penalties, trend și motive explicabile.
        </div>
      </div>

      {!performance || performance.quickStats.length === 0 ? (
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            background: "#f9fafb",
            border: "1px solid #e5e7eb",
            fontSize: 12,
            color: "#6b7280",
          }}
        >
          Nu există încă nicio sesiune de review închisă. Apasă butonul de
          review ca să vezi primele statistici.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {performance.quickStats.map((stat) => {
            const isExpanded = expandedUserId === stat.userId;
            const evaluation = performance.latestEvaluations.find(
              (item) => item.userId === stat.userId
            );
            const trustProfile = performance.trustProfiles.find(
              (item) => item.userId === stat.userId
            );
            const userLedger = ledgerByUser.get(stat.userId) ?? [];

            return (
              <section
                key={stat.userId}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  padding: 12,
                  background: "#fafafa",
                }}
              >
                <button
                  type="button"
                  onClick={() => onToggleExpand?.(stat.userId)}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <strong>{stat.userId}</strong>
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {getTrendArrow(stat.trendVsPreviousSession)}{" "}
                      {formatNumber(stat.trendVsPreviousSession)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Trust</div>
                      <div style={{ fontWeight: 700 }}>
                        {formatNumber(stat.trustFactor)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        Performance
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {formatNumber(stat.performancePercent)}%
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>Reward</div>
                      <div style={{ fontWeight: 700, color: "#166534" }}>
                        +{formatNumber(stat.rewardPoints)}
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>
                        Penalty
                      </div>
                      <div style={{ fontWeight: 700, color: "#991b1b" }}>
                        -{formatNumber(stat.penaltyPoints)}
                      </div>
                    </div>
                  </div>
                </button>

                {isExpanded && evaluation ? (
                  <div
                    style={{
                      marginTop: 12,
                      borderTop: "1px solid #e5e7eb",
                      paddingTop: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
                      Initiative {formatNumber(evaluation.initiativeScore)} ·
                      Accuracy {formatNumber(evaluation.accuracyIndex * 100)}% ·
                      Decisiveness {formatNumber(evaluation.decisivenessIndex * 100)}%
                    </div>

                    <div style={{ fontSize: 12, color: "#374151", marginBottom: 8 }}>
                      Risk index {formatNumber(evaluation.riskIndex * 100)}% ·
                      Influence {formatNumber(evaluation.influenceScore)} ·
                      Sessions {trustProfile?.sessionsCount ?? 0}
                    </div>

                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
                      Lifetime net points:{" "}
                      {formatNumber(trustProfile?.lifetimeNetPoints ?? 0)}
                    </div>

                    <div style={{ display: "grid", gap: 6 }}>
                      {userLedger.length === 0 ? (
                        <div style={{ fontSize: 12, color: "#6b7280" }}>
                          Fără reasons încă.
                        </div>
                      ) : (
                        userLedger.slice(0, 8).map((entry) => (
                          <div
                            key={entry.entryId}
                            style={{
                              fontSize: 12,
                              padding: 8,
                              borderRadius: 12,
                              background: "#ffffff",
                              border: "1px solid #e5e7eb",
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {entry.reasonCode} ·{" "}
                              {entry.pointsDelta > 0 ? "+" : ""}
                              {formatNumber(entry.pointsDelta)}
                            </div>
                            <div style={{ color: "#4b5563", marginTop: 2 }}>
                              {entry.explanation}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}