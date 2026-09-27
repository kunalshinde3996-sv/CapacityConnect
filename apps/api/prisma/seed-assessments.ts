// Demo assessments (Phase 2). Every competency that should get a skill level is tested
// by at least 2 questions (see services/assessment/scoring.ts).

// [question, competency, [4 options], correct option index, explanation]
export type SeedQuestion = [string, string, [string, string, string, string], number, string];

export interface SeedAssessment {
  course: string;
  title: string;
  description: string;
  deadlineDays: number; // relative to the day the seed runs (negative = already closed)
  durationMinutes: number | null;
  published: boolean;
  attemptShare: number; // share of enrolled trainees who submitted (deterministic)
  // Competencies the class finds harder: the chance of a correct answer is multiplied by this
  difficulty?: Record<string, number>;
  questions: SeedQuestion[];
}

const R = 'Radar Meteorology';
const N = 'Nowcasting';
const Q = 'Data Quality Control';

export const assessments: SeedAssessment[] = [
  {
    course: 'DWR Operations for Forecasters',
    title: 'Radar fundamentals check',
    description: 'Covers modules 1 and 2. One attempt, 20 minutes.',
    deadlineDays: -6,
    durationMinutes: 20,
    published: true,
    attemptShare: 0.7,
    difficulty: { [Q]: 0.55, [N]: 0.85 },
    questions: [
      ['A Doppler weather radar measures radial velocity from…', R, ['The change in frequency of the returned pulse', 'The strength of the returned pulse', 'The time the pulse takes to return', 'The polarisation of the pulse'], 0, 'Motion toward or away from the radar shifts the frequency (Doppler effect).'],
      ['Reflectivity is usually shown in which unit?', R, ['dBZ', 'hPa', 'm/s', 'mm/h'], 0, 'Reflectivity factor Z is shown on a logarithmic scale, dBZ.'],
      ['Why does a radar scan at several elevation angles?', R, ['To build a 3-D volume of the atmosphere', 'To save power', 'To avoid measuring rain', 'To measure wind at the surface only'], 0, 'A volume scan combines many elevations into a 3-D picture.'],
      ['Nowcasting mainly covers which forecast range?', N, ['0 to 6 hours', '1 to 3 days', '1 to 2 weeks', 'A whole season'], 0, 'Nowcasting is very-short-range forecasting, typically 0-6 h.'],
      ['New thunderstorm cells often form along…', N, ['Outflow boundaries from earlier storms', 'The centre of an old anvil', 'Areas of clear, stable air', 'The radar site'], 0, 'Converging outflow boundaries lift moist air and trigger new cells.'],
      ['A simple nowcast of a moving storm starts by…', N, ['Extrapolating its recent motion', 'Running a climate model', "Averaging last year's rainfall", 'Ignoring the radar data'], 0, 'Extrapolation of echo motion is the first step, then adjust for growth and decay.'],
      ['Stationary echoes near the radar on a clear day are most likely…', Q, ['Ground clutter', 'Heavy rain', 'A tropical cyclone', 'Snow'], 0, 'Fixed targets such as buildings and hills return echoes: ground clutter.'],
      ['Anomalous propagation (AP) happens when…', Q, ['The beam bends down to the ground in a temperature inversion', 'The radar is switched off', 'It rains very heavily', 'The antenna rotates too fast'], 0, 'Strong inversions bend the beam downward, so it hits the ground far away.'],
    ],
  },
  {
    course: 'DWR Operations for Forecasters',
    title: 'Reading radar products',
    description: 'Covers module 3. Open until the deadline, no time limit.',
    deadlineDays: 14,
    durationMinutes: null,
    published: true,
    attemptShare: 0.3,
    difficulty: { [Q]: 0.6 },
    questions: [
      ['A "hook echo" on a reflectivity image can indicate…', R, ['A rotating storm (mesocyclone)', 'Light drizzle', 'Ground clutter', 'A calibration error'], 0, 'Hook echoes are classic signatures of rotating supercells.'],
      ['On a velocity image, strong inbound and outbound velocities right next to each other show…', R, ['Rotation', 'No wind', 'Snow', 'Beam blockage'], 0, 'Adjacent inbound/outbound maxima indicate rotation.'],
      ['VIL (vertically integrated liquid) is useful to estimate…', R, ['Hail potential', 'Air temperature', 'Wind direction at the surface', 'Humidity'], 0, 'High VIL in a small area suggests large hail.'],
      ['A wedge of missing data behind a hill is caused by…', Q, ['Beam blockage', 'Heavy rain', 'Doppler shift', 'Calibration drift'], 0, 'Terrain blocks the beam, so nothing is seen behind it.'],
      ['Radar rainfall estimates should be checked against…', Q, ['Rain gauges and AWS', 'Satellite ozone data', 'Tide gauges', 'Seismic sensors'], 0, 'Ground truth from gauges corrects radar biases.'],
      ['A sudden jump in reflectivity everywhere after maintenance suggests…', Q, ['A calibration problem', 'A cyclone', 'Clear air', 'Normal daily change'], 0, 'A uniform jump across the whole scan points to calibration, not weather.'],
    ],
  },
  {
    course: 'DWR Operations for Forecasters',
    title: 'Nowcasting case study',
    description: 'Draft: not published yet.',
    deadlineDays: 30,
    durationMinutes: 30,
    published: false,
    attemptShare: 0,
    questions: [
      ['Which product best shows where a squall line is heading?', N, ['A loop of reflectivity images', 'A single rain-gauge reading', 'A monthly rainfall map', "Last week's upper-air chart"], 0, 'A loop shows motion and development.'],
      ['Impact-based warnings describe…', N, ['What the weather will do to people and places', 'Only the rainfall amount', 'Only the radar settings', 'Only the temperature'], 0, 'They focus on expected impacts, not just numbers.'],
      ['Radial velocity cannot detect wind that is…', R, ['Moving across the beam', 'Moving toward the radar', 'Moving away from the radar', 'Inside heavy rain'], 0, 'Only the component along the beam is measured.'],
      ['Doubling the distance from the radar makes the beam…', R, ['Wider and higher above the ground', 'Narrower', 'Closer to the ground', 'Unchanged'], 0, 'The beam spreads and, with Earth curvature, rises with range.'],
    ],
  },
  {
    course: 'Cyber Hygiene for Observing Networks',
    title: 'Cyber hygiene quiz',
    description: 'Covers all three modules.',
    deadlineDays: -3,
    durationMinutes: 15,
    published: true,
    attemptShare: 0.55,
    difficulty: { 'Incident Response': 0.7 },
    questions: [
      ['The safest way to log in to a remote Linux server is…', 'Network Security', ['SSH with a key pair', 'Telnet with a shared password', 'FTP', 'An open port with no login'], 0, 'SSH keys avoid guessable passwords and encrypt the session.'],
      ['A data logger still has its factory default password. The risk is…', 'Network Security', ['Anyone who knows the default can take control', 'The data becomes more accurate', 'Nothing, defaults are secret', 'The logger runs faster'], 0, 'Default passwords are published online; always change them.'],
      ['You suspect a server is compromised. What is the first step?', 'Incident Response', ['Isolate it from the network and report it', 'Delete all logs', 'Ignore it until Monday', 'Post about it on social media'], 0, 'Contain first, preserve evidence, and report.'],
      ['Cyber incidents in India must be reported to CERT-In within…', 'Incident Response', ['6 hours', '6 days', '6 weeks', 'Never'], 0, 'CERT-In directions require reporting within 6 hours.'],
      ['Which command shows running processes on Linux?', 'Linux System Administration', ['ps', 'cd', 'mkdir', 'echo'], 0, 'ps lists processes; top shows them live.'],
      ['Why keep servers updated with security patches?', 'Linux System Administration', ['Patches close known vulnerabilities', 'Updates make passwords optional', 'Patches delete old data', 'It is only cosmetic'], 0, 'Most attacks exploit known, already-fixed weaknesses.'],
    ],
  },
  {
    course: 'Ocean Data Analysis with Python',
    title: 'Argo data warm-up',
    description: 'A short check before module 2. No time limit.',
    deadlineDays: 21,
    durationMinutes: null,
    published: true,
    attemptShare: 0.4,
    questions: [
      ['Argo floats mainly measure…', 'Ocean Data Analysis', ['Temperature and salinity profiles', 'Wind speed', 'Rainfall', 'Air pressure'], 0, 'Argo floats profile temperature and salinity with depth.'],
      ['The mixed-layer depth is where…', 'Ocean Data Analysis', ['Temperature and density are nearly uniform near the surface', 'The deepest ocean trench is', 'The float is stored', 'Waves break on the coast'], 0, 'Surface mixing keeps the top layer almost uniform.'],
      ['Which Python library works best with labelled NetCDF data?', 'Python for Scientific Computing', ['xarray', 'tkinter', 'pygame', 'requests'], 0, 'xarray handles labelled multi-dimensional arrays from NetCDF.'],
      ['In pandas, df.describe() gives…', 'Python for Scientific Computing', ['Summary statistics of the columns', 'A plot', 'The file size', 'Nothing'], 0, 'It returns count, mean, std, min, quartiles and max.'],
      ['An Argo QC flag of 4 means…', Q, ['Bad data', 'Good data', 'Not yet checked', 'Interpolated value'], 0, 'Flag 1 is good, 4 is bad.'],
      ['A salinity profile that slowly drifts over months suggests…', Q, ['Sensor drift needing correction', 'A real climate shift everywhere', 'A software update', 'Better accuracy'], 0, 'Slow drift is typical of sensor problems; delayed-mode QC corrects it.'],
    ],
  },
  {
    course: 'AWS Installation and Field Calibration',
    title: 'Field calibration quiz',
    description: 'Covers sensor calibration and maintenance.',
    deadlineDays: -10,
    durationMinutes: 15,
    published: true,
    attemptShare: 0.75,
    difficulty: { [Q]: 0.7 },
    questions: [
      ['A temperature sensor should be installed…', 'AWS Calibration', ['In a ventilated radiation shield about 1.25-2 m above ground', 'In direct sunlight on a roof', 'Inside the logger box', 'Buried in the soil'], 0, 'A shield and standard height give representative air temperature.'],
      ['Calibration compares the station sensor with…', 'AWS Calibration', ['A traceable reference instrument', "Yesterday's forecast", 'A different station 100 km away', 'Nothing'], 0, 'A reference with known accuracy is needed.'],
      ['A tipping-bucket rain gauge is calibrated by…', 'AWS Calibration', ['Pouring a known volume of water and counting tips', 'Measuring wind speed', 'Weighing the logger', 'Changing the battery'], 0, 'Known volume versus counted tips gives the calibration factor.'],
      ['Readings stuck at the same value for hours usually mean…', Q, ['A sensor or logger fault', 'Perfectly calm weather', 'A calibration success', 'A leap second'], 0, 'Flat-lining is a classic fault signature.'],
      ['Before a site visit, a field team should…', Q, ['Review recent data for gaps and drift', 'Delete old data', 'Switch off the station', 'Skip the checklist'], 0, 'Knowing the problems in advance saves a second trip.'],
      ['On a field team, safety briefings are the responsibility of…', 'Team Leadership', ['The team leader', 'Nobody', 'Only the newest member', 'The data centre'], 0, 'The leader makes sure everyone knows the risks.'],
    ],
  },
  {
    course: 'Cyclone Warnings: From Guidance to Public Message',
    title: 'Cyclone basics quiz',
    description: 'Satellite analysis and NWP guidance.',
    deadlineDays: -2,
    durationMinutes: 20,
    published: true,
    attemptShare: 0.7,
    difficulty: { 'Numerical Weather Prediction': 0.75 },
    questions: [
      ['The Dvorak technique estimates cyclone intensity from…', 'Tropical Cyclone Forecasting', ['Cloud patterns in satellite images', 'Tide gauges', 'Radiosondes only', 'Rain gauges'], 0, 'Dvorak uses cloud patterns and temperatures in satellite imagery.'],
      ["A cyclone's cone of uncertainty shows…", 'Tropical Cyclone Forecasting', ['The likely range of the track', 'The size of the rain area', 'The wind speed', 'The storm surge height'], 0, 'It represents track uncertainty, not size.'],
      ['An ensemble forecast is…', 'Numerical Weather Prediction', ['Many model runs with slightly different starting conditions', 'One very long model run', 'An average of past storms', 'A satellite product'], 0, 'The spread of members shows forecast uncertainty.'],
      ['When models disagree strongly on a track, forecasters should…', 'Numerical Weather Prediction', ['Communicate higher uncertainty and use consensus', 'Pick the model with the scariest track', 'Wait until landfall', 'Ignore all models'], 0, 'Consensus plus clear uncertainty messaging works best.'],
      ['A cloud-free eye in infrared imagery usually means…', 'Satellite Meteorology', ['An intense, well-organised cyclone', 'The cyclone has dissipated', 'A sensor error', 'Clear weather everywhere'], 0, 'A clear, warm eye surrounded by cold cloud tops indicates intensity.'],
      ['Very cold cloud-top temperatures in IR indicate…', 'Satellite Meteorology', ['Tall, deep convection', 'Fog', 'Clear sky', 'Sea surface'], 0, 'Colder tops are higher, so convection is deeper.'],
    ],
  },
  {
    course: 'Tsunami Warning Centre Operations',
    title: 'Warning chain quiz',
    description: 'From earthquake to coastal advisory.',
    deadlineDays: -4,
    durationMinutes: 15,
    published: true,
    attemptShare: 1,
    questions: [
      ['Which earthquakes can generate a tsunami?', 'Tsunami Early Warning', ['Large, shallow undersea earthquakes', 'Any small inland earthquake', 'Only deep earthquakes', 'Only earthquakes on land'], 0, 'Large, shallow, undersea ruptures move the sea floor.'],
      ['Pre-computed scenario databases let the centre…', 'Tsunami Early Warning', ['Issue a first estimate within minutes', 'Skip monitoring', 'Predict earthquakes days ahead', 'Avoid issuing bulletins'], 0, 'Scenarios avoid slow modelling in the first minutes.'],
      ['After a warning, bulletins must reach…', 'Stakeholder Coordination', ['NDMA and coastal state authorities', 'Only the media', 'Only scientists', 'Nobody'], 0, 'Disaster managers act on the warnings.'],
      ['Regular drills with state authorities help to…', 'Stakeholder Coordination', ['Test and improve the communication chain', 'Replace real warnings', 'Save paper', 'Reduce data'], 0, 'Drills reveal weak links before a real event.'],
      ['Bottom pressure recorders detect…', 'Ocean State Forecasting', ['A tsunami wave passing in the deep ocean', 'Air pollution', 'Rainfall', 'Wind direction'], 0, 'They sense small sea-level changes from the sea floor.'],
      ['Storm surge is mainly caused by…', 'Ocean State Forecasting', ['Strong winds and low pressure pushing water ashore', 'Earthquakes', 'Tides alone', 'River floods only'], 0, 'Wind stress and low pressure pile water onto the coast.'],
    ],
  },
];
