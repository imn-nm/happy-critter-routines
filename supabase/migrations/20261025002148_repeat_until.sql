-- repeat_until: the last day a repeating task runs ("every Monday until
-- Dec 20"). Null repeats on with no end.
alter table public.tasks
  add column if not exists repeat_until date;
