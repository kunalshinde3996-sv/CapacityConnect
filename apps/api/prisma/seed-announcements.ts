// Homepage announcements (Phase 3). `daysAgo: null` = draft (not published).
export const announcements: {
  type: 'NOTICE' | 'ACHIEVEMENT' | 'NEW_CONTENT';
  title: string;
  body: string;
  linkUrl?: string;
  daysAgo: number | null;
}[] = [
  {
    type: 'NOTICE',
    title: 'Pre-monsoon radar refresher: registrations open',
    body: 'IMD Pune runs a refresher on DWR products before the next pre-monsoon season. Forecasters from all regional centres are welcome.',
    linkUrl: '/courses',
    daysAgo: 1,
  },
  {
    type: 'NOTICE',
    title: 'Verify your certificates before 31 October',
    body: 'Trainers: upload certificates for your competency claims. Only verified evidence counts fully when trainers are matched to courses.',
    linkUrl: '/profile',
    daysAgo: 4,
  },
  {
    type: 'ACHIEVEMENT',
    title: 'INCOIS tsunami drill completed in record time',
    body: 'The Indian Tsunami Early Warning Centre issued its first bulletin within 7 minutes during the national drill. Congratulations to the operations team.',
    daysAgo: 3,
  },
  {
    type: 'ACHIEVEMENT',
    title: '10 observers certified in AWS field calibration',
    body: 'Trainees from Pune, Hyderabad and Goa completed the AWS Installation and Field Calibration course this quarter.',
    daysAgo: 8,
  },
  {
    type: 'NEW_CONTENT',
    title: 'New lecture: How a Doppler Weather Radar scans',
    body: 'A short animated lecture by Dr. Meera Kulkarni is now in the library, tagged Radar Meteorology.',
    linkUrl: '/library',
    daysAgo: 2,
  },
  {
    type: 'NOTICE',
    title: 'Winter expedition briefing (draft)',
    body: 'Draft notice for the NCPOR winter expedition field-safety briefing. Not published yet.',
    daysAgo: null,
  },
];
