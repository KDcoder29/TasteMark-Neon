// "Put BiteMark on your home screen" (/install, and the You menu). A website can't install itself:
// the browser always asks. Where it offers a one-tap install (Chrome, Edge, Samsung Internet) we
// keep its offer (the beforeinstallprompt event) and show our own button; elsewhere the page shows
// the steps for that browser.

// What to offer here. ua = navigator.userAgent; standalone = already running as the installed app;
// canPrompt = the browser's install offer is in hand; installed = it was just installed;
// touch = navigator.maxTouchPoints (an iPad asking for the desktop site says "Macintosh").
export function installMode({ ua = '', standalone = false, canPrompt = false, installed = false, touch = 0 }) {
  if (standalone || installed) return 'installed'
  // the browsers built into Instagram, Facebook, LINE and other apps can't install anything
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|; wv\)/.test(ua)) return 'in-app'
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch > 1)) return 'ios'
  if (canPrompt) return 'prompt'
  if (/Android/.test(ua)) return 'android-menu'
  if (/Chrome\/|Edg\//.test(ua)) return 'desktop-menu'
  return 'unsupported'
}

// In the page head (app/layout.jsx), so the browser's offer is kept even when it comes before the
// app has loaded. It doesn't stop Chrome's own install hint; it only keeps the offer for our button.
export const INSTALL_CAPTURE_SCRIPT =
  "window.addEventListener('beforeinstallprompt',function(e){window.__bmInstall=e;window.dispatchEvent(new Event('bm-install'))});" +
  "window.addEventListener('appinstalled',function(){window.__bmInstall=null;window.__bmInstalled=true;window.dispatchEvent(new Event('bm-install'))})"

// the Install buttons (top bar, sidebar, login screen, You menu): wherever installing is possible
export const showInstall = mode => mode !== 'installed' && mode !== 'unsupported'

// "Invite a friend": the phone's share menu (WhatsApp etc.), else copy the /install link, else show it
// to copy by hand — never nothing. share / copy = navigator.share / clipboard.writeText (null if missing).
// -> 'shared' | 'cancelled' (share menu closed) | 'copied' | 'show'
export async function inviteFriend({ url, share, copy }) {
  if (share) {
    try { await share({ title: 'BiteMark', text: 'My food journal app. Install it here:', url }); return 'shared' }
    catch (e) { if (e?.name === 'AbortError') return 'cancelled' }
  }
  if (copy) { try { await copy(url); return 'copied' } catch {} }
  return 'show'
}
