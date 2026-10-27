import { useEffect, useState } from 'react'
import Icon from './Icons'
import GroupDish from './GroupDish'
import PlaceBills from './PlaceBills'
import { Stars } from './shared'
import { placeSummary, placeWhere } from './placeView'
import { LovedTag, tileColor } from './PlaceCard'
import { useSheetDrag } from './useGestures'
import ShareSheet from './ShareSheet'
import { useEscape, useScrollLock } from './layers'
import { MapsButton, MapsWhere } from './MapsLinkField'

// Everything about one place: bottom sheet on phones, right-side panel on laptops.
export default function PlaceDetail({ p, me, group, names, isOwner, canEdit, onClose, onEdit, onAddDish, onShare, onChanged }) {
  const [bills, setBills] = useState(false)
  const [sending, setSending] = useState(false)    // "Send to friends" open
  const drag = useSheetDrag(onClose)
  const s = placeSummary({ dishes: p.allDishes || p.dishes })
  const dishes = p.allDishes || p.dishes || []
  const where = placeWhere(p)
  const mute = { color: 'var(--mute)' }

  useScrollLock()                                             // the page behind stays put
  useEscape(onClose)

  return (
    <>
      <div className="scrim" onMouseDown={onClose} />
      <section ref={drag} className="drawer" role="dialog" aria-modal="true" aria-label={p.name}>
        <div className="grabber" />
        <div className="flex items-start gap-3.5 px-5 pb-4 pt-3 lg:pt-6">
          <span className="mono h-16 w-16 text-2xl" style={{ background: tileColor(p) }}>{p.name.trim()[0]?.toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-[22px] font-extrabold leading-tight">{p.name}</h2>
            {where && <p className="mt-1 text-sm" style={mute}><MapsWhere place={p} where={where} /></p>}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <LovedTag s={s} of />
              {s.price && <span className="font-semibold">{s.price}</span>}
              {(p.categories || []).map(c => <span key={c} className="pill">{c}</span>)}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="ghost -mr-2 grid h-10 w-10 shrink-0 place-items-center rounded-full" style={mute}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="flex gap-2 px-5 pb-4">
          {canEdit && <button className="btn !py-2 !text-sm" onClick={onEdit}><Icon name="pencil" size={16} /> Edit</button>}
          {p.bill_photos?.length > 0 && (
            <button className="btn !py-2 !text-sm" onClick={() => setBills(true)}>
              <Icon name="receipt" size={16} /> {p.bill_photos.length === 1 ? 'Bill' : `${p.bill_photos.length} bills`}
            </button>
          )}
          {group && <button className="btn btn-pri !py-2 !text-sm" onClick={onAddDish}><Icon name="plus" size={16} /> Add a dish</button>}
          {dishes.length > 0 && (
            <button className="btn !py-2 !text-sm" onClick={() => setSending(true)} aria-label={`Send ${p.name} to friends`}>
              <Icon name="send" size={16} /> Send
            </button>
          )}
          <MapsButton place={p} className="!py-2 !text-sm" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-8">
          {p.directions && (
            <p className="mb-4 rounded-xl px-3.5 py-2.5 text-sm" style={{ background: 'var(--soft)', color: 'var(--mute)' }}>{p.directions}</p>
          )}
          <h3 className="mb-1 mt-0 text-[13px] font-bold" style={mute}>
            {dishes.length} {dishes.length === 1 ? 'DISH' : 'DISHES'}{s.againCount > 0 && ` · ${s.againCount} TO ORDER AGAIN`}
          </h3>
          {dishes.length === 0 && <p className="text-sm" style={mute}>No dishes added yet.</p>}
          <ul className="m-0 list-none p-0">
            {dishes.map((d, i) => (
              <li key={d.id} className="rise py-3.5" style={{ borderTop: i ? '1px dashed var(--line)' : 0, animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                {group ? (
                  <GroupDish d={d} me={me} names={names} isOwner={isOwner} onChanged={onChanged} />
                ) : (
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold">{d.name}</span>
                        {d.order_again === 'yes' && <span className="pill pill-ok">Order again</span>}
                      </div>
                      {d.note && <p className="m-0 mt-1 text-sm leading-relaxed" style={mute}>{d.note}</p>}
                    </div>
                    <div className="flex shrink-0 items-start gap-1">
                      <div className="text-right">
                        <div className="text-[15px] font-bold">{d.price ? '₹' + d.price : ''}</div>
                        <Stars n={d.rating || 0} />
                      </div>
                      <button onClick={() => onShare(d)} title="Add to group" aria-label={`Add ${d.name} to a group`}
                        className="ghost grid h-9 w-9 place-items-center rounded-full" style={{ color: 'var(--pri)' }}>
                        <Icon name="share" size={17} stroke={2.2} />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>
      {sending && <ShareSheet place={{ ...p, dishes }} group={group} onClose={() => setSending(false)} />}
      {bills && <PlaceBills place={p} me={me} isOwner={isOwner} names={names} onClose={() => setBills(false)} onChanged={onChanged} />}
    </>
  )
}
