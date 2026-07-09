/**
 * The DRI table now lives in the shared module (`src/shared/rdi.ts`) so the
 * renderer's nutrient bars and the AI briefing can never drift apart.
 * Re-exported here to preserve existing import paths.
 */
export { DRI_TABLE, getDRIForProfile, type NutrientDRI, type DRIBracket } from '../../shared/rdi'
