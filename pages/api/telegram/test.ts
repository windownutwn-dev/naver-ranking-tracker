import type { NextApiRequest, NextApiResponse } from "next";
import { withAdmin } from "@/lib/auth";
import { sendTelegram } from "@/lib/telegram";

export default withAdmin(async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const { token, chatId } = req.body;
  if (!token || !chatId) return res.status(400).json({ error: "토큰과 Chat ID가 필요합니다." });

  const ok = await sendTelegram(token, chatId,
    `✅ <b>네이버 랭킹 트래커</b>\n\n텔레그램 알림 연결 성공!\n앞으로 키워드 노출 변동 알림이 여기로 옵니다.`
  );

  if (!ok) return res.status(500).json({ error: "전송 실패. 토큰과 Chat ID를 확인하세요." });
  return res.status(200).json({ message: "전송 완료" });
});
