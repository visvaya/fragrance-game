# Publikacja: propozycja

Status: 2026-09-29, propozycja, niewdrożone (zmiana dotyczy tylko przyszłej własnej domeny; aplikacja już działa na Vercelu).

## Propozycja

Eauxle zostaje na Vercelu. Aplikacja to Next.js 16 renderowany po stronie serwera (server actions, `proxy.ts` z CSP i limitem zapytań), z cronem Vercela (`/api/cron/generate-daily`, 00:00 UTC, region `fra1`), Supabase, Upstash, R2, Sentry, PostHog i Turnstile. Vercel daje te elementy bez utrzymania serwera: CDN, podglądy per PR, cron z `CRON_SECRET`, zmienne środowiskowe per środowisko. Hosting statyczny Cloudflare nie wchodzi w grę (renderowanie po stronie serwera), a przeniesienie na współdzielony serwer `vps-waw` nie jest rekomendowane. Własna domena później przez Vercel: osobna domena `.pl` albo subdomena, np. `eauxle.<domena>.pl`.

## Kroki wdrożenia

Tylko podpięcie domeny, gdy właściciel ją kupi:

1. Vercel, projekt Eauxle, _Settings_ -> _Domains_: dodanie `eauxle.<domena>.pl` (lub osobnej domeny).
2. DNS u rejestratora lub w Cloudflare: rekord `CNAME` dla subdomeny na adres wskazany przez Vercel (dla domeny głównej rekord `A` według instrukcji Vercela); przy DNS w Cloudflare rekord bez proxy (szara chmurka), żeby TLS i cache zostały po stronie Vercela.
3. Ustawienie nowej domeny jako głównej i przekierowanie 308 z adresu `*.vercel.app`.
4. Aktualizacja miejsc zależnych od adresu: dozwolone originy w CSP i CORS (`proxy.ts`), adresy przekierowań auth w Supabase (_Site URL_, _Redirect URLs_), domeny w Turnstile, PostHog i Sentry, zmienne typu adres bazowy w `.env.example` i w Vercelu, metadane (`metadataBase`, sitemap, Open Graph).
5. Sprawdzenie: logowanie, gra dnia, cron (ręczne wywołanie z nagłówkiem `Authorization: Bearer $CRON_SECRET` w środowisku podglądu), nagłówki bezpieczeństwa (`curl -I`), smoke Playwright na nowej domenie.

## Wymagane decyzje właściciela

- Osobna domena dla Eauxle czy subdomena wspólnej domeny `.pl`.
- Zgoda na odejście od zapisu w `AGENTS.md` projektu (katalog główny, poza repozytorium), który mówi dziś o hostingu docelowo na VPS właściciela zamiast Vercela i hostowanego Supabase; ta propozycja zakłada decyzję z 2026-09-29: zostaje Vercel.

## Ryzyka i koszty

- Koszt: plan Vercela bez zmian; domena `.pl` to koszt roczny (osobna domena to osobny koszt).
- Przeniesienie na `vps-waw` (odradzane) wymagałoby: serwera Node pod `next start` jako usługi systemd, zastępstwa crona Vercela (timer systemd wołający endpoint z `CRON_SECRET`), reverse proxy z TLS, sekretów w `/etc`, a aplikacja straciłaby CDN i podglądy per PR; do tego obciążenie wspólnego serwera z 4 GB RAM (limit około 3 GB dla usług stale działających).
- Zmiana domeny bez aktualizacji punktu 4 psuje logowanie (przekierowania Supabase) i captchę (Turnstile).
- Zależność od dostawcy: funkcje specyficzne dla Vercela (cron, `unstable_cache`) utrudniają późniejszą migrację; `AGENTS.md` już zaleca unikanie nowych takich zależności.
