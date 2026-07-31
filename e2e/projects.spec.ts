import { expect, test, type Page } from '@playwright/test'

/**
 * The preloader overlay is a real, opaque, full-viewport element while it is
 * visible (by design — it is meant to cover the page during that brief
 * window), which means it also sits on top for pointer hit-testing. Waiting
 * for it to leave the DOM before dispatching wheel/mouse events mirrors what
 * a real visitor experiences (the page just isn't interactive yet) rather
 * than working around it.
 */
async function waitForPreloaderGone(page: Page) {
  await page
    .locator('[data-preloader-ring]')
    .waitFor({ state: 'detached', timeout: 5000 })
    .catch(() => {}) // already gone (e.g. reduced motion) — nothing to wait for
}

/**
 * The deck used to be its own natively-scrollable `overflow-x-auto` row, so
 * these tests read `el.scrollLeft` directly. It is now a GSAP ScrollTrigger
 * pin: vertical page scroll drives a `transform: translateX` on the card
 * track, and the viewport clipping it is `overflow: clip` (not `hidden`) —
 * deliberately not a scroll container at all, so there is no `scrollLeft` to
 * read any more. `translateX()` below reads the same signal a viewer
 * actually sees: the track's computed transform matrix.
 */
function translateX(track: ReturnType<Page['locator']>) {
  return track.evaluate((el) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform)
    return matrix.m41
  })
}

test('scrolling the page down advances the deck horizontally, and back up reverses it', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPreloaderGone(page)
  const region = page.getByRole('region', { name: /scrollable deck/i })
  await region.scrollIntoViewIfNeeded()
  const track = region.locator('> ul')

  // Not exactly 0: scrollIntoViewIfNeeded and ScrollTrigger's own
  // `anticipatePin` can land a fraction of a pixel past the pin's exact
  // start. The point of this test is the direction and reversibility of the
  // travel, not pinning down that sub-pixel offset.
  const before = await translateX(track)
  expect(Math.abs(before)).toBeLessThan(5)

  await page.mouse.wheel(0, 900)
  await expect.poll(() => translateX(track)).toBeLessThan(before)
  const midway = await translateX(track)

  // Scrolling back up must reverse the same translation — this is the pin
  // tracking scroll position exactly (scrub), not a one-shot animation.
  await page.mouse.wheel(0, -900)
  await expect.poll(() => translateX(track)).toBeGreaterThan(midway)
})

test('a project card off-screen in the row can be reached by keyboard, and the pin scrolls to bring it into view', async ({
  page,
}) => {
  await page.goto('/')
  await waitForPreloaderGone(page)
  const region = page.getByRole('region', { name: /scrollable deck/i })
  await region.scrollIntoViewIfNeeded()

  const beforeScrollY = await page.evaluate(() => window.scrollY)

  // EchoTrade is the last card, translated off-screen to the right at rest.
  // `.focus()` calls the DOM API directly and does not reproduce the
  // browser's own keyboard navigation the way a real Tab keypress does, so
  // this drives actual keyboard navigation rather than jumping straight to
  // the element.
  await region.focus()

  let reachedEchoTrade = false
  for (let i = 0; i < 20 && !reachedEchoTrade; i += 1) {
    await page.keyboard.press('Tab')
    const href = await page.evaluate(
      () => (document.activeElement as HTMLAnchorElement | null)?.href ?? null,
    )
    reachedEchoTrade = Boolean(href?.includes('EchoTrade'))
  }
  expect(reachedEchoTrade).toBe(true)

  const echoTradeLink = page.locator('a[href*="EchoTrade"]')
  await expect(echoTradeLink).toBeFocused()

  // The card's own container has no scroll box to move any more (see
  // translateX() above) — reaching it by keyboard now depends on the
  // deck's focusin handler driving the pin to that card's position via the
  // same scroll-based mechanism the wheel and buttons use.
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(beforeScrollY)
  await expect(echoTradeLink).toBeInViewport()
})

test('the dot controls jump the deck, and are the keyboard path the arrows used to be', async ({
  page,
}) => {
  // The prev/next arrows and the NN/NN counter were removed. That deleted the
  // only focusable control, so the dots stopped being decorative
  // (aria-hidden, tabIndex=-1) and became real labelled buttons. If they are not
  // reachable and do not move the deck, the section has no keyboard control at
  // all beyond scrolling the page.
  await page.goto('/')
  await waitForPreloaderGone(page)

  await expect(page.getByRole('button', { name: /previous project/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /next project/i })).toHaveCount(0)

  const heading = page.getByRole('heading', { name: 'Projects' })
  await heading.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)

  const last = page.getByRole('button', { name: /show echotrade/i })
  await expect(last).toBeVisible()

  // Focusable — this is what replaces the arrows for keyboard users.
  await last.focus()
  await expect(last).toBeFocused()

  const before = await page.evaluate(() => window.scrollY)
  await last.click()
  await expect
    .poll(() => page.evaluate(() => window.scrollY), { timeout: 4000 })
    .not.toBe(before)
})
