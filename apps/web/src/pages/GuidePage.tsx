import { Link } from 'react-router-dom'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { useSkyPageName } from '../components/sky/useSkyPageName'

export default function GuidePage() {
  const { name, setName, onNameBlur } = useSkyPageName()

  return (
    <SkyPageLayout playerName={name} onPlayerNameChange={setName} onPlayerNameBlur={onNameBlur}>
      <SkyFormStage backTo="/">
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
            <Link to="/" className="game-btn btn-blue">
              <span className="btn-icon">
                <i className="bi bi-house-door-fill" aria-hidden="true" />
              </span>
              <span>VỀ TRANG CHỦ</span>
            </Link>
          </div>
        </div>
      </SkyFormStage>
    </SkyPageLayout>
  )
}
