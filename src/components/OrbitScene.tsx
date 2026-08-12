import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'
import {
  ORBIT_RADIUS,
  PERIOD_MS,
  PLANET_RADIUS,
  type OrbitView,
  REST_ELEVATION,
  SPIN_MS,
  STAR_RADIUS,
  orbitAngle,
} from './Transit'

/**
 * Where the intro sweep starts — both angles, not just elevation.
 *
 * Dropping the camera vertically on its own reads as the scene *settling*,
 * which says nothing about what the visitor can do. Swinging the bearing round
 * at the same time reads as the whole system being turned, and turning is
 * precisely the affordance on offer. Starting high and off-axis also means the
 * orbit opens as a wide ellipse before closing to its near edge-on rest pose,
 * so the full range of the gesture is demonstrated on the way in.
 */
const INTRO_ELEVATION = 1.0
const INTRO_AZIMUTH = -1.15
const INTRO_ROLL = -0.62
const INTRO_DURATION = 2.2

/**
 * Camera roll at rest, in radians — the orbit's tilt on screen.
 *
 * Without this the projected orbit can only ever open and close vertically:
 * the orbit lies in the XZ plane and the camera's up vector is world Y, so the
 * ellipse's major axis is pinned to screen horizontal no matter where the
 * camera is. Rolling the camera about its own view axis is what lets the whole
 * figure sit on a diagonal, and what makes the intro sweep travel across the
 * frame rather than purely up and down.
 *
 * Cosmetic by construction: rotating the image about the view axis cannot
 * change any point's distance from that axis, so the projected separations the
 * light curve is built on — and therefore the transit — are untouched.
 */
export const REST_ROLL = 0.34

/** Clamped short of a pole: at exactly +-pi/2 the camera's up vector and its
 *  view direction become parallel and `lookAt` has no defined roll, which
 *  shows up as the scene snapping about. */
const MAX_ELEVATION = 1.45

/**
 * Far enough back that the whole orbit stays inside the frame at *any*
 * rotation, not just at rest.
 *
 * A PerspectiveCamera's `fov` is vertical, so the visible world height is
 * `2 * distance * tan(fov / 2)` and does not change with the canvas's pixel
 * height — making the element taller only scales everything up and clips just
 * as much. At the previous 9.2 the visible half-height was ~3.17 against an
 * orbit radius of 3.2, so the ring was cut off across the bottom the moment it
 * was rotated open. This leaves roughly 25% headroom instead.
 */
const CAMERA_DISTANCE = 11.8

const STAR_COLOR = '#a9c8ff'

/**
 * Equirectangular band texture for the planet, drawn once to a 2D canvas and
 * mapped onto the sphere.
 *
 * Latitude bands rather than a flat colour for the same reason the 2D version
 * had them: the planet has to read against a white stellar disc on the front
 * pass and against a near-black sky either side of it, so it needs both dark
 * and light tones. The sine warp keeps the band edges from reading as decal
 * stripes.
 */
function createPlanetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128
  const ctx = canvas.getContext('2d')!

  const bands: Array<{ from: number; to: number; fill: string }> = [
    { from: 0.0, to: 0.17, fill: '#0a1120' },
    { from: 0.17, to: 0.35, fill: '#22456e' },
    { from: 0.35, to: 0.46, fill: '#8fbde9' },
    { from: 0.46, to: 0.58, fill: '#0a1120' },
    { from: 0.58, to: 0.73, fill: '#5b93c9' },
    { from: 0.73, to: 0.86, fill: '#16294a' },
    { from: 0.86, to: 1.0, fill: '#7fb2e8' },
  ]

  ctx.fillStyle = '#0c1424'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  for (const band of bands) {
    ctx.fillStyle = band.fill
    ctx.beginPath()
    ctx.moveTo(0, band.from * canvas.height)
    for (let x = 0; x <= canvas.width; x += 8) {
      const warp = Math.sin((x / canvas.width) * Math.PI * 4 + band.from * 9) * 2.5
      ctx.lineTo(x, band.from * canvas.height + warp)
    }
    for (let x = canvas.width; x >= 0; x -= 8) {
      const warp = Math.sin((x / canvas.width) * Math.PI * 4 + band.to * 9) * 2.5
      ctx.lineTo(x, band.to * canvas.height + warp)
    }
    ctx.closePath()
    ctx.fill()
  }

  // One darker oval standing in for a storm, as in the 2D original.
  ctx.fillStyle = 'rgba(6, 10, 20, 0.75)'
  ctx.beginPath()
  ctx.ellipse(canvas.width * 0.62, canvas.height * 0.63, 22, 9, 0, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Radial-gradient sprite standing in for the star's glow. Cheaper and softer
 *  than real bloom, which would need a full post-processing pass for one
 *  object. */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
  g.addColorStop(0.22, 'rgba(169, 200, 255, 0.55)')
  g.addColorStop(1, 'rgba(169, 200, 255, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/**
 * The white dwarf and its transiting planet, as a scene you can spin.
 *
 * The orbit itself is fixed in the XZ plane and it is the *camera* that moves,
 * rather than the system tilting inside a static frame. That is what keeps the
 * physics honest: "how edge-on is this orbit" becomes purely a property of
 * where you are looking from, which is exactly what determines whether a real
 * transit is observable at all. `viewRef` publishes both angles every
 * frame so the light curve underneath can dim its dip as the orbit opens up
 * and the planet stops crossing the disc.
 *
 * A ref rather than React state on purpose: the angle changes every frame
 * while dragging, and routing that through a state setter would re-render the
 * whole hero sixty times a second to move one number.
 *
 * On first reveal the camera sweeps down from {@link INTRO_ELEVATION} to
 * {@link REST_ELEVATION}. The point is discoverability — a still image gives
 * no reason to try dragging it, whereas watching the system rotate to its
 * resting angle implies the rest of the rotation is available too. Any pointer
 * press kills that tween immediately so the intro never fights the user for
 * control of the camera.
 */
export function OrbitScene({
  ready = true,
  viewRef,
}: {
  ready?: boolean
  viewRef?: React.RefObject<OrbitView>
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reduced = usePrefersReducedMotion()
  // Survives re-renders so a drag is not undone by the component re-rendering
  // for an unrelated reason (e.g. `ready` flipping).
  const cameraAngles = useRef({
    azimuth: reduced ? 0 : INTRO_AZIMUTH,
    elevation: reduced ? REST_ELEVATION : INTRO_ELEVATION,
    roll: reduced ? REST_ROLL : INTRO_ROLL,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // jsdom and any WebGL-less environment: bail without throwing, exactly as
    // the 2D version bails when getContext('2d') returns null.
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      return
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)

    const planetTexture = createPlanetTexture()
    const glowTexture = createGlowTexture()

    const star = new THREE.Mesh(
      new THREE.SphereGeometry(STAR_RADIUS, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    )
    scene.add(star)

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    )
    glow.scale.setScalar(STAR_RADIUS * 7)
    scene.add(glow)

    // Lit by the star at the origin, so the planet naturally shows phases —
    // its lit face turns away from us as it swings to the front, which is the
    // correct behaviour for a body between us and its primary.
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({ map: planetTexture, roughness: 0.85, metalness: 0 }),
    )
    scene.add(planet)
    scene.add(new THREE.PointLight(0xffffff, 14, 0, 2))
    scene.add(new THREE.AmbientLight(0x9fb8e8, 0.55))

    const orbitPoints: THREE.Vector3[] = []
    for (let i = 0; i <= 160; i += 1) {
      const t = (i / 160) * Math.PI * 2
      orbitPoints.push(
        new THREE.Vector3(Math.cos(t) * ORBIT_RADIUS, 0, Math.sin(t) * ORBIT_RADIUS),
      )
    }
    const orbitLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(orbitPoints),
      new THREE.LineBasicMaterial({
        color: new THREE.Color(STAR_COLOR),
        transparent: true,
        opacity: 0.22,
      }),
    )
    scene.add(orbitLine)

    function resize() {
      const width = canvas!.clientWidth || 320
      const height = canvas!.clientHeight || 260
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    function placeCamera() {
      const { azimuth, elevation, roll } = cameraAngles.current
      camera.position.set(
        CAMERA_DISTANCE * Math.cos(elevation) * Math.sin(azimuth),
        CAMERA_DISTANCE * Math.sin(elevation),
        CAMERA_DISTANCE * Math.cos(elevation) * Math.cos(azimuth),
      )
      // Tilting the up vector rolls the camera about its view axis, which is
      // what puts the orbit on a diagonal — `lookAt` derives the whole
      // orientation from this, so it has to be set before the call, not after.
      camera.up.set(Math.sin(roll), Math.cos(roll), 0)
      camera.lookAt(0, 0, 0)
      // Mutated in place rather than reassigned: this runs every frame of a
      // drag, and a fresh object each time is pure garbage for the collector.
      // Elevation is published as a magnitude because the geometry is
      // symmetric about the orbital plane — looking up from below occults
      // exactly as much as looking down from above.
      if (viewRef?.current) {
        viewRef.current.elevation = Math.abs(elevation)
        viewRef.current.azimuth = azimuth
      }
    }

    /**
     * Negated Z so the orbit matches the phase convention the light curve is
     * built on: phase 0.5 puts the planet at maximum +Z, i.e. nearest the
     * camera and centred on the star — the transit.
     */
    function placePlanet(phase: number, spin: number) {
      const angle = orbitAngle(phase)
      planet.position.set(
        Math.cos(angle) * ORBIT_RADIUS,
        0,
        -Math.sin(angle) * ORBIT_RADIUS,
      )
      planet.rotation.y = spin
    }

    resize()
    placeCamera()
    placePlanet(0, 0)
    renderer.render(scene, camera)

    // --- Drag to orbit the camera -------------------------------------------
    let dragging = false
    let lastX = 0
    let lastY = 0
    let introTween: gsap.core.Tween | undefined

    const onPointerDown = (event: PointerEvent) => {
      dragging = true
      lastX = event.clientX
      lastY = event.clientY
      // The intro is a hint, not a cutscene: the moment the visitor takes hold
      // of the camera it stops competing for it.
      introTween?.kill()
      // Capture keeps a drag alive when the pointer leaves the canvas, but it
      // throws if the id is not an active pointer (synthetic events, a pointer
      // already released). Losing capture only costs us drags that wander off
      // the element; letting it throw would cost us the whole interaction.
      try {
        canvas!.setPointerCapture(event.pointerId)
      } catch {
        /* not fatal — drag still tracks while the pointer stays on canvas */
      }
      canvas!.style.cursor = 'grabbing'
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return
      const dx = event.clientX - lastX
      const dy = event.clientY - lastY
      lastX = event.clientX
      lastY = event.clientY
      const next = cameraAngles.current
      next.azimuth -= dx * 0.008
      next.elevation = Math.max(
        -MAX_ELEVATION,
        Math.min(MAX_ELEVATION, next.elevation + dy * 0.006),
      )
      placeCamera()
      if (reduced) renderer.render(scene, camera)
    }

    const endDrag = (event: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try {
        if (canvas!.hasPointerCapture(event.pointerId)) {
          canvas!.releasePointerCapture(event.pointerId)
        }
      } catch {
        /* capture was never taken, or already lost */
      }
      canvas!.style.cursor = 'grab'
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)

    const onResize = () => {
      resize()
      if (reduced) renderer.render(scene, camera)
    }
    window.addEventListener('resize', onResize)

    // --- Motion --------------------------------------------------------------
    let raf = 0

    if (reduced) {
      // No orbital motion and no intro sweep, but dragging still works: the
      // interaction is user-initiated, which is not what reduced motion asks
      // us to suppress.
      renderer.render(scene, camera)
    } else {
      if (ready) {
        introTween = gsap.to(cameraAngles.current, {
          elevation: REST_ELEVATION,
          azimuth: 0,
          roll: REST_ROLL,
          duration: INTRO_DURATION,
          ease: 'power3.out',
        })
      }

      // Raw `now`, not an offset from this scene's first frame: the light
      // curve derives its phase from the same rAF clock, and anchoring each
      // to its own mount time drifted them apart by however long this
      // lazily-loaded scene took to arrive — so the plotted dip ran ahead of
      // the planet actually crossing the disc.
      const tick = (now: number) => {
        placeCamera()
        placePlanet(
          (now % PERIOD_MS) / PERIOD_MS,
          (now / SPIN_MS) * Math.PI * 2,
        )
        renderer.render(scene, camera)
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(raf)
      introTween?.kill()
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      // Three.js holds GPU resources that garbage collection cannot reach.
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose()
          const material = object.material as THREE.Material | THREE.Material[]
          if (Array.isArray(material)) material.forEach((m) => m.dispose())
          else material.dispose()
        }
      })
      glow.material.dispose()
      planetTexture.dispose()
      glowTexture.dispose()
      renderer.dispose()
    }
  }, [reduced, ready, viewRef])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-orbit-scene
      className="h-[260px] w-full touch-none sm:h-[300px]"
    />
  )
}
