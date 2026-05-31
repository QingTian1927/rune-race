import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getPlayerName, setPlayerName } from '../lib/playerSession'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'

export default function GuidePage() {
  const [name, setName] = useState(getPlayerName())

  return (
    <SkyPageLayout
      playerName={name}
      onPlayerNameChange={setName}
      onPlayerNameBlur={() => setPlayerName(name)}
    >
      <div className="home-form-stage guide-page-card">
        <Link to="/" className="back-btn home-back-btn">
          <i className="bi bi-arrow-left-short inline-icon" aria-hidden="true" /> Quay về trang chủ
        </Link>

        <div className="panel p-blue">
          <div className="panel-head">
            <div className="panel-icon icon-blue">
              <i className="bi bi-question-circle-fill" aria-hidden="true" />
            </div>
            <div>
              <div className="panel-title">Hướng dẫn chơi</div>
              <div className="panel-subtitle">Luật cơ bản Rune Race</div>
            </div>
          </div>
          <div className="panel-body">
            <p>
              Trang hướng dẫn đang được xây dựng. Tạm thời bạn có thể tạo phòng, vào phòng bằng mã,
              ghép trận nhanh hoặc chọn phòng công khai từ trang chủ.
            </p>
            <Link to="/" className="game-btn btn-blue" style={{ textDecoration: 'none' }}>
              <span className="btn-icon">
                <i className="bi bi-house-door-fill" aria-hidden="true" />
              </span>
              <span>VỀ TRANG CHỦ</span>
            </Link>
          </div>
        </div>
      </div>
    </SkyPageLayout>
  )
}
