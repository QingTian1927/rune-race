import { Link } from 'react-router-dom'
import { PROFILE_EMOJIS } from '../../lib/profileEmojis'

export function ProfileAnonBanner() {
  return (
    <div className="panel p-yellow profile-anon-banner">
      <div className="panel-head">
        <div className="panel-icon icon-yellow">
          <i className="bi bi-incognito" aria-hidden="true" />
        </div>
        <div>
          <div className="panel-title">Tài khoản ẩn danh</div>
          <div className="panel-subtitle">Chỉ tên hiển thị có thể chỉnh khi chưa đăng ký</div>
        </div>
      </div>
      <div className="panel-body">
        <p className="profile-anon-banner-lead">
          Đăng ký tài khoản để mở khóa và chỉnh sửa các mục sau:
        </p>
        <ul className="profile-anon-unlock-list">
          <li>Email &amp; số điện thoại</li>
          <li>Bio giới thiệu bản thân</li>
          <li>Avatar emoji (hoa, cây, rau củ, trái cây…)</li>
        </ul>
        <Link to="/auth/signup" className="game-btn btn-blue profile-anon-banner-cta">
          <span className="btn-icon">
            <i className="bi bi-person-plus-fill" aria-hidden="true" />
          </span>
          <span>ĐĂNG KÝ TÀI KHOẢN</span>
        </Link>
      </div>
    </div>
  )
}

export function ProfileLockedFieldsGroup() {
  return (
    <div className="profile-locked-section" aria-label="Thông tin cần đăng ký để chỉnh sửa">
      <div className="profile-locked-section-head">
        <span className="profile-lock-badge" aria-hidden="true">
          <i className="bi bi-lock-fill" />
          Chưa mở khóa
        </span>
        <div>
          <p className="profile-locked-section-title">Các mục cần tài khoản đăng ký</p>
          <p className="profile-locked-section-desc">
            Email, SĐT, bio và avatar sẽ khả dụng sau khi bạn tạo tài khoản.
          </p>
        </div>
      </div>
      <div className="profile-locked-field-grid">
        <div className="profile-locked-field">
          <span className="profile-locked-field-label">Email</span>
          <span className="profile-locked-field-value">—</span>
        </div>
        <div className="profile-locked-field">
          <span className="profile-locked-field-label">SĐT</span>
          <span className="profile-locked-field-value">—</span>
        </div>
        <div className="profile-locked-field profile-locked-field--wide">
          <span className="profile-locked-field-label">Bio</span>
          <span className="profile-locked-field-value">Chưa có mô tả</span>
        </div>
      </div>
      <ProfileLockedAvatarPicker />
      <Link to="/auth/signup" className="profile-locked-section-link">
        Đăng ký ngay để chỉnh sửa
        <i className="bi bi-arrow-right-short" aria-hidden="true" />
      </Link>
    </div>
  )
}

type ProfileLockedAvatarPickerProps = {
  compact?: boolean
}

export function ProfileLockedAvatarPicker({ compact = false }: ProfileLockedAvatarPickerProps) {
  return (
    <div className={compact ? 'profile-locked-avatar profile-locked-avatar--compact' : 'profile-locked-avatar'}>
      {!compact ? (
        <>
          <div className="profile-locked-avatar-head">
            <span className="profile-locked-field-label">Avatar</span>
            <span className="profile-lock-badge">
              <i className="bi bi-lock-fill" aria-hidden="true" />
              Cần đăng ký
            </span>
          </div>
          <p className="profile-locked-avatar-desc">
            Chọn emoji trái cây, hoa, cây cỏ hoặc rau củ làm hình đại diện trên profile và trong phòng
            chơi.
          </p>
        </>
      ) : null}
      <div className="profile-locked-avatar-picker" aria-hidden="true">
        {PROFILE_EMOJIS.map((emoji, index) => (
          <span
            key={emoji}
            className={`profile-locked-avatar-option${index === 0 ? ' profile-locked-avatar-option--sample' : ''}`}
          >
            {emoji}
          </span>
        ))}
        <span className="profile-locked-avatar-overlay">
          <i className="bi bi-lock-fill" aria-hidden="true" />
        </span>
      </div>
    </div>
  )
}
