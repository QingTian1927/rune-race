**RUNE RACE**

**TÀI LIỆU ĐẶC TẢ LUẬT CHƠI MỚI,  
CƠ CHẾ GIẢ DANH VÀ HỆ THỐNG THẺ RUNE**

*Gameplay Rule & Rune System Specification*

| **Phiên bản**    | 1.2 - Rule Lock: cập nhật hand array và thưởng trung thực     |
|------------------|-----------------------------------------------------------|
| **Trạng thái**   | Đã cập nhật theo các quyết định gameplay được xác nhận     |
| **Phạm vi**      | MVP web multiplayer 2-4 người chơi                        |
| **Mục đích**     | Dùng cho game design, UI/UX và triển khai gameplay server |
| **Tài liệu nền** | Briefing Rune Race ban đầu và chuỗi xác nhận rule mới     |

*Tài liệu nội bộ - thiết kế chi tiết phục vụ phát triển sản phẩm*

# MỤC LỤC

**1.** Mục tiêu và phạm vi tài liệu

**2.** Nguyên tắc thiết kế và thuật ngữ

**3.** Vòng lặp gameplay của một lượt

**4.** Cơ chế bốc thẻ, hand array và phần thưởng

**5.** Danh mục thẻ Rune chính thức

**6.** Cơ chế đặt marker đồng thời

**7.** Cơ chế giả danh

**8.** Thuật toán xử lý di chuyển và chuỗi kích hoạt

**9.** Quy tắc chi tiết theo từng thẻ

**10.** Vòng đời marker và trạng thái ngựa

**11.** Thiết kế giao diện desktop và mobile

**12.** Mô hình dữ liệu và sự kiện server đề xuất

**13.** Kịch bản kiểm thử chấp nhận

**14.** Phạm vi kế thừa, giới hạn và điểm cần lưu ý

**Phụ lục A.** Bảng tóm tắt rule lock

**Phụ lục B.** Artwork concept bộ thẻ Rune

| **Quy tắc ưu tiên:** Tài liệu này thay thế các mô tả Rune cũ khi có mâu thuẫn. Luật Cá Ngựa truyền thống đang tồn tại trong MVP vẫn được kế thừa, trừ những điểm được tài liệu này sửa đổi hoặc mở rộng rõ ràng. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## Thay đổi chính trong phiên bản 1.2

- Mỗi người chơi có 2 quân ngựa; thắng khi đưa đủ 2 quân về đích.

- Xuất Chuồng không còn là marker. Thẻ được bấm trực tiếp từ hand array sau placement phase và trước khi tung xúc xắc của lượt bình thường.

- Xuất Chuồng luôn bị tiêu hao sau khi bấm, kể cả khi không xuất được quân.

- Quân vừa được đưa ra ô xuất phát kích hoạt marker tại ô đó như khi đi vào một ô bình thường.

- Hand array thông thường chỉ cho phép bốc thêm thẻ khi đang giữ dưới 5 thẻ còn hạn.

- Sau 5 lượt đặt thẻ trung thực liên tiếp, người chơi được chọn 1 thẻ hỗ trợ tại pha bốc và đặt thẻ của lượt bình thường tiếp theo. Thẻ thưởng được append trực tiếp vào hand array kể cả khi đang có từ 5 thẻ trở lên.

# 1. Mục tiêu và phạm vi tài liệu

Tài liệu này đặc tả phiên bản luật Rune Race mới dành cho MVP. Trọng tâm là lớp gameplay bổ sung trên nền luật Cá Ngựa truyền thống: mỗi người chơi điều khiển 2 quân ngựa, bốc thẻ ngẫu nhiên, dùng trực tiếp thẻ Xuất Chuồng từ hand array, rải marker bí mật trên đường đi chung, kích hoạt thẻ theo chuyển động từng bước, đặt thẻ đồng thời và giả danh người đặt thẻ.

- Định nghĩa chính xác vòng lặp lượt chơi và thời điểm mở pha đặt thẻ.

- Khóa danh sách 11 loại Rune chính thức; loại bỏ thẻ Nhân đôi bước đi khỏi bộ thẻ mới.

- Khóa thay đổi số quân: mỗi người chơi chỉ có 2 quân ngựa và thắng khi đưa đủ 2 quân về đích.

- Khóa thay đổi của Xuất Chuồng: đây là thẻ dùng trực tiếp từ hand array, không còn tạo marker trên bàn cờ.

- Mô tả vòng đời riêng của thẻ đang nằm trong array và marker đã được rải trên bàn cờ.

- Mô tả cơ chế giả danh, chuỗi trung thực và phần thưởng hỗ trợ.

- Quy định giao diện marker bí mật và tooltip riêng cho người đặt thật.

- Cung cấp dữ liệu và kịch bản kiểm thử để đội phát triển triển khai nhất quán.

# 2. Nguyên tắc thiết kế và thuật ngữ

## 2.1. Nguyên tắc thiết kế

| **Nguyên tắc**                  | **Ý nghĩa triển khai**                                                                                                                                      |
|---------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Kế thừa luật truyền thống       | Rune Race không thay thế phần luật Cá Ngựa cơ bản đã tồn tại trong MVP; hệ thống Rune tạo thêm lớp chiến thuật và tâm lý.                                   |
| Hai quân mỗi người              | Mỗi người chơi có 2 quân ngựa. Người chơi thắng khi đưa đủ 2 quân về đích.                                                                                |
| Thông tin công khai có chủ đích | Người chơi nhìn thấy vị trí marker và danh tính công khai, nhưng không biết loại thẻ hoặc người đặt thật.                                                   |
| Chuyển động từng bước           | Mỗi ô đi qua đều có thể làm thay đổi hướng hoặc số bước còn lại. Server phải resolve theo từng bước, không dịch chuyển trực tiếp từ điểm đầu tới điểm cuối. |
| Tác động hai chiều              | Bất kỳ quân ngựa nào đi vào marker đều có thể được hỗ trợ hoặc bị phạt, kể cả quân của người đặt thật.                                                      |
| Chaos có kiểm soát              | Tất cả người chơi có thể đặt thẻ đồng thời trong cùng một pha; xung đột vị trí được server xử lý theo thứ tự nhận thao tác.                                 |

## 2.2. Thuật ngữ

