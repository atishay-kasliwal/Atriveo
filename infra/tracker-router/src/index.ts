const TRACKER_PAGES_ORIGIN = "https://noobly.pages.dev";

function toUpstreamUrl(requestUrl: string): URL {
  const incoming = new URL(requestUrl);
  return new URL(`${incoming.pathname}${incoming.search}`, TRACKER_PAGES_ORIGIN);
}

function rewriteLocationHeader(headers: Headers): void {
  const location = headers.get("Location");
  if (!location) return;

  try {
    const redirect = new URL(location, TRACKER_PAGES_ORIGIN);
    if (redirect.origin !== TRACKER_PAGES_ORIGIN) return;
    headers.set("Location", `${redirect.pathname}${redirect.search}${redirect.hash}`);
  } catch {
    // Preserve malformed or intentionally relative upstream locations.
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const upstreamUrl = toUpstreamUrl(request.url);
    const upstreamRequest = new Request(upstreamUrl, request);
    const upstreamResponse = await fetch(upstreamRequest, { redirect: "manual" });
    const responseHeaders = new Headers(upstreamResponse.headers);

    rewriteLocationHeader(responseHeaders);
    responseHeaders.set("X-Robots-Tag", "all");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
