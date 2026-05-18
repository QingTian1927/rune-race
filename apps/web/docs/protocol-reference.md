# Protocol Reference

This file mirrors the current shared socket contract and explains how the frontend should use it.

The authoritative definitions live in `packages/shared/src/protocol/events.ts` and `packages/shared/src/schemas/events.ts`.

## Client to server intents

The frontend should emit intents only, never direct state updates.

### `game:join`

Use this to join a room. The backend should treat it as the first required step after socket connection.

### `game:start`

Use this when a host starts a room.

### `game:roll`

Use this to request a dice roll on the current turn.

### `game:choose_move`

Use this to choose one of the legal moves returned by the backend.

### `game:sync_request`

Use this after reconnecting or when the client needs a full authoritative snapshot.

### `game:ping`

Use this as a lightweight liveness check if the backend wants one.

## Server to client snapshots and events

### `game:connected`

Use this to confirm the socket is associated with a player and room.

### `game:room_snapshot`

Use this for lobby state and room metadata before gameplay begins.

### `game:state_snapshot`

Use this as the authoritative gameplay snapshot after every meaningful server action.

The client should render from the snapshot and use the attached recent events for animation or reconciliation.

### `game:error`

Use this to report invalid actions or rejected commands.

### `game:turn_timeout_warning`

Use this to warn the active player that the turn timer is nearly expired.

## Client expectations

When the frontend receives a snapshot, it should:

- replace stale local assumptions
- render the current state directly
- avoid guessing legal moves from client-only logic
- request sync again if it detects a mismatch after reconnect

## Backend expectations

When the backend receives an intent, it should:

- validate the payload
- reject invalid phase or turn ownership
- emit an error if the command is not legal
- publish a fresh snapshot after accepted actions

## Versioning note

If the socket contract changes later, update this file together with the shared protocol types so the frontend docs and the code stay aligned.