| **Thuật ngữ**              | **Định nghĩa**                                                                                                                             |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| Lượt bình thường           | Lượt chơi bắt đầu từ bước bốc thẻ của người chơi đang đến lượt. Đây là đơn vị được dùng để đếm nhiều loại thời hạn.                        |
| Lượt thưởng do tung được 6 | Lượt phụ chỉ lặp lại từ bước tung xúc xắc. Không mở lại bước bốc thẻ hoặc pha đặt thẻ đồng thời; không được tính là một vòng thời hạn mới. |
| Hand array                 | Khu vực chứa các thẻ còn hạn mà người chơi đang giữ, hiển thị ở góc dưới bên trái giao diện. Ngưỡng bốc thẻ thường là dưới 5 thẻ; thẻ thưởng trung thực được phép append vượt ngưỡng này.                                          |
| Marker                     | Dấu vị trí bí mật được tạo khi một thẻ đặt được rải lên đường đi chung. Marker không tiết lộ loại Rune. Xuất Chuồng không tạo marker.       |
| Thẻ dùng trực tiếp          | Thẻ được kích hoạt từ hand array mà không rải xuống bàn cờ. Trong phiên bản này, Xuất Chuồng là thẻ dùng trực tiếp duy nhất.                 |
| Thẻ đặt được                | Các Rune có thể rải xuống đường đi chung để tạo marker: Khiên, Tiến, Lùi, Đóng băng, Về chuồng và Hoán vị.                                   |
| Người đặt thật             | Người thực hiện thao tác rải thẻ. Danh tính này không bao giờ được công bố cho người chơi khác.                                            |
| Danh tính hiển thị         | Người chơi được gắn avatar và màu trên marker. Có thể là người đặt thật hoặc người bị giả danh.                                            |
| Marker đi qua              | Marker kích hoạt ngay khi quân ngựa đi qua ô chứa marker, kể cả quân chưa dừng lại tại ô đó.                                               |
| Marker dừng đúng ô         | Marker chỉ kích hoạt nếu chuyển động kết thúc chính xác tại ô chứa marker.                                                                 |
| Đường đi chung             | Các ô có thể được sử dụng bởi nhiều người chơi. Chỉ những ô này mới được phép đặt marker.                                                  |

# 3. Vòng lặp gameplay của một lượt

## 3.1. Lượt bình thường

| **Bước** | **Tên bước**          | **Mô tả**                                                                                                                                 |
|----------|-----------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| 1        | Mở lượt bình thường   | Xử lý thẻ trong hand array đã hết hạn của người chơi đang đến lượt trước khi người này bốc, đặt hoặc dùng thẻ.                            |
| 2        | Bốc thẻ               | Người chơi đang đến lượt có thể bốc 0 hoặc nhiều thẻ ngẫu nhiên, miễn tổng lượt bốc cá nhân chưa vượt 25 và hand array đang có dưới 5 thẻ. Nếu người chơi có reward trung thực đến hạn nhận ở lượt này, hệ thống mở lựa chọn 1 thẻ hỗ trợ trong chính pha bốc và đặt thẻ rồi append thẻ đã chọn vào hand array, kể cả khi array đang có từ 5 thẻ trở lên.  |
| 3        | Pha đặt thẻ đồng thời | Tất cả người chơi đang giữ thẻ đặt được có thể rải không giới hạn số thẻ còn hạn xuống các ô hợp lệ. Người chơi được phép giữ lại thẻ.  |
| 4        | Cửa sổ dùng Xuất Chuồng | Sau pha đặt marker, người đang đến lượt có thể bấm một hoặc nhiều thẻ Xuất Chuồng đang giữ. Mỗi lần bấm đều tiêu hao thẻ ngay.            |
| 5        | Tung xúc xắc          | Chỉ người đang đến lượt tung xúc xắc.                                                                                                     |
| 6        | Chọn quân ngựa        | Người đang đến lượt chọn một quân ngựa hợp lệ theo luật Cá Ngựa truyền thống và các trạng thái hiện tại.                                  |
| 7        | Di chuyển từng bước   | Quân ngựa nhảy theo số xúc xắc. Server resolve từng ô và xử lý marker trên đường đi theo luật tại Mục 8.                                  |
| 8        | Kết thúc lượt         | Cập nhật bộ đếm trạng thái, vòng đời marker và các hiệu ứng liên quan.                                                                    |

## 3.2. Lượt thưởng do tung được 6

Nếu người chơi tung được 6 và được thêm lượt theo luật truyền thống, quy trình chỉ lặp lại từ bước tung xúc xắc. Không được bốc thêm Rune, không mở thêm pha đặt thẻ đồng thời và không mở lại cửa sổ dùng Xuất Chuồng.

| **Có thực hiện lại?**      | **Bốc thẻ** | **Pha đặt đồng thời** | **Dùng Xuất Chuồng** | **Tung xúc xắc** | **Chọn quân** | **Di chuyển** |
|----------------------------|-------------|-----------------------|----------------------|------------------|---------------|---------------|
| Lượt thưởng do tung được 6 | Không       | Không                 | Không                | Có               | Có            | Có            |

# 4. Cơ chế bốc thẻ, hand array và phần thưởng

## 4.1. Giới hạn bốc thẻ cá nhân

- Mỗi người chơi được bốc tối đa 25 thẻ ngẫu nhiên trong một ván.

- Đây là giới hạn cá nhân, không phải giới hạn dùng chung cho toàn bộ trận.

- Trong bước bốc thẻ của lượt bình thường, người chơi có thể bốc nhiều thẻ liên tiếp, miễn còn quota và hand array chưa đầy.

- Không được bốc thẻ trong lượt thưởng do tung được 6.

- Thẻ thưởng từ chuỗi trung thực không tính vào quota 25 thẻ bốc cá nhân.

## 4.2. Hand array và ngưỡng bốc thẻ thường

- Hand array hiển thị các thẻ còn hạn mà người chơi đang giữ ở góc dưới bên trái màn hình.

- Người chơi chỉ được bốc thêm thẻ thường khi hand array đang có dưới 5 thẻ còn hạn.

- Khi hand array đang có từ 5 thẻ trở lên, nút bốc thẻ thường bị vô hiệu hóa.

- Thẻ thưởng trung thực là ngoại lệ: sau khi người chơi chọn thẻ hỗ trợ, hệ thống append thẻ thưởng trực tiếp vào hand array kể cả khi array đang có từ 5 thẻ trở lên.

- Vì reward có thể được nhận nhiều lần, hand array có thể tạm thời tăng lên 6, 7, 8 hoặc nhiều thẻ hơn. Trong trạng thái này, người chơi vẫn không được bốc thẻ thường cho đến khi số thẻ còn hạn giảm xuống dưới 5.

- Người chơi có thể giữ thẻ để đặt hoặc dùng ở lượt sau nếu thẻ vẫn còn hạn.

- Mỗi thẻ trong array phải hiển thị số vòng còn lại.

## 4.3. Hạn của thẻ chưa đặt

Một thẻ được bốc lên hand array sẽ hết hạn sau 2 vòng tính theo các lượt bình thường tiếp theo của chính người đã bốc thẻ. Lượt thưởng do tung được 6 không làm giảm thời hạn. Quy tắc này áp dụng cả với Xuất Chuồng nếu thẻ chưa được dùng.

| **Mốc**                                   | **Trạng thái của thẻ A vừa bốc**                             |
|-------------------------------------------|--------------------------------------------------------------|
| Ngay trong lượt bốc                       | Còn hạn; có thể đặt trong pha đồng thời hoặc dùng nếu là Xuất Chuồng. |
| Lượt bình thường tiếp theo của chủ thẻ    | Đã trải qua vòng thứ nhất.                                   |
| Lượt bình thường tiếp theo nữa            | Đã trải qua vòng thứ hai.                                    |
| Bắt đầu lượt bình thường thứ ba tiếp theo | Xóa thẻ khỏi array trước khi mở bước bốc và pha đặt thẻ.     |

## 4.4. Chuỗi trung thực và thẻ thưởng

- Một lượt của người chơi được tính là trung thực nếu người đó đặt ít nhất một marker trong pha đặt thẻ và tất cả marker do người đó đặt trong pha đều sử dụng danh tính hiển thị là chính mình.

- Một lượt không đặt marker giữ nguyên bộ đếm trung thực hiện tại.

