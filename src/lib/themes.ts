export interface ThemeConfig {
  name: string
  // Lighting
  ambientColor: string
  ambientIntensity: number
  fireColor: string
  fireIntensity: number
  fogColor: string
  fogNear: number
  fogFar: number
  background: string
  // Board
  boardColor: string
  boardRoughness: number
  boardMetalness: number
  lightSquareColor: string
  darkSquareColor: string
  cornerColor: string
  throneColor: string
  boardEdgeColor: string
  // Pieces
  attackerColor: string
  attackerEmissive: string
  defenderColor: string
  defenderEmissive: string
  kingColor: string
  kingEmissive: string
  pieceRoughness: number
  pieceMetalness: number
}

export const themes: Record<string, ThemeConfig> = {
  natural: {
    name: 'Natural',
    ambientColor: '#ffffff',
    ambientIntensity: 0.4,
    fireColor: '#ffffff',
    fireIntensity: 0,
    fogColor: '#000000',
    fogNear: 24,
    fogFar: 48,
    background: '#000000',
    boardColor: '#888888',
    boardRoughness: 0.8,
    boardMetalness: 0.0,
    lightSquareColor: '#cccccc',
    darkSquareColor: '#888888',
    cornerColor: '#666666',
    throneColor: '#888888',
    boardEdgeColor: '#555555',
    attackerColor: '#444444',
    attackerEmissive: '#000000',
    defenderColor: '#dddddd',
    defenderEmissive: '#000000',
    kingColor: '#ffffff',
    kingEmissive: '#000000',
    pieceRoughness: 0.8,
    pieceMetalness: 0.0,
  },
}
