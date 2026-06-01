import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

interface BatchSetting { enabled: boolean; intervalHours: number; lastRunAt: string | null; nextRunAt: string | null; telegramEnabled: boolean; telegramToken: string | null; telegramChatId: string | null; }
interface User { id: number; name: string; username: string; role: string; }

export default function BatchPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [setting, setSetting] = useState<BatchSetting | null>(null);
  const [form, setForm] = useState({ enabled: true, intervalHours: 4, telegramEnabled: false, telegramToken: "", telegramChatId: "" });
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/login");
      else r.json().then((d) => { setUser(d.user); if (d.user.role !== "admin") router.push("/dashboard"); });
    });
  }, [router]);

  useEffect(() => {
    if (user?.role === "admin") {
      fetch("/api/batch/settings").then((r) => r.json()).then((d) => {
        if (d.setting) {
        setSetting(d.setting);
        setForm({
          enabled: d.setting.enabled,
          intervalHours: d.setting.intervalHours,
          telegramEnabled: d.setting.telegramEnabled ?? false,
          telegramToken: d.setting.telegramToken ?? "",
          telegramChatId: d.setting.telegramChatId ?? "",
        });
      }
      });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/batch/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        intervalHours: form.intervalHours,
        telegramEnabled: form.telegramEnabled,
        telegramToken: form.telegramToken,
        telegramChatId: form.telegramChatId,
      }),
    });
    const data = await res.json();
    if (res.ok) { setSetting(data.setting); setMessage("설정이 저장되었습니다."); }
    setLoading(false);
  };

  const handleRunNow = async () => {
    if (!confirm("지금 바로 전체 배치 작업을 실행하시겠습니까?")) return;
    setRunning(true);
    setMessage("");
    const res = await fetch("/api/batch/run", { method: "POST" });
    const data = await res.json();
    setMessage(data.message || "완료");
    setRunning(false);
    // Refresh settings
    fetch("/api/batch/settings").then((r) => r.json()).then((d) => { if (d.setting) setSetting(d.setting); });
  };

  const handleTestTelegram = async () => {
    if (!form.telegramToken || !form.telegramChatId) { setMessage("봇 토큰과 Chat ID를 먼저 입력하세요."); return; }
    setTestingTelegram(true);
    const res = await fetch("/api/telegram/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: form.telegramToken, chatId: form.telegramChatId }),
    });
    const data = await res.json();
    setMessage(res.ok ? "✅ 텔레그램 테스트 메시지 발송 완료!" : `실패: ${data.error}`);
    setTestingTelegram(false);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-";

  if (!user) return <div className="min-h-screen flex items-center justify-center"><span className="text-gray-400">로딩 중...</span></div>;

  return (
    <>
      <Head><title>배치작업 설정 - 네이버 랭킹 트래커</title></Head>
      <div className="flex h-screen bg-gray-100">
        <aside className="w-44 bg-gray-900 text-white flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-700">
            <h1 className="font-bold text-sm leading-tight">네이버 랭킹 트래커</h1>
            <p className="text-xs text-gray-400 mt-0.5">순위 추적 솔루션</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            <a href="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              키워드 추적
            </a>
            <a href="/batch" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              배치작업 설정
            </a>
            <a href="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              사용자 관리
            </a>
          </nav>
          <div className="p-3 border-t border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{user.name}</p>
              <p className="text-xs text-gray-400">{user.username}</p>
            </div>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
              className="text-gray-400 hover:text-white p-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl">
            <h2 className="text-xl font-bold text-gray-900 mb-1">배치작업 설정</h2>
            <p className="text-sm text-gray-500 mb-6">자동 랭킹 체크 스케줄 설정</p>

            <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
              <h3 className="font-semibold text-gray-900 mb-4">실행 현황</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">마지막 실행</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(setting?.lastRunAt ?? null)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-1">다음 실행 예정</p>
                  <p className="text-sm font-medium text-gray-900">{formatDate(setting?.nextRunAt ?? null)}</p>
                </div>
              </div>
              <button onClick={handleRunNow} disabled={running}
                className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {running ? "실행 중..." : "지금 바로 실행"}
              </button>
              {message && <p className="mt-2 text-sm text-green-600">{message}</p>}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">스케줄 설정</h3>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm text-gray-900">자동 실행</p>
                    <p className="text-xs text-gray-500 mt-0.5">설정한 간격으로 자동으로 랭킹을 체크합니다</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, enabled: !form.enabled })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.enabled ? "bg-blue-600" : "bg-gray-200"}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.enabled ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">체크 간격</label>
                  <select value={form.intervalHours} onChange={(e) => setForm({ ...form, intervalHours: parseInt(e.target.value) })}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value={1}>1시간마다</option>
                    <option value={2}>2시간마다</option>
                    <option value={4}>4시간마다</option>
                    <option value={6}>6시간마다</option>
                    <option value={8}>8시간마다</option>
                    <option value={12}>12시간마다</option>
                    <option value={24}>24시간마다</option>
                  </select>
                </div>
                <button type="submit" disabled={loading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {loading ? "저장 중..." : "설정 저장"}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">텔레그램 알림 설정</h3>
                  <p className="text-xs text-gray-500 mt-0.5">09:00 / 18:00 비교 알림 · 신규 노출 즉시 알림</p>
                </div>
                <button type="button" onClick={() => setForm({ ...form, telegramEnabled: !form.telegramEnabled })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.telegramEnabled ? "bg-blue-600" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.telegramEnabled ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {form.telegramEnabled && (
                <div className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700 space-y-1">
                    <p><b>설정 방법:</b></p>
                    <p>1. 텔레그램에서 <b>@BotFather</b> 검색 → /newbot → 봇 생성 → 토큰 복사</p>
                    <p>2. 생성한 봇에게 메시지 전송 후, <b>@userinfobot</b> 에서 Chat ID 확인</p>
                    <p>3. 그룹 채널은 Chat ID 앞에 <b>-100</b> 을 붙여야 합니다</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">봇 토큰</label>
                    <input value={form.telegramToken} onChange={(e) => setForm({ ...form, telegramToken: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456789:ABCdefGHIjklMNOpqrSTUvwxyz" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Chat ID</label>
                    <input value={form.telegramChatId} onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="123456789" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleTestTelegram} disabled={testingTelegram}
                      className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                      {testingTelegram ? "전송 중..." : "테스트 메시지 전송"}
                    </button>
                    <button type="button" onClick={handleSave} disabled={loading}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                      {loading ? "저장 중..." : "저장"}
                    </button>
                  </div>
                  <div className="border-t border-gray-100 pt-3 text-xs text-gray-500 space-y-1">
                    <p>📅 <b>매일 09:00 / 18:00</b> — 전일 동시간 대비 노출 변동 알림</p>
                    <p>🔔 <b>4시간 배치 실행 후</b> — 신규 노출된 키워드 즉시 알림</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
