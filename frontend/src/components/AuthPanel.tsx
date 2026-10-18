import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, HeartPulse, Watch, ShieldCheck } from 'lucide-react'
import { authApi, setStoredToken, type AuthUser } from '../api/auth'
import './dashboard.css'

type Props = {
  onAuthenticated: (token: string, user: AuthUser) => void
}

const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password. Please check them and try again.',
  email_taken: 'That email already has an account. Try signing in instead.',
  too_many_requests: 'Too many attempts. Please wait a moment and try again.',
}

export function AuthPanel({ onAuthenticated }: Props) {
  const uid = useId()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const register = mode === 'register'

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
      const key = err instanceof Error ? err.message : ''
      setError(AUTH_ERRORS[key] ?? 'We could not sign you in. Please check your details and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dx dx-auth">
      <aside className="dx-auth-brand" aria-hidden>
        <Link to="/" className="dx-brand" tabIndex={-1}>
          <img src="/logo.svg" alt="" width="40" height="40" />
          <span>RaHel</span>
        </Link>
        <h2>Every crew member's pulse, from watch to dashboard.</h2>
        <ul>
          <li><Watch size={18} /> Link a Wear OS watch with a code</li>
          <li><HeartPulse size={18} /> Follow pulse and steps in near real time</li>
          <li><ShieldCheck size={18} /> Automatic assessments and alerts</li>
        </ul>
      </aside>

      <main className="dx-auth-main">
        <section className="dx-auth-card dx-rise" aria-labelledby={`${uid}-t`}>
          <Link to="/" className="dx-auth-back">← Back to home</Link>
          <p className="dx-eyebrow">Crew dashboard</p>
          <h1 id={`${uid}-t`}>{register ? 'Create your account' : 'Welcome back'}</h1>
          <p className="dx-sub">
            {register ? 'Start following your crew in minutes.' : 'Sign in to see your crew.'}
          </p>

          <form className="auth-form" onSubmit={(e) => void submit(e)}>
            {register && (
              <div className="field">
                <label htmlFor={`${uid}-n`}>Name <span className="dx-sub">(optional)</span></label>
                <input
                  id={`${uid}-n`}
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What should we call you?"
                />
              </div>
            )}
            <div className="field">
              <label htmlFor={`${uid}-e`}>Email</label>
              <input
                id={`${uid}-e`}
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`${uid}-p`}>Password</label>
              <div className="field-pw">
                <input
                  id={`${uid}-p`}
                  type={show ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete={register ? 'new-password' : 'current-password'}
                  aria-describedby={`${uid}-h`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="pw-toggle"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  aria-pressed={show}
                >
                  {show ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
                </button>
              </div>
              <span id={`${uid}-h`} className="dx-sub">At least 8 characters.</span>
            </div>
            {error && <p className="dx-msg dx-msg--warn" role="alert">{error}</p>}
            <button type="submit" className="dx-btn dx-btn--primary dx-btn--lg" disabled={loading} aria-busy={loading}>
              {loading ? 'One moment…' : register ? 'Create account' : 'Sign in'}
              {!loading && <ArrowRight size={16} aria-hidden />}
            </button>
          </form>

          <button
            type="button"
            className="linkish"
            onClick={() => { setMode(register ? 'login' : 'register'); setError(null) }}
          >
            {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>
        </section>
      </main>
    </div>
  )
}
