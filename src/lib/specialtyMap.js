/**
 * Canonical specialty tags — shared between provider profiles and
 * inquiry problem-checklist normalization.
 *
 * ADDING A NEW SPECIALTY:
 *   1. Add it to SPECIALTIES below.
 *   2. Add keyword entries to CHECKLIST_MAP that point to it.
 */

export const SPECIALTIES = [
  'Anxiety',
  'Depression',
  'Trauma/PTSD',
  'ADHD/ADD',
  'OCD',
  'Grief & Loss',
  'Relationship Issues',
  'Family Conflict',
  'Substance Use',
  'Eating Disorders',
  'LGBTQ+ Affirming',
  'Autism/Neurodivergent',
  'Anger Management',
  'Bipolar Disorder',
  'Personality Disorders',
  'Life Transitions',
  'Stress Management',
  'Self-Esteem',
  'Parenting Issues',
  'Problems at School',
  'Problems at Work',
  'Suicidality/Self-Harm',
  'Polyamory/Non-Monogamy',
  'Sexual Functioning',
];

/**
 * Maps substrings found in raw JotForm checklist values → canonical specialty.
 * Keys are lowercase substrings; first match wins per raw item.
 * Add new entries here as new JotForm labels are discovered.
 */
const CHECKLIST_MAP = [
  ['anxiet',          'Anxiety'],
  ['panic',           'Anxiety'],
  ['depress',         'Depression'],
  ['mood',            'Depression'],
  ['trauma',          'Trauma/PTSD'],
  ['ptsd',            'Trauma/PTSD'],
  ['post-traumatic',  'Trauma/PTSD'],
  ['adhd',            'ADHD/ADD'],
  ['attention',       'ADHD/ADD'],
  ['add',             'ADHD/ADD'],
  ['ocd',             'OCD'],
  ['obsessive',       'OCD'],
  ['compulsive',      'OCD'],
  ['grief',           'Grief & Loss'],
  ['loss',            'Grief & Loss'],
  ['bereavement',     'Grief & Loss'],
  ['relationship',    'Relationship Issues'],
  ['couples',         'Relationship Issues'],
  ['marriage',        'Relationship Issues'],
  ['divorce',         'Relationship Issues'],
  ['family',          'Family Conflict'],
  ['parenting',       'Parenting Issues'],
  ['parent',          'Parenting Issues'],
  ['substance',       'Substance Use'],
  ['alcohol',         'Substance Use'],
  ['drug',            'Substance Use'],
  ['addiction',       'Substance Use'],
  ['eating',          'Eating Disorders'],
  ['anorexia',        'Eating Disorders'],
  ['bulimia',         'Eating Disorders'],
  ['binge',           'Eating Disorders'],
  ['lgbtq',           'LGBTQ+ Affirming'],
  ['gender identity', 'LGBTQ+ Affirming'],
  ['sexual identity', 'LGBTQ+ Affirming'],
  ['queer',           'LGBTQ+ Affirming'],
  ['autism',          'Autism/Neurodivergent'],
  ['asd',             'Autism/Neurodivergent'],
  ['neurodivergent',  'Autism/Neurodivergent'],
  ['anger',           'Anger Management'],
  ['bipolar',         'Bipolar Disorder'],
  ['manic',           'Bipolar Disorder'],
  ['personality',     'Personality Disorders'],
  ['borderline',      'Personality Disorders'],
  ['bpd',             'Personality Disorders'],
  ['life transition', 'Life Transitions'],
  ['stress',          'Stress Management'],
  ['burnout',         'Stress Management'],
  ['self-esteem',     'Self-Esteem'],
  ['self esteem',     'Self-Esteem'],
  ['confidence',      'Self-Esteem'],
  ['self-worth',      'Self-Esteem'],
  ['suicid',          'Suicidality/Self-Harm'],
  ['self-harm',       'Suicidality/Self-Harm'],
  ['self harm',       'Suicidality/Self-Harm'],
  ['cutting',         'Suicidality/Self-Harm'],
  ['school',         'Problems at School'],
  ['work',           'Problems at Work'],
  ['work stress',    'Problems at Work'],
  ['work problems',   'Problems at Work'],
  ['problems at work',   'Problems at Work'],
  ['polyamory',      'Polyamory/Non-Monogamy'],
  ['non-monogamy',   'Polyamory/Non-Monogamy'],
  ['sexual',         'Sexual Functioning'],
  ['sexuality',       'Sexual Functioning'],
];

/**
 * Parse a raw problem-checklist string (comma-separated JotForm labels) into
 * an array of canonical specialty tags. Unrecognized items are returned as-is
 * so no information is lost.
 *
 * @param {string} raw  e.g. "Anxiety, Depression, ADHD, OCD"
 * @returns {{ matched: string[], unmatched: string[] }}
 */
export function parseChecklist(raw) {
  if (!raw) return { matched: [], unmatched: [] };

  const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const matched = new Set();
  const unmatched = [];

  for (const item of items) {
    const lower = item.toLowerCase();
    let found = false;
    for (const [keyword, specialty] of CHECKLIST_MAP) {
      if (lower.includes(keyword)) {
        matched.add(specialty);
        found = true;
        break;
      }
    }
    if (!found) unmatched.push(item);
  }

  return { matched: [...matched], unmatched };
}
