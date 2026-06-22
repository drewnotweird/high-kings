import { useState, useEffect, useRef } from 'react'
import { Scene, INTRO_DURATION_MS } from './components/board/Scene'
import { Board2D } from './components/board/Board2D'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'
import { useGameStore } from './store/gameStore'
import type { PlayerSide, Difficulty, Rules } from './store/gameStore'

const fireCSS = `
body, button, input, select {
  font-family: 'MedievalSharp', serif;
}
@keyframes sceneFadeIn {
  0%   { opacity: 0; }
  100% { opacity: 1; }
}
@keyframes fireFlicker {
  0%   { opacity: 0.35; }
  25%  { opacity: 0.45; }
  50%  { opacity: 0.30; }
  75%  { opacity: 0.42; }
  100% { opacity: 0.35; }
}
@keyframes ember0 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  8%   { opacity:1; }
  30%  { transform: translate(var(--dx1),calc(var(--rise)*0.3)) rotate(var(--a1)); opacity:0.9; }
  60%  { transform: translate(var(--dx2),calc(var(--rise)*0.65))rotate(var(--a2)); opacity:0.5; }
  85%  { opacity:0.15; }
  100% { transform: translate(var(--dx3),var(--rise))            rotate(var(--a3)); opacity:0;  }
}
@keyframes ember1 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  6%   { opacity:1; }
  25%  { transform: translate(var(--dx2),calc(var(--rise)*0.25))rotate(var(--a2)); opacity:0.8; }
  55%  { transform: translate(var(--dx1),calc(var(--rise)*0.60))rotate(var(--a1)); opacity:0.4; }
  80%  { opacity:0.1; }
  100% { transform: translate(var(--dx3),var(--rise))            rotate(var(--a3)); opacity:0;  }
}
@keyframes ember2 {
  0%   { transform: translate(0px,0px)                           rotate(0deg);    opacity:0;    }
  10%  { opacity:1; }
  40%  { transform: translate(var(--dx3),calc(var(--rise)*0.40))rotate(var(--a3)); opacity:0.7; }
  70%  { transform: translate(var(--dx1),calc(var(--rise)*0.70))rotate(var(--a1)); opacity:0.3; }
  90%  { opacity:0.05; }
  100% { transform: translate(var(--dx2),var(--rise))            rotate(var(--a2)); opacity:0;  }
}
.score-panel__inner {
  width: 110px;
  box-sizing: border-box;
  padding: 14px !important;
}
.ui-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 52px;
  height: 52px;
  background: none;
  border: none;
  color: #e8d8b8;
  cursor: pointer;
  font-family: inherit;
  transition: opacity 0.2s;
}
.ui-button:hover { opacity: 0.7; }
.ui-button__icon { width: 22px; height: 22px; flex-shrink: 0; }
.ui-button__label { font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #c8b888; }
.menu-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
  pointer-events: none;
  transition: opacity 0.4s ease;
  overflow: hidden;
}
.menu-overlay--visible { pointer-events: auto; }
.menu-overlay__screens {
  position: relative;
  width: 260px;
}
.menu-overlay__screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: opacity 0.25s ease;
}
.menu-overlay__screen--hidden {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
}
.menu-overlay__item {
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 6px;
  color: #e8d8b8;
  padding: 14px 48px;
  font-size: 14px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font-family: inherit;
  width: 260px;
  text-align: center;
  box-sizing: border-box;
}
.menu-overlay__item:hover { border-color: rgba(200,160,40,0.9); background: rgba(30,15,0,0.9); }
.settings-panel {
  width: 260px;
  background: rgba(0,0,0,0.88);
  border: 1px solid rgba(200,160,40,0.35);
  border-radius: 8px;
  overflow: hidden;
}
.settings-panel__header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(200,160,40,0.2);
  cursor: pointer;
  transition: background 0.2s;
}
.settings-panel__header:hover { background: rgba(200,160,40,0.06); }
.settings-panel__back {
  color: #c8b888;
  display: flex;
  align-items: center;
}
.settings-panel__title {
  font-size: 13px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #e8d8b8;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  gap: 12px;
}
.settings-row:last-child { border-bottom: none; }
.settings-row__label {
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #c8b888;
  flex-shrink: 0;
}
.credits-scroll-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 10px;
  overflow: hidden;
}
.credits-scroll-overlay__scrim {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: #000;
  animation: creditsOverlayIn 0.4s ease-out forwards;
}
.credits-scroll-overlay--closing .credits-scroll-overlay__scrim {
  animation: creditsOverlayOut 0.6s ease-in forwards;
}
@keyframes creditsOverlayIn { from { opacity:0 } to { opacity:1 } }
@keyframes creditsOverlayOut { from { opacity:1 } to { opacity:0 } }
.credits-scroll {
  position: relative;
  z-index: 1;
  max-width: 460px;
  width: 100%;
  flex-shrink: 0;
  filter: drop-shadow(0 16px 48px rgba(0,0,0,0.85));
  animation: creditsScrollEnter 0.55s cubic-bezier(0.2,0.8,0.3,1) forwards;
}
.credits-scroll--closing {
  animation: creditsScrollExit 0.5s cubic-bezier(0.6,0,0.85,0.4) 0.9s forwards;
}
@keyframes creditsScrollEnter {
  from { transform: translateY(-120px); }
  to   { transform: translateY(0); }
}
@keyframes creditsScrollExit {
  from { transform: translateY(0); }
  to   { transform: translateY(-110vh); }
}
@keyframes creditsUnroll {
  from { max-height: 0; }
  to   { max-height: 100vh; }
}
@keyframes creditsRollUp {
  from { max-height: 100vh; }
  to   { max-height: 0; }
}
.credits-scroll__top-roll {
  position: relative;
  z-index: 2;
  height: 120px;
}
.credits-scroll__parchment {
  position: relative;
  z-index: 1;
  overflow: hidden;
  margin-top: -25px;
  padding: 30px 40px 20px 40px;
  display: flex;
  align-items: flex-end;
  animation: creditsUnroll 2.5s cubic-bezier(0.15,0.6,0.1,0.97) 0.25s both;
}
.credits-scroll--closing .credits-scroll__parchment {
  animation: creditsRollUp 1s cubic-bezier(0.7,0,0.9,0.4) forwards;
}
.credits-scroll__content {
  opacity: 1;
}
.credits-scroll__scroll-title {
  text-align: center;
  font-size: 20px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 0 0 5px;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0,0,0,0.15);
}
.credits-scroll__era {
  text-align: center;
  font-size: 11px;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #6b3e12;
  margin: 0 0 18px;
  font-style: italic;
}
.credits-scroll__rule {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(60,28,0,0.35) 20%, rgba(60,28,0,0.35) 80%, transparent);
  margin: 0 0 18px;
}
.credits-scroll__body-text {
  font-family: 'MedievalSharp', serif;
  font-size: 18px;
  line-height: 1.85;
  color: #3d2008;
  margin: 0 0 22px;
  text-align: center;
}
.credits-scroll__names {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0 0 26px;
}
.credits-scroll__name {
  font-family: 'MedievalSharp', serif;
  font-size: 16px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
}
.credits-scroll__close-btn {
  display: block;
  margin: 0 auto;
  background: transparent;
  border: 1px solid rgba(60,28,0,0.4);
  color: #3d2008;
  font-family: 'MedievalSharp', serif;
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 8px 22px;
  border-radius: 1px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.credits-scroll__close-btn:hover { background: rgba(60,28,0,0.12); border-color: rgba(60,28,0,0.6); }
@media (min-width: 768px) {
  .credits-scroll__body-text { font-size: 22px; }
  .credits-scroll__name { font-size: 20px; }
  .credits-scroll__close-btn { font-size: 16px; }
  .credits-scroll__parchment { padding: 40px 50px 20px 50px; }
}
.credits-scroll__torn {
  position: absolute;
  bottom: -1px;
  left: -1px;
  width: calc(100% + 2px);
  height: 40px;
  pointer-events: none;
  display: block;
}
.settings-toggle {
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.settings-toggle--on { background: rgba(200,160,40,0.7); }
.settings-toggle--off { background: rgba(255,255,255,0.15); }
.settings-toggle__knob {
  position: absolute;
  top: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.settings-toggle--on .settings-toggle__knob { left: 21px; }
.settings-toggle--off .settings-toggle__knob { left: 3px; }
.settings-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}
.settings-chip {
  font-size: 10px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid rgba(200,160,40,0.3);
  background: transparent;
  color: #9a8a6a;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  font-family: inherit;
  white-space: nowrap;
}
.settings-chip--active {
  background: rgba(200,160,40,0.25);
  border-color: rgba(200,160,40,0.8);
  color: #e8d8b8;
}
@media (min-width: 1024px) {
  .score-panel__inner {
    flex-direction: column !important;
    align-items: center;
    gap: 4px;
  }
  .score-panel-wrapper--defender {
    left: 6vw !important;
    right: auto !important;
    bottom: calc(50vh - 45px) !important;
  }
  .score-panel-wrapper--attacker {
    right: 6vw !important;
    left: auto !important;
    bottom: calc(50vh - 45px) !important;
  }
}
@keyframes mistDrift {
  0%   { transform: translateX(0px)   translateY(0px);  opacity: 0;    }
  15%  { opacity: var(--peak); }
  50%  { transform: translateX(var(--mx)) translateY(-18px); opacity: var(--peak); }
  85%  { opacity: var(--peak); }
  100% { transform: translateX(calc(var(--mx) * 2)) translateY(-30px); opacity: 0; }
}
`