- Chỉ cần có ít nhất một marker giả danh trong lượt, bộ đếm trung thực của người đặt thật trở về 0.

- Khi người chơi hoàn thành 5 lượt trung thực liên tiếp, phần thưởng không được thêm ngay trong lượt thứ năm. Hệ thống đánh dấu 1 reward đến hạn nhận ở lượt bình thường tiếp theo của chính người chơi đó.

- Tại pha bốc và đặt thẻ của lượt bình thường tiếp theo, người chơi được chọn 1 trong 5 thẻ hỗ trợ: Xuất Chuồng, Khiên Chắn, Tiến 2 bước, Tiến 3 bước hoặc Tiến 4 bước.

- Cơ chế chọn reward được coi như một lần bốc thẻ đặc biệt: người chơi chủ động chọn loại thẻ thay vì nhận ngẫu nhiên.

- Thẻ thưởng được append trực tiếp vào hand array ngay sau khi chọn, kể cả khi hand array đang có từ 5 thẻ trở lên. Không dùng hàng chờ pending reward do array đầy.

- Nếu người chơi không chọn trước khi hết thời gian cho phép, hệ thống tự chọn ngẫu nhiên 1 trong 5 thẻ hỗ trợ và append vào hand array.

- Thẻ thưởng có hạn 2 vòng của chính người nhận, tính từ thời điểm được append vào hand array. Lượt thưởng do tung được 6 không làm giảm thời hạn.

- Thẻ thưởng không tính vào quota 25 thẻ bốc cá nhân.

- Người chơi có thể sử dụng ngay thẻ thưởng trong chính lượt nhận thưởng như một thẻ vừa bốc được. Nếu chọn Xuất Chuồng, thẻ có thể được dùng trong cửa sổ Xuất Chuồng của cùng lượt; nếu chọn một thẻ tạo marker, thẻ có thể được đặt ngay trong placement phase hiện tại.

- Sau khi người chơi nhận reward ở lượt bình thường tiếp theo, bộ đếm trung thực reset về 0. Nếu người chơi tiếp tục đặt marker hoàn toàn chính danh trong placement phase của lượt nhận reward, lượt đó được tính là lượt trung thực đầu tiên của chuỗi mới.

- Hệ thống công bố cho tất cả người chơi rằng người chơi A đã nhận 1 thẻ hỗ trợ vì chuỗi trung thực. Không tiết lộ A đã chọn thẻ gì, số lượng thẻ A đang giữ hoặc thời hạn còn lại của thẻ thưởng.

# 5. Danh mục thẻ Rune chính thức

Bộ Rune phiên bản mới gồm 11 loại thẻ. Thẻ Nhân đôi bước đi trong briefing cũ không còn nằm trong danh sách chính thức.

| **Nhóm** | **Tên thẻ** | **Kích hoạt** | **TTL marker** | **Vai trò**                                                                                                            |
|----------|-------------|---------------|----------------|------------------------------------------------------------------------------------------------------------------------|
| Hỗ trợ   | Xuất chuồng | Dùng trực tiếp từ hand array | Không áp dụng | Trong cửa sổ trước khi tung xúc xắc của lượt bình thường, chủ thẻ bấm thẻ để thử đưa một quân từ chuồng ra ô xuất phát. Thẻ luôn bị tiêu hao sau khi bấm. |
| Hỗ trợ   | Khiên chắn  | Đi qua        | 3 vòng         | Cấp tối đa một lớp bảo vệ cho quân kích hoạt. Lớp này chặn một bẫy tiếp theo thuộc nhóm Lùi, Đóng băng hoặc Về chuồng. |
| Hỗ trợ   | Tiến 2 bước | Đi qua        | 3 vòng         | Cộng thêm 2 bước tiến vào chuyển động hiện tại.                                                                        |
| Hỗ trợ   | Tiến 3 bước | Đi qua        | 3 vòng         | Cộng thêm 3 bước tiến vào chuyển động hiện tại.                                                                        |
| Hỗ trợ   | Tiến 4 bước | Đi qua        | 3 vòng         | Cộng thêm 4 bước tiến vào chuyển động hiện tại.                                                                        |
| Bẫy      | Lùi 3 bước  | Đi qua        | 3 vòng         | Buộc quân kích hoạt chuyển sang lùi 3 bước; marker biến mất sau khi kích hoạt.                                         |
| Bẫy      | Lùi 4 bước  | Đi qua        | 3 vòng         | Buộc quân kích hoạt chuyển sang lùi 4 bước; marker biến mất sau khi kích hoạt.                                         |
| Bẫy      | Lùi 5 bước  | Đi qua        | 3 vòng         | Buộc quân kích hoạt chuyển sang lùi 5 bước; marker biến mất sau khi kích hoạt.                                         |
| Bẫy      | Đóng băng   | Đi qua        | 3 vòng         | Dừng quân ngay tại marker và khóa quân trong 2 lượt bình thường tiếp theo của chủ quân.                                |
| Bẫy      | Về chuồng   | Dừng đúng ô   | 5 vòng         | Đưa quân kích hoạt về chuồng ngay lập tức, trừ khi được Khiên chắn vô hiệu hóa.                                        |
| Đặc biệt | Hoán vị     | Dừng đúng ô   | 5 vòng         | Người kích hoạt chọn một quân hợp lệ của danh tính hiển thị để đổi vị trí.                                             |

# 6. Cơ chế đặt marker đồng thời

## 6.1. Pha đặt thẻ

- Pha đặt thẻ đồng thời mở sau bước bốc thẻ của mỗi lượt bình thường và trước khi người đang đến lượt tung xúc xắc.

- Tất cả người chơi đang giữ thẻ đặt được và còn hạn được phép tham gia, không chỉ người đang đến lượt.

- Mỗi người có thể đặt không giới hạn số thẻ đặt được trong array trong cùng một pha. Xuất Chuồng không được rải xuống bàn cờ.

- Người chơi có quyền không đặt hoặc giữ lại một phần thẻ cho các pha sau.

## 6.2. Ô hợp lệ để đặt marker

| **Loại ô**               | **Quyền đặt**   | **Ghi chú**                                                                          |
|--------------------------|-----------------|--------------------------------------------------------------------------------------|
| Ô thuộc đường đi chung   | Được phép       | Bao gồm ô xuất phát chung của người chơi và các ô chung ngay trước cửa chuồng.       |
| Ô đang có quân ngựa đứng | Không được phép | Không thể đặt marker tại vị trí đang bị chiếm dụng.                                  |
| Đường về đích riêng      | Không được phép | Các ô chỉ quân của một người chơi sử dụng để về đích không thuộc phạm vi đặt marker. |
| Ô đã có marker           | Không được phép | Mỗi ô chỉ chứa tối đa một marker bí mật.                                             |

| **Không dùng khái niệm ô sao an toàn trong đặc tả Rune:** Luật đặt marker chỉ dựa trên điều kiện ô thuộc đường đi chung. Nếu MVP truyền thống đang có một loại ô đặc biệt khác, cần xử lý theo luật nền riêng; tài liệu này không bổ sung thêm quyền miễn nhiễm Rune cho ô đó. |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 6.3. Xử lý xung đột vị trí

Nếu nhiều người chơi gửi yêu cầu đặt marker vào cùng một ô còn trống trong cùng pha, server chấp nhận yêu cầu đến sớm nhất. Các yêu cầu đến sau thất bại; thẻ tương ứng vẫn nằm trong array của người đặt thất bại và không bị tiêu hao.

