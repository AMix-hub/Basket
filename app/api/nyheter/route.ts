import { NextRequest, NextResponse } from "next/server";

export interface NewsItem {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  imageUrl?: string;
}

/** Decode common HTML/XML entities. */
function decodeEntities(s: string): string {
  // &amp; must come last to avoid double-decoding (e.g. &amp;lt; → &lt;, not <)
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/**
 * Strip all HTML/XML markup and return plain text.
 * Uses a character-by-character scan so no tag variation can slip through.
 * NOTE: the result is only used as React text-node content (never innerHTML),
 * so angle-bracket literals are displayed as-is by React's auto-escaping.
 */
function stripAndDecode(raw: string): string {
  // Unwrap CDATA sections first
  let text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  // Walk the string and collect only characters outside of < ... > regions
  let result = "";
  let inTag = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "<") {
      inTag = true;
    } else if (ch === ">" && inTag) {
      inTag = false;
    } else if (!inTag) {
      result += ch;
    }
  }

  return decodeEntities(result).trim();
}

/** Extract text content between two XML/HTML tags. */
function extractTag(xml: string, tag: string): string {
  const openTag = `<${tag}`;
  const closeTag = `</${tag}>`;
  const start = xml.indexOf(openTag);
  if (start === -1) return "";
  const contentStart = xml.indexOf(">", start) + 1;
  const end = xml.indexOf(closeTag, contentStart);
  if (end === -1) return "";
  return stripAndDecode(xml.slice(contentStart, end));
}

/** Extract value of an attribute from a tag. */
function extractAttr(xml: string, tag: string, attr: string): string {
  const openTag = `<${tag}`;
  const start = xml.indexOf(openTag);
  if (start === -1) return "";
  const tagEnd = xml.indexOf(">", start);
  const tagContent = xml.slice(start, tagEnd + 1);
  const attrMatch = new RegExp(`${attr}=["']([^"']+)["']`).exec(tagContent);
  return attrMatch ? attrMatch[1] : "";
}

/** Parse an RSS/Atom feed XML string into NewsItems. */
function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];

  // Handle both RSS (<item>) and Atom (<entry>) feeds
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/g;
  const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/g;

  const regex = xml.includes("<item") ? itemRegex : entryRegex;
  const isAtom = !xml.includes("<item");

  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const block = match[1];

    const title = extractTag(block, "title");
    const pubDate = isAtom
      ? extractTag(block, "published") || extractTag(block, "updated")
      : extractTag(block, "pubDate") || extractTag(block, "dc:date");
    const description = extractTag(block, "description") ||
      extractTag(block, "summary") ||
      extractTag(block, "content");
    const link = isAtom
      ? extractAttr(block, "link", "href") || extractTag(block, "link")
      : extractTag(block, "link");

    // Try to find an image (enclosure, media:thumbnail, or img in description)
    let imageUrl = extractAttr(block, "enclosure", "url");
    if (!imageUrl) {
      const mediaThumb = /<media:thumbnail[^>]+url=["']([^"']+)["']/i.exec(block);
      if (mediaThumb) imageUrl = mediaThumb[1];
    }
    if (!imageUrl) {
      const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(description);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    if (title) {
      items.push({ title, link, description, pubDate, imageUrl: imageUrl || undefined });
    }
  }

  return items;
}

/** Attempt to fetch an RSS feed from the given base URL. */
async function fetchRss(baseUrl: string): Promise<NewsItem[] | null> {
  const candidates = [
    `${baseUrl.replace(/\/$/, "")}/feed`,
    `${baseUrl.replace(/\/$/, "")}/feed/`,
    `${baseUrl.replace(/\/$/, "")}/rss`,
    `${baseUrl.replace(/\/$/, "")}/rss.xml`,
    `${baseUrl.replace(/\/$/, "")}/atom.xml`,
    `${baseUrl.replace(/\/$/, "")}/nyheter/feed`,
    `${baseUrl.replace(/\/$/, "")}/news/feed`,
  ];

  for (const feedUrl of candidates) {
    try {
      const res = await fetch(feedUrl, {
        headers: { "User-Agent": "SportIQ/1.0 (news aggregator)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (
        contentType.includes("xml") ||
        contentType.includes("rss") ||
        contentType.includes("atom")
      ) {
        const xml = await res.text();
        const items = parseRss(xml);
        if (items.length > 0) return items;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Scrape news items from plain HTML as a last resort. */
async function scrapeHtml(pageUrl: string): Promise<NewsItem[]> {
  const res = await fetch(pageUrl, {
    headers: { "User-Agent": "SportIQ/1.0 (news aggregator)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const items: NewsItem[] = [];
  // Match common article/news card patterns: <article> or elements with common class names
  const articleRegex = /<article[^>]*>([\s\S]*?)<\/article>/gi;
  let match: RegExpExecArray | null;

  while ((match = articleRegex.exec(html)) !== null && items.length < 10) {
    const block = match[1];
    // Try to find heading
    const headingMatch =
      /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/i.exec(block);
    if (!headingMatch) continue;
    const title = stripAndDecode(headingMatch[1]);
    if (!title) continue;

    // Try to find a link
    const linkMatch = /href=["']([^"'#][^"']*?)["']/i.exec(block);
    let link = linkMatch ? linkMatch[1] : "";
    if (link && !link.startsWith("http")) {
      const base = new URL(pageUrl);
      link = link.startsWith("/")
        ? `${base.protocol}//${base.host}${link}`
        : `${base.protocol}//${base.host}/${link}`;
    }

    // Try to find an image
    const imgMatch = /<img[^>]+src=["']([^"']+)["']/i.exec(block);
    const imageUrl = imgMatch ? imgMatch[1] : undefined;

    items.push({ title, link, description: "", pubDate: "", imageUrl });
  }

  return items;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json(
      { error: "Saknar url-parameter." },
      { status: 400 }
    );
  }

  let baseUrl: string;
  try {
    const parsed = new URL(rawUrl);
    // Only allow http(s) to avoid SSRF via other protocols
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("invalid protocol");
    }
    // Block private / loopback addresses
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "0.0.0.0" ||
      hostname === "::1"
    ) {
      return NextResponse.json(
        { error: "Privata adresser är inte tillåtna." },
        { status: 400 }
      );
    }
    baseUrl = parsed.origin + parsed.pathname.replace(/\/$/, "");
  } catch {
    return NextResponse.json(
      { error: "Ogiltig URL." },
      { status: 400 }
    );
  }

  try {
    // 1. Try RSS first
    const rssItems = await fetchRss(baseUrl);
    if (rssItems && rssItems.length > 0) {
      return NextResponse.json({ items: rssItems.slice(0, 20), source: "rss" });
    }

    // 2. Fall back to HTML scraping
    const htmlItems = await scrapeHtml(baseUrl);
    if (htmlItems.length > 0) {
      return NextResponse.json({ items: htmlItems.slice(0, 20), source: "html" });
    }

    return NextResponse.json({ items: [], source: "none" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Okänt fel";
    return NextResponse.json(
      { error: `Kunde inte hämta nyheter: ${message}` },
      { status: 502 }
    );
  }
}
