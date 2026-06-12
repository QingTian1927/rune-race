import { PageMeta } from '../../components/marketing/PageMeta'
import { PlayCta } from '../../components/marketing/PlayCta'
import { Reveal } from '../../components/marketing/Reveal'

const TEAM = [
  { initials: 'LN', name: 'Lê Phương Linh Nga', role: 'Leader' },
  { initials: 'D', name: 'Bùi Việt Dũng', role: 'Developer' },
  { initials: 'TV', name: 'Nguyễn Thành Vinh', role: 'Sponsor' },
  { initials: 'B', name: 'Trần Thủy Bình', role: 'Tester' },
  { initials: 'HT', name: 'Doãn Thị Hà Trang', role: 'Marketing' },
  { initials: 'VH', name: 'Trần Thị Việt Hà', role: 'Marketing' },
] as const

const SUPPORTERS = [
  'Đặng Phúc Khanh',
  'Khánh Phạm',
  'Bùi Minh Đăng',
  'Dương Trọng Khánh',
  'Bùi Thị Bắp (Một con mèo cute)',
] as const

export default function AboutPage() {
  return (
    <>
      <PageMeta path="/about" />
      <main>
        <Reveal className="page-hero">
          <span className="eyebrow">
            <i className="bi bi-people-fill" aria-hidden="true" /> About Rune Race
          </span>
          <h1>Về chúng tôi</h1>
          <p>
            Rune Race được xây dựng với mong muốn làm mới một trò chơi quen thuộc bằng những cơ chế dễ hiểu nhưng đủ
            tạo ra chiến thuật, bluff và những khoảnh khắc đáng nhớ giữa bạn bè.
          </p>
        </Reveal>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-bullseye" aria-hidden="true" /> Mục tiêu
            </span>
            <h2 className="section-title">Một game Việt dễ chơi, vui khi chơi cùng nhau</h2>
            <p className="section-copy">
              Chúng tôi giữ lại cảm giác thân thuộc của Cá ngựa và bổ sung lớp Rune để mỗi lượt đi có thêm quyết định,
              mỗi ván có thêm câu chuyện.
            </p>
          </Reveal>
          <div className="goal-grid">
            <Reveal className="goal-card surface">
              <i className="bi bi-lightning-charge-fill" aria-hidden="true" />
              <h3>Dễ tiếp cận</h3>
              <p>
                Người mới hiểu cách chơi nhanh vì nền tảng vẫn là Cá ngựa: tung xúc xắc, di chuyển và đưa quân về
                đích.
              </p>
            </Reveal>
            <Reveal className="goal-card surface">
              <i className="bi bi-chat-heart-fill" aria-hidden="true" />
              <h3>Tăng tương tác</h3>
              <p>Marker bí mật và giả danh tạo ra các màn đoán ý, trêu đùa và thảo luận ngay trong nhóm bạn.</p>
            </Reveal>
            <Reveal className="goal-card surface">
              <i className="bi bi-browser-chrome" aria-hidden="true" />
              <h3>Vào game nhanh</h3>
              <p>Ưu tiên trải nghiệm web để người chơi mở link, tạo phòng và bắt đầu mà không cần cài đặt phức tạp.</p>
            </Reveal>
          </div>
        </section>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-person-badge-fill" aria-hidden="true" /> Đội ngũ phát triển
            </span>
            <h2 className="section-title">Những người đứng sau Rune Race</h2>
            <p className="section-copy">
              Avatar hiện dùng placeholder để có thể thay thế bằng ảnh thật trong giai đoạn hoàn thiện website.
            </p>
          </Reveal>
          <div className="team-grid">
            {TEAM.map((member) => (
              <Reveal key={member.name} className="member surface">
                <div className="member-avatar">{member.initials}</div>
                <h3>{member.name}</h3>
                <p>{member.role}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="section section-sm">
          <Reveal className="supporter-box surface">
            <span className="eyebrow">
              <i className="bi bi-heart-fill" aria-hidden="true" /> Lời cảm ơn
            </span>
            <h2 className="section-title" style={{ fontSize: 'clamp(30px,4vw,44px)' }}>
              Cảm ơn các supporter đã đồng hành
            </h2>
            <p className="section-copy">
              Trước khi phát hành chính thức, những góp ý từ người chơi thử giúp nhóm nhìn rõ hơn các điểm cần điều
              chỉnh về gameplay, giao diện và trải nghiệm tổng thể.
            </p>
            <div className="supporter-list">
              {SUPPORTERS.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-envelope-paper-heart-fill" aria-hidden="true" /> Liên hệ
            </span>
            <h2 className="section-title">Kết nối với Rune Race</h2>
            <p className="section-copy">
              Bạn có thể gửi góp ý, đề xuất hợp tác hoặc theo dõi các cập nhật mới nhất qua những kênh dưới đây.
            </p>
          </Reveal>
          <div className="contact-grid">
            <a className="contact-card surface reveal visible" href="mailto:runerace.team@gmail.com">
              <i className="bi bi-envelope-fill" aria-hidden="true" />
              <div>
                <strong>Email</strong>
                <span>runerace.team@gmail.com</span>
              </div>
            </a>
            <a className="contact-card surface reveal visible" href="tel:0399864028">
              <i className="bi bi-telephone-fill" aria-hidden="true" />
              <div>
                <strong>Số điện thoại</strong>
                <span>039 986 4028</span>
              </div>
            </a>
            <a
              className="contact-card surface reveal visible"
              href="https://www.facebook.com/profile.php?id=61590089923392"
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="bi bi-facebook" aria-hidden="true" />
              <div>
                <strong>Facebook</strong>
                <span>Rune Race</span>
              </div>
            </a>
          </div>
        </section>

        <PlayCta
          title="Muốn trải nghiệm thành quả của nhóm?"
          description="Vào game ngay trên trình duyệt và mời bạn bè cùng thử các Rune bí mật."
        />
      </main>
    </>
  )
}
