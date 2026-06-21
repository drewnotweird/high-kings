import { createContext } from 'react'

// Wall-clock ms when intro sequence should begin (null = not yet)
export const IntroStartContext = createContext<number | null>(null)
