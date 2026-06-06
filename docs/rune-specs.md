# RUNE RACE | TÀI LIỆU ĐẶC TẢ LUẬT CHƠI MỚI, CƠ CHẾ GIẢ DANH VÀ HỆ THỐNG THẺ RUNE

*Gameplay Rule & Rune System Specification*

| Trường | Giá trị |
|---|---|
| **Phiên bản** | 1.0 - Rule Lock |
| **Trạng thái** | Đã tổng hợp theo các quyết định gameplay được xác nhận |
| **Phạm vi** | MVP web multiplayer 2-4 người chơi |
| **Mục đích** | Dùng cho game design, UI/UX và triển khai gameplay server |
| **Tài liệu nền** | Briefing Rune Race ban đầu và chuỗi xác nhận rule mới |

*Tài liệu nội bộ - thiết kế chi tiết phục vụ phát triển sản phẩm*

> **Quy tắc ưu tiên:** Tài liệu này thay thế các mô tả Rune cũ khi có mâu thuẫn. Luật Cá Ngựa truyền thống đang tồn tại trong MVP vẫn được kế thừa, trừ những điểm được tài liệu này sửa đổi hoặc mở rộng rõ ràng.

---

## Mục lục

1. [Mục tiêu và phạm vi tài liệu](#1-mục-tiêu-và-phạm-vi-tài-liệu)
2. [Nguyên tắc thiết kế và thuật ngữ](#2-nguyên-tắc-thiết-kế-và-thuật-ngữ)
3. [Vòng lặp gameplay của một lượt](#3-vòng-lặp-gameplay-của-một-lượt)
4. [Cơ chế bốc thẻ, hand array và phần thưởng](#4-cơ-chế-bốc-thẻ-hand-array-và-phần-thưởng)
5. [Danh mục thẻ Rune chính thức](#5-danh-mục-thẻ-rune-chính-thức)
6. [Cơ chế đặt marker đồng thời](#6-cơ-chế-đặt-marker-đồng-thời)
7. [Cơ chế giả danh](#7-cơ-chế-giả-danh)
8. [Thuật toán xử lý di chuyển và chuỗi kích hoạt](#8-thuật-toán-xử-lý-di-chuyển-và-chuỗi-kích-hoạt)
9. [Quy tắc chi tiết theo từng thẻ](#9-quy-tắc-chi-tiết-theo-từng-thẻ)
10. [Vòng đời marker và trạng thái ngựa](#10-vòng-đời-marker-và-trạng-thái-ngựa)
11. [Thiết kế giao diện desktop và mobile](#11-thiết-kế-giao-diện-desktop-và-mobile)
12. [Mô hình dữ liệu và sự kiện server đề xuất](#12-mô-hình-dữ-liệu-và-sự-kiện-server-đề-xuất)
13. [Kịch bản kiểm thử chấp nhận](#13-kịch-bản-kiểm-thử-chấp-nhận)
14. [Phạm vi kế thừa, giới hạn và điểm cần lưu ý](#14-phạm-vi-kế-thừa-giới-hạn-và-điểm-cần-lưu-ý)
- [Phụ lục A. Bảng tóm tắt Rule Lock](#phụ-lục-a-bảng-tóm-tắt-rule-lock)
- [Phụ lục B. Artwork concept bộ thẻ Rune](#phụ-lục-b-artwork-concept-bộ-thẻ-rune)

---

## 1. Mục tiêu và phạm vi tài liệu

Tài liệu này đặc tả phiên bản luật Rune Race mới dành cho MVP. Trọng tâm là lớp gameplay bổ sung trên nền luật Cá Ngựa truyền thống: bốc thẻ ngẫu nhiên, rải marker bí mật trên đường đi chung, kích hoạt thẻ theo chuyển động từng bước, đặt thẻ đồng thời và giả danh người đặt thẻ.

- Định nghĩa chính xác vòng lặp lượt chơi và thời điểm mở pha đặt thẻ.
- Khóa danh sách 11 loại Rune chính thức; loại bỏ thẻ Nhân đôi bước đi khỏi bộ thẻ mới.
- Mô tả vòng đời riêng của thẻ đang nằm trong array và marker đã được rải trên bàn cờ.
- Mô tả cơ chế giả danh, chuỗi trung thực và phần thưởng hỗ trợ.
- Quy định giao diện marker bí mật và tooltip riêng cho người đặt thật.
- Cung cấp dữ liệu và kịch bản kiểm thử để đội phát triển triển khai nhất quán.

---

## 2. Nguyên tắc thiết kế và thuật ngữ

### 2.1. Nguyên tắc thiết kế

| Nguyên tắc | Ý nghĩa triển khai |
|---|---|
| Kế thừa luật truyền thống | Rune Race không thay thế phần luật Cá Ngựa cơ bản đã tồn tại trong MVP; hệ thống Rune tạo thêm lớp chiến thuật và tâm lý. |
| Thông tin công khai có chủ đích | Người chơi nhìn thấy vị trí marker và danh tính công khai, nhưng không biết loại thẻ hoặc người đặt thật. |
| Chuyển động từng bước | Mỗi ô đi qua đều có thể làm thay đổi hướng hoặc số bước còn lại. Server phải resolve theo từng bước, không dịch chuyển trực tiếp từ điểm đầu tới điểm cuối. |
| Tác động hai chiều | Bất kỳ quân ngựa nào đi vào marker đều có thể được hỗ trợ hoặc bị phạt, kể cả quân của người đặt thật. |
| Chaos có kiểm soát | Tất cả người chơi có thể đặt thẻ đồng thời trong cùng một pha; xung đột vị trí được server xử lý theo thứ tự nhận thao tác. |

### 2.2. Thuật ngữ

| Thuật ngữ | Định nghĩa |
|---|---|
| Lượt bình thường | Lượt chơi bắt đầu từ bước bốc thẻ của người chơi đang đến lượt. Đây là đơn vị được dùng để đếm nhiều loại thời hạn. |
| Lượt thưởng do tung được 6 | Lượt phụ chỉ lặp lại từ bước tung xúc xắc. Không mở lại bước bốc thẻ hoặc pha đặt thẻ đồng thời; không được tính là một vòng thời hạn mới. |
| Hand array | Khu vực tối đa 10 thẻ còn hạn mà một người chơi đang giữ. Hiển thị ở góc dưới bên trái giao diện. |
| Marker | Dấu vị trí bí mật được tạo khi một thẻ được rải lên đường đi chung. Marker không tiết lộ loại Rune. |
| Người đặt thật | Người thực hiện thao tác rải thẻ. Danh tính này không bao giờ được công bố cho người chơi khác. |
| Danh tính hiển thị | Người chơi được gắn avatar và màu trên marker. Có thể là người đặt thật hoặc người bị giả danh. |
| Marker đi qua | Marker kích hoạt ngay khi quân ngựa đi qua ô chứa marker, kể cả quân chưa dừng lại tại ô đó. |
| Marker dừng đúng ô | Marker chỉ kích hoạt nếu chuyển động kết thúc chính xác tại ô chứa marker. |
| Đường đi chung | Các ô có thể được sử dụng bởi nhiều người chơi. Chỉ những ô này mới được phép đặt marker. |

---

## 3. Vòng lặp gameplay của một lượt

### 3.1. Lượt bình thường

| Bước | Tên bước | Mô tả |
|---|---|---|
| 1 | Mở lượt bình thường | Xử lý thẻ trong hand array đã hết hạn của người chơi đang đến lượt trước khi người này bốc hoặc đặt thẻ. |
| 2 | Bốc thẻ | Người chơi đang đến lượt có thể bốc 0 hoặc nhiều thẻ ngẫu nhiên, miễn tổng lượt bốc cá nhân chưa vượt 25 và hand array chưa vượt 10 thẻ. |
| 3 | Pha đặt thẻ đồng thời | Tất cả người chơi đang giữ thẻ có thể rải không giới hạn số thẻ còn hạn xuống các ô hợp lệ. Người chơi được phép giữ lại thẻ cho pha sau. |
| 4 | Tung xúc xắc | Chỉ người đang đến lượt tung xúc xắc. |
| 5 | Chọn quân ngựa | Người đang đến lượt chọn một quân ngựa hợp lệ theo luật Cá Ngựa truyền thống và các trạng thái hiện tại. |
| 6 | Di chuyển từng bước | Quân ngựa nhảy theo số xúc xắc. Server resolve từng ô và xử lý marker trên đường đi theo luật tại Mục 8. |
| 7 | Kết thúc lượt | Cập nhật bộ đếm trạng thái, vòng đời marker và các hiệu ứng liên quan. |

### 3.2. Lượt thưởng do tung được 6

Nếu người chơi tung được 6 và được thêm lượt theo luật truyền thống, quy trình chỉ lặp lại từ bước tung xúc xắc. Không được bốc thêm Rune và không mở thêm pha đặt thẻ đồng thời.

| Có thực hiện lại? | Bốc thẻ | Pha đặt đồng thời | Tung xúc xắc | Chọn quân | Di chuyển |
|---|---|---|---|---|---|
| Lượt thưởng do tung được 6 | Không | Không | Có | Có | Có |

---

## 4. Cơ chế bốc thẻ, hand array và phần thưởng

### 4.1. Giới hạn bốc thẻ cá nhân

- Mỗi người chơi được bốc tối đa **25 thẻ ngẫu nhiên** trong một ván.
- Đây là giới hạn cá nhân, không phải giới hạn dùng chung cho toàn bộ trận.
- Trong bước bốc thẻ của lượt bình thường, người chơi có thể bốc nhiều thẻ liên tiếp, miễn còn quota và hand array chưa đầy.
- Không được bốc thẻ trong lượt thưởng do tung được 6.
- Thẻ thưởng từ chuỗi trung thực không tính vào quota 25 thẻ bốc cá nhân.

### 4.2. Hand array tối đa 10 thẻ

- Mỗi người chơi có một array tối đa **10 thẻ còn hạn**, hiển thị ở góc dưới bên trái màn hình.
- Khi array đủ 10 thẻ, người chơi không thể bốc thêm thẻ.
- Người chơi có thể giữ thẻ để đặt ở pha sau nếu thẻ vẫn còn hạn.
- Mỗi thẻ trong array phải hiển thị số vòng còn lại.

### 4.3. Hạn của thẻ chưa đặt

Một thẻ được bốc lên hand array sẽ hết hạn sau **2 vòng** tính theo các lượt bình thường tiếp theo của chính người đã bốc thẻ. Lượt thưởng do tung được 6 không làm giảm thời hạn.

| Mốc | Trạng thái của thẻ A vừa bốc |
|---|---|
| Ngay trong lượt bốc | Còn hạn; có thể đặt trong pha đặt thẻ đồng thời ngay sau đó. |
| Lượt bình thường tiếp theo của chủ thẻ | Đã trải qua vòng thứ nhất. |
| Lượt bình thường tiếp theo nữa | Đã trải qua vòng thứ hai. |
| Bắt đầu lượt bình thường thứ ba tiếp theo | Xóa thẻ khỏi array trước khi mở bước bốc và pha đặt thẻ. |

### 4.4. Chuỗi trung thực và thẻ thưởng

- Một lượt của người chơi được tính là **trung thực** nếu người đó đặt ít nhất một marker trong pha đặt thẻ và tất cả marker do người đó đặt trong pha đều sử dụng danh tính hiển thị là chính mình.
- Một lượt không đặt marker giữ nguyên bộ đếm trung thực hiện tại.
- Chỉ cần có ít nhất một marker giả danh trong lượt, bộ đếm trung thực của người đặt thật trở về 0.
- Sau **5 lượt trung thực liên tiếp**, hệ thống thưởng ngẫu nhiên 1 thẻ hỗ trợ: Xuất chuồng, Khiên chắn, Tiến 2 bước, Tiến 3 bước hoặc Tiến 4 bước.
- Sau khi tạo thưởng, bộ đếm trung thực trở về 0.
- Hệ thống công bố người nhận thẻ thưởng, nhưng không tiết lộ lịch sử marker hoặc danh tính người đặt thật.
- Nếu hand array đã đầy, thẻ thưởng được đưa vào hàng chờ. Hàng chờ có thể tích lũy nhiều thẻ và tự chuyển thẻ vào array khi có chỗ trống.

---

## 5. Danh mục thẻ Rune chính thức

Bộ Rune phiên bản mới gồm **11 loại thẻ**. Thẻ Nhân đôi bước đi trong briefing cũ không còn nằm trong danh sách chính thức.

| Nhóm | Tên thẻ | Kích hoạt | TTL marker | Vai trò |
|---|---|---|---|---|
| Hỗ trợ | Xuất chuồng | Dừng đúng ô | 5 vòng | Đưa thêm một quân của người kích hoạt từ chuồng ra ô xuất phát nếu trong chuồng còn quân. |
| Hỗ trợ | Khiên chắn | Đi qua | 3 vòng | Cấp tối đa một lớp bảo vệ cho quân kích hoạt. Lớp này chặn một bẫy tiếp theo thuộc nhóm Lùi, Đóng băng hoặc Về chuồng. |
| Hỗ trợ | Tiến 2 bước | Đi qua | 3 vòng | Cộng thêm 2 bước tiến vào chuyển động hiện tại. |
| Hỗ trợ | Tiến 3 bước | Đi qua | 3 vòng | Cộng thêm 3 bước tiến vào chuyển động hiện tại. |
| Hỗ trợ | Tiến 4 bước | Đi qua | 3 vòng | Cộng thêm 4 bước tiến vào chuyển động hiện tại. |
| Bẫy | Lùi 3 bước | Đi qua | 3 vòng | Buộc quân kích hoạt chuyển sang lùi 3 bước; marker biến mất sau khi kích hoạt. |
| Bẫy | Lùi 4 bước | Đi qua | 3 vòng | Buộc quân kích hoạt chuyển sang lùi 4 bước; marker biến mất sau khi kích hoạt. |
| Bẫy | Lùi 5 bước | Đi qua | 3 vòng | Buộc quân kích hoạt chuyển sang lùi 5 bước; marker biến mất sau khi kích hoạt. |
| Bẫy | Đóng băng | Đi qua | 3 vòng | Dừng quân ngay tại marker và khóa quân trong 2 lượt bình thường tiếp theo của chủ quân. |
| Bẫy | Về chuồng | Dừng đúng ô | 5 vòng | Đưa quân kích hoạt về chuồng ngay lập tức, trừ khi được Khiên chắn vô hiệu hóa. |
| Đặc biệt | Hoán vị | Dừng đúng ô | 5 vòng | Người kích hoạt chọn một quân hợp lệ của danh tính hiển thị để đổi vị trí. |

---

## 6. Cơ chế đặt marker đồng thời

### 6.1. Pha đặt thẻ

- Pha đặt thẻ đồng thời mở sau bước bốc thẻ của mỗi lượt bình thường và trước khi người đang đến lượt tung xúc xắc.
- Tất cả người chơi đang giữ thẻ còn hạn được phép tham gia, không chỉ người đang đến lượt.
- Mỗi người có thể đặt không giới hạn số thẻ trong array trong cùng một pha.
- Người chơi có quyền không đặt hoặc giữ lại một phần thẻ cho các pha sau.

### 6.2. Ô hợp lệ để đặt marker

| Loại ô | Quyền đặt | Ghi chú |
|---|---|---|
| Ô thuộc đường đi chung | Được phép | Bao gồm ô xuất phát chung của người chơi và các ô chung ngay trước cửa chuồng. |
| Ô đang có quân ngựa đứng | Không được phép | Không thể đặt marker tại vị trí đang bị chiếm dụng. |
| Đường về đích riêng | Không được phép | Các ô chỉ quân của một người chơi sử dụng để về đích không thuộc phạm vi đặt marker. |
| Ô đã có marker | Không được phép | Mỗi ô chỉ chứa tối đa một marker bí mật. |

> **Không dùng khái niệm ô sao an toàn trong đặc tả Rune:** Luật đặt marker chỉ dựa trên điều kiện ô thuộc đường đi chung. Nếu MVP truyền thống đang có một loại ô đặc biệt khác, cần xử lý theo luật nền riêng; tài liệu này không bổ sung thêm quyền miễn nhiễm Rune cho ô đó.

### 6.3. Xử lý xung đột vị trí

Nếu nhiều người chơi gửi yêu cầu đặt marker vào cùng một ô còn trống trong cùng pha, server chấp nhận yêu cầu đến sớm nhất. Các yêu cầu đến sau thất bại; thẻ tương ứng vẫn nằm trong array của người đặt thất bại và không bị tiêu hao.

---

## 7. Cơ chế giả danh

### 7.1. Phạm vi áp dụng

- Mọi marker đều được áp dụng cơ chế giả danh, bao gồm toàn bộ thẻ hỗ trợ, bẫy và thẻ đặc biệt Hoán vị.
- Khi đặt marker, người đặt thật chọn một danh tính hiển thị trong số người chơi vẫn đang tham gia trận.
- Người đặt thật được phép chọn chính mình. Đây là một lượt đặt trung thực nếu mọi marker người đó đặt trong pha đều hiển thị chính mình.
- Không được chọn người đã thoát trận hoặc đã hoàn thành toàn bộ quân làm danh tính hiển thị cho marker mới.
- Danh tính người đặt thật không bao giờ được công bố, kể cả khi marker kích hoạt, hết hạn hoặc trận đấu kết thúc.

### 7.2. Thông tin công khai trên bàn cờ

- Marker hiển thị dưới dạng location icon hình tròn tại ô đường đi chung.
- Bên trong vòng tròn là avatar của danh tính hiển thị.
- Màu sắc marker sử dụng màu của danh tính hiển thị.
- Không hiển thị loại thẻ đang được đặt tại marker.
- Không hiển thị số vòng tồn tại còn lại cho người chơi khác.

---

## 8. Thuật toán xử lý di chuyển và chuỗi kích hoạt

### 8.1. Nguyên tắc resolve từng bước

Server không được tính điểm đến cuối cùng chỉ bằng phép cộng xúc xắc. Mỗi bước nhảy phải được resolve tuần tự vì marker có thể cộng bước, đổi hướng, dừng chuyển động hoặc tạo hiệu ứng trạng thái.

```
resolveMovement(horse, initialDiceSteps):
    direction = FORWARD
    remainingSteps = initialDiceSteps

    while remainingSteps > 0:
        horse.moveOneCell(direction)
        remainingSteps -= 1

        resolvePassThroughMarkerIfPresent(horse, direction, remainingSteps)
        # Hàm trên có thể đổi direction, cộng bước hoặc dừng toàn bộ chuyển động.

    resolveExactStopMarkerIfPresent(horse)
    resolveTraditionalRuleIfApplicable(horse)
```

### 8.2. Quy tắc chuyển động khi đi qua marker

| Tình huống | Hướng sau xử lý | Kết quả |
|---|---|---|
| Đang tiến, gặp Tiến N | Giữ hướng tiến | Cộng thêm N bước vào số bước tiến còn lại. |
| Đang tiến, gặp Lùi N | Đổi sang lùi | Bỏ số bước tiến còn lại; bắt đầu lùi đúng N bước. |
| Đang lùi, gặp Lùi N | Tiếp tục lùi | Cộng dồn N bước vào số bước lùi còn lại. |
| Đang lùi, gặp Tiến N | Đổi sang tiến | Bỏ số bước lùi còn lại; bắt đầu tiến đúng N bước. |
| Gặp Khiên chắn | Không đổi hướng | Marker biến mất. Nếu quân chưa có Khiên chắn, cấp một lớp; nếu đã có, marker vẫn mất nhưng không cộng thêm lớp. |
| Gặp Đóng băng không có Khiên | Dừng ngay | Marker biến mất; xóa các bước còn lại; áp dụng trạng thái Đóng băng. |
| Gặp bẫy được Khiên chặn | Tiếp tục chuyển động | Marker bẫy biến mất; xóa một lớp Khiên; không áp dụng hình phạt. |

### 8.3. Chuỗi marker

- Các marker có thể tạo chuỗi tác động dài. Ví dụ Tiến 3 rồi Tiến 2 sẽ cộng dồn tổng cộng 5 bước bổ sung.
- Trong chuyển động cưỡng chế do Lùi, quân vẫn kích hoạt marker mà nó đi qua.
- Nếu đang lùi và gặp Tiến, quân lập tức đổi hướng tiến theo số bước mới.
- Nếu đang lùi và gặp thêm Lùi, số bước lùi mới được cộng dồn với số bước lùi còn lại.
- Marker dừng đúng ô được kiểm tra sau khi mọi bước chuyển động hiện tại kết thúc, bất kể điểm dừng sinh ra từ xúc xắc, Tiến hay Lùi.

---

## 9. Quy tắc chi tiết theo từng thẻ

### 9.1. Tiến 2 / 3 / 4 bước

- Các thẻ Tiến là marker hỗ trợ kích hoạt khi quân ngựa đi qua ô chứa marker.
- Marker biến mất ngay khi kích hoạt.
- Số bước được cộng dồn vào chuyển động tiến hiện tại.
- Nếu quân đang bị đẩy lùi, phần lùi còn lại bị bỏ và quân chuyển sang tiến đúng số bước trên thẻ.
- Trong các bước bổ sung, quân tiếp tục kích hoạt marker bình thường.

### 9.2. Lùi 3 / 4 / 5 bước

- Các thẻ Lùi là bẫy kích hoạt khi quân ngựa đi qua ô chứa marker.
- Marker biến mất ngay khi kích hoạt.
- Nếu quân đang tiến, bỏ các bước tiến còn lại và bắt đầu lùi đúng số bước trên thẻ.
- Nếu quân đang lùi, cộng thêm số bước lùi mới vào số bước lùi còn lại.
- Trong quá trình lùi, mọi marker đi qua vẫn được xử lý bình thường.
- Nếu quân có Khiên chắn, bẫy bị tiêu hao nhưng không tạo hiệu ứng; Khiên chắn cũng bị tiêu hao.

### 9.3. Khiên chắn

- Khiên chắn là marker hỗ trợ kích hoạt khi quân ngựa đi qua ô chứa marker.
- Marker biến mất ngay khi kích hoạt.
- Một quân chỉ giữ tối đa **một lớp Khiên chắn**.
- Nếu quân đã có Khiên mà tiếp tục gặp marker Khiên khác, marker mới vẫn biến mất nhưng quân không tích lũy thêm lớp.
- Khiên tồn tại vô thời hạn cho tới khi vô hiệu hóa một bẫy hoặc quân ngựa bị đá về chuồng.
- Khiên chặn được: Lùi bước, Đóng băng và Về chuồng.
- Khiên **không** chặn được: Hoán vị.

### 9.4. Đóng băng

- Đóng băng là bẫy kích hoạt ngay khi quân ngựa đi qua marker.
- Nếu không có Khiên chắn, quân dừng ngay tại ô marker và bỏ toàn bộ số bước còn lại.
- Marker biến mất ngay sau khi kích hoạt.
- Quân không được chọn để di chuyển trong **2 lượt bình thường tiếp theo** của chủ quân.
- Lượt thưởng do tung được 6 không làm giảm bộ đếm Đóng băng và không cho phép chọn quân đang bị khóa.
- Quân bị đóng băng vẫn có thể bị quân khác đá về chuồng theo luật truyền thống.
- Nếu bị đá về chuồng trong thời gian Đóng băng, trạng thái Đóng băng bị xóa ngay.

### 9.5. Về chuồng

- Về chuồng là bẫy chỉ kích hoạt khi quân ngựa **dừng chính xác** tại ô marker.
- Marker biến mất ngay khi kích hoạt.
- Nếu quân không có Khiên chắn, đưa quân về chuồng ngay lập tức.
- Nếu quân có Khiên chắn, marker vẫn biến mất nhưng hiệu ứng bị vô hiệu; lớp Khiên cũng bị tiêu hao.

### 9.6. Xuất chuồng

- Xuất chuồng là marker hỗ trợ chỉ kích hoạt khi quân ngựa **dừng chính xác** tại ô marker.
- Marker biến mất ngay khi kích hoạt, kể cả khi không tạo được hiệu ứng.
- Nếu chủ của quân kích hoạt còn quân trong chuồng, đưa thêm một quân ra ô xuất phát theo rule truyền thống đang có trong MVP.
- Nếu ô xuất phát có quân đối thủ, áp dụng xử lý đá về chuồng của rule truyền thống.
- Nếu trong chuồng không còn quân, không tạo hiệu ứng bổ sung.
- Quân vừa kích hoạt Xuất chuồng vẫn giữ nguyên vị trí dừng hiện tại.

### 9.7. Hoán vị

- Hoán vị là marker đặc biệt chỉ kích hoạt khi quân ngựa **dừng chính xác** tại ô marker.
- Marker luôn biến mất sau khi được kích hoạt, kể cả khi không đủ điều kiện tạo hiệu ứng.
- Người điều khiển quân vừa kích hoạt chọn một quân hợp lệ thuộc danh tính hiển thị trên marker để đổi vị trí.
- Quân được chọn bắt buộc phải đang nằm trên đường đi chung.
- Không được chọn quân đang trong chuồng, đã về đích hoặc đang ở đường về đích riêng.
- Nếu danh tính hiển thị chính là chủ của quân vừa kích hoạt, Hoán vị không tạo hiệu ứng và marker biến mất.
- Nếu danh tính hiển thị không có quân hợp lệ trên đường đi chung, Hoán vị không tạo hiệu ứng và marker biến mất.
- Khiên chắn **không** vô hiệu hóa Hoán vị.

---

## 10. Vòng đời marker và trạng thái ngựa

### 10.1. TTL của marker đã đặt

| Nhóm marker | Các thẻ | TTL |
|---|---|---|
| Đi qua - 3 vòng | Tiến 2, Tiến 3, Tiến 4, Khiên chắn, Lùi 3, Lùi 4, Lùi 5, Đóng băng | 3 vòng |
| Dừng đúng ô - 5 vòng | Xuất chuồng, Về chuồng, Hoán vị | 5 vòng |

### 10.2. Cách đếm vòng marker

TTL marker được đếm theo các lượt bình thường tiếp theo của **danh tính hiển thị** trên marker, kể cả khi danh tính đó không phải người đặt thật. Lượt thưởng do tung được 6 không tính thêm vòng.

| TTL marker | Thời điểm xóa nếu chưa kích hoạt |
|---|---|
| 3 vòng | Xóa ngay khi bắt đầu lượt bình thường thứ tư tiếp theo của danh tính hiển thị. |
| 5 vòng | Xóa ngay khi bắt đầu lượt bình thường thứ sáu tiếp theo của danh tính hiển thị. |

### 10.3. Khi danh tính hiển thị rời trận hoặc hoàn thành toàn bộ quân

Nếu danh tính hiển thị thoát khỏi trận hoặc đã hoàn thành toàn bộ quân sau khi marker được đặt, marker vẫn tiếp tục tồn tại. Chế độ đếm TTL chuyển sang **vòng toàn bàn chơi**. Số vòng TTL còn lại được giữ nguyên tại thời điểm chuyển chế độ.

> **Quy ước triển khai tối thiểu:** Khi chuyển từ lượt của danh tính hiển thị sang vòng toàn bàn, server giữ nguyên `remainingTTL`. Mỗi vòng toàn bàn hoàn tất làm giảm `remainingTTL` một đơn vị. Đây là cách biểu diễn trực tiếp ý nghĩa "chuyển sang đếm theo vòng toàn bàn" và tránh xóa marker đột ngột.

### 10.4. Trạng thái Đóng băng

Nếu quân của A bị Đóng băng trong lượt của B, hai lượt bình thường tiếp theo của A đều không thể chọn quân đó. Sau khi A hoàn thành lượt bình thường thứ hai, trạng thái Đóng băng được xóa. Nếu quân bị đá về chuồng sớm hơn, trạng thái được xóa ngay.

---

## 11. Thiết kế giao diện desktop và mobile

### 11.1. Bố cục bàn chơi

- Giữ bàn cờ là vùng trung tâm; marker được neo trực tiếp lên từng ô đường đi chung.
- Marker sử dụng location icon hình tròn để người chơi nhìn thấy có Rune tại vị trí đó nhưng không biết nội dung Rune.
- Bên trong circle là avatar của danh tính hiển thị; màu vòng tròn hoặc nền marker theo màu của danh tính hiển thị.
- Không sử dụng hình minh họa loại thẻ trên marker công khai.
- Không hiển thị TTL marker cho người chơi khác.

### 11.2. Tooltip marker của người đặt thật

| Nền tảng | Tương tác | Thông tin hiển thị |
|---|---|---|
| Desktop | Hover marker | Chỉ hiển thị loại Rune mà người chơi đó đã đặt. |
| Mobile / cảm ứng | Chạm marker để mở tooltip nhỏ | Chỉ hiển thị loại Rune mà người chơi đó đã đặt. |
| Người không phải người đặt thật | Hover hoặc chạm | Không xem được loại Rune hoặc TTL. |

### 11.3. Hand array ở góc dưới bên trái

- Hiển thị tối đa 10 thẻ đang còn hạn.
- Mỗi thẻ hiển thị số vòng còn lại trước khi hết hạn.
- Hiển thị trạng thái số lượng thẻ: ví dụ `7/10`.
- Khi array đầy, nút bốc thẻ bị vô hiệu hóa và hiển thị lý do ngắn gọn.
- Khi có thưởng đang chờ, hiển thị trạng thái pending reward mà không tự vượt quá giới hạn 10 thẻ.

### 11.4. Pha đặt thẻ đồng thời

- Hiển thị trạng thái pha rõ ràng để mọi người biết đang được phép rải marker.
- Khi chọn một thẻ trong array, highlight các ô đường đi chung hợp lệ và ẩn hoặc khóa các ô không hợp lệ.
- Khi người chơi chọn ô, mở bước chọn danh tính hiển thị trước khi gửi yêu cầu đặt marker.
- Nếu server từ chối do ô vừa bị người khác chiếm trước, giữ nguyên thẻ trong array và thông báo đặt thất bại.

### 11.5. Animation khi kích hoạt

- Quân ngựa di chuyển theo từng ô để người chơi nhìn thấy chuỗi Rune được resolve theo thứ tự.
- Khi marker kích hoạt, marker biến mất và animation ngắn thể hiện hiệu ứng: mũi tên tiến, mũi tên lùi, lớp Khiên, đóng băng, về chuồng hoặc đổi chỗ.
- Animation được phép tiết lộ hiệu ứng vừa xảy ra nhưng không bao giờ tiết lộ người đặt thật.

---

## 12. Mô hình dữ liệu và sự kiện server đề xuất

Phần này là đặc tả kỹ thuật tham chiếu để triển khai nhất quán. Tên trường có thể thay đổi theo codebase, nhưng ý nghĩa gameplay không được thay đổi.

### 12.1. CardDefinition

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `cardType` | enum | `LEAVE_STABLE`, `SHIELD`, `ADVANCE_2`, `ADVANCE_3`, `ADVANCE_4`, `BACK_3`, `BACK_4`, `BACK_5`, `FREEZE`, `SEND_HOME`, `SWAP`. |
| `category` | enum | `SUPPORT`, `TRAP` hoặc `SPECIAL`. |
| `triggerMode` | enum | `PASS_THROUGH` hoặc `EXACT_STOP`. |
| `markerTTL` | number | 3 hoặc 5 vòng tùy loại. |
| `stepValue` | number \| null | Giá trị bước cho các thẻ Tiến và Lùi. |

### 12.2. HeldCard

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `heldCardId` | string | ID instance thẻ trong hand array. |
| `ownerPlayerId` | string | Người đang giữ thẻ. |
| `cardType` | enum | Loại Rune. |
| `remainingHandRounds` | number | Khởi tạo 2; giảm theo lượt bình thường của owner. |
| `source` | enum | `DRAW` hoặc `HONESTY_REWARD`. |

### 12.3. BoardMarker

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `markerId` | string | ID marker. |
| `cellId` | string | Ô đường đi chung đang chứa marker. |
| `cardType` | enum | Loại Rune bí mật. |
| `realPlacerId` | string | Người đặt thật; chỉ server và chính người đặt thật được dùng để hiển thị tooltip riêng. |
| `displayedIdentityId` | string | Danh tính công khai trên avatar marker. |
| `remainingMarkerRounds` | number | Khởi tạo 3 hoặc 5. |
| `ttlMode` | enum | `DISPLAYED_IDENTITY_TURN` hoặc `FULL_TABLE_ROUND`. |
| `createdAtPhaseId` | string | Pha đặt marker tạo instance này. |

### 12.4. HorseState

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `horseId` | string | ID quân ngựa. |
| `ownerPlayerId` | string | Chủ quân. |
| `position` | object | Chuồng, ô xuất phát, ô đường đi chung, đường về đích riêng hoặc đích. |
| `hasShield` | boolean | Tối đa một lớp Khiên chắn. |
| `freezeOwnerTurnsRemaining` | number | 0 hoặc số lượt bình thường còn bị khóa; khởi tạo 2 khi Đóng băng. |

### 12.5. RunePlayerState

| Trường | Kiểu dữ liệu | Ý nghĩa |
|---|---|---|
| `drawCount` | number | Số thẻ đã bốc ngẫu nhiên; tối đa 25. |
| `hand` | HeldCard[] | Tối đa 10 thẻ. |
| `pendingRewards` | CardType[] | Hàng chờ thưởng trung thực; có thể tích lũy nhiều thẻ. |
| `honestPlacementStreak` | number | 0–4 trước khi tạo thưởng; reset khi giả danh hoặc sau khi thưởng. |

### 12.6. Sự kiện server chính

| Event | Ý nghĩa |
|---|---|
| `TURN_STARTED` | Bắt đầu lượt bình thường; xóa held card hết hạn và cập nhật TTL liên quan. |
| `CARDS_DRAWN` | Người đang đến lượt bốc một hoặc nhiều thẻ. |
| `PLACEMENT_PHASE_OPENED` | Mở quyền đặt đồng thời cho tất cả người chơi. |
| `MARKER_PLACE_REQUESTED` | Client gửi card instance, cellId và displayedIdentityId. |
| `MARKER_PLACED` | Server chấp nhận marker đầu tiên tại ô. |
| `MARKER_PLACE_REJECTED` | Server từ chối vì ô không hợp lệ hoặc đã bị chiếm; held card không mất. |
| `DICE_ROLLED` | Người đang đến lượt tung xúc xắc. |
| `HORSE_STEP_MOVED` | Quân nhảy một ô; dùng để animate và resolve marker. |
| `MARKER_TRIGGERED` | Marker kích hoạt và bị xóa. |
| `HORSE_STATUS_CHANGED` | Áp dụng hoặc xóa Shield, Freeze, về chuồng hoặc swap. |
| `HONESTY_REWARD_GRANTED` | Công bố người nhận thưởng; thêm vào hand hoặc pending queue. |
| `MARKER_EXPIRED` | TTL marker hết; xóa khỏi bàn cờ. |
| `HELD_CARD_EXPIRED` | Held card quá 2 vòng; xóa khỏi hand. |

---

## 13. Kịch bản kiểm thử chấp nhận

| ID | Mục tiêu | Thiết lập | Kết quả mong đợi |
|---|---|---|---|
| TC-01 | Giới hạn bốc cá nhân | A đã bốc 24 thẻ và hand còn chỗ. | A chỉ có thể bốc thêm tối đa 1 thẻ trong ván. |
| TC-02 | Array đầy | A đang giữ 10 thẻ. | Nút bốc bị khóa; thẻ thưởng mới đi vào pending queue. |
| TC-03 | Hết hạn held card | A bốc thẻ ở lượt hiện tại và không đặt trong 2 lượt bình thường tiếp theo. | Thẻ bị xóa khi bắt đầu lượt bình thường thứ ba tiếp theo của A. |
| TC-04 | Lượt thưởng do số 6 | A tung được 6. | Chỉ lặp lại tung xúc xắc, chọn quân và di chuyển; không bốc và không mở placement phase. |
| TC-05 | Xung đột đặt marker | A và B cùng đặt marker tại một ô trống. | Request đến server trước thành công; request sau thất bại và người đó vẫn giữ thẻ. |
| TC-06 | Tiến cộng dồn | Ngựa đi qua Tiến 3 rồi Tiến 2. | Ngựa nhận tổng cộng 5 bước tiến bổ sung. |
| TC-07 | Tiến gặp Lùi | Ngựa đang tiến còn bước và đi qua Lùi 4. | Bỏ bước tiến còn lại; ngựa bắt đầu lùi 4 bước. |
| TC-08 | Lùi gặp Lùi | Ngựa đang lùi còn 3 bước và đi qua Lùi 3. | Ngựa tiếp tục lùi tổng cộng 6 bước. |
| TC-09 | Lùi gặp Tiến | Ngựa đang lùi và đi qua Tiến 3. | Bỏ lùi còn lại; đổi hướng và tiến 3 bước. |
| TC-10 | Khiên chặn bẫy | Ngựa có Khiên và đi qua Đóng băng. | Đóng băng mất; Khiên mất; ngựa tiếp tục số bước còn lại. |
| TC-11 | Khiên thứ hai | Ngựa đang có Khiên và đi qua marker Khiên. | Marker Khiên mới mất; ngựa vẫn chỉ có một lớp. |
| TC-12 | Đóng băng | Ngựa không có Khiên đi qua Đóng băng. | Ngựa dừng ngay và bị khóa trong 2 lượt bình thường tiếp theo của chủ quân. |
| TC-13 | Đá quân đang đóng băng | Ngựa đang đóng băng bị đá về chuồng. | Trạng thái Đóng băng bị xóa ngay. |
| TC-14 | Xuất chuồng không còn quân | Ngựa dừng đúng marker Xuất chuồng nhưng chủ quân không còn ngựa trong chuồng. | Marker mất; không có hiệu ứng bổ sung. |
| TC-15 | Swap hợp lệ | Ngựa A dừng đúng Hoán vị giả danh B; B có quân trên đường chung. | A chọn một quân hợp lệ của B và hai quân đổi vị trí. |
| TC-16 | Swap tự giả danh | Ngựa A dừng đúng Hoán vị có displayedIdentity là A. | Không swap; marker vẫn mất. |
| TC-17 | Marker hết hạn 3 vòng | Marker Tiến chưa bị kích hoạt. | Xóa khi bắt đầu lượt bình thường thứ tư tiếp theo của displayedIdentity. |
| TC-18 | Displayed identity rời trận | Marker còn TTL khi displayedIdentity rời trận. | Marker giữ remainingTTL và chuyển sang giảm theo vòng toàn bàn. |
| TC-19 | Chuỗi trung thực | A đặt marker chính danh trong 5 lượt đặt liên tiếp; lượt không đặt xen giữa. | Lượt không đặt giữ streak; sau mốc 5 tạo một support reward và reset streak. |
| TC-20 | Giả danh phá streak | A có streak 4 nhưng đặt ít nhất một marker giả danh. | Streak trở về 0. |

---

## 14. Phạm vi kế thừa, giới hạn và điểm cần lưu ý

### 14.1. Rule truyền thống được kế thừa

Các xử lý Cá Ngựa nền đã có trong MVP tiếp tục được sử dụng, bao gồm quy tắc tung xúc xắc, chọn quân, xuất chuồng theo rule truyền thống, đá quân đối thủ về chuồng khi dừng đúng ô và xử lý ô xuất phát đang có quân đối thủ. Tài liệu này không viết lại toàn bộ rule truyền thống.

### 14.2. Không bổ sung luật ngoài phạm vi đã khóa

- Không bổ sung ô an toàn hoặc miễn nhiễm Rune mới.
- Không bổ sung đồng đội trong MVP.
- Không cho phép nhiều marker cùng tồn tại tại một ô.
- Không tiết lộ danh tính người đặt thật ở bất kỳ thời điểm nào.
- Không cho phép đặt marker trong đường về đích riêng hoặc tại ô đang có quân ngựa.
- Không giữ thẻ Nhân đôi bước đi trong danh sách Rune mới.

---

## Phụ lục A. Bảng tóm tắt Rule Lock

| Hạng mục | Quy tắc đã khóa |
|---|---|
| Quota bốc | Tối đa 25 lượt bốc ngẫu nhiên cho mỗi người chơi trong một ván. |
| Hand array | Tối đa 10 thẻ còn hạn; thẻ chưa đặt hết hạn sau 2 lượt bình thường tiếp theo của chủ thẻ. |
| Lượt thưởng số 6 | Chỉ lặp từ tung xúc xắc; không bốc và không mở placement phase. |
| Placement phase | Mở sau khi active player bốc; mọi người đặt đồng thời, không giới hạn số thẻ đặt. |
| Ô hợp lệ | Chỉ ô đường đi chung; không ô đang có ngựa, không đường về đích riêng, không ô đã có marker. |
| Xung đột ô | Request server đến trước thắng; request sau thất bại và giữ thẻ. |
| Giả danh | Áp dụng cho mọi marker; true placer không bao giờ bị lộ. |
| Marker UI | Location circle + avatar + màu displayed identity; ẩn loại Rune và TTL với người khác. |
| TTL marker 3 vòng | Tiến, Khiên, Lùi, Đóng băng. |
| TTL marker 5 vòng | Xuất chuồng, Về chuồng, Hoán vị. |
| Cách đếm TTL | Theo lượt bình thường của displayed identity; rời trận hoặc hoàn thành toàn bộ quân thì chuyển sang vòng toàn bàn. |
| Đóng băng | Dừng ngay và khóa quân trong 2 lượt bình thường tiếp theo của chủ quân. |
| Khiên | Một lớp; tồn tại tới bẫy tiếp theo hoặc khi bị đá về chuồng; chặn Lùi, Freeze, Send Home; không chặn Swap. |
| Swap | Activator chọn một quân hợp lệ trên đường chung của displayed identity; tự giả danh thì không có hiệu ứng. |
| Thưởng trung thực | 5 lượt đặt chính danh liên tiếp; lượt không đặt giữ streak; giả danh reset; pending reward queue có thể tích lũy. |

---

## Phụ lục B. Artwork concept bộ thẻ Rune

Contact sheet minh họa bộ 11 thẻ Rune chính thức theo phong cách 3D low-poly bo tròn, màu sáng, thân thiện và icon đơn giản. Đây là artwork concept dùng để thống nhất định hướng hình ảnh; đội thiết kế có thể tách và tinh chỉnh asset production sau.

Tất cả các ảnh minh họa rune đã được cắt ra và để trong: `/apps/web/assets/runes/*`

- Rune dạng advance: ratio portrait
- Rune swap: ratio landscape
- Các rune còn lại: ratio portrait nhưng chiều cao ngắn hơn dạng advance 1 chút

---

*Rune Race - Internal Game Design Specification - Version 1.0*
