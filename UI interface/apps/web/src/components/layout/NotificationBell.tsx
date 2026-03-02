import { useEffect, useRef, useState } from "react";
import { useNotificationCenter } from "../../hooks/useNotificationCenter";
import {
  formatDateShort,
  getFriendDeadlineLabel,
  getOwnDeadlineLabel,
  getPendingDeadlineLabel,
  getPersonLabel,
} from "../../lib/notificationCenter";

type NotificationBellProps = {
  userEmail: string;
  onOpenFriendModal: () => void;
  onBeforeOpen?: () => void;
};

export default function NotificationBell({
  userEmail,
  onOpenFriendModal,
  onBeforeOpen,
}: NotificationBellProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);
  const {
    notificationLoading,
    notificationError,
    hasUnreadNotifications,
    incomingAlerts,
    oaAlerts,
    pendingDeadlineAlerts,
    friendDeadlineAlerts,
    notificationCount,
    hasNotificationItems,
    loadNotificationFeed,
  } = useNotificationCenter(userEmail);

  useEffect(() => {
    if (!showNotifications) return;

    function onDocumentClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (notificationRef.current && target && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }
    }

    function onEscapeKey(e: KeyboardEvent) {
      if (e.key === "Escape") setShowNotifications(false);
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscapeKey);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscapeKey);
    };
  }, [showNotifications]);

  function toggleNotifications() {
    const opening = !showNotifications;
    if (opening) {
      onBeforeOpen?.();
      void loadNotificationFeed({ markAsSeen: true });
    }
    setShowNotifications(opening);
  }

  function onClickFriendRequestAlert() {
    setShowNotifications(false);
    onOpenFriendModal();
  }

  return (
    <div className="nav-notify" ref={notificationRef}>
      <button
        type="button"
        className={`quick-add-btn notify-btn${showNotifications ? " active" : ""}${hasUnreadNotifications ? " unread" : ""}`}
        onClick={toggleNotifications}
        aria-label="Open notifications"
        title="Notifications"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3a5 5 0 0 0-5 5v2.3c0 .8-.3 1.6-.9 2.2l-1.1 1.1a1 1 0 0 0 .7 1.7h12.6a1 1 0 0 0 .7-1.7l-1.1-1.1a3.1 3.1 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Zm0 18a3 3 0 0 0 2.8-2h-5.6A3 3 0 0 0 12 21Z"
          />
        </svg>
      </button>

      {showNotifications ? (
        <div className="notify-menu" role="dialog" aria-label="Notifications">
          <div className="notify-head">
            <strong>Notifications</strong>
            <span>{notificationLoading ? "Updating..." : `${notificationCount} urgent`}</span>
          </div>
          {notificationError ? <div className="notify-error">{notificationError}</div> : null}
          <div className="notify-list">
            {incomingAlerts.length > 0 ? (
              <button type="button" className="notify-item notify-item--action" onClick={onClickFriendRequestAlert}>
                <span className="notify-pill">Friend Requests</span>
                <span className="notify-title">
                  {incomingAlerts.length} new friend request{incomingAlerts.length > 1 ? "s" : ""}
                </span>
                <span className="notify-meta">Open Add Friend to accept or reject.</span>
              </button>
            ) : null}

            {oaAlerts.slice(0, 4).map((item) => (
              <div
                key={item.id}
                className={`notify-item notify-item--deadline ${item.oa_urgency === "overdue" ? "is-overdue" : ""}`}
              >
                <span className="notify-pill">Your Deadline</span>
                <span className="notify-title">
                  {(item.company ?? "Company").trim() || "Company"} · {(item.role ?? "Role").trim() || "Role"}
                </span>
                <span className="notify-meta">
                  {getOwnDeadlineLabel(item)} · {formatDateShort(item.oa_deadline_date)}
                </span>
              </div>
            ))}

            {pendingDeadlineAlerts.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className={`notify-item notify-item--task ${item.deadline_state === "overdue" ? "is-overdue" : ""}`}
              >
                <span className="notify-pill">Task Deadline</span>
                <span className="notify-title">
                  {item.company} · {item.position || "Pending Task"}
                </span>
                <span className="notify-meta">
                  {getPendingDeadlineLabel(item)} · {formatDateShort(item.end_date)}
                </span>
              </div>
            ))}

            {friendDeadlineAlerts.slice(0, 4).map((item) => (
              <div
                key={`${item.friend_id}-${item.job_id}`}
                className={`notify-item notify-item--friend ${item.deadline_state === "overdue" ? "is-overdue" : ""}`}
              >
                <span className="notify-pill">Friend Deadline</span>
                <span className="notify-title">
                  {getPersonLabel(item.friend_name, item.friend_email)} ·{" "}
                  {(item.company ?? "Company").trim() || "Company"}
                </span>
                <span className="notify-meta">{getFriendDeadlineLabel(item)}</span>
              </div>
            ))}

            {!notificationLoading && !notificationError && !hasNotificationItems ? (
              <div className="notify-empty">No alerts right now.</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
