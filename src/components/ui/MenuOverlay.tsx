import { useState, useEffect } from 'react'
import { useGameSlice } from '../../store/gameStore'
import type { GameMode, Difficulty, Rules } from '../../store/gameStore'
import { Toggle, SegmentedControl, BoardSizeIcon } from './buttons'
import { BOARD_SIZE_RULES, ALL_BOARD_SIZES, VARIANT_BLURB, variantFacts } from '../../game/variants'

type PlayMode = 'Online' | 'Vs Machine' | 'Take turns'

export function MenuOverlay({ isOpen, isVisible, onResume, onNewGame, onOnlineMatch }: {
  isOpen: boolean
  isVisible: boolean
  onResume: () => void
  onNewGame: () => void
  onOnlineMatch: (rules: Rules, boardSize: number, side: 'attacker' | 'defender') => void
}) {
  const { cameraLocked, difficulty, rules, boardSize, powerSaving, playerMode, setSetting } = useGameSlice('cameraLocked', 'difficulty', 'rules', 'boardSize', 'powerSaving', 'playerMode', 'setSetting')

  const modeToPlay = (m: GameMode): PlayMode => m === '2player' ? 'Take turns' : 'Vs Machine'
  const playToMode = (p: PlayMode): GameMode => p === 'Take turns' ? '2player' : 'defender'

  const [draft, setDraft] = useState({ powerSaving, cameraLocked, difficulty, rules, boardSize, play: modeToPlay(playerMode) as PlayMode, side: (playerMode === '2player' ? 'attacker' : playerMode) as 'attacker' | 'defender' })

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

  // Picking a size keeps the current variant when it's available there
  const pickSize = (size: number) => {
    const valid = BOARD_SIZE_RULES[size] ?? []
    setDraft(d => ({ ...d, boardSize: size, rules: valid.includes(d.rules) ? d.rules : (valid[0] ?? d.rules) }))
  }

  if (!isOpen) return null

  const soloOnly = draft.play === 'Vs Machine'
  const facts = variantFacts(draft.rules, draft.boardSize)

  return (
    <div className={`menu-overlay${isVisible ? ' menu-overlay--visible' : ''}`} style={{ opacity: isVisible ? 1 : 0 }}>
      <div className="setup">
        <p className="setup__title">Setup</p>

        <div className="setup__grid">
          <div className="setup__col">
            <section className="setup__section">
              <h3 className="setup__section-title">Match</h3>
              <div className="setup__field">
                <span className="setup__field-label">Play</span>
                <SegmentedControl<PlayMode>
                  ariaLabel="Play mode"
                  options={['Online', 'Vs Machine', 'Take turns']}
                  value={draft.play}
                  onChange={v => setDraft(d => ({ ...d, play: v }))}
                />
              </div>
              <div className="setup__field" style={{ opacity: draft.play === 'Take turns' ? 0.3 : 1, pointerEvents: draft.play === 'Take turns' ? 'none' : undefined }}>
                <span className="setup__field-label">You play</span>
                <SegmentedControl<'attacker' | 'defender'>
                  ariaLabel="Side"
                  options={['defender', 'attacker']}
                  labels={{ defender: 'Defend', attacker: 'Attack' }}
                  value={draft.side}
                  onChange={v => setDraft(d => ({ ...d, side: v }))}
                />
                <span className="setup__field-hint">
                  {draft.side === 'defender' ? 'Escort the King to safety.' : 'Surround and capture the King.'}
                </span>
              </div>
              <div className="setup__field" style={{ opacity: soloOnly ? 1 : 0.3, pointerEvents: soloOnly ? undefined : 'none' }}>
                <span className="setup__field-label">Difficulty</span>
                <SegmentedControl<Difficulty>
                  ariaLabel="Difficulty"
                  options={['easy', 'medium', 'hard']}
                  labels={{ easy: 'Easy', medium: 'Medium', hard: 'Hard' }}
                  value={draft.difficulty}
                  onChange={v => setDraft(d => ({ ...d, difficulty: v }))}
                />
              </div>
            </section>

            <section className="setup__section">
              <h3 className="setup__section-title">Display</h3>
              <div className="setup__field setup__field--inline">
                <span className="setup__field-label">Power saving</span>
                <Toggle label="Power saving" on={draft.powerSaving} onClick={() => setDraft(d => ({ ...d, powerSaving: !d.powerSaving, cameraLocked: !d.powerSaving ? true : d.cameraLocked }))} />
              </div>
              <p className="setup__field-hint">Swaps the 3D board for a light 2D one.</p>
              <div className="setup__field" style={{ opacity: draft.powerSaving ? 0.3 : 1, pointerEvents: draft.powerSaving ? 'none' : undefined }}>
                <span className="setup__field-label">Camera</span>
                <SegmentedControl<'Free' | 'Top-down'>
                  ariaLabel="Camera"
                  options={['Free', 'Top-down']}
                  value={draft.powerSaving || draft.cameraLocked ? 'Top-down' : 'Free'}
                  onChange={v => setDraft(d => v === 'Top-down'
                    ? { ...d, cameraLocked: true }
                    : { ...d, cameraLocked: false, powerSaving: false })}
                />
              </div>
            </section>
          </div>

          <div className="setup__col">
            <section className="setup__section">
              <h3 className="setup__section-title">Board</h3>
              <div className="size-picker">
                {ALL_BOARD_SIZES.map(size => (
                  <button
                    key={size}
                    type="button"
                    className={`size-option${draft.boardSize === size ? ' size-option--on' : ''}`}
                    aria-pressed={draft.boardSize === size}
                    onClick={() => pickSize(size)}
                  >
                    <BoardSizeIcon size={size} />
                    <span className="size-option__label">{size}×{size}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="setup__section">
              <h3 className="setup__section-title">
                Variant
                <span className="setup__section-note">{validRulesForSize.length} on {draft.boardSize}×{draft.boardSize}</span>
              </h3>
              <div className="variant-list">
                {validRulesForSize.map(v => {
                  const f = variantFacts(v, draft.boardSize)
                  const on = draft.rules === v
                  return (
                    <button
                      key={v}
                      type="button"
                      className={`variant-card${on ? ' variant-card--on' : ''}`}
                      aria-pressed={on}
                      onClick={() => setDraft(d => ({ ...d, rules: v }))}
                    >
                      <span className="variant-card__name">{v}</span>
                      <span className="variant-card__blurb">{VARIANT_BLURB[v]}</span>
                      <span className="variant-card__badges">
                        <span className="variant-card__badge">{f.king}</span>
                        <span className="variant-card__badge">{f.escape}</span>
                        {f.extras.map(e => <span key={e} className="variant-card__badge">{e}</span>)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="setup__footer">
        <div className="setup__summary">
          <strong>{draft.rules}</strong> · {draft.boardSize}×{draft.boardSize} · {facts.attackers} attackers vs {facts.defenders} defenders and the King
        </div>

        <div className="setup__actions">
          <button
            className="menu-overlay__item menu-overlay__item--primary"
            onClick={handleResume}
            disabled={requiresNewGame}
            style={{ opacity: requiresNewGame ? 0.25 : 1, cursor: requiresNewGame ? 'default' : 'pointer' }}
          >Resume</button>
          <button
            className="menu-overlay__item menu-overlay__item--primary"
            onClick={handleNewGame}
            disabled={!restartValid}
            style={{ opacity: restartValid ? 1 : 0.35, cursor: restartValid ? 'pointer' : 'default' }}
          >{draft.play === 'Online' ? 'Find Match' : 'New Game'}</button>
        </div>
        <button className="overlay-dismiss setup__cancel" onClick={handleCancel}>
          <img src={`${import.meta.env.BASE_URL}icons/close.svg`} alt="" />
          <span>Cancel</span>
        </button>
        </div>
      </div>
    </div>
  )
}
