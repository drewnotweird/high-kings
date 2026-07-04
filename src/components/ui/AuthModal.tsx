import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../store/gameStore'

type AuthScreen = 'login' | 'signup' | 'confirm' | 'username' | 'forgot'

export function AuthModal({ onClose, initialScreen = 'login' }: {
  onClose: () => void
  initialScreen?: AuthScreen
}) {
  const [screen, setScreen] = useState<AuthScreen>(initialScreen)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const { setAuth, setUsername: storeSetUsername } = useGameStore()

  const clearError = () => setError(null)

  const handleLogin = async () => {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    // onAuthStateChange in App.tsx handles profile fetch and setAuth
    onClose()
  }

  const handleSignup = async () => {
    setLoading(true); setError(null)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) setAuth(data.user.id, null)
    setScreen('confirm')
    setLoading(false)
  }

  const handleUsername = async () => {
    const trimmed = username.trim()
    if (!trimmed || trimmed.length < 3) { setError('Must be at least 3 characters'); return }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) { setError('Letters, numbers and underscores only'); return }
    setLoading(true); setError(null)
    const { userId } = useGameStore.getState()
    if (!userId) { setError('Session lost — please sign in again'); setLoading(false); return }
    const { error } = await supabase.from('profiles').upsert({ id: userId, username: trimmed })
    if (error) {
      setError(error.message.includes('unique') ? 'That name is taken' : error.message)
      setLoading(false); return
    }
    storeSetUsername(trimmed)
    setLoading(false)
    onClose()
  }

  const handleForgot = async () => {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL,
    })
    if (error) { setError(error.message); setLoading(false); return }
    setForgotSent(true)
    setLoading(false)
  }

  return (
    <div className="auth-modal-overlay" onClick={screen === 'username' ? undefined : onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>

        {screen === 'login' && (
          <>
            <h2 className="auth-modal__title">Log In</h2>
            <input className="auth-modal__input" type="email" placeholder="Email" value={email}
              onChange={e => { setEmail(e.target.value); clearError() }} autoComplete="email" />
            <input className="auth-modal__input" type="password" placeholder="Password" value={password}
              onChange={e => { setPassword(e.target.value); clearError() }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password" />
            {error && <p className="auth-modal__error">{error}</p>}
            <button className="auth-modal__btn auth-modal__btn--primary" onClick={handleLogin} disabled={loading}>
              {loading ? 'Logging in…' : 'Log In'}
            </button>
            <button className="auth-modal__btn auth-modal__btn--ghost" onClick={() => { setScreen('forgot'); clearError() }}>
              Forgot password?
            </button>
            <button className="auth-modal__btn auth-modal__btn--ghost" onClick={() => { setScreen('signup'); clearError() }}>
              Create Account
            </button>
          </>
        )}

        {screen === 'signup' && (
          <>
            <h2 className="auth-modal__title">Create Account</h2>
            <input className="auth-modal__input" type="email" placeholder="Email" value={email}
              onChange={e => { setEmail(e.target.value); clearError() }} autoComplete="email" />
            <input className="auth-modal__input" type="password" placeholder="Password (min 6 chars)" value={password}
              onChange={e => { setPassword(e.target.value); clearError() }}
              onKeyDown={e => e.key === 'Enter' && handleSignup()} autoComplete="new-password" />
            {error && <p className="auth-modal__error">{error}</p>}
            <button className="auth-modal__btn auth-modal__btn--primary" onClick={handleSignup} disabled={loading}>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
            <button className="auth-modal__btn auth-modal__btn--ghost" onClick={() => { setScreen('login'); clearError() }}>
              Back to Log In
            </button>
          </>
        )}

        {screen === 'confirm' && (
          <>
            <h2 className="auth-modal__title">Check Your Email</h2>
            <p className="auth-modal__subtitle">
              We've sent a confirmation link to <strong style={{ color: '#c8a860' }}>{email}</strong>.
              Click it to activate your account, then come back and sign in.
            </p>
            <button className="auth-modal__btn auth-modal__btn--primary" onClick={onClose}>
              Got it
            </button>
            <button className="auth-modal__btn auth-modal__btn--ghost" onClick={() => { setScreen('login'); clearError() }}>
              Log In
            </button>
          </>
        )}

        {screen === 'username' && (
          <>
            <h2 className="auth-modal__title">Choose a Name</h2>
            <p className="auth-modal__subtitle">How you'll appear on the leaderboard</p>
            <input className="auth-modal__input" type="text" placeholder="Username" value={username}
              onChange={e => { setUsername(e.target.value); clearError() }}
              onKeyDown={e => e.key === 'Enter' && handleUsername()}
              autoComplete="off" maxLength={20} autoFocus />
            {error && <p className="auth-modal__error">{error}</p>}
            <button className="auth-modal__btn auth-modal__btn--primary" onClick={handleUsername} disabled={loading}>
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </>
        )}

        {screen === 'forgot' && (
          <>
            <h2 className="auth-modal__title">Reset Password</h2>
            {forgotSent ? (
              <p className="auth-modal__subtitle">Check your email for a reset link.</p>
            ) : (
              <>
                <input className="auth-modal__input" type="email" placeholder="Email" value={email}
                  onChange={e => { setEmail(e.target.value); clearError() }}
                  onKeyDown={e => e.key === 'Enter' && handleForgot()} autoComplete="email" />
                {error && <p className="auth-modal__error">{error}</p>}
                <button className="auth-modal__btn auth-modal__btn--primary" onClick={handleForgot} disabled={loading}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </>
            )}
            <button className="auth-modal__btn auth-modal__btn--ghost" onClick={() => { setScreen('login'); clearError() }}>
              Back to Log In
            </button>
          </>
        )}

      </div>
      {screen !== 'username' && (
        <button className="ui-button ui-button--menu auth-modal__cancel" onClick={onClose}>
          <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
          <span className="ui-button__label">Close</span>
        </button>
      )}
    </div>
  )
}
