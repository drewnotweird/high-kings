import { Scene } from './components/board/Scene'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'

const fireCSS = `
@keyframes fireFlicker {
  0%   { opacity: 0.35; }
  25%  { opacity: 0.45; }
  50%  { opacity: 0.30; }
  75%  { opacity: 0.42; }
  100% { opacity: 0.35; }
}
@keyframes ember0 {
  0%   { transform: translate(0px,0px)                                   rotate(0deg);   opacity:0;   }
  8%   { opacity:1; }
  30%  { transform: translate(var(--dx1),calc(var(--rise)*0.3))          rotate(120deg); opacity:0.9; }
  60%  { transform: translate(var(--dx2),calc(var(--rise)*0.65))         rotate(260deg); opacity:0.5; }
  85%  { opacity:0.15; }
  100% { transform: translate(var(--dx3),var(--rise))                    rotate(400deg); opacity:0;   }
}
@keyframes ember1 {
  0%   { transform: translate(0px,0px)                                   rotate(0deg);   opacity:0;   }
  6%   { opacity:1; }
  25%  { transform: translate(var(--dx2),calc(var(--rise)*0.25))         rotate(-90deg); opacity:0.8; }
  55%  { transform: translate(var(--dx1),calc(var(--rise)*0.60))         rotate(-200deg);opacity:0.4; }
  80%  { opacity:0.1; }
  100% { transform: translate(var(--dx3),var(--rise))                    rotate(-360deg);opacity:0;   }
}
@keyframes ember2 {
  0%   { transform: translate(0px,0px)                                   rotate(0deg);   opacity:0;   }
  10%  { opacity:1; }
  40%  { transform: translate(var(--dx3),calc(var(--rise)*0.40))         rotate(180deg); opacity:0.7; }
  70%  { transform: translate(var(--dx1),calc(var(--rise)*0.70))         rotate(300deg); opacity:0.3; }
  90%  { opacity:0.05; }
  100% { transform: translate(var(--dx2),var(--rise))                    rotate(450deg); opacity:0;   }
}
`

function Ember({ style, variant }: { style: React.CSSProperties; variant: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: 2,
        height: 2,
        borderRadius: '50%',
        background: '#ffdd80',
        boxShadow: '0 0 3px 1px rgba(255,140,0,0.9)',
        animation: `ember${variant} var(--dur) ease-in-out infinite`,
        ...style,
      }}
    />
  )
}

const embers = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) => (Math.random() - 0.5) * n
  return {
    id: i,
    left: `${10 + (i / 30) * 80 + r(6)}%`,
    bottom: `${5 + Math.random() * 18}%`,
    dur: `${0.7 + Math.random() * 1.1}s`,
    delay: `${-Math.random() * 8}s`,
    rise: `${-(280 + Math.random() * 320)}px`,
    dx1: `${r(60)}px`,
    dx2: `${r(90)}px`,
    dx3: `${r(50)}px`,
    variant: i % 3,
  }
})

function App() {
  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>
      <style>{fireCSS}</style>

      {/* Steady dark base */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 50% 65%, #2a1200 0%, #0a0800 55%, #000 100%)' }} />
      {/* Flickering warm glow layer — subtle */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse at 50% 72%, #5a2400 0%, #1a0800 45%, transparent 70%)',
          animation: 'fireFlicker 2.8s ease-in-out infinite',
        }}
      />
      {/* Second offset layer for irregular flicker */}
      <div
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'radial-gradient(ellipse at 46% 78%, #6b2000 0%, transparent 50%)',
          animation: 'fireFlicker 1.9s ease-in-out infinite reverse',
        }}
      />

      {/* Ember particles */}
      {embers.map(e => (
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
            animationDelay: e.delay,
          }}
        />
      ))}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <Scene />
      </div>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src="/logo.png" alt="High Kings" className="h-32 w-auto select-none" />
      </div>
      <ThemeSwitcher />
    </div>
  )
}

export default App
