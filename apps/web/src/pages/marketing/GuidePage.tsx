import { MarkerPreview } from '../../components/marketing/MarkerPreview'
import { PageMeta } from '../../components/marketing/PageMeta'
import { PlayCta } from '../../components/marketing/PlayCta'
import { Reveal } from '../../components/marketing/Reveal'
import { RulesAccordion } from '../../components/marketing/RulesAccordion'
import { RuneLibrary } from '../../components/marketing/RuneLibrary'

const GUIDE_NAV = [
  { href: '#quick-start', label: 'Bắt đầu nhanh' },
  { href: '#turn-flow', label: 'Một lượt chơi' },
  { href: '#marker', label: 'Marker bí mật' },
  { href: '#rune-library', label: 'Bộ thẻ Rune' },
  { href: '#detailed-rules', label: 'Luật chi tiết' },
] as const

export default function GuidePage() {
  return (
    <>
      <PageMeta path="/guide" />
      <main>
        <Reveal className="page-hero">
          <span className="eyebrow">
            <i className="bi bi-journal-richtext" aria-hidden="true" /> Hướng dẫn
          </span>
          <h1>Hướng dẫn chơi</h1>
          <p>
            Phần đầu giúp bạn vào game nhanh. Khi cần tra cứu kỹ hơn, hãy mở phần Luật chi tiết hoặc xem thư viện
            Rune bên dưới.
          </p>
          <nav className="guide-nav" aria-label="Mục lục hướng dẫn">
            {GUIDE_NAV.map(({ href, label }) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </Reveal>

        <section className="section section-sm" id="quick-start">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-flag-fill" aria-hidden="true" /> Bắt đầu nhanh
            </span>
            <h2 className="section-title">Đưa đủ quân ngựa về đích</h2>
            <p className="section-copy">
              Rune Race giữ luật nền quen thuộc của Cá ngựa. Tùy chế độ phòng, mỗi người điều khiển 4 quân (Classic)
              hoặc 2 quân (Rune). Điểm mới nằm ở khay Rune, marker bí mật và cơ chế giả danh.
            </p>
          </Reveal>
          <div className="step-grid">
            <Reveal className="step-card surface">
              <div className="step-number">1</div>
              <h3>Vào phòng</h3>
              <p>Tạo phòng, nhập mã phòng hoặc tìm trận nhanh. Một ván hỗ trợ từ 2 đến 4 người chơi.</p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">2</div>
              <h3>Điều khiển quân của bạn</h3>
              <p>
                Classic: 4 quân mỗi người. Rune: 2 quân mỗi người. Mục tiêu là đưa đủ quân về đích trước đối thủ.
              </p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">3</div>
              <h3>Dùng Rune</h3>
              <p>Bốc Rune, giữ trong khay hoặc rải marker trên đường đi chung để tạo lợi thế và gây bất ngờ.</p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">4</div>
              <h3>Đọc vị đối thủ</h3>
              <p>Marker có thể hiển thị danh tính giả. Đừng vội tin avatar mà bạn nhìn thấy trên bàn cờ.</p>
            </Reveal>
          </div>
        </section>

        <section className="section section-sm" id="turn-flow">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-arrow-repeat" aria-hidden="true" /> Lượt bình thường
            </span>
            <h2 className="section-title">Một lượt chơi diễn ra như thế nào?</h2>
            <p className="section-copy">
              Người đang đến lượt và các đối thủ đều có cơ hội ra quyết định trước khi xúc xắc được tung.
            </p>
          </Reveal>
          <div className="step-grid">
            <Reveal className="step-card surface">
              <div className="step-number">1</div>
              <h3>Bốc thẻ</h3>
              <p>Người đang đến lượt có thể bốc Rune nếu chưa vượt quota và khay đang có dưới 5 thẻ còn hạn.</p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">2</div>
              <h3>Đặt marker đồng thời</h3>
              <p>
                Mọi người chơi có thể rải các Rune đặt được lên ô đường đi chung còn trống, đồng thời chọn danh tính
                hiển thị.
              </p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">3</div>
              <h3>Dùng Xuất chuồng</h3>
              <p>
                Sau pha đặt marker, người đang đến lượt có thể bấm thẻ Xuất chuồng trong khay trước khi tung xúc xắc.
              </p>
            </Reveal>
            <Reveal className="step-card surface">
              <div className="step-number">4</div>
              <h3>Tung và di chuyển</h3>
              <p>Tung xúc xắc, chọn một quân hợp lệ và xử lý từng marker mà quân đi qua hoặc dừng đúng ô.</p>
            </Reveal>
          </div>
          <Reveal className="rule-spotlight surface" style={{ marginTop: 18 }}>
            <div className="rule-spotlight-icon">
              <i className="bi bi-dice-6-fill" aria-hidden="true" />
            </div>
            <div>
              <h3>Nếu tung được 6</h3>
              <p>
                Bạn được thêm lượt, nhưng lượt thưởng chỉ lặp lại từ bước tung xúc xắc. Không bốc thẻ mới, không mở
                thêm pha đặt marker và không mở lại cửa sổ Xuất chuồng.
              </p>
            </div>
          </Reveal>
        </section>

        <section className="section section-sm" id="marker">
          <Reveal className="mechanic-banner surface">
            <MarkerPreview secondHorseGradient="linear-gradient(135deg,#ffd740,#e8a000)" />
            <div>
              <span className="eyebrow">
                <i className="bi bi-incognito" aria-hidden="true" /> Marker bí mật
              </span>
              <h2 className="section-title" style={{ fontSize: 'clamp(30px,4vw,44px)' }}>
                Điểm đặt Rune luôn khiến người chơi phải dè chừng
              </h2>
              <p className="section-copy" style={{ marginLeft: 0 }}>
                Marker trên bàn chỉ hiển thị avatar và màu của người được cho là đã đặt thẻ. Loại Rune không bị lộ.
                Người đặt thật có thể chọn chính mình hoặc giả danh một người khác đang còn trong trận.
              </p>
            </div>
          </Reveal>
          <div className="split" style={{ marginTop: 20 }}>
            <Reveal className="story-panel surface">
              <span className="eyebrow">
                <i className="bi bi-geo-alt-fill" aria-hidden="true" /> Có thể đặt ở đâu?
              </span>
              <h3>Chỉ đặt trên đường đi chung</h3>
              <p>
                Không đặt marker tại ô đang có quân ngựa hoặc trong đường về đích riêng. Mỗi ô chỉ chứa tối đa một
                marker. Nếu hai người chọn cùng một ô, request được server nhận trước sẽ giữ ô.
              </p>
            </Reveal>
            <Reveal className="story-panel surface">
              <span className="eyebrow">
                <i className="bi bi-hourglass-split" aria-hidden="true" /> Marker tồn tại bao lâu?
              </span>
              <h3>TTL 3 hoặc 5 vòng</h3>
              <p>
                Thời hạn được đếm theo lượt bình thường của danh tính đang hiển thị trên marker. Nếu danh tính đó rời
                trận hoặc đã hoàn thành toàn bộ quân, marker chuyển sang đếm theo vòng toàn bàn.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="section section-sm" id="rune-library">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-collection-fill" aria-hidden="true" /> Thư viện Rune
            </span>
            <h2 className="section-title">Bộ thẻ Rune</h2>
            <p className="section-copy">
              Dùng bộ lọc để xem từng nhóm thẻ. Xuất chuồng là thẻ dùng trực tiếp từ khay; các thẻ còn lại có thể tạo
              marker trên đường đi chung.
            </p>
          </Reveal>
          <Reveal>
            <RuneLibrary />
          </Reveal>
        </section>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-card-checklist" aria-hidden="true" /> Tra cứu nhanh
            </span>
            <h2 className="section-title">Tác dụng của từng Rune</h2>
          </Reveal>
          <Reveal className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nhóm</th>
                  <th>Rune</th>
                  <th>Kích hoạt</th>
                  <th>TTL marker</th>
                  <th>Hiệu ứng</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <span className="badge badge-support">Hỗ trợ</span>
                  </td>
                  <td>Xuất chuồng</td>
                  <td>Dùng trực tiếp từ khay</td>
                  <td>Không tạo marker</td>
                  <td>Đưa một quân từ chuồng ra ô xuất phát nếu có thể. Thẻ luôn bị tiêu hao sau khi bấm.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-support">Hỗ trợ</span>
                  </td>
                  <td>Khiên</td>
                  <td>Đi qua</td>
                  <td>3 vòng</td>
                  <td>Cấp tối đa một lớp Khiên, chặn một bẫy Lùi, Đóng băng hoặc Về chuồng tiếp theo.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-support">Hỗ trợ</span>
                  </td>
                  <td>Tiến 2 / 3 / 4</td>
                  <td>Đi qua</td>
                  <td>3 vòng</td>
                  <td>Cộng thêm số bước tiến ghi trên thẻ vào chuyển động hiện tại.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-trap">Bẫy</span>
                  </td>
                  <td>Lùi 3 / 4 / 5</td>
                  <td>Đi qua</td>
                  <td>3 vòng</td>
                  <td>Quân lập tức đổi sang lùi theo số bước trên thẻ. Khi đang lùi gặp thêm Lùi, số bước được cộng dồn.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-trap">Bẫy</span>
                  </td>
                  <td>Đóng băng</td>
                  <td>Đi qua</td>
                  <td>3 vòng</td>
                  <td>Quân dừng ngay và không thể được chọn trong 2 lượt bình thường tiếp theo của chủ quân.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-trap">Bẫy</span>
                  </td>
                  <td>Về chuồng</td>
                  <td>Dừng đúng ô</td>
                  <td>5 vòng</td>
                  <td>Đưa quân kích hoạt về chuồng, trừ khi bị Khiên vô hiệu hóa.</td>
                </tr>
                <tr>
                  <td>
                    <span className="badge badge-special">Đặc biệt</span>
                  </td>
                  <td>Hoán vị</td>
                  <td>Dừng đúng ô</td>
                  <td>5 vòng</td>
                  <td>
                    Người chạm marker chọn một quân hợp lệ của danh tính hiển thị để đổi chỗ. Khiên không chặn được
                    Hoán vị.
                  </td>
                </tr>
              </tbody>
            </table>
          </Reveal>
        </section>

        <section className="section section-sm" id="detailed-rules">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-book-fill" aria-hidden="true" /> Luật chi tiết
            </span>
            <h2 className="section-title">Tra cứu theo từng chủ đề</h2>
            <p className="section-copy">
              Mỗi mục có thể mở độc lập để bạn chỉ đọc phần đang cần. Các thông tin quan trọng được viết theo thứ tự
              diễn ra trong game.
            </p>
          </Reveal>
          <Reveal>
            <RulesAccordion />
          </Reveal>
        </section>

        <PlayCta
          title="Đã sẵn sàng thử một ván?"
          description="Học luật nhanh nhất bằng cách vào game và trải nghiệm Rune cùng bạn bè."
        />
      </main>
    </>
  )
}
