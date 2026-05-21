# Runtime Flow

This is the practical path through the current client from load to interaction.

## Boot sequence

1. `apps/web/src/main.tsx` mounts the React app.
2. `apps/web/src/App.tsx` routes the user to `/` or `/game`.
3. `apps/web/src/pages/GamePage.tsx` initializes page state.
4. `apps/web/src/scenes/BoardScene.tsx` loads the 3D scene.
5. The board model and editor overlay become interactive after assets finish loading.

## Current page state

`GamePage` currently owns the following runtime state:

- `showDevMenu`
- `devMenuTab`
- `cameraDebugInfo`
- `isEditorActive`
- `cursorPos`
- `editorData`
- `editorMode`
- `editorSelectedPlayer`
- `editorMouseMode`
- `gameState` (local mock snapshot for current gameplay rendering)
- `rollTrigger` (local counter to trigger dice animation)

Derived presentation state:

- finish ranking list (from `gameState.events` where `event.type === 'token_finished'`)

This is the state to split later when the backend connection is added. The likely long-term shape is:

- connection/session state
- authoritative game state
- editor state
- ephemeral UI state

## Game state rendering

When a `GameState` is available (either from backend or mock snapshot), `BoardScene` passes it to `BoardPieces`.

`BoardPieces` renders:

1. **Houses**: Colored house models at each player's `home` bounding box
2. **Pawns**: Colored pawn models for each token, positioned based on token state:
	- `in_base`: Arranged in 2x2 grid inside player's `stable` bounding box
	- `on_track`: At corresponding main track point
	- `in_home_lane`: At corresponding home lane point
	- `finished`: At center of player's `home` box
3. **Movement animation**: Automatically animates pawns over ~300ms when token position changes
4. **3D models**: Loads pawn geometry asynchronously to avoid blocking initial render

The current mock engine initializes:

- 4 players (red, blue, green, yellow)
- 4 tokens per player (all start in base)
- deterministic turn lifecycle (`waiting_roll -> rolled|waiting_choice -> waiting_roll`)

## Local dice roll presentation flow

Current frontend behavior (before live backend wiring):

1. User clicks `Tung xúc xắc` in `GamePage`.
2. `GamePage` calls `rollMockTurn(currentState)` and increments `rollTrigger`.
3. `BoardScene` passes both `gameState` and `rollTrigger` to `DiceShaker`.
4. `DiceShaker` runs the bucket + die animation sequence.
5. Die settles to a mapped orientation for the rolled value while staying grounded on the board surface.
6. Bucket remains visible briefly after reveal (~2s), then fades out.
7. `GamePage` resolves the move by calling `resolveMockTurn` automatically, or waits for user choice if multiple legal moves exist.

When multiple legal moves exist, the client highlights selectable pawns with a small arrow marker (camera-facing). The player chooses by clicking a pawn; hovering a selectable pawn pulses the arrow.

## Current mock gameplay rules

The frontend mock engine in `apps/web/src/mock/mockGameEngine.ts` now enforces these rules:

- spawn is legal when dice is `1` or `6` (if entry square is valid)
- if dice is `1/6` and only spawn moves are legal, spawn is auto-resolved
- if multiple legal moves exist, turn enters `waiting_choice`
- capture emits explicit `token_captured` details (`from`, `to`) for capture animation
- player is marked as finished when all 4 tokens are in final zone (`in_home_lane` or `finished`)
- finished players are skipped on subsequent turns
- game ends when 3 players have finished

This is intentionally local-only for now and should be replaced by server-driven roll snapshots later.

## Camera and editor interaction

The scene currently uses `OrbitControls`.

- In normal gameplay, the camera behaves like a normal viewport camera.
- When the editor is active and mouse mode is `draw`, the controls are locked so dragging creates editor geometry instead of orbiting the camera.
- When the editor is active and mouse mode is `camera`, the controls behave normally again.

The important rule is that the scene should not guess game logic from camera behavior. It should only expose the current viewport state.

## Editor interaction flow

### Main track and home lane

1. User clicks in the scene.
2. The input handler raycasts against the stable interaction plane.
3. A board point is added to the selected lane or track.
4. The visualization redraws the updated path.

### Stable and home bounding boxes

1. User left-drags to define a box footprint.
2. The input handler computes the footprint and samples floor height.
3. A preview box appears while the drag is in progress.
4. On release, the box is committed to the selected player.
5. A right-drag rotates the most recently edited stable/home box.

### Deleting editor data

The editor panel exposes a Clear button that resets the current layout after confirmation.

## What should later be server-driven

The following pieces should eventually come from the backend instead of local-only React state:

- room membership
- current player/turn state
- token positions
- move legality
- dice rolls
- game lifecycle transitions
- persisted board layout

The current frontend already has the right seams to receive those values without rewriting the viewport.

For dice specifically, the long-term behavior is:

- backend sends authoritative `diceResult`
- frontend keeps only presentation timing and visuals (bucket shake, reveal, and fade-out)

## What should stay client-side

These behaviors are best kept local:

- transient hover previews
- drag gesture interpretation
- camera control state
- editor overlay rendering
- loading spinners and menu chrome

That separation keeps the client responsive while still allowing the backend to remain authoritative.
