import { SKIN_COLORS, HAIR_COLORS, HAIRS, EYES, MOUTHS, HELMETS, FACIAL_HAIRS } from '../../lib/avatarConfig'
import type { AvatarConfig } from '../../lib/avatarConfig'

interface Props {
  config: AvatarConfig
  size?: number
  circle?: boolean
}

export function AvatarDisplay({ config, size = 80, circle = false }: Props) {
  const skin = SKIN_COLORS[config.skinColor] ?? SKIN_COLORS[0]
  const hairColor = HAIR_COLORS[config.hairColor] ?? HAIR_COLORS[0]

  return (
    <div className="avatar-display" style={{
      width: size,
      height: size,
      borderRadius: circle ? '50%' : 0,
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      background: skin,
    }}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {/* Hair — drawn first, behind face features */}
        <g fill={hairColor} dangerouslySetInnerHTML={{ __html: HAIRS[config.hair] ?? '' }} />
        {/* Eyes */}
        <g dangerouslySetInnerHTML={{ __html: EYES[config.eyes] ?? '' }} />
        {/* Mouth */}
        <g dangerouslySetInnerHTML={{ __html: MOUTHS[config.mouth] ?? '' }} />
        {/* Helmet */}
        <g dangerouslySetInnerHTML={{ __html: HELMETS[config.helmet] ?? '' }} />
        {/* Facial hair — uses same hair colour */}
        <g fill={hairColor} dangerouslySetInnerHTML={{ __html: FACIAL_HAIRS[config.facialHair] ?? '' }} />
      </svg>
    </div>
  )
}
