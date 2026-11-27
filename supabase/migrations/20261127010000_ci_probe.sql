-- Temporary probe that makes the "Base code on the new schema" job run; removed before merge.
-- A breaking rename: the base code's daily challenge query still selects grace_deadline_at_utc.
ALTER VIEW public.daily_challenges_public RENAME COLUMN grace_deadline_at_utc TO grace_deadline;
