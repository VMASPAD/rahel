import PublishedFigures from './PublishedFigures'
import '../../styles/nasa.css'

type Source = {
  tag: string
  title: string
  cite: string
  url: string
  extra?: { label: string; url: string }[]
  learned: string[]
  applied: string
}

// Every statement under "learned" was checked against the page named in `url` (or `extra`).
const SOURCES: Source[] = [
  {
    tag: 'NASA technical report · 2016',
    title: 'Bluetooth Heart Rate Monitors for Spaceflight',
    cite: 'Buxton, West, Kalogera and Hanson. 2016 NASA Human Research Program Investigators’ Workshop.',
    url: 'https://ntrs.nasa.gov/citations/20150021215',
    learned: [
      'Commercial Bluetooth heart-rate monitors were compared with a 12-lead ECG: 19 subjects, 30 treadmill and cycle sessions.',
      'With a ±5 bpm threshold, electrode chest straps had 1.6% to 9.2% of samples outside it. The two optical sensors had 10.4% and 14.9%.',
      'The authors say optical sensors have not been ruled out for use, but more investigation is needed to get the best-quality data.',
    ],
    applied:
      'The watch reads pulse optically, so RaHel treats it as indicative. Anything derived from it (resting heart rate, HRV proxy, stress, sleep) is labelled estimated, with a confidence level that is never above medium. We adopt NASA’s ±5 bpm metric as the criterion for a future check against a chest strap or ECG. That check has not been run yet.',
  },
  {
    tag: 'NASA data repository · FAQ',
    title: 'NASA Open Science Data Repository (OSDR)',
    cite: 'OSDR frequently asked questions, NASA Science.',
    url: 'https://science.nasa.gov/reference/osdr-faq',
    learned: [
      'OSDR is NASA’s platform for space-related biological data from spaceflight, ground and analog studies, including physiological and behavioural data.',
      'Most of its data are accessible to all users without user authentication.',
      'For studies with astronaut-derived data, processed data are public while sequence data are controlled access and must be requested.',
      'Users are asked to credit it: “Data are courtesy of the NASA Open Science Data Repository”.',
    ],
    applied:
      'Open science data and personal health data follow different rules, and RaHel keeps them apart. The demo dashboard is simulated inside your browser, and a real account only sees the watches it paired. The two never mix.',
  },
  {
    tag: 'NASA data archive · entry page',
    title: 'Life Sciences Data Archive (LSDA)',
    cite: 'NASA Life Sciences Portal. Supporting pages read for the details below.',
    url: 'https://nlsp.nasa.gov/explore/lsdahome',
    extra: [
      { label: 'NASA LSDA page', url: 'https://www.nasa.gov/directorates/esdmd/hhp/life-sciences-data-archive-lsda/' },
      { label: 'Data reuse, open access and privacy (2025)', url: 'https://ntrs.nasa.gov/citations/20250000281' },
      { label: 'The data request process (2022)', url: 'https://ntrs.nasa.gov/citations/20220014789' },
    ],
    learned: [
      'LSDA houses de-identified human research data from spaceflight and analog missions. Data are asked for through a Data Request Portal.',
      'NASA describes a request-to-delivery process with approval boards and responsibilities for the requestor.',
      'The archive is charged with protecting participants’ privacy and implementing their consent decisions.',
    ],
    applied:
      'Health data leaves its owner on purpose, not by default. RaHel’s Analysis sends data to the AI engine only for the period you choose and only after you tick a consent box on every run. Each account sees only the watches it paired, and unpairing a watch revokes its credential.',
  },
  {
    tag: 'NASA technical report · 2016',
    title: 'Wearable Biosensor Monitor to Support Autonomous Crew Health and Performance',
    cite: 'DeLeon, Cowings and Toscano. Astroskin in the Human Exploration Research Analog (HERA).',
    url: 'https://ntrs.nasa.gov/citations/20190000238',
    learned: [
      'A prototype wearable biosensor system, Astroskin, was tested on astronaut surrogates during 30-day missions in HERA, a ground analog at Johnson Space Center.',
      'It can measure vital signs, sleep quality and activity level. One main goal was to evaluate data quality, plus crew usability and comfort.',
      'The record describes a technology demonstration under way. It reports no results.',
    ],
    applied:
      'Data quality comes before conclusions. RaHel’s Analytics screen shows, for every field a watch sends, how much of the time it arrives and whether it is measured or estimated. Each estimate also carries the number of samples behind it.',
  },
  {
    tag: 'NASA article · 2024',
    title: 'Wearable Tech for Space Station Research',
    cite: 'Melissa L. Gaskill, NASA, published November 13, 2024.',
    url: 'https://www.nasa.gov/missions/station/wearable-tech-for-space-station-research/',
    learned: [
      'Crew wear devices on the International Space Station such as a wrist-worn Actiwatch Spectrum, which uses an accelerometer and light sensors to track sleep-wake patterns.',
      'A sensor vest records heart activity during sleep without waking the wearer. Researchers reported positive performance and good quality of recorded signals.',
      'Data from earlier missions show crew members slept significantly less during spaceflight than before and after.',
    ],
    applied:
      'Sleep matters for crews, so RaHel estimates it: blocks of at least two hours with low, steady heart rate and no new steps. It has no light or motion sensor like the Actiwatch, so the result is always labelled estimated, with its confidence. It is a wellness cue, not a sleep study.',
  },
]

