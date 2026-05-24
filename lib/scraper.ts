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
    const res = await axios.get(url, { headers: HEADERS, maxRedirects: 5, timeout: 8000 });
    return res.request?.res?.responseUrl || url;
  } catch {
    return url;
  }
}

async function checkIfDeleted(url: string): Promise<boolean> {
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 8000, maxRedirects: 5 });
    const html = res.data as string;
    return html.includes("삭제된 게시글") || html.includes("존재하지 않는") || html.includes("찾을 수 없는 페이지");
  } catch (err: any) {
    if (err?.response?.status === 404) return true;
    return false;
  }
}

function extractCafePostId(url: string): string | null {
  // Extract articleid from cafe.naver.com/cafename/12345 or cafe.naver.com/ArticleRead.nhn?articleid=12345
  const m1 = url.match(/cafe\.naver\.com\/[^/?#]+\/(\d+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]articleid=(\d+)/i);
  if (m2) return m2[1];
  return null;
}

function linksMatch(a: string, b: string): boolean {
  const normalize = (u: string) => u.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "").trim();
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  // Match by post ID
  const idA = extractCafePostId(a);
  const idB = extractCafePostId(b);
  if (idA && idB && idA === idB) return true;

  return false;
}

export async function checkNaverRanking(keyword: string, targetLink: string): Promise<ScrapeResult> {
  const resolvedLink = await resolveUrl(targetLink);
  const isDeleted = await checkIfDeleted(resolvedLink);
  if (isDeleted) return { rank: null, status: "deleted", postStats: null };

  try {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
    const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data as string);

    let foundRank: number | null = null;
    let postStats: string | null = null;
    let cafeRank = 0;

    // Collect all unique cafe links in order of appearance (all sections including 인기글)
    const seen = new Set<string>();

    $("a[href]").each((_, linkEl) => {
      const href = $(linkEl).attr("href") || "";

      // Only consider cafe.naver.com links
      if (!href.includes("cafe.naver.com")) return;

      // Deduplicate: same link shouldn't count twice
      const normalized = href.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (seen.has(normalized)) return;

      // Skip navigation/menu links (very short paths)
      if (/cafe\.naver\.com\/?$/.test(href)) return;

      seen.add(normalized);
      cafeRank++;

      if (foundRank === null && linksMatch(href, resolvedLink)) {
        foundRank = cafeRank;
        // Try to grab surrounding text as stats
        const $parent = $(linkEl).closest("li, .bx, article, [class*='item'], [class*='result']");
        if ($parent.length) {
          const statsText = $parent
            .find(".etc_dsc_area, .sub_txt, .ldate, .txt_inline, [class*='info'], [class*='stats'], [class*='date']")
            .map((_, el) => $(el).text().trim())
            .get()
            .filter(Boolean)
            .join(" ");
          if (statsText) postStats = statsText;
        }
      }
    });

    if (foundRank !== null) return { rank: foundRank, status: "exposed", postStats };
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return results;
}
