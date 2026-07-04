import { BACKGROUNDS, SKIN_COLORS, FACES, EYES, NOSES, HELMETS, ACCESSORIES } from '../../lib/avatarConfig'
import type { AvatarConfig } from '../../lib/avatarConfig'

interface Props {
  config: AvatarConfig
  size?: number
}

export function AvatarDisplay({ config, size = 80 }: Props) {
  const bg = BACKGROUNDS[config.background] ?? BACKGROUNDS[0]
  const skin = SKIN_COLORS[config.skinColor] ?? SKIN_COLORS[0]

  return (
    <div className="avatar-display" style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', position: 'relative', flexShrink: 0, background: bg }}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Face / skin */}
        <g fill={skin} dangerouslySetInnerHTML={{ __html: FACES[config.face] ?? '' }} />
        {/* Eyes */}
        <g dangerouslySetInnerHTML={{ __html: EYES[config.eyes] ?? '' }} />
        {/* Nose */}
        <g dangerouslySetInnerHTML={{ __html: NOSES[config.nose] ?? '' }} />
        {/* Helmet */}
        <g dangerouslySetInnerHTML={{ __html: HELMETS[config.helmet] ?? '' }} />
        {/* Accessory */}
        <g dangerouslySetInnerHTML={{ __html: ACCESSORIES[config.accessory] ?? '' }} />
      </svg>
    </div>
  )
}
