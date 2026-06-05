// Benchmark ranges (£) for UK independent garages — provisional figures, validate before go-live.
// min/max represent the typical spread for a non-budget, non-main-dealer independent.
// safety_critical: shown as a label on free tier.
// keywords: matched against DVSA defect text for Pro MOT advisory matching.

export const CATEGORIES = [
  {
    id: 'full-service',
    label: 'Full service',
    min: 120, max: 280,
    safety_critical: false,
    mot_testable: false,
    keywords: [],
  },
  {
    id: 'interim-service',
    label: 'Interim / oil & filter service',
    min: 65, max: 130,
    safety_critical: false,
    mot_testable: false,
    keywords: [],
  },
  {
    id: 'front-pads',
    label: 'Front brake pads',
    min: 80, max: 160,
    safety_critical: true,
    mot_testable: true,
    keywords: ['brake', 'pad', 'front'],
  },
  {
    id: 'front-pads-discs',
    label: 'Front brake pads + discs',
    min: 160, max: 320,
    safety_critical: true,
    mot_testable: true,
    keywords: ['brake', 'disc', 'front'],
  },
  {
    id: 'rear-pads',
    label: 'Rear brake pads',
    min: 70, max: 140,
    safety_critical: true,
    mot_testable: true,
    keywords: ['brake', 'pad', 'rear'],
  },
  {
    id: 'rear-pads-discs',
    label: 'Rear brake pads + discs',
    min: 140, max: 280,
    safety_critical: true,
    mot_testable: true,
    keywords: ['brake', 'disc', 'rear'],
  },
  {
    id: 'timing-belt',
    label: 'Timing belt replacement',
    min: 300, max: 650,
    safety_critical: true,
    mot_testable: false,
    keywords: ['timing', 'belt', 'chain'],
  },
  {
    id: 'tyre',
    label: 'Tyre replacement (per tyre)',
    min: 65, max: 140,
    safety_critical: true,
    mot_testable: true,
    keywords: ['tyre', 'worn', 'tread', 'illegal'],
  },
  {
    id: 'battery',
    label: '12V battery replacement',
    min: 90, max: 200,
    safety_critical: false,
    mot_testable: false,
    keywords: [],
  },
  {
    id: 'mot-test',
    label: 'MOT test only',
    min: 35, max: 55,
    safety_critical: false,
    mot_testable: true,
    keywords: [],
  },
];
