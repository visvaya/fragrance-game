import { createBrowserClient } from '@supabase/ssr'

/**
 * Tworzy klienta Supabase do użycia w komponencie po stronie przeglądarki (Client Components).
 * Wykorzystuje @supabase/ssr, który automatycznie zarządza ciasteczkami sesji.
 * 
 * @returns Klient Supabase skonfigurowany dla przeglądarki
 * @throws Error gdy brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY
 * 
 * @example
 * ```tsx
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 * 
 * export function MyComponent() {
 *   const supabase = createClient()
 *   // ...
 * }
 * ```
 */
export function createClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Brakuje zmiennych środowiskowych NEXT_PUBLIC_SUPABASE_URL lub NEXT_PUBLIC_SUPABASE_ANON_KEY'
        )
    }

    // Use local proxy to bypass uMatrix/AdBlockers
    const proxyUrl = '/api/db'
    return createBrowserClient(proxyUrl, supabaseAnonKey)
}
