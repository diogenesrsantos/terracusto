import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getSession())) return new Response(null, { status: 401 });
  const { id } = await params;
  const image = await db.helpStepImage.findUnique({ where: { id }, select: { data: true, mimeType: true } });
  if (!image) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(image.data), { headers: {
    "Content-Type": image.mimeType, "Content-Length": String(image.data.byteLength),
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
