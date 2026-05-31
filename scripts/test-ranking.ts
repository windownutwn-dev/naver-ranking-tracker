import { checkNaverRanking } from "../lib/scraper";

async function test() {
  const result = await checkNaverRanking(
    "강아지 눈물자국 없애는 법",
    "https://cafe.naver.com/pusanmommy/1462044"
  );
  console.log("결과:", result);
}
test().catch(console.error);
