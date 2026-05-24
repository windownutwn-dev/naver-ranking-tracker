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
  const idA = extractCafePostId(a);
  const idB = extractCafePostId(b);
  if (idA && idB && idA === idB) return true;
  return false;
}

// Naver 검색 카페 섹션 선택자 (우선순위 순)
const CAFE_SECTION_SELECTORS = [
  'section[data-cr-name="cafe"]',
  'div[data-cr-name="cafe"]',
  '#cafe',
  '.sc_new.cs_cafe',
  '[class*="cafe_wrap"]',
  '[id*="cafe"]',
];

export async function checkNaverRanking(keyword: string, targetLink: string): Promise<ScrapeResult> {
  const resolvedLink = await resolveUrl(targetLink);
  const isDeleted = await checkIfDeleted(resolvedLink);
  if (isDeleted) return { rank: null, status: "deleted", postStats: null };

  try {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
    const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data as string);

    // 카페 전용 섹션 찾기
    let cafeSection = $();
    for (const sel of CAFE_SECTION_SELECTORS) {
      const found = $(sel).first();
      if (found.length && found.find("a[href*='cafe.naver.com']").length > 0) {
        cafeSection = found;
        break;
      }
    }

    let foundRank: number | null = null;
    let postStats: string | null = null;

    const countByItems = (root: cheerio.Cheerio<any>) => {
      // 결과 항목(item) 단위로 순위 계산 - 하나의 항목에 링크가 여러 개여도 1개로 처리
      const itemSelectors = "li.bx, li[class*='item'], .bx, article, li";
      const items = root.find(itemSelectors).filter((_, el) => {
        return $(el).find("a[href*='cafe.naver.com']").length > 0 &&
          $(el).find("a[href*='cafe.naver.com']").toArray().some(a => extractCafePostId($(a).attr("href") || "") !== null);
      });

      // 중첩 제거: 다른 item의 자식인 item은 제외
      const topItems: cheerio.Element[] = [];
      items.each((_, el) => {
        const isNested = topItems.some(parent => $(parent).find(el).length > 0);
        if (!isNested) topItems.push(el);
      });

      topItems.forEach((el, idx) => {
        const rank = idx + 1;
        $(el).find("a[href*='cafe.naver.com']").each((_, linkEl) => {
          const href = $(linkEl).attr("href") || "";
          if (foundRank === null && linksMatch(href, resolvedLink)) {
            foundRank = rank;
            const txt = $(el)
              .find(".etc_dsc_area, .sub_txt, .ldate, [class*='date'], [class*='info']")
              .map((_, s) => $(s).text().trim()).get().filter(Boolean).join(" ");
            if (txt) postStats = txt;
          }
        });
      });
    };

    if (cafeSection.length) {
      countByItems(cafeSection);
    }

    // 카페 섹션을 못 찾은 경우 전체 페이지 fallback
    if (foundRank === null) {
      countByItems($("body"));
    }

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