function Mist({ style }: { style: React.CSSProperties }) {
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

const mists = Array.from({ length: 7 }, (_, i) => {
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

function Ember({ style, variant }: { style: React.CSSProperties; variant: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 0.5,
        height: 14,
        borderRadius: 0,
        background: 'linear-gradient(to top, rgba(255,136,0,0.6), rgba(255,221,128,0.4))',
        boxShadow: '0 0 1px 0.5px rgba(255,120,0,0.3)',
        animation: `ember${variant} var(--dur) ease-in-out infinite`,
        ...style,
      }}
    />
  )
}

const embers = Array.from({ length: 12 }, (_, i) => {
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

function HintButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--hint" onClick={onClick}>
      <svg className="ui-button__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="10" cy="10" r="8" />
        <path d="M10 6v.5M10 9.5c0-1 1.5-1.5 1.5-3a2.5 2.5 0 00-5 0" strokeLinecap="round" />
        <circle cx="10" cy="13.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <span className="ui-button__label">Hint</span>
    </button>
  )
}

function MenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button className="ui-button ui-button--menu" onClick={onClick}>
      <svg className="ui-button__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {isOpen
          ? <><line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" /></>
          : <><line x1="3" y1="6" x2="17" y2="6" /><line x1="3" y1="10" x2="17" y2="10" /><line x1="3" y1="14" x2="17" y2="14" /></>
        }
      </svg>
      <span className="ui-button__label">{isOpen ? 'Close' : 'Menu'}</span>
    </button>
  )
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className={`settings-toggle settings-toggle--${on ? 'on' : 'off'}`} onClick={onClick}>
      <span className="settings-toggle__knob" />
    </button>
  )
}

