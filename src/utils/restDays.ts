/**
 * Rest days: any number of dates per child (a sick day, a trip). They used to
 * be a single `rest_day_date`, where setting a second one silently moved the
 * first; that column is still read so nothing set before the switch is lost.
 */
interface WithRestDays {
  rest_dates?: string[] | null;
  rest_day_date?: string | null;
}

export const isRestDate = (child: WithRestDays | null | undefined, date: string) =>
  !!child && (!!child.rest_dates?.includes(date) || child.rest_day_date === date);

/** The update that turns `date` into (or out of) a rest day, leaving the others alone. */
export const restDayUpdate = (child: WithRestDays, date: string, on: boolean) => {
  const current = new Set(child.rest_dates ?? []);
  if (child.rest_day_date) current.add(child.rest_day_date);
  if (on) current.add(date);
  else current.delete(date);
  return { rest_dates: [...current].sort(), rest_day_date: null };
};
