import { useState } from 'react'
import type { Project } from '../types'
import { EntryBody } from './EntryBody'

/**
 * One column of the deck: the text card, and beneath it a screenshot in its own
 * frame. The pair stacked is what gives the section real vertical presence —
 * a row of short text cards alone left most of the viewport empty.
 *
 * The two do NOT share a height. The frame holds a fixed 16:10 ratio, roughly
 * the shape of a window screenshot, so an image is centre-cropped at worst and
 * never stretched.
 *
 * Neither element stretches to fill the column. An earlier version gave the text
 * card `flex-1` so frames would bottom-align across columns, but in a column
 * with no image that made the card absorb the entire column height — leaving a
 * tall, mostly empty box next to the columns that did have one. Sizing both to
 * their content means an imageless column is simply shorter, which reads as
 * missing content rather than as broken layout.
 *
 * With no `image`, the card renders alone — no empty frame, no placeholder.
 */
export function ProjectCard({ project }: { project: Project }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(project.image) && !imageFailed

  return (
    <li
      data-reveal
      data-cursor-target
      className="flex w-[min(88vw,26rem)] shrink-0 snap-center flex-col gap-4"
    >
      <div className="flex flex-col rounded-xl border border-hairline bg-panel/40 p-5 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-dwarf/50 hover:shadow-[0_0_24px_-6px_rgba(169,200,255,0.45)] focus-within:-translate-y-1 focus-within:border-dwarf/50 focus-within:shadow-[0_0_24px_-6px_rgba(169,200,255,0.45)]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm text-dwarf">{project.org}</h3>
          <span className="text-[11px] text-muted">{project.dates}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{project.title}</p>

        <EntryBody entry={project} />
      </div>

      {showImage ? (
        <figure className="m-0 overflow-hidden rounded-xl border border-hairline bg-panel/40">
          <img
            src={project.image}
            alt={`${project.org} screenshot`}
            loading="lazy"
            decoding="async"
            className="aspect-[16/10] w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        </figure>
      ) : null}
    </li>
  )
}
