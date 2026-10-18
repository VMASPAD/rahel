import { useId, useState } from 'react'
import { Link2, Unlink, Watch } from 'lucide-react'
import { authApi, type DeviceSummary } from '../api/auth'
import './dashboard.css'

const CLAIM_ERRORS: Record<string, string> = {
  code_not_found: 'We could not find that code. Check the one shown on the watch.',
  code_expired: 'That code has expired. Open the linking screen on the watch to get a new one.',
  code_already_used: 'That code was already used. Get a new one on the watch.',
  device_already_paired: 'That watch is already linked to another account.',
  claim_locked: 'Too many failed attempts. Please wait a few minutes and try again.',
  too_many_requests: 'Too many attempts. Please wait a moment.',
}

type Props = {
  token: string
  devices: DeviceSummary[]
  onLinked: () => void
}

export function LinkWatchPanel({ token, devices, onLinked }: Props) {
  const inputId = useId()
  const errId = useId()
  const [primaryCode, setPrimaryCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [unpairing, setUnpairing] = useState(false)
  const [unpairError, setUnpairError] = useState<string | null>(null)

  async function unpair(deviceId: string) {
    setUnpairError(null)
    setUnpairing(true)
    try {
      await authApi.unpair(token, deviceId)
      setConfirming(null)
      onLinked()
    } catch {
      setUnpairError('We could not unlink the watch. Please try again in a few seconds.')
    } finally {
      setUnpairing(false)
    }
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault()
    const primary = primaryCode.replace(/\D/g, '')
    if (primary.length !== 6) {
      setError('Enter the 6-digit code shown on the watch')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await authApi.claimPairing(token, primary)
      setPrimaryCode('')
      onLinked()
    } catch (err) {
      const key = err instanceof Error ? err.message : ''
      setError(CLAIM_ERRORS[key] ?? 'We could not link the watch. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="link-panel">
      {devices.length > 0 && (
        <ul className="device-list" aria-label="Linked watches">
          {devices.map((d) => (
            <li key={d.deviceId} className="device-card">
              <div className="device-head">
                <span className="device-ico" aria-hidden><Watch size={18} /></span>
                <div className="device-main">
                  <strong>{d.crewMemberId}</strong>
                  <span className="dx-sub">
                    Linked since {new Date(d.pairedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {d.backupCode ? (
                  <span className="dx-chip dx-chip--live"><span className="dx-chip-dot" aria-hidden />Link active</span>
                ) : (
                  <span className="dx-chip dx-chip--idle"><span className="dx-chip-dot" aria-hidden />Waiting</span>
                )}
              </div>
              {d.backupCode && (
                <div className="backup-live">
                  <span>Backup code</span>
                  <strong className="backup-code">{d.backupCode}</strong>
                  {d.linkExpiresAt != null && (
                    <span className="dx-sub">valid until {new Date(d.linkExpiresAt).toLocaleTimeString('en-US')}</span>
                  )}
                </div>
              )}
              {confirming === d.deviceId ? (
                <div className="confirm" role="alertdialog" aria-label="Confirm unlinking">
                  <p>Unlink this watch? It will stop sending data to your account.</p>
                  <div className="confirm-actions">
                    <button type="button" className="dx-btn dx-btn--danger" disabled={unpairing} onClick={() => void unpair(d.deviceId)}>
                      {unpairing ? 'Unlinking…' : 'Yes, unlink'}
                    </button>
                    <button type="button" className="dx-btn dx-btn--ghost" disabled={unpairing} onClick={() => { setConfirming(null); setUnpairError(null) }}>
                      Cancel
                    </button>
                  </div>
                  {unpairError && <p className="dx-msg dx-msg--warn" role="alert">{unpairError}</p>}
                </div>
              ) : (
                <button type="button" className="dx-btn dx-btn--ghost dx-btn--sm" onClick={() => { setConfirming(d.deviceId); setUnpairError(null) }}>
                  <Unlink size={14} aria-hidden /> Unlink
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ol className="steps">
        <li><span>1</span>Open RaHel on the watch and tap "Link".</li>
        <li><span>2</span>Note the large 6-digit code.</li>
        <li><span>3</span>Type it here and press Link.</li>
      </ol>
      <p className="dx-sub">
        The <strong>backup code</strong> shown below it on the watch refreshes by itself and confirms the link is active; you do not need to type it.
      </p>

      <form className="auth-form" onSubmit={(e) => void claim(e)} noValidate>
        <label htmlFor={inputId}>Watch code</label>
        <div className="code-row">
          <input
            id={inputId}
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errId : undefined}
            value={primaryCode}
            onChange={(e) => setPrimaryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <button type="submit" className="dx-btn dx-btn--primary" disabled={loading || primaryCode.length !== 6}>
            <Link2 size={16} aria-hidden />
            {loading ? 'Linking…' : devices.length ? 'Re-sync' : 'Link'}
          </button>
        </div>
        {error && <p id={errId} className="dx-msg dx-msg--warn" role="alert">{error}</p>}
      </form>
    </div>
  )
}

