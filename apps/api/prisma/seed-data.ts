// Demo data for Capacity Connect. All people are fictional; emails use the reserved
// ".example" domain so they can never reach a real inbox.

import type { CompetencyCategory, EvidenceType } from '../src/generated/prisma/client.js';

export const DEMO_PASSWORD = 'Demo@2026';

export const institutes = [
  { code: 'IMD-PUNE', name: 'India Meteorological Department, Pune', city: 'Pune', domain: 'imd.example' },
  { code: 'INCOIS-HYD', name: 'Indian National Centre for Ocean Information Services', city: 'Hyderabad', domain: 'incois.example' },
  { code: 'NCPOR-GOA', name: 'National Centre for Polar and Ocean Research', city: 'Goa', domain: 'ncpor.example' },
] as const;

export type InstituteCode = (typeof institutes)[number]['code'];

export const competencies: { name: string; category: CompetencyCategory; description: string }[] = [
  // Domain (earth-science knowledge)
  { name: 'Radar Meteorology', category: 'DOMAIN', description: 'Operating Doppler weather radars and interpreting reflectivity, velocity and derived products.' },
  { name: 'Nowcasting', category: 'DOMAIN', description: 'Very short-range (0-6 h) forecasting of thunderstorms, heavy rain and squalls.' },
  { name: 'Numerical Weather Prediction', category: 'DOMAIN', description: 'Running and interpreting NWP models, ensembles and model diagnostics.' },
  { name: 'Satellite Meteorology', category: 'DOMAIN', description: 'Using INSAT/geostationary and polar satellite imagery and products.' },
  { name: 'Tropical Cyclone Forecasting', category: 'DOMAIN', description: 'Track, intensity and landfall forecasting of tropical cyclones.' },
  { name: 'Monsoon Dynamics', category: 'DOMAIN', description: 'Physical understanding of the Indian summer and winter monsoon.' },
  { name: 'Ocean Data Analysis', category: 'DOMAIN', description: 'Processing Argo, buoy and ship observations of the ocean.' },
  { name: 'Tsunami Early Warning', category: 'DOMAIN', description: 'Seismic event assessment, tsunami modelling and warning dissemination.' },
  { name: 'Ocean State Forecasting', category: 'DOMAIN', description: 'Wave, swell, high-wave and storm-surge forecasting for coasts and fishers.' },
  { name: 'Polar Field Operations', category: 'DOMAIN', description: 'Planning and running scientific field campaigns in Antarctic and Arctic stations.' },
  { name: 'Climate Data Analysis', category: 'DOMAIN', description: 'Long-term climate records, trends, extremes and reanalysis datasets.' },
  { name: 'AWS Calibration', category: 'DOMAIN', description: 'Installing, calibrating and maintaining Automatic Weather Stations and sensors.' },
  // Functional (technical / tool skills)
  { name: 'Network Security', category: 'FUNCTIONAL', description: 'Securing networks, firewalls and data links of observing systems.' },
  { name: 'Incident Response', category: 'FUNCTIONAL', description: 'Detecting, containing and recovering from cyber or operational incidents.' },
  { name: 'Linux System Administration', category: 'FUNCTIONAL', description: 'Administering Linux servers that run models and data pipelines.' },
  { name: 'Python for Scientific Computing', category: 'FUNCTIONAL', description: 'NumPy, xarray, pandas and plotting for earth-science data.' },
  { name: 'Data Quality Control', category: 'FUNCTIONAL', description: 'Checking observations for errors, gaps and sensor drift.' },
  { name: 'GIS and Remote Sensing', category: 'FUNCTIONAL', description: 'Spatial analysis and mapping with GIS tools and remote-sensing data.' },
  { name: 'Database Management', category: 'FUNCTIONAL', description: 'Designing and maintaining observation and metadata databases.' },
  { name: 'Project Management', category: 'FUNCTIONAL', description: 'Planning, budgeting and tracking scientific and technical projects.' },
  // Behavioural (people skills)
  { name: 'Scientific Writing', category: 'BEHAVIOURAL', description: 'Writing papers, technical reports and bulletins clearly.' },
  { name: 'Team Leadership', category: 'BEHAVIOURAL', description: 'Leading field teams and operational shifts.' },
  { name: 'Public Risk Communication', category: 'BEHAVIOURAL', description: 'Explaining warnings and uncertainty to the public, media and officials.' },
  { name: 'Training Delivery', category: 'BEHAVIOURAL', description: 'Designing and delivering effective training sessions for adults.' },
  { name: 'Stakeholder Coordination', category: 'BEHAVIOURAL', description: 'Working with disaster management authorities, ports and state agencies.' },
];

