# Backend Integration Contract

This document describes what the frontend expects from the backend and what the backend should be able to rely on from the frontend.

The goal is to make future wiring straightforward in both directions:

- the backend can publish authoritative snapshots and events
- the frontend can send user intent without guessing game rules

## Source of truth

The backend must remain authoritative for:

- room membership
- lobby readiness
- game start and end
- turn order
- dice rolls
- legal move generation
- token movement
- persisted game state

The frontend should treat server snapshots as truth and render from them.

## Existing shared protocol

The repository already has shared protocol definitions in `packages/shared`:

- `packages/shared/src/protocol/events.ts`
- `packages/shared/src/schemas/events.ts`
- `packages/shared/src/schemas/game.ts`
- `packages/shared/src/types/game.ts`

These files are the canonical place to extend when the backend and frontend need to agree on new payloads.

## Current WebSocket intent surface

The existing shared protocol already describes these client intents:

- `game:join`
- `game:start`
- `game:roll`
- `game:choose_move`
- `game:sync_request`
- `game:ping`

And these server-to-client events:

- `game:connected`
- `game:room_snapshot`
- `game:state_snapshot`
- `game:error`
- `game:turn_timeout_warning`

## How the frontend should consume backend data

### Lobby and connection

The frontend should be able to render:

- connection state
- room ID
- player list
- host badge
- ready/start availability
- errors from the server

### Gameplay

The frontend should be able to render:

- current player
- dice result
- legal moves
- token positions and states
- animation events from recent history
- winner or finished-state summary

The frontend **currently renders**:

- token positions based on state (in_base, on_track, in_home_lane, finished)
- player houses in colored house models
- pawns with smooth movement animation when positions update

These are already wired to accept a `GameState` object. When the backend connection is ready, the socket layer simply needs to push new `GameState` snapshots to `BoardScene`, and the rendering will automatically update.

### Editor and layout data

The editor state is separate from the live match state, but the backend may still want to persist or load board layouts.

The client can already export a full JSON board layout from the editor panel. That JSON is the easiest format for a backend save/load endpoint or socket action.

## Suggested handshake flow

1. Frontend opens a socket connection.
2. Frontend emits `game:join` or restores a session with `game:sync_request`.
3. Backend answers with `game:connected` and either `game:room_snapshot` or `game:state_snapshot`.
4. Frontend renders the snapshot and keeps listening for authoritative updates.
5. User actions are sent back as intents only.

## Suggested integration boundary in the client

When backend work starts, keep the network code outside the viewport components.

Good places for the socket adapter are:

- a top-level game store
- a dedicated socket service module
- a page-level controller that maps snapshots to component props

Avoid putting socket calls directly inside the 3D components unless the interaction is extremely local.

## Minimal backend responsibilities for the current client

To get the current client working against a backend, the backend should at least provide:

- a join endpoint or socket event
- authoritative room snapshot payloads
- authoritative game state payloads
- reconnect sync support
- command validation and error reporting

If the backend can satisfy those responsibilities, the current frontend can be wired without redesigning the viewport.
