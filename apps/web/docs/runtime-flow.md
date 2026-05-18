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

This is the state to split later when the backend connection is added. The likely long-term shape is:

- connection/session state
- authoritative game state
- editor state
- ephemeral UI state

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

## What should stay client-side

These behaviors are best kept local:

- transient hover previews
- drag gesture interpretation
- camera control state
- editor overlay rendering
- loading spinners and menu chrome

That separation keeps the client responsive while still allowing the backend to remain authoritative.
