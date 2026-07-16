import { useState } from 'react'
import { randomAvatar } from '../../lib/avatarConfig'
import { AvatarMaker } from './AvatarMaker'

export function AvatarDevSandbox() {
  const [config, setConfig] = useState(() => randomAvatar())
  return (
    <div className="avatar-dev-sandbox" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'radial-gradient(ellipse at 50% 60%, #2a1200 0%, #0a0800 60%, #000 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
    }}>
      <div style={{ color: '#c8a860', fontFamily: 'inherit', fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', opacity: 0.6 }}>Avatar Maker — Dev Preview</div>
      <AvatarMaker initial={config} onSave={(c) => setConfig(c)} onCancel={() => {}} />
    </div>
  )
}
