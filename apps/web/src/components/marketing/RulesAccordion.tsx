import { useState } from 'react'

type AccordionSection = {
  id: string
  title: string
  items: string[]
  defaultOpen?: boolean
}

const SECTIONS: AccordionSection[] = [
  {
    id: 'hand',
    title: '1. Khay thẻ, giới hạn bốc và hạn sử dụng',
    defaultOpen: true,
    items: [
      'Mỗi người được bốc tối đa 25 thẻ ngẫu nhiên trong một ván.',
      'Người chơi chỉ được bốc thẻ thường khi khay đang có dưới 5 thẻ còn hạn.',
      'Thẻ vừa bốc hết hạn sau 2 lượt bình thường tiếp theo của chính người giữ thẻ. Lượt thưởng do tung được 6 không làm giảm thời hạn.',
      'Thẻ thưởng trung thực là ngoại lệ: thẻ vẫn được thêm vào khay kể cả khi số lượng hiện tại đã đạt hoặc vượt 5.',
    ],
  },
  {
    id: 'placement',
    title: '2. Pha đặt marker đồng thời và giả danh',
    items: [
      'Mọi người chơi đang giữ thẻ đặt được đều có thể rải marker trong pha đặt đồng thời.',
      'Được đặt không giới hạn số thẻ đang giữ, miễn ô được chọn còn hợp lệ.',
      'Mọi marker đều có thể chọn danh tính hiển thị, bao gồm cả marker hỗ trợ, bẫy và Hoán vị.',
      'Không công bố danh tính người đặt thật, kể cả khi marker kích hoạt hoặc hết hạn.',
      'Người đặt thật có thể xem loại Rune của marker do mình đặt bằng tooltip trên desktop hoặc mobile.',
    ],
  },
  {
    id: 'chains',
    title: '3. Cách xử lý chuỗi Tiến, Lùi và Khiên',
    items: [
      'Đang tiến gặp Tiến N: cộng thêm N bước tiến.',
      'Đang tiến gặp Lùi N: bỏ số bước tiến còn lại và bắt đầu lùi N bước.',
      'Đang lùi gặp Lùi N: cộng dồn N bước vào số bước lùi còn lại.',
      'Đang lùi gặp Tiến N: bỏ số bước lùi còn lại và bắt đầu tiến N bước.',
      'Trong chuyển động cưỡng chế do Lùi, quân vẫn kích hoạt các marker mà nó đi qua.',
      'Khiên chỉ giữ tối đa một lớp. Gặp Khiên lần nữa vẫn làm marker mới biến mất nhưng không cộng thêm lớp.',
    ],
  },
  {
    id: 'special-effects',
    title: '4. Đóng băng, Về chuồng và Hoán vị',
    items: [
      'Đóng băng kích hoạt khi đi qua. Nếu không có Khiên, quân dừng ngay và bị khóa trong 2 lượt bình thường tiếp theo của chủ quân.',
      'Quân bị đóng băng vẫn có thể bị đối thủ đá về chuồng. Khi bị đá, trạng thái đóng băng được xóa.',
      'Về chuồng và Hoán vị chỉ kích hoạt nếu quân dừng đúng ô, kể cả điểm dừng sinh ra từ Tiến hoặc Lùi.',
      'Khiên chặn được Về chuồng nhưng không chặn được Hoán vị.',
      'Hoán vị chỉ chọn quân đang ở đường đi chung. Nếu danh tính hiển thị chính là chủ của quân kích hoạt, marker biến mất nhưng không tạo hiệu ứng.',
    ],
  },
  {
    id: 'leave-stable',
    title: '5. Dùng trực tiếp thẻ Xuất chuồng',
    items: [
      'Xuất chuồng không tạo marker và không tham gia giả danh.',
      'Chỉ người đang đến lượt được bấm Xuất chuồng sau pha đặt marker và trước khi tung xúc xắc của lượt bình thường.',
      'Được bấm nhiều thẻ Xuất chuồng liên tiếp; mỗi thẻ luôn bị tiêu hao ngay sau khi bấm.',
      'Nếu ô xuất phát có quân của chính mình, quân mới không thể ra nhưng thẻ vẫn mất.',
      'Nếu ô xuất phát có quân đối thủ, quân đối thủ bị đá về chuồng theo luật nền.',
      'Nếu ô xuất phát có marker, quân vừa ra chuồng xử lý marker như khi đi vào ô bình thường.',
    ],
  },
  {
    id: 'honesty',
    title: '6. Thưởng khi đặt marker trung thực',
    items: [
      'Một lượt được tính là trung thực khi người chơi đặt ít nhất một marker và tất cả marker do họ đặt trong pha đều hiển thị chính mình.',
      'Lượt không đặt marker giữ nguyên streak. Chỉ cần đặt một marker giả danh, streak trở về 0.',
      'Sau 5 lượt trung thực liên tiếp, phần thưởng đến hạn nhận trong pha bốc và đặt thẻ của lượt bình thường tiếp theo.',
      'Người nhận chọn một trong năm thẻ hỗ trợ: Xuất chuồng, Khiên, Tiến 2, Tiến 3 hoặc Tiến 4.',
      'Nếu hết thời gian chưa chọn, server tự chọn ngẫu nhiên một thẻ hỗ trợ.',
      'Phần thưởng được thêm vào khay kể cả khi đã đủ 5 thẻ, không tính vào quota 25 thẻ và có thể dùng ngay trong lượt nhận.',
      'Đối thủ được thông báo rằng người chơi đã nhận thẻ hỗ trợ, nhưng không biết họ đã chọn thẻ nào.',
    ],
  },
]

export function RulesAccordion() {
  const [openId, setOpenId] = useState(SECTIONS.find((s) => s.defaultOpen)?.id ?? null)

  return (
    <div className="accordion">
      {SECTIONS.map((section) => {
        const isOpen = openId === section.id
        return (
          <article key={section.id} className={`accordion-item${isOpen ? ' open' : ''}`}>
            <button
              className="accordion-button"
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? null : section.id)}
            >
              <span>{section.title}</span>
              <i className="bi bi-chevron-down" aria-hidden="true" />
            </button>
            <div className="accordion-content">
              <div>
                <div className="accordion-inner">
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
