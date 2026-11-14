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
    <section className="an-cards" aria-label="Watch summary">
      <article className="an-card">
        <h3>Last received</h3>
        <p className="an-big" data-tone={stale ? 'warn' : 'live'} title={fullDate(device.lastReceivedAt)}>
          {device.lastReceivedAt == null ? 'No data' : relTime(device.lastReceivedAt)}
        </p>
        <p className="an-sub">
          {device.lastReceivedAt == null
            ? 'The watch has not sent any batch yet.'
            : stale
              ? 'No batches for over 5 min: check the watch connection.'
              : 'The watch is syncing.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Samples per minute</h3>
        <p className="an-big" data-tone={rateRatio != null && rateRatio < 0.7 ? 'warn' : 'live'}>
          {rate == null ? '--' : fmtNum(rate)}
          <span className="an-unit"> / min</span>
        </p>
        <p className="an-sub">
          Actual (excluding gaps) vs. {fmtNum(device.nominalSamplesPerMinute)} / min nominal.{' '}
          {device.gaps24h > 0
            ? `${device.gaps24h} gap${device.gaps24h === 1 ? '' : 's'} in 24 h (longest: ${fmtDuration(device.maxGapMs24h)}).`
            : 'No gaps in 24 h.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Batches in 24 h</h3>
        <p className="an-big">
          <span data-tone="live">{device.batchesOk24h}</span>
          <span className="an-unit"> ok · </span>
          <span data-tone={device.batchesRejected24h > 0 ? 'bad' : undefined}>
            {device.batchesRejected24h}
          </span>
          <span className="an-unit"> rejected</span>
        </p>
        <p className="an-sub">
          {device.batchesRejected24h > 0
            ? 'Some batches were rejected: see the ingest log for the reason.'
            : 'No validation rejections.'}
        </p>
      </article>
      <article className="an-card">
        <h3>Readings</h3>
        <p className="an-big">
          {device.totalReadings.toLocaleString('en-US')}
          <span className="an-unit"> total</span>
        </p>
        <p className="an-sub">
          {device.readingsLast24h.toLocaleString('en-US')} in 24 h
          {device.appVersion ? ` · app ${device.appVersion}` : ''}
        </p>
      </article>
    </section>
  )
}
