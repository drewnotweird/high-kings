// Ambient effect sprites and the shared icon-button set (extracted from App.tsx)

export function Mist({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        borderRadius: '50%',
        background: 'radial-gradient(ellipse, rgba(220,200,180,0.9) 0%, transparent 70%)',
        filter: 'blur(28px)',
        animation: 'mistDrift var(--dur) ease-in-out infinite',
        ...style,
      }}
    />
  )
}

export const mists = Array.from({ length: 7 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  return {
    id: i,
    left: `${5 + (i / 7) * 90 + r(8)}%`,
    bottom: `${2 + Math.random() * 22}%`,
    width: `${180 + Math.random() * 200}px`,
    height: `${60 + Math.random() * 60}px`,
    dur: `${7 + Math.random() * 8}s`,
    delay: `${-Math.random() * 14}s`,
    mx: `${r(80)}px`,
    peak: `${0.12 + Math.random() * 0.1}`,
  }
})

export function Ember({ style, variant }: { style: React.CSSProperties; variant: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 0.5,
        height: 14,
        borderRadius: 0,
        background: 'linear-gradient(to top, rgba(255,136,0,0.6), rgba(255,221,128,0.4))',
        boxShadow: '0 0 1px 0.5px rgba(255,120,0,0.3)',
        animationName: `ember${variant}`,
        animationTimingFunction: 'ease-in-out',
        animationIterationCount: 'infinite',
        animationFillMode: 'both',
        ...style,
      }}
    />
  )
}

export const embers = Array.from({ length: 12 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  const riseVal = -(280 + Math.random() * 320)
  const dx1Val = r(60), dx2Val = r(90), dx3Val = r(50)

  // Angle of travel at each waypoint (degrees from vertical)
  // Segment 0→30%: heading (dx1, rise*0.3)
  const a1 = Math.atan2(dx1Val, -riseVal * 0.3) * (180 / Math.PI)
  // Segment 30→60%: heading (dx2-dx1, rise*0.35)
  const a2 = Math.atan2(dx2Val - dx1Val, -riseVal * 0.35) * (180 / Math.PI)
  // Segment 60→100%: heading (dx3-dx2, rise*0.4)
  const a3 = Math.atan2(dx3Val - dx2Val, -riseVal * 0.4) * (180 / Math.PI)

  return {
    id: i,
    left: `${10 + (i / 12) * 80 + r(6)}%`,
    bottom: `${5 + Math.random() * 18}%`,
    dur: `${0.7 + Math.random() * 1.1}s`,
    delay: `${-Math.random() * 8}s`,
    rise: `${riseVal}px`,
    dx1: `${dx1Val}px`,
    dx2: `${dx2Val}px`,
    dx3: `${dx3Val}px`,
    a1: `${a1.toFixed(1)}deg`,
    a2: `${a2.toFixed(1)}deg`,
    a3: `${a3.toFixed(1)}deg`,
    variant: i % 3,
  }
})

const base_url = import.meta.env.BASE_URL

export function HintButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--hint" aria-label="Hint" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/hint.svg`} alt="" />
      <span className="ui-button__label">Hint</span>
    </button>
  )
}

export function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--undo" aria-label="Undo move" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/undo.svg`} alt="" />
      <span className="ui-button__label">Undo</span>
    </button>
  )
}

export function MenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button className="ui-button ui-button--menu" aria-label="Game setup" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/${isOpen ? 'close' : 'setup'}.svg`} alt="" />
      <span className="ui-button__label">{isOpen ? 'Close' : 'Setup'}</span>
    </button>
  )
}

export function ProfileButton({ onClick, loggedIn }: { onClick: () => void; loggedIn: boolean }) {
  return (
    <button className="ui-button ui-button--profile" aria-label="Profile" onClick={onClick} style={{ position: 'relative' }}>
      <img className="ui-button__icon" src={`${base_url}icons/${loggedIn ? 'profile' : 'login'}.svg`} alt="" />
      <span className="ui-button__label">{loggedIn ? 'Profile' : 'Login'}</span>
      {loggedIn && <span className="ui-button__profile-dot" />}
    </button>
  )
}

export function GamesButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--games" aria-label="Online games lobby" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/games.svg`} alt="" />
      <span className="ui-button__label">Games</span>
    </button>
  )
}

export function HowToPlayButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--howtoplay" aria-label="How to play" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/rules.svg`} alt="" />
      <span className="ui-button__label">Rules</span>
    </button>
  )
}

export function CreditsButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--credits" aria-label="Credits" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/makers.svg`} alt="" />
      <span className="ui-button__label">Makers</span>
    </button>
  )
}

export function LeaderboardButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--leaderboard" aria-label="Leaderboard" onClick={onClick}>
      <img className="ui-button__icon" src={`${base_url}icons/ranks.svg`} alt="" />
      <span className="ui-button__label">Ranks</span>
    </button>
  )
}

export function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`settings-toggle settings-toggle--${on ? 'on' : 'off'}`} role="switch" aria-checked={on} aria-label="Toggle" onClick={onClick}>
      <span className="settings-toggle__knob" />
    </button>
  )
}

export function Cycler<T extends string>({ options, value, onChange, isDisabled }: {
  options: T[]
  value: T
  onChange: (v: T) => void
  isDisabled?: (v: T) => boolean
}) {
  const enabled = isDisabled ? options.filter(o => !isDisabled(o)) : options
  const ei = enabled.indexOf(value)
  const prev = () => { if (enabled.length > 0) onChange(enabled[(ei - 1 + enabled.length) % enabled.length]) }
  const next = () => { if (enabled.length > 0) onChange(enabled[(ei + 1) % enabled.length]) }
  const valueDisabled = isDisabled?.(value) ?? false
  return (
    <div className="settings-cycler">
      <button className="settings-cycler__arrow" aria-label="Previous option" onClick={prev} disabled={enabled.length <= 1}>&#8249;</button>
      <span className="settings-cycler__value" style={{ opacity: valueDisabled ? 0.35 : 1 }}>{value}</span>
      <button className="settings-cycler__arrow" aria-label="Next option" onClick={next} disabled={enabled.length <= 1}>&#8250;</button>
    </div>
  )
}