// Weights for each subject must sum to 1.0 (the seed checks this).
export const subjects: { name: string; description: string; requirements: [string, number, string][] }[] = [
  {
    name: 'Doppler Weather Radar Operations',
    description: 'Operating DWRs and turning radar products into nowcasts for severe weather.',
    requirements: [
      ['Radar Meteorology', 3, '0.45'],
      ['Nowcasting', 2, '0.25'],
      ['Data Quality Control', 2, '0.15'],
      ['Training Delivery', 2, '0.15'],
    ],
  },
  {
    name: 'Cybersecurity Basics for Observing Networks',
    description: 'Protecting AWS, radar and data-centre networks from common cyber threats.',
    requirements: [
      ['Network Security', 3, '0.40'],
      ['Incident Response', 2, '0.30'],
      ['Linux System Administration', 2, '0.20'],
      ['Training Delivery', 2, '0.10'],
    ],
  },
  {
    name: 'Ocean Data Analysis with Python',
    description: 'Hands-on analysis of Argo and buoy data using Python and xarray.',
    requirements: [
      ['Ocean Data Analysis', 3, '0.40'],
      ['Python for Scientific Computing', 3, '0.30'],
      ['Data Quality Control', 2, '0.15'],
      ['Scientific Writing', 2, '0.15'],
    ],
  },
  {
    name: 'AWS Installation and Calibration',
    description: 'Field installation, sensor calibration and upkeep of Automatic Weather Stations.',
    requirements: [
      ['AWS Calibration', 3, '0.50'],
      ['Data Quality Control', 2, '0.20'],
      ['Team Leadership', 2, '0.20'],
      ['Linux System Administration', 1, '0.10'],
    ],
  },
  {
    name: 'Tropical Cyclone Forecasting and Warning Communication',
    description: 'From satellite and NWP guidance to clear, actionable cyclone warnings.',
    requirements: [
      ['Tropical Cyclone Forecasting', 3, '0.35'],
      ['Numerical Weather Prediction', 2, '0.25'],
      ['Satellite Meteorology', 2, '0.20'],
      ['Public Risk Communication', 3, '0.20'],
    ],
  },
  {
    name: 'Tsunami Early Warning Operations',
    description: 'Running the tsunami warning chain from seismic alert to coastal advisories.',
    requirements: [
      ['Tsunami Early Warning', 3, '0.40'],
      ['Stakeholder Coordination', 2, '0.25'],
      ['Ocean State Forecasting', 2, '0.20'],
      ['Incident Response', 2, '0.15'],
    ],
  },
];

// Evidence behind a claim. For CERTIFICATE / QUALIFICATION the seed also creates the
// matching Certificate / Qualification row and links it to the claim.
export interface SeedClaim {
  competency: string;
  level: number;
  evidence: EvidenceType;
  verified?: boolean;
  note: string;
  document?: { title: string; issuer: string; year: number }; // certificate or qualification details
}

export interface SeedTrainer {
  fullName: string;
  emailLocal: string;
  institute: InstituteCode;
  designation: string;
  headline: string;
  years: number;
  claims: SeedClaim[];
}

