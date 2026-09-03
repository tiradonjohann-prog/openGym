import { useUI } from '../store/useUI.js'
export default function Toast() {
  const msg  = useUI(s => s.toastMsg)
  const type = useUI(s => s.toastType)
  return <div id="toast" className={[msg ? 'show' : '', type || ''].filter(Boolean).join(' ')}>{msg}</div>
}
