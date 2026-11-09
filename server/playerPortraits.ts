export interface PlayerPortrait {
  url: string;
  creditUrl: string;
  credit: string;
}

const cache = new Map<string, { expires: number; portrait: PlayerPortrait | null }>();
const pending = new Map<string, Promise<void>>();
const headers = { 'User-Agent': 'Sentinel Sports/1.0 (local dashboard; player portraits)' };

async function lookup(ids: string[]) {
  const query = 'SELECT ?id ?image WHERE { VALUES ?id { ' + ids.map(id => '"' + id + '"').join(' ') + ' } ?player wdt:P3681 ?id ; wdt:P18 ?image . }';
  const response = await fetch('https://query.wikidata.org/sparql?' + new URLSearchParams({ query, format: 'json' }), {
    headers: { ...headers, Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(7000)
  });
  if (!response.ok) throw new Error('Wikidata unavailable');
  const payload = await response.json();
  const files = new Map<string, string>();
  for (const binding of payload.results?.bindings ?? []) {
    const url = typeof binding.image?.value === 'string' ? new URL(binding.image.value) : null;
    const file = url?.hostname === 'commons.wikimedia.org' ? url.pathname.split('/Special:FilePath/')[1] : undefined;
    if (file && ids.includes(binding.id?.value)) files.set(binding.id.value, 'File:' + decodeURIComponent(file).replaceAll('_', ' '));
  }
  const images = new Map<string, PlayerPortrait>();
  if (files.size) {
    const params = new URLSearchParams({
      action: 'query', titles: [...new Set(files.values())].join('|'), prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '120', format: 'json', formatversion: '2'
    });
    const res = await fetch('https://commons.wikimedia.org/w/api.php?' + params, { headers, signal: AbortSignal.timeout(7000) });
    if (!res.ok) throw new Error('Commons unavailable');
    const data = await res.json();
    for (const page of data.query?.pages ?? []) {
      const info = page.imageinfo?.[0];
      const license = info?.extmetadata?.LicenseShortName?.value;
      const artist = info?.extmetadata?.Artist?.value;
      if (typeof page.title !== 'string' || typeof license !== 'string' || typeof info?.thumburl !== 'string' || typeof info.descriptionurl !== 'string') continue;
      if (!/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(info.thumburl) || !/^https:\/\/commons\.wikimedia\.org\//.test(info.descriptionurl)) continue;
      const credit = [typeof artist === 'string' ? artist.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 180) : '', license].filter(Boolean).join(' · ');
      const thumb = new URL(info.thumburl);
      for (const parameter of ['utm_source', 'utm_campaign', 'utm_content']) thumb.searchParams.delete(parameter);
      images.set(page.title, { url: thumb.href, creditUrl: info.descriptionurl, credit });
    }
  }
  for (const id of ids) {
    const portrait = images.get(files.get(id) ?? '') ?? null;
    if (cache.size >= 2000) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(id, { portrait, expires: Date.now() + (portrait ? 86400000 : 3600000) });
  }
}

export async function footballPortraits(ids: string[]) {
  const missing = ids.filter(id => !pending.has(id) && (cache.get(id)?.expires ?? 0) <= Date.now());
  if (missing.length) {
    const request = lookup(missing).catch(() => {}).finally(() => {
      for (const id of missing) pending.delete(id);
    });
    for (const id of missing) pending.set(id, request);
  }
  await Promise.all(new Set(ids.flatMap(id => pending.get(id) ?? [])));
  return Object.fromEntries(ids.flatMap(id => {
    const portrait = cache.get(id)?.portrait;
    return portrait ? [[id, portrait]] : [];
  }));
}
