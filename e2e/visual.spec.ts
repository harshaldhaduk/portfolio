import { expect, test } from '@playwright/test'

test('full page renders and matches its baseline', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await expect(page).toHaveScreenshot('full-page.png', {
    fullPage: true,
    // Was 0.02, which on a 1280x4570 page tolerated ~117,000 changed pixels —
    // loose enough that the entire starfield was swapped for a different
    // implementation and this test still passed. Both canvases draw one
    // deterministic frame under the forced reduced motion above, so the only
    // real source of variance is font antialiasing; 0.001 leaves room for that
    // and nothing else.
    maxDiffPixelRatio: 0.001,
  })
})
