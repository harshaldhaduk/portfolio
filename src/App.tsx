import { useState } from 'react'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { Starfield } from './components/Starfield'
import { CursorRing } from './components/CursorRing'
import { Preloader } from './components/Preloader'
import { Hero } from './components/Hero'
import { MissionLog } from './components/MissionLog'
import { Research } from './components/Research'
import { Projects } from './components/Projects'
import { Systems } from './components/Systems'
import { Footer } from './components/Footer'

export default function App() {
  useSmoothScroll()
  // Starts true unconditionally — Preloader decides for itself whether
  // reduced motion means "skip straight to done" (see its own doc comment),
  // so App does not need to duplicate that check here.
  const [loading, setLoading] = useState(true)

  return (
    <>
      {loading && <Preloader onDone={() => setLoading(false)} />}
      <CursorRing />
      <Starfield />
      {/* Hero renders a <header> and Footer a <footer>; both need to sit
          outside <main> or they lose their implicit banner/contentinfo
          landmark roles (header/footer only get those roles when they are
          not descendants of article/aside/main/nav/section). The shared
          container classes live on this wrapper div instead, so <main>
          wraps only the five sections in between and all three landmarks
          resolve correctly. */}
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <Hero ready={!loading} />
        <main>
          <MissionLog />
          <Research />
          <Projects />
          <Systems />
        </main>
        <Footer />
      </div>
    </>
  )
}
