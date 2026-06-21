import { Scene } from './components/board/Scene'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'


function App() {
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at 50% 60%, #2a1500 0%, #0a0800 50%, #000000 100%)' }}
    >
      <Scene />
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <img src="/logo.png" alt="High Kings" className="h-20 w-auto select-none" />
      </div>
      <ThemeSwitcher />
    </div>
  )
}

export default App
