import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

interface User { id: number; name: string; username: string; role: string; }
interface Ranking { rank: number | null; status: string; postStats: string | null; checkedAt: string; }
interface Keyword {
  id: number; link: string; keyword: string; brand: string | null;
  productName: string | null; cafeName: string | null; manager: string | null;
  group: string | null; memo: string | null; notificationEnabled: boolean;
  pinned: boolean; createdAt: string;
  user: { id: number; name: string; username: string };
  rankings: Ranking[];
}

const statusLabel = (r: Ranking | undefined) => {
  if (!r) return <span className="text-gray-400 text-xs">미확인</span>;
  if (r.status === "deleted") return <span className="text-gray-500 text-xs font-medium">삭제</span>;
  if (r.status === "not_exposed") return <span className="text-red-500 text-xs font-bold">비노출</span>;
  if (r.status === "exposed" && r.rank) return <span className="text-blue-600 text-sm font-bold">{r.rank}위</span>;
  return <span className="text-gray-400 text-xs">-</span>;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [managers, setManagers] = useState<{ id: number; name: string }[]>([]);
  const [filters, setFilters] = useState({ group: "전체", status: "전체", manager: "전체", sort: "최신순" });
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<number | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editKeyword, setEditKeyword] = useState<Keyword | null>(null);
  const [form, setForm] = useState({ link: "", keyword: "", brand: "", productName: "", cafeName: "", manager: "", group: "" });
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [notification, setNotification] = useState("");

  const showNotif = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(""), 3000); };

  useEffect(() => {
    fetch("/api/auth/me").then((r) => {
      if (!r.ok) router.push("/login");
      else r.json().then((d) => setUser(d.user));
    });
  }, [router]);

  const fetchKeywords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      group: filters.group !== "전체" ? filters.group : "",
      status: filters.status !== "전체" ? filters.status : "",
      manager: filters.manager !== "전체" ? filters.manager : "",
      sort: filters.sort === "오래된순" ? "oldest" : "latest",
      deleted: showDeleted ? "true" : "false",
    });
    const res = await fetch(`/api/keywords?${params}`);
    if (res.ok) {
      const data = await res.json();
      setKeywords(data.keywords);
      setGroups(data.groups || []);
      setManagers(data.managers || []);
    }
    setLoading(false);
  }, [filters, showDeleted]);

  useEffect(() => { if (user) fetchKeywords(); }, [user, fetchKeywords]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError("");
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setFormError(data.error); setFormLoading(false); return; }
    setForm({ link: "", keyword: "", brand: "", productName: "", cafeName: "", manager: "", group: "" });
    setShowAddForm(false);
    fetchKeywords();
    showNotif("키워드가 등록되었습니다.");
    setFormLoading(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editKeyword) return;
    setFormLoading(true);
    const res = await fetch(`/api/keywords/${editKeyword.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) { setEditKeyword(null); fetchKeywords(); showNotif("수정되었습니다."); }
    setFormLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("이 키워드를 삭제하시겠습니까?")) return;
    await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    fetchKeywords();
    showNotif("삭제되었습니다.");
  };

  const handleRefresh = async (id: number) => {
    setRefreshing(id);
    const res = await fetch(`/api/keywords/refresh/${id}`, { method: "POST" });
    if (res.ok) { fetchKeywords(); showNotif("랭킹이 업데이트되었습니다."); }
    else showNotif("업데이트 중 오류가 발생했습니다.");
    setRefreshing(null);
  };

  const handleToggleNotif = async (kw: Keyword) => {
    await fetch(`/api/keywords/${kw.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationEnabled: !kw.notificationEnabled }),
    });
    fetchKeywords();
  };

  const handleMemoUpdate = async (id: number, memo: string) => {
    await fetch(`/api/keywords/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memo }),
    });
    fetchKeywords();
  };

  const handleBulkDelete = async () => {
    if (!selected.length) return;
    if (!confirm(`${selected.length}개를 삭제하시겠습니까?`)) return;
    for (const id of selected) await fetch(`/api/keywords/${id}`, { method: "DELETE" });
    setSelected([]);
    fetchKeywords();
    showNotif(`${selected.length}개가 삭제되었습니다.`);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/keywords/bulk-upload", { method: "POST", body: fd });
    const data = await res.json();
    showNotif(data.message || "업로드 완료");
    fetchKeywords();
    e.target.value = "";
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selected.length === keywords.length) setSelected([]);
    else setSelected(keywords.map((k) => k.id));
  };

  const openEdit = (kw: Keyword) => {
    setEditKeyword(kw);
    setForm({
      link: kw.link, keyword: kw.keyword, brand: kw.brand || "",
      productName: kw.productName || "", cafeName: kw.cafeName || "",
      manager: kw.manager || "", group: kw.group || "",
    });
    setFormError("");
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getDate()).padStart(2, "0")} ${dt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`;
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center"><span className="text-gray-400">로딩 중...</span></div>;

  const FormModal = ({ title, onSubmit }: { title: string; onSubmit: (e: React.FormEvent) => void }) => (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
        <h3 className="text-base font-semibold text-gray-900 mb-4">{title}</h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">카페 링크 *</label>
              <input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="https://cafe.naver.com/... 또는 naver.me/..." required />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">검색 키워드 *</label>
              <input value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="네이버에서 검색할 키워드" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">브랜드</label>
              <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="브랜드명" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">제품명</label>
              <input value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="제품명" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">카페명</label>
              <input value={form.cafeName} onChange={(e) => setForm({ ...form, cafeName: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="카페명" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">담당자</label>
              <input value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="담당자명" />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-600">그룹</label>
              <input value={form.group} onChange={(e) => setForm({ ...form, group: e.target.value })}
                list="group-list"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="그룹명 (신규 입력 또는 선택)" />
              <datalist id="group-list">{groups.map((g) => <option key={g} value={g || ""} />)}</datalist>
            </div>
          </div>
          {formError && <p className="text-red-500 text-xs bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => { setShowAddForm(false); setEditKeyword(null); }}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
              취소
            </button>
            <button type="submit" disabled={formLoading}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {formLoading ? "처리 중..." : title}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Head><title>키워드 추적 - 네이버 랭킹 트래커</title></Head>
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <aside className="w-44 bg-gray-900 text-white flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-700">
            <h1 className="font-bold text-sm leading-tight">네이버 랭킹 트래커</h1>
            <p className="text-xs text-gray-400 mt-0.5">순위 추적 솔루션</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            <a href="/dashboard"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium bg-blue-600 text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              키워드 추적
            </a>
            <a href="/batch"
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              배치작업 설정
            </a>
            {user.role === "admin" && (
              <a href="/admin"
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                사용자 관리
              </a>
            )}
          </nav>
          <div className="p-3 border-t border-gray-700 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{user.name}</p>
              <p className="text-xs text-gray-400">{user.username}</p>
            </div>
            <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
              className="text-gray-400 hover:text-white p-1 rounded" title="로그아웃">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 max-w-full">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-gray-900">키워드 추적</h2>
              <p className="text-sm text-gray-500">네이버 검색 카페 콘텐츠 블록 순위 추적</p>
            </div>

            {/* Add form toggle */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
              <button onClick={() => { setShowAddForm(true); setForm({ link: "", keyword: "", brand: "", productName: "", cafeName: "", manager: "", group: "" }); setFormError(""); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                + 키워드 등록
              </button>
              <span className="ml-3 text-sm text-gray-500">엑셀 일괄등록:</span>
              <label className="ml-2 cursor-pointer bg-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors">
                파일 선택
                <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} className="hidden" />
              </label>
              <a href="/api/keywords/excel?template=true"
                className="ml-2 border border-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors inline-block">
                양식 다운로드
              </a>
            </div>

            {/* List header */}
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="flex items-center justify-between p-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-gray-900">
                    {showDeleted ? "삭제된 키워드" : "키워드 목록"}{" "}
                    <span className="text-gray-400 font-normal text-sm">({keywords.length})</span>
                  </h3>
                  {selected.length > 0 && (
                    <button onClick={handleBulkDelete}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100">
                      선택 삭제 ({selected.length})
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowDeleted(!showDeleted)}
                    className="text-xs border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                    {showDeleted ? "목록으로" : "삭제 기록"}
                  </button>
                  <a href="/api/keywords/excel"
                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700">
                    엑셀 다운로드
                  </a>
                  {/* Filters */}
                  <select value={filters.group} onChange={(e) => setFilters({ ...filters, group: e.target.value })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                    <option>전체 그룹</option>
                    {groups.map((g) => <option key={g}>{g}</option>)}
                  </select>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                    <option value="전체">전체</option>
                    <option value="exposed">노출</option>
                    <option value="not_exposed">비노출</option>
                    <option value="deleted">삭제</option>
                  </select>
                  {user.role === "admin" && (
                    <select value={filters.manager} onChange={(e) => setFilters({ ...filters, manager: e.target.value })}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                      <option>전체 등록자</option>
                      {managers.map((m) => <option key={m.id} value={String(m.id)}>{m.name}</option>)}
                    </select>
                  )}
                  <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none">
                    <option>최신순</option>
                    <option>오래된순</option>
                  </select>
                </div>
              </div>

              <div className="text-xs text-amber-700 bg-amber-50 px-4 py-2 border-b border-gray-100">
                랭킹은 4시간마다 자동으로 업데이트됩니다. 수동 새로고침은 각 행의 새로고침 버튼을 클릭하세요.
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-gray-100">
                      <th className="pl-4 py-3 w-8">
                        <input type="checkbox" checked={selected.length === keywords.length && keywords.length > 0}
                          onChange={toggleSelectAll} className="rounded" />
                      </th>
                      <th className="py-3 w-8 text-left">#</th>
                      <th className="py-3 text-left font-medium">키워드</th>
                      <th className="py-3 text-left font-medium w-20">랭킹</th>
                      <th className="py-3 text-left font-medium w-20">인기글</th>
                      <th className="py-3 text-left font-medium w-32">게시글</th>
                      <th className="py-3 text-left font-medium w-24">그룹</th>
                      <th className="py-3 text-left font-medium w-32">확인일시</th>
                      <th className="py-3 text-left font-medium w-28">메모</th>
                      <th className="py-3 w-24"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={10} className="py-12 text-center text-gray-400">로딩 중...</td></tr>
                    ) : keywords.length === 0 ? (
                      <tr><td colSpan={10} className="py-12 text-center text-gray-400">등록된 키워드가 없습니다.</td></tr>
                    ) : keywords.map((kw, idx) => {
                      const latest = kw.rankings[0];
                      return (
                        <tr key={kw.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="pl-4 py-3">
                            <input type="checkbox" checked={selected.includes(kw.id)}
                              onChange={() => toggleSelect(kw.id)} className="rounded" />
                          </td>
                          <td className="py-3 text-gray-400 text-xs">{idx + 1}</td>
                          <td className="py-3">
                            <div className="font-medium text-gray-900">{kw.keyword}</div>
                            <a href={kw.link} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-gray-400 hover:text-blue-500 truncate block max-w-xs">
                              {kw.link.length > 50 ? kw.link.slice(0, 50) + "..." : kw.link}
                            </a>
                            {(kw.brand || kw.productName) && (
                              <span className="text-xs text-gray-400">{[kw.brand, kw.productName].filter(Boolean).join(" / ")}</span>
                            )}
                          </td>
                          <td className="py-3">{statusLabel(latest)}</td>
                          <td className="py-3">
                            <button onClick={() => handleToggleNotif(kw)}
                              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${kw.notificationEnabled ? "bg-blue-600" : "bg-gray-200"}`}>
                              <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${kw.notificationEnabled ? "translate-x-5" : "translate-x-1"}`} />
                            </button>
                          </td>
                          <td className="py-3 text-xs text-gray-600">{latest?.postStats || "-"}</td>
                          <td className="py-3">
                            {kw.group ? (
                              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{kw.group}</span>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="py-3 text-xs text-gray-500">{latest ? formatDate(latest.checkedAt) : "-"}</td>
                          <td className="py-3">
                            <input
                              defaultValue={kw.memo || ""}
                              onBlur={(e) => { if (e.target.value !== kw.memo) handleMemoUpdate(kw.id, e.target.value); }}
                              className="text-xs text-gray-500 border-0 bg-transparent focus:outline-none focus:bg-gray-100 rounded px-1 py-0.5 w-24 placeholder-gray-300"
                              placeholder="메모 입력"
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1 justify-end">
                              <button onClick={() => handleRefresh(kw.id)} disabled={refreshing === kw.id}
                                className="text-green-500 hover:text-green-700 p-1 rounded disabled:opacity-50" title="새로고침">
                                <svg className={`w-4 h-4 ${refreshing === kw.id ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                              <button onClick={() => openEdit(kw)} className="text-blue-500 hover:text-blue-700 p-1 rounded" title="수정">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button onClick={() => handleDelete(kw.id)} className="text-red-500 hover:text-red-700 p-1 rounded" title="삭제">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      {showAddForm && <FormModal title="등록" onSubmit={handleAdd} />}
      {editKeyword && <FormModal title="수정" onSubmit={handleEdit} />}

      {/* Notification */}
      {notification && (
        <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-4 py-2 rounded-lg text-sm shadow-lg z-50">
          {notification}
        </div>
      )}
    </>
  );
}
