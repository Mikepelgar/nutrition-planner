/**
 * TDEE / macro math for the main process (used to brief the AI).
 *
 * The implementation now lives in the shared, diet-aware engine so the AI and
 * the renderer compute identical targets. Re-exported here to preserve existing
 * import paths (`services/tdee.service`).
 */
export { calcBMR, calcTDEE, calcMacroTargets } from '../../shared/macros'