# 7. Cơ chế giả danh

## 7.1. Phạm vi áp dụng

Mọi marker đều được áp dụng cơ chế giả danh, bao gồm Khiên chắn, Tiến 2/3/4 bước, Lùi 3/4/5 bước, Đóng băng, Về chuồng và Hoán vị. Xuất Chuồng không tạo marker nên không tham gia cơ chế giả danh.

- Khi đặt marker, người đặt thật chọn một danh tính hiển thị trong số người chơi vẫn đang tham gia trận.

- Người đặt thật được phép chọn chính mình. Đây là một lượt đặt trung thực nếu mọi marker người đó đặt trong pha đều hiển thị chính mình.

- Không được chọn người đã thoát trận hoặc đã hoàn thành toàn bộ quân làm danh tính hiển thị cho marker mới.

- Danh tính người đặt thật không bao giờ được công bố, kể cả khi marker kích hoạt, hết hạn hoặc trận đấu kết thúc.

## 7.2. Thông tin công khai trên bàn cờ

- Marker hiển thị dưới dạng location icon hình tròn tại ô đường đi chung.

- Bên trong vòng tròn là avatar của danh tính hiển thị.

- Màu sắc marker sử dụng màu của danh tính hiển thị.

- Không hiển thị loại thẻ đang được đặt tại marker.

- Không hiển thị số vòng tồn tại còn lại cho người chơi khác.

# 8. Thuật toán xử lý di chuyển và chuỗi kích hoạt

## 8.1. Nguyên tắc resolve từng bước

Server không được tính điểm đến cuối cùng chỉ bằng phép cộng xúc xắc. Mỗi bước nhảy phải được resolve tuần tự vì marker có thể cộng bước, đổi hướng, dừng chuyển động hoặc tạo hiệu ứng trạng thái.

<table>
<colgroup>
<col style="width: 100%" />
</colgroup>
<thead>
<tr class="header">
<th>resolveMovement(horse, initialDiceSteps):<br />
direction = FORWARD<br />
remainingSteps = initialDiceSteps<br />
<br />
while remainingSteps &gt; 0:<br />
horse.moveOneCell(direction)<br />
remainingSteps -= 1<br />
<br />
resolvePassThroughMarkerIfPresent(horse, direction, remainingSteps)<br />
# Hàm trên có thể đổi direction, cộng bước hoặc dừng toàn bộ chuyển động.<br />
<br />
resolveExactStopMarkerIfPresent(horse)<br />
resolveTraditionalRuleIfApplicable(horse)</th>
</tr>
</thead>
<tbody>
</tbody>
</table>

## 8.2. Quy tắc chuyển động khi đi qua marker

| **Tình huống**               | **Hướng sau xử lý**  | **Kết quả**                                                                                                     |
|------------------------------|----------------------|-----------------------------------------------------------------------------------------------------------------|
| Đang tiến, gặp Tiến N        | Giữ hướng tiến       | Cộng thêm N bước vào số bước tiến còn lại.                                                                      |
| Đang tiến, gặp Lùi N         | Đổi sang lùi         | Bỏ số bước tiến còn lại; bắt đầu lùi đúng N bước.                                                               |
| Đang lùi, gặp Lùi N          | Tiếp tục lùi         | Cộng dồn N bước vào số bước lùi còn lại.                                                                        |
| Đang lùi, gặp Tiến N         | Đổi sang tiến        | Bỏ số bước lùi còn lại; bắt đầu tiến đúng N bước.                                                               |
| Gặp Khiên chắn               | Không đổi hướng      | Marker biến mất. Nếu quân chưa có Khiên chắn, cấp một lớp; nếu đã có, marker vẫn mất nhưng không cộng thêm lớp. |
| Gặp Đóng băng không có Khiên | Dừng ngay            | Marker biến mất; xóa các bước còn lại; áp dụng trạng thái Đóng băng.                                            |
| Gặp bẫy được Khiên chặn      | Tiếp tục chuyển động | Marker bẫy biến mất; xóa một lớp Khiên; không áp dụng hình phạt.                                                |

## 8.3. Chuỗi marker

- Các marker có thể tạo chuỗi tác động dài. Ví dụ Tiến 3 rồi Tiến 2 sẽ cộng dồn tổng cộng 5 bước bổ sung.

- Trong chuyển động cưỡng chế do Lùi, quân vẫn kích hoạt marker mà nó đi qua.

- Nếu đang lùi và gặp Tiến, quân lập tức đổi hướng tiến theo số bước mới.

- Nếu đang lùi và gặp thêm Lùi, số bước lùi mới được cộng dồn với số bước lùi còn lại.

- Marker dừng đúng ô được kiểm tra sau khi mọi bước chuyển động hiện tại kết thúc, bất kể điểm dừng sinh ra từ xúc xắc, Tiến hay Lùi.

# 9. Quy tắc chi tiết theo từng thẻ

## 9.1. Tiến 2 / 3 / 4 bước

Các thẻ Tiến là marker hỗ trợ kích hoạt khi quân ngựa đi qua ô chứa marker.

- Marker biến mất ngay khi kích hoạt.

- Số bước được cộng dồn vào chuyển động tiến hiện tại.

- Nếu quân đang bị đẩy lùi, phần lùi còn lại bị bỏ và quân chuyển sang tiến đúng số bước trên thẻ.

- Trong các bước bổ sung, quân tiếp tục kích hoạt marker bình thường.

## 9.2. Lùi 3 / 4 / 5 bước

Các thẻ Lùi là bẫy kích hoạt khi quân ngựa đi qua ô chứa marker.

- Marker biến mất ngay khi kích hoạt.

- Nếu quân đang tiến, bỏ các bước tiến còn lại và bắt đầu lùi đúng số bước trên thẻ.

- Nếu quân đang lùi, cộng thêm số bước lùi mới vào số bước lùi còn lại.

- Trong quá trình lùi, mọi marker đi qua vẫn được xử lý bình thường.

- Nếu quân có Khiên chắn, bẫy bị tiêu hao nhưng không tạo hiệu ứng; Khiên chắn cũng bị tiêu hao.

## 9.3. Khiên chắn

Khiên chắn là marker hỗ trợ kích hoạt khi quân ngựa đi qua ô chứa marker.

- Marker biến mất ngay khi kích hoạt.

- Một quân chỉ giữ tối đa một lớp Khiên chắn.

- Nếu quân đã có Khiên mà tiếp tục gặp marker Khiên khác, marker mới vẫn biến mất nhưng quân không tích lũy thêm lớp.

- Khiên tồn tại vô thời hạn cho tới khi vô hiệu hóa một bẫy hoặc quân ngựa bị đá về chuồng.

- Khiên chặn được Lùi bước, Đóng băng và Về chuồng.

- Khiên không chặn được Hoán vị.

## 9.4. Đóng băng

Đóng băng là bẫy kích hoạt ngay khi quân ngựa đi qua marker.

- Nếu không có Khiên chắn, quân dừng ngay tại ô marker và bỏ toàn bộ số bước còn lại.

- Marker biến mất ngay sau khi kích hoạt.

- Quân không được chọn để di chuyển trong 2 lượt bình thường tiếp theo của chủ quân.

