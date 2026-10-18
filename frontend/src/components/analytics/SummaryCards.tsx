import type { DeviceAnalytics } from '../../api/analytics'
import { fmtDuration, fmtNum, fullDate, relTime } from './format'

const STALE_MS = 5 * 60_000

export function SummaryCards({ device }: { device: DeviceAnalytics }) {
  const now = Date.now()
  const lastAgo = device.lastReceivedAt == null ? null : now - device.lastReceivedAt
  const stale = lastAgo == null || lastAgo > STALE_MS
  const rate = device.samplesPerMinute
  const rateRatio = rate == null ? null : rate / device.nominalSamplesPerMinute

  return (
    <section className="an-cards" aria-label="Resumen del reloj">
      <article className="an-card">
        <h3>Última recepción</h3>
        <p className="an-big" data-tone={stale ? 'warn' : 'live'} title={fullDate(device.lastReceivedAt)}>
          {device.lastReceivedAt == null ? 'Sin datos' : relTime(device.lastReceivedAt)}
        </p>
        <p className="an-sub">
          {device.lastReceivedAt == null
            ? 'El reloj aún no ha enviado ningún lote.'
            : stale
              ? 'Más de 5 min sin lotes: revisa conexión del reloj.'
              : 'El reloj está sincronizando.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Muestras por minuto</h3>
        <p className="an-big" data-tone={rateRatio != null && rateRatio < 0.7 ? 'warn' : 'live'}>
          {rate == null ? '—' : fmtNum(rate)}
          <span className="an-unit"> / min</span>
        </p>
        <p className="an-sub">
          Real (sin huecos) frente a {fmtNum(device.nominalSamplesPerMinute)} / min nominal.{' '}
          {device.gaps24h > 0
            ? `${device.gaps24h} hueco${device.gaps24h === 1 ? '' : 's'} en 24 h (mayor: ${fmtDuration(device.maxGapMs24h)}).`
            : 'Sin huecos en 24 h.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Lotes en 24 h</h3>
        <p className="an-big">
          <span data-tone="live">{device.batchesOk24h}</span>
          <span className="an-unit"> ok · </span>
          <span data-tone={device.batchesRejected24h > 0 ? 'bad' : undefined}>
            {device.batchesRejected24h}
          </span>
          <span className="an-unit"> rechazados</span>
        </p>
        <p className="an-sub">
          {device.batchesRejected24h > 0
            ? 'Hay rechazos: consulta el registro de ingesta para ver el motivo.'
            : 'Sin rechazos de validación.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Lecturas</h3>
        <p className="an-big">
          {device.totalReadings.toLocaleString('es')}
          <span className="an-unit"> total</span>
        </p>
        <p className="an-sub">
          {device.readingsLast24h.toLocaleString('es')} en 24 h
          {device.appVersion ? ` · app ${device.appVersion}` : ''}
        </p>
      </article>
    </section>
  )
}
