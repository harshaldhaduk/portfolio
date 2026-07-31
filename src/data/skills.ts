import type { SkillGroup } from '../types'

export const skills: SkillGroup[] = [
  {
    kind: 'Languages',
    items: [
      'Python',
      'TypeScript',
      'JavaScript',
      'Java',
      'C++',
      'C',
      'Swift',
      'SQL',
      'Shell',
    ],
  },
  {
    kind: 'Data & ML',
    items: [
      'PyTorch',
      'TensorFlow',
      'scikit-learn',
      'Snowflake',
      'PostgreSQL',
      'Databricks',
      'Airflow',
    ],
  },
  {
    kind: 'Infrastructure',
    items: ['AWS', 'Terraform', 'Docker', 'Redis', 'Linux/Unix'],
  },
]
