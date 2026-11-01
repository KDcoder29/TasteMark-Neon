import { describe, it, expect } from 'vitest'
import { installMode, showInstall, inviteFriend, INSTALL_CAPTURE_SCRIPT } from '@/lib/install'
import { earlyStart } from '@/lib/earlyStart'

const UA = {
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  instagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0',
  facebookIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]',
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  winChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  winEdge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  winFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
}
const mode = (ua, more = {}) => installMode({ ua, standalone: false, canPrompt: false, installed: false, touch: 0, ...more })

describe('installMode: what the /install page offers on this phone or laptop', () => {
  it('already running as the installed app, or just installed', () => {
    expect(mode(UA.androidChrome, { standalone: true })).toBe('installed')
    expect(mode(UA.iphoneSafari, { standalone: true })).toBe('installed')
    expect(mode(UA.androidChrome, { installed: true })).toBe('installed')
  })
  it('the one-tap Install button where the browser offers it', () => {
    expect(mode(UA.androidChrome, { canPrompt: true })).toBe('prompt')
    expect(mode(UA.androidSamsung, { canPrompt: true })).toBe('prompt')
    expect(mode(UA.winEdge, { canPrompt: true })).toBe('prompt')
  })
  it('iPhone and iPad: the Share → Add to Home Screen steps', () => {
    expect(mode(UA.iphoneSafari)).toBe('ios')
    expect(mode(UA.iphoneChrome)).toBe('ios')
    expect(mode(UA.ipadDesktopMode, { touch: 5 })).toBe('ios')
  })
  it('inside Instagram or Facebook: open it in the real browser first', () => {
    expect(mode(UA.instagram)).toBe('in-app')
    expect(mode(UA.instagram, { canPrompt: true })).toBe('in-app')
    expect(mode(UA.facebookIos)).toBe('in-app')
  })
  it('Android or a laptop browser without the button yet: the browser menu way', () => {
    expect(mode(UA.androidChrome)).toBe('android-menu')
    expect(mode(UA.winChrome)).toBe('desktop-menu')
  })
  it('browsers that cannot install it: use it right here', () => {
    expect(mode(UA.winFirefox)).toBe('unsupported')
    expect(mode(UA.macSafari)).toBe('unsupported')
    expect(mode('')).toBe('unsupported')
  })
})

describe('INSTALL_CAPTURE_SCRIPT (in the page head, before the app loads)', () => {
  it('keeps the browser’s install offer for later and notes an install', () => {
    const listeners = {}, events = []
    const win = { addEventListener: (t, f) => { listeners[t] = f }, dispatchEvent: e => events.push(e.type) }
    new Function('window', 'Event', INSTALL_CAPTURE_SCRIPT)(win, class { constructor(t) { this.type = t } })
    const offer = { prompt() {} }
    listeners.beforeinstallprompt(offer)
    expect(win.__bmInstall).toBe(offer)
    listeners.appinstalled()
    expect(win.__bmInstall).toBe(null)
    expect(win.__bmInstalled).toBe(true)
    expect(events).toEqual(['bm-install', 'bm-install'])
  })
})

describe('/install opens without logging in', () => {
  it('is not sent to /login by the early hop', () => {
    expect(earlyStart('/install', '', () => ({ getItem: () => null })).login).toBe(null)
  })
})

describe('showInstall: the Install button in the top bar, the sidebar and on the login screen', () => {
  it('shows wherever installing is possible, even if it takes steps', () => {
    for (const m of ['prompt', 'ios', 'in-app', 'android-menu', 'desktop-menu']) expect(showInstall(m)).toBe(true)
  })
  it('hidden once installed, and where the browser cannot install', () => {
    expect(showInstall('installed')).toBe(false)
    expect(showInstall('unsupported')).toBe(false)
  })
})

describe('inviteFriend: Invite a friend never does nothing', () => {
  const url = 'https://bitemark-chi.vercel.app/install'
  it('the phone share menu first', async () => {
    let shared = null
    expect(await inviteFriend({ url, share: async d => { shared = d }, copy: async () => {} })).toBe('shared')
    expect(shared.url).toBe(url)
  })
  it('closing the share menu is not an error', async () => {
    const abort = Object.assign(new Error('x'), { name: 'AbortError' })
    expect(await inviteFriend({ url, share: async () => { throw abort }, copy: async () => {} })).toBe('cancelled')
  })
  it('no share menu, or it failed: copies the link', async () => {
    let copied = ''
    expect(await inviteFriend({ url, share: null, copy: async t => { copied = t } })).toBe('copied')
    expect(copied).toBe(url)
    const denied = Object.assign(new Error('x'), { name: 'NotAllowedError' })
    expect(await inviteFriend({ url, share: async () => { throw denied }, copy: async () => {} })).toBe('copied')
  })
  it('neither works: show the link to copy by hand', async () => {
    expect(await inviteFriend({ url, share: null, copy: async () => { throw new Error('blocked') } })).toBe('show')
    expect(await inviteFriend({ url, share: null, copy: null })).toBe('show')
  })
})

