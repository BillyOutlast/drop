# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> E2E smoke >> health endpoint responds
- Location: test/e2e/smoke.spec.ts:14:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 404
```

# Test source

```ts
  1  | /**
  2  |  * E2E smoke test: verifies the dev server boots and the health endpoint
  3  |  * responds. Health is a pure handler (no DB, no auth) so it works in
  4  |  * bare CI without service dependencies.
  5  |  *
  6  |  * Catches:
  7  |  * - Port mismatch between Playwright config and nuxt.config.ts
  8  |  * - Dev server crash on boot (e.g. tailwindcss plugin recursion)
  9  |  * - Routing/middleware misconfiguration that breaks API routes
  10 |  */
  11 | import { test, expect } from "@playwright/test";
  12 |
  13 | test.describe("E2E smoke", () => {
  14 |   test("health endpoint responds", async ({ request }) => {
  15 |     const response = await request.get("/api/v1/health");
> 16 |     expect(response.status()).toBe(200);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  17 |     const body = (await response.json()) as { status: string; timestamp: number };
  18 |     expect(body.status).toBe("ok");
  19 |     expect(typeof body.timestamp).toBe("number");
  20 |   });
  21 | });
  22 |
```
