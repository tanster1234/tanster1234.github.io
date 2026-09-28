// Single source of truth for site copy. Rules: never name clients (fields only),
// never publish email or phone, never name the trading firm.

export const person = {
  name: 'Tanmay Bhanushali',
  mark: 'Tanmay B',
  title: 'Data Scientist & AI Engineer',
  headline: 'I turn noisy data into systems people actually use.',
  support:
    'I build forecasting engines and AI agents for apparel and CPG brands, and I 3D-print things after hours.',
  links: {
    linkedin: 'https://www.linkedin.com/in/tanmaybhanushali/',
    github: 'https://github.com/tanster1234',
  },
};

export const filmBeats = [
  { at: 0.2, text: 'Forecasting demand across millions of series.' },
  { at: 0.4, text: 'Agents, pipelines and the systems around them.' },
  { at: 0.6, text: 'Then it becomes something you can hold.' },
];

export const stats = [
  { value: '15', unit: '%', label: 'more accurate demand forecasts than the legacy method, across millions of series' },
  { value: '20', unit: '%', label: 'ROI lift from a promotion-effectiveness model built on 30M transactions' },
  { value: '40–50', unit: '%', label: 'faster answers from company data through a secure local LLM agent' },
  { value: '40', unit: '%', label: 'lower dashboard latency on a real-time IoT pipeline' },
];

export type Role = {
  when: string;
  role: string;
  org: string;
  place?: string;
  summary: string;
  points?: string[];
  stack?: string[];
  current?: boolean;
  datesPending?: boolean;
};

export const roles: Role[] = [
  {
    when: '2023 – now',
    role: 'Data Scientist',
    org: 'OpsVeda',
    place: 'Greensboro, NC',
    current: true,
    summary: 'Forecasting and promotion analytics for apparel and CPG brands, plus private LLM agents over company data.',
    points: [
      'Built a multi-model demand forecasting engine (HWES, ARIMA, XGBoost, LSTM) over millions of time series, with lagged demand, holidays, weather, stockouts and price signals. Accuracy improved 15% over the legacy method.',
      'Designed a promotion-effectiveness framework that measures price and cross-elasticity across 30M transactions, with forecast baselines for uplift. Promotional ROI improved 20%.',
      'Shipped a secure local LLM agent (Ollama, Qdrant, LangChain, MCP) that answers questions over databases and documents in plain language, cutting query time by 40–50%.',
    ],
    stack: ['Python', 'statsmodels', 'XGBoost', 'PyTorch', 'LangChain', 'MCP', 'Ollama', 'Qdrant'],
  },
  {
    when: 'Dates to confirm',
    role: 'Go Developer',
    org: 'High-frequency trading firm',
    datesPending: true,
    summary: 'Low-latency systems in Go for a trading environment.',
    stack: ['Go'],
  },
  {
    when: 'Dates to confirm',
    role: 'Systems automation',
    org: 'Wells Fargo',
    datesPending: true,
    summary: 'Automated banking systems and the processes around them.',
  },
  {
    when: '2022',
    role: 'Data Engineer Intern',
    org: 'Energy Ogre',
    place: 'Houston, TX',
    summary: 'Real-time IoT pipeline for high-frequency sensor data.',
    points: [
      'Built ingestion, transformation and storage on AWS with Kafka (MSK), Lambda and S3.',
      'Wrote .NET Kafka microservices with TimescaleDB consumers, cutting dashboard latency by 40%.',
    ],
    stack: ['Kafka', 'AWS', '.NET', 'TimescaleDB'],
  },
  {
    when: '2020 – 21',
    role: 'Full-Stack Developer',
    org: 'The University of Hong Kong',
    place: 'Hong Kong',
    summary: 'Led a peer-review and assessment platform for the dental faculty, from scoping to deployment.',
    points: [
      'Vue/Nuxt front end, Node.js REST API and PostgreSQL for submissions, feedback and enrollment.',
      'Wrote the technical spec and a year-long roadmap that kept stakeholders aligned through launch.',
    ],
    stack: ['Vue', 'Nuxt', 'Node.js', 'PostgreSQL'],
  },
  {
    when: '2019 – 20',
    role: 'NLP Researcher',
    org: 'HKUST',
    place: 'Hong Kong',
    summary: 'Final-year research on extracting relationships between named entities.',
    points: [
      'Custom pipeline with NER, sentiment and co-reference resolution; a BERT model with a tailored encoder.',
      'Served on AWS SageMaker behind a REST API, with a React app that maps relationships in any article in real time.',
    ],
    stack: ['BERT', 'NLTK', 'SageMaker', 'React'],
  },
  {
    when: '2017',
    role: 'R&D Engineer Intern',
    org: 'Smart-wearables startup',
    summary: 'Hot-word detection for voice AI on a smart ring.',
  },
];

