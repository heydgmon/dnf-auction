"use client";

import { useState, useEffect } from "react";
import { Card, Btn, SkeletonList } from "@/components/shared";

export default function SetItemsClient() {
  // 🔍 검색 상태
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // 📦 연도 데이터
  const [data, setData] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);

  // ✅ 연도 데이터 로드 (캐싱 API)
  useEffect(() => {
    fetch("/api/setitems-all")
      .then((res) => res.json())
      .then((res) => setData(res))
      .finally(() => setLoading(false));
  }, []);

  // ✅ 검색
  const search = async () => {
    if (!query.trim()) return;

    setSearchLoading(true);

    try {
      const res = await fetch(
        `/api/setitems?setItemName=${encodeURIComponent(query)}&wordType=full`
      );
      const json = await res.json();
      setResults(json.rows || []);
    } catch {
      setResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const years = Object.keys(data)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* 🔍 검색 영역 */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>
          📦 세트 아이템 검색
        </h2>

        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="세트 이름 검색 (예: 발할라, 2026)"
            className="input-base"
            style={{ flex: 1 }}
          />
          <Btn onClick={search} loading={searchLoading} disabled={!query} />
        </div>

        {/* 검색 결과 */}
        {results.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {results.map((item) => (
              <div
                key={item.setItemId}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border-color)",
                  fontSize: 13,
                }}
              >
                {item.setItemName}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 📦 연도별 */}
      <Card>
        <h2 style={{ fontSize: 15, fontWeight: 700 }}>
          📅 연도별 세트 아이템
        </h2>
      </Card>

      {loading && <SkeletonList count={5} />}

      {!loading &&
        years.map((year) => (
          <Card key={year} style={{ padding: 0 }}>
            {/* 헤더 */}
            <div
              style={{
                padding: "12px 16px",
                fontWeight: 700,
                background: "var(--bg-secondary)",
              }}
            >
              {year}
            </div>

            {/* 항상 펼쳐짐 */}
            <div style={{ borderTop: "1px solid var(--border-color)" }}>
              {data[year]?.map((item: any) => (
                <div
                  key={item.setItemId}
                  style={{
                    padding: "10px 16px",
                    borderBottom: "1px solid var(--border-color)",
                    fontSize: 13,
                  }}
                >
                  {item.setItemName}
                </div>
              ))}
            </div>
          </Card>
        ))}
    </div>
  );
}