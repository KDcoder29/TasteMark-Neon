import Icon from './Icons'
import Logo from './Logo'

// The pictures for each tour scene: small animated copies of the real screens with sample data.
// Motion is CSS only (.ts-* in index.css); `d` = delay in ms. A scene restarts its animations
// because Tour.jsx re-mounts it with a new key.
const d = ms => ({ animationDelay: `${ms}ms` })
const mute = { color: 'var(--mute)' }

const Stars = ({ n, from = 0 }) => (
  <span className="inline-flex">
    {[1, 2, 3, 4, 5].map(i => (
      <span key={i} className={i <= n ? 'ts-star' : ''} style={{ color: i <= n ? 'var(--star)' : 'var(--star-off)', ...(i <= n ? d(from + i * 160) : {}) }}>★</span>
    ))}
  </span>
)

function Card({ letter, color, name, where, line, tag, delay = 0 }) {
  return (
    <div className="pcard ts-in !p-3" style={d(delay)}>
      <span className="mono h-11 w-11 text-lg" style={{ background: color }}>{letter}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="flex items-center justify-between gap-2"><b className="truncate text-[15px]">{name}</b>{tag && <span className="lovetag">{tag}</span>}</span>
        <span className="block text-xs" style={mute}>{where}</span>
        {line && <span className="mt-0.5 block text-xs"><span className="must">Must try:</span> {line}</span>}
      </span>
    </div>
  )
}

function Row({ name, price, stars, note, delay = 0, again }) {
  return (
    <div className="ts-in flex items-start justify-between gap-3 border-t border-dashed py-2.5 first:border-t-0" style={{ borderColor: 'var(--line)', ...d(delay) }}>
      <span className="min-w-0 text-left">
        <b className="block text-[14px]">{name}</b>
        {again && <span className="pill pill-ok mt-0.5">Order again</span>}
        {note && <span className="block text-xs" style={mute}>{note}</span>}
      </span>
      <span className="shrink-0 text-right"><b className="block text-[14px]">{price}</b>{stars != null && <Stars n={stars} from={delay} />}</span>
    </div>
  )
}

const Tap = ({ x, y, delay }) => <span className="ts-tap" style={{ left: x, top: y, ...d(delay) }} aria-hidden="true" />

