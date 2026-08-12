import type { Entry } from '../types'

/**
 * One sentence per role, by the owner's instruction.
 *
 * Compressed by selecting from the fuller résumé bullets, never by inventing:
 * every figure below appears verbatim in the source. Where two bullets each
 * carried a metric worth keeping, both survive as clauses of a single sentence
 * rather than one being dropped. The `detail` expanders still hold the long
 * explanations, and the résumé PDF holds the full bullets.
 */
export const experience: Entry[] = [
  {
    id: 'pwc',
    org: 'PricewaterhouseCoopers',
    mark: 'PwC',
    logo: '/logos/pwc.svg',
    logoBg: '#feeae3',
    logoPad: '4px',
    title: 'Incoming Software Engineering Intern',
    dates: 'Fall 2026',
    location: 'Austin, TX',
    summary: [
      'Joining the Tax Innovation & Delivery Experience team, building automation frameworks that turn tax requirements into internal platforms.',
    ],
    tags: [],
    links: [],
  },
  {
    id: 'cox',
    org: 'Cox Automotive',
    mark: 'CA',
    logo: '/logos/cox.svg',
    logoBg: '#005286',
    logoPad: '4px',
    title: 'Data Engineering Intern · Data & AI Platforms',
    dates: 'Summer 2026',
    location: 'Austin, TX',
    summary: [
      'Built Snowflake ETL pipelines orchestrated in Airflow with lineage tracing for 9,000 users, plus ML workflows deriving dataset field meaning from source code to cut manual research 5×.',
    ],
    tags: ['Python', 'SQL', 'Snowflake', 'Airflow', 'Databricks'],
    links: [],
  },
  {
    id: 'dell',
    org: 'Dell Technologies',
    mark: 'Dell',
    logo: '/logos/dell.svg',
    logoBg: '#ffffff',
    title: 'Software Engineering Intern',
    dates: 'Summer 2025',
    location: 'Round Rock, TX',
    summary: [
      'Built a speech-translation robot converting live audio to hardware instructions with Whisper and G-Code, and a real-time C++/MQTT diagnostics dashboard that streamlined embedded debugging by 50%.',
    ],
    tags: ['C++', 'MQTT', 'Whisper', 'NLP', 'G-Code'],
    links: [],
    detail:
      'The robot had motors, sensors, and controllers publishing telemetry to scattered logs, which made debugging painful. Each subsystem published CPU, memory, error codes, and sensor values to MQTT topics; a C++ backend aggregated those streams into one view. Engineers could then spot an overheating sensor or a motor controller fault directly instead of grepping raw logs. On the speech side, Whisper handled transcription robustly enough for real environments with accents and background noise, further NLP models handled translation and summarisation, and the result was converted to G-Code so the arm could physically render the text.',
  },
  {
    id: 'kollegio',
    org: 'Kollegio',
    mark: 'K',
    logo: '/logos/kollegio.svg',
    logoBg: '#14261a',
    logoPad: '4px',
    title: 'Software Engineering Intern',
    dates: 'Summer 2024',
    location: 'Remote',
    summary: [
      'Trained PyTorch and fastai clustering models over 2,000+ student profiles in SQL, placed 1st at an internal design competition, and pitched Kollegio at the ASU+GSV Summit.',
    ],
    tags: ['Python', 'SQL', 'PyTorch', 'fastai', 'scikit-learn'],
    links: [],
    detail:
      'Cleaned GPA, test score, extracurricular, and essay data in SQL, then built unsupervised clustering models to group students with similar profiles — one cluster capturing high GPA with low extracurricular involvement, another lower GPA with strong leadership. That let recommendations be tailored per profile shape rather than ranked on a single axis. A related project digitised transcripts with Tesseract OCR, cleaned the extraction in pandas, and trained scikit-learn models to predict admission likelihood.',
  },
  {
    id: 'uci',
    org: 'University of California, Irvine',
    mark: 'UCI',
    logo: '/logos/uci.svg',
    logoBg: '#245799',
    title: 'Data Analyst Intern',
    dates: 'Fall 2023 · Spring 2024',
    location: 'Remote',
    summary: [
      'Built a MATLAB DSL over Simulink and TensorFlow adopted in 4+ studies, applying fMRI drift-diffusion models to identify neural markers of early cognitive decline.',
    ],
    tags: ['MATLAB', 'Simulink', 'TensorFlow'],
    links: [],
    detail:
      'The lab repeatedly ran MATLAB/Simulink simulations and passed results into TensorFlow for analysis. The DSL abstracted that pipeline so researchers wrote a single command instead of boilerplate, and results exported automatically. On the analysis side, the drift-diffusion model treats decision-making as evidence accumulating to a threshold; its parameters — drift rate, boundary separation — quantify cognitive decline, and correlating them against fMRI and EEG patterns produced better early diagnosis markers.',
  },
  {
    id: 'ibm',
    org: 'IBM',
    mark: 'IBM',
    logo: '/logos/ibm.svg',
    logoBg: '#ffffff',
    title: 'Software Engineering Fellow',
    dates: 'Summer 2023',
    location: 'Austin, TX',
    summary: [
      'Built IBM Quantum Learn, a Qiskit teaching portal that onboarded 500+ early-access users, with a WebSockets circuit visualiser streaming live qubit fidelity at 38% lower latency.',
    ],
    tags: ['Python', 'Qiskit', 'WebSockets'],
    links: [],
  },
]
