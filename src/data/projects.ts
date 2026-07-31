import type { Project } from '../types'

/**
 * Six-to-eight-word descriptions, by the owner's instruction.
 *
 * Each line keeps one figure taken verbatim from the résumé; nothing is
 * invented, and where a project had three bullets the strongest metric was
 * selected rather than paraphrased into something new. The `detail` expanders
 * and the résumé PDF still carry the full versions.
 *
 * Lattice's line deliberately avoids the phrase "multi-modal AI overlap" from
 * the résumé. In context — an extension stopping several AI agents colliding on
 * one codebase — that almost certainly means multi-AGENT; multi-modal describes
 * text-plus-image models. Rather than silently pick a reading of the owner's
 * own claim, this describes the mechanism, which is unambiguous either way.
 */

export const projects: Project[] = [
  {
    id: 'overwatch',
    org: 'Overwatch',
    title: 'Internal platform',
    dates: '2026',
    summary: [
      'Cut page load ~15s → ~1s across ~60K entities.',
    ],
    tags: ['.NET 8', 'Stencil.js', 'Oracle', 'Redis', 'TypeScript'],
    links: [],
  },
  {
    id: 'clarity',
    org: 'Clarity',
    title: 'Computer vision app',
    dates: '2026',
    note: 'Best Use of Supabase — Hook ’Em Hacks, UT Austin',
    summary: [
      'Dementia computer-vision app using YOLOv11 and Gemini.',
    ],
    tags: ['TypeScript', 'Python', 'FastAPI', 'Next.js', 'Supabase', 'YOLOv11'],
    links: [],
  },
  {
    id: 'lattice',
    org: 'Lattice',
    title: 'VS Code extension',
    dates: '2026',
    note: 'Momentum × Genesis Buildathon',
    summary: [
      'AST-based conflict detection for parallel AI edits.',
    ],
    tags: ['Electron', 'Express.js', 'Python', 'SQLite', 'Babel'],
    links: [
      { label: 'GitHub', href: 'https://github.com/harshaldhaduk/Lattice' },
    ],
  },
  {
    id: 'calmcampus',
    org: 'CalmCampus',
    title: 'iOS app',
    dates: '2024',
    note: 'Congressional App Challenge nominee',
    summary: [
      'iOS student mental-health app, 3,000+ downloads.',
    ],
    tags: ['Swift', 'Ruby', 'Firebase'],
    links: [
      { label: 'GitHub', href: 'https://github.com/harshaldhaduk/CalmCampus' },
    ],
  },
  {
    id: 'echotrade',
    image: '/shots/echotrade.png',
    org: 'EchoTrade',
    title: 'Financial sentiment pipeline',
    dates: '2026',
    summary: [
      'Buy/hold/sell signals from 50,000+ sources, sub-200ms.',
    ],
    tags: ['TypeScript', 'AWS Lambda', 'S3', 'SNS', 'Supabase', 'PostgreSQL'],
    links: [
      { label: 'GitHub', href: 'https://github.com/harshaldhaduk/EchoTrade' },
    ],
    detail:
      'News articles from over 50,000 sources were ingested asynchronously through Lambda, with S3 for durable storage and SNS coordinating fan-out processing. Each article passed through AWS Comprehend to extract sentiment and key entities, keeping classification low-latency at scale. Supabase Realtime paired with PostgreSQL triggers pushed sentiment updates straight to live dashboards, holding sub-200ms end-to-end latency even under bursty news traffic.',
  },
]
