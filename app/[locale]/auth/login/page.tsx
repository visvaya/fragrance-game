import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

import { authPageMetadata } from "../metadata";

/**
 * Generates metadata for the login page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return authPageMetadata(params, "signIn");
}

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
