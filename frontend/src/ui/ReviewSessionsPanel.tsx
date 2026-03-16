import { useMemo } from "react";
import type {
  ReviewSession,
  ScoreLedgerEntry,
  UserSessionEvaluation,
  UserTrustProfile,
} from "../domain/types";

type ReviewSessionsPanelProps = {
  reviewSessions: ReviewSession[];
  evaluations: UserSessionEvaluation[];
  trustProfiles: UserTrustProfile[];
  ledgerEntries: ScoreLedgerEntry[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  embedded?: boolean;
};

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function ReviewSessionsPanel({
  reviewSessions,
  evaluations,
  trustProfiles,
  ledgerEntries,
  selectedSessionId,
  onSelectSession,
  embedded = false,
}: ReviewSessionsPanelProps) {
  const selectedSession = useMemo(() => {
    if (!selectedSessionId) return null;
    return reviewSessions.find((session) => session.sessionId === selectedSessionId) ?? null;
  }, [reviewSessions, selectedSessionId]);

  const selectedEvaluations = useMemo(() => {
    if (!selectedSessionId) return [];
    return evaluations.filter((item) => item.sessionId === selectedSessionId);
  }, [evaluations, selectedSessionId]);

  const selectedLedgerEntries = useMemo(() => {
    if (!selectedSessionId) return [];
    return ledgerEntries.filter((item) => item.sessionId === selectedSessionId);
  }, [ledgerEntries, selectedSessionId]);

  const trustByUser = useMemo(() => {
    const map = new Map<string, UserTrustProfile>();

    for (const item of trustProfiles) {
      map.set(item.userId, item);
    }

    return map;
  }, [trustProfiles]);

  const ledgerByUser = useMemo(() => {
    const map = new Map<string, ScoreLedgerEntry[]>();

    for (const entry of selectedLedgerEntries) {
      const current = map.get(entry.userId) ?? [];
      current.push(entry);
      map.set(entry.userId, current);
    }

    return map;
  }, [selectedLedgerEntries]);

  const containerStyle = embedded
    ? {
        width: "100%",
        height: "100%",
        overflow: "auto" as const,
        padding: 16,
      }
    : {
        width: 400,
        maxHeight: "calc(100vh - 32px)",
        overflow: "auto" as const,
        padding: 16,
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        background: "#ffffff",
        boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
      };

  return (
    <section style={containerStyle}>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Review sessions</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Istoric de sesiuni, evaluări per user și statistica mare a sesiunii selectate.
        </div>
      </div>

      {reviewSessions.length === 0 ? (
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
          Nu există încă review sessions închise.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8, marginBottom: 14 }}>
            {reviewSessions
              .slice()
              .reverse()
              .map((session) => {
                const isSelected = session.sessionId === selectedSessionId;

                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => onSelectSession(session.sessionId)}
                    style={{
                      border: isSelected ? "1px solid #111827" : "1px solid #e5e7eb",
                      background: isSelected ? "#f3f4f6" : "#ffffff",
                      borderRadius: 12,
                      padding: 10,
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>{session.label}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                      {session.sessionId}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      closedAt: {session.closedAt}
                    </div>
                  </button>
                );
              })}
          </div>

          {selectedSession ? (
            <div
              style={{
                borderTop: "1px solid #e5e7eb",
                paddingTop: 14,
                display: "grid",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  Selected session: {selectedSession.label}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  policyVersion: {selectedSession.policyVersion}
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Session evaluations</div>

                {selectedEvaluations.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Fără evaluări pentru sesiunea selectată.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 8 }}>
                    {selectedEvaluations.map((evaluation) => {
                      const trust = trustByUser.get(evaluation.userId);
                      const userReasons = ledgerByUser.get(evaluation.userId) ?? [];

                      return (
                        <div
                          key={`${evaluation.sessionId}-${evaluation.userId}`}
                          style={{
                            border: "1px solid #e5e7eb",
                            borderRadius: 12,
                            padding: 10,
                            background: "#fafafa",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              marginBottom: 8,
                            }}
                          >
                            <strong>{evaluation.userId}</strong>
                            <span style={{ fontSize: 12, color: "#6b7280" }}>
                              Trust {formatNumber(trust?.trustFactor ?? 0)}
                            </span>
                          </div>

                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <div style={{ color: "#6b7280" }}>Performance</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(evaluation.performancePercent)}%
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Net</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(
                                  evaluation.rewardPoints - evaluation.penaltyPoints
                                )}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Reward</div>
                              <div style={{ fontWeight: 700, color: "#166534" }}>
                                +{formatNumber(evaluation.rewardPoints)}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Penalty</div>
                              <div style={{ fontWeight: 700, color: "#991b1b" }}>
                                -{formatNumber(evaluation.penaltyPoints)}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Initiative</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(evaluation.initiativeScore)}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Influence</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(evaluation.influenceScore)}
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Accuracy</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(evaluation.accuracyIndex * 100)}%
                              </div>
                            </div>

                            <div>
                              <div style={{ color: "#6b7280" }}>Risk</div>
                              <div style={{ fontWeight: 700 }}>
                                {formatNumber(evaluation.riskIndex * 100)}%
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: 10 }}>
                            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                              Reasons
                            </div>

                            {userReasons.length === 0 ? (
                              <div style={{ fontSize: 12, color: "#6b7280" }}>
                                Fără ledger entries.
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 6 }}>
                                {userReasons.slice(0, 6).map((entry) => (
                                  <div
                                    key={entry.entryId}
                                    style={{
                                      background: "#ffffff",
                                      border: "1px solid #e5e7eb",
                                      borderRadius: 10,
                                      padding: 8,
                                      fontSize: 12,
                                    }}
                                  >
                                    <div style={{ fontWeight: 700 }}>
                                      {entry.reasonCode} ·{" "}
                                      {entry.pointsDelta > 0 ? "+" : ""}
                                      {formatNumber(entry.pointsDelta)}
                                    </div>
                                    <div style={{ color: "#6b7280", marginTop: 2 }}>
                                      {entry.explanation}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}