/**
 * Provider–inquiry matching utility.
 *
 * matchProviders(inquiry, providerProfiles) → sorted array of scored results
 *
 * Each result: { name, profile, score, maxScore, pct, reasons, blockers }
 *   - score / maxScore / pct: numeric match quality
 *   - reasons: string[] describing what matched
 *   - blockers: string[] describing hard disqualifiers
 *
 * Weights are intentionally documented so they're easy to tune.
 */

import { parseChecklist } from './specialtyMap';

// ── Helpers ──────────────────────────────────────────────────────────────────

function lower(s) { return (s || '').toLowerCase(); }

/** "In Person, Telehealth" → ['inperson', 'telehealth'] */
function normalizeIpTele(raw) {
  const l = lower(raw);
  const out = [];
  if (l.includes('in person') || l.includes('in-person') || l.includes('no preference')) out.push('inperson');
  if (l.includes('telehealth') || l.includes('no preference')) out.push('telehealth');
  return out;
}

/** "Monday, Tuesday" → ['monday', 'tuesday'] */
function normalizeDays(raw) {
  if (!raw) return [];
  return raw.split(/[,/\n]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}

/**
 * Map the free-text servicesRequested ("Individual Therapy, Psychiatry")
 * to the provider modality labels ("Individual", "Couples", etc.)
 */
const SERVICE_TO_MODALITY = [
  ['individual',   'Individual'],
  ['couples',      'Couples'],
  ['family',       'Family'],
  ['group',        'Group'],
  ['child',        'Child/Play'],
  ['play',         'Child/Play'],
  ['psych',        'Individual'],   // Psychiatry — counts as individual capacity
];

function normalizeServices(raw) {
  if (!raw) return [];
  const lower_raw = lower(raw);
  const out = new Set();
  for (const [keyword, modality] of SERVICE_TO_MODALITY) {
    if (lower_raw.includes(keyword)) out.add(modality);
  }
  return [...out];
}

// ── Scoring weights ───────────────────────────────────────────────────────────
//
// Total possible (no blockers): 100 pts
//   Insurance           30   – hard to work around
//   Specialties         15   – partial credit per overlapping tag
//   Session format      20   – in-person / telehealth fit
//   Service modality     5   – offered modality match
//   Day availability    15   – at least one overlapping day
//   Intern OK           10   – intern preference match

const WEIGHTS = {
  insurance:   30,
  specialties: 15,
  format:      20,
  modality:    5,
  days:        15,
  intern:      15,
};

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {object} inquiry   Full Firestore inquiry document
 * @param {object[]} profiles  Array of provider profile documents
 * @returns {Array} Sorted (descending pct), one entry per profile
 */
export function matchProviders(inquiry, profiles) {
  const intake = inquiry.intake || {};

  // Pre-process inquiry fields once
  const clientInsurance   = intake.insurance || '';
  const clientIpTele      = normalizeIpTele(intake.ipTele);
  const clientServices    = normalizeServices(intake.servicesRequested);
  const clientDays        = normalizeDays(intake.days);
  const clientInternPref  = lower(intake.openToIntern); // 'yes' | 'would like to discuss' | 'no' | ''
  const { matched: clientSpecialties } = parseChecklist(intake.problemChecklist);

  const results = profiles.map((profile) => {
    const blockers = [];
    const reasons  = [];
    let score = 0;
    const maxScore = Object.values(WEIGHTS).reduce((a, b) => a + b, 0); // 100

    // ── Hard gate: open spaces ─────────────────────────────────────────────
    if (Number(profile.openSpaces) === 0) {
      blockers.push('No open spaces');
    }

    // ── Insurance ─────────────────────────────────────────────────────────
    const providerInsurances = profile.insurances || [];
    const insuranceMatch = providerInsurances.some(
      (ins) => lower(ins) === lower(clientInsurance)
    );
    if (clientInsurance && insuranceMatch) {
      score += WEIGHTS.insurance;
      reasons.push(`Accepts ${clientInsurance}`);
    } else if (clientInsurance && !insuranceMatch) {
      if (providerInsurances.includes('Private Pay')) {
        reasons.push('Private Pay only (insurance mismatch)');
      } else {
        blockers.push(`Does not accept ${clientInsurance}`);
      }
    }

    // ── Specialties ────────────────────────────────────────────────────────
    const providerSpecialties = profile.specialties || [];
    if (clientSpecialties.length > 0 && providerSpecialties.length > 0) {
      const overlap = clientSpecialties.filter((s) => providerSpecialties.includes(s));
      const ratio = overlap.length / clientSpecialties.length;
      const pts = Math.round(WEIGHTS.specialties * ratio);
      score += pts;
      if (overlap.length > 0) {
        reasons.push(`Specialties: ${overlap.join(', ')}`);
      }
    }

    // ── Session format ─────────────────────────────────────────────────────
    const providerFormats = (profile.sessionFormats || []).map((f) =>
      lower(f).includes('person') ? 'inperson' : 'telehealth'
    );
    if (clientIpTele.length > 0 && providerFormats.length > 0) {
      const overlap = clientIpTele.filter((f) => providerFormats.includes(f));
      if (overlap.length > 0) {
        score += WEIGHTS.format;
        reasons.push(`Format: ${overlap.map((f) => f === 'inperson' ? 'In-Person' : 'Telehealth').join('/')}`);
      } else {
        blockers.push('Format mismatch (in-person/telehealth)');
      }
    }

    // ── Service modality ───────────────────────────────────────────────────
    const providerModalities = profile.modalities || [];
    if (clientServices.length > 0 && providerModalities.length > 0) {
      const overlap = clientServices.filter((s) => providerModalities.includes(s));
      if (overlap.length > 0) {
        score += WEIGHTS.modality;
        reasons.push(`Offers: ${overlap.join(', ')}`);
      }
    } else if (providerModalities.length > 0) {
      // No service specified — give partial credit
      score += Math.round(WEIGHTS.modality * 0.5);
    }

    // ── Day availability ───────────────────────────────────────────────────
    const providerDays = (profile.availableDays || []).map((d) => d.toLowerCase().slice(0, 3));
    const clientDaysShort = clientDays.map((d) => d.slice(0, 3));
    if (clientDaysShort.length > 0 && providerDays.length > 0) {
      const overlap = clientDaysShort.filter((d) => providerDays.includes(d));
      if (overlap.length > 0) {
        score += WEIGHTS.days;
        reasons.push(`Available: ${overlap.map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')}`);
      }
    } else if (providerDays.length > 0) {
      score += Math.round(WEIGHTS.days * 0.5);
    }

    // ── Intern preference ──────────────────────────────────────────────────
    const isIntern = !!profile.isIntern;
    if (!isIntern) {
      // Licensed provider — always OK regardless of client preference
      score += WEIGHTS.intern;
    } else if (clientInternPref === 'yes' || clientInternPref === 'would like to discuss') {
      score += WEIGHTS.intern;
      reasons.push('Client open to intern');
    } else if (clientInternPref === 'no') {
      blockers.push('Client declined intern');
    } else {
      // No preference stated — give partial credit
      score += Math.round(WEIGHTS.intern * 0.5);
    }

    const pct = Math.round((score / maxScore) * 100);

    return {
      name: profile.name,
      profile,
      score,
      maxScore,
      pct,
      reasons,
      blockers,
      eligible: blockers.length === 0 || (blockers.length === 1 && blockers[0].startsWith('Does not accept')),
    };
  });

  // Sort: eligible first, then by pct descending
  return results.sort((a, b) => {
    if (a.blockers.length === 0 && b.blockers.length > 0) return -1;
    if (b.blockers.length === 0 && a.blockers.length > 0) return 1;
    return b.pct - a.pct;
  });
}