export const trainers: SeedTrainer[] = [
  {
    fullName: 'Dr. Meera Kulkarni',
    emailLocal: 'meera.kulkarni',
    institute: 'IMD-PUNE',
    designation: 'Scientist-E',
    headline: 'Radar meteorologist, ran the DWR network operations cell for 8 years',
    years: 18,
    claims: [
      { competency: 'Radar Meteorology', level: 4, evidence: 'CERTIFICATE', verified: true, note: 'WMO advanced weather radar training', document: { title: 'Advanced Weather Radar Meteorology', issuer: 'WMO Regional Training Centre', year: 2016 } },
      { competency: 'Nowcasting', level: 3, evidence: 'EXPERIENCE', note: 'Led monsoon nowcasting desk, Mumbai 2018-2022' },
      { competency: 'Data Quality Control', level: 3, evidence: 'EXPERIENCE', note: 'Radar data QC protocols for 12 DWR sites' },
      { competency: 'Training Delivery', level: 3, evidence: 'TEACHING', note: 'Faculty, IMD Meteorological Training Institute (6 batches)' },
      { competency: 'Satellite Meteorology', level: 2, evidence: 'SELF_DECLARED', note: 'Uses INSAT-3D products daily' },
    ],
  },
  {
    fullName: 'Arjun Menon',
    emailLocal: 'arjun.menon',
    institute: 'IMD-PUNE',
    designation: 'Meteorologist Grade-I',
    headline: 'Cyclone forecaster with strong NWP background',
    years: 11,
    claims: [
      { competency: 'Tropical Cyclone Forecasting', level: 3, evidence: 'EXPERIENCE', note: 'Duty forecaster, Cyclone Warning Division (Fani, Amphan, Biparjoy)' },
      { competency: 'Numerical Weather Prediction', level: 3, evidence: 'QUALIFICATION', verified: true, note: 'M.Tech thesis on WRF cyclone track ensembles', document: { title: 'M.Tech Atmospheric Science', issuer: 'Cochin University of Science and Technology', year: 2013 } },
      { competency: 'Radar Meteorology', level: 3, evidence: 'SELF_DECLARED', note: 'Regular user of DWR products' },
      { competency: 'Nowcasting', level: 3, evidence: 'EXPERIENCE', note: 'Nowcast shifts during 2021 and 2022 monsoon' },
      { competency: 'Public Risk Communication', level: 2, evidence: 'SELF_DECLARED', note: 'Media briefings during cyclone events' },
      { competency: 'Satellite Meteorology', level: 3, evidence: 'EXPERIENCE', note: 'Dvorak intensity analysis on duty' },
      { competency: 'Data Quality Control', level: 2, evidence: 'SELF_DECLARED', note: 'Checks radar data before issuing nowcasts' },
      { competency: 'Training Delivery', level: 2, evidence: 'SELF_DECLARED', note: 'Mentors newly joined forecasters' },
    ],
  },
  {
    fullName: 'Dr. Priya Nair',
    emailLocal: 'priya.nair',
    institute: 'INCOIS-HYD',
    designation: 'Scientist-D',
    headline: 'Physical oceanographer and Argo data specialist',
    years: 14,
    claims: [
      { competency: 'Ocean Data Analysis', level: 4, evidence: 'QUALIFICATION', verified: true, note: 'PhD on Indian Ocean mixed-layer variability from Argo', document: { title: 'PhD Physical Oceanography', issuer: 'Andhra University', year: 2012 } },
      { competency: 'Python for Scientific Computing', level: 3, evidence: 'CERTIFICATE', verified: true, note: 'Scientific Python certification', document: { title: 'Scientific Computing with Python', issuer: 'NPTEL (IIT Madras)', year: 2019 } },
      { competency: 'Data Quality Control', level: 3, evidence: 'EXPERIENCE', note: 'Owns Argo real-time QC pipeline' },
      { competency: 'Scientific Writing', level: 4, evidence: 'EXPERIENCE', note: '25+ peer-reviewed papers' },
      { competency: 'Ocean State Forecasting', level: 3, evidence: 'EXPERIENCE', note: 'Contributor to high-wave alert bulletins' },
    ],
  },
  {
    fullName: 'Rahul Deshmukh',
    emailLocal: 'rahul.deshmukh',
    institute: 'INCOIS-HYD',
    designation: 'Head, IT and Networks',
    headline: 'Security lead for the ocean data centre network',
    years: 15,
    claims: [
      { competency: 'Network Security', level: 4, evidence: 'CERTIFICATE', verified: true, note: 'CISSP certified', document: { title: 'Certified Information Systems Security Professional (CISSP)', issuer: 'ISC2', year: 2018 } },
      { competency: 'Incident Response', level: 3, evidence: 'CERTIFICATE', verified: true, note: 'CERT-In incident handling course', document: { title: 'Cyber Incident Handling and Response', issuer: 'CERT-In', year: 2021 } },
      { competency: 'Linux System Administration', level: 4, evidence: 'EXPERIENCE', note: 'Runs 60+ Linux servers for model and data systems' },
      { competency: 'Training Delivery', level: 2, evidence: 'TEACHING', note: 'Annual cyber-hygiene sessions for staff' },
    ],
  },
  {
    fullName: 'Sanjay Iyer',
    emailLocal: 'sanjay.iyer',
    institute: 'IMD-PUNE',
    designation: 'Scientist-C (Instrumentation)',
    headline: 'Field engineer for the AWS and ARG network',
    years: 12,
    claims: [
      { competency: 'AWS Calibration', level: 4, evidence: 'EXPERIENCE', note: 'Installed and calibrated 150+ AWS across Maharashtra and Goa' },
      { competency: 'Data Quality Control', level: 3, evidence: 'EXPERIENCE', note: 'Sensor drift checks for AWS network' },
      { competency: 'Team Leadership', level: 3, evidence: 'EXPERIENCE', note: 'Leads a 10-person field maintenance team' },
      { competency: 'Linux System Administration', level: 2, evidence: 'SELF_DECLARED', note: 'Maintains data-logger servers' },
      { competency: 'Network Security', level: 2, evidence: 'CERTIFICATE', verified: false, note: 'Certificate uploaded, awaiting admin verification', document: { title: 'Network Security Fundamentals', issuer: 'NIELIT', year: 2023 } },
    ],
  },
  {
    fullName: 'Dr. Kavita Rao',
    emailLocal: 'kavita.rao',
    institute: 'INCOIS-HYD',
    designation: 'Scientist-F',
    headline: 'Tsunami warning centre operations lead',
    years: 20,
    claims: [
      { competency: 'Tsunami Early Warning', level: 4, evidence: 'EXPERIENCE', note: 'Shift-in-charge, Indian Tsunami Early Warning Centre since 2009' },
      { competency: 'Ocean State Forecasting', level: 3, evidence: 'QUALIFICATION', verified: true, note: 'M.Sc thesis on storm-surge modelling', document: { title: 'M.Sc Marine Sciences', issuer: 'Goa University', year: 2004 } },
      { competency: 'Incident Response', level: 2, evidence: 'EXPERIENCE', note: 'Runs warning-centre drills (IOWave exercises)' },
      { competency: 'Stakeholder Coordination', level: 3, evidence: 'EXPERIENCE', note: 'Liaison with NDMA and coastal state authorities' },
      { competency: 'Public Risk Communication', level: 3, evidence: 'TEACHING', note: 'Trains district officials on tsunami advisories' },
    ],
  },
  {
    fullName: 'Anil Thomas',
    emailLocal: 'anil.thomas',
    institute: 'NCPOR-GOA',
    designation: 'Scientist-C',
    headline: 'Polar logistics and climate data scientist',
    years: 10,
    claims: [
      { competency: 'Polar Field Operations', level: 4, evidence: 'EXPERIENCE', note: 'Three winter-over expeditions at Bharati station' },
      { competency: 'Climate Data Analysis', level: 3, evidence: 'QUALIFICATION', verified: true, note: 'M.Sc Climate Science', document: { title: 'M.Sc Climate Science', issuer: 'Central University of Rajasthan', year: 2014 } },
      { competency: 'Python for Scientific Computing', level: 3, evidence: 'SELF_DECLARED', note: 'Writes analysis scripts for ice-core data' },
      { competency: 'Ocean Data Analysis', level: 2, evidence: 'SELF_DECLARED', note: 'Southern Ocean CTD data' },
      { competency: 'Team Leadership', level: 3, evidence: 'EXPERIENCE', note: 'Station leader, 2022 expedition' },
      { competency: 'Data Quality Control', level: 2, evidence: 'EXPERIENCE', note: 'QC of AWS data from Antarctic stations' },
      { competency: 'Scientific Writing', level: 3, evidence: 'SELF_DECLARED', note: 'Expedition reports and 6 papers' },
    ],
  },
  {
    fullName: 'Neha Joshi',
    emailLocal: 'neha.joshi',
    institute: 'NCPOR-GOA',
    designation: 'Project Scientist-B',
    headline: 'Early-career data scientist, GIS and Python',
    years: 3,
    claims: [
      { competency: 'Python for Scientific Computing', level: 4, evidence: 'SELF_DECLARED', note: 'Open-source contributor' },
      { competency: 'GIS and Remote Sensing', level: 3, evidence: 'CERTIFICATE', verified: true, note: 'IIRS remote sensing course', document: { title: 'Remote Sensing and GIS Applications', issuer: 'IIRS Dehradun', year: 2022 } },
      { competency: 'Satellite Meteorology', level: 2, evidence: 'CERTIFICATE', verified: false, note: 'Certificate uploaded, awaiting admin verification', document: { title: 'Satellite Meteorology Basics', issuer: 'EUMETSAT online', year: 2024 } },
      { competency: 'Network Security', level: 2, evidence: 'SELF_DECLARED', note: 'Home-lab experience' },
      { competency: 'Scientific Writing', level: 2, evidence: 'SELF_DECLARED', note: 'Two conference papers' },
    ],
  },
];

