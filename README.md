# Eauxle — Olfactory Deduction

Codzienna gra logiczna dla miłośników perfum. Odgadnij tajemniczy zapach na podstawie ewoluujących wskazówek.

## 🎮 O grze

**Eauxle** (wym. "oksle") to gra inspirowana Wordle, ale zamiast słów zgadujesz perfumy. Każdego dnia pojawia się nowy zapach do odgadnięcia, a z każdą próbą otrzymujesz coraz więcej wskazówek:

- 🏠 Marka i perfumiarz
- 📅 Rok wydania
- 🎵 Nuty zapachowe (góra, serce, baza)
- 🖼️ Grafika (stopniowo wyostrzana)

## 🚀 Uruchomienie

### Wymagania

- Node.js 20+
- pnpm

### Instalacja

```bash
# Zainstaluj zależności
pnpm install

# Uruchom serwer deweloperski
pnpm dev
```

Aplikacja będzie dostępna pod adresem [http://localhost:3000](http://localhost:3000).

### Zmienne środowiskowe

Utwórz plik `.env.local` z wymaganymi zmiennymi, na podstawie `.env.example`.

## 🛠️ Stack technologiczny

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Shadcn/UI, Radix Primitives
- **Styling**: Tailwind CSS v4 (OKLCH colors)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Deployment**: Vercel

## 📁 Struktura projektu

```
fragrance-webapp/
├── app/                 # Next.js App Router
│   ├── [locale]/       # Locale routing (en, pl)
│   ├── actions/        # Server Actions
│   └── api/            # API routes
├── components/
│   ├── game/           # Komponenty gry
│   ├── ui/             # Shadcn/UI components
│   └── providers/      # Context providers
├── hooks/              # Custom React hooks
├── lib/
│   ├── supabase/       # Klienty Supabase (client/server)
│   ├── game/           # Logika gry (scoring, reveal)
│   └── utils.ts        # Utility functions
├── messages/           # Tłumaczenia (en.json, pl.json)
└── public/             # Statyczne assety
```

## 🎨 Design System

Projekt używa estetyki "Elegant French Perfumery":

- **Paleta**: Amber, Cream, Charcoal
- **Fonty**:
  - Geist Sans (body)
  - Playfair Display (nagłówki)
  - Caveat (akcenty odręczne)

## 📜 Licencja

MIT License - zobacz [LICENSE](./LICENSE)
