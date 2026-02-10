import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

/**
 * Tworzy klienta Supabase do użycia w Server Components, Route Handlers i Server Actions.
 * Wykorzystuje @supabase/ssr z obsługą ciasteczek Next.js.
 *
 * UWAGA: Ten klient ma dostęp tylko do odczytu ciasteczek w Server Components.
 * Dla operacji wymagających zapisu ciasteczek (auth) użyj middleware.
 * @returns Promise z klientem Supabase skonfigurowanym dla serwera
 * @throws Error gdy brakuje zmiennych środowiskowych
 * @example
 * ```tsx
 * // W Server Component
 * import { createClient } from '@/lib/supabase/server'
 *
 * export default async function Page() {
 *   const supabase = await createClient()
 *   const { data } = await supabase.from('perfumes').select()
 *   // ...
 * }
 * ```
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Operacja setAll może zawieść w Server Component (read-only context).
          // Supabase SSR wyemituje ostrzeżenie, jeśli odświeżanie sesji jest wymagane.
        }
      },
    },
  });
}

/**
 * Tworzy klienta administracyjnego Supabase z uprawnieniami SERVICE_ROLE.
 *
 * OSTRZEŻENIE: Używaj WYŁĄCZNIE w Server Actions/API Routes.
 * NIGDY nie eksponuj tego klienta na frontendzie!
 * @returns Klient Supabase z uprawnieniami administracyjnymi
 * @throws Error gdy brakuje SUPABASE_SERVICE_ROLE_KEY
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  return createServerClient(supabaseUrl, serviceKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {
        // Admin client doesn't need to persist cookies
      },
    },
  });
}
