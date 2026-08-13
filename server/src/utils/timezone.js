/**
 * Timezone Resolution
 * ===================
 * Resolves the IANA timezone (e.g. "America/Los_Angeles") for a GPS
 * coordinate. Used to anchor an attendance record's automatic-checkout
 * cutoff to the employee's actual local time rather than server time.
 */

import tzlookup from 'tz-lookup';

const FALLBACK_TIMEZONE = 'Etc/UTC';

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {string} IANA timezone name, falling back to "Etc/UTC" if the
 *   coordinate can't be resolved (should be rare; tz-lookup covers the
 *   whole globe including open ocean).
 */
export function resolveTimezoneFromCoordinates(latitude, longitude) {
  try {
    return tzlookup(latitude, longitude) || FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}
