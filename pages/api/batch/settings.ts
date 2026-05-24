import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth";

export default withAdmin(async (req, res) => {
  if (req.method === "GET") {
    const setting = await prisma.batchSetting.findUnique({ where: { id: 1 } });
    return res.status(200).json({ setting });
  }

  if (req.method === "PUT") {
    const { enabled, intervalHours } = req.body;
    const now = new Date();
    const nextRun = new Date(now.getTime() + (intervalHours || 4) * 60 * 60 * 1000);

    const setting = await prisma.batchSetting.upsert({
      where: { id: 1 },
      update: {
        enabled: enabled ?? true,
        intervalHours: intervalHours || 4,
        nextRunAt: nextRun,
      },
      create: {
        id: 1,
        enabled: enabled ?? true,
        intervalHours: intervalHours || 4,
        nextRunAt: nextRun,
      },
    });
    return res.status(200).json({ setting });
  }

  return res.status(405).end();
});
