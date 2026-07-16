import { useState, useEffect } from 'react'
import { useGameSlice } from '../../store/gameStore'
import type { GameMode, Difficulty, Rules } from '../../store/gameStore'
import { Cycler, Toggle } from './buttons'
import { BOARD_SIZE_RULES, ALL_RULES, ALL_BOARD_SIZES } from '../../game/variants'

export function MenuOverlay({ isOpen, isVisible, onResume, onNewGame, onOnlineMatch }: {
  isOpen: boolean
  isVisible: boolean
  onResume: () => void
  onNewGame: () => void
  onOnlineMatch: (rules: Rules, boardSize: number, side: 'attacker' | 'defender') => void
}) {
  const { cameraLocked, difficulty, rules, boardSize, powerSaving, playerMode, setSetting } = useGameSlice('cameraLocked', 'difficulty', 'rules', 'boardSize', 'powerSaving', 'playerMode', 'setSetting')

  const modeToPlay = (m: GameMode): 'Online' | 'Vs Machine' | 'Take turns' =>
    m === '2player' ? 'Take turns' : 'Vs Machine'
  const playToMode = (p: 'Online' | 'Vs Machine' | 'Take turns'): GameMode =>
    p === 'Take turns' ? '2player' : 'defender'

  const [draft, setDraft] = useState({ powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) as 'Online' | 'Vs Machine' | 'Take turns', side: (playerMode === '2player' ? 'attacker' : playerMode) as 'attacker' | 'defender' })

  const validRulesForSize = BOARD_SIZE_RULES[draft.boardSize] ?? []
  const restartValid = validRulesForSize.includes(draft.rules)
  const requiresNewGame = draft.rules !== rules || draft.boardSize !== boardSize || draft.play !== modeToPlay(playerMode)

  // Reset draft when menu opens
  useEffect(() => {
    if (isOpen) setDraft(d => ({ ...d, powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode), side: playerMode === '2player' ? d.side : playerMode }))
  }, [isOpen])

  const applyDisplaySettings = () => {
    setSetting('powerSaving', draft.powerSaving)
    setSetting('cameraLocked', draft.cameraLocked)
  }

  const handleResume = () => {
    applyDisplaySettings()
    onResume()
  }

  const handleNewGame = () => {
    if (draft.play === 'Online') { onOnlineMatch(draft.rules, draft.boardSize, draft.side); return }
    applyDisplaySettings()
    setSetting('difficulty', draft.difficulty)
    setSetting('boardSize', draft.boardSize)
    setSetting('rules', draft.rules)
    setSetting('playerMode', draft.play === 'Vs Machine' ? draft.side : playToMode(draft.play))
    onNewGame()
  }

  const handleCancel = () => {
    setDraft(d => ({ ...d, powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) }))
    onResume()
  }

  if (!isOpen) return null

  return (
    <>
    <div className={`menu-overlay${isVisible ? ' menu-overlay--visible' : ''}`} style={{ opacity: isVisible ? 1 : 0 }}>
      <div className="menu-overlay__screens" style={{ opacity: 1 }}>
        <div className="menu-overlay__screen">
          <div className="settings-panel">
            <div className="settings-row">
              <span className="settings-row__label">Play</span>
              <Cycler<'Online' | 'Vs Machine' | 'Take turns'>
                options={['Online', 'Vs Machine', 'Take turns']}
                value={draft.play}
                onChange={v => setDraft(d => ({ ...d, play: v }))}
              />
            </div>
            <div className="settings-row" style={{ opacity: draft.play === 'Take turns' ? 0.25 : 1, pointerEvents: draft.play === 'Take turns' ? 'none' : undefined, transition: 'opacity 0.2s ease' }}>
              <span className="settings-row__label">Side</span>
              <Cycler<'attacker' | 'defender'>
                options={['attacker', 'defender']}
                value={draft.side}
                onChange={v => setDraft(d => ({ ...d, side: v }))}
              />
            </div>
            <div className="settings-row" style={{ opacity: draft.play === 'Vs Machine' ? 1 : 0.25, pointerEvents: draft.play === 'Vs Machine' ? undefined : 'none', transition: 'opacity 0.2s ease' }}>
              <span className="settings-row__label">Difficulty</span>
              <Cycler<Difficulty>
                options={['easy', 'medium', 'hard']}
                value={draft.difficulty}
                onChange={v => setDraft(d => ({ ...d, difficulty: v }))}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Board</span>
              <Cycler<string>
                options={ALL_BOARD_SIZES.map(n => `${n}×${n}`)}
                value={`${draft.boardSize}×${draft.boardSize}`}
                onChange={v => {
                  const size = parseInt(v)
                  const valid = BOARD_SIZE_RULES[size] ?? []
                  const newRules = valid.includes(draft.rules) ? draft.rules : (valid[0] ?? draft.rules)
                  setDraft(d => ({ ...d, boardSize: size, rules: newRules }))
                }}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Rules</span>
              <Cycler<Rules>
                options={ALL_RULES}
                value={draft.rules}
                isDisabled={v => !validRulesForSize.includes(v)}
                onChange={v => setDraft(d => ({ ...d, rules: v }))}
              />
            </div>
            <div className="settings-row">
              <span className="settings-row__label">Power Saving</span>
              <Toggle on={draft.powerSaving} onClick={() => setDraft(d => ({ ...d, powerSaving: !d.powerSaving, cameraLocked: !d.powerSaving ? true : d.cameraLocked }))} />
            </div>
            <div className="settings-row" style={{ opacity: draft.powerSaving ? 0.25 : 1, pointerEvents: draft.powerSaving ? 'none' : undefined, transition: 'opacity 0.2s ease' }}>
              <span className="settings-row__label">View</span>
              <Cycler<'Free' | 'Top-down'>
                options={['Free', 'Top-down']}
                value={draft.powerSaving ? 'Top-down' : draft.cameraLocked ? 'Top-down' : 'Free'}
                onChange={v => {
                  if (v === 'Top-down') setDraft(d => ({ ...d, cameraLocked: true }))
                  else setDraft(d => ({ ...d, cameraLocked: false, powerSaving: false }))
                }}
              />
            </div>
            <div className="settings-row settings-row--buttons">
              <button className="menu-overlay__item menu-overlay__item--half menu-overlay__item--primary" onClick={handleResume} disabled={requiresNewGame} style={{ opacity: requiresNewGame ? 0.25 : 1, cursor: requiresNewGame ? 'default' : 'pointer' }}>Resume</button>
              <button
                className="menu-overlay__item menu-overlay__item--half menu-overlay__item--primary"
                onClick={handleNewGame}
                disabled={!restartValid}
                style={{ opacity: restartValid ? 1 : 0.35, cursor: restartValid ? 'pointer' : 'default' }}
              >New Game</button>
            </div>
          </div>

          <div className="menu-overlay__row" style={{ marginTop: 8 }}>
          </div>
          <button className="ui-button ui-button--menu" onClick={handleCancel} style={{ marginTop: 8 }}>
            <img className="ui-button__icon" src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
            <span className="ui-button__label">Cancel</span>
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
