import { lazy, Suspense } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { PROFILE_LABEL, useApp } from './ctx'
import type { Profile } from './shared'
import { firebaseConfigured } from './firebase'
import Guard from './pages/Guard'
const Check = lazy(() => import('./pages/Check'))
const Guardian = lazy(() => import('./pages/Guardian'))
const Impact = lazy(() => import('./pages/Impact'))
const Roadmap = lazy(() => import('./pages/Roadmap'))
const About = lazy(() => import('./pages/About'))

const links = [
  ['/', 'Call Guard'],
  ['/check', 'Scam Check'],
  ['/impact', 'Impact'],
  ['/roadmap', 'Roadmap'],
  ['/about', 'About'],
] as const

export default function App() {
  const { lang, setLang, profile, setProfile } = useApp()
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <header className="flex flex-wrap items-center gap-3 py-4 print:hidden">
        <NavLink to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <img src="/favicon.svg" alt="" aria-hidden className="h-9 w-9" />
          Second Opinion
        </NavLink>
        <nav aria-label="Main" className="flex flex-wrap gap-1 text-sm font-semibold">
          {links.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 ${isActive ? 'bg-ink text-white' : 'hover:bg-white'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <label className="sr-only" htmlFor="profile">
            Who is this for
          </label>
          <select
            id="profile"
            value={profile}
            onChange={(e) => setProfile(e.target.value as Profile)}
            className="rounded-lg border border-[#cfc9b6] bg-white px-2 py-2"
          >
            {(Object.keys(PROFILE_LABEL) as Profile[]).map((p) => (
              <option key={p} value={p}>
                {PROFILE_LABEL[p]}
              </option>
            ))}
          </select>
          <div role="group" aria-label="Language" className="flex overflow-hidden rounded-lg border border-[#cfc9b6] bg-white">
            {(['en', 'hi'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`px-3 py-2 font-semibold ${lang === l ? 'bg-ink text-white' : ''}`}
              >
                {l === 'en' ? 'EN' : 'हिं'}
              </button>
            ))}
          </div>
        </div>
      </header>
      {!firebaseConfigured && (
        <div role="alert" className="mb-4 rounded-xl border border-caution bg-amber-50 p-3 text-sm">
          Firebase is not configured. Copy <code>.env.local.example</code> to <code>.env.local</code> and fill in your Firebase
          web config. Only the Impact, Roadmap and About pages work without it.
        </div>
      )}
      <main>
        <Suspense fallback={<p className="text-ink/60">Loading…</p>}>
        <Routes>
          <Route path="/" element={<Guard />} />
          <Route path="/check" element={<Check />} />
          <Route path="/guardian/:code" element={<Guardian />} />
          <Route path="/guardian" element={<Guardian />} />
          <Route path="/impact" element={<Impact />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/about" element={<About />} />
        </Routes>
        </Suspense>
      </main>
      <footer className="mt-12 print:hidden border-t border-[#e3dfd2] pt-4 text-xs text-ink/70">
        Second Opinion gives guidance, not legal or financial advice. In an emergency, call your local helpline (India 1930).
        Built for the AI Builder Cup 2026 with Gemini and Firebase.
      </footer>
    </div>
  )
}
