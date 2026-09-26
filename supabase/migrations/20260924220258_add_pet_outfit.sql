-- What the child's rabbit is wearing, picked in Playtime's dress-up. Stored on
-- the child so the outfit shows everywhere the pet appears: the child's
-- screen, the parent dashboard and any other device in the household.
-- A JSON object of slot -> accessory id, e.g. {"head":"hat","neck":"scarf"};
-- null means no outfit.
alter table public.children
  add column if not exists pet_outfit jsonb;
