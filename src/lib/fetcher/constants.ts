// Shared constants for the fetcher modules (rss.ts / scraper.ts), kept in one
// place so User-Agents and timeouts stay consistent and easy to tune.

/** Browser-like UA — best for fetching RSS/XML feeds without being blocked. */
export const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Bot UA — some sites only expose og:image metadata to known crawlers. */
export const CRAWLER_USER_AGENT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

export const FETCH_TIMEOUTS = {
  /** og:image fallback fetch on an individual article page. */
  ogImage: 8000,
  /** Single page scrape (Open Graph metadata extraction). */
  scrapePage: 10000,
  /** Listing-page scrape that then crawls links. */
  scrapeSite: 15000,
} as const
