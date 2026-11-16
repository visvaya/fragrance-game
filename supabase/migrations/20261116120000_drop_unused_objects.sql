-- Drop schema objects that nothing uses, so the schema holds only what the app, the ETL, the
-- scripts and the tests need. Every table below is empty on production, and no code, view,
-- function, trigger or policy outside this set refers to any of them. They belong to features
-- that were never built (player profiles, teams, seasons, streak freezes, recovery keys,
-- normalized notes and perfumers, brand aliases, perfume revisions and source URLs); a feature
-- that comes back gets its own migration then. The functions are leftovers: handle_new_user()
-- is attached to no trigger (auto_create_player() does its job), and the extensions_* wrappers
-- have no callers.
-- No CASCADE: an unexpected dependency must stop the migration. Policies, indexes and
-- constraints of a dropped table go with it; the order drops referencing tables first.

DROP TABLE public.player_profiles;
DROP TABLE public.teams;
DROP TABLE public.seasons;
DROP TABLE public.streak_freezes;
DROP TABLE public.recovery_keys;
DROP TABLE public.perfume_notes;
DROP TABLE public.notes;
DROP TABLE public.perfume_perfumers;
DROP TABLE public.perfumers;
DROP TABLE public.brand_aliases;
DROP TABLE public.brand_aliases_etl;
DROP TABLE public.perfume_revisions;
DROP TABLE public.perfume_source_urls;

DROP FUNCTION public.handle_new_user();
DROP FUNCTION public.extensions_dmetaphone(text);
DROP FUNCTION public.extensions_f_unaccent(text);
