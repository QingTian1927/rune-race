/**
 * Template for new import datasources.
 * Copy this file, implement `load()`, register in index.mjs → DATASOURCES.
 *
 * @typedef {import('../types.mjs').UserImportRecord} UserImportRecord
 * @typedef {import('../types.mjs').UserDatasource} UserDatasource
 */

/** @type {UserDatasource} */
export const exampleDatasource = {
  id: 'example',
  label: 'Example data source',

  async load({ filePath }) {
    void filePath
    /** @type {UserImportRecord[]} */
    return []
  },
}
