import { useState } from 'react'
import { stats } from '../shared'

export default function Impact() {
  const a = stats.avoidable
  const [pool, setPool] = useState(a.base_pools[0].id)
  const [rate, setRate] = useState(a.conservative_pct)
  const p = a.base_pools.find((x) => x.id === pool)!
  const saved = (p.amount * rate) / 100

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-extrabold">Scams are a people problem, and the money leaves with the victim’s own hands.</h1>
        <p className="mt-2 max-w-3xl text-lg text-ink/80">
          Most losses are payments the victim authorises under pressure, which transaction monitoring cannot see. A second pair of ears on the call can.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {stats.headline.map((h) => (
            <a key={h.label + h.region} href={h.url} target="_blank" rel="noreferrer" className="card block p-4 hover:shadow-md">
              <div className="text-sm font-semibold text-ink/70">
                {h.region} · {h.year}
              </div>
              <div className="text-3xl font-extrabold">{h.value}</div>
              <div className="font-semibold">{h.label}</div>
              <div className="mt-1 text-sm text-ink/80">{h.note}</div>
            </a>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold">Who is targeted</h2>
        <p className="text-ink/80">Seniors are our core user, but the same coercion patterns hit every age group.</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {stats.ages.map((g) => (
            <div key={g.group} className={`card p-4 ${g.group === 'senior' ? 'ring-2 ring-brand' : ''}`}>
              <div className="font-bold">
                {g.label} {g.group === 'senior' && <span className="chip ml-1">core</span>}
              </div>
              <p className="mt-1 text-sm">{g.stat}</p>
              <p className="mt-2 text-sm text-ink/70">Typical scams: {g.scams}</p>
            </div>
          ))}
        </div>
        <div className="card mt-4 p-4">
          <h3 className="font-bold">India 2025 complaint mix (reported, indicative)</h3>
          <div className="mt-2 space-y-1" role="list">
            {stats.complaint_mix_india_2025.map((m) => (
              <div key={m.type} role="listitem" className="flex items-center gap-2 text-sm">
                <span className="w-28">{m.type}</span>
                <div className="h-4 flex-1 rounded bg-[#e3dfd2]">
                  <div className="h-4 rounded bg-brand" style={{ width: `${m.pct * 2}%` }} />
                </div>
                <span className="w-10 text-right">{m.pct}%</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink/60">{stats.complaint_mix_source}</p>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-2xl font-bold">How much could be avoided?</h2>
        <p className="text-ink/80">
          An illustrative estimate, not a forecast. Pick a loss pool and an interception rate. The slider’s end points come from published evidence.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor="pool">
              Loss pool
            </label>
            <select id="pool" value={pool} onChange={(e) => setPool(e.target.value)} className="mt-1 w-full rounded-lg border border-[#cfc9b6] bg-white p-2">
              {a.base_pools.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}: {b.amount.toLocaleString()} {b.unit}
                </option>
              ))}
            </select>
            <label className="mt-4 block text-sm font-semibold" htmlFor="rate">
              Share of losses stopped: <b>{rate}%</b>
            </label>
            <input id="rate" type="range" min={1} max={a.ceiling_pct} value={rate} onChange={(e) => setRate(+e.target.value)} className="w-full" />
            <div className="flex justify-between text-xs text-ink/70">
              <span>12% conservative</span>
              <span>94% lab ceiling</span>
            </div>
          </div>
          <div className="rounded-xl bg-[#faf9f4] p-4">
            <div className="text-sm text-ink/70">Potentially avoided per year</div>
            <div className="text-4xl font-extrabold text-calm">
              {saved.toLocaleString(undefined, { maximumFractionDigits: 1 })} <span className="text-xl">{p.unit}</span>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-ink/80">
              <li>
                <b>12%</b>: {a.conservative_basis}{' '}
                <a className="underline" href={a.conservative_url} target="_blank" rel="noreferrer">
                  source
                </a>
              </li>
              <li>
                <b>94%</b>: {a.ceiling_basis}{' '}
                <a className="underline" href={a.ceiling_url} target="_blank" rel="noreferrer">
                  source
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
          <p>
            <b>Speed matters.</b> {stats.speed_matters.text}{' '}
            <a className="underline" href={stats.speed_matters.url} target="_blank" rel="noreferrer">
              source
            </a>
          </p>
          <p>
            <b>Friction is accepted.</b> {stats.precedent}{' '}
            <a className="underline" href={stats.precedent_url} target="_blank" rel="noreferrer">
              source
            </a>
          </p>
        </div>
      </section>
    </div>
  )
}
