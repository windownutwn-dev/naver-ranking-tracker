import { useState } from "react";
import Head from "next/head";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", username: "", password: "", brandInput: "" });
  const [brands, setBrands] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, brands }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSuccess(data.message);
      setForm({ name: "", username: "", password: "", brandInput: "" });
      setBrands([]);
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head><title>회원가입 - 네이버 랭킹 트래커</title></Head>
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="text-xl font-bold text-gray-900">회원가입</h1>
            <p className="text-sm text-gray-500 mt-1">네이버 랭킹 트래커</p>
          </div>

          {success ? (
            <div className="text-center space-y-4">
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-4 text-sm">
                {success}
              </div>
              <a href="/login" className="block text-blue-600 font-medium hover:underline text-sm">
                로그인 페이지로 이동
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="실명 입력"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="영문/숫자 조합"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="4자 이상"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">브랜드 <span className="text-gray-400 font-normal">(선택, 복수 가능)</span></label>
                <div className="flex gap-1 mb-1 flex-wrap">
                  {brands.map((b) => (
                    <span key={b} className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
                      {b}
                      <button type="button" onClick={() => setBrands(brands.filter((x) => x !== b))} className="hover:text-red-500">×</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={form.brandInput}
                    onChange={(e) => setForm({ ...form, brandInput: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const v = form.brandInput.trim();
                        if (v && !brands.includes(v)) setBrands([...brands, v]);
                        setForm({ ...form, brandInput: "" });
                      }
                    }}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="브랜드명 입력 후 Enter"
                  />
                  <button type="button" onClick={() => {
                    const v = form.brandInput.trim();
                    if (v && !brands.includes(v)) setBrands([...brands, v]);
                    setForm({ ...form, brandInput: "" });
                  }} className="border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50">추가</button>
                </div>
                <p className="text-xs text-gray-400 mt-1">지정된 브랜드의 키워드만 볼 수 있습니다</p>
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? "처리 중..." : "회원가입 신청"}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-500 mt-4">
            이미 계정이 있으신가요?{" "}
            <a href="/login" className="text-blue-600 font-medium hover:underline">
              로그인
            </a>
          </p>
        </div>
      </div>
    </>
  );
}
