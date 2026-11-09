/**
 * Robust XML parser supporting both RSS 2.0 (<item>) and Atom 1.0 (<entry>)
 */
export interface ParsedFeedItem {
  title: string;
  url: string;
  description: string;
  publishedAt: string;
  author: string;
  imageUrl?: string;
}

export function parseRssOrAtomXml(
  xml: string,
  sourceName: string,
  fallbackImage: string = ''
): ParsedFeedItem[] {
  if (!xml || typeof xml !== 'string') return [];

  const isAtom = !/<rss[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const itemsRegex = isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi;
  const rawItems = xml.match(itemsRegex) || [];

  const results: ParsedFeedItem[] = [];

  for (const itemXml of rawItems) {
    // Title
    const titleMatch = itemXml.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i);
    if (!titleMatch) continue;
    const title = titleMatch[1]
      .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

    if (!title) continue;

    // URL / Link
    let url = '';
    if (isAtom) {
      const linkHrefMatch =
        itemXml.match(/<link[^>]+(?:rel=["']alternate["'][^>]+)?href=["']([^"']+)["']/i) ||
        itemXml.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (linkHrefMatch && linkHrefMatch[1]) {
        url = linkHrefMatch[1].trim();
      } else {
        const linkTagMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
        if (linkTagMatch && linkTagMatch[1]) url = linkTagMatch[1].trim();
      }

      // If id is a valid URL and link was not found
      if (!url) {
        const idMatch = itemXml.match(/<id[^>]*>([\s\S]*?)<\/id>/i);
        if (idMatch && idMatch[1] && idMatch[1].startsWith('http')) {
          url = idMatch[1].trim();
        }
      }
    } else {
      const linkMatch = itemXml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i);
      if (linkMatch && linkMatch[1]) {
        url = linkMatch[1].trim();
      }
    }

    if (!/^https?:\/\//i.test(url)) continue;

    // Description or Summary
    const descMatch = isAtom
      ? itemXml.match(/<(?:summary|content)[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:summary|content)>/i)
      : itemXml.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);

    const description = descMatch
      ? descMatch[1]
          .replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .slice(0, 350)
          .trim()
      : '';

    // Published date
    const dateMatch = isAtom
      ? itemXml.match(/<(?:published|updated)>([\s\S]*?)<\/(?:published|updated)>/i)
      : itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);

    const published = dateMatch?.[1]?.trim() ?? itemXml.match(/<dc:date>([^<]+)<\/dc:date>/i)?.[1];
    const timestamp = Date.parse((published ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim());
    if (!Number.isFinite(timestamp)) continue;
    const publishedAt = new Date(timestamp).toISOString();

    // Author
    const authorMatch = isAtom
      ? itemXml.match(/<author>[\s\S]*?<name>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/name>/i)
      : itemXml.match(/<(?:dc:creator|author)>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/(?:dc:creator|author)>/i);

    const author = authorMatch && authorMatch[1] ? authorMatch[1].replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]+>/g, '').trim() : sourceName;

    // Image URL
    let imageUrl = fallbackImage;
    const mediaMatch =
      itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/i) ||
      itemXml.match(/<enclosure[^>]+url=["']([^"']+)["']/i) ||
      itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i);
    if (mediaMatch && mediaMatch[1]) {
      imageUrl = mediaMatch[1];
    } else {
      const imgInDesc = itemXml.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (imgInDesc && imgInDesc[1]) {
        imageUrl = imgInDesc[1];
      }
    }

    results.push({
      title,
      url,
      description,
      publishedAt,
      author,
      imageUrl
    });
  }

  return results;
}
