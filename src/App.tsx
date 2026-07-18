import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import { Scene, getIntroDurationMs } from './components/board/Scene'
import { Board2D } from './components/board/Board2D'
import { ThemeSwitcher } from './components/ui/ThemeSwitcher'
import { useOnlineGame } from './hooks/useOnlineGame'
import type { OnlineStatus } from './hooks/useOnlineGame'
import { useLobby } from './hooks/useLobby'
import { useGameSlice, useGameStore } from './store/gameStore'
import type { PlayerSide, Rules } from './store/gameStore'
import { requestBestMove } from './game/aiClient'
import { getBoardConfig } from './game/hnefatafl'
import { rulesFromSlug, defaultSizeFor, BOARD_SIZE_RULES, ALL_BOARD_SIZES } from './game/variants'
import { supabase } from './lib/supabase'
import {
  Mist, mists, Ember, embers,
  HintButton, UndoButton, MenuButton, ProfileButton, GamesButton,
  HowToPlayButton, CreditsButton, LeaderboardButton,
} from './components/ui/buttons'
import { MenuOverlay } from './components/ui/MenuOverlay'
import {
  ScorePanel, RepetitionWarning, WinnerOverlay, RoleSelectOverlay, GuestLoginModal,
} from './components/ui/overlays'
import './styles/ui.css'

// Lazily loaded panels — none are needed for first paint
const ProfileScroll = lazy(() => import('./components/ui/ProfileScroll').then(m => ({ default: m.ProfileScroll })))
const HowToPlayScroll = lazy(() => import('./components/ui/HowToPlayScroll').then(m => ({ default: m.HowToPlayScroll })))
const CreditsScroll = lazy(() => import('./components/ui/ScrollPage').then(m => ({ default: m.CreditsScroll })))
const LeaderboardScroll = lazy(() => import('./components/ui/LeaderboardScroll').then(m => ({ default: m.LeaderboardScroll })))
const AuthModal = lazy(() => import('./components/ui/AuthModal').then(m => ({ default: m.AuthModal })))
const LobbyPanel = lazy(() => import('./components/ui/LobbyPanel').then(m => ({ default: m.LobbyPanel })))
const AvatarDevSandbox = lazy(() => import('./components/ui/AvatarDevSandbox').then(m => ({ default: m.AvatarDevSandbox })))

