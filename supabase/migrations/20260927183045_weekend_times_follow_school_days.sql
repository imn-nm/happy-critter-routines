-- Weekend times are stored once per row, under `weekend`. Which days use it
-- now follows the child's school days (see usesWeekendTime in
-- src/utils/systemTasks.ts): wake-up and meals on days off (Saturday, Sunday),
-- bedtime on the night before a day off (Friday, Saturday), so Sunday night
-- stays an early night before school. Breakfast has no weekend time of its
-- own any more: it follows wake-up.
update children set
  wake_schedule_overrides = case
    when wake_schedule_overrides ? 'saturday' or wake_schedule_overrides ? 'sunday'
      then (wake_schedule_overrides - 'saturday' - 'sunday')
        || jsonb_build_object('weekend', coalesce(wake_schedule_overrides -> 'saturday', wake_schedule_overrides -> 'sunday'))
    else wake_schedule_overrides end,
  lunch_schedule_overrides = case
    when lunch_schedule_overrides ? 'saturday' or lunch_schedule_overrides ? 'sunday'
      then (lunch_schedule_overrides - 'saturday' - 'sunday')
        || jsonb_build_object('weekend', coalesce(lunch_schedule_overrides -> 'saturday', lunch_schedule_overrides -> 'sunday'))
    else lunch_schedule_overrides end,
  dinner_schedule_overrides = case
    when dinner_schedule_overrides ? 'saturday' or dinner_schedule_overrides ? 'sunday'
      then (dinner_schedule_overrides - 'saturday' - 'sunday')
        || jsonb_build_object('weekend', coalesce(dinner_schedule_overrides -> 'saturday', dinner_schedule_overrides -> 'sunday'))
    else dinner_schedule_overrides end,
  bedtime_schedule_overrides = case
    when bedtime_schedule_overrides ? 'saturday' or bedtime_schedule_overrides ? 'sunday'
      then (bedtime_schedule_overrides - 'saturday' - 'sunday')
        || jsonb_build_object('weekend', coalesce(bedtime_schedule_overrides -> 'saturday', bedtime_schedule_overrides -> 'sunday'))
    else bedtime_schedule_overrides end,
  breakfast_schedule_overrides = breakfast_schedule_overrides - 'saturday' - 'sunday'
where wake_schedule_overrides ?| array['saturday', 'sunday']
   or lunch_schedule_overrides ?| array['saturday', 'sunday']
   or dinner_schedule_overrides ?| array['saturday', 'sunday']
   or bedtime_schedule_overrides ?| array['saturday', 'sunday']
   or breakfast_schedule_overrides ?| array['saturday', 'sunday'];