- Lượt thưởng do tung được 6 không làm giảm bộ đếm Đóng băng và không cho phép chọn quân đang bị khóa.

- Quân bị đóng băng vẫn có thể bị quân khác đá về chuồng theo luật truyền thống.

- Nếu bị đá về chuồng trong thời gian Đóng băng, trạng thái Đóng băng bị xóa ngay.

## 9.5. Về chuồng

Về chuồng là bẫy chỉ kích hoạt khi quân ngựa dừng chính xác tại ô marker.

- Marker biến mất ngay khi kích hoạt.

- Nếu quân không có Khiên chắn, đưa quân về chuồng ngay lập tức.

- Nếu quân có Khiên chắn, marker vẫn biến mất nhưng hiệu ứng bị vô hiệu; lớp Khiên cũng bị tiêu hao.

## 9.6. Xuất chuồng

Xuất Chuồng là thẻ hỗ trợ dùng trực tiếp từ hand array. Thẻ này không được rải xuống bàn cờ, không tạo marker, không có TTL marker và không tham gia cơ chế giả danh.

- Chỉ người đang đến lượt được bấm Xuất Chuồng trong cửa sổ dùng thẻ sau pha đặt marker đồng thời và trước khi tung xúc xắc của lượt bình thường.

- Lượt thưởng do tung được 6 không mở lại cửa sổ dùng Xuất Chuồng.

- Người chơi được phép bấm nhiều thẻ Xuất Chuồng liên tiếp trong cùng một cửa sổ. Mỗi lần bấm được xử lý độc lập.

- Mỗi lần bấm luôn tiêu hao thẻ ngay và xóa thẻ khỏi hand array, kể cả khi không thể đưa quân ra chuồng.

- Nếu trong chuồng không còn quân, không có quân nào được đưa ra nhưng thẻ vẫn bị tiêu hao.

- Nếu ô xuất phát đang có quân của chính người dùng thẻ, không có quân nào được đưa ra nhưng thẻ vẫn bị tiêu hao.

- Nếu trong chuồng còn quân và ô xuất phát không bị quân của chính người dùng thẻ chiếm giữ, đưa một quân ra ô xuất phát theo rule xuất chuồng truyền thống đang có trong MVP.

- Nếu ô xuất phát đang có quân đối thủ, áp dụng xử lý đá quân đối thủ về chuồng theo rule truyền thống.

- Nếu ô xuất phát có marker, quân vừa được đưa ra được coi là đã đi vào ô đó như một bước di chuyển bình thường. Marker tại ô xuất phát được kích hoạt theo trigger mode của chính marker và tiếp tục resolve chuỗi tác động theo Mục 8.

## 9.7. Hoán vị

Hoán vị là marker đặc biệt chỉ kích hoạt khi quân ngựa dừng chính xác tại ô marker.

- Marker luôn biến mất sau khi được kích hoạt, kể cả khi không đủ điều kiện tạo hiệu ứng.

- Người điều khiển quân vừa kích hoạt chọn một quân hợp lệ thuộc danh tính hiển thị trên marker để đổi vị trí.

- Quân được chọn bắt buộc phải đang nằm trên đường đi chung.

- Không được chọn quân đang trong chuồng, đã về đích hoặc đang ở đường về đích riêng.

- Nếu danh tính hiển thị chính là chủ của quân vừa kích hoạt, Hoán vị không tạo hiệu ứng và marker biến mất.

- Nếu danh tính hiển thị không có quân hợp lệ trên đường đi chung, Hoán vị không tạo hiệu ứng và marker biến mất.

- Khiên chắn không vô hiệu hóa Hoán vị.

# 10. Vòng đời marker và trạng thái ngựa

## 10.1. TTL của marker đã đặt

| **Nhóm marker**      | **Các thẻ**                                                        | **TTL** |
|----------------------|--------------------------------------------------------------------|---------|
| Đi qua - 3 vòng      | Tiến 2, Tiến 3, Tiến 4, Khiên chắn, Lùi 3, Lùi 4, Lùi 5, Đóng băng | 3 vòng  |
| Dừng đúng ô - 5 vòng | Về chuồng, Hoán vị                                                  | 5 vòng  |

## 10.2. Cách đếm vòng marker

TTL marker được đếm theo các lượt bình thường tiếp theo của danh tính hiển thị trên marker, kể cả khi danh tính đó không phải người đặt thật. Lượt thưởng do tung được 6 không tính thêm vòng.

| **TTL marker** | **Thời điểm xóa nếu chưa kích hoạt**                                            |
|----------------|---------------------------------------------------------------------------------|
| 3 vòng         | Xóa ngay khi bắt đầu lượt bình thường thứ tư tiếp theo của danh tính hiển thị.  |
| 5 vòng         | Xóa ngay khi bắt đầu lượt bình thường thứ sáu tiếp theo của danh tính hiển thị. |

## 10.3. Khi danh tính hiển thị rời trận hoặc hoàn thành toàn bộ quân

Nếu danh tính hiển thị thoát khỏi trận hoặc đã hoàn thành toàn bộ quân sau khi marker được đặt, marker vẫn tiếp tục tồn tại. Chế độ đếm TTL chuyển sang vòng toàn bàn chơi. Số vòng TTL còn lại được giữ nguyên tại thời điểm chuyển chế độ.

| **Quy ước triển khai tối thiểu:** Khi chuyển từ lượt của danh tính hiển thị sang vòng toàn bàn, server giữ nguyên remainingTTL. Mỗi vòng toàn bàn hoàn tất làm giảm remainingTTL một đơn vị. Đây là cách biểu diễn trực tiếp ý nghĩa “chuyển sang đếm theo vòng toàn bàn” và tránh xóa marker đột ngột. |
|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

## 10.4. Trạng thái Đóng băng

Nếu quân của A bị Đóng băng trong lượt của B, hai lượt bình thường tiếp theo của A đều không thể chọn quân đó. Sau khi A hoàn thành lượt bình thường thứ hai, trạng thái Đóng băng được xóa. Nếu quân bị đá về chuồng sớm hơn, trạng thái được xóa ngay.

# 11. Thiết kế giao diện desktop và mobile

## 11.1. Bố cục bàn chơi

- Giữ bàn cờ là vùng trung tâm; marker được neo trực tiếp lên từng ô đường đi chung.

- Marker sử dụng location icon hình tròn để người chơi nhìn thấy có Rune tại vị trí đó nhưng không biết nội dung Rune.

- Bên trong circle là avatar của danh tính hiển thị; màu vòng tròn hoặc nền marker theo màu của danh tính hiển thị.

- Không sử dụng hình minh họa loại thẻ trên marker công khai.

- Không hiển thị TTL marker cho người chơi khác.

## 11.2. Tooltip marker của người đặt thật

| **Nền tảng**                    | **Tương tác**                 | **Thông tin hiển thị**                          |
|---------------------------------|-------------------------------|-------------------------------------------------|
| Desktop                         | Hover marker                  | Chỉ hiển thị loại Rune mà người chơi đó đã đặt. |
| Mobile / cảm ứng                | Chạm marker để mở tooltip nhỏ | Chỉ hiển thị loại Rune mà người chơi đó đã đặt. |
| Người không phải người đặt thật | Hover hoặc chạm               | Không xem được loại Rune hoặc TTL.              |

## 11.3. Hand array ở góc dưới bên trái

