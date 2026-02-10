-- Migracja: Inicjalizacja RLS dla tabeli zagadek (puzzles)
-- Opis: Zapobiega wyciekowi przyszłych zagadek poprzez ograniczenie widoczności 
-- tylko do tych, których data jest mniejsza lub równa bieżącej.

-- 1. Włączenie RLS dla tabeli
ALTER TABLE public.puzzles ENABLE ROW LEVEL SECURITY;

-- 2. Polityka dla dostępu publicznego (anon)
-- Pozwala czytać tylko zagadki z przeszłości i dnia dzisiejszego
CREATE POLICY "Enable read for public for past and today"
ON public.puzzles
FOR SELECT
TO anon
USING ( date <= CURRENT_DATE );

-- 3. Polityka dla administratora (service_role)
-- Daje pełny dostęp do wszystkich wierszy
CREATE POLICY "Enable all for service_role"
ON public.puzzles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Komentarz: Dzięki tym zasadom, nawet jeśli ktoś przejmie NEXT_PUBLIC_SUPABASE_ANON_KEY,
-- nie będzie mógł pobrać zagadek na jutro ani na kolejne dni.
