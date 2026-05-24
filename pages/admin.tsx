import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

interface User { id: number; name: string; username: string; role: string; approved: boolean; createdAt: string; _count: { keywords: number }; }
interface Me { id: number; name: string; username: string; role: string; }

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const showMsg = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 3000); };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/login");
      else r.json().then((d) => { setMe(d.user); if (d.user.role !== "admin") router.push("/dashboard"); });
    });
  }, [router]);

  const fetchUsers = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    if (res.ok) { const d = await res.json(); setUsers(d.users); }
    setLoading(false);
  };

  useEffect(() => { if (me?.role === "admin") fetchUsers(); }, [me]);

  const handleApprove = async (id: number, approved: boolean) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    fetchUsers();
    showMsg(approved ? "승인되었습니다." : "승인이 취소되었습니다.");
  };

  const handleRoleChange = async (id: number, role: string) => {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    fetchUsers();
    showMsg("권한이 변경되었습니다.");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 사용자와 모든 키워드를 삭제하시겠습니까?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
    showMsg("삭제되었습니다.");
  };

  if (!me) return <div className="min-h-screen flex items-center justify-center"><span className="text-gray-400">로딩 중...</span></div>;

  return (
    <>
      <Head><title>사용자 관리 - 네이버 랭킹 트래커</title></Head>
      <div className="flex h-screen bg-gray-100">
        <aside className="w-44 bg-gray-900 text-white flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-700">
            <h1 className="font-bold text-sm leading-tight">네이버 랭킹 트래커</h1>
            <p className="text-xs text-gray-400 mt-0.5">순위 추적 솔루션</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            <a href="/dashboard" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              키워드 추적
            </a>
            <a href="/batch" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              배치작업 설정
            </a>
            <a href="/admin" className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              사용자 관리
            </a>
          </nav>
          <div className="p-3 border-t border-gray-700 flex items-center justify-between">
            <div><p className="text-xs font-medium">{me.name}</p><p className="text-xs text-gray-400">{me.username}</p></div>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
              className="text-gray-400 hover:text-white p-1 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-1">사용자 관리</h2>
          <p className="text-sm text-gray-500 mb-6">회원가입 승인 및 권한 관리</p>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
              <p className="text-xs text-amber-700">미승인 사용자: {users.filter((u) => !u.approved).length}명</p>
            </div>
            {loading ? (
              <div className="py-12 text-center text-gray-400">로딩 중...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-3 text-left font-medium">이름</th>
                    <th className="px-4 py-3 text-left font-medium">아이디</th>
                    <th className="px-4 py-3 text-left font-medium">키워드 수</th>
                    <th className="px-4 py-3 text-left font-medium">가입일</th>
                    <th className="px-4 py-3 text-left font-medium">상태</th>
                    <th className="px-4 py-3 text-left font-medium">권한</th>
                    <th className="px-4 py-3 text-right font-medium">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!u.approved ? "bg-amber-50/40" : ""}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-600">{u.username}</td>
                      <td className="px-4 py-3 text-gray-600">{u._count.keywords}개</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-4 py-3">
                        {u.approved ? (
                          <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs font-medium">승인됨</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs font-medium">대기 중</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {u.id !== me.id ? (
                          <select value={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none">
                            <option value="user">일반</option>
                            <option value="admin">관리자</option>
                          </select>
                        ) : (
                          <span className="text-xs text-gray-500">관리자 (나)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          {u.id !== me.id && (
                            <>
                              <button
                                onClick={() => handleApprove(u.id, !u.approved)}
                                className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${u.approved ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                                {u.approved ? "승인 취소" : "승인"}
                              </button>
                              <button onClick={() => handleDelete(u.id)}
                                className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1 rounded-lg hover:bg-red-100">
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </main>
      </div>

      {message && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {message}
        </div>
      )}
    </>
  );
}
