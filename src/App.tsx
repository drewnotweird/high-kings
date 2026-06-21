import { useState } from 'react'
import { Scene } from './components/board/Scene'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'
import { useGameStore } from './store/gameStore'
import type { PlayerSide } from './store/gameStore'

const fireCSS = `
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
  const { currentTurn, scores } = useGameStore()

  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>
      <style>{fireCSS}</style>

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

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <Scene onIntroStart={() => setIntroStarted(true)} />
      </div>

      {/* Score panels */}
      {introStarted && <>
        <div className="score-panel-wrapper score-panel-wrapper--defender" style={{ position: 'absolute', bottom: 24, left: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards' }}>
          <ScorePanel side="defender" score={scores.defender} isActive={currentTurn === 'defender'} />
        </div>
        <div className="score-panel-wrapper score-panel-wrapper--attacker" style={{ position: 'absolute', bottom: 24, right: '10vw', zIndex: 10, animation: 'sceneFadeIn 2s ease-out forwards' }}>
          <ScorePanel side="attacker" score={scores.attacker} isActive={currentTurn === 'attacker'} />
        </div>
      </>}

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="High Kings" className="h-32 w-auto select-none" />
      </div>
      <ThemeSwitcher />
    </div>
  )
}

export default App
