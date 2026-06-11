# Rune Race Landing Website

Website tĩnh nhiều trang cho Rune Race. Không cần cài đặt package hoặc chạy build.

## Cấu trúc

- `index.html`: trang chủ quảng bá game.
- `guide.html`: hướng dẫn chơi và luật chi tiết.
- `about.html`: mục tiêu, đội ngũ, supporter và liên hệ.
- `css/styles.css`: stylesheet dùng chung.
- `js/main.js`: menu mobile, chuyển ngày/đêm, accordion, bộ lọc thẻ và carousel.
- `assets/cards/`: bộ Rune được cắt và nén thành WebP.
- `assets/images/`: ảnh bìa, contact sheet và logo mark.

## Chạy thử

Có thể mở trực tiếp `index.html` bằng trình duyệt.

Khi cần kiểm thử qua local server:

```bash
python -m http.server 8080
```

Sau đó truy cập `http://localhost:8080`.

## Font chữ

Toàn bộ website sử dụng font `Be Vietnam Pro`, với fallback `sans-serif`.
