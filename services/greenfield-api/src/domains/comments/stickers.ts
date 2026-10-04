/** First-party sticker packs. Emoji-based so they render crisply on every client without asset hosting. */
export type Sticker = {id: string; emoji: string; label: string}
export type StickerPack = {id: string; title: string; icon: string; stickers: Sticker[]}

const pack = (id: string, title: string, icon: string, entries: Array<[string, string]>): StickerPack => ({
  id, title, icon,
  stickers: entries.map(([emoji, label], index) => ({id: `${id}-${index + 1}`, emoji, label})),
})

export const STICKER_PACKS: StickerPack[] = [
  pack('modula-reactions', 'Reactions', '🔥', [
    ['🔥', 'Fire'], ['💯', 'Hundred'], ['👏', 'Applause'], ['🙌', 'Raise hands'], ['😂', 'Tears of joy'], ['🤯', 'Mind blown'],
    ['😍', 'Heart eyes'], ['🥹', 'Touched'], ['😮', 'Wow'], ['🤔', 'Thinking'], ['👀', 'Eyes'], ['🫡', 'Salute'],
  ]),
  pack('modula-love', 'Love', '💜', [
    ['💜', 'Purple heart'], ['❤️', 'Red heart'], ['🩵', 'Light blue heart'], ['💖', 'Sparkling heart'], ['🫶', 'Heart hands'], ['😘', 'Kiss'],
    ['🥰', 'Smiling hearts'], ['💐', 'Bouquet'], ['🌹', 'Rose'], ['💌', 'Love letter'], ['🤗', 'Hug'], ['✨', 'Sparkles'],
  ]),
  pack('modula-celebrate', 'Celebrate', '🎉', [
    ['🎉', 'Party popper'], ['🥳', 'Party face'], ['🎊', 'Confetti'], ['🏆', 'Trophy'], ['🥂', 'Cheers'], ['🎂', 'Birthday cake'],
    ['🚀', 'Rocket'], ['⭐️', 'Star'], ['🌟', 'Glowing star'], ['🎁', 'Gift'], ['🪩', 'Mirror ball'], ['🍾', 'Champagne'],
  ]),
  pack('modula-animals', 'Animals', '🐶', [
    ['🐶', 'Dog'], ['🐱', 'Cat'], ['🦊', 'Fox'], ['🐼', 'Panda'], ['🐨', 'Koala'], ['🦁', 'Lion'],
    ['🐸', 'Frog'], ['🐧', 'Penguin'], ['🦄', 'Unicorn'], ['🐙', 'Octopus'], ['🦦', 'Otter'], ['🐝', 'Bee'],
  ]),
  pack('modula-food', 'Food', '🍕', [
    ['🍕', 'Pizza'], ['🍔', 'Burger'], ['🌮', 'Taco'], ['🍣', 'Sushi'], ['🍩', 'Doughnut'], ['🍪', 'Cookie'],
    ['☕️', 'Coffee'], ['🧋', 'Bubble tea'], ['🍿', 'Popcorn'], ['🥑', 'Avocado'], ['🍓', 'Strawberry'], ['🍦', 'Ice cream'],
  ]),
]

const BY_ID = new Map(STICKER_PACKS.flatMap(p => p.stickers.map(s => [s.id, {pack: p, sticker: s}] as const)))

export function findSticker(stickerId: unknown) {
  return typeof stickerId === 'string' ? BY_ID.get(stickerId) ?? null : null
}