function Chips<T extends string>({ options, value, onChange }: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="settings-chips">
      {options.map(o => (
        <button
          key={o}
          className={`settings-chip${value === o ? ' settings-chip--active' : ''}`}
          onClick={() => onChange(o)}
        >{o}</button>
      ))}
    </div>
  )
}


function CreditsScroll({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 1500)
  }
  return (
    <div className={`credits-scroll-overlay${closing ? ' credits-scroll-overlay--closing' : ''}`} onClick={handleClose} style={{ cursor: 'pointer' }}>
      <div className="credits-scroll-overlay__scrim" />
      <div className={`credits-scroll${closing ? ' credits-scroll--closing' : ''}`}>
        <div className="credits-scroll__top-roll" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}topscroll.png)`, backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'bottom' }} />
        <div className="credits-scroll__parchment" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}pagescroll.png)`, backgroundSize: 'cover', backgroundPosition: 'bottom' }}>
          <div className="credits-scroll__content">
            <p className="credits-scroll__body-text">
              High Kings was originally forged around 2010 by three warriors who wanted to bring an ancient Viking strategy game to life. They had an enormous amount of fun building it together, and this site was created to appease the Gods.
            </p>
            <div className="credits-scroll__names">
              <span className="credits-scroll__name">Jason Frame</span>
              <span className="credits-scroll__name">Lewis MacKenzie</span>
              <span className="credits-scroll__name">Andrew Nicolson</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

