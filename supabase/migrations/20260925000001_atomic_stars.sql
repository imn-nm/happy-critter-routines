-- Star movements happen in one transaction each, so a dropped request or two
-- parents acting at once can't leave a reward approved but unpaid, or take
-- stars back twice. All functions are SECURITY INVOKER: household RLS on
-- children / task_completions / reward_purchases still decides who may call
-- them for which child.

-- The balance primitive, already live but never checked in. Floors at 0.
create or replace function public.adjust_child_coins(p_child_id uuid, p_delta integer)
returns integer
language sql
as $$
  update public.children
  set current_coins = greatest(0, coalesce(current_coins, 0) + p_delta)
  where id = p_child_id
  returning current_coins;
$$;

-- ── One "done" per task per day ─────────────────────────────────────────
-- Double taps and a parent marking done while the child does left duplicate
-- rows. Keep the one carrying stars (else the earliest) and enforce it.
delete from public.task_completions
where id in (
  select id from (
    select id, row_number() over (
      partition by task_id, date
      order by coalesce(coins_earned, 0) desc, completed_at, id
    ) as rn
    from public.task_completions
    where date is not null
  ) ranked
  where rn > 1
);

create unique index if not exists task_completions_task_date_key
  on public.task_completions (task_id, date);

-- ── One built-in row per child ──────────────────────────────────────────
-- The app finds built-in rows by name. Two devices opening at once used to
-- insert twice, and a cleanup then deleted the extras, sometimes a parent's
-- own "Lunch" task with its history. With this index the duplicate can't
-- exist, so nothing ever needs deleting.
create unique index if not exists tasks_one_builtin_per_child
  on public.tasks (child_id, name)
  where name in ('Wake Up', 'Breakfast', 'School', 'Lunch', 'Dinner', 'Bedtime');

-- ── Give ★ ─────────────────────────────────────────────────────────────
-- Records the gift and pays it together. Returns the new balance, or null
-- when stars were already given for this completion (or it was undone).
create or replace function public.give_completion_stars(p_completion_id uuid, p_stars integer)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_child uuid;
  v_balance integer;
begin
  if p_stars is null or p_stars <= 0 then
    raise exception 'stars_must_be_positive';
  end if;

  update task_completions
     set coins_earned = p_stars
   where id = p_completion_id
     and coalesce(coins_earned, 0) = 0
  returning child_id into v_child;
  if not found then
    return null;
  end if;

  update children
     set current_coins = coalesce(current_coins, 0) + p_stars
   where id = v_child
  returning current_coins into v_balance;
  return v_balance;
end;
$$;

-- ── Undo "done" ────────────────────────────────────────────────────────
-- Deletes the completion and takes back exactly the stars it carried, only
-- if this call is the one that deleted it. Returns null when it was already
-- gone, else {"stars_back": n, "balance": b}.
create or replace function public.undo_task_completion(p_completion_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_child uuid;
  v_stars integer;
  v_balance integer;
begin
  delete from task_completions
   where id = p_completion_id
  returning child_id, coalesce(coins_earned, 0) into v_child, v_stars;
  if not found then
    return null;
  end if;

  if v_stars > 0 then
    update children
       set current_coins = greatest(0, coalesce(current_coins, 0) - v_stars)
     where id = v_child
    returning current_coins into v_balance;
  else
    select current_coins into v_balance from children where id = v_child;
  end if;
  return jsonb_build_object('stars_back', v_stars, 'balance', v_balance);
end;
$$;

-- ── Rewards ────────────────────────────────────────────────────────────
-- Errors are raised with a fixed message the app maps to friendly copy:
--   already_handled, not_enough_stars, reward_not_found.

create or replace function public.approve_reward_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  p reward_purchases%rowtype;
  v_balance integer;
begin
  select * into p from reward_purchases where id = p_purchase_id for update;
  if not found or p.status <> 'pending' then
    raise exception 'already_handled';
  end if;

  select coalesce(current_coins, 0) into v_balance
    from children where id = p.child_id for update;
  if v_balance < p.coins_spent then
    raise exception 'not_enough_stars' using detail = v_balance::text;
  end if;

  update reward_purchases set status = 'approved' where id = p.id
  returning * into p;
  update children set current_coins = v_balance - p.coins_spent
   where id = p.child_id
  returning current_coins into v_balance;
  return jsonb_build_object('purchase', to_jsonb(p), 'balance', v_balance);
end;
$$;

create or replace function public.refund_reward_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  p reward_purchases%rowtype;
  v_balance integer;
begin
  update reward_purchases set status = 'refunded'
   where id = p_purchase_id and status in ('approved', 'completed')
  returning * into p;
  if not found then
    raise exception 'already_handled';
  end if;

  update children set current_coins = coalesce(current_coins, 0) + p.coins_spent
   where id = p.child_id
  returning current_coins into v_balance;
  return jsonb_build_object('purchase', to_jsonb(p), 'balance', v_balance);
end;
$$;

-- Parent redeems on the child's behalf: record an approved purchase and pay
-- for it in one go.
create or replace function public.redeem_reward_for_child(p_reward_id uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  r rewards%rowtype;
  p reward_purchases%rowtype;
  v_balance integer;
begin
  select * into r from rewards where id = p_reward_id and is_active;
  if not found then
    raise exception 'reward_not_found';
  end if;

  select coalesce(current_coins, 0) into v_balance
    from children where id = r.child_id for update;
  if v_balance < r.cost then
    raise exception 'not_enough_stars' using detail = v_balance::text;
  end if;

  insert into reward_purchases (child_id, reward_id, coins_spent, status)
  values (r.child_id, r.id, r.cost, 'approved')
  returning * into p;
  update children set current_coins = v_balance - r.cost
   where id = r.child_id
  returning current_coins into v_balance;
  return jsonb_build_object('purchase', to_jsonb(p), 'balance', v_balance);
end;
$$;

-- Signed-in parents only.
revoke all on function public.give_completion_stars(uuid, integer) from public, anon;
revoke all on function public.undo_task_completion(uuid) from public, anon;
revoke all on function public.approve_reward_purchase(uuid) from public, anon;
revoke all on function public.refund_reward_purchase(uuid) from public, anon;
revoke all on function public.redeem_reward_for_child(uuid) from public, anon;
grant execute on function public.give_completion_stars(uuid, integer) to authenticated;
grant execute on function public.undo_task_completion(uuid) to authenticated;
grant execute on function public.approve_reward_purchase(uuid) to authenticated;
grant execute on function public.refund_reward_purchase(uuid) to authenticated;
grant execute on function public.redeem_reward_for_child(uuid) to authenticated;
