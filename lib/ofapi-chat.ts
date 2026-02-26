import { ofapiRequest, OFAPI_BASE } from "./ofapi-core";

/**
 * Get the list of chats for an Account.
 */
export async function listChats(accountName: string, apiKey: string, limit: number = 50, offset: number = 0) {
    return ofapiRequest(`/api/${accountName}/chats?limit=${limit}&offset=${offset}&order=recent&skip_users=none`, apiKey);
}

/**
 * Get messages from a specific chat.
 */
export async function getChatMessages(
    accountName: string,
    chatId: string | number,
    apiKey: string,
    limit: number = 50,
    beforeId?: string,
    order: "asc" | "desc" = "desc"
) {
    let endpoint = `/api/${accountName}/chats/${chatId}/messages?limit=${limit}&order=${order}&skip_users=all`;
    if (beforeId) {
        endpoint += `&id=${beforeId}`;
    }
    return ofapiRequest(endpoint, apiKey);
}

/**
 * Search messages in a specific chat.
 */
export async function searchChatMessages(accountName: string, chatId: string | number, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages/search`, apiKey);
}

/**
 * Send a new message to a chat.
 */
export async function sendChatMessage(accountName: string, chatId: string | number, apiKey: string, payload: any) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages`, apiKey, {
        method: "POST",
        body: payload
    });
}

/**
 * Delete a message from a chat (only within 24 hours of sending).
 */
export async function deleteChatMessage(accountName: string, chatId: string | number, messageId: string, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/messages/${messageId}`, apiKey, { method: "DELETE" });
}

/**
 * Attach Tags (Release Forms) to a message.
 */
export async function attachReleaseTags(accountName: string, messageId: string, apiKey: string, tags: any) {
    return ofapiRequest(`/api/${accountName}/messages/${messageId}/attach-tags`, apiKey, {
        method: "POST",
        body: { rfTag: tags }
    });
}

/**
 * Trigger the "Model is typing..." indicator.
 */
export async function startTypingIndicator(accountName: string, chatId: string | number, apiKey: string) {
    return ofapiRequest(`/api/${accountName}/chats/${chatId}/typing`, apiKey, {
        method: "POST"
    });
}

export async function sendTypingIndicator(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/typing`, apiKey, { method: "POST" });
}

export async function getChatMedia(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/media`, apiKey);
}

/** Paginate through all chats for an account using _pagination.next_page */
export async function fetchAllChats(accountName: string, apiKey: string, maxChats: number = 200) {
    const all: any[] = [];

    // First page
    const res = await listChats(accountName, apiKey, 100, 0).catch(() => null);
    if (!res) return all;

    const firstPage = Array.isArray(res?.data) ? res.data : [];
    all.push(...firstPage);

    // Follow _pagination.next_page until no more pages or maxChats reached
    let nextPage = res?._pagination?.next_page ?? res?._meta?._pagination?.next_page ?? null;

    while (nextPage && all.length < maxChats) {
        const r = await fetch(nextPage, {
            headers: { "Authorization": `Bearer ${apiKey}` },
        }).catch(() => null);
        if (!r || !r.ok) break;

        const nextData = await r.json().catch(() => null);
        if (!nextData) break;

        const nextList = Array.isArray(nextData?.data) ? nextData.data : [];
        if (nextList.length === 0) break;

        all.push(...nextList);
        nextPage = nextData?._pagination?.next_page ?? nextData?._meta?._pagination?.next_page ?? null;
    }

    return all.slice(0, maxChats);
}

export async function markChatAsRead(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/mark-as-read`, apiKey, { method: "POST" });
}

export async function hideChat(account: string, chatId: string, apiKey: string) {
    return ofapiRequest(`/api/${account}/chats/${chatId}/hide`, apiKey, { method: "POST" });
}

/**
 * List mass messages for a creator account
 */
export async function getMassMessages(account: string, apiKey: string, limit: number = 20, offset: number = 0) {
    return ofapiRequest(`/api/${account}/mass-messages?limit=${limit}&offset=${offset}`, apiKey, { timeoutMs: 10000 });
}

/**
 * Get performance chart for a specific mass message
 */
export async function getMassMessageChart(account: string, apiKey: string, messageId: string) {
    return ofapiRequest(`/api/${account}/mass-messages/${messageId}/chart`, apiKey, { timeoutMs: 10000 });
}

export async function uploadToVault(account: string, apiKey: string, mediaBuffer: Buffer, fileName: string) {
    console.log(`Uploading ${fileName} to OnlyFans Vault via OFAPI...`);

    const formData = new FormData();
    // @ts-ignore - FormData accepts Blob/Buffer depending on Node version
    formData.append("file", new Blob([mediaBuffer]), fileName);

    const url = `${OFAPI_BASE}/api/${account}/media/vault`;

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
        },
        body: formData,
    });

    if (!response.ok) {
        const err = await response.text();
        console.error(`OFAPI Upload Error: ${response.status}`, err);
        throw new Error(`Media Upload failed: HTTP ${response.status} | Details: ${err}`);
    }

    return response.json();
}

/**
 * Update Metadata (Title/Tags) on an existing Vault Media item
 */
export async function updateVaultMedia(account: string, apiKey: string, mediaId: string, title: string, text: string) {
    return ofapiRequest(`/api/${account}/media/vault/${mediaId}`, apiKey, {
        method: "PUT",
        body: { title, text }
    });
}

/**
 * Send Vault Media to Fan via Chat
 */
export async function sendVaultMediaToFan(fanId: string, vaultMediaId: string, apiKey: string) {
    return ofapiRequest(`/api/chats/${fanId}/messages`, apiKey, {
        method: "POST",
        body: {
            media_id: vaultMediaId,
            text: "Thank you for the tip! 💕"
        }
    });
}
