import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.naver.com/",
};

function extractCafePostId(url: string): string | null {
  const m1 = url.match(/cafe\.naver\.com\/[^/?#]+\/(\d+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]articleid=(\d+)/i);
  if (m2) return m2[1];
  return null;
}

async function debug(keyword: string, targetPostId: string) {
  const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
  const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(response.data as string);

  // 타겟 링크를 포함하는 sc_new 섹션 찾기
  let targetSection: any = null;
  $("div.sc_new").each((_, el) => {
    const links = $(el).find(`a[href*='${targetPostId}']`);
    if (links.length > 0) {
      targetSection = el;
    }
  });

  if (targetSection) {
    console.log("=== 타겟 포함 섹션 ===");
    const id = $(targetSection).attr("id");
    console.log(`섹션 id: ${id}`);
    console.log(`전체 텍스트 앞부분: ${$(targetSection).text().trim().slice(0, 200)}`);
    console.log("\n=== 이 섹션의 카페 링크들 ===");
    let rank = 0;
    const seen = new Set<string>();
    $(targetSection).find("a[href*='cafe.naver.com']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const postId = extractCafePostId(href);
      if (!postId || seen.has(postId)) return;
      seen.add(postId);
      rank++;
      const text = $(a).text().trim().slice(0, 50);
      const isTarget = postId === targetPostId ? " ← 타겟!" : "";
      console.log(`  [${rank}] postId=${postId} "${text}"${isTarget}`);
    });
  } else {
    console.log("타겟 포함 sc_new 섹션 없음");
  }

  // 섹션 [3] (가장 많은 카페링크) 상세 분석
  console.log("\n=== 첫번째 카페링크 다수 섹션 (sc_new) 분석 ===");
  $("div.sc_new").each((i, el) => {
    const cafeLinks = $(el).find("a[href*='cafe.naver.com']").length;
    if (cafeLinks < 3) return;
    
    console.log(`\n섹션[${i}] id=${$(el).attr("id")} (${cafeLinks}개 링크)`);
    // 어떤 카페들이 포함되어 있나?
    const cafes = new Set<string>();
    $(el).find("a[href*='cafe.naver.com']").each((_, a) => {
      const href = $(a).attr("href") || "";
      const cafeMatch = href.match(/cafe\.naver\.com\/([^/?#]+)/);
      if (cafeMatch) cafes.add(cafeMatch[1]);
    });
    console.log(`포함 카페들: ${[...cafes].join(", ")}`);
  });
}

const keyword = process.argv[2] || "강아지 눈물자국 없애는 법";
const targetPostId = process.argv[3] || "1462044";
debug(keyword, targetPostId).catch(console.error);
