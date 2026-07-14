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
import { DAYS, getAvailability, availableDayKeys } from './availability';
import { canonicalInsurance, acceptsInsurance } from './insurance';

// ── Helpers ──────────────────────────────────────────────────────────────────

function lower(s) { return (s || '').toLowerCase(); }

function dayLabel(dayKey) {
  return DAYS.find((d) => d.key === dayKey)?.short || dayKey;
}

/**
 * Classify the client's answer to "are you open to working with an intern?".
 *
 * The form's most common soft-yes is "I’d like to learn more before deciding"
 * (43 of 212 inquiries) — with a CURLY apostrophe. The old code compared against
 * the literal strings 'yes' / 'would like to discuss' / 'no', so that answer fell
 * through to the "didn't answer" branch and interns were scored at HALF credit
 * for a fifth of all inquiries. Substring-match the intent instead of the exact
 * label, and normalize the apostrophe so the typographic variant can't slip past.
 *
 * @returns {'yes'|'maybe'|'no'|'unknown'}
 */
export function parseInternStance(raw) {
  const l = lower(raw).replace(/[’‘`]/g, "'").trim();
  if (!l) return 'unknown';
  if (/^no\b/.test(l) || /\bnot open\b|\bprefer(?:s)? (?:a )?licensed\b/.test(l)) return 'no';
  if (/\bdiscuss\b|\blearn more\b|\bmore info/.test(l)) return 'maybe';
  if (/^yes\b|\bopen to\b/.test(l)) return 'yes';
  return 'unknown';
}

/**
 * Best-effort read of the client's free-text `times` field.
 *
 * This field is unstructured — real values range from "Afternoon" to
 * "Mon-Thursday after 4pm or Friday after 5pm. Sunday all day". We extract only
 * what we're confident about and return [] otherwise, which the caller treats as
 * "no time preference" rather than as a mismatch. Never guess a client out of a
 * match on the strength of a sentence we didn't understand.
 */
export function parseTimePreference(raw) {
  const l = lower(raw);
  if (!l) return [];

  // Negation and exclusions are where naive keyword-spotting gets it backwards:
  // "mornings are generally not good" would otherwise parse as MORNING. We can't
  // reliably scope a negation to the slot it modifies, so we decline to guess.
  if (/\b(not|n't|avoid|except|unable|cannot|no longer|isn't|don't)\b/.test(l)) return [];

  const slots = new Set();
  if (/\bmornings?\b|\bearly\b/.test(l)) slots.add('morning');
  if (/\bafternoons?\b|\bdaytime\b|\bmidday\b|\bnoon\b/.test(l)) slots.add('afternoon');
  if (/\bevenings?\b|\bnights?\b/.test(l)) slots.add('evening');

  // "after 5pm" → evening. "after 4pm" straddles the 5pm boundary, so it counts
  // as both afternoon and evening — better a generous match than a missed one.
  const after = l.match(/after\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (after) {
    let h = Number(after[1]);
    if (after[3] === 'pm' && h < 12) h += 12;
    else if (!after[3] && h <= 11) h += 12;   // a bare "after 4" means 4pm in practice
    if (h >= 17) slots.add('evening');
    else if (h >= 12) { slots.add('afternoon'); slots.add('evening'); }
    else { slots.add('morning'); slots.add('afternoon'); slots.add('evening'); }
  }

  // "before 2pm" covers the morning and the early afternoon.
  const before = l.match(/before\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (before) {
    let h = Number(before[1]);
    if (before[3] === 'pm' && h < 12) h += 12;
    slots.add('morning');
    if (h > 12) slots.add('afternoon');
  }

  // Anything we couldn't read confidently — "Flexible", "asdfsdf", a paragraph of
  // prose — yields [], which the caller treats as "no preference", not a mismatch.
  return [...slots];
}

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
  const clientInsurance      = intake.insurance || '';
  const clientCanonInsurance = canonicalInsurance(clientInsurance);
  const clientIpTele      = normalizeIpTele(intake.ipTele);
  const clientServices    = normalizeServices(intake.servicesRequested);
  const clientDays        = normalizeDays(intake.days);
  const clientSlots       = parseTimePreference(intake.times);
  const clientInternStance = parseInternStance(intake.openToIntern);
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
    // Compared on the CANONICAL name, so intake's "Aetna/Meritain" matches a
    // provider who selected "Aetna". See lib/insurance.js.
    const providerInsurances = profile.insurances || [];
    if (clientInsurance && clientCanonInsurance) {
      if (acceptsInsurance(providerInsurances, clientInsurance)) {
        score += WEIGHTS.insurance;
        reasons.push(`Accepts ${clientCanonInsurance}`);
      } else if (providerInsurances.includes('Private Pay')) {
        reasons.push('Private Pay only (insurance mismatch)');
      } else {
        blockers.push(`Does not accept ${clientCanonInsurance}`);
      }
    } else if (clientInsurance) {
      // An insurance we can't place (a new plan, a typo). Flag it for a human
      // instead of asserting that nobody accepts it.
      reasons.push(`Unrecognized insurance: "${clientInsurance}" — verify manually`);
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

    // ── Day / time availability ────────────────────────────────────────────
    // The provider grid is day → slots, so we can check the day AND the slot.
    // The client's `times` field is free text, so parsed slots are used only as
    // a bonus — never a blocker. A garbled time note must not sink a good match.
    const grid = getAvailability(profile);
    const providerDayKeys = availableDayKeys(grid);
    const clientDaysShort = clientDays.map((d) => d.slice(0, 3));

    if (clientDaysShort.length > 0 && providerDayKeys.length > 0) {
      const overlapDays = providerDayKeys.filter((d) => clientDaysShort.includes(d.slice(0, 3)));
      if (overlapDays.length > 0) {
        if (clientSlots.length === 0) {
          // Client gave days but no usable time — day match is all we can check.
          score += WEIGHTS.days;
          reasons.push(`Available: ${overlapDays.map(dayLabel).join(', ')}`);
        } else {
          // Both sides specified: require the slot to land on a day they want.
          const hits = overlapDays.filter((d) => grid[d].some((s) => clientSlots.includes(s)));
          if (hits.length > 0) {
            score += WEIGHTS.days;
            const detail = hits.map((d) => {
              const slots = grid[d].filter((s) => clientSlots.includes(s));
              return `${dayLabel(d)} (${slots.map((s) => s[0].toUpperCase() + s.slice(1)).join('/')})`;
            });
            reasons.push(`Available: ${detail.join(', ')}`);
          } else {
            // Right day, wrong time of day — partial credit, and say so.
            score += Math.round(WEIGHTS.days * 0.4);
            reasons.push(`Day matches (${overlapDays.map(dayLabel).join(', ')}) but not preferred time`);
          }
        }
      }
    } else if (providerDayKeys.length > 0) {
      score += Math.round(WEIGHTS.days * 0.5);
    }

    // ── Intern preference ──────────────────────────────────────────────────
    const isIntern = !!profile.isIntern;
    if (!isIntern) {
      // Licensed provider — always OK regardless of client preference
      score += WEIGHTS.intern;
    } else if (clientInternStance === 'yes') {
      score += WEIGHTS.intern;
      reasons.push('Client open to intern');
    } else if (clientInternStance === 'maybe') {
      score += WEIGHTS.intern;
      reasons.push('Client open to discussing an intern');
    } else if (clientInternStance === 'no') {
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
