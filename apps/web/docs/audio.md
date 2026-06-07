# Audio (client SFX)

All sound effects are **client-only**. The server does not stream or validate audio; clips play from local presentation timing and UI interaction.

## Assets

Bundled under `apps/web/assets/audio/` (imported via Vite in `lib/audio/audioCatalog.ts`):

| File | `SoundId` | Trigger |
|------|-----------|---------|
| `click.m4a` | `ui.click` | Pointer / keyboard activation on interactive UI |
| `hover.m4a` | `ui.hover` | Entering a new interactive control (desktop mouse) |
| `walk.m4a` | `game.walk` | Pawn lands on each track cell (`step_land`, `spawn_exit`) |
| `kill.m4a` | `game.kill` | Pawn capture impact (`capture_hit`) |
| `diceshake.m4a` | `game.diceShake` | `DiceShaker` enters **shaking** phase |
| `jackpot.m4a` | `game.jackpot` | `DiceShaker` enters **revealing** when result is **6** |

`spawn_exit` (leaving base) currently reuses `walk.m4a`; a dedicated clip can replace it later by extending the catalog and `useBoardImpactFeedback` mapping.

## Architecture

```
App.tsx
  └── useUiSoundEffects()          # global UI click / hover (all routes)

GameView
  └── useAudioSettings()           # master volume → GameSettingsOverlay
  └── useBoardImpactFeedback()     # walk / kill from board impacts

BoardScene → BoardPieces
  └── ImpactPuffPool.spawn()       # visual puff + onImpact callback

DiceShaker
  └── phase edge detection         # diceShake + jackpot SFX
```

### `lib/audio/audioManager.ts`

- Singleton with a small **pooled** `HTMLAudioElement` set per `SoundId`.
- **`unlock()`** on first user gesture (browser autoplay policy).
- **`play(id)`** respects master volume × per-sound gain (`SOUND_VOLUME_MUL` in `soundIds.ts`).
- Hover uses a built-in throttle and is quieter by default (`ui.hover` × **0.28**).

### `lib/audio/audioSettings.ts`

| Key | Default | Notes |
|-----|---------|-------|
| `rune-race-audio-volume` | `0.8` | Master gain `0…1`; `0` mutes all SFX |

Changes dispatch `rune-race-audio-volume-change` so `audioManager` and `useAudioSettings` stay in sync across tabs.

### `hooks/useUiSoundEffects.ts`

Registered once in `App.tsx`. Uses **event delegation** on `document`:

- **Click:** `pointerdown` (primary button) and `Enter` / `Space` on buttons — targets from `lib/audio/uiSoundTargets.ts` (`.game-btn`, `button`, `a[href]`, lobby pills, rune cards, chat send, etc.).
- **Hover:** `pointermove` + `elementFromPoint` — plays only when the resolved interactive target **changes** (avoids child-element and CSS `:hover` transform flicker). Desktop fine pointer only; 280ms re-enter suppress on the same control.

Elements can opt out with `data-ui-sound="off"` (e.g. the volume slider in settings).

### `hooks/useBoardImpactFeedback.ts`

Wires `boardImpact.ts` → `audioManager`:

| `ImpactPuffKind` | Sound |
|------------------|-------|
| `step_land` | `game.walk` |
| `spawn_exit` | `game.walk` |
| `capture_hit` | `game.kill` |

`onImpact` still runs when **low graphics** disables puff meshes (`reducedMotion`); SFX are independent of the graphics quality preset.

### `components/DiceShaker.tsx`

Sounds fire on **phase transitions**, deduped per roll via `signalRef` (dice event timestamp):

1. **`shaking`** — `game.diceShake` (~0.22s after roll animation starts).
2. **`revealing`** + `rollResult === 6` — `game.jackpot`.

## Settings UI

`GameSettingsOverlay` exposes a **master volume** slider (0–100%). It controls every client SFX, including in-game HUD clicks. Home / lobby / auth pages use the same stored volume but have no settings entry — users can mute the browser tab there if needed.

Graphics quality (low / high) does **not** mute audio; it only affects visuals (shadows, puffs, materials).

## Dice + token timeline (audio)

Aligned with [Runtime flow — Dice presentation](./runtime-flow.md#dice-presentation-timeline):

| Time (approx.) | Phase | Audio |
|----------------|-------|-------|
| 0s | appearing | — |
| 0.22s | shaking | `game.diceShake` |
| 1.32s | lifting | — |
| 1.74s | revealing | `game.jackpot` if result is 6 |
| ~2.96s | gate ends | token motion; `game.walk` per cell, `game.kill` on capture |

Walk plays once per animated segment landing (~300ms per cell in `BoardPieces`).

## Adding a new sound

1. Add `.m4a` under `apps/web/assets/audio/`.
2. Extend `SoundId` and `AUDIO_CATALOG`.
3. Call `audioManager.play('…')` from the presentation hook, or map a new `ImpactPuffKind` in `useBoardImpactFeedback`.
4. Optional: add `SOUND_VOLUME_MUL[id]` for per-clip gain.

No server or protocol changes required.