const SCENES = {
  welcome: () => (
    <div className="grid gap-2.5">
      <div className="ts-pop mx-auto mb-2"><Logo size={64} /></div>
      <Card letter="S" color="#b8541a" name="Sankalp" where="Alkapuri, Vadodara · Food" line="Masala dosa" tag="♥ 3 loved" delay={300} />
      <Card letter="C" color="#7a5236" name="Coffea" where="Canal Rd, Vadodara · Cafe" line="Hazelnut cold coffee" tag="♥ 1 loved" delay={500} />
      <Card letter="B" color="#2f7d5b" name="Bajrang Bhajiya" where="Nilamber circle · Food" delay={700} />
    </div>
  ),

  scan: () => (
    <div className="grid gap-3">
      <div className="ts-bill ts-in relative mx-auto w-[78%] overflow-hidden rounded-md px-4 py-3 text-left font-mono text-[12px]">
        <div className="mb-1 text-center font-bold">SANKALP</div>
        <div className="flex justify-between"><span>MASALA DOSA</span><span>180.00</span></div>
        <div className="flex justify-between"><span>FILTER COFFEE</span><span>60.00</span></div>
        <div className="flex justify-between"><span>IDLI SAMBAR</span><span>80.00</span></div>
        <div className="mt-1 flex justify-between border-t border-dashed pt-1" style={{ borderColor: '#0003' }}><b>TOTAL</b><b>320.00</b></div>
        <span className="ts-scanline" />
      </div>
      <div className="card !p-3 text-left">
        <Row name="Masala Dosa" price="₹180" delay={1700} />
        <Row name="Filter Coffee" price="₹60" delay={1950} />
        <Row name="Idli Sambar" price="₹80" delay={2200} />
      </div>
    </div>
  ),

  voice: () => (
    <div className="grid gap-3">
      <div className="voicebar on ts-in text-left">
        <span className="micbtn on"><Icon name="mic" size={22} stroke={2.2} /></span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm">Listening…</b>
          <span className="ts-say text-[13px]">Sankalp, masala dosa, 180 rupees, 5 stars, crispy</span>
        </span>
      </div>
      <div className="card ts-pop !p-3 text-left" style={d(2600)}>
        <div className="mb-1 flex items-center gap-2 text-xs" style={mute}><Icon name="pin" size={13} /> Sankalp</div>
        <Row name="Masala Dosa" price="₹180" stars={5} note="Crispy" delay={2700} />
      </div>
    </div>
  ),

  rate: () => (
    <div className="card ts-in grid gap-3 !p-4 text-left">
      <div className="flex gap-2"><span className="input !py-2">Paneer Chettinad</span><span className="input !w-24 !py-2">₹390</span></div>
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold" style={mute}>Your rating *</span>
        <span className="text-2xl"><Stars n={4} from={300} /></span></div>
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold" style={mute}>Order again?</span>
        <span className="seg"><button className="seg-yes ts-on" style={d(1500)}>Yes</button><button>Maybe</button><button>No</button></span></div>
      <span className="input !py-2"><span className="ts-say" style={d(1900)}>Rich gravy, a bit spicy. Must order!</span></span>
    </div>
  ),

  find: () => (
    <div className="grid gap-2.5 text-left">
      <div className="searchbar ts-in"><Icon name="search" size={18} style={mute} /><span className="ts-type py-3 text-[15px]">dosa</span></div>
      <div className="flex flex-wrap gap-2">
        {['Vadodara', 'Food', 'Under ₹200', '4★ & up'].map((c, i) => <span key={c} className="chip ts-on" style={d(900 + i * 250)}>{c}</span>)}
      </div>
      <Card letter="2" color="#b8541a" name="22 Parallel" where="Vadodara · Food" line="Cheese Plain Dosa" tag="♥ 6 loved" delay={2000} />
      <Card letter="S" color="#b8541a" name="Sankalp" where="Alkapuri, Vadodara · Food" line="Masala dosa" tag="♥ 3 loved" delay={2200} />
    </div>
  ),

  craving: () => (
    <div className="grid gap-2.5 text-left">
      <div className="ts-in ml-auto max-w-[80%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm" style={{ background: 'var(--pri)', color: 'var(--on-pri)' }}>
        <span className="ts-type">south indian under ₹150</span>
      </div>
      {[['Idli Sambar', 'Sankalp · Vadodara', '₹80', 4], ['Medu Vada', '22 Parallel · Vadodara', '₹90', 4], ['Filter Coffee', 'Sankalp · Vadodara', '₹60', 5]].map(([n, w, p, s], i) => (
        <div key={n} className="card ts-in !p-3" style={d(1500 + i * 250)}>
          <div className="flex justify-between gap-2"><b className="text-sm">{n}</b><b className="text-sm">{p}</b></div>
          <div className="flex items-center justify-between text-xs" style={mute}><span>{w}</span><Stars n={s} from={1500 + i * 250} /></div>
          <span className="text-xs font-semibold" style={{ color: 'var(--accent-ink)' }}>Same food family</span>
        </div>
      ))}
    </div>
  ),

  pick: () => (
    <div className="grid gap-3">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
        <Icon name="dice" size={40} className="ts-roll" />
      </div>
      <div className="card ts-pop !p-4 text-left" style={d(1800)}>
        <span className="pill pill-ok">A favourite</span>
        <b className="mt-1 block text-xl">Curators Cafe</b>
        <span className="flex items-center gap-1 text-sm" style={mute}><Icon name="pin" size={14} /> Sarabhai Campus, Vadodara</span>
        <Row name="Frappe Mocha" price="₹290" stars={5} delay={2100} />
      </div>
    </div>
  ),

  wish: () => (
    <div className="wcard ts-in relative text-left">
      <div className="flex gap-3">
        <span className="mono h-11 w-11 text-lg" style={{ background: '#b8541a' }}>B</span>
        <span className="min-w-0 flex-1"><b className="block">Bajrang Bhajiya</b><span className="text-xs" style={mute}>Nilamber circle, Vadodara</span>
          <span className="wnote block">Riya says the methi pakoda is a must</span></span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="btn btn-pri relative !px-3.5 !py-2 !text-sm"><Icon name="check" size={16} stroke={2.6} /> We went</span>
        <span className="btn !px-3.5 !py-2 !text-sm"><Icon name="map" size={16} /> Maps</span>
      </div>
      <Tap x="22%" y="82%" delay={1300} />
      <div className="ts-pop mt-3 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: 'var(--okbg)', color: 'var(--ok)', ...d(2000) }}>
        Added to your journal. Now rate what you ate.
      </div>
    </div>
  ),

  near: () => (
    <div className="grid gap-2.5 text-left">
      <div className="seg nearseg ts-in mx-auto">
        <span className="!px-3"><Icon name="list" size={15} /> List</span>
        <span className="ts-on !px-3" style={d(500)}><Icon name="map" size={15} /> Map</span>
      </div>
      <div className="ts-map ts-in relative overflow-hidden rounded-2xl" style={d(700)} aria-hidden="true">
        <svg viewBox="0 0 300 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <path d="M-10 112 C70 96 120 128 310 84" className="ts-map-water" />
          <path d="M-10 46 L310 62 M64 -10 L92 160 M188 -10 L172 160 M-10 136 L310 128" className="ts-map-road" />
          <path d="M120 -10 C132 50 230 70 240 160" className="ts-map-road thin" />
        </svg>
        <span className="mk-me ts-pop absolute" style={{ left: '44%', top: '52%', ...d(1000) }} />
        {[['20%', '26%', '#2f7d5b', 1300], ['60%', '20%', '#b8541a', 1450], ['74%', '58%', '#2f7d5b', 1600]].map(([x, y, c, ms]) => (
          <span key={x} className="ts-pin ts-pop absolute" style={{ left: x, top: y, ...d(ms) }}><span className="mk" style={{ '--c': c }}><i /></span></span>
        ))}
        <span className="ts-pin ts-pop absolute" style={{ left: '28%', top: '62%', ...d(1750) }}><span className="mk mk-approx" style={{ '--c': '#7a5236' }}><i /></span></span>
        <Tap x="62%" y="26%" delay={2300} />
      </div>
      <div className="nearcard ts-pop" style={d(2700)}>
        <div className="nearcard-main !pb-2">
          <span className="mono h-11 w-11 text-lg" style={{ background: '#b8541a' }}>S</span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-2"><b className="truncate text-[15px]">Sankalp</b><span className="neardist">850 m</span></span>
            <span className="block text-xs" style={mute}>Alkapuri, Vadodara · Food</span>
          </span>
        </div>
        <div className="flex gap-2 px-3.5 pb-3">
          <span className="btn btn-pri !px-3 !py-1.5 !text-sm"><Icon name="navigate" size={15} /> Directions</span>
          <span className="btn !px-3 !py-1.5 !text-sm">Details</span>
        </div>
      </div>
    </div>
  ),

  groups: () => (
    <div className="grid gap-3 text-left">
      <div className="flex items-center justify-center gap-[-6px]">
        {[['K', '#3d6b8a'], ['S', '#7a8a3d'], ['R', '#8a3d6b'], ['M', '#3d8a6b']].map(([l, c], i) => (
          <span key={l} className="ts-pop -ml-2 grid h-12 w-12 place-items-center rounded-full border-[3px] text-lg font-bold text-white first:ml-0"
            style={{ background: c, borderColor: 'var(--surface)', ...d(200 + i * 200) }}>{l}</span>
        ))}
      </div>
      <div className="card ts-in !p-3" style={d(1000)}>
        <b className="block">Naivedyam</b><span className="text-xs" style={mute}>Langotiyas · 4 members</span>
        <Row name="Paneer Chettinad" price="₹390" stars={5} note="4.5★ average · 3 ratings" delay={1300} again />
        <div className="flex gap-2 pt-1">
          {['👍 2', '🔥 3', '😋 1'].map((r, i) => <span key={r} className="chip ts-pop !px-2.5 !py-1" style={d(2000 + i * 200)}>{r}</span>)}
        </div>
      </div>
    </div>
  ),

  send: () => (
    <div className="grid gap-3">
      <div className="ts-rise mx-auto w-[82%] overflow-hidden rounded-2xl text-left shadow-xl" style={{ background: '#fff', color: '#17201c' }}>
        <div className="px-4 pb-3 pt-4" style={{ background: '#1d6b4f', borderTop: '5px solid #f26b1d', color: '#fff' }}>
          <b className="block text-lg">Sankalp</b><span className="text-xs" style={{ color: '#cfe6db' }}>Alkapuri, Vadodara</span>
        </div>
        <div className="px-4 py-2 text-[13px]">
          <div className="text-xs" style={{ color: '#5f6b66' }}>What to order</div>
          <div className="flex justify-between py-1"><b>Masala Dosa</b><b style={{ color: '#1d6b4f' }}>₹180</b></div>
          <div className="flex justify-between py-1"><b>Filter Coffee</b><b style={{ color: '#1d6b4f' }}>₹60</b></div>
          <div className="pt-1 text-[11px] font-bold" style={{ color: '#1d6b4f' }}>BiteMark</div>
        </div>
      </div>
      <span className="btn btn-pri ts-in mx-auto !py-2 !text-sm" style={d(1600)}><Icon name="send" size={16} /> Share picture</span>
      <Tap x="50%" y="88%" delay={2300} />
    </div>
  ),

  story: () => (
    <div className="story ts-in !m-0 text-left">
      <p className="m-0 text-[13px] font-semibold" style={mute}>Your food story in Personal</p>
      <div className="story-nums">
        {[['44', 'places'], ['160', 'dishes'], ['3', 'cities']].map(([v, l], i) => <div key={l} className="ts-pop" style={d(300 + i * 200)}><b>{v}</b><span>{l}</span></div>)}
      </div>
      {[['heart', 'Favourite dish', 'Masala Dosa at Sankalp'], ['sparkle', 'Your go-to food', 'South Indian'], ['repeat', 'Would order again', '62% of dishes']].map(([ic, l, v], i) => (
        <div key={l} className="story-row ts-in" style={d(1100 + i * 250)}>
          <span className="qicon !h-8 !w-8 !rounded-[10px]" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Icon name={ic} size={16} /></span>
          <span><span className="block text-xs" style={mute}>{l}</span><b className="block text-[14.5px]">{v}</b></span>
        </div>
      ))}
    </div>
  ),
}

export const hasScene = k => k in SCENES

export default function TourScene({ k }) {
  const S = SCENES[k]
  return S ? <S /> : null
}
