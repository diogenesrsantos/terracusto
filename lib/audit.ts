import { db } from "@/lib/db";

export async function audit(userId: string, action: string, entity: string, entityId?: string, data?: object, reason?: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, data, reason } });
}
