import { useGameStore } from '../../store/gameStore'
import type { Theme } from '../../store/gameStore'
import { themes } from '../../lib/themes'

const themeKeys: Theme[] = ['longhouse', 'clifftop', 'hoard']

export function ThemeSwitcher() {
  const { theme, setTheme } = useGameStore()

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 z-10">
      {themeKeys.map((key) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          className={`px-4 py-2 rounded text-sm font-medium tracking-wider uppercase transition-all duration-300 border ${
            theme === key
              ? 'border-amber-400 text-amber-300 bg-amber-400/10'
              : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/70'
          }`}
        >
          {themes[key].name}
        </button>
      ))}
    </div>
  )
}
