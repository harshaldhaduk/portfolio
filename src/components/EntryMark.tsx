import { useState } from 'react'
import type { Entry } from '../types'

/**
 * The Mission Log timeline node: a rounded-square tile holding the employer's
 * logo, or its short `mark` when no logo file exists.
 *
 * Sized at 40px rather than the 28px this started as. At 28px the supplied
 * marks rendered as brand-coloured squares whose wordmarks were not readable —
 * technically correct and practically pointless. 40px is where "pwc", the IBM
 * bars and the Dell ring actually resolve, while still reading as a node on the
 * timeline rather than a card.
 *
 * `logoBg` paints the tile to match the surface each mark was drawn for, because
 * these came from different sources and do not share one. Dell's is a
 * transparent blue ring that needs white behind it; Cox's and UCI's carry their
 * own brand-coloured field, so matching the tile to that field makes the two
 * blend into one solid tile instead of a square inside a square. Entries with no
 * logo keep the page's own panel colour.
 *
 * If `logo` is set but the image fails to load, this falls back to `mark` rather
 * than showing a broken-image icon — and drops the custom background with it,
 * since a pale-blue monogram on white would be unreadable.
 *
 * The whole tile is `aria-hidden`: `LogEntry` already renders `entry.org` as
 * visible text immediately below it, so neither the image nor the mark carries
 * information a screen reader needs announced twice for the same entry.
 */
export function EntryMark({ entry }: { entry: Entry }) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = Boolean(entry.logo) && !imageFailed
  const tinted = showImage && Boolean(entry.logoBg)

  return (
    <span
      aria-hidden="true"
      style={tinted ? { backgroundColor: entry.logoBg } : undefined}
      className={`absolute top-0 -left-[19px] flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-hairline ${
        tinted ? '' : 'bg-panel'
      }`}
    >
      {showImage ? (
        // object-cover so the artwork fills the circle rather than floating
        // inside it — Dell's ring looked lost when every mark was padded
        // uniformly. Cropping is safe because each file carries internal
        // margin, so the crop takes empty space, and the frame is painted the
        // artwork's own field colour so the boundary is invisible regardless.
        <img
          src={entry.logo}
          alt=""
          // `logoPad` insets the artwork so more of the frame's colour shows
          // around it. Needed per-entry rather than globally because the marks
          // do not share an internal margin: Cox's and Kollegio's fill their
          // own canvas almost edge to edge and looked cramped in the circle,
          // while Dell's and IBM's already carry enough white space that
          // insetting them further would shrink them to nothing.
          style={entry.logoPad ? { padding: entry.logoPad } : undefined}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-[13px] font-semibold tracking-tight text-dwarf">
          {entry.mark}
        </span>
      )}
    </span>
  )
}
