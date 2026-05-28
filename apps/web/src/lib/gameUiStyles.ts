/** Shared Tailwind classes aligned with HUD + page design spec. */

export const gamePage =
  'min-h-screen bg-gradient-to-br from-amber-50 via-stone-100 to-yellow-50 text-stone-800'
export const gamePageCentered =
  'flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 via-stone-100 to-yellow-50 text-stone-800'

export const gameContainerForm = 'mx-auto max-w-lg px-4 py-10'
export const gameContainerWide = 'mx-auto max-w-2xl px-4 py-10'

export const gameNavLink = 'text-sm text-stone-500 transition-colors hover:text-stone-800'
export const gameNavRow = 'mb-6 flex flex-wrap items-center gap-x-4 gap-y-1'

export const gamePanel =
  'rounded-xl border border-stone-200 bg-white/70 px-5 py-4 shadow-sm backdrop-blur-sm'
export const gamePanelStack = 'space-y-4'

export const gameInput =
  'w-full rounded-xl border border-stone-200 bg-white/70 px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50'

export const gameIdentityInput =
  'w-full rounded-xl border border-transparent bg-white/40 px-3 py-2 pl-9 text-sm text-stone-800 placeholder:text-stone-400 backdrop-blur-sm transition-colors focus:border-stone-200 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-amber-200/60'

export const gameLabel = 'text-[10px] font-semibold uppercase tracking-widest text-stone-400'
export const gameTitle = 'text-xl font-black tracking-tight text-stone-800'
export const gameSectionTitle = 'text-sm font-bold text-stone-800'
export const gameTagline = 'text-sm text-stone-500'
export const gameMeta = 'text-xs text-stone-500'

export const gameBtnPrimary =
  'w-full rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold uppercase tracking-widest text-white transition-all duration-150 hover:bg-amber-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
export const gameBtnGhost =
  'rounded-xl border border-stone-200 bg-white/60 px-4 py-2 text-sm font-semibold text-stone-700 transition-all duration-150 hover:bg-white/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50'
export const gameBtnGhostFull = `${gameBtnGhost} w-full`

export const gameBtnDestructive =
  'text-xs font-semibold text-red-600 transition-colors hover:text-red-700 hover:underline'

export const gameAlertError =
  'rounded-xl border border-red-200 bg-red-50/90 px-4 py-2 text-sm text-red-800 backdrop-blur-sm shadow-sm'
export const gameAlertSuccess =
  'rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-2 text-sm text-emerald-800 backdrop-blur-sm shadow-sm'

export const gameRoomCodeBadge =
  'rounded-lg border border-stone-200 bg-stone-100 px-3 py-1 font-mono text-sm text-stone-800'

export const gameListRow =
  'flex items-center justify-between gap-3 rounded-lg border border-stone-200/80 bg-white/50 px-3 py-2'
export const gameEmptySlot =
  'flex items-center gap-3 rounded-lg border border-dashed border-stone-300/80 bg-white/30 px-3 py-2 text-sm text-stone-400'

export const gameAvatarCircle =
  'flex h-20 w-20 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-4xl shadow-md'

export const gameStatRow = 'flex items-center justify-between border-b border-stone-200/60 py-2 last:border-0'

export const gameAuthFooter = 'text-sm text-stone-500'
