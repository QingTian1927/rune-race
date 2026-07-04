# User import CLI

Bulk create or update Supabase Auth users + `profiles` from pluggable data sources.

## Quick start

```bash
# Preview (no writes)
pnpm import:users -- --dry-run --datasource campus-excel

# Apply to Supabase (uses SUPABASE_URL + SUPABASE_SECRET_KEY from .env)
pnpm import:users -- --apply --datasource campus-excel
```

Default file: `EXE plan.xlsx` at repo root. Override with `--file path/to/data.xlsx`.

For the second campus sheet (no header, fixed name/email/phone columns):

```bash
pnpm import:users -- --dry-run --datasource exe-plan2-excel --file "EXE plan 2.xlsx"
```

Reports are written to `scripts/reports/` (JSON).

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Log actions only |
| `--apply` | Create/update users in Supabase |
| `--datasource <id>` | Data source plugin (default: `campus-excel`) |
| `--file <path>` | Input file |
| `--password <value>` | Password for **new** users (default: `123456`) |

## Behaviour

- **New email:** `auth.admin.createUser` with `email_confirm: true`, metadata `full_name`, `display_name`, `phone`, `is_anon: false`; ensures `profiles` row.
- **Existing email:** updates `full_name` / `phone` in auth metadata + `profiles` when provided; otherwise skips.
- **Duplicate rows in spreadsheet:** first row wins (same normalized email).
- **Email typos:** auto-fix obvious domains (`gmal.com` → `gmail.com`, etc.); invalid emails are skipped and logged.
- **Phone (`exe-plan2-excel`):** strips spaces/commas, prepends missing leading `0` on 9-digit mobiles, handles `+84`, multiple numbers (first valid wins); invalid phones are left empty and logged in `extras.phoneError`.

## Adding a data source

1. Create `scripts/import-users/datasources/my-source.mjs`
2. Export a `UserDatasource`: `{ id, label, load({ filePath }) }`
3. Register it in `scripts/import-users/index.mjs` → `DATASOURCES`
4. Run with `--datasource my-source`

Each `load()` should return normalized records:

```js
{
  fullName: string,
  emailRaw: string,
  email: string,       // normalized
  phone: string | null,
  sourceRow: number,
  extras?: Record<string, string | null>,
}
```
