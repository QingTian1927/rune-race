import { Link } from 'react-router-dom'
import { CardRail } from '../../components/marketing/CardRail'
import { MarkerPreview } from '../../components/marketing/MarkerPreview'
import { PageMeta } from '../../components/marketing/PageMeta'
import { PlayCta } from '../../components/marketing/PlayCta'
import { Reveal } from '../../components/marketing/Reveal'

export default function LandingPage() {
  return (
    <>
      <PageMeta path="/" />
      <main>
        <section className="hero">
          <div className="hero-grid">
            <Reveal className="hero-copy">
              <span className="eyebrow">
                <i className="bi bi-stars" aria-hidden="true" /> Cá ngựa quen thuộc · chiến thuật hoàn toàn mới
              </span>
              <h1 className="hero-title">
                Rune <span>Race</span>
              </h1>
              <p className="hero-lead">
                Một ván Cá ngựa online sẽ không còn chỉ phụ thuộc vào xúc xắc. Rải Rune bí mật, giả danh đối thủ
                và tạo ra những pha lật kèo khiến cả nhóm bạn phải bật cười.
              </p>
              <div className="hero-actions">
                <Link className="btn btn-primary" to="/play">
                  <i className="bi bi-rocket-takeoff-fill" aria-hidden="true" /> Vào game ngay
                </Link>
                <Link className="btn btn-secondary" to="/guide">
                  <i className="bi bi-journal-richtext" aria-hidden="true" /> Xem cách chơi
                </Link>
              </div>
              <div className="hero-note">
                <span>
                  <i className="bi bi-browser-chrome" aria-hidden="true" /> Chạy trên trình duyệt
                </span>
                <span>
                  <i className="bi bi-people-fill" aria-hidden="true" /> Chơi cùng bạn bè
                </span>
                <span>
                  <i className="bi bi-lightning-charge-fill" aria-hidden="true" /> Vào phòng nhanh
                </span>
              </div>
            </Reveal>
            <Reveal className="hero-visual">
              <img
                src="/marketing/images/rune-race-hero.webp"
                alt="Ảnh bìa Rune Race với bốn quân ngựa màu xanh lá, xanh dương, vàng và đỏ"
                width={1200}
                height={400}
              />
              <div className="hero-float">
                <span className="pulse" /> Sẵn sàng tạo phòng
              </div>
            </Reveal>
          </div>
          <Reveal className="stat-strip" aria-label="Tóm tắt gameplay">
            <div className="stat-card">
              <strong>2–4</strong>
              <span>người chơi mỗi phòng</span>
            </div>
            <div className="stat-card">
              <strong>11</strong>
              <span>loại Rune chiến thuật</span>
            </div>
            <div className="stat-card">
              <strong>2–4</strong>
              <span>quân ngựa · Classic 4 · Rune 2</span>
            </div>
            <div className="stat-card">
              <strong>100%</strong>
              <span>vào game bằng trình duyệt</span>
            </div>
          </Reveal>
        </section>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-gem" aria-hidden="true" /> Điểm nổi bật
            </span>
            <h2 className="section-title">Không chỉ là tung xúc xắc</h2>
            <p className="section-copy">
              Rune Race giữ lại sự thân thuộc của Cá ngựa, nhưng thêm các quyết định chiến thuật và yếu tố tâm lý
              để mỗi ván có một câu chuyện khác nhau.
            </p>
          </Reveal>
          <div className="feature-grid">
            <Reveal className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-geo-alt-fill" aria-hidden="true" />
              </div>
              <h3>Marker bí mật</h3>
              <p>Rune được rải trên đường đi chung. Người khác thấy marker nhưng không biết đó là hỗ trợ hay bẫy.</p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-incognito" aria-hidden="true" />
              </div>
              <h3>Giả danh người đặt thẻ</h3>
              <p>
                Gắn avatar của người chơi khác lên marker để tạo nghi ngờ, đánh lạc hướng và những màn đổ lỗi vui
                nhộn.
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-shuffle" aria-hidden="true" />
              </div>
              <h3>Chuỗi hiệu ứng</h3>
              <p>
                Tiến, Lùi, Khiên, Đóng băng và Hoán vị có thể nối tiếp nhau, biến một lượt đi bình thường thành pha
                lật kèo.
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <i className="bi bi-link-45deg" aria-hidden="true" />
              </div>
              <h3>Mời bạn bằng link</h3>
              <p>Mở trình duyệt, tạo phòng và chia sẻ link. Không cần cài đặt phức tạp trước khi bắt đầu.</p>
            </Reveal>
          </div>
        </section>

        <section className="section section-sm">
          <Reveal className="mechanic-banner surface">
            <MarkerPreview />
            <div>
              <span className="eyebrow">
                <i className="bi bi-eye-slash-fill" aria-hidden="true" /> Bluff · đọc vị · tạo drama
              </span>
              <h2 className="section-title" style={{ fontSize: 'clamp(30px,4vw,44px)' }}>
                Bạn nhìn thấy người “đặt” thẻ, nhưng chưa chắc đó là sự thật
              </h2>
              <p className="section-copy" style={{ marginLeft: 0 }}>
                Marker chỉ hiển thị avatar và màu của danh tính công khai. Người đặt thật có thể chọn chính mình hoặc
                giả danh một người đang còn trong trận. Loại Rune và danh tính thật luôn được giữ kín với đối thủ.
              </p>
              <Link className="btn btn-soft" to="/guide#marker">
                <i className="bi bi-arrow-right-circle-fill" aria-hidden="true" /> Tìm hiểu marker bí mật
              </Link>
            </div>
          </Reveal>
        </section>

        <section className="section section-sm" id="cards">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-collection-fill" aria-hidden="true" /> Bộ Rune
            </span>
            <h2 className="section-title">Nhặt thẻ, rải bẫy và xoay chuyển cuộc đua</h2>
            <p className="section-copy">
              Từ thẻ hỗ trợ giúp bứt tốc đến bẫy khiến đối thủ lùi bước hoặc về chuồng, mỗi Rune đều có thể thay đổi
              cục diện.
            </p>
          </Reveal>
          <Reveal className="card-showcase surface">
            <CardRail />
          </Reveal>
        </section>

        <section className="section section-sm">
          <div className="split">
            <Reveal className="story-panel surface">
              <span className="eyebrow">
                <i className="bi bi-controller" aria-hidden="true" /> Dễ bắt đầu
              </span>
              <h3>Quen thuộc từ lượt đầu tiên</h3>
              <p>
                Tùy chế độ phòng, mỗi người điều khiển 4 quân (Classic) hoặc 2 quân (Rune). Tung xúc xắc, di chuyển trên
                đường đi chung và đưa đủ quân về đích để chiến thắng.
              </p>
              <div className="story-list">
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Luật Cá ngựa nền vẫn dễ hiểu với người mới.</span>
                </div>
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Classic giữ trọn 4 quân quen thuộc; Rune rút gọn còn 2 quân để nhịp ván nhanh hơn.</span>
                </div>
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Thẻ Xuất chuồng có thể dùng trực tiếp từ khay trước khi tung xúc xắc.</span>
                </div>
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Hướng dẫn chi tiết được tách riêng để tra cứu khi cần.</span>
                </div>
              </div>
            </Reveal>
            <Reveal className="story-panel surface">
              <span className="eyebrow">
                <i className="bi bi-fire" aria-hidden="true" /> Khó đoán đến phút cuối
              </span>
              <h3>Mỗi ván có một câu chuyện khác nhau</h3>
              <p>
                Đối thủ có thể vô tình giúp bạn tiến nhanh, hoặc khiến quân sắp về đích bị lùi, đóng băng hay đổi
                chỗ. Một marker nhỏ cũng đủ tạo ra màn lật kèo.
              </p>
              <div className="story-list">
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Rune có thời hạn nên người chơi phải quyết định khi nào nên đặt.</span>
                </div>
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Giả danh giúp tăng tương tác và đọc vị giữa bạn bè.</span>
                </div>
                <div className="story-item">
                  <i className="bi bi-check-circle-fill" aria-hidden="true" />
                  <span>Chuỗi Tiến và Lùi khiến đường đi luôn khó đoán.</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <PlayCta
          title="Sẵn sàng tạo một ván đầy drama?"
          description="Vào Rune Race, tạo phòng và gửi link cho bạn bè. Một lượt xúc xắc có thể mở đầu cho cả chuỗi lật kèo."
        />
      </main>
    </>
  )
}
