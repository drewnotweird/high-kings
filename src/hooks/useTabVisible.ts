import { useEffect, useState } from 'react'

// Tracks document visibility so WebGL canvases can stop their frame loops
// entirely while the tab is hidden (rAF throttles in background tabs, but
// 'never' drops GPU/CPU work to zero).
export function useTabVisible(): boolean {
  const [visible, setVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])
  return visible
}
