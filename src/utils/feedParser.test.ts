import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRssOrAtomXml } from './feedParser';

test('parseRssOrAtomXml extracts items from standard RSS 2.0 XML', () => {
  const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Tech News</title>
    <item>
      <title><![CDATA[New Quantum Computer Unveiled]]></title>
      <link>https://example.com/news/quantum</link>
      <description>Scientists built a 1000-qubit processor.</description>
      <pubDate>Mon, 03 Nov 2026 14:00:00 GMT</pubDate>
      <dc:creator>Jane Doe</dc:creator>
    </item>
  </channel>
</rss>`;

  const items = parseRssOrAtomXml(rssXml, 'Tech News', 'https://example.com/fallback.jpg');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'New Quantum Computer Unveiled');
  assert.equal(items[0].url, 'https://example.com/news/quantum');
  assert.equal(items[0].description, 'Scientists built a 1000-qubit processor.');
  assert.equal(items[0].author, 'Jane Doe');
});

test('parseRssOrAtomXml extracts entries from Atom 1.0 XML (arXiv / Nature format)', () => {
  const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>arXiv cs.AI</title>
  <entry>
    <id>http://arxiv.org/abs/2611.00123v1</id>
    <title>Towards Autonomous LLM Verification Systems</title>
    <summary>We propose a rigorous verification pipeline for neural architectures.</summary>
    <published>2026-11-04T18:25:00Z</published>
    <updated>2026-11-04T18:25:00Z</updated>
    <link href="http://arxiv.org/abs/2611.00123v1" rel="alternate" type="text/html"/>
    <author>
      <name>Alan Turing</name>
    </author>
  </entry>
</feed>`;

  const items = parseRssOrAtomXml(atomXml, 'arXiv', 'https://example.com/arxiv.png');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Towards Autonomous LLM Verification Systems');
  assert.equal(items[0].url, 'http://arxiv.org/abs/2611.00123v1');
  assert.equal(items[0].author, 'Alan Turing');
  assert.equal(items[0].description, 'We propose a rigorous verification pipeline for neural architectures.');
});

test('parseRssOrAtomXml returns empty array for empty or malformed input without throwing', () => {
  assert.deepEqual(parseRssOrAtomXml('', 'Empty'), []);
  assert.deepEqual(parseRssOrAtomXml('<html><body>No feed here</body></html>', 'Invalid'), []);
});

test('ignores undated RSS entries instead of assigning the current time', () => {
  const xml = '<rss><channel><item><title>Undated</title><link>https://example.com/old</link></item></channel></rss>';
  assert.deepEqual(parseRssOrAtomXml(xml, 'Example'), []);
});

test('keeps RSS items when article content contains an entry element', () => {
  const xml = `<rss><channel><item>
    <title>
      <![CDATA[Titular de prueba]]>
    </title>
    <link>https://example.com/noticia</link>
    <pubDate>Thu, 05 Nov 2026 20:23:56 +0100</pubDate>
    <content:encoded><![CDATA[<entry>Embedded article content</entry>]]></content:encoded>
  </item></channel></rss>`;
  const [article] = parseRssOrAtomXml(xml, 'Example');
  assert.equal(article.title, 'Titular de prueba');
  assert.equal(article.publishedAt, '2026-11-05T19:23:56.000Z');
});
