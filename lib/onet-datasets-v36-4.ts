import 'server-only'

export const ONET_VERSION_V36_4 = '31.0' as const
export const ONET_DATA_ORIGIN_V36_4 = 'https://www.onetcenter.org'
export const ONET_DATA_ROOT_V36_4 = '/dl_files/database/db_31_0_json'
export const ONET_CACHE_SECONDS_V36_4 = 60 * 60 * 24 * 7
export const ONET_ATTRIBUTION_V36_4 = 'O*NET® is a trademark of the U.S. Department of Labor, Employment and Training Administration. O*NET 31.0 Database data is used under the Creative Commons Attribution 4.0 International license.'

export type OnetDatasetV36_4<T> = { row?: T[] }

const datasetPromises = new Map<string, Promise<OnetDatasetV36_4<unknown>>>()

/**
 * Shared O*NET 31.0 downloadable-dataset reader. Next data caching handles cold
 * starts; the module promise cache avoids reparsing large JSON files repeatedly
 * inside a warm server instance.
 */
export async function fetchOnetDatasetV36_4<T>(file: string): Promise<OnetDatasetV36_4<T>> {
  if (!/^[a-z0-9_]+\.json$/.test(file)) throw new Error('Unsupported O*NET data file.')
  let existing = datasetPromises.get(file)
  if (!existing) {
    const url = `${ONET_DATA_ORIGIN_V36_4}${ONET_DATA_ROOT_V36_4}/${file}`
    existing = fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json', 'user-agent': 'SourcingOS/1.0 recruiting-intelligence' },
      next: { revalidate: ONET_CACHE_SECONDS_V36_4 },
      signal: AbortSignal.timeout(25_000),
    }).then(async response => {
      if (!response.ok) throw new Error(`O*NET dataset returned ${response.status}.`)
      return response.json() as Promise<OnetDatasetV36_4<unknown>>
    }).catch(error => {
      datasetPromises.delete(file)
      throw error
    })
    datasetPromises.set(file, existing)
  }
  return existing as Promise<OnetDatasetV36_4<T>>
}
