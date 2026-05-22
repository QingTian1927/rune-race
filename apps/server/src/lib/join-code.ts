import { JOIN_CODE_LENGTH } from '@rune-race/shared'

const CHARSET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

export function generateJoinCode(): string {
  let code = ''
  for (let i = 0; i < JOIN_CODE_LENGTH; i += 1) {
    code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
  }
  return code
}
