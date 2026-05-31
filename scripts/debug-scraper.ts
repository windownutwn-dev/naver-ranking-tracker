import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.naver.com/",
};

const CAFE_SECTION_SELECTORS = [
  'section[data-cr-name="cafe"]',
  'div[data-cr-name="cafe"]',
  '#cafe',
  '.sc_new.cs_cafe',
  '[class*="cafe_wrap"]',
];

function extractCafePostId(url: string): string | null {
  const m1 = url.match(/cafe\.naver\.com\/[^/?#]+\/(\d+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]articleid=(\d+)/i);
  if (m2) return m2[1];
  return null;
}

async function debug(keyword: string) {
  const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
  const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(response.data as string);

  let cafeSection = $();
  let usedSelector = "";
  for (const sel of CAFE_SECTION_SELECTORS) {
    const found = $(sel).first();
    if (found.length && found.find("a[href*='cafe.naver.com']").length > 0) {
      cafeSection = found;
      usedSelector = sel;
      break;
    }
  }

  console.log(`\n=== 카페 섹션 셀렉터: ${usedSelector || "없음(전체 body)"} ===\n`);

  const root = cafeSection.length ? cafeSection : $("body");
  let rank = 0;
  const seenIds = new Set<string>();

  root.find("a[href*='cafe.naver.com']").each((_, linkEl) => {
    const href = $(linkEl).attr("href") || "";
    const postId = extractCafePostId(href);
    if (!postId) return;
    if (seenIds.has(postId)) return;
    seenIds.add(postId);
    rank++;

    // 부모 클래스 체인 출력
    const parentClasses = $(linkEl).parents().toArray().slice(0, 6).map((p) => {
      const cls = $(p).attr("class") || "";
      return cls ? cls.split(" ").slice(0, 2).join(".") : $(p).prop("tagName");
    }).filter(Boolean);

    // 링크 텍스트
    const text = $(linkEl).text().trim().slice(0, 40);

    console.log(`[${rank}위] postId=${postId}`);
    console.log(`       href: ${href.slice(0, 80)}`);
    console.log(`       text: ${text}`);
    console.log(`       부모클래스: ${parentClasses.join(" > ")}`);
    console.log();
  });
}

const keyword = process.argv[2] || "강아지 눈물자국 없애는 법";
debug(keyword).catch(console.error);
