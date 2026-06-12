import * as XLSX from 'xlsx'
import type { ReportUser } from './api'
import { formatLastPlayedAt, formatReportDateTime } from './format'

export type EditableUserFields = {
  fullName: string
  email: string
  phone: string
}

export type UserReportDraftRow = {
  id: string
  accountCreatedAt: string | null
  lastPlayedAt: string | null
  original: EditableUserFields
  draft: EditableUserFields
  redacted: boolean
  /** Restored when toggling visibility back on. */
  draftBeforeRedact: EditableUserFields | null
}

export function toEditableFields(user: ReportUser): EditableUserFields {
  return {
    fullName: user.fullName ?? '',
    email: user.email ?? '',
    phone: user.phone ?? '',
  }
}

export function createDraftRows(users: ReportUser[]): UserReportDraftRow[] {
  return users.map((user) => {
    const fields = toEditableFields(user)
    return {
      id: user.id,
      accountCreatedAt: user.accountCreatedAt,
      lastPlayedAt: user.lastPlayedAt,
      original: { ...fields },
      draft: { ...fields },
      redacted: false,
      draftBeforeRedact: null,
    }
  })
}

function redactedFields(index: number): EditableUserFields {
  return {
    fullName: `Người dùng #${index + 1}`,
    email: '[Đã ẩn]',
    phone: '[Đã ẩn]',
  }
}

export function isRowModified(row: UserReportDraftRow): boolean {
  if (row.redacted) return true
  return (
    row.draft.fullName !== row.original.fullName ||
    row.draft.email !== row.original.email ||
    row.draft.phone !== row.original.phone
  )
}

export function toggleRowRedacted(row: UserReportDraftRow, index: number): UserReportDraftRow {
  if (row.redacted) {
    return {
      ...row,
      redacted: false,
      draft: row.draftBeforeRedact ? { ...row.draftBeforeRedact } : { ...row.original },
      draftBeforeRedact: null,
    }
  }

  return {
    ...row,
    redacted: true,
    draftBeforeRedact: { ...row.draft },
    draft: redactedFields(index),
  }
}

export function resetDraftRow(row: UserReportDraftRow): UserReportDraftRow {
  return {
    ...row,
    draft: { ...row.original },
    redacted: false,
    draftBeforeRedact: null,
  }
}

export function exportUsersReportExcel(rows: UserReportDraftRow[]): void {
  const exportedAt = new Date()
  const metaSheet = XLSX.utils.aoa_to_sheet([
    ['Hệ thống', 'Rune Race'],
    ['Ngày xuất', formatReportDateTime(exportedAt.toISOString())],
    ['Tổng người dùng', rows.length],
    ['Ghi chú', 'Một số thông tin có thể đã được chỉnh sửa hoặc ẩn trước khi xuất báo cáo.'],
  ])

  const tableSheet = XLSX.utils.aoa_to_sheet([
    ['STT', 'Họ và tên', 'Gmail', 'Số điện thoại', 'Thời gian tạo tài khoản', 'Thời gian chơi cuối cùng'],
    ...rows.map((row, index) => [
      index + 1,
      row.draft.fullName || '—',
      row.draft.email || '—',
      row.draft.phone || '—',
      row.accountCreatedAt ? formatReportDateTime(row.accountCreatedAt) : '—',
      formatLastPlayedAt(row.lastPlayedAt),
    ]),
  ])

  tableSheet['!cols'] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 32 },
    { wch: 16 },
    { wch: 24 },
    { wch: 24 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, metaSheet, 'Thông tin báo cáo')
  XLSX.utils.book_append_sheet(workbook, tableSheet, 'Danh sách người dùng')

  const datePart = exportedAt.toISOString().slice(0, 10)
  XLSX.writeFile(workbook, `rune-race-bao-cao-nguoi-dung-${datePart}.xlsx`)
}
