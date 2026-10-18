import { useState } from 'react'
import { authApi, setStoredToken, type AuthUser } from '../api/auth'

type Props = {
  onAuthenticated: (token: string, user: AuthUser) => void
}

export function AuthPanel({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const result =
        mode === 'login'
          ? await authApi.login(email, password)
          : await authApi.register(email, password, displayName || undefined)
      setStoredToken(result.token)
      onAuthenticated(result.token, result.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card wide auth-card">
      <h2>{mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}</h2>
      <form className="auth-form" onSubmit={(e) => void submit(e)}>
        {mode === 'register' && (
          <label>
            Nombre
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Opcional"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="warn">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? '…' : mode === 'login' ? 'Entrar' : 'Registrarse'}
        </button>
      </form>
      <button
        type="button"
        className="linkish"
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
      >
        {mode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
      </button>
    </section>
  )
}
