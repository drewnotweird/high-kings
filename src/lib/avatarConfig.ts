import hair0 from '../assets/avatars/hair/0.svg?raw'
import hair1 from '../assets/avatars/hair/1.svg?raw'
import eyes0 from '../assets/avatars/eyes/0.svg?raw'
import eyes1 from '../assets/avatars/eyes/1.svg?raw'
import mouth0 from '../assets/avatars/mouth/0.svg?raw'
import mouth1 from '../assets/avatars/mouth/1.svg?raw'
import helmet0 from '../assets/avatars/helmet/0.svg?raw'
import helmet1 from '../assets/avatars/helmet/1.svg?raw'
import facialHair0 from '../assets/avatars/facial-hair/0.svg?raw'
import facialHair1 from '../assets/avatars/facial-hair/1.svg?raw'

export interface AvatarConfig {
  skinColor: number
  hair: number
  hairColor: number
  eyes: number
  mouth: number
  helmet: number
  facialHair: number
}

export const AVATAR_COUNTS = {
  skinColor: 2,
  hair: 2,
  hairColor: 4,
  eyes: 2,
  mouth: 2,
  helmet: 2,
  facialHair: 2,
}

export function randomAvatar(): AvatarConfig {
  return {
    skinColor: Math.floor(Math.random() * AVATAR_COUNTS.skinColor),
    hair: Math.floor(Math.random() * AVATAR_COUNTS.hair),
    hairColor: Math.floor(Math.random() * AVATAR_COUNTS.hairColor),
    eyes: Math.floor(Math.random() * AVATAR_COUNTS.eyes),
    mouth: Math.floor(Math.random() * AVATAR_COUNTS.mouth),
    helmet: Math.floor(Math.random() * AVATAR_COUNTS.helmet),
    facialHair: Math.floor(Math.random() * AVATAR_COUNTS.facialHair),
  }
}

// Strips the outer <svg> wrapper, leaving just the inner shapes for composition
function inner(raw: string): string {
  const start = raw.indexOf('>') + 1
  const end = raw.lastIndexOf('<')
  return raw.slice(start, end)
}

export const SKIN_COLORS = [
  '#d4956a',
  '#8b5e3c',
]

export const HAIR_COLORS = [
  '#2a1506', // near-black
  '#7a3d10', // dark auburn
  '#c47a28', // golden brown
  '#e8d080', // blonde
]

// All SVGs use a 0 0 100 100 viewBox, layered bottom→top.
// Hair and facial hair shapes use no fill — AvatarDisplay applies hair colour via the parent <g>.

export const HAIRS = [inner(hair0), inner(hair1)]
export const EYES = [inner(eyes0), inner(eyes1)]
export const MOUTHS = [inner(mouth0), inner(mouth1)]
export const HELMETS = [inner(helmet0), inner(helmet1)]
export const FACIAL_HAIRS = [inner(facialHair0), inner(facialHair1)]