- Hiển thị toàn bộ thẻ đang còn hạn trong hand array.

- Mỗi thẻ hiển thị số vòng còn lại trước khi hết hạn.

- Hiển thị số lượng thẻ hiện tại. Ví dụ: 4 thẻ, 5 thẻ hoặc 7 thẻ.

- Khi hand array đang có từ 5 thẻ trở lên, nút bốc thẻ thường bị vô hiệu hóa và hiển thị lý do ngắn gọn.

- Thẻ reward trung thực vẫn được append vào hand array kể cả khi số lượng hiện tại đã đạt hoặc vượt 5.

- Khi reward đến hạn nhận, hiển thị giao diện chọn 1 trong 5 thẻ hỗ trợ trong pha bốc và đặt thẻ. Nếu hết thời gian, client hiển thị kết quả loại thẻ được server tự chọn ngẫu nhiên.

## 11.4. Pha đặt thẻ đồng thời

- Hiển thị trạng thái pha rõ ràng để mọi người biết đang được phép rải marker.

- Khi chọn một thẻ đặt được trong array, highlight các ô đường đi chung hợp lệ và ẩn hoặc khóa các ô không hợp lệ. Xuất Chuồng không mở giao diện chọn ô.

- Khi người chơi chọn ô, mở bước chọn danh tính hiển thị trước khi gửi yêu cầu đặt marker.

- Nếu server từ chối do ô vừa bị người khác chiếm trước, giữ nguyên thẻ trong array và thông báo đặt thất bại.


## 11.5. Tương tác dùng thẻ Xuất Chuồng

- Trong lượt bình thường của active player, sau khi placement phase kết thúc và trước khi tung xúc xắc, thẻ Xuất Chuồng trong hand array có thể được bấm trực tiếp.

- Khi bấm, client gửi yêu cầu dùng thẻ ngay; không mở bước chọn ô hoặc chọn danh tính hiển thị.

- Sau phản hồi server, thẻ biến mất khỏi hand array bất kể có xuất được quân hay không.

- Nếu xuất thành công, animate quân từ chuồng ra ô xuất phát. Nếu ô xuất phát có marker, tiếp tục animate chuỗi Rune như một bước di chuyển bình thường.

- Nếu không xuất được quân vì chuồng trống hoặc ô xuất phát đang có quân cùng chủ, hiển thị phản hồi ngắn nhưng vẫn thể hiện thẻ đã bị tiêu hao.

## 11.6. Animation khi kích hoạt

- Quân ngựa di chuyển theo từng ô để người chơi nhìn thấy chuỗi Rune được resolve theo thứ tự.

- Khi marker kích hoạt, marker biến mất và animation ngắn thể hiện hiệu ứng: mũi tên tiến, mũi tên lùi, lớp Khiên, đóng băng, về chuồng hoặc đổi chỗ.

- Animation được phép tiết lộ hiệu ứng vừa xảy ra nhưng không bao giờ tiết lộ người đặt thật.

# 12. Mô hình dữ liệu và sự kiện server đề xuất

Phần này là đặc tả kỹ thuật tham chiếu để triển khai nhất quán. Tên trường có thể thay đổi theo codebase, nhưng ý nghĩa gameplay không được thay đổi.

## 12.1. CardDefinition

| **Trường**    | **Kiểu dữ liệu** | **Ý nghĩa**                                                                                             |
|---------------|------------------|---------------------------------------------------------------------------------------------------------|
| cardType      | enum             | LEAVE_STABLE, SHIELD, ADVANCE_2, ADVANCE_3, ADVANCE_4, BACK_3, BACK_4, BACK_5, FREEZE, SEND_HOME, SWAP. |
| category      | enum             | SUPPORT, TRAP hoặc SPECIAL.                                                                             |
| activationKind| enum             | DIRECT_USE hoặc BOARD_MARKER. LEAVE_STABLE dùng DIRECT_USE; các loại còn lại dùng BOARD_MARKER.        |
| triggerMode   | enum \| null     | PASS_THROUGH hoặc EXACT_STOP với marker; null đối với LEAVE_STABLE.                                     |
| markerTTL     | number \| null   | 3 hoặc 5 vòng với marker; null đối với LEAVE_STABLE.                                                    |
| stepValue     | number \| null   | Giá trị bước cho các thẻ Tiến và Lùi.                                                                   |

## 12.2. HeldCard

| **Trường**          | **Kiểu dữ liệu** | **Ý nghĩa**                                       |
|---------------------|------------------|---------------------------------------------------|
| heldCardId          | string           | ID instance thẻ trong hand array.                 |
| ownerPlayerId       | string           | Người đang giữ thẻ.                               |
| cardType            | enum             | Loại Rune.                                        |
| remainingHandRounds | number           | Khởi tạo 2; giảm theo lượt bình thường của owner. |
| source              | enum             | DRAW hoặc HONESTY_REWARD.                         |

## 12.3. BoardMarker

| **Trường**            | **Kiểu dữ liệu** | **Ý nghĩa**                                                                             |
|-----------------------|------------------|-----------------------------------------------------------------------------------------|
| markerId              | string           | ID marker.                                                                              |
| cellId                | string           | Ô đường đi chung đang chứa marker.                                                      |
| cardType              | enum             | Loại Rune bí mật.                                                                       |
| realPlacerId          | string           | Người đặt thật; chỉ server và chính người đặt thật được dùng để hiển thị tooltip riêng. |
| displayedIdentityId   | string           | Danh tính công khai trên avatar marker.                                                 |
| remainingMarkerRounds | number           | Khởi tạo 3 hoặc 5.                                                                      |
| ttlMode               | enum             | DISPLAYED_IDENTITY_TURN hoặc FULL_TABLE_ROUND.                                          |
| createdAtPhaseId      | string           | Pha đặt marker tạo instance này.                                                        |

## 12.4. HorseState

| **Trường**                | **Kiểu dữ liệu** | **Ý nghĩa**                                                           |
|---------------------------|------------------|-----------------------------------------------------------------------|
| horseId                   | string           | ID quân ngựa.                                                         |
| ownerPlayerId             | string           | Chủ quân.                                                             |
| position                  | object           | Chuồng, ô xuất phát, ô đường đi chung, đường về đích riêng hoặc đích. |
| hasShield                 | boolean          | Tối đa một lớp Khiên chắn.                                            |
| freezeOwnerTurnsRemaining | number           | 0 hoặc số lượt bình thường còn bị khóa; khởi tạo 2 khi Đóng băng.     |

## 12.5. RunePlayerState

| **Trường**            | **Kiểu dữ liệu** | **Ý nghĩa**                                                       |
|-----------------------|------------------|-------------------------------------------------------------------|
| drawCount             | number           | Số thẻ đã bốc ngẫu nhiên; tối đa 25.                              |
| hand                  | HeldCard\[\]     | Danh sách thẻ còn hạn. Ngưỡng cho phép bốc thẻ thường là dưới 5; reward được phép append vượt ngưỡng. |
| hasClaimableHonestyReward | boolean          | `true` khi reward trung thực đến hạn nhận ở pha bốc và đặt thẻ của lượt bình thường hiện tại. Sau khi chọn hoặc timeout, trở về `false`. |
| honestPlacementStreak | number           | 0-5; đạt 5 thì tạo reward đến hạn nhận ở lượt bình thường tiếp theo, sau khi nhận reward reset về 0. |

