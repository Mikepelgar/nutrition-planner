/**
 * Configuration for the developer-embedded "built-in" AI key.
 *
 * When a user hasn't configured their own provider key, the app can fall
 * back to the developer's own embedded Anthropic key (see
 * `__BUILTIN_API_KEY__` / electron.vite.config.ts) so AI Chat works out of
 * the box. To keep that shared key's costs bounded, traffic against it is
 * pinned to a single cost-efficient model and soft-rate-limited locally
 * (see ai-usage.service.ts). These limits are local-only deterrents, not a
 * hard guarantee — tune them to your own cost tolerance.
 */

/** Cost-efficient model used exclusively for the developer-embedded key. */
export const BUILTIN_MODEL = 'claude-haiku-4-5'

/** Soft caps on the embedded key, tracked per local install. */
export const BUILTIN_DAILY_LIMIT = 20
export const BUILTIN_MONTHLY_LIMIT = 200
