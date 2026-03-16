import type { UserId } from "../domain/types";

type SessionReviewToolbarProps = {
  currentUser: UserId;
  onCloseReviewSession: () => void;
  onResetCurrentOwnerReviews: () => void;
  onResetReviewSessions: () => void;
  onResetAllOwnerReviews: () => void;
  currentSessionId?: string;
  reviewsCount: number;
  disabled?: boolean;
};

function buttonStyle(enabled: boolean, destructive = false) {
  return {
    padding: "10px 12px",
    borderRadius: 12,
    border: `1px solid ${destructive ? "#7f1d1d" : "#111827"}`,
    background: enabled ? (destructive ? "#7f1d1d" : "#111827") : "#e5e7eb",
    color: enabled ? "#ffffff" : "#6b7280",
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: 700,
    fontSize: 12,
  } as const;
}

export function SessionReviewToolbar({
  currentUser,
  onCloseReviewSession,
  onResetCurrentOwnerReviews,
  onResetReviewSessions,
  onResetAllOwnerReviews,
  currentSessionId,
  reviewsCount,
  disabled = false,
}: SessionReviewToolbarProps) {
  const isOwner = currentUser === "O";
  const enabled = !disabled && isOwner;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 12,
      }}
    >
      <div>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Review sessions controls</div>
        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
          Current user: {currentUser} · Closed reviews: {reviewsCount}
          {currentSessionId ? ` · Current session: ${currentSessionId}` : ""}
        </div>
        {!isOwner ? (
          <div style={{ fontSize: 12, color: "#991b1b", marginTop: 6 }}>
            Doar owner-ul poate închide sau reseta review sessions.
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          onClick={onCloseReviewSession}
          disabled={!enabled}
          style={buttonStyle(enabled)}
          title="Close review session and calculate performance"
        >
          Close review session
        </button>

        <button
          type="button"
          onClick={onResetCurrentOwnerReviews}
          disabled={!enabled}
          style={buttonStyle(enabled)}
          title="Reset only owner reviews from the current session"
        >
          Reset current owner reviews
        </button>

        <button
          type="button"
          onClick={onResetReviewSessions}
          disabled={!enabled}
          style={buttonStyle(enabled, true)}
          title="Reset closed review sessions and derived stats"
        >
          Reset review sessions
        </button>

        <button
          type="button"
          onClick={onResetAllOwnerReviews}
          disabled={!enabled}
          style={buttonStyle(enabled, true)}
          title="Reset all owner reviews across all sessions"
        >
          Reset all owner reviews
        </button>
      </div>
    </div>
  );
}