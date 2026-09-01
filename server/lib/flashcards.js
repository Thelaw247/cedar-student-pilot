/** Only cards with a non-empty front and back can be stored or studied. */
export function usableFlashcards(cards) {
  if (!Array.isArray(cards)) return [];
  return cards
    .map((fc) => ({ front: String(fc?.front ?? '').trim(), back: String(fc?.back ?? '').trim() }))
    .filter((fc) => fc.front && fc.back);
}
