'use client'
import Icon from '@/components/ui/Icons'
import { useInstall } from '@/hooks/install'
import { showInstall } from '@/lib/install'

// "Install" wherever BiteMark isn't installed yet: one tap to the browser's own "Install app?" where
// it offers one, else the steps on /install. Hidden once installed and where browsers can't install.
//   look: 'pill' (phone top bar) | 'side' (laptop sidebar) | 'tile' (login screen, beside Try the demo)
export default function InstallButton({ look = 'pill', label = 'Install' }) {
  const { mode, install } = useInstall()
  if (!showInstall(mode)) return null
  const go = () => { if (mode === 'prompt') install(); else window.location.href = '/install' }
  if (look === 'side') return <button className="side-item" onClick={go}><Icon name="download" size={18} /> Install app</button>
  if (look === 'tile') return <button type="button" className="btn inst-btn-a flex-1" onClick={go}><Icon name="download" size={16} /> {label}</button>
  return (
    <button className="inst-pill" onClick={go} aria-label="Install BiteMark on this phone">
      <Icon name="download" size={16} stroke={2.4} /> {label}
    </button>
  )
}