const MEASURED = [
  ['Heart rate', 'Read by the watch’s optical sensor and shown as received.'],
  ['Steps', 'The running count from the watch.'],
]
const ESTIMATED = [
  ['Resting heart rate', 'The 10th percentile of heart rate in still moments over up to 24 hours.'],
  ['HRV proxy', 'Not beat-to-beat data: derived from resting heart rate and how much heart rate moves between samples.'],
  ['Stress index', 'How far the last 10 minutes of heart rate sit above resting, combined with the HRV proxy.'],
  ['Sleep', 'The longest block of at least two hours with low heart rate and no new steps.'],
]

/** The NASA evidence, as sections of the landing page (no routes, no network requests). */
export default function NasaEvidence() {
  return (
    <>
      <section id="evidence" className="lp-section ns" aria-labelledby="ns-h">
        <div className="ns-hero">
          <div className="ns-hero-copy">
            <p className="lp-eyebrow">Space-grade evidence</p>
            <h2 className="lp-h2 ns-h" id="ns-h">We read NASA’s research before we labelled a single number.</h2>
            <p className="lp-lead">
              RaHel’s watch reads your pulse with light. When NASA tested heart-rate monitors against a
              12-lead ECG, optical sensors had the most samples outside ±5 bpm. That is why RaHel calls
              wrist heart rate indicative, and why everything derived from it is tagged estimated.
            </p>
            <p className="ns-more">
              <a href="#evidence-sources">See the five NASA sources ↓</a>
              <a href="https://ntrs.nasa.gov/citations/20150021215" target="_blank" rel="noreferrer noopener">
                Read the heart-rate study ↗
              </a>
            </p>
          </div>
          <PublishedFigures />
        </div>
      </section>

      <section className="ns ns-rule" aria-labelledby="ns-rule-h">
        <div className="ns-rule-intro">
          <p className="lp-eyebrow lp-eyebrow-light">What the evidence changed</p>
          <h2 className="lp-h2" id="ns-rule-h">Measured stays measured. Derived is estimated, with a confidence.</h2>
          <p className="lp-lead lp-lead-light">
            The watch measures heart rate and steps. RaHel builds the rest on the server from them, and never lets
            a calculated number pass as a reading. Estimated values carry a confidence of low or
            medium. They are never marked high.
          </p>
        </div>
        <div className="ns-ledger">
          <div className="ns-col ns-col-measured">
            <h3><span className="lp-badge lp-badge-measured">measured</span> Sent by the watch</h3>
            <ul>{MEASURED.map(([n, d]) => <li key={n}><strong>{n}</strong><span>{d}</span></li>)}</ul>
          </div>
          <div className="ns-col ns-col-est">
            <h3><span className="lp-badge lp-badge-estimated">estimated</span> Calculated by RaHel</h3>
            <ul>{ESTIMATED.map(([n, d]) => <li key={n}><strong>{n}</strong><span>{d}</span></li>)}</ul>
          </div>
        </div>
      </section>

      <section id="evidence-sources" className="lp-section ns" aria-labelledby="ns-src-h">
        <p className="lp-eyebrow">Five NASA sources</p>
        <h2 className="lp-h2" id="ns-src-h">What we learned, and how RaHel applies it.</h2>
        <ul className="ns-sources">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <article className="ns-src">
                <p className="ns-src-tag">{s.tag}</p>
                <h3>{s.title}</h3>
                <p className="ns-src-cite">{s.cite}</p>
                <h4>What NASA reports</h4>
                <ul className="ns-learned">{s.learned.map((l) => <li key={l}>{l}</li>)}</ul>
                <div className="ns-applied">
                  <h4>How RaHel applies it</h4>
                  <p>{s.applied}</p>
                </div>
                <p className="ns-src-links">
                  <a href={s.url} target="_blank" rel="noreferrer noopener">{s.url.replace('https://', '')} <i aria-hidden="true">↗</i></a>
                  {s.extra?.map((e) => (
                    <a key={e.url} href={e.url} target="_blank" rel="noreferrer noopener">{e.label} <i aria-hidden="true">↗</i></a>
                  ))}
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section id="limits" className="lp-section ns ns-limits" aria-labelledby="ns-lim-h">
        <p className="lp-eyebrow">Limits</p>
        <h2 className="lp-h2" id="ns-lim-h">What this evidence does not claim.</h2>
        <ul>
          <li>RaHel is not a medical device and does not replace the assessment of a health professional.</li>
          <li>Estimates are indicative. They come from heart rate and steps with heuristic methods and have no clinical validation.</li>
          <li>RaHel has not been validated against NASA data. NASA’s ±5 bpm criterion is a planned yardstick, not a result.</li>
          <li>The chart of published figures reproduces numbers printed in one report. It is not raw data and not our own measurement.</li>
          <li>RaHel is an independent project. It is not endorsed by or affiliated with NASA, and it only cites NASA publications.</li>
        </ul>
        <p className="ns-ai">
          Built with AI assistance: the code and copy of this site were developed with Claude, an AI
          assistant, under the team’s direction.
        </p>
      </section>
    </>
  )
}
