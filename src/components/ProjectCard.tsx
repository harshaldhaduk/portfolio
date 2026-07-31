import { useState } from 'react'
import type { Project } from '../types'
import { EntryBody } from './EntryBody'

/**
 * One column of the deck, laid out the way lenis.dev's showcase row is: a media
 * frame on top with the text hanging beneath it.
 *
 * That order is the whole point. Every frame is identical in size, so the frames
 * line up across the row and the row reads as uniform — and because the text
 * hangs *below* the thing that aligns, a caption can run one line or four
 * without knocking anything out of register. The previous arrangement had the
 * text card on top, which meant any difference in text length pushed the images
 * to different heights and the row lost its grid.
 *
 * The frame renders even when there is no image yet, as an empty bordered box.
 * That is deliberate: the frame is the element everything aligns to, so omitting
 * it for one project would break the alignment for the whole row. It reads as an
 * empty slot rather than as content, which is what it is.
 *
 * There is no card border around the text. Sitting plainly under the frame keeps
 * the emphasis on the screenshot and avoids the tall, mostly-empty box that a
 * bordered card produced when its text was short.
 */
export function ProjectCard({ project }: { project: Project }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(project.image) && !imageFailed

  return (
    <li
      data-reveal
      data-cursor-target
      className="flex w-[min(82vw,32rem)] shrink-0 snap-start flex-col gap-5"
    >
      <figure className="m-0 aspect-[16/10] w-full overflow-hidden rounded-xl border border-hairline bg-panel/40 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-dwarf/40 hover:shadow-[0_0_40px_-10px_rgba(169,200,255,0.4)]">
        {showImage ? (
          <img
            src={project.image}
            alt={`${project.org} screenshot`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
      </figure>

      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-[15px] font-medium text-ink">{project.org}</h3>
          <span className="text-[11px] text-muted">{project.dates}</span>
        </div>
        <p className="mt-0.5 text-[13px] text-muted">{project.title}</p>

        <EntryBody entry={project} />
      </div>
    </li>
  )
}
