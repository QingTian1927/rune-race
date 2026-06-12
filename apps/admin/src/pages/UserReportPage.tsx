import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { ApiError, fetchUsersReport } from '../lib/api'
import { formatLastPlayedAt, formatReportDateTime } from '../lib/format'
import {
  createDraftRows,
  exportUsersReportExcel,
  isRowModified,
  toggleRowRedacted,
  type UserReportDraftRow,
} from '../lib/userReport'

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('vi-VN')
}

export default function UserReportPage() {
  const { accessToken } = useAuth()
  const token = accessToken!
  const [rows, setRows] = useState<UserReportDraftRow[] | null>(null)
  const [search, setSearch] = useState('')
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false)

  const reportQuery = useQuery({
    queryKey: ['admin', 'users-report'],
    queryFn: async () => {
      const payload = await fetchUsersReport(token)
      setRows(createDraftRows(payload.users))
      return payload
    },
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  })

  const forbidden = reportQuery.error instanceof ApiError && reportQuery.error.status === 403
  const displayRows = rows ?? []

  const modifiedCount = useMemo(
    () => displayRows.filter((row) => isRowModified(row)).length,
    [displayRows],
  )

  const filteredRows = useMemo(() => {
    const needle = normalizeSearch(search)
    if (!needle) return displayRows

    return displayRows.filter((row, index) => {
      const haystack = [
        String(index + 1),
        row.draft.fullName,
        row.draft.email,
        row.draft.phone,
      ]
        .join(' ')
        .toLocaleLowerCase('vi-VN')
      return haystack.includes(needle)
    })
  }, [search, displayRows])

  const updateDraftField = (
    rowId: string,
    field: keyof UserReportDraftRow['draft'],
    value: string,
  ) => {
    setRows((current) =>
      (current ?? []).map((row) =>
        row.id === rowId ? { ...row, draft: { ...row.draft, [field]: value } } : row,
      ),
    )
  }

  const handleReload = () => {
    void reportQuery.refetch()
  }

  const handleResetAll = () => {
    if (!reportQuery.data) return
    setRows(createDraftRows(reportQuery.data.users))
  }

  const handleExport = () => {
    exportUsersReportExcel(displayRows)
    setExportConfirmOpen(false)
  }

  if (forbidden) {
    return (
      <div className="page">
        <header className="page-header">
          <h1>Không có quyền truy cập</h1>
        </header>
        <p className="alert alert-error">
          Tài khoản đã đăng nhập nhưng chưa nằm trong <code>ADMIN_USER_IDS</code> trên server.
        </p>
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Báo cáo người dùng</h1>
          <p className="muted">
            Xem, chỉnh sửa hoặc ẩn thông tin trước khi xuất Excel cho báo cáo Rune Race
          </p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn-ghost" onClick={handleReload}>
            Tải lại
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={displayRows.length === 0}
            onClick={() => setExportConfirmOpen(true)}
          >
            Xuất Excel
          </button>
        </div>
      </header>

      {reportQuery.isLoading ? <p className="muted">Đang tải danh sách người dùng...</p> : null}

      {reportQuery.error && !(reportQuery.error instanceof ApiError && reportQuery.error.status === 403) ? (
        <p className="alert alert-error">
          {reportQuery.error instanceof Error ? reportQuery.error.message : 'Không thể tải dữ liệu'}
        </p>
      ) : null}

      {reportQuery.data ? (
        <section className="report-toolbar">
          <label className="report-search field">
            <span>Tìm kiếm</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Họ tên, Gmail hoặc SĐT..."
            />
          </label>
          <div className="report-toolbar-meta">
            <p className="muted">
              Tổng: <strong>{reportQuery.data.total}</strong> người dùng đã đăng ký
              {modifiedCount > 0 ? (
                <>
                  {' '}
                  · Đã chỉnh sửa: <strong>{modifiedCount}</strong>
                </>
              ) : null}
            </p>
            <button
              type="button"
              className="btn-ghost"
              disabled={modifiedCount === 0}
              onClick={handleResetAll}
            >
              Hoàn tác tất cả
            </button>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <div className="table-wrap">
          <table className="data-table report-table">
            <thead>
              <tr>
                <th>STT</th>
                <th>Họ và tên</th>
                <th>Gmail</th>
                <th>Số điện thoại</th>
                <th>Ngày tạo tài khoản</th>
                <th>Lần chơi cuối</th>
                <th>Ẩn</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => {
                const index = displayRows.findIndex((item) => item.id === row.id)
                const modified = isRowModified(row)

                return (
                  <tr
                    key={row.id}
                    className={
                      row.redacted ? 'report-row-redacted' : modified ? 'report-row-modified' : undefined
                    }
                  >
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className="report-cell-input"
                        value={row.draft.fullName}
                        onChange={(event) => updateDraftField(row.id, 'fullName', event.target.value)}
                        aria-label={`Họ và tên hàng ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className="report-cell-input"
                        value={row.draft.email}
                        onChange={(event) => updateDraftField(row.id, 'email', event.target.value)}
                        aria-label={`Gmail hàng ${index + 1}`}
                      />
                    </td>
                    <td>
                      <input
                        className="report-cell-input"
                        value={row.draft.phone}
                        onChange={(event) => updateDraftField(row.id, 'phone', event.target.value)}
                        aria-label={`Số điện thoại hàng ${index + 1}`}
                      />
                    </td>
                    <td className="report-readonly-cell">
                      {row.accountCreatedAt ? formatReportDateTime(row.accountCreatedAt) : '—'}
                    </td>
                    <td className="report-readonly-cell">
                      {formatLastPlayedAt(row.lastPlayedAt)}
                    </td>
                    <td>
                      <label className="report-redact-toggle" title={row.redacted ? 'Hiện thông tin' : 'Ẩn thông tin'}>
                        <input
                          type="checkbox"
                          checked={row.redacted}
                          onChange={() =>
                            setRows((current) =>
                              (current ?? []).map((item) =>
                                item.id === row.id ? toggleRowRedacted(item, index) : item,
                              ),
                            )
                          }
                          aria-label={
                            row.redacted
                              ? `Hiện thông tin người dùng hàng ${index + 1}`
                              : `Ẩn thông tin người dùng hàng ${index + 1}`
                          }
                        />
                        <span className="report-redact-toggle-label">
                          {row.redacted ? 'Đã ẩn' : 'Hiện'}
                        </span>
                      </label>
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-cell">
                    {displayRows.length === 0
                      ? 'Chưa có người dùng đã đăng ký'
                      : 'Không tìm thấy kết quả phù hợp'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {exportConfirmOpen ? (
        <div className="report-dialog-backdrop" role="presentation" onClick={() => setExportConfirmOpen(false)}>
          <div
            className="report-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="export-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="export-dialog-title">Xác nhận xuất báo cáo</h2>
            <p className="muted">
              Bạn sắp xuất <strong>{displayRows.length}</strong> người dùng đã đăng ký
              {modifiedCount > 0 ? (
                <>
                  , trong đó <strong>{modifiedCount}</strong> hàng đã được chỉnh sửa hoặc ẩn
                </>
              ) : null}
              . Thay đổi chỉ có trong file Excel, không ảnh hưởng dữ liệu hệ thống.
            </p>
            <div className="report-dialog-actions">
              <button type="button" className="btn-ghost" onClick={() => setExportConfirmOpen(false)}>
                Hủy
              </button>
              <button type="button" className="btn-primary" onClick={handleExport}>
                Xuất Excel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
