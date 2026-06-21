import { Scene } from './components/board/Scene'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'

function App() {
  return (
    <div className="relative w-full h-full">
      <Scene />
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
        <h1 className="text-2xl font-bold tracking-[0.3em] uppercase text-amber-200/80 select-none">
          High Kings
        </h1>
      </div>
      <ThemeSwitcher />
    </div>
  )
}

export default App
