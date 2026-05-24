import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import * as XLSX from "xlsx";
import fs from "fs";
import { prisma } from "@/lib/prisma";

import { getAuthUser } from "@/lib/auth";

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: "인증이 필요합니다." });

  const form = formidable({ maxFileSize: 10 * 1024 * 1024 });
  const [, files] = await form.parse(req);

  const file = Array.isArray(files.file) ? files.file[0] : files.file;
  if (!file) return res.status(400).json({ error: "파일을 선택해주세요." });

  const buffer = fs.readFileSync(file.filepath);
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

  if (!rows.length) return res.status(400).json({ error: "데이터가 없습니다." });

  const created = [];
  for (const row of rows) {
    const link = String(row["카페링크"] || row["링크"] || "").trim();
    const keyword = String(row["키워드"] || row["검색키워드"] || "").trim();
    if (!link || !keyword) continue;

    const kw = await prisma.keyword.create({
      data: {
        userId: user.id,
        link,
        keyword,
        brand: String(row["브랜드"] || "").trim() || null,
        productName: String(row["제품명"] || "").trim() || null,
        cafeName: String(row["카페명"] || "").trim() || null,
        manager: String(row["담당자"] || "").trim() || null,
        group: String(row["그룹"] || row["제품그룹"] || "").trim() || null,
      },
    });
    created.push(kw);
  }

  return res.status(200).json({ count: created.length, message: `${created.length}개가 등록되었습니다.` });
}
