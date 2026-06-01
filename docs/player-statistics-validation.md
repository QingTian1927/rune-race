# Player Statistics Validation Checklist

This checklist validates Player Statistics v1 (hybrid mode) after deployment.

Admin analytics are exposed only via server HTTP APIs (`/api/admin/analytics/*`), guarded by `ADMIN_USER_IDS`. There is no admin UI in the game client (`apps/web`); use a separate admin app or API client for validation.

## 1) Realtime Live Counters

- Open two different accounts, join the same lobby.
- Call `GET /api/admin/analytics/live` with an admin token.
- Verify:
  - `onlineNow` increases when each user joins.
  - `activeLobbies` increases when a lobby has at least one player.
  - `activeGames` increases only after countdown completes and game starts.
- Disconnect one client and verify `onlineNow` drops within 5 seconds.

## 2) Event Log Integrity

- Query `player_session_events` and verify event sequence for one player:
  - `session_started`
  - `presence_connected`
  - `lobby_joined`
  - `game_started` (optional)
  - `presence_disconnected` on socket disconnect (session may continue during lobby grace)
  - `session_ended` on explicit leave or disconnect timeout (not on brief disconnect alone)
- Verify `metadata.playSeconds` exists on `session_ended`.
- After rollup, `session_ended` rows should have `metadata.profile_stats_applied: true`.

## 3) Hourly Rollup Correctness

- Wait at least one rollup interval (default 60s) after sessions end.
- Call `GET /api/admin/analytics/timeseries`.
- Verify for latest bucket:
  - `unique_players` matches distinct players from raw events.
  - `games_started` and `games_finished` match raw event counts.
  - `total_play_seconds` equals sum of `session_ended.metadata.playSeconds`.

## 4) Profile Stats Sync

- Play one match to completion with two registered users.
- Verify `profiles` values changed:
  - `total_games` increments by 1 for each participant.
  - Winner increments `total_wins`.
  - Non-winner increments `total_losses`.
  - `total_played_seconds` increases after rollup/session end.

## 5) Security and Access Control

- With non-admin token, call all `/api/admin/analytics/*` routes and verify `403`.
- With admin token from `ADMIN_USER_IDS`, verify routes return `200`.
- Ensure analytics tables are not writable from public client keys.