// 40 trainees: 34 approved, 6 pending (so the admin has approvals to demo).
export const traineeNames = [
  'Aditya Sharma', 'Ananya Iyer', 'Rohan Patil', 'Sneha Reddy', 'Vikram Singh', 'Pooja Menon',
  'Karthik Raman', 'Divya Nair', 'Amit Verma', 'Lakshmi Pillai', 'Suresh Babu', 'Fatima Sheikh',
  'Harish Gowda', 'Nisha Kapoor', 'Manoj Tiwari', 'Revathi Krishnan', 'Imran Khan', 'Shalini Das',
  'Gaurav Joshi', 'Meenakshi Sundaram', 'Prakash Rao', 'Swati Kulkarni', 'Deepak Mishra', 'Aarti Deshpande',
  'Sameer Kulkarni', 'Priyanka Bose', 'Naveen Kumar', 'Farah Ali', 'Tushar Pawar', 'Keerthi Varma',
  'Rajesh Nambiar', 'Sunita Yadav', 'Arvind Hegde', 'Bhavana Shetty', 'Mohit Agarwal', 'Jyoti Rawat',
  'Siddharth Jain', 'Uma Maheshwari', 'Vivek Chauhan', 'Zoya Qureshi',
];

export const PENDING_TRAINEE_COUNT = 6;