function MenuOverlay({ isOpen, isVisible, onResume, onNewGame, onCredits }: {
  isOpen: boolean
  isVisible: boolean
  onResume: () => void
  onNewGame: () => void
  onCredits: () => void
}) {
  const [screen, setScreen] = useState<'main' | 'settings'>('main')
  const { musicEnabled, cameraLocked, difficulty, rules, powerSaving, setSetting } = useGameStore()

  useEffect(() => { if (!isOpen) setScreen('main') }, [isOpen])

  if (!isOpen) return null

  return (
    <>
    <div className={`menu-overlay${isVisible ? ' menu-overlay--visible' : ''}`} style={{ opacity: isVisible ? 1 : 0 }}>
      <div className="menu-overlay__screens">

        {/* Main screen */}
        <div className={`menu-overlay__screen${screen !== 'main' ? ' menu-overlay__screen--hidden' : ''}`}>
          <button className="menu-overlay__item" onClick={onResume}>Resume Game</button>
          <button className="menu-overlay__item" onClick={() => setScreen('settings')}>Settings</button>
          <button className="menu-overlay__item" onClick={onNewGame}>New Game</button>
          <button className="menu-overlay__item">How to Play</button>
          <button className="menu-overlay__item" onClick={onCredits}>Credits</button>
          <button className="ui-button ui-button--menu" onClick={onResume} style={{ marginTop: 16 }}>
            <svg className="ui-button__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="16" y2="16" /><line x1="16" y1="4" x2="4" y2="16" />
            </svg>
            <span className="ui-button__label">Close</span>
          </button>
        </div>

        {/* Settings screen */}
        <div className={`menu-overlay__screen${screen !== 'settings' ? ' menu-overlay__screen--hidden' : ''}`}>
          <div className="settings-panel">
            <div className="settings-panel__header" onClick={() => setScreen('main')}>
              <span className="settings-panel__back">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 3L5 8l5 5" />
                </svg>
              </span>
              <span className="settings-panel__title">Settings</span>
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Power Saving</span>
              <Toggle on={powerSaving} onClick={() => setSetting('powerSaving', !powerSaving)} />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">View</span>
              <Chips<'Free' | 'Top-down'>
                options={['Free', 'Top-down']}
                value={powerSaving ? 'Top-down' : cameraLocked ? 'Top-down' : 'Free'}
                onChange={v => {
                  if (v === 'Top-down') {
                    setSetting('cameraLocked', true)
                  } else {
                    setSetting('cameraLocked', false)
                    setSetting('powerSaving', false)
                  }
                }}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Music</span>
              <Toggle on={musicEnabled} onClick={() => setSetting('musicEnabled', !musicEnabled)} />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Difficulty</span>
              <Chips<Difficulty>
                options={['easy', 'medium', 'hard']}
                value={difficulty}
                onChange={v => setSetting('difficulty', v)}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Rules</span>
              <Chips<Rules>
                options={['Copenhagen', 'Fetlar', 'Tablut', 'Historical']}
                value={rules}
                onChange={v => setSetting('rules', v)}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  )
}

function PieceIcon({ side }: { side: PlayerSide }) {
  const src = side === 'defender'
    ? `${import.meta.env.BASE_URL}white-piece.png`
    : `${import.meta.env.BASE_URL}blue-piece.png`
  return (
    <img className="score-panel__piece-icon" src={src} alt="" style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
  )
}

function ScorePanel({ side, score, isActive }: { side: PlayerSide; score: number; isActive: boolean }) {
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
      <div className="score-panel__inner" style={{
        display: 'flex',
        alignItems: 'center',
        flexDirection: isAttacker ? 'row-reverse' : 'row',
        gap: 10,
        background: 'rgba(0,0,0,0.85)',
        borderRadius: 6,
        padding: '8px 14px',
        backdropFilter: 'blur(4px)',
        minWidth: 60,
      }}>
        <PieceIcon side={side} />
        <span className="score-panel__score" style={{ color: '#e8d8b8', fontSize: 18, fontWeight: 600, letterSpacing: 1 }}>{score}</span>
      </div>
    </div>
  )
}

