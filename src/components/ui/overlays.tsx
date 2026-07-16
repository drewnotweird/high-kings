import type { PlayerSide, GameMode } from '../../store/gameStore'
import { Ember } from './buttons'
import { DefeatFire } from './DefeatFire'

function PieceIcon({ side }: { side: PlayerSide }) {
  const src = side === 'defender'
    ? `${import.meta.env.BASE_URL}white-piece.webp`
    : `${import.meta.env.BASE_URL}blue-piece.webp`
  return (
    <img className="score-panel__piece-icon" src={src} alt="" />
  )
}

export function ScorePanel({ side, isActive, name, elo }: { side: PlayerSide; isActive: boolean; name?: string; elo?: number }) {
  const isAttacker = side === 'attacker'
  return (
    <div className={`score-panel score-panel--${side}${isActive ? ' score-panel--active' : ''}`} style={{
      padding: 3,
      borderRadius: 8,
      background: isActive
        ? 'linear-gradient(135deg, #f5e070, #c8880a, #e8c040, #a06808)'
        : 'transparent',
      transition: 'background 0.6s ease',
    }}>
      <div className="score-panel__inner score-panel__content" style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: isAttacker ? 'row-reverse' : 'row',
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(4px)',
      }}>
        <PieceIcon side={side} />
        {(name || elo !== undefined) && (
          <div className="score-panel__text" style={{ display: 'flex', flexDirection: 'column', alignItems: isAttacker ? 'flex-end' : 'flex-start', gap: 4 }}>
            {name && <span className="score-panel__name">{name}</span>}
            {elo !== undefined && <span className="score-panel__elo">{elo}</span>}
          </div>
        )}
      </div>
    </div>
  )
}


const winnerEmbers = Array.from({ length: 32 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  const riseVal = -(400 + Math.random() * 500)
  const dx1Val = r(50), dx2Val = r(80), dx3Val = r(40)
  const a1 = Math.atan2(dx1Val, -riseVal * 0.3) * (180 / Math.PI)
  const a2 = Math.atan2(dx2Val - dx1Val, -riseVal * 0.35) * (180 / Math.PI)
  const a3 = Math.atan2(dx3Val - dx2Val, -riseVal * 0.4) * (180 / Math.PI)
  return {
    id: i,
    left: `${10 + (i / 10) * 80 + r(5)}%`,
    bottom: `${2 + Math.random() * 20}%`,
    dur: `${0.8 + Math.random() * 1.2}s`,
    delay: `${-Math.random() * 10}s`,
    rise: `${riseVal}px`,
    dx1: `${dx1Val}px`, dx2: `${dx2Val}px`, dx3: `${dx3Val}px`,
    a1: `${a1.toFixed(1)}deg`, a2: `${a2.toFixed(1)}deg`, a3: `${a3.toFixed(1)}deg`,
    variant: i % 3,
  }
})

export function RepetitionWarning({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="repetition-warning">
      <div className="repetition-warning__box">
        <div className="repetition-warning__icon">⚠️</div>
        <div className="repetition-warning__title">Repeated Position</div>
        <p className="repetition-warning__body">
          This move repeats a board position for the third time. Under the rules of this game, doing so forfeits the game.
        </p>
        <div className="repetition-warning__actions">
          <button className="repetition-warning__btn repetition-warning__btn--cancel" onClick={onCancel}>Go back</button>
          <button className="repetition-warning__btn repetition-warning__btn--confirm" onClick={onConfirm}>Accept loss</button>
        </div>
      </div>
    </div>
  )
}

export function WinnerOverlay({ winner, playerMode, powerSaving, onNewGame, onDismiss }: {
  winner: 'attacker' | 'defender'
  playerMode: GameMode
  powerSaving: boolean
  onNewGame: () => void
  onDismiss: () => void
}) {
  const isPlayer = playerMode === '2player' ? true : (winner === playerMode)
  const isDefeat = !isPlayer && playerMode !== '2player'
  const title = playerMode === '2player' ? 'Victory' : isPlayer ? 'Victory' : 'Defeat'
  const label = winner === 'defender' ? 'Defenders Win' : 'Attackers Win'
  const subtitle = playerMode !== '2player' ? (isPlayer ? 'You Win' : 'You Lose') : null
  return (
    <div className={`winner-overlay${isDefeat ? ' winner-overlay--defeat' : ''}`}>
      {!powerSaving && isDefeat && <DefeatFire />}
      {!powerSaving && !isDefeat && <>
        <div className="winner-overlay__gold1" />
        <div className="winner-overlay__gold2" />
      </>}
      {!powerSaving && winnerEmbers.map(e => (
        <Ember key={e.id} variant={e.variant} style={{
          left: e.left, bottom: e.bottom,
          ['--rise' as string]: e.rise,
          ['--dx1' as string]: e.dx1, ['--dx2' as string]: e.dx2, ['--dx3' as string]: e.dx3,
          ['--a1' as string]: e.a1, ['--a2' as string]: e.a2, ['--a3' as string]: e.a3,
          animationDuration: e.dur,
          animationDelay: e.delay,
        }} />
      ))}
      <div className="winner-overlay__content">
        <p className="winner-overlay__title">{title}</p>
        {subtitle && <p className={`winner-overlay__name winner-overlay__name--${winner}`}>{subtitle}</p>}
        <p style={{ margin: 0, fontSize: 13, letterSpacing: 2, textTransform: 'uppercase', color: '#a09070' }}>{label}</p>
        <button className="menu-overlay__item" style={{ maxWidth: 280 }} onClick={onNewGame}>New Game</button>
        <button className="winner-overlay__dismiss" onClick={onDismiss}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
          </svg>
          <span>Not right now</span>
        </button>
      </div>
    </div>
  )
}

export function RoleSelectOverlay({ onConfirm }: { onConfirm: (mode: GameMode) => void }) {
  return (
    <div className="role-select-overlay">
      <div className="role-select__options">
        <button className="role-select__option" onClick={() => onConfirm('defender')}>
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}white-piece.webp`} alt="" />
          <div className="role-select__option-text">
            <span className="role-select__option-name">Defend</span>
            <span className="role-select__option-desc">Escort the King</span>
          </div>
          <div className="role-select__option-spacer" />
        </button>
        <button className="role-select__option" onClick={() => onConfirm('attacker')}>
          <div className="role-select__option-spacer" />
          <div className="role-select__option-text">
            <span className="role-select__option-name">Attack</span>
            <span className="role-select__option-desc">Capture the King</span>
          </div>
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}blue-piece.webp`} alt="" />
        </button>
      </div>
    </div>
  )
}

export function GuestLoginModal({ onLogin, onClose }: {
  onLogin: () => void
  onClose: () => void
}) {
  return (
    <div className="guest-login-modal__backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="guest-login-modal">
        <div className="guest-login-modal__header">
          <span className="guest-login-modal__title">Online Match</span>
          <button className="guest-login-modal__close" onClick={onClose}>✕</button>
        </div>
        <p className="guest-login-modal__body">Log in to play online and track your match history.</p>
        <div className="guest-login-modal__actions">
          <button className="guest-login-modal__btn guest-login-modal__btn--primary" onClick={onLogin}>Log In / Register</button>
        </div>
      </div>
    </div>
  )
}
