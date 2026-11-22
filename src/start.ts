import { createMiddleware, createStart } from "@tanstack/react-start";
import { checkApiAccess } from "@/server/api-access";

const apiAccessMiddleware = createMiddleware().server(async ({ request, next }) => {
  const rejection = await checkApiAccess(request);
  return rejection ?? next();
});

export const startInstance = createStart(() => ({
  // SPA: the server only ever renders the static shell; pages render in the browser.
  defaultSsr: false,
  requestMiddleware: [apiAccessMiddleware],
}));
