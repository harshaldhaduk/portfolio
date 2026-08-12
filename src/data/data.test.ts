import { describe, expect, it } from 'vitest'
import { profile } from './profile'
import { experience } from './experience'
import { research } from './research'
import { projects } from './projects'
import { skills } from './skills'
import type { Entry } from '../types'

const allEntries: Entry[] = [...experience, ...research, ...projects]

/**
 * Matches a US phone number in the formats people actually write, including a
 * parenthesised area code. The narrower `\d{3}[-.\s]?\d{3}[-.\s]?\d{4}` this
 * replaced let `(555) 010-0000` through — a parenthesised area code is the
 * single most common display format, so the narrow version would have missed
 * exactly the shape most likely to be pasted in by accident.
 */
const PHONE_PATTERN = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/

describe('content data', () => {
  it('has the agreed number of entries in each section', () => {
    expect(experience).toHaveLength(6)
    expect(research).toHaveLength(1)
    // 7, not the original 6: Linewatch was added on request. This number is
    // pinned deliberately so the curated set cannot creep back toward the full
    // résumé unnoticed — bump it only for a decision actually taken.
    expect(projects).toHaveLength(7)
    expect(skills.length).toBeGreaterThanOrEqual(3)
  })

  it('gives every entry a unique id', () => {
    const ids = allEntries.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every entry non-empty org, title, dates and summary', () => {
    for (const e of allEntries) {
      expect(e.org.trim(), `org for ${e.id}`).not.toBe('')
      expect(e.title.trim(), `title for ${e.id}`).not.toBe('')
      expect(e.dates.trim(), `dates for ${e.id}`).not.toBe('')
      expect(e.summary.length, `summary for ${e.id}`).toBeGreaterThan(0)
      for (const line of e.summary) {
        expect(line.trim(), `summary line for ${e.id}`).not.toBe('')
      }
    }
  })

  it('never emits a malformed link', () => {
    const links = [...allEntries.flatMap((e) => e.links), ...profile.links]
    for (const link of links) {
      expect(link.label.trim(), 'link label').not.toBe('')
      expect(link.href.trim(), 'link href').not.toBe('')
      expect(link.href).toMatch(/^(https:\/\/|mailto:|\/)/)
    }
  })

  it('permits only known-good link destinations', () => {
    // An allowlist, not a denylist. A denylist has to spell out the hosts it is
    // excluding, which for employer-internal infrastructure means publishing the
    // very identifiers the rule exists to keep off the page. This inverts it: a
    // link is valid only if it matches one of the destinations below, so any
    // host that was never meant to be here fails without needing to be named —
    // and it catches destinations nobody thought to forbid.
    const ALLOWED = [
      /^https:\/\/github\.com\/harshaldhaduk(\/|$)/,
      // Clarity was a team project, so its repo sits on a collaborator's
      // account rather than the owner's. Pinned to that one repository instead
      // of the whole account, so admitting it widens the allowlist by exactly
      // one destination and no more.
      /^https:\/\/github\.com\/bruhlol108\/Clarity$/,
      /^https:\/\/devpost\.com\/software\/[a-z0-9-]+$/,
      /^https:\/\/www\.linkedin\.com\/in\/harshaldhaduk(\/|$)/,
      /^mailto:[^@\s]+@[^@\s]+$/,
      /^\/[^/]/, // site-relative, e.g. the resume PDF
    ]
    const hrefs = [...allEntries.flatMap((e) => e.links), ...profile.links].map(
      (l) => l.href,
    )
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(
        ALLOWED.some((pattern) => pattern.test(href)),
        `unexpected link destination: ${href}`,
      ).toBe(true)
    }
  })

  it('exposes no link for entries that have no public repository', () => {
    // Two entries deliberately carry an empty links array: one is employer work
    // on a private host, the other is a team project with no public repo. If a
    // link ever appears on either, it is almost certainly a mistake, and for the
    // first it would point somewhere no reader outside the company can reach.
    for (const id of ['cox', 'overwatch']) {
      const entry = allEntries.find((e) => e.id === id)
      expect(entry, `expected an entry with id ${id}`).toBeDefined()
      expect(entry!.links, `links for ${id}`).toHaveLength(0)
    }
  })

  // Verifies the guard below can actually catch what it is guarding against.
  // The samples are 555-01xx numbers, reserved for fiction — never a real
  // number, so widening this guard cannot itself leak one into the repo.
  it('uses a phone pattern that catches the formats people actually write', () => {
    for (const sample of [
      '555-010-0000',
      '(555) 010-0000',
      '(555)010-0000',
      '555.010.0000',
      '555 010 0000',
      '5550100000',
    ]) {
      expect(PHONE_PATTERN.test(sample), sample).toBe(true)
    }
  })

  it('publishes no phone number', () => {
    const haystack = JSON.stringify({
      profile,
      experience,
      research,
      projects,
      skills,
    })
    expect(haystack).not.toMatch(PHONE_PATTERN)
  })

  it('describes the degree and research that justify the theme', () => {
    expect(profile.degree).toContain('Astrophysics')
    expect(research[0].summary.join(' ')).toMatch(/exoplanet/i)
  })
})
