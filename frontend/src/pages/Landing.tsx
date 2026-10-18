import { lazy, Suspense, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import Aurora from '../components/reactbits/Aurora'
import CountUp from '../components/reactbits/CountUp'
import ScrollReveal from '../components/reactbits/ScrollReveal'
import ScrollVelocity from '../components/reactbits/ScrollVelocity'
import SpotlightCard from '../components/reactbits/SpotlightCard'
import SplitText from '../components/reactbits/SplitText'
import StarBorder from '../components/reactbits/StarBorder'
import { usePageMeta } from '../lib/usePageMeta'
import '../styles/landing.css'

const HeartOrb = lazy(() => import('../components/reactbits/HeartOrb'))

const BEAT = 'l6 0 l5 -6 l5 6 l4 0 l6 -4 l8 4 l6 0 l3 -9 l5 62 l5 -66 l4 13 l6 0 l8 -9 l8 9'
const ECG_PATH = `M0 80 ${Array.from({ length: 20 }, () => `l36 0 ${BEAT}`).join(' ')} l300 0`

type Kind = 'measured' | 'estimated'

const SIGNALS: { name: string; unit: string; kind: Kind; desc: string; wide?: boolean }[] = [
  { name: 'Heart rate', unit: 'bpm', kind: 'measured', desc: 'The beats per minute your watch’s optical sensor reads, all day long.' },
  { name: 'Steps', unit: 'steps', kind: 'measured', desc: 'Your running activity count. It’s the clue that tells a calm moment from an effortful one.' },
  { name: 'Resting heart rate', unit: 'bpm', kind: 'estimated', desc: 'Your calm baseline: the heart rate of still moments, worked out from your own history.' },
  { name: 'Variability (HRV)', unit: 'ms', kind: 'estimated', desc: 'A reading of how your heart rhythm breathes, estimated from resting heart rate and shown with its confidence.' },
  { name: 'Sleep', unit: 'hours', kind: 'estimated', desc: 'Spots your blocks of rest from low heart rate and stillness, and sums them up night by night.' },
  { name: 'Stress', unit: 'index', kind: 'estimated', desc: 'An index that combines heart rate, rest and activity to show when your body is working harder than it needs to.' },
  { name: 'Recovery', unit: 'index', kind: 'estimated', wide: true, desc: 'How you start the day: it blends sleep, resting heart rate and variability into one easy-to-follow reading.' },
]

const FLOW = [
  ['Watch', 'Measures heart rate and steps and keeps them on the watch itself, even when there is no network.'],
  ['Server', 'Receives each batch securely, avoids duplicates and stores it intact.'],
  ['Dashboard', 'Turns your history into clear readings: measured values and estimates with their confidence.'],
] as const

const ANALYSIS = [
  ['Pick a period', 'The last few days, a week, or whatever stretch you want to review.'],
  ['Give your consent', 'Only what you decide is sent, when you decide to send it.'],
  ['Get your reading', 'An AI-guided reading by Jev, prepared from the data of that period.'],
] as const

const PAIR = [
  ['Open RaHel on the watch', 'The pairing screen shows a one-time code.'],
  ['Enter it in the dashboard', 'Sign in, open "Pair a watch" and type the code before it expires.'],
  ['Watch the data arrive', 'The watch gets its own credential and starts sending. No passwords on your wrist.'],
] as const

const TRUST = [
  ['Each account, its own watches', 'You only see the crew members of the watches you paired. No one else shows up.'],
  ['One-time codes', 'They expire after 10 minutes, and after five wrong attempts the account is locked for a while.'],
  ['Revocable in one click', 'Unpair a watch from the dashboard and its credential stops working instantly.'],
] as const

const FAQ = [
  ['Does it work without internet?', 'Yes. The watch queues its samples and resends them when the connection returns, without duplicating readings.'],
  ['How does RaHel get sleep, variability and stress?', 'It calculates them with specialized algorithms from your heart rate and step history, built on physiological relationships described in the scientific literature. They appear labeled "estimated" next to their confidence level, so you know how much to lean on each reading.'],
  ['Which watches are compatible?', 'Watches running Wear OS 3 or later (Android 11 and up). RaHel measures heart rate and steps and builds the rest from them; Analytics shows you what you receive from each watch.'],
  ['What is the Analysis section?', 'Analysis is powered by Jev: you choose a period and get an AI-guided reading of it. It runs on demand, not in real time, and data is sent only with your consent.'],
  ['Is it a medical device?', 'No. RaHel is not a medical device: it supports your crew’s wellness tracking, but it does not diagnose or replace the assessment of a health professional.'],
  ['Can I remove a watch?', 'Yes. Unpair it from the dashboard; it stops sending data and its credential is revoked.'],
] as const

const TICKER = [
  'Heart rate measured',
  'Steps measured',
  'Recovery estimated',
  'Sleep estimated',
  'Variability estimated',
  'Stress estimated',
  'Smart reading',
]

const idx = (i: number) => ({ '--i': i }) as CSSProperties

export default function Landing() {
  usePageMeta({
    title: 'RaHel · Your crew’s heartbeat, turned into clarity',
    description:
      'RaHel measures heart rate and steps with your Wear OS watch and calculates estimates of recovery, sleep, heart rate variability and stress with specialized algorithms. All in one clear dashboard.',
    path: '/',
  })

  const root = useRef<HTMLDivElement>(null)
  const [menu, setMenu] = useState(false)

  // Revelados al hacer scroll: se activan solo si hay IntersectionObserver y sin reduced-motion.
  useLayoutEffect(() => {
    const el = root.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    el.classList.add('js-rv')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    el.querySelectorAll('[data-rv]').forEach((n) => io.observe(n))
    return () => {
      io.disconnect()
      el.classList.remove('js-rv')
    }
  }, [])

  const close = () => setMenu(false)

  return (
    <div className="lp" ref={root}>
      <header className="lp-nav">
        <Link to="/" className="lp-brand" aria-label="RaHel, home">
          <img src="/logo.svg" alt="RaHel" width="44" height="44" />
        </Link>
        <button
          type="button"
          className="lp-burger"
          aria-expanded={menu}
          aria-controls="lp-menu"
          onClick={() => setMenu((v) => !v)}
        >
          {menu ? 'Close' : 'Menu'}
        </button>
        <nav id="lp-menu" aria-label="Main" className={menu ? 'is-open' : ''}>
          <a href="#how-it-works" onClick={close}>How it works</a>
          <a href="#signals" onClick={close}>Signals</a>
          <a href="#analysis" onClick={close}>Analysis</a>
          <a href="#pair" onClick={close}>Pair</a>
          <Link to="/demo" className="lp-nav-demo" aria-label="Try the RaHel demo, no account needed" onClick={close}>Try the demo</Link>
          <Link to="/app" className="lp-nav-cta" onClick={close}>Open the dashboard</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Crew wellness · Wear OS</p>
            <SplitText
              tag="h1"
              className="lp-h1"
              text="Every heartbeat tells you something. RaHel helps you read it."
              splitType="words"
              delay={60}
              duration={0.9}
              trigger="load"
              textAlign="left"
            />
            <p className="lp-lead">
              RaHel measures your heart rate and steps with your watch and also calculates estimates of
              recovery, sleep, heart rate variability and stress with specialized algorithms built on
              physiological relationships described in the scientific literature.
            </p>
            <div className="lp-actions">
              <StarBorder as={Link} to="/app" color="#5EE0A0" backgroundColor="#04281A" textColor="#FFE5E7" radius={999}>
                Open the dashboard
              </StarBorder>
              <Link className="lp-demo-btn" to="/demo" aria-label="Try the RaHel demo, no account needed">Try the demo</Link>
              <a className="lp-ghost lp-ghost-quiet" href="#signals"><span>See what RaHel reads</span> <i aria-hidden="true">→</i></a>
            </div>
          </div>

          <div className="lp-orb" role="img" aria-label="A glowing orb that beats calmly, like a pulse">
            <Suspense fallback={<div className="lp-pulse"><div className="lp-orb-stage"><div className="lp-orb-fallback" /></div></div>}>
              <HeartOrb />
            </Suspense>
          </div>

          <figure className="lp-ecg" aria-hidden="true">
            <svg viewBox="0 0 2400 160" preserveAspectRatio="none">
              <path className="lp-ecg-ghost" d={ECG_PATH} />
              <path className="lp-ecg-line" d={ECG_PATH} pathLength={1} />
            </svg>
          </figure>
        </section>

        <div className="lp-ticker" aria-hidden="true">
          <ScrollVelocity
            texts={[TICKER.join('   ·   ')]}
            velocity={40}
            numCopies={6}
            fontSize="1.05rem"
            fontWeight={500}
            color="#FFE5E7"
            gap={24}
            fadeEdges={false}
            separator={<span className="lp-sep">/</span>}
          />
        </div>

        <section className="lp-stats" aria-label="At a glance">
          <div data-rv style={idx(0)}><CountUp to={7} className="lp-num" /><p>signals per watch, each with its source in plain view</p></div>
          <div data-rv style={idx(1)}><CountUp to={3} className="lp-num" suffix=" steps" /><p>to pair your watch and see the data arrive</p></div>
          <div data-rv style={idx(2)}><CountUp to={10} className="lp-num" suffix=" min" /><p>validity of the pairing code</p></div>
        </section>

        <section id="demo" className="lp-section lp-demo" aria-labelledby="demo-h">
          <div className="lp-demo-copy" data-rv>
            <p className="lp-eyebrow">Demo mode</p>
            <h2 className="lp-h2" id="demo-h">Try it without a watch.</h2>
            <p>
              Explore a simulated crew with live charts and the full Analysis, including a simulated AI
              answer. No account needed, and no data leaves your browser.
            </p>
          </div>
          <div data-rv style={idx(1)}>
            <Link to="/demo" className="lp-demo-cta" aria-label="Enter demo mode">Enter demo mode <i aria-hidden="true">→</i></Link>
          </div>
        </section>

        <section id="how-it-works" className="lp-section">
          <p className="lp-eyebrow" data-rv>How it works</p>
          <h2 className="lp-h2" data-rv>From watch to clarity, in three pieces.</h2>
          <ol className="lp-flow">
            {FLOW.map(([t, d], i) => (
              <li key={t} data-rv style={idx(i)}>
                <span className="lp-step" aria-hidden="true">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
          <div className="lp-statement">
            <ScrollReveal baseOpacity={0.15} enableBlur={false} baseRotation={0} containerClassName="lp-reveal">
              What your watch measures is shown as is. What RaHel calculates arrives labeled "estimated" with its confidence level: smart reading, always transparent.
            </ScrollReveal>
          </div>
        </section>

        <section id="signals" className="lp-section">
          <p className="lp-eyebrow" data-rv>Smart reading</p>
          <h2 className="lp-h2" data-rv>Two measured signals. Five readings RaHel builds with you.</h2>
          <div className="lp-grid">
            {SIGNALS.map((s, i) => (
              <div key={s.name} data-rv style={idx(i % 3)} className={s.wide ? 'lp-card-wrap lp-card-wide' : 'lp-card-wrap'}>
                <SpotlightCard
                  theme="light"
                  spotlightColor="rgba(0, 122, 57, 0.22)"
                  className="lp-card"
                >
                  <div className="lp-card-top">
                    <span className="lp-unit">{s.unit}</span>
                    <span className={`lp-badge lp-badge-${s.kind}`}>{s.kind}</span>
                  </div>
                  <h3>{s.name}</h3>
                  <p>{s.desc}</p>
                </SpotlightCard>
              </div>
            ))}
          </div>
        </section>

        <section id="analytics" className="lp-section lp-dark">
          <div className="lp-dark-inner">
            <div className="lp-dark-copy" data-rv>
              <p className="lp-eyebrow lp-eyebrow-light">Sensor analytics</p>
              <h2 className="lp-h2">Everything you receive from each watch, at a glance.</h2>
              <p className="lp-lead lp-lead-light">
                A clear record of every signal: how much coverage it arrives with, whether it is measured or
                a smart reading, and what is worth keeping. So you know what to rely on each day.
              </p>
              <Link to="/app/analytics" className="lp-link-light">Explore Analytics <i aria-hidden="true">→</i></Link>
            </div>

            <figure className="lp-mock" data-rv style={idx(1)} aria-label="Sample view of sensor analytics">
              <div className="lp-mock-bar" aria-hidden="true"><i /><i /><i /><span>analytics / received fields</span></div>
              <div className="lp-mock-scroll">
                <table>
                  <thead>
                    <tr><th scope="col">Field</th><th scope="col">Coverage</th><th scope="col">Source</th><th scope="col">Reading</th></tr>
                  </thead>
                  <tbody>
                    <tr><td>Heart rate</td><td><span className="lp-bar"><i style={{ width: '98%' }} /></span><em>98%</em></td><td><span className="lp-badge lp-badge-measured">measured</span></td><td>Direct</td></tr>
                    <tr><td>Steps</td><td><span className="lp-bar"><i style={{ width: '96%' }} /></span><em>96%</em></td><td><span className="lp-badge lp-badge-measured">measured</span></td><td>Direct</td></tr>
                    <tr><td>Resting heart rate</td><td><span className="lp-bar"><i style={{ width: '90%' }} /></span><em>90%</em></td><td><span className="lp-badge lp-badge-estimated">estimated</span></td><td>Smart</td></tr>
                    <tr><td>HRV</td><td><span className="lp-bar"><i style={{ width: '71%' }} /></span><em>71%</em></td><td><span className="lp-badge lp-badge-estimated">estimated</span></td><td>Smart</td></tr>
                    <tr><td>Sleep</td><td><span className="lp-bar"><i style={{ width: '84%' }} /></span><em>84%</em></td><td><span className="lp-badge lp-badge-estimated">estimated</span></td><td>Smart</td></tr>
                    <tr><td>Stress</td><td><span className="lp-bar"><i style={{ width: '78%' }} /></span><em>78%</em></td><td><span className="lp-badge lp-badge-estimated">estimated</span></td><td>Smart</td></tr>
                  </tbody>
                </table>
              </div>
              <figcaption>Sample view with fictional data</figcaption>
            </figure>
          </div>
        </section>

        <section id="analysis" className="lp-section lp-analysis">
          <div className="lp-analysis-copy" data-rv>
            <p className="lp-eyebrow">New · Analysis</p>
            <h2 className="lp-h2">Analysis powered by Jev.</h2>
            <span className="lp-engine">Powered by Jev · AI engine</span>
            <p className="lp-lead">
              Jev gives you an AI-guided reading of the period you choose. It runs on demand, not in
              real time: you prepare it whenever you like, and only with your consent.
            </p>
            <StarBorder as={Link} to="/app/analysis" color="#007A39" backgroundColor="#04281A" textColor="#FFE5E7" radius={999}>
              Try Analysis
            </StarBorder>
          </div>
          <ol className="lp-analysis-list">
            {ANALYSIS.map(([t, d], i) => (
              <li key={t} data-rv style={idx(i)}>
                <span className="lp-step" aria-hidden="true">{i + 1}</span>
                <div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section className="lp-section">
          <p className="lp-eyebrow" data-rv>Security</p>
          <h2 className="lp-h2" data-rv>Health data, under lock and key.</h2>
          <ul className="lp-trust">
            {TRUST.map(([t, d], i) => (
              <li key={t} data-rv style={idx(i)}><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ul>
        </section>

        <section id="pair" className="lp-section lp-pair">
          <div data-rv>
            <p className="lp-eyebrow">Pair a watch</p>
            <h2 className="lp-h2">From watch to account in three steps.</h2>
            <p className="lp-lead">
              The code is single-use and expires. Only whoever holds the watch can pair it.
            </p>
          </div>
          <ol className="lp-pair-list">
            {PAIR.map(([t, d], i) => (
              <li key={t} data-rv style={idx(i)}>
                <span className="lp-step" aria-hidden="true">{i + 1}</span>
                <div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" className="lp-section">
          <p className="lp-eyebrow" data-rv>Frequently asked questions</p>
          <h2 className="lp-h2" data-rv>What people usually ask.</h2>
          <div className="lp-faq" data-rv>
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final">
          <div className="lp-aurora" aria-hidden="true">
            <Aurora colorStops={['#007A39', '#5EE0A0', '#FFE5E7']} amplitude={0.8} blend={0.7} speed={0.5} />
          </div>
          <h2 className="lp-h2">Start reading your pulse.</h2>
          <StarBorder as={Link} to="/app" color="#5EE0A0" backgroundColor="#04281A" textColor="#FFE5E7" radius={999}>
            Open the dashboard
          </StarBorder>
        </section>
      </main>

      <footer className="lp-foot">
        <span><img src="/logo.svg" alt="" width="24" height="24" /> © 2026 RaHel</span>
        <span className="lp-foot-note">RaHel is not a medical device and does not replace the assessment of a health professional.</span>
        <span>
          <Link to="/app">Dashboard</Link>
        </span>
      </footer>
    </div>
  )
}
