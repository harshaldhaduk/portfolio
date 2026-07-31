import { useRef } from 'react'
import type { Entry } from '../types'
import { useConnectorDraw } from '../hooks/useConnectorDraw'
import { EntryBody } from './EntryBody'
import { EntryMark } from './EntryMark'

export function LogEntry({ entry }: { entry: Entry }) {
  const ref = useRef<HTMLLIElement>(null)
  const lineRef = useRef<SVGLineElement>(null)
  useConnectorDraw(ref, lineRef)

  return (
    <li ref={ref} data-reveal className="relative pb-10 pl-7 last:pb-0">
      <svg
        aria-hidden="true"
        className="absolute top-0 left-0 h-full w-px"
        viewBox="0 0 2 100"
        preserveAspectRatio="none"
      >
        <line
          ref={lineRef}
          x1="1"
          y1="0"
          x2="1"
          y2="100"
          stroke="var(--color-hairline)"
          strokeWidth="2"
        />
      </svg>
      <EntryMark entry={entry} />

      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[15px] font-medium text-ink">{entry.title}</h3>
        <span className="text-[11px] text-muted">{entry.dates}</span>
      </div>

      <p className="mt-0.5 text-xs text-dwarf/90">
        {entry.org}
        {entry.location ? (
          <span className="text-muted"> · {entry.location}</span>
        ) : null}
      </p>

      {/* Experience entries no longer show "More detail" — the owner asked
          for it to go away here specifically. The detail copy itself stays in
          data/experience.ts (real interview-prep material), just unrendered;
          Research and Projects still pass no such flag, so theirs is
          unaffected. */}
      <EntryBody entry={entry} hideDetail />
    </li>
  )
}
