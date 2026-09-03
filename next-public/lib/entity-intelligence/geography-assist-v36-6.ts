import { administrativeGeographySuggestionsV36_6, type GeographicObservationV36_6 } from './geography-v36-6'

const LEADING = /^(?:find|show|source|search|me|candidates?|people|in|near|nearby|within|around|local|to|located|location|from|or|the)\s+/i

export function geographyPhraseFromComposerV36_6(raw: string): string {
  const text = raw.trim().replace(/\s+/g, ' ')
  if (!text) return ''
  const segments = text.split(/[,;]|\b(?:in|near|nearby|around|local to|located in|within\s+\d{1,3}\s*(?:mi|mile|miles)\s+(?:of|from)|or)\b/i)
  let phrase = (segments.at(-1) || '').trim()
  while (LEADING.test(phrase)) phrase = phrase.replace(LEADING, '').trim()
  const tokens = phrase.split(/\s+/).filter(Boolean).slice(-3)
  return tokens.join(' ')
}

export function geographyAssistSuggestionsV36_6(raw: string, limit = 8): GeographicObservationV36_6[] {
  const phrase = geographyPhraseFromComposerV36_6(raw)
  if (!phrase) return []
  const exact = administrativeGeographySuggestionsV36_6(phrase, limit)
  if (exact.length) return exact
  const finalToken = phrase.split(/\s+/).at(-1) || ''
  return administrativeGeographySuggestionsV36_6(finalToken, limit)
}
