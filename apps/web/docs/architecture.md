# Client Architecture

This document describes how the frontend is structured today and which pieces are intended to stay thin when the backend is connected.

## Top-level routes

- `/` renders a simple landing page.
- `/game` renders the main game viewport and editor shell.

See `apps/web/src/App.tsx` for the route split.

## Rendering layers

### Board Model

`apps/web/src/components/BoardModel.tsx` renders the static 3D board geometry.

It currently renders:

- board surface
- main track markers
- player home markers
- stable and home bounding box outlines

### Board Pieces

`apps/web/src/components/BoardPieces.tsx` renders dynamic game elements.

It currently renders:

- player houses: colored house models in the `home` bounding box for each player
- pawns: colored pawn models positioned based on token state:
	- `in_base`: arranged in a 2x2 grid inside the `stable` bounding box
	- `on_track`: positioned at main track points
	- `in_home_lane`: positioned at home lane points
	- `finished`: positioned at center of home box

The component automatically animates pawn movement when token positions change in the game state.

It also supports capture-specific feedback:

- brief hit/smoke-like visual at capture point
- captured pawn return-to-base arc (instead of instant teleport)

### Dice Shaker

`apps/web/src/components/DiceShaker.tsx` renders the dice roll presentation layer.

It currently renders:

- a bucket model and a die model loaded from `apps/web/assets/models`
- a local animation state machine (`appearing -> shaking -> lifting -> revealing -> finished`)
- face-to-rotation mapping for the die result (with face `6` as the default top orientation)
- post-reveal bucket hold (about 2 seconds) and fade-out

Key constraints in the current implementation:

- die position is anchored to the dice spawn center from layout data
- die vertical placement is corrected from model bounds so the die stays in contact with the board surface while rotating
- bucket animation is visual-only and does not affect authoritative game logic

## Runtime layers

### Page layer

`apps/web/src/pages/GamePage.tsx` owns the page-level state.

It currently holds:

- dev menu visibility
- camera debug state
- editor active/inactive state
- editor layout data
- editor mode and selected player
- editor mouse mode (`draw` or `camera`)

This page is the best place to attach future socket/session state.

Additional local gameplay presentation state currently owned by `GamePage`:

- local mock `gameState` used by the current dice roll presentation
- local `rollTrigger` counter used to start dice animation from UI intent
- finish-order panel data derived from `gameState.events` (`token_finished` events)

### Scene layer

`apps/web/src/scenes/BoardScene.tsx` owns the 3D viewport and rendering behavior.

It currently composes:

- the Three.js canvas
- the board model
- the invisible editor interaction plane
- orbit controls
- the editor visualization overlay
- the editor input handler

The scene layer should stay focused on rendering and input dispatch, not networking.

It receives an optional `gameState` prop:

- If provided, it renders that game state's tokens and players
- If not provided, it renders a mock snapshot for development

It also receives a local `rollTrigger` prop used by `DiceShaker` to trigger dice animation timing.

### Editor layer

The editor is split into two pieces:

- `apps/web/src/components/BoardEditor.tsx` renders the control panel.
- `apps/web/src/components/BoardEditorInputHandler.tsx` converts mouse/keyboard gestures into layout changes.

This separation is deliberate:

- the controls panel can change editor state without knowing Three.js details
- the input handler can mutate board data without owning UI chrome

### Visualization layer

`apps/web/src/components/BoardEditorVisualization.tsx` renders the editable board overlays.

It currently draws:

- main track points and lines
- per-player home lane points and lines
- stable and home bounding boxes
- preview geometry while drawing a box

This layer should remain a pure visual projection of editor state.

## Shared data flow

The current frontend state architecture:

- **Local development**: Uses `getMockSnapshot()` to generate a test game state with 4 players and sample token distributions
- **Local dice flow**: `GamePage` uses `rollMockTurn`/`resolveMockTurn` on the same state and increments `rollTrigger`
- **With backend**: Will receive authoritative `GameState` via socket and pass it to `BoardScene`
- **Rendering**: `BoardScene` composes `BoardModel` (static board), `BoardPieces` (dynamic tokens), and `DiceShaker` (dice presentation)
- **Editor**: Remains client-side local state, separate from game state

Current local mock rules now include:

- spawn on dice `1` or `6`
- auto-spawn when no non-spawn legal move exists
- finish ranking tracked in events
- skipping finished players
- game end after 3 players finish

The key design is that `BoardScene` accepts both `gameState` (optional) and `editorData` (optional), allowing:

- Pure editor mode (render board layout being edited)
- Pure game mode (render live game with tokens)
- Hybrid mode (rare, for debug/preview)

When multiplayer backend integration completes, the socket layer will simply replace the mock snapshot source with real server snapshots.

## Local-only development features

The current client has a few features that are useful during frontend work but should not be mistaken for backend game flow:

- dev menu visibility via `F3`
- camera debug readout
- editor mode toggle between draw and camera
- export of the current editor layout JSON
- local roll button that drives a mock dice presentation (not authoritative game logic)

These features are safe to keep even after backend integration.

## Where backend wiring will likely land

- socket setup and reconnect logic: `GamePage`
- authoritative room/game snapshots: a top-level client store or page state adapter
- snapshot-to-UI mapping: a game view model layer between socket data and `BoardScene`
- editor layout persistence: a dedicated editor save/load service
