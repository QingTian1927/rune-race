import { Link } from 'react-router-dom'

export function MarketingFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-shell">
        <div className="footer-brand">
          <img src="/marketing/images/rune-race-mark.svg" alt="" width={38} height={38} />
          <div>
            <strong>Rune Race</strong>
            <span>Cá ngựa online · đấu trí bằng Rune</span>
          </div>
        </div>
        <div className="footer-links">
          <Link to="/guide">Hướng dẫn</Link>
          <Link to="/about">Về đội ngũ</Link>
          <a href="mailto:runerace.team@gmail.com">Liên hệ</a>
        </div>
      </div>
    </footer>
  )
}
