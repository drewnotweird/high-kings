import { ScrollPage } from './ScrollPage'

// Reusable piece shapes -------------------------------------------------------
const ATK = '#3d1e0a'    // dark brown attacker fill
const DEF = '#7a5228'    // darker tan defender (contrasts parchment)
const KING_FILL = '#8c6518' // deep gold king fill
const KING_C = '#c8a96e'  // gold accent colour
const GRID = 'rgba(60,28,0,0.22)'
const SPECIAL = 'rgba(200,169,110,0.35)'

function Piece({ cx, cy, r = 10, type = 'atk' }: { cx: number; cy: number; r?: number; type?: 'atk' | 'def' | 'king' }) {
  const fill = type === 'atk' ? ATK : type === 'king' ? KING_FILL : DEF
  const strokeC = type === 'atk' ? '#1a0a02' : type === 'king' ? '#4a3008' : '#3a2010'
  const kr = type === 'king' ? r * 1.2 : r
  return (
    <g>
      <ellipse cx={cx} cy={cy + kr * 0.2} rx={kr * 0.9} ry={kr * 0.22} fill="rgba(0,0,0,0.22)" />
      <circle cx={cx} cy={cy} r={kr} fill={fill} stroke={strokeC} strokeWidth={1.5} />
      <ellipse cx={cx - kr * 0.28} cy={cy - kr * 0.3} rx={kr * 0.2} ry={kr * 0.14} fill="rgba(255,255,255,0.28)" />
      {type === 'king' && <>
        <line x1={cx} y1={cy - kr * 0.8} x2={cx} y2={cy - kr * 0.45} stroke={KING_C} strokeWidth={2} strokeLinecap="round"/>
        <circle cx={cx} cy={cy - kr * 0.8} r={kr * 0.15} fill={KING_C}/>
      </>}
    </g>
  )
}

function Grid({ cols, rows, size, ox = 0, oy = 0, specials = [] as [number,number][], throne = false }: {
  cols: number; rows: number; size: number; ox?: number; oy?: number; specials?: [number,number][]; throne?: boolean
}) {
  const corners: [number,number][] = [[0,0],[0,cols-1],[rows-1,0],[rows-1,cols-1]]
  return (
    <g>
      {Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>{
        const isCorner = corners.some(([cr,cc])=>cr===r&&cc===c)
        const isThrone = throne && r === Math.floor(rows/2) && c === Math.floor(cols/2)
        const isSpecial = specials.some(([sr,sc])=>sr===r&&sc===c)
        const fill = (isCorner||isThrone||isSpecial) ? SPECIAL : 'rgba(60,28,0,0.04)'
        const stroke = (isCorner||isThrone||isSpecial) ? KING_C : GRID
        const sw = (isCorner||isThrone||isSpecial) ? 1.5 : 0.7
        return <rect key={`${r}-${c}`} x={ox+c*size} y={oy+r*size} width={size-1} height={size-1} fill={fill} stroke={stroke} strokeWidth={sw} rx={(isCorner||isThrone)?2:0}/>
      }))}
    </g>
  )
}

