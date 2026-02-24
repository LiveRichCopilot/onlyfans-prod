import type { Chat, Message } from "./types";

/** Map raw OFAPI chat object to our Chat type. Returns null if no usable ID. */
export function mapRawChat(c: any): Chat | null {
    const id = String(c.fan?.id ?? c.chat_id ?? c.id ?? "");
    if (!id) return null;

    return {
        id,
        withUser: {
            id: String(c.fan?.id ?? c.withUser?.id ?? "unknown"),
            username: c.fan?.username || c.withUser?.username || "Fan",
            name: c.fan?.name || c.withUser?.name || "Anonymous",
            avatar: c.fan?.avatar || c.withUser?.avatar || "",
        },
        lastMessage: {
            text:
                c.lastMessage?.text?.replace(/<[^>]*>?/gm, "") ||
                (c.lastMessage?.media?.length > 0 || c.hasMedia ? "[Media]" : "No message"),
            createdAt: c.lastMessage?.createdAt || new Date().toISOString(),
            isRead: c.lastMessage?.isOpened ?? true,
        },
        totalSpend: c._dbLifetimeSpend || c.fan?.subscribedOnData?.totalSumm || c.totalSpend || 0,
        _creatorId: c._creatorId || "",
        _creatorName: c._creatorName || "",
        _lastPurchaseAt: c._lastPurchaseAt || undefined,
    };
}

/** Filter helper — use after mapRawChat to drop nulls */
export function mapRawChats(raw: any[]): Chat[] {
    return raw.map(mapRawChat).filter((c): c is Chat => c !== null);
}

/** Map a single raw OFAPI message to our Message type. Returns null if no usable ID. */
export function mapRawMessage(
    m: any,
    activeChat: Chat | null,
    mediaMap: Record<string, { src: string; preview: string; type: string }>,
): Message | null {
    const id = String(m.id ?? m.message_id ?? "");
    if (!id) return null;

    const fromId = String(m.fromUser?.id ?? m.author?.id ?? "unknown");
    const isCreator = fromId !== String(activeChat?.withUser?.id ?? "");
    const cleanText = (m.text || "").replace(/<[^>]*>?/gm, "");

    return {
        id,
        text: cleanText,
        media: Array.isArray(m.media)
            ? m.media
                  .map((med: any) => {
                      const medId = String(med.id ?? "");
                      const fresh = medId ? mediaMap[medId] : undefined;
                      const src =
                          fresh?.src ||
                          med.files?.full?.url ||
                          med.files?.preview?.url ||
                          med.files?.thumb?.url ||
                          med.src ||
                          med.full ||
                          med.source?.source ||
                          med.source?.url ||
                          med.video?.url ||
                          med.audio?.url ||
                          med.preview ||
                          med.thumb ||
                          med.squarePreview ||
                          "";
                      const preview =
                          fresh?.preview ||
                          med.files?.preview?.url ||
                          med.files?.thumb?.url ||
                          med.files?.squarePreview?.url ||
                          med.preview ||
                          med.thumb ||
                          med.squarePreview ||
                          src ||
                          "";
                      if (!src && !preview) return null;
                      return {
                          id: medId || `media_${id}_${Math.random().toString(36).slice(2, 8)}`,
                          type: fresh?.type || (med.type === "gif" ? "photo" : med.type || "photo"),
                          canView: med.canView !== false,
                          preview,
                          src,
                      };
                  })
                  .filter(Boolean)
            : [],
        createdAt: m.createdAt || new Date().toISOString(),
        fromUser: { id: fromId },
        isFromCreator: isCreator,
        senderName: isCreator ? "Creator" : activeChat?.withUser?.name || "Fan",
        price: m.price || 0,
        isTip: m.isTip === true,
        isOpened: m.isOpened === true,
        isFree: m.isFree !== false,
    };
}

/** Map an array of raw messages. Drops any without a usable ID. Does NOT sort — caller decides order. */
export function mapRawMessages(
    rawMsgs: any[],
    activeChat: Chat | null,
    mediaMap: Record<string, { src: string; preview: string; type: string }>,
): Message[] {
    return rawMsgs
        .map((m) => mapRawMessage(m, activeChat, mediaMap))
        .filter((m): m is Message => m !== null);
}
