import { useState, useCallback } from 'react'
import { AvatarDisplay } from './AvatarDisplay'
import { randomAvatar, AVATAR_COUNTS } from '../../lib/avatarConfig'
import type { AvatarConfig } from '../../lib/avatarConfig'

interface Props {
  initial: AvatarConfig
  onSave: (config: AvatarConfig) => void
  onCancel: () => void
}

type LayerKey = keyof AvatarConfig

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'background', label: 'Background' },
  { key: 'face',       label: 'Face' },
  { key: 'skinColor',  label: 'Skin' },
  { key: 'eyes',       label: 'Eyes' },
  { key: 'nose',       label: 'Nose' },
  { key: 'helmet',     label: 'Helmet' },
  { key: 'accessory',  label: 'Accessory' },
]

export function AvatarMaker({ initial, onSave, onCancel }: Props) {
  const [config, setConfig] = useState<AvatarConfig>(initial)
  const [spinning, setSpinning] = useState(false)

  const cycle = useCallback((key: LayerKey, dir: 1 | -1) => {
    setConfig(c => {
      const count = AVATAR_COUNTS[key]
      return { ...c, [key]: ((c[key] + dir) + count) % count }
    })
  }, [])

  const randomise = useCallback(() => {
    if (spinning) return
    setSpinning(true)
    let ticks = 0
    const total = 18
    const interval = setInterval(() => {
      setConfig(randomAvatar())
      ticks++
      if (ticks >= total) {
        clearInterval(interval)
        setSpinning(false)
      }
    }, 60)
  }, [spinning])

  return (
    <div className="avatar-maker">
      <div className="avatar-maker__preview">
        <AvatarDisplay config={config} size={120} />
      </div>

      <div className="avatar-maker__layers">
        {LAYERS.map(({ key, label }) => (
          <div key={key} className="avatar-maker__row">
            <span className="avatar-maker__row-label">{label}</span>
            <div className="avatar-maker__row-controls">
              <button className="avatar-maker__arrow" onClick={() => cycle(key, -1)}>‹</button>
              <span className="avatar-maker__index">{config[key] + 1} / {AVATAR_COUNTS[key]}</span>
              <button className="avatar-maker__arrow" onClick={() => cycle(key, 1)}>›</button>
            </div>
          </div>
        ))}
      </div>

      <button className={`avatar-maker__randomise${spinning ? ' avatar-maker__randomise--spinning' : ''}`} onClick={randomise} disabled={spinning}>
        Randomise
      </button>

      <div className="avatar-maker__actions">
        <button className="avatar-maker__cancel" onClick={onCancel}>Cancel</button>
        <button className="avatar-maker__save" onClick={() => onSave(config)}>Save</button>
      </div>
    </div>
  )
}