function Illustration({ label }: { label: string }) {
  const svgs: Record<string, React.ReactNode> = {
    'intro-map': (
      <svg viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes im-route { 0%{stroke-dashoffset:320;opacity:0} 15%{opacity:1} 80%{stroke-dashoffset:0;opacity:1} 100%{stroke-dashoffset:0;opacity:0} }
          @keyframes im-ship  { 0%{transform:translate(0,0)} 80%{transform:translate(68px,-30px)} 100%{transform:translate(68px,-30px)} }
          @keyframes im-dot   { 0%,100%{opacity:0.35} 50%{opacity:1} }
          @keyframes im-ring  { 0%{r:6;opacity:0.7} 100%{r:18;opacity:0} }
          .im-r1{stroke-dasharray:320;animation:im-route 5s ease-in-out infinite;}
          .im-r2{stroke-dasharray:260;animation:im-route 5s ease-in-out infinite;animation-delay:1.8s;}
          .im-r3{stroke-dasharray:180;animation:im-route 5s ease-in-out infinite;animation-delay:3.2s;}
          .im-ship{animation:im-ship 5s ease-in-out infinite;}
          .im-dot{animation:im-dot 3s ease-in-out infinite;}
          .im-ring{animation:im-ring 2s ease-out infinite;fill:none;stroke:#c8a96e;stroke-width:1.2;}
        `}</style>
        {/* Scandinavia */}
        <path d="M190 40 Q205 28 225 38 Q245 28 258 50 Q270 75 255 100 Q268 122 252 145 Q235 168 215 158 Q198 174 182 158 Q162 142 167 118 Q148 100 162 78 Q145 55 190 40Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Britain */}
        <path d="M70 95 Q88 75 106 88 Q118 108 112 132 Q100 150 84 144 Q65 132 70 95Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Ireland */}
        <path d="M45 115 Q58 100 68 118 Q64 138 48 138 Q35 130 45 115Z" fill="none" stroke={KING_C} strokeWidth="1.5" opacity="0.22"/>
        {/* Sea routes */}
        <path className="im-r1" d="M88 115 C130 80 165 85 180 105" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <path className="im-r2" d="M180 105 C225 90 255 100 270 120" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <path className="im-r3" d="M88 115 C100 148 132 165 162 162" fill="none" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        {/* Moving longship */}
        <g className="im-ship" style={{transformOrigin:'88px 115px'}}>
          <ellipse cx="88" cy="115" rx="8" ry="4" fill={ATK} opacity="0.9"/>
          <line x1="88" y1="111" x2="88" y2="102" stroke={KING_C} strokeWidth="1.5"/>
          <path d="M88 102 L97 107 L88 110Z" fill={KING_C} opacity="0.9"/>
        </g>
        {/* Location dots with ring pulse */}
        {([
          [88,115,0],[182,105,0.9],[162,162,1.8],[270,120,2.7],[50,115,3.6]
        ] as [number,number,number][]).map(([x,y,d],i)=>(
          <g key={i}>
            <circle cx={x} cy={y} r="5" fill={KING_C} className="im-dot" style={{animationDelay:`${d}s`}}/>
            <circle cx={x} cy={y} r="5" fill="none" stroke={KING_C} strokeWidth="1.5" className="im-ring" style={{animationDelay:`${d}s`}}/>
          </g>
        ))}
        <text x="200" y="192" fill={KING_C} fontSize="10" fontFamily="MedievalSharp,cursive" opacity="0.6" textAnchor="middle">Northern Europe  ·  400–1400 AD</text>
      </svg>
    ),
    'board-overview': (
      <svg viewBox="0 0 260 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes bo-c{0%,100%{opacity:0.45}50%{opacity:1}}
          .bo-c1{animation:bo-c 3s ease-in-out infinite;}
          .bo-c2{animation:bo-c 3s ease-in-out .75s infinite;}
          .bo-c3{animation:bo-c 3s ease-in-out 1.5s infinite;}
          .bo-c4{animation:bo-c 3s ease-in-out 2.25s infinite;}
          @keyframes bo-t{0%,100%{opacity:0.5}50%{opacity:1}}
          .bo-throne{animation:bo-t 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={7} rows={7} size={30} ox={20} oy={20} throne/>
        <rect className="bo-c1" x={21} y={21} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c2" x={21+6*30} y={21} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c3" x={21} y={21+6*30} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-c4" x={21+6*30} y={21+6*30} width={28} height={28} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <rect className="bo-throne" x={21+3*30} y={21+3*30} width={28} height={28} fill="rgba(200,169,110,0.18)" stroke={KING_C} strokeWidth={1.5} rx={3}/>
        <Piece cx={20+3*30+14} cy={20+3*30+14} r={7} type="king"/>
        <text x="35" y="14" textAnchor="middle" fill={KING_C} fontSize="8.5" fontFamily="MedievalSharp,cursive">escape</text>
        <line x1="35" y1="16" x2="35" y2="21" stroke={KING_C} strokeWidth="1" opacity="0.5"/>
        <text x="130" y="240" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Throne · Corners are escape squares</text>
      </svg>
    ),
    'two-sides': (
      <svg viewBox="0 0 380 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ts-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
          .ts-a{animation:ts-bob 2.8s ease-in-out infinite;}
          .ts-d{animation:ts-bob 2.8s ease-in-out 1.4s infinite;}
        `}</style>
        <g className="ts-a">
          <text x="80" y="20" textAnchor="middle" fill={KING_C} fontSize="12" fontFamily="MedievalSharp,cursive" letterSpacing="2">ATTACKERS</text>
          <Piece cx={26} cy={75} r={11} type="atk"/>
          <Piece cx={52} cy={75} r={11} type="atk"/>
          <Piece cx={78} cy={75} r={11} type="atk"/>
          <Piece cx={104} cy={75} r={11} type="atk"/>
          <Piece cx={130} cy={75} r={11} type="atk"/>
          <Piece cx={39} cy={105} r={11} type="atk"/>
          <Piece cx={65} cy={105} r={11} type="atk"/>
          <Piece cx={91} cy={105} r={11} type="atk"/>
          <text x="80" y="142" textAnchor="middle" fill="rgba(60,28,0,0.55)" fontSize="10" fontFamily="MedievalSharp,cursive">More pieces · Surround</text>
        </g>
        <text x="190" y="95" textAnchor="middle" fill={KING_C} fontSize="22" fontFamily="MedievalSharp,cursive">vs</text>
        <g className="ts-d">
          <text x="300" y="20" textAnchor="middle" fill={KING_C} fontSize="12" fontFamily="MedievalSharp,cursive" letterSpacing="2">DEFENDERS</text>
          <Piece cx={248} cy={75} r={11} type="def"/>
          <Piece cx={274} cy={75} r={11} type="def"/>
          <Piece cx={300} cy={75} r={11} type="def"/>
          <Piece cx={326} cy={75} r={11} type="def"/>
          <Piece cx={274} cy={105} r={11} type="def"/>
          <Piece cx={300} cy={105} r={13} type="king"/>
          <Piece cx={326} cy={105} r={11} type="def"/>
          <text x="300" y="142" textAnchor="middle" fill="rgba(60,28,0,0.55)" fontSize="10" fontFamily="MedievalSharp,cursive">Fewer · Escort the King</text>
        </g>
      </svg>
    ),
    'movement': (
      <svg viewBox="0 0 340 160" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes mv-slide{0%,15%{transform:translateX(0)}70%,100%{transform:translateX(230px)}}
          @keyframes mv-trail{0%,10%{stroke-dashoffset:230;opacity:0}30%{opacity:0.7}70%{stroke-dashoffset:0;opacity:0.7}85%,100%{opacity:0}}
          @keyframes mv-dest{0%,65%{opacity:0}80%,100%{opacity:1}}
          .mv-piece{animation:mv-slide 3.5s ease-in-out infinite;transform-box:fill-box;}
          .mv-trail{stroke-dasharray:230;animation:mv-trail 3.5s ease-in-out infinite;}
          .mv-dest{animation:mv-dest 3.5s ease-in-out infinite;}
        `}</style>
        {[0,1,2,3,4,5,6].map(c=>(
          <rect key={c} x={10+c*46} y={50} width={45} height={45}
            fill={c===5?'rgba(200,169,110,0.18)':'rgba(60,28,0,0.04)'}
            stroke={c===5?KING_C:GRID} strokeWidth={c===5?1.5:0.8} rx={c===5?2:0}/>
        ))}
        <line className="mv-trail" x1="32" y1="72" x2="262" y2="72" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
        <g className="mv-dest">
          <rect x={241} y={51} width={43} height={43} fill="rgba(200,169,110,0.2)" stroke={KING_C} strokeWidth="1.5" strokeDasharray="4 2" rx={2}/>
        </g>
        <g className="mv-piece">
          <Piece cx={32} cy={72} r={11} type="atk"/>
        </g>
        <text x="170" y="130" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Any distance · Straight lines · No jumping</text>
      </svg>
    ),
    'capture': (
      <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes cap-move{0%,10%{transform:translateX(0)}60%,100%{transform:translateX(56px)}}
          @keyframes cap-fade{0%,55%{opacity:1;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.4)}}
          @keyframes cap-flash{0%,58%{opacity:0;transform:scale(0.5)}72%{opacity:1;transform:scale(1)}90%,100%{opacity:0;transform:scale(1.4)}}
          .cap-mover{animation:cap-move 4s ease-in-out infinite;transform-box:fill-box;}
          .cap-victim{animation:cap-fade 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .cap-burst{animation:cap-flash 4s ease-in-out infinite;transform-box:fill-box;}
        `}</style>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} x={10+c*56} y={60} width={55} height={55} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <g className="cap-mover"><Piece cx={37} cy={87} r={13} type="atk"/></g>
        <g className="cap-victim"><Piece cx={150} cy={87} r={13} type="def"/></g>
        <Piece cx={206} cy={87} r={13} type="atk"/>
        <g className="cap-burst" style={{transformOrigin:'150px 87px'}}>
          {[0,45,90,135,180,225,270,315].map((a,i)=>(
            <line key={i}
              x1={150+Math.cos(a*Math.PI/180)*15} y1={87+Math.sin(a*Math.PI/180)*15}
              x2={150+Math.cos(a*Math.PI/180)*24} y2={87+Math.sin(a*Math.PI/180)*24}
              stroke={KING_C} strokeWidth="2.5" strokeLinecap="round"/>
          ))}
          <circle cx="150" cy="87" r="11" fill="rgba(200,169,110,0.35)" stroke={KING_C} strokeWidth="1.5"/>
        </g>
        <text x="150" y="148" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Sandwich between two of your own</text>
      </svg>
    ),
    'hostile-squares': (
      <svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes hs-glow{0%,100%{opacity:0.45}50%{opacity:1}}
          @keyframes hs-fade{0%,60%{opacity:1;transform:scale(1)}80%,100%{opacity:0;transform:scale(1.4)}}
          .hs-sq{animation:hs-glow 2.5s ease-in-out infinite;}
          .hs-vic{animation:hs-fade 3.5s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        {/* 4-cell row */}
        {[0,1,2,3].map(c=>(
          <rect key={c} x={10+c*70} y={55} width={69} height={69} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        {/* Left = empty corner acting as captor */}
        <rect className="hs-sq" x={11} y={56} width={67} height={67} fill={SPECIAL} stroke={KING_C} strokeWidth={2} rx={3}/>
        <text x="45" y="88" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">Corner</text>
        {/* Victim (defender) in cell 1 */}
        <g className="hs-vic"><Piece cx={115} cy={89} r={15} type="def"/></g>
        {/* Cell 2 = attacker */}
        <Piece cx={185} cy={89} r={15} type="atk"/>
        {/* Cell 3 = empty throne */}
        <rect x={221} y={56} width={67} height={67} fill="rgba(200,169,110,0.2)" stroke={KING_C} strokeWidth="1.5" strokeDasharray="4 2" rx={3}/>
        <text x="255" y="88" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">Throne</text>
        {/* Ring burst */}
        <text x="150" y="168" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Empty corner or Throne counts as captor</text>
      </svg>
    ),
    'king-capture': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes kc-mover{0%,5%{transform:translateX(-110px)}50%,100%{transform:translateX(0)}}
          @keyframes kc-king{0%,55%{opacity:1;transform:scale(1)}75%,100%{opacity:0;transform:scale(1.4)}}
          .kc-mover{animation:kc-mover 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .kc-king{animation:kc-king 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20} throne/>
        <Piece cx={120} cy={80}  r={11} type="atk"/>
        <Piece cx={120} cy={160} r={11} type="atk"/>
        <Piece cx={160} cy={120} r={11} type="atk"/>
        <g className="kc-mover"><Piece cx={80} cy={120} r={11} type="atk"/></g>
        <g className="kc-king"><Piece cx={120} cy={120} r={12} type="king"/></g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Final attacker seals all four sides</text>
      </svg>
    ),
    'king-escape': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ke-go{0%,10%{transform:translateX(0)}65%,100%{transform:translateX(-80px)}}
          @keyframes ke-trail{0%,8%{stroke-dashoffset:80;opacity:0}20%{opacity:0.85}62%{stroke-dashoffset:0;opacity:0.85}75%,100%{opacity:0}}
          @keyframes ke-burst{0%,65%{opacity:0;r:6}75%{opacity:1;r:18}90%,100%{opacity:0;r:26}}
          @keyframes ke-corner{0%,100%{opacity:0.4}50%{opacity:1}}
          .ke-king{animation:ke-go 4s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .ke-trail{stroke-dasharray:80;animation:ke-trail 4s ease-in-out infinite;}
          .ke-burst{animation:ke-burst 4s ease-in-out infinite;}
          .ke-corner{animation:ke-corner 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20}/>
        <rect className="ke-corner" x={21} y={181} width={38} height={38} fill={SPECIAL} stroke={KING_C} strokeWidth={2.5} rx={4}/>
        <text x="40" y="177" textAnchor="middle" fill={KING_C} fontSize="8" fontFamily="MedievalSharp,cursive">escape</text>
        <line className="ke-trail" x1="120" y1="200" x2="40" y2="200" stroke={KING_C} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 4"/>
        <circle className="ke-burst" cx="40" cy="200" fill="none" stroke={KING_C} strokeWidth="1.5"/>
        <g className="ke-king" style={{transformOrigin:'120px 200px'}}>
          <Piece cx={120} cy={200} r={13} type="king"/>
        </g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">King at a corner · Defenders win</text>
      </svg>
    ),
    'shieldwall': (
      <svg viewBox="0 0 320 190" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes sw-in{0%,5%{transform:translateX(-90px)}50%,100%{transform:translateX(0)}}
          @keyframes sw-die{0%,52%{opacity:1;transform:scale(1)}74%{opacity:0;transform:scale(1.4)}88%,100%{opacity:0;transform:scale(1.4)}}
          .sw-mover{animation:sw-in 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d1{animation:sw-die 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d2{animation:sw-die 3s ease-in-out .07s infinite;transform-box:fill-box;transform-origin:center;}
          .sw-d3{animation:sw-die 3s ease-in-out .14s infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        <rect x={20} y={25} width={280} height={10} fill={ATK} opacity="0.35" rx="2"/>
        <text x="160" y="20" textAnchor="middle" fill="rgba(60,28,0,0.4)" fontSize="8" fontFamily="MedievalSharp,cursive">Board edge</text>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} x={20+c*56} y={35} width={55} height={55} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <g className="sw-d1"><Piece cx={104} cy={62} r={14} type="def"/></g>
        <g className="sw-d2"><Piece cx={160} cy={62} r={14} type="def"/></g>
        <g className="sw-d3"><Piece cx={216} cy={62} r={14} type="def"/></g>
        <g className="sw-mover"><Piece cx={48} cy={62} r={14} type="atk"/></g>
        <Piece cx={272} cy={62} r={14} type="atk"/>
        <text x="160" y="160" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Flank both ends · Whole line wiped</text>
      </svg>
    ),
    'edge-escape': (
      <svg viewBox="0 0 240 250" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes ee-edge{0%,100%{opacity:0.35}50%{opacity:0.85}}
          @keyframes ee-king{0%,10%{transform:translateY(0)}65%,100%{transform:translateY(-80px)}}
          @keyframes ee-burst{0%,63%{opacity:0;r:8}77%{opacity:1;r:18}90%,100%{opacity:0;r:24}}
          .ee-edge{animation:ee-edge 2s ease-in-out infinite;}
          .ee-king{animation:ee-king 3.5s ease-in-out infinite;transform-box:fill-box;}
          .ee-burst{animation:ee-burst 3.5s ease-in-out infinite;}
        `}</style>
        <Grid cols={5} rows={5} size={40} ox={20} oy={20}/>
        {[0,1,2,3,4].map(c=>(
          <rect key={c} className="ee-edge" x={21+c*40} y={21} width={38} height={38} fill={SPECIAL} stroke={KING_C} strokeWidth={1.5} rx={2}/>
        ))}
        <text x="120" y="15" textAnchor="middle" fill={KING_C} fontSize="9" fontFamily="MedievalSharp,cursive">any edge square</text>
        <circle className="ee-burst" cx="120" cy="40" fill="none" stroke={KING_C} strokeWidth="1.5"/>
        <g className="ee-king" style={{transformOrigin:'120px 120px'}}>
          <Piece cx={120} cy={120} r={13} type="king"/>
        </g>
        <text x="120" y="242" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Tawlbwrdd · Reach any edge to win</text>
      </svg>
    ),
    'weak-king': (
      <svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes wk-in{0%,5%{transform:translateX(80px)}50%,100%{transform:translateX(0)}}
          @keyframes wk-die{0%,50%{opacity:1;transform:scale(1)}75%,100%{opacity:0;transform:scale(1.4)}}
          .wk-in{animation:wk-in 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
          .wk-king{animation:wk-die 3s ease-in-out infinite;transform-box:fill-box;transform-origin:center;}
        `}</style>
        {[0,1,2].map(c=>(
          <rect key={c} x={60+c*60} y={55} width={59} height={59} fill="rgba(60,28,0,0.04)" stroke={GRID} strokeWidth="0.8"/>
        ))}
        <Piece cx={89} cy={84} r={14} type="atk"/>
        <g className="wk-king" style={{transformOrigin:'150px 84px'}}><Piece cx={150} cy={84} r={14} type="king"/></g>
        <g className="wk-in"><Piece cx={211} cy={84} r={14} type="atk"/></g>
        <text x="150" y="148" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">Weak king — sandwiched like any other piece</text>
      </svg>
    ),
    'saami-start': (() => {
      const S = 22, OX = 2, OY = 2
      const defs: [number,number][] = [[3,4],[5,4],[4,3],[4,5],[2,4],[6,4],[4,2],[4,6]]
      const atks: [number,number][] = [[0,3],[0,4],[0,5],[3,0],[4,0],[5,0],[8,3],[8,4],[8,5],[3,8],[4,8],[5,8]]
      return (
        <svg viewBox="0 0 202 220" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={9} rows={9} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={6} type="atk"/>)}
          <Piece cx={OX+4*S+S/2} cy={OY+4*S+S/2} r={8} type="king"/>
          <text x="101" y="210" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">9 defenders · 16 attackers</text>
        </svg>
      )
    })(),
    'brandub-board': (() => {
      const S = 26, OX = 4, OY = 4
      const defs: [number,number][] = [[2,3],[4,3],[3,2],[3,4]]
      const atks: [number,number][] = [[0,3],[3,0],[6,3],[3,6],[1,3],[3,1],[5,3],[3,5]]
      return (
        <svg viewBox="0 0 196 210" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={7} rows={7} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={8} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="atk"/>)}
          <Piece cx={OX+3*S+S/2} cy={OY+3*S+S/2} r={9} type="king"/>
          <text x="98" y="199" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">4 defenders · 8 attackers</text>
        </svg>
      )
    })(),
    'ard-ri-board': (() => {
      const S = 26, OX = 4, OY = 4
      const defs: [number,number][] = [[2,3],[4,3],[3,2],[3,4],[1,3],[5,3],[3,1],[3,5]]
      const atks: [number,number][] = [[0,2],[0,3],[0,4],[2,0],[3,0],[4,0],[6,2],[6,3],[6,4],[2,6],[3,6],[4,6]]
      return (
        <svg viewBox="0 0 196 210" xmlns="http://www.w3.org/2000/svg">
          <Grid cols={7} rows={7} size={S} ox={OX} oy={OY} throne/>
          {defs.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={7} type="def"/>)}
          {atks.map(([r,c],i)=><Piece key={i} cx={OX+c*S+S/2} cy={OY+r*S+S/2} r={6} type="atk"/>)}
          <Piece cx={OX+3*S+S/2} cy={OY+3*S+S/2} r={9} type="king"/>
          <text x="98" y="199" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="9" fontFamily="MedievalSharp,cursive">8 defenders · 12 attackers</text>
        </svg>
      )
    })(),
    'alea-board': (() => {
      const s = 9, ox = 34, oy = 14
      const pc = (r: number, c: number) => ({ cx: ox + c*s + s/2, cy: oy + r*s + s/2 })
      return (
      <svg viewBox="0 0 240 224" xmlns="http://www.w3.org/2000/svg">
        <style>{`
          @keyframes al-glow{0%,100%{opacity:0.4}50%{opacity:1}}
          .al-king{animation:al-glow 2s ease-in-out infinite;}
        `}</style>
        <Grid cols={19} rows={19} size={s} ox={ox} oy={oy}/>
        {([[5,9],[9,5],[9,13],[13,9],[4,9],[9,4],[9,14],[14,9],[6,7],[6,11],[7,6],[7,12],[11,6],[11,12],[12,7],[12,11],[3,9],[9,3],[9,15],[15,9],[7,9],[9,7],[9,11],[11,9]] as [number,number][]).map(([r,c],i)=>(
          <circle key={i} {...pc(r,c)} r={3.2} fill={DEF} stroke="#7a5c2a" strokeWidth="0.6"/>
        ))}
        {([[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12],[6,0],[7,0],[8,0],[9,0],[10,0],[11,0],[12,0],[18,6],[18,7],[18,8],[18,9],[18,10],[18,11],[18,12],[6,18],[7,18],[8,18],[9,18],[10,18],[11,18],[12,18],[1,8],[1,9],[1,10],[8,1],[9,1],[10,1],[17,8],[17,9],[17,10],[8,17],[9,17],[10,17]] as [number,number][]).map(([r,c],i)=>(
          <circle key={i} {...pc(r,c)} r={2.8} fill={ATK} stroke="#1a0a02" strokeWidth="0.5"/>
        ))}
        <g className="al-king">
          <circle {...pc(9,9)} r={4} fill={KING_C} stroke="#8a6020" strokeWidth="1"/>
          <circle {...pc(9,9)} r={1.5} fill="#8a6020"/>
        </g>
        <text x="120" y="213" textAnchor="middle" fill="rgba(60,28,0,0.5)" fontSize="8" fontFamily="MedievalSharp,cursive">72 attackers · 24 defenders · 1 king</text>
      </svg>
      )
    })(),
  }

  const svg = svgs[label]
  if (!svg) return <div className="htp-illustration">{label}</div>
  return <div className="htp-illustration htp-illustration--svg">{svg}</div>
}

