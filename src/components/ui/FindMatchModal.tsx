import type { OnlineStatus } from '../../hooks/useOnlineGame'
import { useGameStore } from '../../store/gameStore'
import type { Rules } from '../../store/gameStore'

interface Props {
  status: OnlineStatus
  searchRules?: Rules
  searchBoardSize?: number
  onCancel: () => void
  onClose: () => void
}

export function FindMatchModal({ status, searchRules, searchBoardSize, onCancel, onClose }: Props) {
  const { rules, boardSize } = useGameStore()
  const displayRules = searchRules ?? rules
  const displayBoardSize = searchBoardSize ?? boardSize

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

        {isSearching && (
          <div className="find-match-modal__searching">
            <div className="find-match-modal__spinner" />
            <p>Searching for opponent…</p>
            <p className="find-match-modal__settings-summary">{displayRules} · {displayBoardSize}×{displayBoardSize}</p>
            <button className="find-match-modal__cancel-btn" onClick={onCancel}>Cancel</button>
          </div>
        )}

        {isMatched && status.type === 'matched' && (
          <div className="find-match-modal__matched">
            <p>Match found!</p>
            <p className="find-match-modal__opponent">vs <strong>{status.opponentName || '…'}</strong></p>
            <p className="find-match-modal__settings-summary">{displayRules} · {displayBoardSize}×{displayBoardSize}</p>
          </div>
        )}

        {isDisconnected && status.type === 'opponent_disconnected' && (
          <div className="find-match-modal__disconnected">
            <p>Opponent disconnected</p>
            <p>Waiting {status.secondsLeft}s…</p>
          </div>
        )}

        {!isSearching && !isMatched && !isDisconnected && (
          <div className="find-match-modal__searching">
            <div className="find-match-modal__spinner" />
            <p>Connecting…</p>
          </div>
        )}
      </div>
    </div>
  )
}
