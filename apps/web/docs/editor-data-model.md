# Editor Data Model

This document is the reference for the board editor layout data stored in the frontend.

## Main shape

The editor stores a `BoardLayoutData` object.

It contains:

- `meta`
- `mainTrack`
- `players`

## Meta fields

`meta` currently includes:

- `version`
- `players`
- `mainTrackSteps`
- `homeLaneStepsPerPlayer`
- `direction`

These values define the board rules the editor assumes while rendering and validating layout data.

## Main track points

`mainTrack` is an ordered list of points.

Each point has:

- `index`
- `x`
- `y`
- `z`

The editor renders the points as a path and uses them as the main board track.

## Player records

Each player record contains:

- `player`
- `startIndex`
- `homeEntryIndex`
- `homeLane`
- `stable`
- `home`

### Home lane

`homeLane` is an ordered list of points for the player's lane.

### Stable and home boxes

`stable` and `home` are optional bounding boxes used by the editor modes.

The bounding box shape is `BoxBounds`:

- `minX`
- `minY`
- `minZ`
- `maxX`
- `maxY`
- `maxZ`
- `rotationY` optional

The editor currently lets the user:

- left-drag to create a box
- right-drag to rotate the most recently edited box
- clear the current editor layout after confirmation

## Validation rules

The current validation helper checks:

- exactly 44 main track steps
- exactly 4 players
- exactly 5 home lane points per player

It does not yet enforce geometric correctness for box rotation or exact board placement.

## Serialization

The editor can export the full layout as JSON.

This makes it useful for:

- local persistence
- backend upload/save
- regression fixtures
- hand-authored board definitions

## Future backend use

The backend can reuse this same model for:

- stored board layouts
- a board editor save endpoint
- map publishing/importing
- validation before game start

If the backend eventually needs stricter validation, this file should stay aligned with the shared schema definitions in `packages/shared`.
