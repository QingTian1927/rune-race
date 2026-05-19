# Web Client Docs

This folder documents the frontend game client so the UI can be wired to the backend later without re-discovering the app structure.

## Read first

1. [Client Architecture](./architecture.md)
2. [Runtime Flow](./runtime-flow.md)
3. [Backend Integration Contract](./backend-integration.md)
4. [Editor Data Model](./editor-data-model.md)
5. [Protocol Reference](./protocol-reference.md)

## Scope

- The current app is a Vite + React + TypeScript frontend in `apps/web`.
- It already renders a game viewport and a board editor.
- It does not yet own the live multiplayer backend connection.
- These docs describe the client surfaces the backend will eventually need to feed.

## Current rendering capabilities

- **3D board**: Static board geometry with track markers and player zones
- **Player houses**: Colored house models positioned in each player's home zone
- **Pawns**: 3D pawn models that position based on token state and animate when tokens move
- **Board editor**: Interactive 2D editor for designing board layouts with track and zone positioning
- **Mock game state**: Fully functional mock `GameState` generator for development and testing

## Related backend docs

- [Server contract index](../../server/docs/index.md)
- [Frontend rebuild notes](../../server/docs/frontend-rebuild-notes.md)

## Good starting points in code

- `apps/web/src/App.tsx`
- `apps/web/src/pages/GamePage.tsx`
- `apps/web/src/scenes/BoardScene.tsx`
- `apps/web/src/components/BoardEditor.tsx`
- `packages/shared/src/protocol/events.ts`
- `packages/shared/src/schemas/events.ts`
- `packages/shared/src/types/game.ts`
