/**
 * Hydration defaults, used until the person sets their own. The screens say
 * when a default is in use, so it is never presented as advice.
 */
export const DEFAULT_WATER_TARGET_ML = 2000;
export const DEFAULT_WATER_GLASS_ML = 250;

/** The target stepper moves in quarter litres, within sane bounds. */
export const WATER_TARGET_STEP_ML = 250;
export const WATER_TARGET_MIN_ML = 500;
export const WATER_TARGET_MAX_ML = 6000;

export const WATER_GLASS_SIZES_ML = [150, 200, 250, 300, 350, 500] as const;

/** Besides one glass, the sizes offered as a single tap on the detail screen. */
export const WATER_QUICK_ADD_ML = [500, 750] as const;
