import { profile } from '../data/profile'
import { useSectionReveal } from '../hooks/useSectionReveal'

export function Footer() {
  const ref = useSectionReveal<HTMLElement>()

  return (
    <footer ref={ref} className="border-t border-hairline pt-8 pb-16">
      {/* GitHub, LinkedIn and Email are gone from here by request. They were a
          verbatim repeat of the row already in the hero, which on a page this
          length meant the visitor met the same three links twice with nothing
          new added the second time. The resume link stays because it appears
          nowhere else. */}
      {profile.resumeUrl ? (
        <ul data-reveal className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a href={profile.resumeUrl} className="link-sweep text-xs text-muted">
              Resume
            </a>
          </li>
        </ul>
      ) : null}
      <p data-reveal className="mt-4 text-[11px] text-muted">
        updated {profile.updated}
      </p>
    </footer>
  )
}