export const traineeDesignations = ['Scientific Assistant', 'Scientist-B', 'Meteorologist Grade-II', 'Technical Officer', 'Project Scientist-I'];

export const interestPool = [
  'monsoon forecasting', 'radar products', 'ocean observations', 'climate change', 'Python', 'GIS',
  'cyber security', 'field instruments', 'cyclones', 'tsunami warnings', 'polar science', 'data visualisation',
];

// Demo file (in apps/api/demo-files) behind each seeded certificate / qualification.
export const documentFiles: Record<string, string> = {
  'Advanced Weather Radar Meteorology': 'cert-meera-wmo-radar.pdf',
  'M.Tech Atmospheric Science': 'qual-arjun-mtech.pdf',
  'PhD Physical Oceanography': 'qual-priya-phd.pdf',
  'Scientific Computing with Python': 'cert-priya-nptel-python.pdf',
  'Certified Information Systems Security Professional (CISSP)': 'cert-rahul-cissp.pdf',
  'Cyber Incident Handling and Response': 'cert-rahul-certin.pdf',
  'Network Security Fundamentals': 'cert-sanjay-nielit.pdf',
  'M.Sc Marine Sciences': 'qual-kavita-msc.pdf',
  'M.Sc Climate Science': 'qual-anil-msc.pdf',
  'Remote Sensing and GIS Applications': 'cert-neha-iirs.pdf',
  'Satellite Meteorology Basics': 'cert-neha-eumetsat.png',
};

