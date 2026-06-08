import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
  Referer: "https://www.naver.com/",
};

const RELATED_POST_AREA = [
  "[class*='fds-ugc-afte']",
  "[class*='fds-content-list']",
  ".bx_etc",
  ".api_etc_area",
  "[class*='bx_etc']",
  "[class*='etc_list']",
].join(", ");

function extractCafePostId(url: string): string | null {
  const m1 = url.match(/cafe\.naver\.com\/[^/?#]+\/(\d+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]articleid=(\d+)/i);
  if (m2) return m2[1];
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // 간단한 비밀키 체크 (admin only)
  if (req.query.secret !== "biopetlab2024") {
    return res.status(403).json({ error: "forbidden" });
  }

  const keyword = (req.query.keyword as string) || "강아지 경추디스크";
  const targetPostId = (req.query.postId as string) || "3077139";

  try {
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}&where=nexearch`;
    const response = await axios.get(searchUrl, { headers: HEADERS, timeout: 15000 });
    const $ = cheerio.load(response.data as string);

    const sections: any[] = [];
    let cafeRank = 0;
    let foundRank: number | null = null;

    $("div.sc_new").each((si, section) => {
      const $section = $(section);

      // 전체 링크
      const allLinks = $section.find("a[href*='cafe.naver.com']").toArray()
        .filter(a => extractCafePostId($(a).attr("href") || "") !== null)
        .map(a => {
          const href = $(a).attr("href") || "";
          const postId = extractCafePostId(href);
          const isFiltered = $(a).closest(RELATED_POST_AREA).length > 0;
          // 부모 클래스 2단계만
          const p1 = $(a).parent().attr("class") || "";
          const p2 = $(a).parent().parent().attr("class") || "";
          return { postId, isFiltered, p1: p1.slice(0, 60), p2: p2.slice(0, 60) };
        });

      // 메인 링크만
      const mainLinks = allLinks.filter(l => !l.isFiltered);
      if (mainLinks.length === 0) return;

      cafeRank++;
      const hasTarget = mainLinks.some(l => l.postId === targetPostId);
      if (foundRank === null && hasTarget) foundRank = cafeRank;

      sections.push({
        sectionIndex: si,
        cafeRank,
        hasTarget,
        allLinks,
        mainLinks,
      });
    });

    return res.status(200).json({
      keyword,
      targetPostId,
      foundRank,
      result: foundRank ? `${foundRank}위 노출` : "미노출",
      sections,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
