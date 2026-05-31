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

  // sc_new 섹션 모두 찾기 
  console.log("=== sc_new 섹션들 ===");
  $("div.sc_new, section.sc_new").each((i, el) => {
    const id = $(el).attr("id") || "";
    const cls = $(el).attr("class") || "";
    const cafeLinks = $(el).find("a[href*='cafe.naver.com']").length;
    // 섹션 제목 찾기
    const title = $(el).find("h2, h3, .sc_title, .tit_area, [class*='title'], [class*='tit']").first().text().trim().slice(0, 30);
    // 첫 번째 텍스트
    const firstText = $(el).text().trim().slice(0, 40);
    console.log(`[${i}] id="${id}" cafe링크=${cafeLinks} 제목="${title}" 시작="${firstText}"`);
  });

  console.log("\n=== 카페 링크를 3개 이상 포함한 섹션의 실제 내용 ===");
  $("div.sc_new, section.sc_new").each((i, el) => {
    const cafeLinks = $(el).find("a[href*='cafe.naver.com']").length;
    if (cafeLinks >= 3) {
      const id = $(el).attr("id") || "";
      console.log(`\n섹션 id="${id}" (cafe링크 ${cafeLinks}개)`);
      // 자식 div들의 클래스 보기
      $(el).children("div, section").each((j, child) => {
        const childCls = $(child).attr("class") || "";
        const childCafeLinks = $(child).find("a[href*='cafe.naver.com']").length;
        console.log(`  자식[${j}]: class="${childCls.slice(0,80)}" cafe링크=${childCafeLinks}`);
      });
    }
  });

  // fds- 클래스 패턴 분석
  console.log("\n=== fds- 클래스 있는 요소들 (cafe링크 포함) ===");
  const seen = new Set<string>();
  $("[class*='fds-']").each((_, el) => {
    const cls = $(el).attr("class") || "";
    const fdsCls = cls.split(" ").filter(c => c.startsWith("fds-")).join(" ");
    if (!seen.has(fdsCls) && $(el).find("a[href*='cafe.naver.com']").length > 0) {
      seen.add(fdsCls);
      console.log(`fds클래스: "${fdsCls}" cafe링크수: ${$(el).find("a[href*='cafe.naver.com']").length}`);
    }
  });
}

const keyword = process.argv[2] || "강아지 눈물자국 없애는 법";
debug(keyword).catch(console.error);
