import type { Entry } from '../types'

export const research: Entry[] = [
  {
    id: 'white-dwarf-lab',
    org: 'White Dwarfs & Computational Stellar Evolution Lab',
    title: 'Undergraduate Researcher',
    dates: 'Jan 2026 — Present',
    location: 'UT Austin',
    summary: [
      'Built a Python data-processing pipeline for 10,000+ astronomical images, improving light-curve precision 30% with Fortran noise modelling.',
      'Applied PyTorch classifiers to 30 transit-like signals from white dwarfs, finding 2 exoplanet candidates and graphing their orbits with NumPy and Matplotlib.',
      'Optimised MESA stellar-evolution simulations by automating SLURM batch workflows, enabling white-dwarf interior analysis at 80% accuracy.',
    ],
    tags: [
      'Python',
      'PyTorch',
      'NumPy',
      'Matplotlib',
      'Fortran',
      'MESA',
      'SLURM',
    ],
    links: [],
  },
]
