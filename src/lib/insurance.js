/**
 * Canonical insurance vocabulary + intake normalization.
 *
 * The provider dropdown and the intake form drifted apart: intake offers
 * "Aetna/Meritain", "BCBS FEP" and "Kaiser PPO/FCHN", none of which existed in
 * the provider list. Because matching compared the two strings for equality,
 * 18 of 212 real inquiries (8%) drew a "Does not accept X" blocker against
 * EVERY provider — clients whose insurance is, in fact, accepted.
 *
 * ALIASES maps what the intake form actually sends → what providers select.
 * When a new value shows up in intake, add it here.
 */

export const INSURANCES = [
  'Premera', 'Regence', 'Other BCBS', 'Aetna', 'Cigna',
  'UHC-Commercial', 'Molina-Commercial', 'Molina-Medicaid',
  'UHC-Medicaid', 'Kaiser', 'Private Pay',
];

/** Intake value (lowercased) → canonical provider option. */
const ALIASES = {
  'aetna/meritain': 'Aetna',
  'meritain': 'Aetna',
  'bcbs fep': 'Other BCBS',
  'bcbs': 'Other BCBS',
  'kaiser ppo/fchn': 'Kaiser',
  'kaiser ppo': 'Kaiser',
  'fchn': 'Kaiser',
  'uhc commercial': 'UHC-Commercial',
  'uhc medicaid': 'UHC-Medicaid',
  'molina commercial': 'Molina-Commercial',
  'molina medicaid': 'Molina-Medicaid',
  'private pay': 'Private Pay',
  'self pay': 'Private Pay',
  'none': 'Private Pay',
  'uninsured': 'Private Pay',
};

const canon = new Map(INSURANCES.map((i) => [i.toLowerCase(), i]));

/**
 * Resolve a raw intake insurance string to a canonical option.
 * @returns {string|null} canonical name, or null if we can't place it
 */
export function canonicalInsurance(raw) {
  const l = (raw || '').trim().toLowerCase();
  if (!l) return null;
  if (canon.has(l)) return canon.get(l);
  if (ALIASES[l]) return ALIASES[l];

  // Last resort: a raw value that clearly contains a canonical name
  // ("Regence BlueShield" → Regence). Longest option first so "Other BCBS"
  // is preferred over a shorter incidental substring.
  const byLength = [...INSURANCES].sort((a, b) => b.length - a.length);
  const hit = byLength.find((opt) => l.includes(opt.toLowerCase()));
  return hit || null;
}

/** Does this provider accept the client's insurance? */
export function acceptsInsurance(providerInsurances, clientRawInsurance) {
  const target = canonicalInsurance(clientRawInsurance);
  if (!target) return false;
  return (providerInsurances || []).some((i) => canonicalInsurance(i) === target);
}
