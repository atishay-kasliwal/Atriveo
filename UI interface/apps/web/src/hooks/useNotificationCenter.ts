import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getActiveOa,
  getFriendRequests,
  getNetworkDeadlines,
  getPending,
  type ActiveOaRecord,
  type IncomingFriendRequest,
  type NetworkDeadlineRecord,
} from "../lib/api";
import { getLocalISODate } from "../lib/formatDate";
import {
  buildNotificationSignature,
  derivePendingDeadlineAlerts,
  type PendingDeadlineAlert,
} from "../lib/notificationCenter";

type LoadOptions = {
  markAsSeen?: boolean;
};

type NotificationCenterState = {
  notificationLoading: boolean;
  notificationError: string;
  hasUnreadNotifications: boolean;
  incomingAlerts: IncomingFriendRequest[];
  oaAlerts: ActiveOaRecord[];
  pendingDeadlineAlerts: PendingDeadlineAlert[];
  friendDeadlineAlerts: NetworkDeadlineRecord[];
  notificationCount: number;
  hasNotificationItems: boolean;
  loadNotificationFeed: (options?: LoadOptions) => Promise<void>;
};

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  return String(value ?? "Unknown error");
}

export function useNotificationCenter(userEmail: string): NotificationCenterState {
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [incomingAlerts, setIncomingAlerts] = useState<IncomingFriendRequest[]>([]);
  const [oaAlerts, setOaAlerts] = useState<ActiveOaRecord[]>([]);
  const [pendingDeadlineAlerts, setPendingDeadlineAlerts] = useState<PendingDeadlineAlert[]>([]);
  const [friendDeadlineAlerts, setFriendDeadlineAlerts] = useState<NetworkDeadlineRecord[]>([]);
  const latestSignatureRef = useRef("");

  const getSeenNotificationKey = useCallback(
    () => `noobly_notify_seen_signature_${String(userEmail || "").toLowerCase()}`,
    [userEmail],
  );

  const markNotificationsAsSeen = useCallback(
    (signature?: string) => {
      const toStore = signature ?? latestSignatureRef.current;
      try {
        window.localStorage.setItem(getSeenNotificationKey(), toStore);
      } catch {
        // Ignore localStorage failures and continue with in-memory behavior.
      }
      setHasUnreadNotifications(false);
    },
    [getSeenNotificationKey],
  );

  const loadNotificationFeed = useCallback(
    async (options?: LoadOptions) => {
      try {
        setNotificationLoading(true);
        setNotificationError("");

        const [requestsResult, activeOaResult, pendingResult, friendDeadlinesResult] =
          await Promise.allSettled([
            getFriendRequests(),
            getActiveOa(),
            getPending(false),
            getNetworkDeadlines(),
          ]);

        const errorMessages: string[] = [];
        const incomingRows =
          requestsResult.status === "fulfilled"
            ? requestsResult.value.incoming ?? []
            : (errorMessages.push(`Friend requests: ${toErrorMessage(requestsResult.reason)}`), []);
        const ownOaRows =
          activeOaResult.status === "fulfilled"
            ? (activeOaResult.value.data ?? []).filter((row) => row.oa_urgency !== "no_deadline")
            : (errorMessages.push(`OA deadlines: ${toErrorMessage(activeOaResult.reason)}`), []);
        const pendingRows =
          pendingResult.status === "fulfilled"
            ? pendingResult.value.data ?? []
            : (errorMessages.push(`Task deadlines: ${toErrorMessage(pendingResult.reason)}`), []);
        const friendDeadlineRows =
          friendDeadlinesResult.status === "fulfilled"
            ? friendDeadlinesResult.value.data ?? []
            : (errorMessages.push(`Friend deadlines: ${toErrorMessage(friendDeadlinesResult.reason)}`), []);

        const pendingAlerts = derivePendingDeadlineAlerts(pendingRows, getLocalISODate());
        const signature = buildNotificationSignature(incomingRows, ownOaRows, pendingAlerts, friendDeadlineRows);
        latestSignatureRef.current = signature;

        setIncomingAlerts(incomingRows);
        setOaAlerts(ownOaRows);
        setPendingDeadlineAlerts(pendingAlerts);
        setFriendDeadlineAlerts(friendDeadlineRows);
        setNotificationError(errorMessages.join(" • "));

        if (options?.markAsSeen) {
          markNotificationsAsSeen(signature);
        } else {
          const hasAnyAlerts =
            incomingRows.length > 0 ||
            ownOaRows.length > 0 ||
            pendingAlerts.length > 0 ||
            friendDeadlineRows.length > 0;
          let seenSignature = "";
          try {
            seenSignature = window.localStorage.getItem(getSeenNotificationKey()) ?? "";
          } catch {
            seenSignature = "";
          }
          setHasUnreadNotifications(hasAnyAlerts && signature !== seenSignature);
        }
      } finally {
        setNotificationLoading(false);
      }
    },
    [getSeenNotificationKey, markNotificationsAsSeen],
  );

  useEffect(() => {
    void loadNotificationFeed();
    function onRefresh() {
      void loadNotificationFeed();
    }
    window.addEventListener("dashboard-refresh", onRefresh);
    return () => window.removeEventListener("dashboard-refresh", onRefresh);
  }, [loadNotificationFeed]);

  const { notificationCount, hasNotificationItems } = useMemo(() => {
    const urgentOwnDeadlines = oaAlerts.filter(
      (row) => row.oa_urgency === "overdue" || row.oa_urgency === "today",
    );
    const urgentPendingDeadlines = pendingDeadlineAlerts.filter(
      (row) => row.deadline_state === "overdue" || row.deadline_state === "today",
    );
    return {
      notificationCount:
        incomingAlerts.length +
        urgentOwnDeadlines.length +
        urgentPendingDeadlines.length +
        friendDeadlineAlerts.length,
      hasNotificationItems:
        incomingAlerts.length > 0 ||
        oaAlerts.length > 0 ||
        pendingDeadlineAlerts.length > 0 ||
        friendDeadlineAlerts.length > 0,
    };
  }, [incomingAlerts, oaAlerts, pendingDeadlineAlerts, friendDeadlineAlerts]);

  return {
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
  };
}
