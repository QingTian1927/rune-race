/**
 * @typedef {Object} UserImportRecord
 * @property {string} fullName
 * @property {string} emailRaw
 * @property {string} email
 * @property {string | null} phone
 * @property {number} sourceRow
 * @property {Record<string, string | null>} [extras]
 */

/**
 * @typedef {Object} EmailFix
 * @property {string} from
 * @property {string} to
 * @property {string} reason
 */

/**
 * @typedef {Object} PhoneFix
 * @property {string} from
 * @property {string} to
 * @property {string} reason
 */

/**
 * @typedef {Object} UserDatasource
 * @property {string} id
 * @property {string} label
 * @property {(options: { filePath: string }) => Promise<UserImportRecord[]>} load
 */

/**
 * @typedef {'created' | 'updated' | 'skipped_exists' | 'skipped_duplicate_row' | 'skipped_invalid' | 'skipped_no_updates' | 'error'} ImportAction
 */

/**
 * @typedef {Object} ImportRowResult
 * @property {ImportAction} action
 * @property {number} sourceRow
 * @property {string} email
 * @property {string | null} fullName
 * @property {string | null} userId
 * @property {string | null} message
 * @property {EmailFix | null} [emailFix]
 */

export {}