export function HowToPlayScroll({ onClose }: { onClose: () => void }) {
  return (
    <ScrollPage title="Rules" onClose={onClose}>
      <>
        <p>Before chess took hold, there was Hnefatafl — the Viking strategy game that dominated northern Europe for centuries, until chess arrived from the south and gradually eclipsed it.</p>
        <hr className="credits-page__rule" />
        <h2>The Core Rules</h2>
        <p>You play either the <strong>Attackers</strong>, who surround the board and outnumber their enemy, or the <strong>Defenders</strong>, who guard a King they must escort to safety. Every variant shares a core set of rules.</p>
        <p>These rules apply to every variant.</p>

        <h2>The Board</h2>
        <p>Hnefatafl is played on a square grid. The centre square is the <strong>Throne</strong> — where the King begins. The four corner squares are <strong>escape squares</strong>. Only the King may stand on either.</p>
        <Illustration label="board-overview" />

        <h2>Two Sides</h2>
        <p>The <strong>Attackers</strong> surround the board and move first. Their goal: capture the King. The <strong>Defenders</strong> are outnumbered but protect the King and escort him to a corner.</p>
        <Illustration label="two-sides" />

        <h2>Movement</h2>
        <p>Every piece moves any number of squares in a straight line — horizontally or vertically. No diagonals. No jumping. Corners and the Throne block all pieces except the King.</p>
        <Illustration label="movement" />

        <h2>Capture</h2>
        <p>Sandwich an enemy piece between two of your own on a straight line. The trapped piece is removed immediately. Moving into a sandwich voluntarily is safe — the trap only springs when you close it.</p>
        <Illustration label="capture" />

        <h2>Hostile Squares</h2>
        <p>Empty corners and the empty Throne act as phantom captors. A single friendly piece is enough to capture if an empty special square covers the other side.</p>
        <Illustration label="hostile-squares" />

        <h2>Capturing the King</h2>
        <p>The King requires all four sides sealed simultaneously — by attackers or empty special squares. One open side keeps him safe.</p>
        <Illustration label="king-capture" />

        <h2>King Escapes</h2>
        <p>Move the King to a corner square and the Defenders win. The Attackers must hold every path to every corner the entire game.</p>
        <Illustration label="king-escape" />

        <hr className="credits-page__rule" />
        <h2>The Variants</h2>
        <p>Each variant changes one or two rules. Everything else is the core game above.</p>

        <div className="htp-variants">

          <div className="htp-variant">
            <h3>Copenhagen</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · The modern standard</p>
            <p><strong>Shieldwall:</strong> A line of two or more defenders pressed against the board edge can be wiped out in a single move — flank both ends simultaneously (a corner counts as one flank). The King is immune to shieldwall capture. Strong King, corner escape.</p>
            <Illustration label="shieldwall" />
          </div>

          <div className="htp-variant">
            <h3>Fetlar</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · The Shetland ruleset</p>
            <p>Same board and piece count as Copenhagen but <strong>no shieldwall</strong>. Captures are always one-at-a-time. Strong King, corner escape. Widely played in tournament settings.</p>
          </div>

          <div className="htp-variant">
            <h3>Historical</h3>
            <p className="htp-variant__tag">11×11 or 13×13 · Reconstructed rules</p>
            <p>Based on documented historical records. <strong>Weak King:</strong> once he steps off the Throne, two attackers can sandwich him like any other piece. No shieldwall. Corner escape.</p>
          </div>

          <div className="htp-variant">
            <h3>Tawlbwrdd</h3>
            <p className="htp-variant__tag">11×11 · The Welsh board</p>
            <p><strong>Edge escape:</strong> The King wins by reaching <strong>any square on the board edge</strong> — not just the corners. Much harder to contain him. Includes shieldwall captures. Strong King.</p>
            <Illustration label="edge-escape" />
          </div>

          <div className="htp-variant">
            <h3>Linnaeus Tablut</h3>
            <p className="htp-variant__tag">9×9 · Recorded by Carl Linnaeus in 1732</p>
            <p><strong>Weak King + edge escape:</strong> Once off the Throne, the King can be sandwiched by just two attackers. He escapes to any edge square. Play is faster and more aggressive.</p>
            <Illustration label="weak-king" />
          </div>

          <div className="htp-variant">
            <h3>Saami Tablut</h3>
            <p className="htp-variant__tag">9×9 · The living tradition</p>
            <p>Same rules as Linnaeus Tablut but with a broader starting diamond for the defenders. A slightly more open, tactical opening game.</p>
            <Illustration label="saami-start" />
          </div>

          <div className="htp-variant">
            <h3>Brandub</h3>
            <p className="htp-variant__tag">7×7 · The Irish variant</p>
            <p><strong>Small board, weak King:</strong> Only four defenders and eight attackers. Corner escape. The King's vulnerability means every move matters — there is nowhere to hide.</p>
            <Illustration label="brandub-board" />
          </div>

          <div className="htp-variant">
            <h3>Ard Rí</h3>
            <p className="htp-variant__tag">7×7 · The Irish High King</p>
            <p><strong>Dense 7×7, strong King:</strong> Eight defenders and twelve attackers packed onto the smallest board. The King needs all four sides sealed. Corner escape. Tight, tactical fighting.</p>
            <Illustration label="ard-ri-board" />
          </div>

          <div className="htp-variant">
            <h3>Tyr</h3>
            <p className="htp-variant__tag">15×15 · Modern design by Aage Nielsen</p>
            <p><strong>Weak King, edge escape, no Throne:</strong> The centre square has no special properties — pieces may pass through it freely and it does not assist captures. Edge escape, weak King. The largest competitive board size.</p>
          </div>

          <div className="htp-variant">
            <h3>Simple Tyr</h3>
            <p className="htp-variant__tag">11×11 · Tyr rules on a standard board</p>
            <p>All the Tyr rules — weak King, edge escape, no special Throne — on an 11×11 board. A good entry point to the Tyr family.</p>
          </div>

          <div className="htp-variant">
            <h3>Alea Evangelii</h3>
            <p className="htp-variant__tag">19×19 · The epic</p>
            <p>72 attackers. 24 defenders. A 19×19 board. The same core rules — strong King, corner escape — but the scale changes everything. Openings are deeper, endgames longer, and the King's journey is a true odyssey.</p>
            <Illustration label="alea-board" />
          </div>

        </div>

      </>
    </ScrollPage>
  )
}