// Richer profiles for a few trainees, so the profile page, the admin verification queue
// and the trainer-application queue all have realistic data.
export interface TraineeExtra {
  certificates?: { title: string; issuer: string; year: number; file: string; status: 'PENDING' | 'VERIFIED' }[];
  qualifications?: { degree: string; fieldOfStudy: string; institution: string; year: number }[];
  experiences?: { organisation: string; title: string; from: string; to?: string; description?: string }[];
  application?: string; // motivation of a PENDING "become a trainer" application
}

export const traineeExtras: Record<string, TraineeExtra> = {
  'Aditya Sharma': {
    certificates: [{ title: 'Python for Earth Sciences', issuer: 'NPTEL (IIT Kharagpur)', year: 2025, file: 'cert-aditya-nptel.pdf', status: 'PENDING' }],
    qualifications: [{ degree: 'B.Sc.', fieldOfStudy: 'Physics', institution: 'Fergusson College, Pune', year: 2019 }],
    experiences: [{ organisation: 'IMD Pune', title: 'Scientific Assistant', from: '2020-08-01', description: 'Upper-air observations and data entry' }],
    application:
      'I have written the Python scripts our unit uses to quality-check radiosonde data and I regularly help new colleagues with them. I would like to run a short course on Python for observers.',
  },
  'Ananya Iyer': {
    certificates: [{ title: 'GIS Fundamentals', issuer: 'IIRS Dehradun', year: 2025, file: 'cert-ananya-iirs.png', status: 'PENDING' }],
    qualifications: [{ degree: 'M.Sc.', fieldOfStudy: 'Oceanography', institution: 'Andhra University', year: 2021 }],
    experiences: [{ organisation: 'INCOIS Hyderabad', title: 'Project Associate', from: '2021-09-01', description: 'Potential Fishing Zone advisories' }],
  },
  'Rohan Patil': {
    certificates: [{ title: 'Basic Meteorology for Observers', issuer: 'IMD Meteorological Training Institute', year: 2023, file: 'cert-rohan-imd-mti.pdf', status: 'VERIFIED' }],
    experiences: [
      { organisation: 'NCPOR Goa', title: 'Field Assistant', from: '2019-11-01', to: '2022-03-31', description: 'Antarctic expedition support, Maitri station' },
      { organisation: 'NCPOR Goa', title: 'Technical Officer', from: '2022-04-01' },
    ],
    application:
      'After two Antarctic expeditions I have practical experience with AWS maintenance in extreme cold. I would like to train the next expedition batch on field instrument care.',
  },
};

// ── Courses (Phase 2) ──────────────────────────────────────
// One published course per subject, taught by the trainer who ranks first for it,
// plus one draft. Course competencies = the subject's requirements (target = min level).
export interface SeedCourse {
  title: string;
  subject: string | null;
  trainerEmail: string;
  status: 'PUBLISHED' | 'DRAFT';
  description: string;
  start: string;
  end: string;
  capacity: number | null;
  modules: [string, string][];
  extraCompetencies?: [string, number][]; // for courses without a subject
  enrolFraction: number; // share of approved trainees enrolled (deterministic)
}