## 12.6. Sự kiện server chính

| **Event**              | **Ý nghĩa**                                                                |
|------------------------|----------------------------------------------------------------------------|
| TURN_STARTED           | Bắt đầu lượt bình thường; xóa held card hết hạn và cập nhật TTL liên quan. |
| CARDS_DRAWN            | Người đang đến lượt bốc một hoặc nhiều thẻ.                                |
| PLACEMENT_PHASE_OPENED | Mở quyền đặt đồng thời cho tất cả người chơi với các thẻ tạo marker.       |
| MARKER_PLACE_REQUESTED | Client gửi card instance, cellId và displayedIdentityId.                   |
| MARKER_PLACED          | Server chấp nhận marker đầu tiên tại ô.                                    |
| MARKER_PLACE_REJECTED  | Server từ chối vì ô không hợp lệ hoặc đã bị chiếm; held card không mất.    |
| LEAVE_STABLE_USED      | Active player bấm Xuất Chuồng; luôn tiêu hao held card và resolve kết quả. |
| DICE_ROLLED            | Người đang đến lượt tung xúc xắc.                                          |
| HORSE_STEP_MOVED       | Quân nhảy một ô; dùng để animate và resolve marker.                        |
| MARKER_TRIGGERED       | Marker kích hoạt và bị xóa.                                                |
| HORSE_STATUS_CHANGED   | Áp dụng hoặc xóa Shield, Freeze, về chuồng hoặc swap.                      |
| HONESTY_REWARD_AVAILABLE | Reward trung thực đến hạn nhận ở pha bốc và đặt thẻ của lượt bình thường tiếp theo. |
| HONESTY_REWARD_SELECTED  | Người nhận chọn 1 support card; nếu timeout server tự chọn ngẫu nhiên.          |
| HONESTY_REWARD_GRANTED   | Append support card vào hand kể cả khi hand đã có từ 5 thẻ trở lên; công bố người nhận nhưng ẩn loại thẻ. |
| MARKER_EXPIRED         | TTL marker hết; xóa khỏi bàn cờ.                                           |
| HELD_CARD_EXPIRED      | Held card quá 2 vòng; xóa khỏi hand.                                       |

# 13. Kịch bản kiểm thử chấp nhận

| **ID** | **Mục tiêu**                | **Thiết lập**                                                                 | **Kết quả mong đợi**                                                                     |
|--------|-----------------------------|-------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| TC-01  | Giới hạn bốc cá nhân        | A đã bốc 24 thẻ và hand còn chỗ.                                              | A chỉ có thể bốc thêm tối đa 1 thẻ trong ván.                                            |
| TC-02  | Đạt ngưỡng bốc thường       | A đang giữ 5 thẻ còn hạn.                                                     | Nút bốc thẻ thường bị khóa. Reward trung thực vẫn có thể append vào hand.                  |
| TC-03  | Hết hạn held card           | A bốc thẻ ở lượt hiện tại và không đặt trong 2 lượt bình thường tiếp theo.    | Thẻ bị xóa khi bắt đầu lượt bình thường thứ ba tiếp theo của A.                          |
| TC-04  | Lượt thưởng do số 6         | A tung được 6.                                                                | Chỉ lặp lại tung xúc xắc, chọn quân và di chuyển; không bốc và không mở placement phase. |
| TC-05  | Xung đột đặt marker         | A và B cùng đặt marker tại một ô trống.                                       | Request đến server trước thành công; request sau thất bại và người đó vẫn giữ thẻ.       |
| TC-06  | Tiến cộng dồn               | Ngựa đi qua Tiến 3 rồi Tiến 2.                                                | Ngựa nhận tổng cộng 5 bước tiến bổ sung.                                                 |
| TC-07  | Tiến gặp Lùi                | Ngựa đang tiến còn bước và đi qua Lùi 4.                                      | Bỏ bước tiến còn lại; ngựa bắt đầu lùi 4 bước.                                           |
| TC-08  | Lùi gặp Lùi                 | Ngựa đang lùi còn 3 bước và đi qua Lùi 3.                                     | Ngựa tiếp tục lùi tổng cộng 6 bước.                                                      |
| TC-09  | Lùi gặp Tiến                | Ngựa đang lùi và đi qua Tiến 3.                                               | Bỏ lùi còn lại; đổi hướng và tiến 3 bước.                                                |
| TC-10  | Khiên chặn bẫy              | Ngựa có Khiên và đi qua Đóng băng.                                            | Đóng băng mất; Khiên mất; ngựa tiếp tục số bước còn lại.                                 |
| TC-11  | Khiên thứ hai               | Ngựa đang có Khiên và đi qua marker Khiên.                                    | Marker Khiên mới mất; ngựa vẫn chỉ có một lớp.                                           |
| TC-12  | Đóng băng                   | Ngựa không có Khiên đi qua Đóng băng.                                         | Ngựa dừng ngay và bị khóa trong 2 lượt bình thường tiếp theo của chủ quân.               |
| TC-13  | Đá quân đang đóng băng      | Ngựa đang đóng băng bị đá về chuồng.                                          | Trạng thái Đóng băng bị xóa ngay.                                                        |
| TC-14  | Xuất Chuồng thành công       | A còn quân trong chuồng; ô xuất phát trống; A bấm Xuất Chuồng trước khi tung xúc xắc. | Một quân ra ô xuất phát; thẻ bị xóa khỏi hand.                                           |
| TC-15  | Xuất Chuồng gặp quân mình   | A còn quân trong chuồng nhưng ô xuất phát đang có quân của A.                 | Không xuất quân mới; thẻ vẫn bị xóa khỏi hand.                                           |
| TC-16  | Xuất Chuồng gặp quân địch   | A còn quân trong chuồng; ô xuất phát đang có quân của B.                      | Quân A ra ô xuất phát; quân B bị đá về chuồng theo rule truyền thống; thẻ bị xóa.        |
| TC-17  | Xuất Chuồng khi chuồng trống| A không còn quân trong chuồng và bấm Xuất Chuồng.                             | Không có quân được đưa ra; thẻ vẫn bị xóa khỏi hand.                                     |
| TC-18  | Xuất Chuồng kích hoạt marker| Ô xuất phát trống nhưng đang có marker; A bấm Xuất Chuồng thành công.         | Quân A ra ô xuất phát và marker được resolve như khi quân đi vào ô bình thường.          |
| TC-19  | Dùng nhiều Xuất Chuồng      | A giữ 2 thẻ Xuất Chuồng và còn 2 quân trong chuồng; ô xuất phát ban đầu trống.| Lần bấm đầu xuất 1 quân; lần bấm hai không xuất vì ô bị quân A chiếm; cả hai thẻ đều mất.|
| TC-20  | Swap hợp lệ                 | Ngựa A dừng đúng Hoán vị giả danh B; B có quân trên đường chung.              | A chọn một quân hợp lệ của B và hai quân đổi vị trí.                                     |
| TC-21  | Swap tự giả danh            | Ngựa A dừng đúng Hoán vị có displayedIdentity là A.                           | Không swap; marker vẫn mất.                                                              |
| TC-22  | Marker hết hạn 3 vòng       | Marker Tiến chưa bị kích hoạt.                                                | Xóa khi bắt đầu lượt bình thường thứ tư tiếp theo của displayedIdentity.                 |
| TC-23  | Displayed identity rời trận | Marker còn TTL khi displayedIdentity rời trận.                                | Marker giữ remainingTTL và chuyển sang giảm theo vòng toàn bàn.                          |
| TC-24  | Chuỗi trung thực            | A đặt marker chính danh trong 5 lượt đặt liên tiếp; lượt không đặt xen giữa.  | Lượt không đặt giữ streak; reward đến hạn nhận trong pha bốc và đặt thẻ của lượt bình thường tiếp theo của A. |
| TC-25  | Giả danh phá streak         | A có streak 4 nhưng đặt ít nhất một marker giả danh.                          | Streak trở về 0.                                                                         |
| TC-26  | Điều kiện chiến thắng       | A đưa đủ 2 quân ngựa về đích.                                                 | A được xác định là người chiến thắng theo rule mới.                                      |
| TC-27  | Reward vượt ngưỡng hand     | A đang giữ 5 thẻ và nhận reward trung thực đến hạn.                           | A chọn 1 support card; thẻ được append và hand tăng lên 6. Nút bốc thẻ thường vẫn bị khóa. |
| TC-28  | Reward tích lũy vượt ngưỡng | A đang giữ 6 thẻ và tiếp tục nhận reward mới.                                 | Reward mới vẫn được append; hand có thể tăng lên 7 hoặc cao hơn.                          |
| TC-29  | Chọn reward theo ý muốn      | Reward đến hạn ở pha bốc và đặt thẻ của A.                                    | A được chọn 1 trong 5 support card; người khác chỉ nhận thông báo A được thưởng.           |
| TC-30  | Timeout chọn reward          | Reward đến hạn nhưng A không chọn trước khi hết thời gian.                    | Server tự chọn ngẫu nhiên 1 support card, append vào hand và tiếp tục trận.                |
| TC-31  | Dùng reward ngay             | A chọn Tiến 3 hoặc Xuất Chuồng làm reward trong lượt nhận thưởng.             | A có thể dùng thẻ ngay trong đúng pha tương ứng của cùng lượt như thẻ vừa bốc được.        |
| TC-32  | Bắt đầu streak mới           | A nhận reward ở lượt thứ 6 và tiếp tục đặt toàn bộ marker chính danh trong pha hiện tại. | Sau khi reward reset streak về 0, lượt này được tính là lượt trung thực đầu tiên của chuỗi mới. |


