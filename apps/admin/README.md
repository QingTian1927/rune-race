# Rune Race Admin

Console nội bộ cho vận hành business (tách khỏi game client `apps/web`).

## V1 — Analytics

- Đăng nhập Supabase (cùng project với game)
- Chỉ user có trong `ADMIN_USER_IDS` trên server mới gọi được API
- Dashboard: live counters, timeseries 24h, top players

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
