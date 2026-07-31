export type Link = {
  label: string
  href: string
}

/**
 * One row of content — a job, a research post, or a project. The same shape
 * serves all three so a single renderer handles any of them.
 */
export type Entry = {
  id: string
  org: string
  title: string
  dates: string
  location?: string
  /** Award or programme context, e.g. a hackathon prize. */
  note?: string
  /**
   * Short text for the timeline tile when no logo file exists — not derived
   * from `org`, because initials guess badly ("PricewaterhouseCoopers" gives
   * "P", "Dell Technologies" gives "DT"). Set it explicitly.
   */
  mark?: string
  /**
   * Optional path to a logo under `public/logos/`, e.g. `/logos/ibm.svg`.
   * Rendered in place of `mark` when present. Nothing ships here by default:
   * the only assets obtainable for these six employers were 32-57px favicons,
   * three were missing entirely, and mismatched low-res marks look worse than
   * a consistent monogram set. Drop files in and they are picked up.
   */
  logo?: string
  /**
   * Background for the logo tile. Needed because these marks were drawn for
   * different surfaces: Dell's is a transparent blue ring meant for white,
   * while Cox's and UCI's carry their own brand-coloured field. Painting the
   * tile to match each mark's intended surface is what stops them looking
   * like screenshots dropped onto a dark page.
   */
  logoBg?: string
  /**
   * Optional inset between the artwork and the edge of the circular frame, so
   * marks that fill their own canvas edge to edge are not cramped. Per-entry
   * because the supplied files do not share an internal margin.
   */
  logoPad?: string
  /** Dense outcome lines. Each should ideally carry a number. */
  summary: string[]
  tags: string[]
  /** GitHub repositories only. An empty array is valid and renders nothing. */
  links: Link[]
  /** Progressive-disclosure depth, shown behind an expander. */
  detail?: string
}

export type Project = Entry

export type SkillGroup = {
  kind: string
  items: string[]
}

export type Profile = {
  name: string
  degree: string
  school: string
  grad: string
  location: string
  intro: string[]
  links: Link[]
  /** Null until a public-facing resume PDF exists in `public/`. */
  resumeUrl: string | null
  updated: string
}
