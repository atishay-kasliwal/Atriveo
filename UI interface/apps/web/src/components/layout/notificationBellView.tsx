import { forwardRef } from "react";
import { formatDateShort } from "../../lib/notificationCenter";

export type NotificationKind = "info" | "success" | "warning" | "social";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
  read: boolean;
  type: NotificationKind;
  onClick?: () => void;
};

type HeaderNotificationsProps = {
  isOpen: boolean;
  onToggle: () => void;
  notificationItems: NotificationItem[];
  hasUnreadNotifications: boolean;
  notificationLoading: boolean;
  notificationError: string;
  hasNotificationItems: boolean;
  notificationCount: number;
  onMarkAllAsRead: () => void;
  onClose: () => void;
};

export const HeaderNotifications = forwardRef<HTMLDivElement, HeaderNotificationsProps>(
  (
    {
      isOpen,
      onToggle,
      notificationItems,
      hasUnreadNotifications,
      notificationLoading,
      notificationError,
      hasNotificationItems,
      notificationCount,
      onMarkAllAsRead,
      onClose,
    },
    ref,
  ) => (
    <div className="header-notifications" ref={ref}>
      <BellTrigger
        isOpen={isOpen}
        hasUnreadNotifications={hasUnreadNotifications}
        onToggle={onToggle}
      />
      {isOpen ? (
        <NotificationPanel
          notificationItems={notificationItems}
          hasUnreadNotifications={hasUnreadNotifications}
          notificationLoading={notificationLoading}
          notificationError={notificationError}
          hasNotificationItems={hasNotificationItems}
          notificationCount={notificationCount}
          onMarkAllAsRead={onMarkAllAsRead}
          onClose={onClose}
        />
      ) : null}
    </div>
  ),
);

HeaderNotifications.displayName = "HeaderNotifications";

type BellTriggerProps = {
  isOpen: boolean;
  hasUnreadNotifications: boolean;
  onToggle: () => void;
};

function BellTrigger({ isOpen, hasUnreadNotifications, onToggle }: BellTriggerProps) {
  return (
    <button
      type="button"
      className={`header-notifications-trigger${isOpen ? " active" : ""}`}
      onClick={onToggle}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      aria-label="Open notifications"
      title="Notifications"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3a5 5 0 0 0-5 5v2.3c0 .8-.3 1.6-.9 2.2l-1.1 1.1a1 1 0 0 0 .7 1.7h12.6a1 1 0 0 0 .7-1.7l-1.1-1.1a3.1 3.1 0 0 1-.9-2.2V8a5 5 0 0 0-5-5Zm0 18a3 3 0 0 0 2.8-2h-5.6A3 3 0 0 0 12 21Z"
        />
      </svg>
      {hasUnreadNotifications ? <UnreadIndicator /> : null}
    </button>
  );
}

function UnreadIndicator() {
  return <span className="header-notifications-unread-dot" aria-hidden />;
}

type NotificationPanelProps = {
  notificationItems: NotificationItem[];
  hasUnreadNotifications: boolean;
  notificationLoading: boolean;
  notificationError: string;
  hasNotificationItems: boolean;
  notificationCount: number;
  onMarkAllAsRead: () => void;
  onClose: () => void;
};

function NotificationPanel({
  notificationItems,
  hasUnreadNotifications,
  notificationLoading,
  notificationError,
  hasNotificationItems,
  notificationCount,
  onMarkAllAsRead,
  onClose,
}: NotificationPanelProps) {
  return (
    <div className="header-notifications-panel" role="menu" aria-label="Notifications">
      <div className="header-notifications-panel-header">
        <span className="header-notifications-panel-title">Notifications</span>
        {hasUnreadNotifications ? (
          <button type="button" className="header-notifications-mark-all" onClick={onMarkAllAsRead}>
            Mark all as read
          </button>
        ) : (
          <span className="header-notifications-meta">
            {notificationLoading ? "Updating..." : `${notificationCount} alerts`}
          </span>
        )}
      </div>

      {notificationError ? <div className="header-notifications-error">{notificationError}</div> : null}

      <div className="header-notifications-list">
        {!notificationLoading && !notificationError && !hasNotificationItems ? (
          <div className="header-notifications-empty">You&apos;re all caught up.</div>
        ) : (
          notificationItems.map((item) => (
            <NotificationItemRow
              key={item.id}
              item={item}
              unread={hasUnreadNotifications && !item.read}
              onSelect={() => item.onClick?.()}
            />
          ))
        )}
      </div>

      <div className="header-notifications-footer">
        <button type="button" className="header-notifications-view-all" onClick={onClose}>
          View all
        </button>
      </div>
    </div>
  );
}

type NotificationItemRowProps = {
  item: NotificationItem;
  unread: boolean;
  onSelect: () => void;
};

function NotificationItemRow({ item, unread, onSelect }: NotificationItemRowProps) {
  const className = `header-notification-item${unread ? " header-notification-item--unread" : ""}${
    item.onClick ? " is-clickable" : ""
  }`;
  return (
    <button type="button" className={className} onClick={item.onClick ? onSelect : undefined}>
      <span className={`header-notification-item-indicator header-notification-item-indicator--${item.type}`} />
      <span className="header-notification-item-content">
        <span className="header-notification-item-title-row">
          <span className="header-notification-item-title">{item.title}</span>
          <span className="header-notification-item-time">{item.time}</span>
        </span>
        {item.description ? (
          <span className="header-notification-item-description">{item.description}</span>
        ) : null}
      </span>
    </button>
  );
}

export function formatRelativeTime(value?: string | null): string {
  if (!value) return "Now";
  const raw = String(value).trim();
  if (!raw) return "Now";
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Now";
  const diffMs = Date.now() - parsed.getTime();
  if (diffMs <= 0) return "Now";
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`;
  return formatDateShort(raw.slice(0, 10));
}
