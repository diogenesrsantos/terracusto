import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const settings = await db.systemSettings.findUnique({
    where: { id: "default" },
    select: { reportImage: true, reportImageMimeType: true, updatedAt: true },
  });
  if (!settings?.reportImage || !settings.reportImageMimeType) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(settings.reportImage), {
    headers: {
      "Content-Type": settings.reportImageMimeType,
      "Content-Length": String(settings.reportImage.byteLength),
      "Cache-Control": "private, no-store",
      "Last-Modified": settings.updatedAt.toUTCString(),
      "X-Content-Type-Options": "nosniff",
    },
  });
}
