-- Pet picker is locked to "fox" — only fox art exists. Normalize any existing
-- panda/owl/penguin rows so the parent portal and child view stay in sync.
UPDATE public.children SET pet_type = 'fox' WHERE pet_type <> 'fox';
