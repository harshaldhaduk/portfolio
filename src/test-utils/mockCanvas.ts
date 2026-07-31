import { vi } from 'vitest'

/**
 * Minimal fake 2D canvas context — just the surface Starfield (and Transit,
 * in Task 6) call. It is a test double, not a canvas emulator: methods are
 * no-op vi.fn()s so tests can assert draw calls happened, not that drawing
 * produced anything.
 */
export type MockCanvasContext = {
  setTransform: ReturnType<typeof vi.fn>
  save: ReturnType<typeof vi.fn>
  restore: ReturnType<typeof vi.fn>
  clip: ReturnType<typeof vi.fn>
  closePath: ReturnType<typeof vi.fn>
  ellipse: ReturnType<typeof vi.fn>
  fillRect: ReturnType<typeof vi.fn>
  quadraticCurveTo: ReturnType<typeof vi.fn>
  lineJoin: string
  lineCap: string
  clearRect: ReturnType<typeof vi.fn>
  beginPath: ReturnType<typeof vi.fn>
  arc: ReturnType<typeof vi.fn>
  fill: ReturnType<typeof vi.fn>
  globalAlpha: number
  fillStyle: string
  createRadialGradient: ReturnType<typeof vi.fn>
  moveTo: ReturnType<typeof vi.fn>
  lineTo: ReturnType<typeof vi.fn>
  stroke: ReturnType<typeof vi.fn>
  strokeStyle: string
  lineWidth: number
}

/**
 * Installs a fake 2D context on HTMLCanvasElement.prototype.getContext so
 * components under test see a non-null context instead of jsdom's default
 * `null`. Call `restore()` (or rely on `vi.restoreAllMocks()` in an
 * `afterEach`) to remove the spy so it doesn't leak into other test files.
 */
export function mockCanvasContext() {
  const ctx: MockCanvasContext = {
    setTransform: vi.fn(),
    // Added for the banded gas-giant body: it clips to the planet's disc and
    // save/restores around that, fills warped band paths, and draws a storm
    // ellipse plus a limb-darkening gradient.
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    ellipse: vi.fn(),
    fillRect: vi.fn(),
    // Added for the smoothed light-curve stroke.
    quadraticCurveTo: vi.fn(),
    lineJoin: 'miter',
    lineCap: 'butt',
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  }

  const spy = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(ctx as unknown as CanvasRenderingContext2D)

  return { ctx, restore: () => spy.mockRestore() }
}
