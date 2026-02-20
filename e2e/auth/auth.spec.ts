import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

test.describe("Authentication Flow", () => {
  // Skip if no service key (cannot create user)
  test.skip(
    !supabaseServiceKey,
    "Skipping auth tests because SUPABASE_SERVICE_ROLE_KEY is missing",
  );

  const email = `e2e-test-${Date.now()}@example.com`;
  // Password must meet complexity requirements: 8+ chars, lower, upper, digit
  const password = "StrongPass123!";
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

    // Wait for redirect to home or game
    await expect(page).toHaveURL("/");

    // Verify User Menu presence (Avatar or Initials)
    // Assuming there is a button with an Avatar or similar in the header
    // We'll look for a button that likely opens the user menu.
    // Based on common shadcn usage, it's often a button with "ghost" variant or Avatar.
    // Let's try to find it by "Sign Out" NOT being visible yet, but a menu trigger being visible.

    // Specific selector might be needed if no clear accessible name.
    // Using a generic check for "Sign In" NOT being there anymore
    await expect(page.getByText("Sign In")).toBeHidden();

    // Open user menu - try to match the trigger.
    // Often it has `aria-label="Toggle user menu"` or similar.
    // If not, we might need to rely on the avatar image or initials.
    // For now, let's assume there's a button in the header.
    // We can inspect the DOM in a real run, but here we guess/approximate.
    // Let's try to find a button in the header `header`.

    const userMenuTrigger = page.locator("header button").last(); // Risky but often works for right-aligned user menu
    await userMenuTrigger.click();

    // Check if "Sign Out" is in the menu
    const signOutButton = page.getByRole("menuitem", { name: /Sign Out/i });
    await expect(signOutButton).toBeVisible();

    // Click Sign Out
    await signOutButton.click();

    // Verify logged out - "Sign In" should be visible again
    // Or redirect to login page
    await expect(page).toHaveURL("/auth/login");
    await expect(page.getByText("Welcome Back")).toBeVisible();
  });
});
