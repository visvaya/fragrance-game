import { LoginForm } from "@/components/auth/login-form";

import { authPageMetadata } from "../metadata";

/** Metadata of the login page. */
export const generateMetadata = authPageMetadata("signIn");

// jscpd:ignore-start -- Next needs a default export per page; each names its own form
/**
 * Login page.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <LoginForm />
    </div>
  );
}
// jscpd:ignore-end
