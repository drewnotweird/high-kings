import { useState, useEffect, useRef } from 'react'

export function ScrollPage({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [closing, setClosing] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [atBottom, setAtBottom] = useState(false)
  const middleRef = useRef<HTMLDivElement>(null)
  const base = import.meta.env.BASE_URL

  const handleClose = () => { setClosing(true); setTimeout(onClose, 450) }

  const checkScroll = () => {
    const el = middleRef.current
    if (!el) return
    setAtTop(el.scrollTop <= 1)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 1)
  }

  useEffect(() => {
    const el = middleRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => { el.removeEventListener('scroll', checkScroll); ro.disconnect() }
  }, [])

  const scrollBy = (dir: 1 | -1) => {
    middleRef.current?.scrollBy({ top: dir * 300, behavior: 'smooth' })
  }

  const Bars = ({ position }: { position: 'top' | 'bottom' }) => (
    <div
      className={`credits-page__${position}`}
      style={{ backgroundImage: `url(${base}${position === 'top' ? 'wood-top' : 'wood-bottom'}.webp)` }}
    >
      <div className="credits-page__bar-side">
        {position === 'top'
          ? <button className="credits-page__arrow" onClick={() => scrollBy(-1)} disabled={atTop}><img src={`${base}icons/arrow-up.svg`} alt="" /></button>
          : <button className="credits-page__arrow" onClick={() => scrollBy(1)} disabled={atBottom}><img src={`${base}icons/arrow-down.svg`} alt="" /></button>
        }
      </div>
      <div className="credits-page__bar-centre">
        {position === 'top'
          ? <span className="credits-page__title">{title}</span>
          : <button className="credits-page__close-bar-btn" onClick={handleClose}><img src={`${base}icons/close.svg`} alt="" /><span>Close</span></button>
        }
      </div>
      <div className="credits-page__bar-side">
        {position === 'top'
          ? <button className="credits-page__arrow" onClick={() => scrollBy(-1)} disabled={atTop}><img src={`${base}icons/arrow-up.svg`} alt="" /></button>
          : <button className="credits-page__arrow" onClick={() => scrollBy(1)} disabled={atBottom}><img src={`${base}icons/arrow-down.svg`} alt="" /></button>
        }
      </div>
    </div>
  )

  const cornerStyle = {
    '--corner-img-tl': `url(${base}wood-top-left.webp)`,
    '--corner-img-tr': `url(${base}wood-top-right.webp)`,
    '--corner-img-tm': `url(${base}wood-top-middle.webp)`,
    '--corner-img-bl': `url(${base}wood-bottom-left.webp)`,
    '--corner-img-br': `url(${base}wood-bottom-right.webp)`,
    '--corner-img-bm': `url(${base}wood-bottom-middle.webp)`,
  } as React.CSSProperties

  return (
    <div className={`credits-page${closing ? ' credits-page--closing' : ''}`} style={cornerStyle}>
      <Bars position="top" />
      <div className="credits-page__middle" ref={middleRef}>
        <div className="credits-page__paper" style={{ backgroundImage: `url(${base}pagescroll.webp)` }}>
          {children}
        </div>
      </div>
      <Bars position="bottom" />
    </div>
  )
}

export function CreditsScroll({ onClose }: { onClose: () => void }) {
  const base = import.meta.env.BASE_URL
  return (
    <ScrollPage title="Makers" onClose={onClose}>
      <img src={`${base}credits-banner.webp`} alt="" className="credits-page__banner" />
      <p>
        High Kings was forged around 2010 by three friends who wanted to bring one of history's forgotten strategy games back to life.
        Hnefatafl was the chess of the Norse world — a game of kings and raiders played across northern Europe for hundreds of years,
        before chess arrived from the south and slowly pushed it into obscurity.
      </p>
      <p>
        This site is built in Three.js and React, running entirely in your browser. The board and pieces are rendered in real-time 3D,
        and the AI opponent uses a minimax search with alpha-beta pruning — it will not go easy on you.
      </p>
      <p>
        Online play is powered by Supabase. All eleven variants are faithful to their historical sources where records survive, and to the
        best available reconstructions where they don't.
      </p>
      <hr className="credits-page__rule" />
      <div className="credits-page__names">
        <span className="credits-page__name">Jason Frame</span>
        <span className="credits-page__name">Lewis MacKenzie</span>
        <span className="credits-page__name">Andrew Nicolson</span>
      </div>
    </ScrollPage>
  )
}