export const courses: SeedCourse[] = [
  {
    title: 'DWR Operations for Forecasters',
    subject: 'Doppler Weather Radar Operations',
    trainerEmail: 'meera.kulkarni@imd.example',
    status: 'PUBLISHED',
    description:
      'A practical course on operating Doppler Weather Radars and turning radar products into nowcasts for thunderstorms and heavy rain. For duty forecasters and radar technicians.',
    start: '2026-09-01',
    end: '2026-12-15',
    capacity: 40,
    modules: [
      ['How a Doppler radar works', 'Beam, pulses, reflectivity and the Doppler shift'],
      ['Scan strategies and products', 'Volume coverage patterns, PPI, CAPPI, Max-Z, VIL'],
      ['Reading reflectivity and velocity', 'Hail cores, mesocyclones, outflow boundaries'],
      ['From radar to nowcast', 'Extrapolation, growth and decay, impact-based warnings'],
    ],
    enrolFraction: 0.55,
  },
  {
    title: 'Cyber Hygiene for Observing Networks',
    subject: 'Cybersecurity Basics for Observing Networks',
    trainerEmail: 'rahul.deshmukh@incois.example',
    status: 'PUBLISHED',
    description: 'Protect AWS loggers, radar links and data-centre servers from the most common cyber threats, and know what to do when something goes wrong.',
    start: '2026-09-15',
    end: '2026-11-30',
    capacity: 60,
    modules: [
      ['Threats to observing networks', 'Phishing, default passwords, exposed services'],
      ['Securing Linux servers', 'Updates, SSH keys, firewalls'],
      ['Incident response basics', 'Detect, contain, report to CERT-In'],
    ],
    enrolFraction: 0.35,
  },
  {
    title: 'Ocean Data Analysis with Python',
    subject: 'Ocean Data Analysis with Python',
    trainerEmail: 'priya.nair@incois.example',
    status: 'PUBLISHED',
    description: 'Hands-on analysis of Argo float and buoy observations with Python, xarray and pandas, from raw profiles to publication-quality maps.',
    start: '2026-10-01',
    end: '2026-12-20',
    capacity: 30,
    modules: [
      ['Python and xarray refresher', 'NetCDF, dimensions, selecting data'],
      ['Working with Argo profiles', 'Quality flags, interpolation, mixed-layer depth'],
      ['Maps and reports', 'Cartopy maps and writing up results'],
    ],
    enrolFraction: 0.3,
  },
  {
    title: 'AWS Installation and Field Calibration',
    subject: 'AWS Installation and Calibration',
    trainerEmail: 'sanjay.iyer@imd.example',
    status: 'PUBLISHED',
    description: 'Site selection, installation, sensor calibration and routine maintenance of Automatic Weather Stations, with a field-team checklist.',
    start: '2026-08-01',
    end: '2026-10-31',
    capacity: 25,
    modules: [
      ['Site selection and installation', 'Exposure, mounting, power and communication'],
      ['Sensor calibration', 'Temperature, humidity, pressure and rain gauge checks'],
      ['Maintenance and data checks', 'Drift, gaps and field logs'],
    ],
    enrolFraction: 0.25,
  },
  {
    title: 'Cyclone Warnings: From Guidance to Public Message',
    subject: 'Tropical Cyclone Forecasting and Warning Communication',
    trainerEmail: 'arjun.menon@imd.example',
    status: 'PUBLISHED',
    description: 'Combine satellite analysis and NWP guidance into track and intensity forecasts, then write clear, actionable cyclone warnings.',
    start: '2026-10-15',
    end: '2027-01-15',
    capacity: null,
    modules: [
      ['Satellite analysis of cyclones', 'Dvorak technique and microwave imagery'],
      ['Using NWP guidance', 'Ensembles, consensus and forecast uncertainty'],
      ['Writing the warning', 'Impact-based language and communicating uncertainty'],
    ],
    enrolFraction: 0.3,
  },
  {
    title: 'Tsunami Warning Centre Operations',
    subject: 'Tsunami Early Warning Operations',
    trainerEmail: 'kavita.rao@incois.example',
    status: 'PUBLISHED',
    description: 'How the Indian Tsunami Early Warning Centre goes from a seismic alert to coastal advisories, and how to coordinate with disaster managers.',
    start: '2026-09-10',
    end: '2026-11-10',
    capacity: 20,
    modules: [
      ['From earthquake to scenario', 'Magnitude, location and the scenario database'],
      ['Bulletins and threat levels', 'Warning, alert and watch zones'],
      ['Working with NDMA and states', 'Communication chains and drills'],
    ],
    enrolFraction: 0.2,
  },
  {
    title: 'Polar Field Safety and Logistics',
    subject: null,
    trainerEmail: 'anil.thomas@ncpor.example',
    status: 'DRAFT',
    description: 'Preparing for Antarctic and Arctic field seasons: safety, cold-weather equipment and team routines. Draft, not yet published.',
    start: '2027-01-10',
    end: '2027-03-10',
    capacity: 15,
    modules: [['Before you travel', 'Medical checks, kit list and training']],
    extraCompetencies: [
      ['Polar Field Operations', 3],
      ['Team Leadership', 2],
    ],
    enrolFraction: 0,
  },
];

