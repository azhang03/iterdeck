// Motion for the study pages, with the DOM and the Web Animations API.
// The session state changes at once on every action. The old card leaves as a
// copy of its element, and the new card comes in on the real element. So an
// animation never holds a key back: a second key press starts from the new state.

export type Move =
  | { kind: 'start' } // the first card of a session: no motion
  | { kind: 'swap' } // another card with no sort: a shuffle, the next round, the next group
  | { kind: 'flip' }
  | { kind: 'next'; checked: boolean } // a sort
  | { kind: 'undo'; checked: boolean } // the result that the undo took back

const EASE_OUT = 'cubic-bezier(.2,.8,.2,1)'
const PERSPECTIVE = 'perspective(1400px)'
// A thrown card ends this far to the side, as a share of its width, and turned.
const THROW = (dir: number) => `translate(${dir * 115}%, 34px) rotate(${dir * 14}deg)`

function calm(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

const GLOW_ID = 'sort-glow'

// The glow of a sort: green for checked, amber for missed, over the element's own shadow.
function glowOver(el: HTMLElement, checked: boolean): { base: string; lit: string } {
  // A glow that still runs on this element would be read as its own shadow. Stop it first.
  for (const a of el.getAnimations()) if (a.id === GLOW_ID) a.cancel()
  const color = getComputedStyle(document.documentElement).getPropertyValue(checked ? '--color-ok' : '--color-miss').trim()
  const own = getComputedStyle(el).boxShadow
  const base = own === 'none' ? '0 0 0 0 transparent' : own
  return { base, lit: `0 0 0 3px ${color}, 0 0 30px -4px ${color}, ${base}` }
}

// A copy of the element, fixed where the element is. It plays the exit of the
// old card and removes itself.
function ghostOf(el: HTMLElement, frames: Keyframe[], options: KeyframeAnimationOptions, boxShadow?: string) {
  const box = el.getBoundingClientRect()
  const ghost = el.cloneNode(true) as HTMLElement
  ghost.inert = true
  ghost.setAttribute('aria-hidden', 'true')
  Object.assign(ghost.style, {
    position: 'fixed',
    left: `${box.left}px`,
    top: `${box.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    margin: '0',
    zIndex: '50',
    pointerEvents: 'none',
    // The copy must not replay the entrance of the card it was copied from.
    animation: 'none',
  })
  if (boxShadow) ghost.style.boxShadow = boxShadow
  document.body.append(ghost)
  const remove = () => ghost.remove()
  ghost.animate(frames, options).finished.then(remove, remove)
}

// What the old card does. Call it before the state changes, while the old card
// is still on screen. `el` is the card (plain layout) or the description panel
// (code mode), which stays in place for the next card.
export function leave(el: HTMLElement, move: Move, codeMode: boolean) {
  if (move.kind !== 'next' && move.kind !== 'flip') return
  if (move.kind === 'flip') {
    // Plain cards turn: the copy turns away, then `enter` turns the new side in.
    if (!codeMode && !calm()) {
      ghostOf(el, [{ transform: `${PERSPECTIVE} rotateX(0)` }, { transform: `${PERSPECTIVE} rotateX(90deg)` }], { duration: 120, easing: 'ease-in' })
    }
    return
  }
  const { checked } = move
  const still = calm()
  if (!still) {
    // The sort button answers a key press as it answers a click.
    const button = document.querySelector(`[data-sort="${checked ? 'check' : 'miss'}"]`)
    button?.animate([{ transform: 'scale(.9)' }, { transform: 'none' }], { duration: 160, easing: EASE_OUT })
  }
  const { base, lit } = glowOver(el, checked)
  if (codeMode || still) {
    // The panel stays and glows. With reduced motion a plain card does the same.
    el.animate([{ boxShadow: base }, { boxShadow: lit, offset: 0.3 }, { boxShadow: lit, offset: 0.6 }, { boxShadow: base }], { id: GLOW_ID, duration: 620, easing: 'ease-out' })
    return
  }
  // A plain card is thrown: right for checked, left for missed, after a small wind-up the other way.
  const dir = checked ? 1 : -1
  ghostOf(
    el,
    [
      { transform: 'none', opacity: 1, easing: 'ease-out' },
      { transform: `translate(${dir * -12}px, 0) rotate(${dir * -1.5}deg)`, opacity: 1, offset: 0.2, easing: 'cubic-bezier(.5,0,.8,.4)' },
      { transform: THROW(dir), opacity: 0 },
    ],
    { duration: 400 },
    lit,
  )
}

// What the new card does. Call it after the page shows the new card. `el` is the
// card (plain layout) or the content of the description panel (code mode).
// Returns the animation, so the caller can cancel it when the next one starts.
export function enter(el: HTMLElement, move: Move, codeMode: boolean): Animation | null {
  if (move.kind === 'start' || calm()) return null
  if (codeMode) {
    // The content fades in. After a sort it waits a beat, so the glow is seen on an empty panel.
    const from = move.kind === 'undo' ? 'translateY(-12px)' : 'translateY(8px)'
    return el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], {
      duration: 200,
      delay: move.kind === 'next' ? 110 : 0,
      fill: 'backwards',
      easing: EASE_OUT,
    })
  }
  switch (move.kind) {
    case 'flip':
      // The new side waits edge-on until the copy of the old side has turned away.
      return el.animate([{ transform: `${PERSPECTIVE} rotateX(-90deg)` }, { transform: `${PERSPECTIVE} rotateX(0)` }], {
        duration: 170,
        delay: 120,
        fill: 'backwards',
        easing: EASE_OUT,
      })
    case 'undo':
      // The card comes back from the side it was thrown to.
      return el.animate([{ transform: THROW(move.checked ? 1 : -1), opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: EASE_OUT })
    case 'next':
      // The next card rises in while the old one is on its way out.
      return el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 230, delay: 150, fill: 'backwards', easing: EASE_OUT })
    case 'swap':
      return el.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 230, easing: EASE_OUT })
  }
}
