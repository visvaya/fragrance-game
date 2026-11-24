import { RegisterForm } from "@/components/auth/register-form";

import { authPageMetadata } from "../metadata";

/** Metadata of the registration page. */
export const generateMetadata = authPageMetadata("signUp");

// jscpd:ignore-start -- Next needs a default export per page; each names its own form
/**
 * Registration page.
 */
export default function RegisterPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center p-4">
      <RegisterForm />
    </div>
  );
}
// jscpd:ignore-end
