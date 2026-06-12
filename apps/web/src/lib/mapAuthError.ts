/** Client cooldown after a signup attempt (aligns with Supabase signup confirmation window). */
export const AUTH_SIGNUP_COOLDOWN_SECONDS = 60

type AuthErrorContext = 'signup' | 'login'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return ''
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code
    return typeof code === 'string' ? code : undefined
  }
  return undefined
}

function waitSecondsFromMessage(message: string): number | null {
  const match = message.match(/after\s+(\d+)\s+seconds?/i)
  if (!match) return null
  const seconds = Number(match[1])
  return Number.isFinite(seconds) ? seconds : null
}

export function mapAuthError(error: unknown, context: AuthErrorContext): string {
  const message = errorMessage(error)
  const code = errorCode(error)
  const lower = message.toLowerCase()
  const waitSeconds = waitSecondsFromMessage(message)

  if (
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    lower.includes('only request this after') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests')
  ) {
    if (waitSeconds) {
      return `Bạn thao tác hơi nhanh — vui lòng đợi ${waitSeconds} giây rồi thử lại.`
    }
    if (context === 'signup') {
      return 'Bạn thao tác hơi nhanh — vui lòng đợi khoảng 1 phút rồi thử đăng ký lại.'
    }
    return 'Bạn thao tác hơi nhanh — vui lòng đợi khoảng 1 phút rồi thử lại.'
  }

  if (
    code === 'user_already_exists' ||
    lower.includes('already registered') ||
    lower.includes('already been registered') ||
    lower.includes('user already exists')
  ) {
    return 'Email này đã được đăng ký. Hãy đăng nhập hoặc dùng quên mật khẩu nếu cần.'
  }

  if (context === 'login') {
    if (
      code === 'invalid_credentials' ||
      lower.includes('invalid login credentials') ||
      lower.includes('invalid email or password')
    ) {
      return 'Email hoặc mật khẩu không đúng.'
    }
  }

  if (context === 'signup') {
    if (lower.includes('password') && (lower.includes('short') || lower.includes('least'))) {
      return 'Mật khẩu quá ngắn — hãy chọn mật khẩu dài hơn.'
    }
    if (lower.includes('invalid email') || lower.includes('unable to validate email')) {
      return 'Email không hợp lệ — hãy kiểm tra lại.'
    }
  }

  if (message.trim()) return message

  return context === 'signup' ? 'Đăng ký thất bại — hãy thử lại.' : 'Đăng nhập thất bại — hãy thử lại.'
}

export const SIGNUP_EMAIL_CONFIRM_INFO =
  'Đã gửi email xác nhận! Kiểm tra hộp thư (cả mục spam). Không cần bấm đăng ký lại — sau khi xác nhận, hãy đăng nhập.'

export const SIGNUP_EMAIL_ALREADY_REGISTERED_INFO =
  'Email này có thể đã được đăng ký. Hãy đăng nhập — nếu chưa xác nhận email, kiểm tra hộp thư trước.'
