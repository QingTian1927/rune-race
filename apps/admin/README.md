# Rune Race Admin

Console nội bộ cho vận hành business (tách khỏi game client `apps/web`).

## V1 — Analytics

- Đăng nhập Supabase (cùng project với game)
- Chỉ user có trong `ADMIN_USER_IDS` trên server mới gọi được API
- Dashboard: live counters, timeseries 24h, top players
- **Báo cáo người dùng:** xem danh sách tài khoản đã đăng ký, chỉnh sửa/ẩn thông tin trước khi xuất Excel
- **Feature flags:** toggle popup khuyến khích đăng ký (anon) trên dashboard

### Tắt popup đăng ký nhanh

1. **Admin UI:** Dashboard → “Popup đăng nhập / đăng ký (anon)” → tắt.
2. **Server env:** `ACCOUNT_NUDGE_ENABLED=false` (kill switch, ưu tiên hơn DB).
3. **Client build:** `VITE_ACCOUNT_NUDGE_ENABLED=false` trong `.env` (không gọi API flags).

## Chạy local

```bash
# Từ root repo
pnpm install
pnpm dev:server   # terminal 1 — port 3000
pnpm dev:admin    # terminal 2 — port 5174
```

Env dùng chung file `.env` ở root (giống `apps/web`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (hoặc publishable key)
- Trên server: `ADMIN_USER_IDS=<uuid-admin>`

## Build

```bash
pnpm build:admin
```

Output: `apps/admin/dist` — deploy lên subdomain riêng (ví dụ `admin.example.com`).
