import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

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

test("Login and Logout", async ({ page }) => {
  await page.goto("/auth/login");

  // Fill credentials
  // Using placeholders from en.json: "emailPlaceholder": "mail@example.com"
  await page.getByPlaceholder("mail@example.com").fill(email);
  await page.getByLabel("Password").fill(password);

  // Click Sign In
  await page.getByRole("button", { name: "Sign In" }).click();

  // After login, app redirects to home (locale-prefixed URL)
  await expect(page).toHaveURL(/\/(en|pl)(\/.*)?$/);

  // Verify Sign In is hidden (user is authenticated)
  await expect(page.getByRole("button", { name: "Sign In" })).toBeHidden();

  // Open the header menu to access Sign Out
  const menuButton = page.locator('button[aria-label="Menu"]');
  await menuButton.click();

  // Sign Out is a button inside the dropdown (not a menuitem role)
  const signOutButton = page.getByRole("button", { name: "Sign Out" });
  await expect(signOutButton).toBeVisible();
  await signOutButton.click();

  // Sign-out reloads the current page (anonymous session restored)
  // Verify user is no longer authenticated by waiting for page reload
  await page.waitForLoadState("networkidle");
  // Sign In button should reappear in the menu
  await menuButton.click();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
