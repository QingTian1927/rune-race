# Client Architecture

This document describes how the frontend is structured today and which pieces are intended to stay thin when the backend is connected.

## Top-level routes

- `/` renders a simple landing page.
- `/game` renders the main game viewport and editor shell.

See `apps/web/src/App.tsx` for the route split.

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

The current frontend state is local and synchronous:

1. A user gesture updates React state in `GamePage`.
2. `BoardScene` receives the updated editor data.
3. The visualization and input handler re-render from that state.

When multiplayer backend integration starts, the ideal change is to swap the local state source for authoritative server snapshots while keeping the scene and editor components mostly unchanged.

## Local-only development features

The current client has a few features that are useful during frontend work but should not be mistaken for backend game flow:

- dev menu visibility via `F3`
- camera debug readout
- editor mode toggle between draw and camera
- export of the current editor layout JSON

These features are safe to keep even after backend integration.

## Where backend wiring will likely land

- socket setup and reconnect logic: `GamePage`
- authoritative room/game snapshots: a top-level client store or page state adapter
- snapshot-to-UI mapping: a game view model layer between socket data and `BoardScene`
- editor layout persistence: a dedicated editor save/load service
