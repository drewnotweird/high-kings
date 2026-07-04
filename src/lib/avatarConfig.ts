export interface AvatarConfig {
  background: number
  face: number
  skinColor: number
  eyes: number
  nose: number
  helmet: number
  accessory: number
}

export const AVATAR_COUNTS = {
  background: 2,
  face: 2,
  skinColor: 2,
  eyes: 2,
  nose: 2,
  helmet: 2,
  accessory: 2,
}

export function randomAvatar(): AvatarConfig {
  return {
    background: Math.floor(Math.random() * AVATAR_COUNTS.background),
    face: Math.floor(Math.random() * AVATAR_COUNTS.face),
    skinColor: Math.floor(Math.random() * AVATAR_COUNTS.skinColor),
    eyes: Math.floor(Math.random() * AVATAR_COUNTS.eyes),
    nose: Math.floor(Math.random() * AVATAR_COUNTS.nose),
    helmet: Math.floor(Math.random() * AVATAR_COUNTS.helmet),
    accessory: Math.floor(Math.random() * AVATAR_COUNTS.accessory),
  }
}

export const BACKGROUNDS = [
  'linear-gradient(160deg, #1a3a5c 0%, #0d1a2e 100%)',
  'linear-gradient(160deg, #3a1a0d 0%, #1a0d06 100%)',
]

export const SKIN_COLORS = [
  '#d4956a',
  '#8b5e3c',
]

// All SVGs on a 0 0 100 100 viewBox, layered bottom→top within a circle clip

export const FACES = [
  // Oval face
  `<ellipse cx="50" cy="56" rx="28" ry="34"/>`,
  // Wider rounder face
  `<ellipse cx="50" cy="56" rx="32" ry="30"/>`,
]

export const EYES = [
  // Round eyes
  `<circle cx="39" cy="46" r="5" fill="#1a0d06"/><circle cx="61" cy="46" r="5" fill="#1a0d06"/>
   <circle cx="41" cy="44" r="1.5" fill="#fff"/>  <circle cx="63" cy="44" r="1.5" fill="#fff"/>`,
  // Narrower eyes
  `<ellipse cx="39" cy="47" rx="6.5" ry="3.5" fill="#1a0d06"/><ellipse cx="61" cy="47" rx="6.5" ry="3.5" fill="#1a0d06"/>
   <circle cx="41" cy="46" r="1.5" fill="#fff"/><circle cx="63" cy="46" r="1.5" fill="#fff"/>`,
]

export const NOSES = [
  // Small button nose
  `<ellipse cx="50" cy="57" rx="3.5" ry="2.5" fill="rgba(0,0,0,0.18)"/>`,
  // Longer nose bridge
  `<path d="M48,51 Q47,57 45,60 Q50,62 55,60 Q53,57 52,51" fill="none" stroke="rgba(0,0,0,0.2)" stroke-width="1.5" stroke-linecap="round"/>`,
]

export const HELMETS = [
  // Simple iron cap
  `<path d="M22,52 Q22,18 50,18 Q78,18 78,52 L72,52 Q72,24 50,24 Q28,24 28,52 Z" fill="#5a5a5a"/>
   <rect x="22" y="50" width="56" height="5" rx="2" fill="#484848"/>
   <rect x="44" y="18" width="12" height="5" rx="1" fill="#484848"/>`,
  // Horned helmet
  `<path d="M22,52 Q22,18 50,18 Q78,18 78,52 L72,52 Q72,24 50,24 Q28,24 28,52 Z" fill="#5a5a5a"/>
   <rect x="22" y="50" width="56" height="5" rx="2" fill="#484848"/>
   <path d="M22,48 Q14,38 12,24 Q18,28 22,36 Q22,42 22,48 Z" fill="#6a6a6a"/>
   <path d="M78,48 Q86,38 88,24 Q82,28 78,36 Q78,42 78,48 Z" fill="#6a6a6a"/>`,
]

export const ACCESSORIES = [
  // None
  ``,
  // Beard
  `<path d="M33,63 Q36,78 50,82 Q64,78 67,63 Q58,68 50,68 Q42,68 33,63 Z" fill="#3a2010"/>
   <path d="M36,61 Q38,66 50,68 Q62,66 64,61" fill="#3a2010"/>`,
]
