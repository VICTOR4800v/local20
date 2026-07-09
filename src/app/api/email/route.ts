/**
 * /api/email
 * GET  -> list inbox messages (most recent first)
 * POST -> { action: "fetch" | "markRead" | "star" | "connect", ... }
 *
 * Gmail/Google integration ready: when "connect" is called with an OAuth
 * refresh token (encrypted at rest) we store it. Actual IMAP/Graph fetch
 * is delegated to a mini-service in a real deployment; here we expose the
 * seeded inbox + the connect/config surface so the UI is functional.
 */
import { route } from "@/lib/api";
import { sanitizeText, isValidEmail, jsonOk, jsonError, encryptValue, audit } from "@/lib/security";
import { db } from "@/lib/db";

interface EmailBody {
  action?: "fetch" | "markRead" | "star" | "connect" | "disconnect";
  messageId?: string;
  account?: { provider: string; address: string; token?: string };
}

export const GET = route({ scope: "generic" }, async (ctx) => {
  const accounts = await db.emailAccount.findMany({
    where: { userId: ctx.userId },
    include: { messages: { orderBy: { date: "desc" }, take: 50 } },
  });
  return jsonOk({
    accounts: accounts.map((a) => ({
      id: a.id,
      provider: a.provider,
      address: a.address,
      active: a.active,
      messageCount: a.messages.length,
      unread: a.messages.filter((m) => !m.read).length,
    })),
    messages: accounts.flatMap((a) =>
      a.messages.map((m) => ({
        id: m.id,
        accountId: a.id,
        from: m.from,
        to: m.to,
        subject: m.subject,
        preview: m.preview,
        body: m.body,
        read: m.read,
        starred: m.starred,
        date: m.date.toISOString(),
      })),
    ),
  });
});

export const POST = route({ scope: "generic", method: "POST" }, async (ctx) => {
  const body = ctx.body as EmailBody;
  const action = sanitizeText(body.action, 20) as EmailBody["action"] || "fetch";

  if (action === "connect") {
    const provider = sanitizeText(body.account?.provider, 30) || "gmail";
    const address = sanitizeText(body.account?.address, 254);
    const token = sanitizeText(body.account?.token, 4000);
    if (!isValidEmail(address)) return jsonError("Invalid email address", 400);
    if (!token) return jsonError("Missing OAuth token / app password", 400);

    const enc = await encryptValue(token);
    const acct = await db.emailAccount.create({
      data: {
        userId: ctx.userId,
        provider,
        address,
        tokenEnc: enc,
        active: true,
      },
    });
    void audit({ userId: ctx.userId, action: "email:connect", ip: ctx.ip, detail: `${provider}:${address}` });
    return jsonOk({ account: { id: acct.id, provider, address, active: true } });
  }

  if (action === "markRead") {
    const id = sanitizeText(body.messageId, 40);
    if (!id) return jsonError("messageId required", 400);
    const m = await db.emailMessage.updateMany({ where: { id }, data: { read: true } });
    return jsonOk({ updated: m.count });
  }

  if (action === "star") {
    const id = sanitizeText(body.messageId, 40);
    if (!id) return jsonError("messageId required", 400);
    const existing = await db.emailMessage.findUnique({ where: { id } });
    if (!existing) return jsonError("Not found", 404);
    const m = await db.emailMessage.update({ where: { id }, data: { starred: !existing.starred } });
    return jsonOk({ starred: m.starred });
  }

  if (action === "disconnect") {
    const id = sanitizeText(body.messageId, 40);
    if (id) {
      await db.emailAccount.deleteMany({ where: { id, userId: ctx.userId } });
    }
    return jsonOk({ disconnected: true });
  }

  // default fetch (same as GET)
  return GET(ctx.req);
});
