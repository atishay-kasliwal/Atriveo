import { useEffect, useMemo, useRef, useState } from "react";
import { useNotificationCenter } from "../../hooks/useNotificationCenter";
import {
  getFriendDeadlineLabel,
  getOwnDeadlineLabel,
  getPendingDeadlineLabel,
  getPersonLabel,
} from "../../lib/notificationCenter";
import { HeaderNotifications, formatRelativeTime, type NotificationItem } from "./notificationBellView";

type NotificationBellProps = {
  userEmail: string;
  onOpenFriendModal: () => void;
};

export default function NotificationBell({
  userEmail,
  onOpenFriendModal,
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

  const notificationItems = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    for (const request of incomingAlerts) {
      items.push({
        id: `incoming-${String(request.friendship_id)}`,
        title: `Friend request from ${getPersonLabel(request.requester_name, request.requester_email)}`,
        description: "Open Add Friend to accept or reject.",
        time: formatRelativeTime(request.created_at),
        read: false,
        type: "social",
        onClick: () => {
          setShowNotifications(false);
          onOpenFriendModal();
        },
      });
    }

    for (const row of oaAlerts.slice(0, 6)) {
      const urgency = row.oa_urgency === "overdue" || row.oa_urgency === "today";
      items.push({
        id: `oa-${String(row.id)}`,
        title: `${(row.company ?? "Company").trim() || "Company"} · ${(row.role ?? "Role").trim() || "Role"}`,
        description: `${getOwnDeadlineLabel(row)} · ${formatDateShort(row.oa_deadline_date)}`,
        time: formatRelativeTime(row.oa_deadline_date),
        read: !urgency,
        type: urgency ? "warning" : "info",
      });
    }

    for (const task of pendingDeadlineAlerts.slice(0, 6)) {
      const urgentTask = task.deadline_state === "overdue" || task.deadline_state === "today";
      items.push({
        id: `task-${task.id}`,
        title: `${task.company} · ${task.position || "Pending Task"}`,
        description: `${getPendingDeadlineLabel(task)} · ${formatDateShort(task.end_date)}`,
        time: formatRelativeTime(task.end_date),
        read: !urgentTask,
        type: urgentTask ? "warning" : "info",
      });
    }

    for (const row of friendDeadlineAlerts.slice(0, 6)) {
      items.push({
        id: `friend-deadline-${String(row.friend_id)}-${String(row.job_id)}`,
        title: `${getPersonLabel(row.friend_name, row.friend_email)} · ${(row.company ?? "Company").trim() || "Company"}`,
        description: getFriendDeadlineLabel(row),
        time: formatRelativeTime(row.oa_deadline_date),
        read: false,
        type: "success",
      });
    }

    return items.slice(0, 20);
  }, [friendDeadlineAlerts, incomingAlerts, oaAlerts, onOpenFriendModal, pendingDeadlineAlerts]);

  function toggleNotifications() {
    const opening = !showNotifications;
    if (opening) {
      void loadNotificationFeed();
    }
    setShowNotifications(opening);
  }

  async function onMarkAllAsRead() {
    await loadNotificationFeed({ markAsSeen: true });
  }

  return (
    <HeaderNotifications
      ref={notificationRef}
      isOpen={showNotifications}
      onToggle={toggleNotifications}
      notificationItems={notificationItems}
      hasUnreadNotifications={hasUnreadNotifications}
      notificationLoading={notificationLoading}
      notificationError={notificationError}
      hasNotificationItems={hasNotificationItems}
      notificationCount={notificationCount}
      onMarkAllAsRead={onMarkAllAsRead}
      onClose={() => setShowNotifications(false)}
    />
  );
}
