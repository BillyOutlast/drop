export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook("vue:error", (error, instance, info) => {
    // Client-side error handler — console.error is appropriate here
    // as pino is server-side only. Errors could be sent to a monitoring
    // service (e.g., Sentry) for production use.
    console.error(info, error, instance);
  });
});
