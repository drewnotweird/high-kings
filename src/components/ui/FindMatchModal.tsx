import { useState, useEffect } from 'react'
import type { OnlineStatus } from '../../hooks/useOnlineGame'
import { useGameStore } from '../../store/gameStore'
import type { Rules } from '../../store/gameStore'

const BOARD_SIZE_RULES: Record<number, Rules[]> = {
  7:  ['Brandub', 'Ard Rí'],
  9:  ['Linnaeus Tablut', 'Saami Tablut'],
  11: ['Copenhagen', 'Fetlar', 'Historical', 'Tawlbwrdd', 'Simple Tyr'],
  13: ['Copenhagen', 'Fetlar', 'Historical'],
  15: ['Tyr'],
  19: ['Alea Evangelii'],
}
const ALL_BOARD_SIZES = Object.keys(BOARD_SIZE_RULES).map(Number)

interface Props {
  status: OnlineStatus
  searchRules?: Rules
  searchBoardSize?: number
  onFindMatch: (rules: Rules, boardSize: number) => void
  onCancel: () => void
  onClose: () => void
}

export function FindMatchModal({ status, searchRules, searchBoardSize, onFindMatch, onCancel, onClose }: Props) {
  const { rules, boardSize, username } = useGameStore()
  const [localRules, setLocalRules] = useState<Rules>(searchRules ?? rules)
  const [localBoardSize, setLocalBoardSize] = useState(searchBoardSize ?? boardSize)

  const validRules = BOARD_SIZE_RULES[localBoardSize] ?? []

  useEffect(() => {
    if (searchRules) setLocalRules(searchRules)
  }, [searchRules])

  useEffect(() => {
    if (searchBoardSize) setLocalBoardSize(searchBoardSize)
  }, [searchBoardSize])

  useEffect(() => {
    if (!validRules.includes(localRules)) setLocalRules(validRules[0])
  }, [localBoardSize])

  const handleFind = () => {
    onFindMatch(localRules, localBoardSize)
  }

  const isSearching = status.type === 'searching'
  const isMatched = status.type === 'matched'
  const isDisconnected = status.type === 'opponent_disconnected'

  return (
    <div className="find-match-modal__backdrop" onClick={e => { if (e.target === e.currentTarget && !isSearching && !isMatched) onClose() }}>
      <div className="find-match-modal">
        <div className="find-match-modal__header">
          <span className="find-match-modal__title">Online Match</span>
          {!isSearching && !isMatched && (
            <button className="find-match-modal__close" onClick={onClose}>✕</button>
          )}
        </div>

        {(status.type === 'idle') && (
          <>
            <div className="find-match-modal__player">
              <span className="find-match-modal__player-name">{username ?? 'Guest'}</span>
            </div>

            <div className="find-match-modal__settings">
              <div className="find-match-modal__setting">
                <label>Board</label>
                <div className="find-match-modal__cycler">
                  <button onClick={() => {
                    const i = ALL_BOARD_SIZES.indexOf(localBoardSize)
                    setLocalBoardSize(ALL_BOARD_SIZES[(i - 1 + ALL_BOARD_SIZES.length) % ALL_BOARD_SIZES.length])
                  }}>‹</button>
                  <span>{localBoardSize}×{localBoardSize}</span>
                  <button onClick={() => {
                    const i = ALL_BOARD_SIZES.indexOf(localBoardSize)
                    setLocalBoardSize(ALL_BOARD_SIZES[(i + 1) % ALL_BOARD_SIZES.length])
                  }}>›</button>
                </div>
              </div>

              <div className="find-match-modal__setting">
                <label>Rules</label>
                <div className="find-match-modal__cycler">
                  <button onClick={() => {
                    const i = validRules.indexOf(localRules)
                    setLocalRules(validRules[(i - 1 + validRules.length) % validRules.length])
                  }} disabled={validRules.length <= 1}>‹</button>
                  <span>{localRules}</span>
                  <button onClick={() => {
                    const i = validRules.indexOf(localRules)
                    setLocalRules(validRules[(i + 1) % validRules.length])
                  }} disabled={validRules.length <= 1}>›</button>
                </div>
              </div>
            </div>

            <button className="find-match-modal__find-btn" onClick={handleFind}>
              Find Opponent
            </button>
          </>
        )}

        {isSearching && (
          <div className="find-match-modal__searching">
            <div className="find-match-modal__spinner" />
            <p>Searching for opponent…</p>
            <p className="find-match-modal__settings-summary">{localRules} · {localBoardSize}×{localBoardSize}</p>
            <button className="find-match-modal__cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        )}

        {isMatched && status.type === 'matched' && (
          <div className="find-match-modal__matched">
            <p>Match found!</p>
            <p className="find-match-modal__opponent">vs <strong>{status.opponentName || '…'}</strong></p>
            <p className="find-match-modal__settings-summary">{localRules} · {localBoardSize}×{localBoardSize}</p>
          </div>
        )}

        {isDisconnected && status.type === 'opponent_disconnected' && (
          <div className="find-match-modal__disconnected">
            <p>Opponent disconnected</p>
            <p>Waiting {status.secondsLeft}s…</p>
          </div>
        )}
      </div>
    </div>
  )
}