function App() {
  const [introStarted, setIntroStarted] = useState(false)
  const [uiVisible, setUiVisible] = useState(false)
  const [setupAnimating, setSetupAnimating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const { currentTurn, scores, resetGame, powerSaving, setSetting } = useGameStore()
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ?ps=true in the URL activates power-saving mode on load
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ps') === 'true') {
      setSetting('powerSaving', true)
    }
  }, [])

  const startSetupAnim = () => {
    if (setupTimerRef.current) clearTimeout(setupTimerRef.current)
    setSetupAnimating(true)
    setupTimerRef.current = setTimeout(() => setSetupAnimating(false), INTRO_DURATION_MS)
  }

  // In power-saving mode there's no 3D intro — show UI immediately
  useEffect(() => {
    if (powerSaving && !introStarted) setIntroStarted(true)
  }, [powerSaving])

  // Track when the sceneFadeIn animation completes so buttons start visibly disabled
  useEffect(() => {
    const t = setTimeout(() => setUiVisible(true), powerSaving ? 0 : 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      // Power-saving has no board-flip delay, so show menu instantly
      const delay = powerSaving ? 0 : 500
      const t = setTimeout(() => setMenuVisible(true), delay)
      return () => clearTimeout(t)
    } else {
      setMenuVisible(false)
    }
  }, [menuOpen, powerSaving])

  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>
      <style>{fireCSS}</style>

      {!powerSaving && <>
        {/* Steady dark base — only fades in once loader finishes */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 50% 65%, #2a1200 0%, #0a0800 55%, #000 100%)', opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }} />
        {/* Flickering layers wrapped so their container fades in */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 50% 72%, #5a2400 0%, #1a0800 45%, transparent 70%)',
              animation: 'fireFlicker 2.8s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 46% 78%, #6b2000 0%, transparent 50%)',
              animation: 'fireFlicker 1.9s ease-in-out infinite reverse',
            }}
          />
        </div>

        {/* Mist wisps — fade in container prevents snap-on */}
        {introStarted && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, animation: 'sceneFadeIn 3s ease-out forwards' }}>
            {mists.map(m => (
              <Mist
                key={m.id}
                style={{
                  left: m.left,
                  bottom: m.bottom,
                  width: m.width,
                  height: m.height,
                  ['--dur' as string]: m.dur,
                  ['--mx' as string]: m.mx,
                  ['--peak' as string]: m.peak,
                  animationDelay: m.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* Ember particles — only mount after intro starts */}
        {introStarted && embers.map(e => (
          <Ember
            key={e.id}
            variant={e.variant}
            style={{
              left: e.left,
              bottom: e.bottom,
              ['--dur' as string]: e.dur,
              ['--rise' as string]: e.rise,
              ['--dx1' as string]: e.dx1,
              ['--dx2' as string]: e.dx2,
              ['--dx3' as string]: e.dx3,
              ['--a1' as string]: e.a1,
              ['--a2' as string]: e.a2,
              ['--a3' as string]: e.a3,
              animationDelay: e.delay,
            }}
          />
        ))}
      </>}

      {/* Power-saving: simple dark static background */}
      {powerSaving && (
        <div className="board2d-bg" style={{ position: 'absolute', inset: 0, zIndex: 0, background: '#0e0c08' }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        {/* Scene stays mounted always so piece state (landed refs) is preserved across mode switches */}
        <div style={{ position: 'absolute', inset: 0, display: powerSaving ? 'none' : 'block' }}>
          <Scene
            onIntroStart={() => { setIntroStarted(true); startSetupAnim() }}
            menuOpen={menuOpen}
            onNewGame={() => { setMenuOpen(false); startSetupAnim() }}
          />
        </div>
        {powerSaving && <Board2D menuOpen={menuOpen} />}
        <MenuOverlay
          isOpen={menuOpen}
          isVisible={menuVisible}
          onResume={() => setMenuOpen(false)}
          onNewGame={() => {
            resetGame()
            if (powerSaving) setMenuOpen(false)
          }}
          onCredits={() => setShowCredits(true)}
        />
      </div>

      {/* Score panels */}
      {introStarted && <>
        <div className="score-panel-wrapper score-panel-wrapper--defender" style={{ position: 'absolute', bottom: 24, left: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: menuOpen ? 'none' : undefined }}>
          <ScorePanel side="defender" score={scores.defender} isActive={currentTurn === 'defender'} />
        </div>
        <div className="score-panel-wrapper score-panel-wrapper--attacker" style={{ position: 'absolute', bottom: 24, right: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards', opacity: menuOpen ? 0 : 1, transition: 'opacity 0.3s ease', pointerEvents: menuOpen ? 'none' : undefined }}>
          <ScorePanel side="attacker" score={scores.attacker} isActive={currentTurn === 'attacker'} />
        </div>
      </>}

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="High Kings" className="h-32 w-auto select-none" />
      </div>

      {introStarted && <>
        <div className="ui-button-wrapper ui-button-wrapper--hint" style={{ position: 'absolute', top: 24, left: 16, zIndex: 15, opacity: !uiVisible || menuOpen ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating) ? 'none' : undefined }}>
          <HintButton onClick={() => {}} />
        </div>
        <div className="ui-button-wrapper ui-button-wrapper--menu" style={{ position: 'absolute', top: 24, right: 16, zIndex: 15, opacity: !uiVisible ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || setupAnimating) ? 'none' : undefined }}>
          <MenuButton isOpen={menuOpen} onClick={() => setMenuOpen(o => !o)} />
        </div>
      </>}

      <ThemeSwitcher />
      {showCredits && <CreditsScroll onClose={() => setShowCredits(false)} />}
    </div>
  )
}

export default App
