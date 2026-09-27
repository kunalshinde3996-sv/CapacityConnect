// Demo course feedback (Phase 2). Chosen so the teaching-evidence rule is visible:
//  - Cyclone course (Arjun): 5 good ratings -> his self-declared Public Risk Communication
//    (L2, trust 0.5) is beaten by a teaching record (L3, trust 0.8): his cyclone fit goes up.
//  - AWS course (Sanjay): average 3.5 -> does not count.
//  - Tsunami course (Kavita): only 2 ratings -> does not count yet.

export const courseFeedback: Record<string, [number, string | null][]> = {
  'DWR Operations for Forecasters': [
    [5, 'The velocity examples from real monsoon storms were excellent.'],
    [5, 'Best explanation of scan strategies I have had.'],
    [4, 'Very useful. Would like more time on nowcasting case studies.'],
    [5, null],
    [4, 'Good pace, clear slides.'],
    [5, 'I now read hook echoes with confidence.'],
    [4, null],
    [5, 'Please run an advanced batch.'],
    [4, 'The QC module was hard but important.'],
  ],
  'Cyclone Warnings: From Guidance to Public Message': [
    [5, 'Writing the warning together as a group was the most useful part.'],
    [4, 'Good mix of Dvorak practice and communication.'],
    [5, 'Clear, practical examples from Fani and Biparjoy.'],
    [4, null],
    [4, 'More ensemble exercises would help.'],
  ],
  'Cyber Hygiene for Observing Networks': [
    [5, 'Changed the default passwords on our loggers the same week.'],
    [4, 'Practical and short.'],
    [4, null],
    [5, 'The incident drill was eye-opening.'],
    [4, 'Would like a Linux lab session.'],
    [4, null],
  ],
  'Ocean Data Analysis with Python': [
    [5, 'Finally understood xarray.'],
    [5, null],
    [4, 'Great notebooks.'],
  ],
  'AWS Installation and Field Calibration': [
    [4, 'Good field checklist.'],
    [3, 'Too much theory, not enough time with real sensors.'],
    [3, null],
    [4, 'Useful calibration video.'],
    [3, 'Sessions started late.'],
    [4, null],
  ],
  'Tsunami Warning Centre Operations': [
    [5, 'Excellent walkthrough of the warning chain.'],
    [4, null],
  ],
};
