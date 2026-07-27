import authManager from "~/server/internal/auth";

defineRouteMeta({
  openAPI: {
    tags: ["Auth"],
    description: "OIDC Signin redirect",
    parameters: [],
  },
});

export default defineEventHandler((h3) => {
  const redirectParam = getQuery(h3).redirect?.toString();

  const enabledAuthManagers = authManager.getAuthProviders();
  if (!enabledAuthManagers.OpenID) {
    const signinRedirect = redirectParam
      ? `?redirect=${encodeURIComponent(redirectParam)}`
      : "";
    return sendRedirect(h3, `/auth/signin${signinRedirect}`);
  }

  const manager = enabledAuthManagers.OpenID;
  const { redirectUrl } = manager.generateAuthSession({
    redirect: redirectParam,
  });

  return sendRedirect(h3, redirectUrl);
});
