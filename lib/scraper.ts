import axios from "axios";
import * as cheerio from "cheerio";

export interface ScrapeResult {
  rank: number | null;
  status: "exposed" | "not_exposed" | "deleted";
  postStats: string | null;
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.naver.com/",
};

async function resolveUrl(url: string): Promise<string> {
  if (!url.includes("naver.me")) return url;
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      maxRedirects: 5,
      timeout: 8000,
    });
    return res.request?.res?.responseUrl || url;
  } catch {
    return url;
  }
}

async function checkIfDeleted(url: string): Promise<boolean> {
  try {
    const res = await axios.get(url, {
      headers: HEADERS,
      timeout: 8000,
      maxRedirects: 5,
    });
    const html = res.data as string;
    if (
      html.includes("삭제된 게시글") ||
      html.includes("존재하지 않는") ||
      html.includes("찾을 수 없는 페이지")
    ) {
      return true;
    }
    return false;
  } catch (err: any) {
    if (err?.response?.status === 404) return true;
    return false;
  }
}

function normalizeLink(link: string): string {
  return link
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "")
    .trim();
}

function linksMatch(a: string, b: string): boolean {
  const na = normalizeLink(a);
  const nb = normalizeLink(b);
  return na === nb || na.includes(nb) || nb.includes(na);
}

export async function checkNaverRanking(
  keyword: string,
  targetLink: string
): Promise<ScrapeResult> {
  const resolvedLink = await resolveUrl(targetLink);
  const isDeleted = await checkIfDeleted(resolvedLink);
  if (isDeleted) {
    return { rank: null, status: "deleted", postStats: null };
  }

  try {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
    const response = await axios.get(searchUrl, {
      headers: HEADERS,
      timeout: 15000,
    });

    const $ = cheerio.load(response.data as string);
    let rank = 0;
    let foundRank: number | null = null;
    let postStats: string | null = null;

    // Find the cafe section using various selectors
    const cafeSectionSelectors = [
      'section[data-cr-name="cafe"]',
      "#cafe",
      ".cafe_area",
      '[class*="cafe"]',
    ];

    let cafeSection = $();
    for (const sel of cafeSectionSelectors) {
      const found = $(sel).first();
      if (found.length) {
        cafeSection = found;
        break;
      }
    }

    // If no specific cafe section, search the whole page for cafe.naver.com links
    const searchRoot = cafeSection.length ? cafeSection : $("body");

    searchRoot.find("li, .bx, [class*='item'], [class*='result']").each((_, el) => {
      const $el = $(el);
      const links = $el.find("a[href]");
      let hasCafeLink = false;

      links.each((_, linkEl) => {
        const href = $(linkEl).attr("href") || "";
        if (href.includes("cafe.naver.com") || href.includes("naver.me")) {
          hasCafeLink = true;
        }
      });

      if (hasCafeLink) {
        rank++;
        links.each((_, linkEl) => {
          const href = $(linkEl).attr("href") || "";
          if (linksMatch(href, resolvedLink) && foundRank === null) {
            foundRank = rank;
            // Try to extract post stats
            const statsEl = $el.find(
              ".etc_dsc_area, .sub_txt, .ldate, .txt_inline, [class*='stats'], [class*='info']"
            );
            if (statsEl.length) {
              postStats = statsEl
                .map((_, s) => $(s).text().trim())
                .get()
                .filter(Boolean)
                .join(" ");
            }
          }
        });
      }
    });

    // Fallback: search all cafe links on the page if section wasn't found
    if (foundRank === null && !cafeSection.length) {
      let position = 0;
      $("a[href]").each((_, linkEl) => {
        const href = $(linkEl).attr("href") || "";
        if (href.includes("cafe.naver.com")) {
          position++;
          if (linksMatch(href, resolvedLink) && foundRank === null) {
            foundRank = position;
          }
        }
      });
    }

    if (foundRank !== null) {
      return { rank: foundRank, status: "exposed", postStats };
    }
    return { rank: null, status: "not_exposed", postStats: null };
  } catch (error) {
    console.error("Naver scraping error:", error);
    return { rank: null, status: "not_exposed", postStats: null };
  }
}

export async function batchCheckRankings(
  items: Array<{ id: number; keyword: string; link: string }>
): Promise<Array<{ id: number; result: ScrapeResult }>> {
  const results = [];
  for (const item of items) {
    const result = await checkNaverRanking(item.keyword, item.link);
    results.push({ id: item.id, result });
    // Delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return results;
}
