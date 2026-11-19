import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

import { authPageMetadata } from "../metadata";

/**
 * Generates metadata for the registration page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return authPageMetadata(params, "signUp");
}

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