function App() {
  const [introStarted, setIntroStarted] = useState(false)
  const [uiVisible, setUiVisible] = useState(false)
  const [setupAnimating, setSetupAnimating] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuVisible, setMenuVisible] = useState(false)
  const [hudMinimized, setHudMinimized] = useState(() => localStorage.getItem('highkings-hud-minimized') === '1')
  const [showCredits, setShowCredits] = useState(false)
  const [showHowToPlay, setShowHowToPlay] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [winnerDismissed, setWinnerDismissed] = useState(false)
  const [displayWinner, setDisplayWinner] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false)
  const [showLobby, setShowLobby] = useState(false)
  const [showGuestLogin, setShowGuestLogin] = useState(false)
  const [lobbyDraft, setLobbyDraft] = useState<{ rules: Rules; boardSize: number; side: 'attacker' | 'defender' } | null>(null)
  const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({ type: 'idle' })
  const pendingLobby = useRef<{ rules: Rules; boardSize: number; side: 'attacker' | 'defender' } | null>(null)
  const { currentTurn, resetGame, powerSaving, setSetting, pieces, dyingPieces, winner, playerMode, setPlayerMode, machineMove, difficulty, rules, boardSize, selectedId, selectPiece, movePiece, history, undoMove, gameKey, roleSelectOpen, setRoleSelectOpen, userId, username, elo, setElo, setAuth, setAuthReady, lastMove, repetitionWarning, confirmRepetitionMove, cancelRepetitionMove } = useGameSlice('currentTurn', 'resetGame', 'powerSaving', 'setSetting', 'pieces', 'dyingPieces', 'winner', 'playerMode', 'setPlayerMode', 'machineMove', 'difficulty', 'rules', 'boardSize', 'selectedId', 'selectPiece', 'movePiece', 'history', 'undoMove', 'gameKey', 'roleSelectOpen', 'setRoleSelectOpen', 'userId', 'username', 'elo', 'setElo', 'setAuth', 'setAuthReady', 'lastMove', 'repetitionWarning', 'confirmRepetitionMove', 'cancelRepetitionMove')

  // Merge matched status instead of replacing — prevents broadcasts overwriting DB-fetched names/ELOs
  const handleOnlineStatusChange = useCallback((status: OnlineStatus) => {
    if (status.type === 'matched') {
      setOnlineStatus(prev => ({
        ...status,
        opponentName: status.opponentName || (prev.type === 'matched' ? prev.opponentName : ''),
        opponentElo: status.opponentElo ?? (prev.type === 'matched' ? prev.opponentElo : null),
        opponentId: status.opponentId ?? (prev.type === 'matched' ? prev.opponentId : null),
      }))
    } else {
      setOnlineStatus(status)
    }
  }, [])

  const { startGame, watchGame, stopWatching, sendMove, endGame } = useOnlineGame(handleOnlineStatusChange)

  const handleGameStart = useCallback(async (gameId: string, mySide: 'attacker' | 'defender', gameRules: string, gameBoardSize: number) => {
    setSetting('rules', gameRules as Rules)
    setSetting('boardSize', gameBoardSize as never)
    setPlayerMode(mySide)
    resetGame()
    startGame(gameId, mySide)
    setShowLobby(false)
    setMenuOpen(false)
    // Fetch both players' names + ELOs directly from DB — avoids broadcast timing issues
    const { data } = await supabase
      .from('games')
      .select('attacker_id, defender_id, attacker:attacker_id(username, elo), defender:defender_id(username, elo)')
      .eq('id', gameId)
      .single()
    if (data) {
      const me = mySide === 'attacker' ? (data.attacker as any) : (data.defender as any)
      const opp = mySide === 'attacker' ? (data.defender as any) : (data.attacker as any)
      const oppId = mySide === 'attacker' ? (data as any).defender_id : (data as any).attacker_id
      if (me?.elo != null) setElo(me.elo)
      setOnlineStatus({ type: 'matched', gameId, opponentName: opp?.username ?? '…', opponentElo: opp?.elo ?? null, opponentId: oppId ?? null })
    }
  }, [setSetting, setPlayerMode, resetGame, startGame, setElo, setOnlineStatus])

  const { challenges, myChallenge, activeGames, hostChallenge, cancelChallenge, acceptChallenge } = useLobby(userId, username ?? null, handleGameStart)

  const handleWatch = useCallback(async (game: import('./hooks/useLobby').ActiveGame) => {
    setSetting('rules', game.rules as Rules)
    setSetting('boardSize', game.board_size as never)
    resetGame()
    watchGame(game.id)
    setShowLobby(false)
    setMenuOpen(false)
  }, [setSetting, resetGame, watchGame])

  // Restore session on mount, listen for auth changes
  useEffect(() => {
    const authTimeout = setTimeout(() => setAuthReady(true), 5000)
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(authTimeout)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('username, elo, avatar').eq('id', session.user.id).single()
        setAuth(session.user.id, profile?.username ?? null, profile?.elo ?? null, profile?.avatar ?? null)
      }
      setAuthReady(true)
    }).catch(() => { clearTimeout(authTimeout); setAuthReady(true) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') { setAuth(null, null); return }
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('username, elo, avatar').eq('id', session.user.id).single()
        const resolvedUsername = profile?.username ?? null
        setAuth(session.user.id, resolvedUsername, profile?.elo ?? null, profile?.avatar ?? null)
        // After email confirmation, username will be null — prompt them to choose one
        if (event === 'SIGNED_IN' && !resolvedUsername) {
          setShowUsernamePrompt(true)
        }
        // If the user just authenticated to open the lobby, open it now
        if (pendingLobby.current) {
          const pending = pendingLobby.current
          pendingLobby.current = null
          setShowGuestLogin(false)
          setLobbyDraft(pending)
          setShowLobby(true)
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  // Stable hint move — computed once per hint session, cleared on turn change or new game
  const hintMove = useRef<{ pieceId: string; toRow: number; toCol: number } | null>(null)
  useEffect(() => { hintMove.current = null }, [currentTurn, winner])

  // Auto-dismiss repetition warning if the game ends or is reset (covers online games where state changes externally)
  useEffect(() => {
    if (repetitionWarning) cancelRepetitionMove()
  }, [winner, gameKey])

  // Track whether any move has been made this game (for undo button fade-in)
  const [hasMoved, setHasMoved] = useState(false)
  const prevTurnRef = useRef(currentTurn)
  const prevGameKeyRef = useRef(gameKey)
  useEffect(() => {
    if (gameKey !== prevGameKeyRef.current) {
      setHasMoved(false)
      prevTurnRef.current = currentTurn
      prevGameKeyRef.current = gameKey
      return
    }
    if (currentTurn !== prevTurnRef.current) {
      setHasMoved(true)
      prevTurnRef.current = currentTurn
    }
  }, [currentTurn, gameKey])

  useEffect(() => {
    if (!winner) { setDisplayWinner(null); return }
    const t = setTimeout(() => setDisplayWinner(winner), 1000)
    return () => clearTimeout(t)
  }, [winner])
  const setupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Record vs-machine game result
  useEffect(() => {
    if (!winner || !userId || playerMode === '2player' || onlineStatus.type === 'matched' || difficulty === 'easy') return
    const result = winner === playerMode ? 'win' : 'loss'
    supabase.from('game_results').insert({
      user_id: userId,
      opponent_type: 'machine',
      result,
      rules,
      board_size: boardSize,
    }).then(({ error }) => { if (error) console.error('game_results insert (machine):', error.message) })
  }, [winner, userId, playerMode, rules, boardSize, onlineStatus.type])

  // Record online game result
  useEffect(() => {
    if (!winner || !userId || onlineStatus.type !== 'matched') return
    const result = winner === playerMode ? 'win' : 'loss'
    supabase.from('game_results').insert({
      user_id: userId,
      opponent_type: 'human',
      result,
      rules,
      board_size: boardSize,
    }).then(({ error }) => { if (error) console.error('game_results insert (human):', error.message) })
  }, [winner, userId, playerMode, rules, boardSize, onlineStatus.type])

  // Broadcast moves in online games
  useEffect(() => {
    if (!lastMove || onlineStatus.type !== 'matched') return
    sendMove(lastMove.pieceId, lastMove.toRow, lastMove.toCol)
  }, [lastMove, sendMove, onlineStatus.type])

  // End online game when winner decided; refresh ELO after DB trigger runs
  useEffect(() => {
    if (!winner || onlineStatus.type !== 'matched') return
    const opponentId = onlineStatus.opponentId
    const winnerId = winner === playerMode ? userId : opponentId
    endGame(winnerId)
    if (!userId) return
    setTimeout(() => {
      supabase.from('profiles').select('elo').eq('id', userId).single()
        .then(({ data }) => { if (data?.elo != null) setElo(data.elo) })
    }, 2000)
  }, [winner, endGame, playerMode, userId, onlineStatus, setElo])

  // URL params: ?ps=true forces power-saving; ?rules=<slug>&board=<n> deep-links
  // into a variant (used by the static guide pages and shared links)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('ps') === 'true') {
      setSetting('powerSaving', true)
    }
    const rulesParam = params.get('rules')
    if (rulesParam) {
      const linkedRules = rulesFromSlug(rulesParam)
      if (linkedRules) {
        const sizeParam = parseInt(params.get('board') ?? '', 10)
        const validSizes = ALL_BOARD_SIZES.filter(n => (BOARD_SIZE_RULES[n] ?? []).includes(linkedRules))
        const size = validSizes.includes(sizeParam) ? sizeParam : defaultSizeFor(linkedRules)
        setSetting('rules', linkedRules)
        setSetting('boardSize', size as never)
        resetGame()
      }
    }
  }, [])

  // Machine player — fires after each player move when not in 2-player or online mode
  useEffect(() => {
    if (playerMode === '2player' || onlineStatus.type === 'matched' || onlineStatus.type === 'spectating' || winner || roleSelectOpen || setupAnimating) return
    const machineSide: PlayerSide = playerMode === 'attacker' ? 'defender' : 'attacker'
    if (currentTurn !== machineSide) return

    const { center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(rules, boardSize)
    const fire = () => {
      // Read fresh state — pieces may have changed (clearDyingPieces) since the effect ran
      const { pieces: freshPieces, dyingPieces: freshDying, currentTurn: freshTurn, winner: freshWinner, selectedId: freshSelected, gameKey: freshGameKey } = useGameStore.getState()
      if (freshWinner || freshTurn !== machineSide) return
      // If the player still has a piece selected, wait for them to deselect first
      if (freshSelected) { setTimeout(fire, 600); return }
      const alivePieces = freshPieces.filter(p => !freshDying.some(d => d.id === p.id))
      const posHistory = useGameStore.getState().history.map(h => h.posKey)
      requestBestMove({ pieces: alivePieces, side: machineSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone, positionHistory: posHistory }).then(move => {
        // Search ran off-thread — re-check the game hasn't moved on before applying
        const { currentTurn: nowTurn, winner: nowWinner, gameKey: nowGameKey } = useGameStore.getState()
        if (nowWinner || nowTurn !== machineSide || nowGameKey !== freshGameKey) return
        if (move) machineMove(move.pieceId, move.toRow, move.toCol)
      })
    }
    const timer = setTimeout(fire, 2200)
    return () => clearTimeout(timer)
  }, [currentTurn, playerMode, onlineStatus.type, winner, roleSelectOpen, setupAnimating])

  const startSetupAnim = () => {
    if (setupTimerRef.current) clearTimeout(setupTimerRef.current)
    setSetupAnimating(true)
    setupTimerRef.current = setTimeout(() => setSetupAnimating(false), getIntroDurationMs(pieces.length))
  }

  // In power-saving mode there's no 3D intro — show UI immediately
  useEffect(() => {
    if (powerSaving) setIntroStarted(true)
  }, [powerSaving])

  // Reset winner dismissed state when a new game starts
  useEffect(() => {
    if (!winner) setWinnerDismissed(false)
  }, [winner])

  // First visit: once the UI is in, offer the rules to newcomers
  const [showOnboardNudge, setShowOnboardNudge] = useState(false)
  useEffect(() => {
    if (uiVisible && !localStorage.getItem('highkings-onboarded')) setShowOnboardNudge(true)
  }, [uiVisible])
  const dismissNudge = (openRules: boolean) => {
    localStorage.setItem('highkings-onboarded', '1')
    setShowOnboardNudge(false)
    if (openRules) setShowHowToPlay(true)
  }

  useEffect(() => {
    localStorage.setItem('highkings-hud-minimized', hudMinimized ? '1' : '0')
  }, [hudMinimized])

  // Track when the sceneFadeIn animation completes so buttons start visibly disabled
  useEffect(() => {
    const t = setTimeout(() => setUiVisible(true), powerSaving ? 0 : 2000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      // Power-saving has no board-flip delay, so show menu instantly
      const delay = powerSaving ? 0 : 500
      const t = setTimeout(() => setMenuVisible(true), delay)
      return () => clearTimeout(t)
    } else {
      setMenuVisible(false)
    }
  }, [menuOpen, powerSaving])

  return (
    <div className="relative w-full h-full" style={{ background: '#000' }}>

      {!powerSaving && <>
        {/* Steady dark base — only fades in once loader finishes */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse at 50% 65%, #2a1200 0%, #0a0800 55%, #000 100%)', opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }} />
        {/* Flickering layers wrapped so their container fades in */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: introStarted ? undefined : 0, animation: introStarted ? 'sceneFadeIn 2.5s ease-out forwards' : 'none' }}>
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 50% 72%, #5a2400 0%, #1a0800 45%, transparent 70%)',
              animation: 'fireFlicker 2.8s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at 46% 78%, #6b2000 0%, transparent 50%)',
              animation: 'fireFlicker 1.9s ease-in-out infinite reverse',
            }}
          />
        </div>

        {/* Mist wisps — fade in container prevents snap-on */}
        {introStarted && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, animation: 'sceneFadeIn 3s ease-out forwards' }}>
            {mists.map(m => (
              <Mist
                key={m.id}
                style={{
                  left: m.left,
                  bottom: m.bottom,
                  width: m.width,
                  height: m.height,
                  ['--dur' as string]: m.dur,
                  ['--mx' as string]: m.mx,
                  ['--peak' as string]: m.peak,
                  animationDelay: m.delay,
                }}
              />
            ))}
          </div>
        )}

        {/* Ember particles — only mount after intro starts */}
        {introStarted && embers.map(e => (
          <Ember
            key={e.id}
            variant={e.variant}
            style={{
              left: e.left,
              bottom: e.bottom,
              ['--rise' as string]: e.rise,
              ['--dx1' as string]: e.dx1,
              ['--dx2' as string]: e.dx2,
              ['--dx3' as string]: e.dx3,
              ['--a1' as string]: e.a1,
              ['--a2' as string]: e.a2,
              ['--a3' as string]: e.a3,
              animationDuration: e.dur,
              animationDelay: e.delay,
            }}
          />
        ))}
      </>}

      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: onlineStatus.type === 'spectating' ? 'none' : undefined }}>
          {powerSaving
            ? <Board2D menuOpen={menuOpen} />
            : <Scene
                onIntroStart={() => { setIntroStarted(true); startSetupAnim() }}
                menuOpen={menuOpen}
                onNewGame={() => { setMenuOpen(false); startSetupAnim() }}
              />
          }
        </div>
        <MenuOverlay
          isOpen={menuOpen}
          isVisible={menuVisible}
          onResume={() => setMenuOpen(false)}
          onNewGame={() => {
            setMenuOpen(false)
            resetGame()
            startSetupAnim()
          }}
          onOnlineMatch={(r, bs, side) => {
            if (!userId) {
              pendingLobby.current = { rules: r, boardSize: bs, side }
              setShowGuestLogin(true)
            } else {
              setLobbyDraft({ rules: r, boardSize: bs, side })
              setShowLobby(true)
            }
          }}
        />
      </div>

      {introStarted && (() => {
        const vis = uiVisible && !menuOpen
        const baseStyle = (extra?: boolean): React.CSSProperties => ({
          opacity: !vis ? 0 : (setupAnimating || extra) ? 0.2 : 1,
          transition: 'opacity 0.4s ease',
          pointerEvents: (!vis || setupAnimating || extra) ? 'none' : undefined,
        })
        const panelStyle: React.CSSProperties = {
          opacity: !vis || setupAnimating ? 0 : 1,
          transition: 'opacity 0.4s ease',
          pointerEvents: !vis || setupAnimating ? 'none' : undefined,
        }
        // Slides the logo + button columns up off-screen and fades them out when minimized
        const hudMinimizeStyle: React.CSSProperties = {
          transform: hudMinimized ? 'translateY(-160%)' : 'translateY(0)',
          transition: 'transform 0.5s cubic-bezier(0.65,0,0.35,1), opacity 0.4s ease',
          ...(hudMinimized ? { opacity: 0, pointerEvents: 'none' as const } : {}),
        }
        const isOnline = onlineStatus.type === 'matched'
        const isSpectating = onlineStatus.type === 'spectating'
        const myName = username ?? 'You'
        const opponentName = isOnline ? (onlineStatus.opponentName || '…') : undefined
        const opponentElo = isOnline ? (onlineStatus.opponentElo ?? undefined) : undefined
        const myElo = elo ?? undefined
        const defenderName = playerMode === 'defender' ? (userId ? myName : undefined) : (isOnline ? opponentName : undefined)
        const attackerName = playerMode === 'attacker' ? (userId ? myName : undefined) : (isOnline ? opponentName : undefined)
        const defenderElo = playerMode === 'defender' ? myElo : (isOnline ? opponentElo : undefined)
        const attackerElo = playerMode === 'attacker' ? myElo : (isOnline ? opponentElo : undefined)

        return <>
          {/* Score panels */}
          <div className="score-panel-wrapper score-panel-wrapper--defender" style={{ left: '5vw', ...panelStyle }}>
            <ScorePanel side="defender" isActive={currentTurn === 'defender'} name={defenderName} elo={defenderElo} />
          </div>
          <div className="score-panel-wrapper score-panel-wrapper--attacker" style={{ right: '5vw', ...panelStyle }}>
            <ScorePanel side="attacker" isActive={currentTurn === 'attacker'} name={attackerName} elo={attackerElo} />
          </div>

          {/* Logo */}
          <div className="absolute top-1 md:top-[calc(3vw-10px)] left-1/2 -translate-x-1/2 z-10 pointer-events-none" style={{ ...panelStyle, ...hudMinimizeStyle }}>
            <img src={`${import.meta.env.BASE_URL}logo.webp`} alt="High Kings" className="h-32 w-auto select-none" />
          </div>

          {/* Minimise/restore toggle for the logo + button HUD */}
          <button
            className={`hud-toggle${hudMinimized ? ' hud-toggle--collapsed' : ''}`}
            aria-label={hudMinimized ? 'Show menu' : 'Hide menu'}
            onClick={() => setHudMinimized(m => !m)}
            style={{ ...baseStyle(), transition: 'top 0.5s cubic-bezier(0.65,0,0.35,1), opacity 0.4s ease' }}
          >
            <img className="hud-toggle__icon" src={`${import.meta.env.BASE_URL}icons/${hudMinimized ? 'arrow-down' : 'arrow-up'}.svg`} alt="" />
          </button>

          {/* Top-left column: Login, [Leaderboard desktop], Hint */}
          <div className="ui-col ui-col--left" style={{ ...baseStyle(), ...hudMinimizeStyle }}>
            <ProfileButton loggedIn={!!userId} onClick={() => userId ? setShowProfile(true) : setShowAuth(true)} />
            <GamesButton onClick={() => {
              if (!userId) { setShowAuth(true); return }
              setLobbyDraft({ rules, boardSize: boardSize as never, side: playerMode === 'attacker' ? 'attacker' : 'defender' })
              setShowLobby(true)
            }} />
            <LeaderboardButton onClick={() => setShowLeaderboard(true)} />
            <div style={{ opacity: isOnline || isSpectating || playerMode === '2player' ? 0 : 1, pointerEvents: (isOnline || isSpectating || playerMode === '2player') ? 'none' : undefined, transition: 'opacity 0.3s' }}>
              <HintButton onClick={() => {
                if (playerMode === '2player' || winner) return
                const humanSide: PlayerSide = playerMode === 'defender' ? 'defender' : 'attacker'
                if (currentTurn !== humanSide) return
                if (!hintMove.current) {
                  const { center, kingEscapeEdge, shieldwall, weakKing, noThrone } = getBoardConfig(rules, boardSize)
                  const alivePieces = pieces.filter(p => !dyingPieces.some(d => d.id === p.id))
                  requestBestMove({ pieces: alivePieces, side: humanSide, boardSize, center, difficulty, kingEscapeEdge, shieldwall, weakKing, noThrone, positionHistory: useGameStore.getState().history.map(h => h.posKey) }).then(move => {
                    const { currentTurn: nowTurn, winner: nowWinner } = useGameStore.getState()
                    if (nowWinner || nowTurn !== humanSide || !move) return
                    hintMove.current = move
                    selectPiece(move.pieceId)
                  })
                  return
                }
                const move = hintMove.current
                if (selectedId === move.pieceId) { hintMove.current = null; movePiece(move.toRow, move.toCol) }
                else selectPiece(move.pieceId)
              }} />
            </div>
          </div>

          {/* Top-right column: Setup, Rules, Makers, Undo */}
          <div className="ui-col ui-col--right" style={{ ...baseStyle(), ...hudMinimizeStyle }}>
            <MenuButton isOpen={false} onClick={() => setMenuOpen(o => !o)} />
            <HowToPlayButton onClick={() => setShowHowToPlay(true)} />
            <CreditsButton onClick={() => setShowCredits(true)} />
            <div style={{ opacity: isOnline || isSpectating || playerMode === '2player' ? 0 : hasMoved && history.length > 0 ? 1 : 0, pointerEvents: (isOnline || isSpectating || playerMode === '2player' || !hasMoved || history.length === 0) ? 'none' : undefined, transition: 'opacity 0.6s' }}>
              <UndoButton onClick={() => { if (history.length === 0 || setupAnimating) return; undoMove() }} />
            </div>
          </div>
        </>
      })()}

      {showOnboardNudge && !menuOpen && introStarted && (
        <div className="onboard-nudge">
          <p className="onboard-nudge__text">First time? Hnefatafl takes two minutes to learn.</p>
          <div className="onboard-nudge__actions">
            <button className="onboard-nudge__btn onboard-nudge__btn--primary" onClick={() => dismissNudge(true)}>How to play</button>
            <button className="onboard-nudge__btn" onClick={() => dismissNudge(false)}>I know the rules</button>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
      {import.meta.env.DEV && new URLSearchParams(window.location.search).get('dev') === 'avatar' && (
        <AvatarDevSandbox />
      )}
      <ThemeSwitcher />
      {showProfile && <ProfileScroll onClose={() => setShowProfile(false)} onSignIn={() => setShowAuth(true)} onPlayOnline={() => { setShowProfile(false); setLobbyDraft({ rules, boardSize: boardSize as never, side: playerMode === 'attacker' ? 'attacker' : 'defender' }); setShowLobby(true) }} />}
      {showHowToPlay && <HowToPlayScroll onClose={() => setShowHowToPlay(false)} />}
      {showCredits && <CreditsScroll onClose={() => setShowCredits(false)} />}
      {showLeaderboard && <LeaderboardScroll onClose={() => setShowLeaderboard(false)} />}
      {displayWinner && !winnerDismissed && (
        <WinnerOverlay
          winner={displayWinner as 'attacker' | 'defender'}
          playerMode={playerMode}
          powerSaving={powerSaving}
          onNewGame={() => { resetGame(); startSetupAnim() }}
          onDismiss={() => setWinnerDismissed(true)}
        />
      )}
      {roleSelectOpen && (
        <RoleSelectOverlay
          onConfirm={(mode) => {
            setPlayerMode(mode)
            resetGame()
            setRoleSelectOpen(false)
            startSetupAnim()
          }}
        />
      )}
      {repetitionWarning && <RepetitionWarning onConfirm={confirmRepetitionMove} onCancel={cancelRepetitionMove} />}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showUsernamePrompt && <AuthModal initialScreen="username" onClose={() => setShowUsernamePrompt(false)} />}
      {showGuestLogin && (
        <GuestLoginModal
          onLogin={() => { setShowGuestLogin(false); setShowAuth(true) }}
          onClose={() => { setShowGuestLogin(false); pendingLobby.current = null }}
        />
      )}
      {showLobby && lobbyDraft && (
        <LobbyPanel
          challenges={challenges}
          activeGames={activeGames}
          myChallenge={myChallenge}
          draftRules={lobbyDraft.rules}
          draftBoardSize={lobbyDraft.boardSize}
          draftSide={lobbyDraft.side}
          onHost={() => hostChallenge(lobbyDraft.rules, lobbyDraft.boardSize, lobbyDraft.side)}
          onCancel={() => cancelChallenge()}
          onAccept={acceptChallenge}
          onWatch={handleWatch}
          onClose={() => { cancelChallenge(); setShowLobby(false) }}
        />
      )}
      {onlineStatus.type === 'spectating' && (
        <div className="spectator-bar">
          <span className="spectator-bar__label">Spectating</span>
          <button className="spectator-bar__leave" onClick={() => { stopWatching(); setOnlineStatus({ type: 'idle' }); resetGame() }}>Leave</button>
        </div>
      )}
      {userId && onlineStatus.type !== 'matched' && !showLobby && challenges.length > 0 && (
        <div className="challenge-invites">
          {challenges.map(c => (
            <div key={c.id} className="challenge-invite">
              <p className="challenge-invite__label">Challenge received</p>
              <p className="challenge-invite__host">{c.host_name}</p>
              <p className="challenge-invite__detail">{c.rules} · {c.board_size}×{c.board_size}</p>
              <p className="challenge-invite__side">You play: <strong>{c.host_side === 'attacker' ? 'Defender' : 'Attacker'}</strong></p>
              <button className="challenge-invite__accept" onClick={() => acceptChallenge(c)}>Accept</button>
            </div>
          ))}
        </div>
      )}
      {onlineStatus.type === 'opponent_disconnected' && (
        <div className="disconnect-banner">
          Opponent disconnected — waiting {onlineStatus.secondsLeft}s…
        </div>
      )}
      </Suspense>
    </div>
  )
}

export default App
