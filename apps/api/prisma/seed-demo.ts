// The demo scenario (DEMO.md). One station with a clear, fixable skill gap:
//
//   NCPOR Goa needs AWS Calibration (target L3) to keep its polar-station weather
//   stations running. Several Goa trainees are below target and no trainer at Goa is
//   qualified. Trainer matching finds Sanjay Iyer (IMD Pune), who teaches "AWS
//   Installation and Field Calibration". Three Goa trainees already completed the course
//   questionnaire and went from L1 to L3. During the demo, Pooja Menon takes the open
//   check-up (due within 24 hours) and her level improves too: the Goa gap shrinks live.

import type { SeedQuestion } from './seed-assessments.js';

export const DEMO_STATION = 'NCPOR-GOA';
export const DEMO_COMPETENCY = 'AWS Calibration';
export const DEMO_COURSE = 'AWS Installation and Field Calibration';
export const DEMO_TRAINEE = 'pooja.menon@ncpor.example';
export const IMPROVED_COUNT = 3; // Goa trainees who already completed the questionnaire
export const CLOSED_QUIZ = 'Field calibration quiz';

// Open during the demo; the deadline is 20 hours after seeding, so the 24-hour reminder
// is due at once. Re-run the seed on the day of the demo (see DEMO.md).
export const CHECKUP_TITLE = 'AWS calibration check-up';
export const CHECKUP_DEADLINE_HOURS = 20;

export const checkupQuestions: SeedQuestion[] = [
  ['Before calibrating a pressure sensor you should first…', DEMO_COMPETENCY, ['Let it reach the same temperature as the reference', 'Switch off the logger for a day', 'Replace the battery', 'Move it into direct sunlight'], 0, 'Temperature differences cause readings to drift during the comparison.'],
  ['A calibration certificate for a reference instrument must be…', DEMO_COMPETENCY, ['Traceable and still in date', 'Signed by the station leader', 'Laminated', 'Older than five years'], 0, 'Only a traceable, current reference gives trustworthy corrections.'],
  ['After calibration, the correction you found should be…', DEMO_COMPETENCY, ['Recorded in the station log with date and reference used', 'Kept only in your memory', 'Applied to last year\'s data without a record', 'Ignored if it is small'], 0, 'Documented corrections make the data auditable.'],
  ['Wind speed stuck at zero during a known storm most likely means…', 'Data Quality Control', ['The anemometer is jammed or iced', 'The storm has no wind', 'The logger clock is wrong', 'Calibration was perfect'], 0, 'Frozen or jammed cups are common at polar stations.'],
  ['Data from a sensor under repair should be…', 'Data Quality Control', ['Flagged as suspect for that period', 'Deleted from the archive', 'Copied from a nearby station', 'Left unmarked'], 0, 'Flags keep the record honest without destroying data.'],
];
