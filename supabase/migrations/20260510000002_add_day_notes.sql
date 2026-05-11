-- Per-day free-text notes (parent-only). One note per child per day.
CREATE TABLE IF NOT EXISTS public.day_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  date date NOT NULL,
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (child_id, date)
);

CREATE INDEX IF NOT EXISTS day_notes_child_date_idx ON public.day_notes (child_id, date);

ALTER TABLE public.day_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can view their children's day notes"
  ON public.day_notes FOR SELECT
  USING (
    child_id IN (
      SELECT id FROM public.children WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can insert their children's day notes"
  ON public.day_notes FOR INSERT
  WITH CHECK (
    child_id IN (
      SELECT id FROM public.children WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can update their children's day notes"
  ON public.day_notes FOR UPDATE
  USING (
    child_id IN (
      SELECT id FROM public.children WHERE parent_id = auth.uid()
    )
  );

CREATE POLICY "Parents can delete their children's day notes"
  ON public.day_notes FOR DELETE
  USING (
    child_id IN (
      SELECT id FROM public.children WHERE parent_id = auth.uid()
    )
  );
