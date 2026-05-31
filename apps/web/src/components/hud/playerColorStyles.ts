import type { PlayerColor } from '@rune-race/shared'
import { PLAYER_GRADIENT } from '../sky/skyColors'

/** HUD panel section label (BẠN, LƯỢT HIỆN TẠI, VỀ ĐÍCH). */
export const HUD_PANEL_LABEL_CLASS = 'game-hud-label'

/** HUD player display name. */
export const HUD_PLAYER_NAME_CLASS = 'game-hud-name'

export const PLAYER_COLOR_MAP: Record<
  PlayerColor,
  {
    hudPanel: string
    nameClass: string
    rollBtn: string
    gradient: string
  }
> = {
  red: {
    hudPanel: 'hud-p-red',
    nameClass: 'hud-text-red',
    rollBtn: 'btn-red',
    gradient: PLAYER_GRADIENT.red,
  },
  blue: {
    hudPanel: 'hud-p-blue',
    nameClass: 'hud-text-blue',
    rollBtn: 'btn-blue',
    gradient: PLAYER_GRADIENT.blue,
  },
  green: {
    hudPanel: 'hud-p-green',
    nameClass: 'hud-text-green',
    rollBtn: 'btn-green',
    gradient: PLAYER_GRADIENT.green,
  },
  yellow: {
    hudPanel: 'hud-p-yellow',
    nameClass: 'hud-text-yellow',
    rollBtn: 'btn-yellow',
    gradient: PLAYER_GRADIENT.yellow,
  },
}
