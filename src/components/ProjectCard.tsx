import type { Project } from '../types'
import { EntryBody } from './EntryBody'

export function ProjectCard({ project }: { project: Project }) {
  return (
    <li
      data-reveal
      data-cursor-target
      className="flex min-h-[17rem] w-[min(85vw,22rem)] shrink-0 snap-center flex-col rounded-xl border border-hairline bg-panel/40 p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-dwarf/50 hover:shadow-[0_0_24px_-6px_rgba(169,200,255,0.45)] focus-within:-translate-y-1 focus-within:border-dwarf/50 focus-within:shadow-[0_0_24px_-6px_rgba(169,200,255,0.45)]"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm text-dwarf">{project.org}</h3>
        <span className="text-[11px] text-muted">
          {project.dates}
        </span>
      </div>
      <p className="mt-0.5 text-[13px] text-muted">{project.title}</p>

      <EntryBody entry={project} />
    </li>
  )
}
