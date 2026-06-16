# House GLB assets

Place per-color models here when ready. Naming convention (see `@rune-race/shared` `getHouseModelPath`):

| Skin ID | Filename prefix |
|---------|-----------------|
| `house_default` | `classic_{color}.glb` |
| `house_cottage` | `cottage_{color}.glb` |
| `house_villa` | `villa_{color}.glb` |
| `house_manor` | `manor_{color}.glb` |

`{color}` is one of: `red`, `blue`, `green`, `yellow`.

After adding files, set `hasGlbAsset: true` on the skin in `packages/shared/src/cosmetics/houses.ts`.

Until then, the client renders procedural placeholder geometry per skin.
