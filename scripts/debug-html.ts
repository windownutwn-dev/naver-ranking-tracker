import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.naver.com/",
};

async function debug(keyword: string) {
  const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
  const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(response.data as string);

  // data-cr-name 속성이 있는 모든 요소 찾기
  console.log("=== data-cr-name 속성 있는 요소들 ===");
  $("[data-cr-name]").each((_, el) => {
    const crName = $(el).attr("data-cr-name");
    const tag = $(el).prop("tagName");
    const cls = ($(el).attr("class") || "").split(" ").slice(0, 3).join(" ");
    const cafeLinks = $(el).find("a[href*='cafe.naver.com']").length;
    console.log(`${tag}[data-cr-name="${crName}"] class="${cls}" cafe링크수=${cafeLinks}`);
  });

  console.log("\n=== 카페 링크 포함한 첫 번째 섹션 구조 ===");
  // 첫번째 카페 링크의 조상 중 섹션/div 레벨 요소 찾기
  const firstCafeLink = $("a[href*='cafe.naver.com']").first();
  if (firstCafeLink.length) {
    firstCafeLink.parents().each((_, el) => {
      const tag = $(el).prop("tagName");
      const cls = $(el).attr("class") || "";
      const id = $(el).attr("id") || "";
      const crName = $(el).attr("data-cr-name") || "";
      const dataType = $(el).attr("data-type") || "";
      const dataBx = $(el).attr("data-bx-area") || "";
      if (tag === "SECTION" || tag === "DIV" || tag === "ARTICLE") {
        console.log(`<${tag} id="${id}" class="${cls.slice(0,60)}" data-cr-name="${crName}" data-type="${dataType}" data-bx-area="${dataBx}">`);
      }
    });
  }

  // data-type 또는 data-bx-area 속성 찾기
  console.log("\n=== data-type / data-bx 속성 있는 요소들 ===");
  $("[data-type], [data-bx-area]").each((_, el) => {
    const dataType = $(el).attr("data-type") || "";
    const dataBx = $(el).attr("data-bx-area") || "";
    const tag = $(el).prop("tagName");
    const cafeLinks = $(el).find("a[href*='cafe.naver.com']").length;
    if (cafeLinks > 0) {
      console.log(`${tag} data-type="${dataType}" data-bx-area="${dataBx}" cafe링크수=${cafeLinks}`);
    }
  });
}

const keyword = process.argv[2] || "강아지 눈물자국 없애는 법";
debug(keyword).catch(console.error);
