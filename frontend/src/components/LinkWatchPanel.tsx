import { useState } from 'react'
import { authApi, type DeviceSummary } from '../api/auth'

const CLAIM_ERRORS: Record<string, string> = {
  code_not_found: 'Ese código no existe. Revisa el que muestra el reloj.',
  code_expired: 'El código venció. Abre la pantalla de vinculación del reloj para ver uno nuevo.',
  code_already_used: 'Ese código ya se usó. Pide uno nuevo en el reloj.',
  device_already_paired: 'Ese reloj ya está vinculado a otra cuenta.',
  claim_locked: 'Demasiados intentos fallidos. Espera unos minutos y vuelve a intentar.',
  too_many_requests: 'Demasiados intentos. Espera un momento.',
}

type Props = {
  token: string
  devices: DeviceSummary[]
  onLinked: () => void
}

export function LinkWatchPanel({ token, devices, onLinked }: Props) {
  const [primaryCode, setPrimaryCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function unpair(deviceId: string) {
    setError(null)
    try {
      await authApi.unpair(token, deviceId)
      onLinked()
    } catch {
      setError('No se pudo desvincular el reloj.')
    }
  }

  async function claim(e: React.FormEvent) {
    e.preventDefault()
    const primary = primaryCode.replace(/\D/g, '')
    if (primary.length !== 6) {
      setError('Ingresa el código de 6 dígitos del reloj')
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
      setError(CLAIM_ERRORS[key] ?? 'No se pudo vincular. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card wide">
      <h2>Vincular reloj</h2>
      <p className="muted">
        En el reloj aparece un código grande para vincular y, debajo, un <strong>código de
        respaldo</strong> que se renueva solo y confirma que el dispositivo tiene enlace activo (no
        hace falta escribirlo aquí).
      </p>
      <form className="auth-form" onSubmit={(e) => void claim(e)}>
        <label>
          Código del reloj
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="123456"
            value={primaryCode}
            onChange={(e) => setPrimaryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
        </label>
        {error && <p className="warn">{error}</p>}
        <button type="submit" disabled={loading || primaryCode.length !== 6}>
          {loading ? 'Vinculando…' : 'Vincular / re-sincronizar'}
        </button>
      </form>
      {devices.length > 0 && (
        <ul className="device-list">
          {devices.map((d) => (
            <li key={d.deviceId}>
              <strong>{d.crewMemberId}</strong>
              <span className="muted"> · {new Date(d.pairedAt).toLocaleString()}</span>
              <button type="button" className="linkish" onClick={() => void unpair(d.deviceId)}>
                Desvincular
              </button>
              {d.backupCode && (
                <div className="backup-live">
                  Enlace activo · respaldo <strong>{d.backupCode}</strong>
                  {d.linkExpiresAt != null && (
                    <span className="muted">
                      {' '}
                      (válido hasta {new Date(d.linkExpiresAt).toLocaleTimeString()})
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
