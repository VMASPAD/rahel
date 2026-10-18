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

const BEAT = 'l6 0 l5 -6 l5 6 l4 0 l6 -4 l8 4 l6 0 l3 -9 l5 62 l5 -66 l4 13 l6 0 l8 -9 l8 9'
const ECG_PATH = `M0 80 ${Array.from({ length: 20 }, () => `l36 0 ${BEAT}`).join(' ')} l300 0`

type Kind = 'medido' | 'estimado' | 'no disponible'

const SIGNALS: { name: string; unit: string; kind: Kind; desc: string; wide?: boolean }[] = [
  { name: 'Frecuencia cardíaca', unit: 'lpm', kind: 'medido', desc: 'Latidos por minuto desde el sensor óptico del reloj, cada 30 segundos.' },
  { name: 'Pasos', unit: 'pasos', kind: 'medido', desc: 'Actividad acumulada desde medianoche. Sirve para distinguir reposo de esfuerzo.' },
  { name: 'Saturación de oxígeno', unit: 'SpO₂', kind: 'medido', desc: 'Porcentaje de oxígeno en sangre, en los relojes que lo miden.' },
  { name: 'Pulso en reposo', unit: 'lpm', kind: 'estimado', desc: 'Percentil bajo del pulso de las últimas 24 horas en momentos sin movimiento.' },
  { name: 'Variabilidad (HRV)', unit: 'ms', kind: 'estimado', desc: 'Aproximación desde la dispersión del pulso en reposo. Confianza siempre baja.' },
  { name: 'Sueño', unit: 'horas', kind: 'estimado', desc: 'El bloque más largo de pulso bajo y sin pasos, de al menos 2 horas.' },
  { name: 'Temperatura de piel', unit: '°C', kind: 'no disponible', wide: true, desc: 'Sin sensor propio no hay forma defendible de calcularla. Queda vacía hasta que el reloj la entregue; nunca se sustituye por la del ambiente.' },
]

const FLOW = [
  ['Reloj', 'Lee los sensores y guarda cada muestra en el propio reloj, aunque no haya red.'],
  ['API', 'Valida cada lote, descarta duplicados y lo guarda en una sola transacción.'],
  ['Panel', 'Muestra la última lectura, el historial, la evaluación y el registro de sensores.'],
] as const

const PAIR = [
  ['Abrir RaHel en el reloj', 'La pantalla de vinculación muestra un código de un solo uso.'],
  ['Escribirlo en el panel', 'Entra a tu cuenta, abre «Vincular reloj» y escribe el código antes de que venza.'],
  ['Ver los datos llegar', 'El reloj recibe su propia credencial y empieza a enviar. Sin contraseñas en la muñeca.'],
] as const

const TRUST = [
  ['Cada cuenta, sus relojes', 'Solo ves los tripulantes de los relojes que tú vinculaste. Los demás ni aparecen.'],
  ['Códigos de un solo uso', 'Caducan a los 10 minutos y tras cinco intentos fallidos la cuenta se bloquea un rato.'],
  ['Revocable en un clic', 'Desvincula un reloj desde el panel y su credencial deja de funcionar al instante.'],
] as const

const FAQ = [
  ['¿Funciona sin internet?', 'Sí. El reloj guarda las muestras en una cola y las reenvía cuando vuelve la conexión, sin duplicar lecturas. La cola guarda hasta 5.000 muestras.'],
  ['¿La variabilidad cardíaca es real?', 'Es una estimación. El reloj entrega un pulso cada 30 segundos, no cada latido, así que RaHel la calcula del historial y la marca siempre como «estimado» con su nivel de confianza.'],
  ['¿Qué relojes son compatibles?', 'Relojes con Wear OS 3 o superior (Android 11 en adelante). Qué sensores llegan depende de cada modelo; la analítica te muestra cuáles recibes de verdad.'],
  ['¿Es un dispositivo médico?', 'No. RaHel apoya el seguimiento del equipo, pero no diagnostica ni sustituye la valoración de un profesional de salud.'],
  ['¿Puedo quitar un reloj?', 'Sí. Desde el panel desvinculas el reloj; deja de enviar datos y su credencial se revoca.'],
] as const

const TICKER = [
  'FC 72 lpm',
  'SpO₂ 98 %',
  'HRV 48 ms (est.)',
  'Sueño 7,1 h (est.)',
  'Pasos 6 240',
  'Estrés 18/100 (est.)',
]

