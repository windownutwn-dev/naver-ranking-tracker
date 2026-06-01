export async function sendTelegram(token: string, chatId: string, message: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getTelegramSetting() {
  const { prisma } = await import("@/lib/prisma");
  const setting = await prisma.batchSetting.findUnique({ where: { id: 1 } });
  if (!setting?.telegramEnabled || !setting.telegramToken || !setting.telegramChatId) return null;
  return { token: setting.telegramToken, chatId: setting.telegramChatId };
}
