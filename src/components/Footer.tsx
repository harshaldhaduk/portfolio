import { profile } from '../data/profile'
import { useSectionReveal } from '../hooks/useSectionReveal'

export function Footer() {
  const ref = useSectionReveal<HTMLElement>()

  return (
    <footer ref={ref} className="border-t border-hairline pt-8 pb-16">
      <ul data-reveal className="flex flex-wrap gap-x-6 gap-y-2">
        {profile.links.map((link) => (
          <li key={link.href}>
            <a
              href={link.href}
              className="link-sweep text-xs text-muted"
            >
              {link.label}
            </a>
          </li>
        ))}
        {profile.resumeUrl ? (
          <li>
            <a
              href={profile.resumeUrl}
              className="link-sweep text-xs text-muted"
            >
              Resume
            </a>
          </li>
        ) : null}
      </ul>
      <p data-reveal className="mt-4 text-[11px] text-muted">
        updated {profile.updated}
      </p>
    </footer>
  )
}