export default function Landing() {
  usePageMeta({
    title: 'RaHel · El pulso de cada tripulante, del reloj al panel',
    description:
      'RaHel lee los signos vitales de cada tripulante desde un reloj Wear OS y los ordena en un panel con analítica de sensores. Sin inventar datos: lo medido y lo estimado, separados.',
    path: '/',
  })

  return (
    <div className="lp">
      <header className="lp-nav">
        <Link to="/" className="lp-brand" aria-label="RaHel, inicio">
          <img src="/logo.svg" alt="RaHel" width="44" height="44" />
        </Link>
        <nav aria-label="Principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#senales">Señales</a>
          <a href="#analitica">Analítica</a>
          <a href="#vincular">Vincular</a>
          <Link to="/app" className="lp-nav-cta">Abrir el panel</Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">Monitoreo de salud para tripulaciones · Wear OS</p>
            <SplitText
              tag="h1"
              className="lp-h1"
              text="El pulso de cada tripulante, del reloj al panel."
              splitType="words"
              delay={60}
              duration={0.9}
              trigger="load"
              textAlign="left"
            />
            <p className="lp-lead">
              RaHel lee los signos vitales desde un reloj, los envía de forma segura y los ordena en un
              panel donde el equipo ve quién necesita atención ahora.
            </p>
            <div className="lp-actions">
              <StarBorder as={Link} to="/app" color="#5EE0A0" backgroundColor="#04281A" textColor="#FFE5E7" radius={999}>
                Abrir el panel
              </StarBorder>
              <a className="lp-ghost" href="#vincular">Vincular un reloj</a>
            </div>
          </div>

          <figure className="lp-watch" aria-label="Reloj con lectura de ejemplo">
            <div className="lp-watch-body">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle cx="100" cy="100" r="86" className="lp-ring-bg" />
                <circle cx="100" cy="100" r="86" className="lp-ring" pathLength={100} />
              </svg>
              <div className="lp-watch-face">
                <span className="lp-watch-label">FC</span>
                <b>72</b>
                <span className="lp-watch-unit">lpm</span>
                <span className="lp-watch-dot" aria-hidden="true" />
              </div>
            </div>
            <figcaption>Lectura de ejemplo, no son datos reales</figcaption>
          </figure>

          <figure className="lp-ecg" aria-label="Trazo de pulso de ejemplo">
            <svg viewBox="0 0 2400 160" preserveAspectRatio="none" role="img" aria-hidden="true">
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

        <section className="lp-stats" aria-label="En cifras">
          <div><CountUp to={7} className="lp-num" /><p>señales por reloj, cada una con su origen a la vista</p></div>
          <div><CountUp to={30} className="lp-num" suffix=" s" /><p>entre muestras de pulso desde el reloj</p></div>
          <div><CountUp to={10} className="lp-num" suffix=" min" /><p>de vigencia del código de vinculación</p></div>
        </section>

        <section id="como-funciona" className="lp-section">
          <p className="lp-eyebrow">Cómo funciona</p>
          <h2 className="lp-h2">Tres piezas, un solo recorrido.</h2>
          <ol className="lp-flow">
            {FLOW.map(([t, d], i) => (
              <li key={t}>
                <span className="lp-step" aria-hidden="true">{i + 1}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </li>
            ))}
          </ol>
          <div className="lp-statement">
            <ScrollReveal baseOpacity={0.15} enableBlur={false} baseRotation={0} containerClassName="lp-reveal">
              Lo que el reloj mide se muestra tal cual. Lo que no mide, RaHel lo estima del historial y lo marca como estimado.
            </ScrollReveal>
          </div>
        </section>

        <section id="senales" className="lp-section">
          <p className="lp-eyebrow">Señales</p>
          <h2 className="lp-h2">Cada dato dice de dónde viene.</h2>
          <div className="lp-grid">
            {SIGNALS.map((s) => (
              <SpotlightCard
                key={s.name}
                theme="light"
                spotlightColor="rgba(0, 122, 57, 0.22)"
                className={`lp-card${s.wide ? ' lp-card-wide' : ''}`}
              >
                <div className="lp-card-top">
                  <span className="lp-unit">{s.unit}</span>
                  <span className={`lp-badge lp-badge-${s.kind.replace(' ', '-')}`}>{s.kind}</span>
                </div>
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
              </SpotlightCard>
            ))}
          </div>
        </section>

        <section id="analitica" className="lp-section lp-dark">
          <div className="lp-dark-inner">
            <div className="lp-dark-copy">
              <p className="lp-eyebrow lp-eyebrow-light">Analítica de sensores</p>
              <h2 className="lp-h2">Qué sensores llegan, y cuáles valen la pena.</h2>
              <p className="lp-lead lp-lead-light">
                Un registro de todo lo que recibe RaHel de cada reloj: qué campos llegan, con qué
                cobertura, cuáles son medidos o estimados y qué sensores detecta el reloj aunque no
                entreguen datos. Con eso decides qué conservar y qué descartar.
              </p>
              <Link to="/app/analitica" className="lp-link-light">Ver la analítica →</Link>
            </div>

            <figure className="lp-mock" aria-label="Vista de ejemplo de la analítica de sensores">
              <div className="lp-mock-bar" aria-hidden="true"><i /><i /><i /><span>analitica / campos recibidos</span></div>
              <table>
                <thead>
                  <tr><th scope="col">Campo</th><th scope="col">Cobertura</th><th scope="col">Origen</th><th scope="col">Recomendación</th></tr>
                </thead>
                <tbody>
                  <tr><td>Frecuencia cardíaca</td><td><span className="lp-bar"><i style={{ width: '98%' }} /></span><em>98 %</em></td><td><span className="lp-badge lp-badge-medido">medido</span></td><td>Mantener</td></tr>
                  <tr><td>Pasos</td><td><span className="lp-bar"><i style={{ width: '96%' }} /></span><em>96 %</em></td><td><span className="lp-badge lp-badge-medido">medido</span></td><td>Mantener</td></tr>
                  <tr><td>HRV</td><td><span className="lp-bar"><i style={{ width: '71%' }} /></span><em>71 %</em></td><td><span className="lp-badge lp-badge-estimado">estimado</span></td><td>Usar con cautela</td></tr>
                  <tr><td>Sueño</td><td><span className="lp-bar"><i style={{ width: '33%' }} /></span><em>33 %</em></td><td><span className="lp-badge lp-badge-estimado">estimado</span></td><td>Usar con cautela</td></tr>
                  <tr><td>Temp. de piel</td><td><span className="lp-bar"><i style={{ width: '0%' }} /></span><em>0 %</em></td><td><span className="lp-badge lp-badge-no-disponible">no recibido</span></td><td>Requiere sensor</td></tr>
                </tbody>
              </table>
              <figcaption>Vista de ejemplo con datos ficticios</figcaption>
            </figure>
          </div>
        </section>

        <section className="lp-section">
          <p className="lp-eyebrow">Seguridad</p>
          <h2 className="lp-h2">Datos de salud, bajo llave.</h2>
          <ul className="lp-trust">
            {TRUST.map(([t, d]) => (
              <li key={t}><h3>{t}</h3><p>{d}</p></li>
            ))}
          </ul>
        </section>

        <section id="vincular" className="lp-section lp-pair">
          <div>
            <p className="lp-eyebrow">Vincular un reloj</p>
            <h2 className="lp-h2">Del reloj a tu cuenta en tres pasos.</h2>
            <p className="lp-lead">
              El código es de un solo uso y caduca. Quien no tenga el reloj en la mano no puede vincularlo.
            </p>
          </div>
          <ol className="lp-pair-list">
            {PAIR.map(([t, d], i) => (
              <li key={t}>
                <span className="lp-step" aria-hidden="true">{i + 1}</span>
                <div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ol>
        </section>

        <section id="preguntas" className="lp-section">
          <p className="lp-eyebrow">Preguntas frecuentes</p>
          <h2 className="lp-h2">Lo que suelen preguntar.</h2>
          <div className="lp-faq">
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
          <h2 className="lp-h2">Ver a tu tripulación ahora.</h2>
          <StarBorder as={Link} to="/app" color="#5EE0A0" backgroundColor="#04281A" textColor="#FFE5E7" radius={999}>
            Abrir el panel
          </StarBorder>
        </section>
      </main>

      <footer className="lp-foot">
        <span><img src="/logo.svg" alt="" width="24" height="24" /> RaHel · Hackathon NASA</span>
        <span>
          <Link to="/app">Panel</Link>
        </span>
      </footer>
    </div>
  )
}
