# Client integration

How the **web app** (`apps/web`) connects to this server today.

## Routes

| Path | Page | Socket / HTTP |
|------|------|----------------|
| `/` | `HomePage` | HTTP rooms + matchmaking + feature flags |
| `/guide` | `GuidePage` | Static |
| `/auth/login` | `AuthLoginPage` | Supabase email/password, Google, anonymous sign-in |
| `/auth/signup` | `AuthSignupPage` | Supabase email/password signup |
| `/profile/:profileId` | `ProfileViewPage` | Public profile fetch |
| `/profile/edit` | `ProfileEditPage` | Authenticated profile update |
| `/lobby/:lobbyId` | `LobbyPage` | `lobby:*` |
| `/game/:gameId` | `OnlineGamePage` | `game:*`, `chat:*`, re-joins `lobby:*` |
| `/play/local` | `LocalGamePage` | No server (engine only) |

## Client modules

| File | Role |
|------|------|
| `lib/api.ts` | `fetch` wrappers for `/api/rooms`, matchmaking, profile, feature flags |
| `lib/socket.ts` | Singleton `socket.io-client` + Supabase access token handshake |
| `lib/supabase.ts` | Supabase client configured from Vite env |
| `hooks/useAuth.tsx` | Session state, email/password, Google, anonymous auth |
| `hooks/usePlayerIdentity.ts` | Player id/name derived from Supabase session or guest storage |
| `lib/playerSession.ts` | Guest `playerId` + display name in `localStorage` |
| `hooks/useLobbySocket.ts` | Lobby snapshot + commands + `lobby:host_secrets` |
| `hooks/useGameSocket.ts` | Game snapshots + roll/choose + rune commands + `runeView` |
| `hooks/useRoomChat.ts` | Lobby chat |
| `hooks/usePresentationGameState.ts` | Dice animation gate before applying moves |
| `hooks/useUiSoundEffects.ts` | Global UI click / hover SFX (all routes) |
| `hooks/useAudioSettings.ts` | Persisted master volume (`rune-race-audio-volume`) |
| `lib/audio/audioManager.ts` | Client-only SFX playback (no server involvement) |

## Suggested UI states

- `disconnected` / `connecting`
- `signed_in` / `guest` (from `useAuth`)
- `lobby` | `countdown` | `in_game` (from `LobbySnapshot.status`)
- `playing` | `finished` (from `GameState.status`)
- Rune phases: `waiting_draw` | `placement_phase` | `waiting_roll` | `waiting_choice` | `waiting_swap_choice`
- `error` (from `lobby:error` / `game:error` / `chat:error`)

## Minimal socket sequence (online)

1. `POST /api/rooms` or join via code → navigate to `/lobby/:lobbyId`.
2. Connect socket; `lobby:join` with `playerId`, `playerName`, `lobbyId` or `joinCode`.
   - If a Supabase session exists, the socket sends `auth: { token }` in the handshake.
3. `lobby:set_color`, `lobby:ready` until countdown → `lobby:game_started`.
4. `sessionStorage.setItem('rune-race-lobby-id', lobbyId)`; navigate to `/game/:gameId`.
5. `game:join`; render from `game:state_snapshot` + `runeView`.
6. **Rune turn:** draw → place markers → roll (see [Rune system](./rune-system.md)).
7. On roll snapshot with `dice_roll` in delta: run dice animation (~3s), then apply full state (see web `lib/dicePresentation.ts`).
8. If `waiting_choice` and multiple moves: show 3D selection arrows **only for `localPlayerId`**. Send `game:choose_move` with chosen `moveId`.
9. If `waiting_swap_choice`: select swap target → `game:choose_swap`.
10. `game:roll` / rune commands only when phase and player id allow.
11. **Chat:** `chat:sync_request` on connect; `chat:send` from in-game panel.
12. **HUD timing (client-only):** current-turn and finish-order panels update after dice/token animations.
13. **Audio (client-only):** SFX are driven by presentation (dice phases, pawn impacts, UI). Master volume is stored in `localStorage`; no socket events. See [Web audio](../../web/docs/audio.md).

## Profile flow

1. Anonymous users can sign in through Supabase anonymous auth from `AuthLoginPage`.
2. `ProfileEditPage` loads the authenticated profile with `GET /api/profile`.
3. `ProfileViewPage` fetches public data with `GET /api/profile/:id`.
4. `AuthSignupPage` can link an anon profile into a new registered account with `POST /api/auth/link-anon`.

## LAN / second device

1. Run server with `host: 0.0.0.0` (default in `index.ts`).
2. Run web with `pnpm dev --host`.
3. Other device: open `http://<host-lan-ip>:5173`.
4. Optional: set `VITE_API_URL=http://<host-lan-ip>:3000` if not using Vite proxy.

**Note:** `crypto.randomUUID` requires HTTPS or localhost. The client falls back to `getRandomValues` on plain HTTP LAN (see `playerSession.ts`).

## Reconnect

- Lobby: `lobby:sync_request`
- Game: `game:sync_request`
- Chat: `chat:sync_request`

## What not to do

- Do not treat client-derived legal moves as truth online.
- Do not infer opponent marker card types from `state.rune.markers` — use `runeView` for your markers only.
- Do not animate token moves from full `events` history on every snapshot — use delta + `tokenMotion.ts` version cursor.
- Do not show opponent move-selection arrows to all clients — pass `localPlayerId` into `GameView`.
- Do not add server events for HUD-only concerns unless the gameplay contract changes.
- Do not add server events or snapshots for sound effects — the client plays SFX from delta `events` and local UI interaction only.
- Do not assume profile ownership from `playerId` alone when a Supabase session is present.

## Client HUD (reference)

The web client documents the overlay in [Web architecture — GameView](../../web/docs/architecture.md#gameview), [Runtime flow — HUD timing](../../web/docs/runtime-flow.md#hud-timing), and [Rune system (client)](../../web/docs/rune-system.md). **Audio** is also client-only — [Web audio](../../web/docs/audio.md). Server behavior is unchanged; snapshots + delta `events` + `runeView` remain the only gameplay inputs.

## Related web docs

- [Web architecture](../../web/docs/architecture.md)
- [Web audio](../../web/docs/audio.md)
- [Backend integration (web)](../../web/docs/backend-integration.md)
- [Protocol reference (web)](../../web/docs/protocol-reference.md)
