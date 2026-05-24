require("dotenv").config();
const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const cron = require("node-cron");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const PORT = process.env.PORT || 3000;

app.prepare().then(() => {
  // Every 4 hours: 0 */4 * * *
  cron.schedule("0 */4 * * *", async () => {
    console.log("[Scheduler] 배치 작업 시작...");
    try {
      const res = await fetch(`http://localhost:${PORT}/api/batch/run`, {
        method: "POST",
        headers: { "x-cron-secret": process.env.CRON_SECRET || "batch-cron-secret-key" },
      });
      const data = await res.json();
      console.log("[Scheduler] 배치 완료:", data.message, `(${data.count}개)`);
    } catch (err) {
      console.error("[Scheduler] 배치 실패:", err.message);
    }
  });

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> 서버 실행 중: http://localhost:${PORT}`);
    console.log("> 4시간마다 자동 랭킹 체크 활성화");
  });
});
