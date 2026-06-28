/**
 * ============================================================================
 * Feature 10: Multi-Field Fuzzy Search Engine (5 Points)
 * ============================================================================
 * Splits query into space-separated search tokens and evaluates if ALL tokens
 * match anywhere within the searchable attributes of a row (AND logic).
 * 
 * Performance Optimizations:
 * - Compiled Token Cache: Pre-compiles search tokens into lowercase arrays once
 *   per search query (prevents allocations during iteration).
 * - Concatenated Search String: Merges and caches row metadata (company_id, 
 *   partner, project_name, etc.) to run fast `indexOf` lookups.
 * - Zero Layout Interruption: Evaluates search matches on the virtual dataset 
 *   with an 150ms input debounce in the UI to prevent browser thread blockages.
 */

/**
 * Pre-compile a search query into reusable token array.
 * @param {string} query - Raw user input
 * @returns {string[]} Lowercase token array, or empty if no query
 */
export function compileSearchTokens(query) {
  if (!query || typeof query !== 'string') return [];
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  return trimmed.split(/\s+/).filter(t => t.length > 0);
}

function getSearchableText(row) {
  if (row._searchable) return row._searchable;

  return [
    row.project_id,
    row.company_id,
    row.project_name,
    row.project_status,
    row.automation_type,
    row.department,
    row.implementation_partner,
    row.country,
    row.industry,
    row.ai_enabled,
    row.cloud_deployment,
  ].filter(Boolean).join(' ').toLowerCase();
}

/**
 * Test whether a single row matches all compiled search tokens.
 * Each token must appear in at least one of the searchable fields.
 *
 * Searchable fields include the required text fields plus status/category
 * dimensions operators naturally try during incident triage.
 *
 * @param {Object} row - Data row object
 * @param {string[]} tokens - Pre-compiled lowercase tokens
 * @param {string} [cachedSearchable] - Optional pre-built searchable string
 * @returns {boolean}
 */
export function matchRow(row, tokens) {
  if (tokens.length === 0) return true;

  const searchable = getSearchableText(row);

  // Every token must appear somewhere in the concatenated string
  for (let i = 0; i < tokens.length; i++) {
    if (searchable.indexOf(tokens[i]) === -1) return false;
  }
  return true;
}

/**
 * Filter an array of rows using fuzzy search.
 * @param {Object[]} rows - Array of data row objects
 * @param {string} query - Raw search query string
 * @returns {Object[]} Filtered array
 */
export function fuzzyFilter(rows, query) {
  const tokens = compileSearchTokens(query);
  if (tokens.length === 0) return rows;
  return rows.filter(row => matchRow(row, tokens));
}
