import { FakeLeaderboard } from '../../components/marketing/FakeLeaderboard'
import { PageMeta } from '../../components/marketing/PageMeta'
import { PlayCta } from '../../components/marketing/PlayCta'
import { Reveal } from '../../components/marketing/Reveal'

export default function LeaderboardPage() {
  return (
    <>
      <PageMeta path="/leaderboard" />
      <main>
        <Reveal className="page-hero">
          <span className="eyebrow">
            <i className="bi bi-trophy-fill" aria-hidden="true" /> Bảng xếp hạng
          </span>
          <h1>Top người chơi</h1>
          <p>
            Theo dõi những cao thủ đang dẫn đầu trên Rune Race. Điểm tích lũy qua các trận online — thắng sớm,
            chơi nhiều và giữ phong độ để leo hạng.
          </p>
        </Reveal>

        <section className="section section-sm">
          <Reveal className="section-head">
            <span className="eyebrow">
              <i className="bi bi-bar-chart-fill" aria-hidden="true" /> Xếp hạng trực tiếp
            </span>
            <h2 className="section-title">20 người chơi hàng đầu</h2>
            <p className="section-copy">
              Bảng xếp hạng cập nhật liên tục theo điểm và số Xu trên hồ sơ. Càng chơi nhiều trận online, cơ
              hội lọt top càng cao.
            </p>
          </Reveal>
          <Reveal>
            <FakeLeaderboard />
          </Reveal>
        </section>

        <PlayCta
          title="Muốn lên bảng?"
          description="Vào phòng online, tích điểm qua từng trận và dùng Xu để mở khóa skin nhà mới trong Cửa hàng."
          buttonLabel="Vào trận ngay"
        />
      </main>
    </>
  )
}