# 14. Phạm vi kế thừa, giới hạn và điểm cần lưu ý

## 14.1. Rule truyền thống được kế thừa

Các xử lý Cá Ngựa nền đã có trong MVP tiếp tục được sử dụng, bao gồm quy tắc tung xúc xắc, chọn quân, đá quân đối thủ về chuồng khi dừng đúng ô và xử lý ô xuất phát đang có quân đối thủ. Tuy nhiên, mỗi người chơi chỉ có 2 quân ngựa và thắng khi đưa đủ 2 quân về đích. Việc dùng Rune Xuất Chuồng tuân theo Mục 9.6 và thay thế hoàn toàn cơ chế marker Xuất Chuồng cũ.

## 14.2. Không bổ sung luật ngoài phạm vi đã khóa

- Không bổ sung ô an toàn hoặc miễn nhiễm Rune mới.

- Không bổ sung đồng đội trong MVP.

- Không cho phép nhiều marker cùng tồn tại tại một ô.

- Không tiết lộ danh tính người đặt thật ở bất kỳ thời điểm nào.

- Không cho phép đặt marker trong đường về đích riêng hoặc tại ô đang có quân ngựa.

- Không giữ thẻ Nhân đôi bước đi trong danh sách Rune mới.

- Không đặt Xuất Chuồng thành marker; thẻ này chỉ được dùng trực tiếp từ hand array.

# PHỤ LỤC A. Bảng tóm tắt Rule Lock

| **Hạng mục**      | **Quy tắc đã khóa**                                                                                                |
|-------------------|--------------------------------------------------------------------------------------------------------------------|
| Quota bốc         | Tối đa 25 lượt bốc ngẫu nhiên cho mỗi người chơi trong một ván.                                                    |
| Hand array        | Chỉ được bốc thẻ thường khi đang giữ dưới 5 thẻ còn hạn; reward có thể append vượt ngưỡng; mọi thẻ hết hạn sau 2 lượt bình thường tiếp theo của chủ thẻ. |
| Lượt thưởng số 6  | Chỉ lặp từ tung xúc xắc; không bốc, không mở placement phase và không dùng Xuất Chuồng.                               |
| Placement phase   | Mở sau khi active player bốc; mọi người đặt đồng thời các thẻ tạo marker, không giới hạn số thẻ đặt.                  |
| Ô hợp lệ          | Chỉ ô đường đi chung; không ô đang có ngựa, không đường về đích riêng, không ô đã có marker.                       |
| Xung đột ô        | Request server đến trước thắng; request sau thất bại và giữ thẻ.                                                   |
| Giả danh          | Áp dụng cho mọi marker; không áp dụng cho Xuất Chuồng vì thẻ này dùng trực tiếp. True placer không bao giờ bị lộ.      |
| Marker UI         | Location circle + avatar + màu displayed identity; ẩn loại Rune và TTL với người khác.                             |
| TTL marker 3 vòng | Tiến, Khiên, Lùi, Đóng băng.                                                                                       |
| TTL marker 5 vòng | Về chuồng, Hoán vị.                                                                                               |
| Cách đếm TTL      | Theo lượt bình thường của displayed identity; rời trận hoặc hoàn thành toàn bộ quân thì chuyển sang vòng toàn bàn. |
| Đóng băng         | Dừng ngay và khóa quân trong 2 lượt bình thường tiếp theo của chủ quân.                                            |
| Khiên             | Một lớp; tồn tại tới bẫy tiếp theo hoặc khi bị đá về chuồng; chặn Lùi, Freeze, Send Home; không chặn Swap.         |
| Swap              | Activator chọn một quân hợp lệ trên đường chung của displayed identity; tự giả danh thì không có hiệu ứng.         |
| Xuất Chuồng       | Dùng trực tiếp sau placement phase và trước xúc xắc; luôn tiêu hao; không tạo marker; có thể kích hoạt marker tại ô xuất phát. |
| Số quân / chiến thắng | Mỗi người có 2 quân; thắng khi đưa đủ 2 quân về đích.                                                           |
| Thưởng trung thực | Sau 5 lượt đặt chính danh liên tiếp, reward đến hạn ở lượt bình thường tiếp theo; người nhận chọn 1 support card; timeout thì server chọn ngẫu nhiên; reward append vượt ngưỡng 5 và không lộ loại thẻ cho người khác. |

# PHỤ LỤC B. Artwork concept bộ thẻ Rune

Contact sheet minh họa bộ 11 thẻ Rune chính thức theo phong cách 3D low-poly bo tròn, màu sáng, thân thiện và icon đơn giản. Đây là artwork concept dùng để thống nhất định hướng hình ảnh; đội thiết kế có thể tách và tinh chỉnh asset production sau.

<img src="media/image1.png" style="width:8.75in;height:6.5625in" />

Hình B.1. Contact sheet bộ thẻ Rune: 5 thẻ hỗ trợ, 5 thẻ bẫy và 1 thẻ đặc biệt Hoán vị.
