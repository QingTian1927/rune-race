/** Interactive elements that receive global UI click / hover sounds. */
export const UI_SOUND_CLICK_SELECTOR = [
  'button:not(:disabled)',
  'a[href]',
  '.menu-orb',
  '.back-btn',
  '.refresh-pill',
  '.copy-pill',
  '.kick-pill',
  '.guide-link',
  '.game-hud-quality-option',
  '.game-hud-settings-btn',
  '.game-hud-collapse-end',
  '.rune-hand-card',
  '.room-chat-send',
].join(', ')

export const UI_SOUND_HOVER_SELECTOR = UI_SOUND_CLICK_SELECTOR

export function resolveUiSoundTarget(node: EventTarget | null): Element | null {
  if (!(node instanceof Element)) return null
  return node.closest(UI_SOUND_CLICK_SELECTOR)
}
