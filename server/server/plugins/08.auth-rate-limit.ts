// fallow-ignore-file unused-file

const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();
const AUTH_ROUTES = ["/api/v1/auth/signin", "/api/v1/auth/signup"];
const MAX_TOKENS = 5;
const WINDOW_MS = 60_000;

// fallow-ignore-next-line complexity
function rateLimitAuthRequests(event: { path?: string; headers: Headers }) {
  const url = event.path ?? "";
  const isAuthRoute = AUTH_ROUTES.some((prefix) => url.startsWith(prefix));
  if (!isAuthRoute) return;

  const ip =
    event.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    event.headers.get("x-real-ip") ??
    "unknown";
  const now = Date.now();
  const record = ipRequestCounts.get(ip);

  if (!record || now >= record.resetAt) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  record.count++;
  if (record.count > MAX_TOKENS) {
    throw createError({
      statusCode: 429,
      statusMessage: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
    });
  }
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook("request", rateLimitAuthRequests);
});
