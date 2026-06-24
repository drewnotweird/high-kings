import { useState, useEffect, useRef } from 'react'
import { Scene, getIntroDurationMs } from './components/board/Scene'
import { Board2D } from './components/board/Board2D'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'
import { DefeatFire } from './components/ui/DefeatFire'
import { useGameStore } from './store/gameStore'
import type { PlayerSide, GameMode, Difficulty, Rules } from './store/gameStore'
import { getBestMove } from './game/ai'
import { getBoardConfig } from './game/hnefatafl'

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
@keyframes scoreFlash {
  0%   { transform: scale(1);    text-shadow: none; }
  30%  { transform: scale(1.35); text-shadow: 0 0 12px rgba(255,200,80,0.95), 0 0 28px rgba(255,140,0,0.7); }
  60%  { transform: scale(1.15); text-shadow: 0 0 8px rgba(255,200,80,0.6); }
  100% { transform: scale(1);    text-shadow: none; }
}
@keyframes victoryPulse {
  0%   { opacity: 0.55; transform: scale(1);    }
  50%  { opacity: 0.90; transform: scale(1.06); }
  100% { opacity: 0.55; transform: scale(1);    }
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
  overflow-y: auto;
  overflow-x: hidden;
}
.menu-overlay--visible { pointer-events: auto; }
.menu-overlay__screens {
  position: relative;
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
  width: 100%;
  text-align: center;
  box-sizing: border-box;
}
.menu-overlay__item:hover { border-color: rgba(200,160,40,0.9); background: rgba(30,15,0,0.9); }
.settings-panels {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
@media (min-width: 768px) {
  .settings-panels {
    flex-direction: row;
    align-items: flex-start;
    width: min(560px, calc(100vw - 32px));
  }
  .settings-panels .settings-panel {
    flex: 1;
    min-width: 0;
  }
}
.settings-panel {
  width: 100%;
  background: rgba(0,0,0,0.88);
  border: 1px solid rgba(200,160,40,0.35);
  border-radius: 8px;
  overflow: hidden;
  padding: 10px;
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
  padding: 6px;
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
.credits-page {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  background: #120a03;
  font-family: 'MedievalSharp', cursive;
  color: #3d2008;
  overflow: hidden;
  animation: creditsEnter 0.9s ease-out forwards;
}
.credits-page--closing {
  animation: creditsExit 0.5s ease-in-out forwards;
}
@keyframes creditsEnter {
  from { transform: translateY(-104px); height: 104px; }
  to   { transform: translateY(0);      height: 100vh; }
}
@keyframes creditsExit {
  from { transform: translateY(0);      height: 100vh; }
  to   { transform: translateY(-104px); height: 104px; }
}
.credits-page__top,
.credits-page__bottom {
  position: relative;
  z-index: 2;
  height: 52px;
  flex-shrink: 0;
  box-shadow: 0 0 20px rgba(0,0,0,1);
  background-size: auto 100%;
  background-repeat: repeat-x;
}
.credits-page__top  { background-position: center bottom; }
.credits-page__bottom { background-position: center top; }
.credits-page__middle {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  overflow-y: auto;
  overflow-x: hidden;
}
.credits-page__paper {
  width: 100%;
  max-width: 800px;
  padding: 28px 9% 48px;
  box-sizing: border-box;
  background-image: url('pagescroll.png');
  background-size: 100% auto;
  background-repeat: repeat-y;
  background-position: center top;
  font-size: 14px;
  line-height: 20px;
}
@media (min-width: 600px) {
  .credits-page__paper { font-size: 18px; line-height: 28px; }
}
@media (min-width: 1200px) {
  .credits-page__paper { padding: 28px 109px 48px; }
}
.credits-page h1 {
  font-size: clamp(22px, 5vw, 36px);
  letter-spacing: 3px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 0 0 6px;
  text-align: center;
}
.credits-page h2 {
  font-size: clamp(16px, 3vw, 24px);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
  margin: 28px 0 8px;
}
.credits-page p {
  margin: 0 0 16px;
}
.credits-page__names {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin: 0 0 32px;
}
.credits-page__name {
  font-size: clamp(14px, 2.5vw, 20px);
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #2e1606;
}
.credits-page__rule {
  border: none;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(60,28,0,0.35) 20%, rgba(60,28,0,0.35) 80%, transparent);
  margin: 20px 0 24px;
}
.credits-page__close-btn {
  display: block;
  margin: 8px auto 0;
  background: transparent;
  border: 1px solid rgba(60,28,0,0.4);
  color: #3d2008;
  font-family: 'MedievalSharp', serif;
  font-size: 13px;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 10px 28px;
  border-radius: 1px;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
}
.credits-page__close-btn:hover { background: rgba(60,28,0,0.12); border-color: rgba(60,28,0,0.6); }
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
.settings-cycler {
  display: flex;
  align-items: center;
  gap: 6px;
}
.settings-cycler__arrow {
  background: none;
  border: none;
  color: #c8b888;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  font-family: inherit;
  transition: color 0.15s;
}
.settings-cycler__arrow:hover { color: #e8d8b8; }
.settings-cycler__value {
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: #e8d8b8;
  min-width: 80px;
  text-align: center;
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
.winner-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: radial-gradient(ellipse at 50% 55%, #100c00 0%, #040308 50%, #000 100%);
  animation: sceneFadeIn 0.6s ease-out forwards;
  overflow: hidden;
}
.winner-overlay--defeat {
  background: radial-gradient(ellipse at 50% 85%, #3a0800 0%, #1c0300 35%, #0a0100 60%, #000 100%);
}
.winner-overlay__gold1 {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 62%, #7a5000 0%, #2a1800 42%, transparent 68%);
  animation: victoryPulse 3.2s ease-in-out infinite;
  pointer-events: none;
}
.winner-overlay__gold2 {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 50% 56%, rgba(210,148,0,0.45) 0%, transparent 32%);
  animation: victoryPulse 2.1s ease-in-out infinite reverse;
  pointer-events: none;
}
.winner-overlay__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}
.winner-overlay__title {
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #c8b888;
  margin: 0;
}
.winner-overlay__name {
  font-size: clamp(28px, 6vw, 52px);
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #e8d8b8;
  margin: 0;
  text-shadow: 0 0 40px rgba(232,192,64,0.6);
}
.winner-overlay__name--defender { color: #e0d0b0; text-shadow: 0 0 50px rgba(232,210,160,0.7); }
.winner-overlay__name--attacker { color: #7ab0e8; text-shadow: 0 0 50px rgba(100,160,240,0.6); }
.winner-overlay__dismiss {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: #6a5a3a;
  font-family: inherit;
  font-size: 11px;
  letter-spacing: 2px;
  text-transform: uppercase;
  cursor: pointer;
  padding: 8px 16px;
  transition: color 0.2s;
  margin-top: -8px;
}
.winner-overlay__dismiss:hover { color: #a09070; }
.role-select-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: rgba(0,0,0,0.82);
  animation: sceneFadeIn 0.4s ease-out forwards;
}
.role-select__title {
  font-size: 13px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: #c8b888;
  margin: 0;
}
.role-select__options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: min(320px, calc(100vw - 48px));
}
.role-select__option {
  display: flex;
  align-items: center;
  gap: 16px;
  background: rgba(0,0,0,0.8);
  border: 1px solid rgba(200,160,40,0.4);
  border-radius: 8px;
  color: #e8d8b8;
  padding: 16px 20px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
  font-family: inherit;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
}
.role-select__option:hover { border-color: rgba(200,160,40,0.9); background: rgba(30,15,0,0.9); }
.role-select__option--selected { border-color: rgba(200,160,40,0.9); }
.role-select__option-icon { width: 36px; height: 36px; object-fit: contain; flex-shrink: 0; }
.role-select__option-icon--2p { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; gap: 3px; flex-shrink: 0; }
.role-select__option-spacer { width: 36px; height: 36px; flex-shrink: 0; }
.role-select__option-text { display: flex; flex-direction: column; gap: 3px; flex: 1; align-items: center; text-align: center; }
.role-select__option-name { font-size: 14px; letter-spacing: 2px; text-transform: uppercase; }
.role-select__option-desc { font-size: 11px; letter-spacing: 0.5px; color: #a09070; }
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
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/hint.svg`} alt="" />
      <span className="ui-button__label">Hint</span>
    </button>
  )
}

function UndoButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="ui-button ui-button--undo" onClick={onClick}>
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/undo.svg`} alt="" />
      <span className="ui-button__label">Undo</span>
    </button>
  )
}

function MenuButton({ onClick, isOpen }: { onClick: () => void; isOpen: boolean }) {
  return (
    <button className="ui-button ui-button--menu" onClick={onClick}>
      <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/${isOpen ? 'close' : 'menu'}.svg`} alt="" />
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

function Cycler<T extends string>({ options, value, onChange }: {
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  const idx = options.indexOf(value)
  const prev = () => onChange(options[(idx - 1 + options.length) % options.length])
  const next = () => onChange(options[(idx + 1) % options.length])
  return (
    <div className="settings-cycler">
      <button className="settings-cycler__arrow" onClick={prev}>&#8249;</button>
      <span className="settings-cycler__value">{value}</span>
      <button className="settings-cycler__arrow" onClick={next}>&#8250;</button>
    </div>
  )
}


function CreditsScroll({ onClose }: { onClose: () => void }) {
  const [closing, setClosing] = useState(false)
  const handleClose = () => {
    setClosing(true)
    setTimeout(onClose, 350)
  }
  const base = import.meta.env.BASE_URL
  return (
    <div className={`credits-page${closing ? ' credits-page--closing' : ''}`}>
      <div className="credits-page__top" style={{ backgroundImage: `url(${base}wood-top.jpg)` }} />
      <div className="credits-page__middle">
        <div className="credits-page__paper" style={{ backgroundImage: `url(${base}pagescroll.png)` }}>
          <h1>Credits</h1>
          <hr className="credits-page__rule" />
          <p>
            High Kings was originally forged around 2010 by three warriors who wanted to bring an ancient Viking strategy game to life. They had an enormous amount of fun building it together, and this site was created to appease the Gods.
          </p>
          <div className="credits-page__names">
            <span className="credits-page__name">Jason Frame</span>
            <span className="credits-page__name">Lewis MacKenzie</span>
            <span className="credits-page__name">Andrew Nicolson</span>
          </div>
          <hr className="credits-page__rule" />
          <button className="credits-page__close-btn" onClick={handleClose}>Close</button>
        </div>
      </div>
      <div className="credits-page__bottom" style={{ backgroundImage: `url(${base}wood-bottom.jpg)` }} />
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
  const [screensOpacity, setScreensOpacity] = useState(1)
  const { cameraLocked, difficulty, rules, powerSaving, setSetting } = useGameStore()

  // Local draft — changes only committed on Resume/Restart
  const [draft, setDraft] = useState({ powerSaving, cameraLocked, difficulty, rules })

  const panel2Dirty = draft.difficulty !== difficulty || draft.rules !== rules

  // Reset draft and screen when menu opens
  useEffect(() => {
    if (isOpen) setDraft({ powerSaving, cameraLocked, difficulty, rules })
    else setScreen('main')
  }, [isOpen])

  const switchScreen = (next: 'main' | 'settings') => {
    setScreensOpacity(0)
    setTimeout(() => { setScreen(next); setScreensOpacity(1) }, 250)
  }

  const handleResume = () => {
    setSetting('powerSaving', draft.powerSaving)
    setSetting('cameraLocked', draft.cameraLocked)
    onResume()
  }

  const handleRestart = () => {
    setSetting('powerSaving', draft.powerSaving)
    setSetting('cameraLocked', draft.cameraLocked)
    setSetting('difficulty', draft.difficulty)
    setSetting('rules', draft.rules)
    onNewGame()
  }

  if (!isOpen) return null

  return (
    <>
    <div className={`menu-overlay${isVisible ? ' menu-overlay--visible' : ''}`} style={{ opacity: isVisible ? 1 : 0 }}>
      <div className="menu-overlay__screens" style={{ opacity: screensOpacity, transition: 'opacity 0.25s ease' }}>

        {screen === 'main' ? (
          <div className="menu-overlay__screen">
            <button className="menu-overlay__item" onClick={onResume}>Resume Game</button>
            <button className="menu-overlay__item" onClick={() => switchScreen('settings')}>Settings</button>
            <button className="menu-overlay__item" onClick={onNewGame}>New Game</button>
            <button className="menu-overlay__item">How to Play</button>
            <button className="menu-overlay__item" onClick={onCredits}>Credits</button>
            <button className="ui-button ui-button--menu" onClick={onResume} style={{ marginTop: 16 }}>
              <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
              <span className="ui-button__label">Close</span>
            </button>
          </div>
        ) : (
          <div className="menu-overlay__screen">
            <div className="settings-panels">
              <div className="settings-panel">
                <div className="settings-row">
                  <span className="settings-row__label">Power Saving</span>
                  <Toggle on={draft.powerSaving} onClick={() => setDraft(d => ({ ...d, powerSaving: !d.powerSaving, cameraLocked: !d.powerSaving ? true : d.cameraLocked }))} />
                </div>
                <div className="settings-row">
                  <span className="settings-row__label">View</span>
                  <Cycler<'Free' | 'Top-down'>
                    options={['Free', 'Top-down']}
                    value={draft.powerSaving ? 'Top-down' : draft.cameraLocked ? 'Top-down' : 'Free'}
                    onChange={v => {
                      if (v === 'Top-down') {
                        setDraft(d => ({ ...d, cameraLocked: true }))
                      } else {
                        setDraft(d => ({ ...d, cameraLocked: false, powerSaving: false }))
                      }
                    }}
                  />
                </div>
                <div className="settings-row">
                  <button className="menu-overlay__item" onClick={handleResume} disabled={panel2Dirty} style={{ opacity: panel2Dirty ? 0.35 : 1, cursor: panel2Dirty ? 'default' : 'pointer' }}>Resume Game</button>
                </div>
              </div>

              <div className="settings-panel">
                <div className="settings-row">
                  <span className="settings-row__label">Difficulty</span>
                  <Cycler<Difficulty>
                    options={['easy', 'medium', 'hard']}
                    value={draft.difficulty}
                    onChange={v => setDraft(d => ({ ...d, difficulty: v }))}
                  />
                </div>
                <div className="settings-row">
                  <span className="settings-row__label">Rules</span>
                  <Cycler<Rules>
                    options={['Copenhagen', 'Tawlbwrdd', 'Linnaeus Tablut', 'Saami Tablut', 'Brandub', 'Ard Rí', 'Alea Evangelii']}
                    value={draft.rules}
                    onChange={v => setDraft(d => ({ ...d, rules: v }))}
                  />
                </div>
                <div className="settings-row">
                  <button className="menu-overlay__item" onClick={handleRestart}>Restart Game</button>
                </div>
              </div>
            </div>

            <button className="ui-button ui-button--menu" onClick={() => switchScreen('main')} style={{ marginTop: 16 }}>
              <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
              <span className="ui-button__label">Cancel</span>
            </button>
          </div>
        )}

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
  const prevScore = useRef(score)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (score > prevScore.current) {
      setFlashing(false)
      requestAnimationFrame(() => setFlashing(true))
    }
    prevScore.current = score
  }, [score])

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
        <span
          className="score-panel__score"
          style={{ color: '#e8d8b8', fontSize: 18, fontWeight: 600, letterSpacing: 1 }}
          onAnimationEnd={() => setFlashing(false)}
        >
          <span style={flashing ? { display: 'inline-block', animation: 'scoreFlash 0.55s ease-out forwards' } : undefined}>
            {score}
          </span>
        </span>
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

function WinnerOverlay({ winner, playerMode, powerSaving, onNewGame, onDismiss }: {
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
          ['--dur' as string]: e.dur,
          ['--rise' as string]: e.rise,
          ['--dx1' as string]: e.dx1, ['--dx2' as string]: e.dx2, ['--dx3' as string]: e.dx3,
          ['--a1' as string]: e.a1, ['--a2' as string]: e.a2, ['--a3' as string]: e.a3,
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

function RoleSelectOverlay({ onConfirm }: { onConfirm: (mode: GameMode) => void }) {
  return (
    <div className="role-select-overlay">
      <div className="role-select__options">
        <button className="role-select__option" onClick={() => onConfirm('defender')}>
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}white-piece.png`} alt="" />
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
          <img className="role-select__option-icon" src={`${import.meta.env.BASE_URL}blue-piece.png`} alt="" />
        </button>
        <button className="role-select__option" onClick={() => onConfirm('2player')}>
          <div className="role-select__option-icon--2p">
            <img style={{ width: 36, height: 36, objectFit: 'contain' }} src={`${import.meta.env.BASE_URL}white-piece.png`} alt="" />
          </div>
          <div className="role-select__option-text">
            <span className="role-select__option-name">2 Player</span>
            <span className="role-select__option-desc">Play both sides</span>
          </div>
          <div className="role-select__option-icon--2p">
            <img style={{ width: 36, height: 36, objectFit: 'contain' }} src={`${import.meta.env.BASE_URL}blue-piece.png`} alt="" />
          </div>
        </button>
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
  const [roleSelectOpen, setRoleSelectOpen] = useState(false)
  const [winnerDismissed, setWinnerDismissed] = useState(false)
  const [displayWinner, setDisplayWinner] = useState<string | null>(null)
  const { currentTurn, scores, resetGame, powerSaving, setSetting, pieces, winner, playerMode, setPlayerMode, machineMove, difficulty, rules, selectedId, selectPiece, movePiece, history, undoMove, gameKey } = useGameStore()

  // Stable hint move — computed once per hint session, cleared on turn change or new game
  const hintMove = useRef<{ pieceId: string; toRow: number; toCol: number } | null>(null)
  useEffect(() => { hintMove.current = null }, [currentTurn, winner])

  // Track whether any move has been made this game (for undo button fade-in)
  const [hasMoved, setHasMoved] = useState(false)
  const prevTurnRef = useRef(currentTurn)
  const prevGameKeyRef = useRef(gameKey)
  useEffect(() => {
    if (gameKey !== prevGameKeyRef.current) {
      setHasMoved(false)
      prevTurnRef.current = currentTurn
      prevGameKeyRef.current = gameKey
      return
    }
    if (currentTurn !== prevTurnRef.current) {
      setHasMoved(true)
      prevTurnRef.current = currentTurn
    }
  }, [currentTurn, gameKey])

  useEffect(() => {
    if (!winner) { setDisplayWinner(null); return }
    const t = setTimeout(() => setDisplayWinner(winner), 1000)
    return () => clearTimeout(t)
  }, [winner])
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ?ps=true in the URL activates power-saving mode on load
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('ps') === 'true') {
      setSetting('powerSaving', true)
    }
  }, [])

  // Machine player — fires after each player move when not in 2-player mode
  useEffect(() => {
    if (playerMode === '2player' || winner || roleSelectOpen || setupAnimating) return
    const machineSide: PlayerSide = playerMode === 'attacker' ? 'defender' : 'attacker'
    if (currentTurn !== machineSide) return

    const { boardSize, center, kingEscapeEdge, shieldwall, weakKing } = getBoardConfig(rules)
    const fire = () => {
      // Read fresh state — pieces may have changed (clearDyingPieces) since the effect ran
      const { pieces: freshPieces, dyingPieces: freshDying, currentTurn: freshTurn, winner: freshWinner, selectedId: freshSelected } = useGameStore.getState()
      if (freshWinner || freshTurn !== machineSide) return
      // If the player still has a piece selected, wait for them to deselect first
      if (freshSelected) { setTimeout(fire, 600); return }
      const alivePieces = freshPieces.filter(p => !freshDying.some(d => d.id === p.id))
      const move = getBestMove(alivePieces, machineSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing)
      if (move) machineMove(move.pieceId, move.toRow, move.toCol)
    }
    const timer = setTimeout(fire, 2200)
    return () => clearTimeout(timer)
  }, [currentTurn, playerMode, winner, roleSelectOpen, setupAnimating])

  const startSetupAnim = () => {
    if (setupTimerRef.current) clearTimeout(setupTimerRef.current)
    setSetupAnimating(true)
    setupTimerRef.current = setTimeout(() => setSetupAnimating(false), getIntroDurationMs(pieces.length))
  }

  // In power-saving mode there's no 3D intro — show UI immediately
  useEffect(() => {
    if (powerSaving) setIntroStarted(true)
  }, [powerSaving])

  // Reset winner dismissed state when a new game starts
  useEffect(() => {
    if (!winner) setWinnerDismissed(false)
  }, [winner])

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

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', inset: 0 }}>
          {powerSaving
            ? <Board2D menuOpen={menuOpen} />
            : <Scene
                onIntroStart={() => { setIntroStarted(true); startSetupAnim() }}
                menuOpen={menuOpen}
                onNewGame={() => { setMenuOpen(false); startSetupAnim() }}
              />
          }
        </div>
        <MenuOverlay
          isOpen={menuOpen}
          isVisible={menuVisible}
          onResume={() => setMenuOpen(false)}
          onNewGame={() => {
            setMenuOpen(false)
            setRoleSelectOpen(true)
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

      <div className="absolute top-1 md:top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="High Kings" className="h-32 w-auto select-none" />
      </div>

      {introStarted && <>
        <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 15, display: 'flex', gap: 4 }}>
          <div className="ui-button-wrapper ui-button-wrapper--hint" style={{ opacity: !uiVisible || menuOpen ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating) ? 'none' : undefined }}>
            <HintButton onClick={() => {
              if (playerMode === '2player' || winner) return
              const humanSide: PlayerSide = playerMode === 'defender' ? 'defender' : 'attacker'
              if (currentTurn !== humanSide) return
              // Compute the hint move once and cache it for this turn
              if (!hintMove.current) {
                const { boardSize, center, kingEscapeEdge, shieldwall, weakKing } = getBoardConfig(rules)
                hintMove.current = getBestMove(pieces, humanSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing)
              }
              const move = hintMove.current
              if (!move) return
              if (selectedId === move.pieceId) {
                hintMove.current = null
                movePiece(move.toRow, move.toCol)
              } else {
                selectPiece(move.pieceId)
              }
            }} />
          </div>
          <div className="ui-button-wrapper ui-button-wrapper--undo" style={{ opacity: !uiVisible || menuOpen ? 0 : hasMoved && history.length > 0 ? (setupAnimating ? 0.2 : 1) : 0, transition: 'opacity 0.6s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating || !hasMoved || history.length === 0) ? 'none' : undefined }}>
            <UndoButton onClick={() => {
              if (history.length === 0 || setupAnimating) return
              undoMove()
            }} />
          </div>
        </div>
        <div className="ui-button-wrapper ui-button-wrapper--menu" style={{ position: 'absolute', top: 16, right: 16, zIndex: 15, opacity: !uiVisible || menuOpen ? 0 : setupAnimating ? 0.2 : 1, transition: 'opacity 0.4s ease', pointerEvents: (!uiVisible || menuOpen || setupAnimating) ? 'none' : undefined }}>
          <MenuButton isOpen={false} onClick={() => setMenuOpen(o => !o)} />
        </div>
      </>}

      <ThemeSwitcher />
      {showCredits && <CreditsScroll onClose={() => setShowCredits(false)} />}
      {displayWinner && !winnerDismissed && (
        <WinnerOverlay
          winner={displayWinner as 'attacker' | 'defender'}
          playerMode={playerMode}
          powerSaving={powerSaving}
          onNewGame={() => setRoleSelectOpen(true)}
          onDismiss={() => setWinnerDismissed(true)}
        />
      )}
      {roleSelectOpen && (
        <RoleSelectOverlay
          onConfirm={(mode) => {
            setPlayerMode(mode)
            resetGame()
            setRoleSelectOpen(false)
            startSetupAnim()
          }}
        />
      )}
    </div>
  )
}

export default App
