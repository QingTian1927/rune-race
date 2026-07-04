# Backfill registration dates

Spread bulk-imported users' `auth.users.created_at` and `profiles.created_at` across a realistic window (default **29/06/2026 – 04/07/2026**, Vietnam time).

Targets are merged from `EXE plan.xlsx` + `EXE plan 2.xlsx` (campus first, dedupe by email).

## Prerequisites

- `SUPABASE_URL` + `SUPABASE_SECRET_KEY` in root `.env` (list users)
- `DATABASE_URL` for `--apply` — paste the full Supabase connection string as-is (password with `@`, `#`, `!` is OK). If password contains `#`, wrap the value in double quotes in `.env`.

## Usage

```bash
# Preview timestamps
pnpm backfill:registration-dates -- --dry-run

# Write to database
pnpm backfill:registration-dates -- --apply
```

Reports → `scripts/reports/registration-dates-backfill-*.json`

## Behaviour

- Order follows spreadsheet merge order; each user gets a unique time in the range with deterministic jitter (re-runs produce the same schedule).
- Times biased to **08:00–22:00** ICT.
- If `last_played_at` is earlier than the generated time, registration is clamped to before last play.