// ── Trainer library (Phase 2) ──────────────────────────────
export interface SeedLibraryItem {
  file: string; // in apps/api/demo-files
  title: string;
  type: 'VIDEO' | 'SLIDES' | 'DOCUMENT';
  description: string;
  uploader: string;
  course?: string;
  moduleOrder?: number;
  competencies: string[];
}

export const libraryItems: SeedLibraryItem[] = [
  { file: 'lib-dwr-intro.mp4', title: 'How a Doppler Weather Radar scans', type: 'VIDEO', description: 'Short animated introduction: beam rotation, reflectivity and radial velocity.', uploader: 'meera.kulkarni@imd.example', course: 'DWR Operations for Forecasters', moduleOrder: 1, competencies: ['Radar Meteorology'] },
  { file: 'lib-dwr-scan-strategy.pdf', title: 'DWR scan strategies and products', type: 'SLIDES', description: 'Volume coverage patterns, key products and quality checks.', uploader: 'meera.kulkarni@imd.example', course: 'DWR Operations for Forecasters', moduleOrder: 2, competencies: ['Radar Meteorology', 'Data Quality Control'] },
  { file: 'lib-nowcasting-notes.pdf', title: 'Nowcasting thunderstorms: field notes', type: 'DOCUMENT', description: 'The 0-3 hour window and a checklist before issuing a nowcast.', uploader: 'arjun.menon@imd.example', course: 'DWR Operations for Forecasters', moduleOrder: 4, competencies: ['Nowcasting', 'Public Risk Communication'] },
  { file: 'lib-argo-qc-checklist.pdf', title: 'Argo float data: QC checklist', type: 'DOCUMENT', description: 'Real-time and delayed-mode quality checks with flag meanings.', uploader: 'priya.nair@incois.example', course: 'Ocean Data Analysis with Python', moduleOrder: 2, competencies: ['Ocean Data Analysis', 'Data Quality Control'] },
  { file: 'lib-ocean-python-slides.pdf', title: 'Ocean data analysis with Python: first steps', type: 'SLIDES', description: 'xarray, pandas and cartopy for a first Argo analysis.', uploader: 'priya.nair@incois.example', course: 'Ocean Data Analysis with Python', moduleOrder: 1, competencies: ['Python for Scientific Computing', 'Ocean Data Analysis'] },
  { file: 'lib-cyber-hygiene-slides.pdf', title: 'Cyber hygiene for observing networks', type: 'SLIDES', description: 'Common threats to AWS and radar networks, and basic controls.', uploader: 'rahul.deshmukh@incois.example', course: 'Cyber Hygiene for Observing Networks', moduleOrder: 1, competencies: ['Network Security', 'Incident Response'] },
  { file: 'lib-aws-calibration.mp4', title: 'Calibrating an AWS temperature sensor', type: 'VIDEO', description: 'Comparing a sensor against a reference until drift is within tolerance.', uploader: 'sanjay.iyer@imd.example', course: 'AWS Installation and Field Calibration', moduleOrder: 2, competencies: ['AWS Calibration', 'Data Quality Control'] },
  { file: 'lib-tsunami-sop.pdf', title: 'Tsunami warning centre SOP (summary)', type: 'DOCUMENT', description: 'The first ten minutes after an earthquake, and how bulletins are updated.', uploader: 'kavita.rao@incois.example', course: 'Tsunami Warning Centre Operations', moduleOrder: 2, competencies: ['Tsunami Early Warning', 'Stakeholder Coordination'] },
];

// Organisation-wide target level per competency (skill-gap view). Default: 2 (Working).
// Operationally critical competencies are expected at 3 (Proficient).
export const competencyTargets: Record<string, number> = {
  'Radar Meteorology': 3,
  'AWS Calibration': 3,
  'Tsunami Early Warning': 3,
  'Ocean Data Analysis': 3,
};
export const DEFAULT_TARGET_LEVEL = 2;
