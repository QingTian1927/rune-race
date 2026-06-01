-- Analytics tables are written only by the game server (service role).
-- Explicit deny policies for authenticated/anon clients.

drop policy if exists "player_session_events_deny_all" on public.player_session_events;
create policy "player_session_events_deny_all"
  on public.player_session_events
  for all
  to authenticated, anon
  using (false)
  with check (false);

drop policy if exists "player_metrics_hourly_deny_all" on public.player_metrics_hourly;
create policy "player_metrics_hourly_deny_all"
  on public.player_metrics_hourly
  for all
  to authenticated, anon
  using (false)
  with check (false);

drop policy if exists "analytics_live_counters_deny_all" on public.analytics_live_counters;
create policy "analytics_live_counters_deny_all"
  on public.analytics_live_counters
  for all
  to authenticated, anon
  using (false)
  with check (false);
