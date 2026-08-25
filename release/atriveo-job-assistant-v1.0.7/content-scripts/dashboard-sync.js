(() => {
  if (window.__ATRIVEO_DASHBOARD_SYNC_LOADED__) return;
  window.__ATRIVEO_DASHBOARD_SYNC_LOADED__ = true;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "ATRIVEO_JOB_ADDED") return false;

    const eventName =
      typeof message?.event === "string" && message.event.trim()
        ? message.event.trim()
        : "dashboard-refresh";

    window.dispatchEvent(new CustomEvent(eventName));
    sendResponse({ ok: true });
    return false;
  });
})();