export const education = [
  { degree: 'MS, Applied Artificial Intelligence', school: 'Stevens Institute of Technology', year: '2023' },
  { degree: 'BEng, Computer Engineering', school: 'Hong Kong University of Science and Technology', year: '2020' },
];

export type Project = {
  slug: string;
  name: string;
  kicker: string;
  summary: string;
  bullets: string[];
  stack: string[];
  repo?: string;
  lead?: boolean;
};

export const projects: Project[] = [
  {
    slug: 'tv-remote-mcp',
    name: 'TV Remote MCP',
    kicker: 'LG webOS · MCP server',
    lead: true,
    summary:
      'An MCP server that runs a 65" LG TV by conversation. It does everything a remote does, recommends what to watch, and handles the fiddly parts for you.',
    bullets: [
      'Full remote control through the LG webOS API, extended with my own functions.',
      'Chains button presses into sequences for complex actions, like navigating deep into an app.',
      'Types into apps with their native on-screen keyboard.',
      'Takes voice commands, and recommends shows and films through conversation.',
    ],
    stack: ['MCP', 'LG webOS API', 'Voice', 'Recommender'],
  },
  {
    slug: 'sql-mcp',
    name: 'SQL over MCP',
    kicker: 'Early MCP · Postgres',
    summary:
      'Talk to a database and get the chart. Built while MCP was brand new: Postgres servers, a tool-using chat client and interactive visualisations.',
    bullets: [
      'MCP servers for PostgreSQL and SQLite, and a client with tool calling.',
      'Context engineering through database comments and on-demand fetching.',
      'Answers arrive with interactive charts.',
    ],
    stack: ['Python', 'MCP', 'PostgreSQL', 'SQLite'],
    repo: 'https://github.com/tanster1234/sql_mcp_client',
  },
  {
    slug: 'exercise-classifier',
    name: 'Gamified Exercise Classifier',
    kicker: 'Wearables · ML',
    summary:
      'Participants wear wristband trackers that stream positional data, and trained classifiers recognise movements such as star jumps and throws for a gamified workout.',
    bullets: [
      'Positional data from several wristbands per participant.',
      'Classifier models that categorise each exercise movement.',
    ],
    stack: ['Python', 'Jupyter', 'Classification'],
    repo: 'https://github.com/tanster1234/OverhandFitness-Project',
  },
  {
    slug: 'music-therapy',
    name: 'Music-Therapy Recommender',
    kicker: 'Spotify API · Recommender',
    summary:
      'Music recommendation as a form of therapy. It builds a listener profile from song attributes such as valence and pitch, and recommends from there.',
    bullets: [
      'Song attributes such as valence and pitch from the Spotify API.',
      'A listener profile that drives the recommendations.',
    ],
    stack: ['Spotify API', 'Recommender'],
  },
];

export const stack = [
  { use: 'Forecast & model', items: ['Python', 'statsmodels', 'scikit-learn', 'XGBoost', 'PyTorch', 'TensorFlow'] },
  { use: 'Agents & LLMs', items: ['LangGraph', 'MCP servers & clients', 'Ollama', 'Qdrant', 'RAG', 'Hugging Face'] },
  { use: 'Stream & store', items: ['Kafka', 'TimescaleDB', 'PostgreSQL', 'AWS Lambda, S3, SageMaker'] },
  { use: 'Ship', items: ['Go', 'Node.js', 'React', 'Vue / Nuxt', 'Docker', 'Astro'] },
];

export const lab = {
  printer: 'Bambu Lab P1S',
  nozzle: '0.4 mm hardened steel',
  // filament colours sampled from photos of the real prints (the photos themselves are never shipped)
  pieces: [
    { name: 'Pleated lamp', kind: 'Lamp', swatches: ['#f5a623', '#9a9a96'] },
    { name: 'Ribbed lamp', kind: 'Lamp', swatches: ['#e9e7e1', '#3b4fe0'] },
    { name: 'Wave lamp', kind: 'Lamp', swatches: ['#f2c12e', '#8fa38a'] },
    { name: 'Stencil clock', kind: 'Clock', swatches: ['#f1e6cf', '#f28c1b'] },
    { name: 'Good Vibes lightbox', kind: 'Lightbox', swatches: ['#f4f1e8', '#7be07b'] },
    { name: 'Knicks Finals poster', kind: 'HueForge', swatches: ['#1d428a', '#f58426', '#e9e7e1'] },
    { name: 'Maze monogram coasters', kind: 'Coasters', swatches: ['#1b1c1f', '#f28c1b', '#9b7bd6'] },
    { name: 'Puffer-jacket pen cups', kind: 'Desk', swatches: ['#2a4fd6', '#8b5a3c'] },
    { name: 'Controller stand', kind: 'Desk', swatches: ['#b9bbbe'] },
    { name: 'Fantasy league trophy', kind: 'Trophy', swatches: ['#d4a93a', '#1b1c1f', '#f2d22e'] },
  ],
};
