import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { expectHydrated } from "../support/hydration";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Skip if no service key (cannot create user)

test.skip(
  !supabaseServiceKey,
  "Skipping auth tests because SUPABASE_SERVICE_ROLE_KEY is missing",
);

const email = `e2e-test-${Date.now()}@example.com`;
// Password must meet complexity requirements: 8+ chars, lower, upper, digit
const password = process.env.E2E_TEST_PASSWORD ?? "StrongPass123!";
let userId: string;

test.beforeAll(async () => {
  if (!supabaseServiceKey) return;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Create user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (error) {
    console.error("Failed to create test user:", error);
    throw error;
  }
  userId = data.user.id;
  console.log(`Created test user: ${email} (${userId})`);
});

test.afterAll(async () => {
  if (!supabaseServiceKey || !userId) return;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  // Delete user
  const { error } = await supabase.auth.admin.deleteUser(userId);
  if (error) {
    console.error("Failed to delete test user:", error);
  } else {
    console.log(`Deleted test user: ${userId}`);
  }
});

// Traces, screenshots and videos are uploaded as a public artifact; keep them off for this spec so
// nothing it handles (the service role key, the test user's session) can end up in one.
test.use({ screenshot: "off", trace: "off", video: "off" });

test("Login and Logout", async ({ page }) => {
  // Supabase captcha protection rejects a password sign-in without a Turnstile token, and the
  // test host cannot pass Turnstile. A request that carries the service role key skips the
  // captcha (as the Admin API sign-up of globalSetup does), so the form's request is answered
  // from here. It is sent from the Node process with plain `fetch`, never through the browser or
  // a Playwright request object: Playwright records those in traces, and the key must stay out.
  await page.route(
    (url) =>
      url.pathname.endsWith("/auth/v1/token") &&
      url.searchParams.get("grant_type") === "password",
    async (route) => {
      const response = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          body: route.request().postData() ?? "",
          headers: {
            apikey: supabaseServiceKey,
            authorization: `Bearer ${supabaseServiceKey}`,
            "content-type": "application/json",
          },
          method: "POST",
        },
      );
      // looseObject keeps every field of the session for the page's Supabase client.
      const session = z
        .looseObject({ access_token: z.string() })
        .parse(await response.json());
      await route.fulfill({
        body: JSON.stringify(session),
        headers: { "content-type": "application/json" },
        status: response.status,
      });
    },
  );

  await page.goto("/auth/login");
  await expectHydrated(page.locator('form button[type="submit"]').first());
  // With a Turnstile site key the form also needs a captcha token before it submits. The nightly
  // job sets no site key, so the form has no widget and there is no token to wait for here.

  // Fill credentials
  // Using placeholders from en.json: "emailPlaceholder": "mail@example.com"
  await page.getByPlaceholder("mail@example.com").fill(email);
  await page.getByLabel("Password").fill(password);

  // Click Sign In
  await page.getByRole("button", { name: "Sign In" }).click();

  // After login, app redirects to the home page (locale-prefixed URL); the login page itself
  // is locale-prefixed too, so the pattern must end at the locale.
  await expect(page).toHaveURL(/\/(en|pl)\/?$/);

  // Open the header menu: the user is authenticated, so it offers Sign Out instead of Sign In
  const menuButton = page.locator('button[aria-label="Menu"]');
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeHidden();

  // Sign Out is a button inside the dropdown (not a menuitem role)
  const signOutButton = page.getByRole("button", { name: "Sign Out" });
  await expect(signOutButton).toBeVisible();
  // Sign-out reloads the current page (anonymous session restored). The load event is awaited
  // from before the click, because the reload starts after an async sign-out request.
  const reloaded = page.waitForEvent("load");
  await signOutButton.click();
  await reloaded;

  await expectHydrated(menuButton);

  // Sign In button should reappear in the menu
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
