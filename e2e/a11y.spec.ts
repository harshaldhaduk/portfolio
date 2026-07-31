import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  // The hero entrance animation fades the split name and the rest of the
  // hero content in from opacity 0. Sampling mid-fade is a real DOM state
  // but not a meaningful one — axe correctly reports a low-contrast word at
  // 30% opacity, the same way it would for any opacity-based fade-in text
  // animation, but that is a one-time, sub-second transient on first load,
  // not the page's resting state. Waiting for the entrance to settle before
  // auditing checks the state a user actually reads, matching the same
  // reasoning already used below for the scroll-reveal transition.
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(
            document.querySelectorAll<HTMLElement>(
              '[data-hero-item], [data-hero-name] [data-word]',
            ),
          ).every((el) => window.getComputedStyle(el).opacity === '1'),
        ),
      { timeout: 3000 },
    )
    .toBe(true)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('is fully readable with reduced motion forced', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')
  // Every revealable element must resolve to visible, not stay at opacity 0.
  const hidden = await page
    .locator('[data-reveal]:not([data-revealed="true"])')
    .count()
  expect(hidden).toBe(0)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await context.close()
})

test('every [data-reveal] element is actually opaque, not just flagged revealed', async ({
  browser,
}) => {
  // The attribute test above proves useReveal ran. It cannot prove the CSS
  // rule that reads that attribute is still wired up — flattening the
  // selector or losing the stylesheet would leave data-revealed="true" set
  // on an element the browser still renders at opacity 0. Only a computed
  // style read in a real browser can catch that; jsdom never lays out CSS.
  const context = await browser.newContext({ reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto('/')

  const opacities = await page.locator('[data-reveal]').evaluateAll((els) =>
    els.map((el) => window.getComputedStyle(el).opacity),
  )
  expect(opacities.length).toBeGreaterThan(0)
  for (const opacity of opacities) {
    expect(opacity).toBe('1')
  }
  await context.close()
})

test('every [data-reveal] element becomes opaque in DEFAULT motion too', async ({
  page,
}) => {
  // The two tests above both force reduced motion, where index.css sets
  // opacity: 1 on [data-reveal] unconditionally. That means neither of them
  // exercises the rule that un-hides content for everyone who has NOT asked
  // for reduced motion — the majority — so deleting
  // `[data-reveal][data-revealed='true'] { opacity: 1 }` would leave the whole
  // suite green while shipping a permanently blank page. This is the one guard
  // the project most needs and the only one that has to run in default motion.
  await page.goto('/')

  const reveals = page.locator('[data-reveal]')
  const count = await reveals.count()
  expect(count).toBeGreaterThan(0)

  // Scroll the furthest element into view so every IntersectionObserver fires,
  // then wait for the 600ms opacity transition to finish rather than sampling
  // mid-flight.
  await reveals.last().scrollIntoViewIfNeeded()
  await expect
    .poll(
      async () =>
        reveals.evaluateAll((els) =>
          els.every((el) => window.getComputedStyle(el).opacity === '1'),
        ),
      {
        message:
          'a [data-reveal] element never reached opacity 1 in default motion',
        timeout: 5000,
      },
    )
    .toBe(true)
})

test('landmarks: main, banner and contentinfo are all present', async ({
  page,
}) => {
  // A landmark regression was already introduced once on this project (see
  // the comment in App.tsx) and caught only in review. This asserts the
  // three top-level landmarks directly so a repeat fails CI instead.
  await page.goto('/')
  await expect(page.getByRole('main')).toHaveCount(1)
  await expect(page.getByRole('banner')).toHaveCount(1)
  await expect(page.getByRole('contentinfo')).toHaveCount(1)
})

test('Systems renders a real definition list', async ({
  page,
}) => {
  // jsdom-based tests assert the rendered text only; they would not notice
  // <dl>/<dt>/<dd> flattening to plain <div>s. That is a markup fact only a
  // real accessibility tree exposes.
  await page.goto('/')
  const systemsHeading = page.getByRole('heading', { name: 'Systems' })
  const systemsSection = page.locator('section', { has: systemsHeading })

  const dl = systemsSection.locator('dl')
  await expect(dl).toHaveCount(1)
  await expect(dl.locator('dt').first()).toBeVisible()
  await expect(dl.locator('dd').first()).toBeVisible()

})
