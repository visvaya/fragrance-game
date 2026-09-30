# Publikacja

Status: 2026-09-30. Obecnie Vercel (produkcja działa); docelowo własny VPS właściciela według `.plans/BACKLOG_V2.md` (katalog główny projektu, poza repozytorium), sekcja „Infrastruktura”. Termin przenosin nieustalony.

## Decyzje właściciela

- 2026-09-29: na ten moment Eauxle zostaje na Vercelu.
- 2026-09-30: docelowo obowiązuje plan przeniesienia na VPS z backlogu; zapis w `AGENTS.md` projektu (katalog główny) o unikaniu zależności tylko od Vercela i hostowanego Supabase pozostaje w mocy.

## Stan obecny: Vercel

Eauxle działa na Vercelu. Aplikacja to Next.js 16 renderowany po stronie serwera (server actions, `proxy.ts` z CSP i limitem zapytań), z cronem Vercela (`/api/cron/generate-daily`, 00:00 UTC, region `fra1`), Supabase, Upstash, R2, Sentry, PostHog i Turnstile. Vercel daje te elementy bez utrzymania serwera: CDN, podglądy per PR, cron z `CRON_SECRET`, zmienne środowiskowe per środowisko. Hosting statyczny Cloudflare nie wchodzi w grę (renderowanie po stronie serwera). Własna domena, dopóki aplikacja jest na Vercelu, przez Vercel: osobna domena `.pl` albo subdomena, np. `eauxle.<domena>.pl`.

## Własna domena na Vercelu

Gdy właściciel kupi domenę przed przenosinami:

1. Vercel, projekt Eauxle, _Settings_ -> _Domains_: dodanie `eauxle.<domena>.pl` (lub osobnej domeny).
2. DNS u rejestratora lub w Cloudflare: rekord `CNAME` dla subdomeny na adres wskazany przez Vercel (dla domeny głównej rekord `A` według instrukcji Vercela); przy DNS w Cloudflare rekord bez proxy (szara chmurka), żeby TLS i cache zostały po stronie Vercela.
3. Ustawienie nowej domeny jako głównej i przekierowanie 308 z adresu `*.vercel.app`.
4. Aktualizacja miejsc zależnych od adresu: dozwolone originy w CSP i CORS (`proxy.ts`), adresy przekierowań auth w Supabase (_Site URL_, _Redirect URLs_), domeny w Turnstile, PostHog i Sentry, zmienne typu adres bazowy w `.env.example` i w Vercelu, metadane (`metadataBase`, sitemap, Open Graph).
5. Sprawdzenie: logowanie, gra dnia, cron (ręczne wywołanie z nagłówkiem `Authorization: Bearer $CRON_SECRET` w środowisku podglądu), nagłówki bezpieczeństwa (`curl -I`), smoke Playwright na nowej domenie.

## Docelowo: współdzielony VPS

Zakres przenosin (Next.js poza Vercelem, baza i auth, Upstash, operacje) opisuje backlog. Warunki dla serwera `vps-waw` (OVH VPS-1, 4 GB RAM współdzielone z innymi projektami, zasady w `/opt/SERVER.md` na serwerze):

- Next.js jako `next start` z `output: "standalone"` w usłudze systemd z limitem pamięci, za reverse proxy z TLS; cron Vercela zastępuje timer systemd wołający endpoint z `CRON_SECRET`; sekrety w `/etc`, nie w repozytorium.
- Pojemność: Supabase self-hosted to zestaw kilku do kilkunastu kontenerów (Postgres, Auth, PostgREST, Realtime, Storage, Studio i inne). Przy 4 GB RAM dzielonych z innymi usługami to główne ryzyko; przed decyzją o przenosinach zmierzyć zużycie pamięci na próbnej instalacji (niesprawdzone) i rozważyć większy plan VPS, osobny serwer albo wariant bez pełnego Supabase.
- Utracone elementy platformy: CDN (możliwy Cloudflare przed serwerem), podglądy per PR, monitoring crona; kopie zapasowe bazy i test odtwarzania przechodzą na właściciela.
- Snapshot serwera przed każdą aktualizacją, zgodnie z zasadami serwera.

## Wymagane decyzje właściciela

- Osobna domena dla Eauxle czy subdomena wspólnej domeny `.pl`.
- Termin przenosin na VPS oraz wariant bazy i auth (Supabase self-hosted czy czysty PostgreSQL z osobną biblioteką auth).
- Czy przenosiny wymagają większego planu VPS (po pomiarze pojemności).

## Ryzyka i koszty

- Koszt: plan Vercela bez zmian do czasu przenosin; domena `.pl` to koszt roczny (osobna domena to osobny koszt); po przenosinach koszt VPS, ewentualnie wyższego planu.
- Zmiana domeny bez aktualizacji listy miejsc zależnych od adresu (sekcja „Własna domena na Vercelu”, punkt 4) psuje logowanie (przekierowania Supabase) i captchę (Turnstile); ta sama lista obowiązuje przy przenosinach.
- Zależność od dostawcy: funkcje specyficzne dla Vercela (cron, `unstable_cache`) utrudniają migrację; nie dokładać nowych.
