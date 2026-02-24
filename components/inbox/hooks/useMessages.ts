import { useState, useEffect, useRef, useCallback } from "react";
import type { Chat, Message } from "../types";
import { mapRawMessages } from "../mappers";

/** Sort raw OFAPI messages chronologically (ascending). Returns new array. */
function sortAsc(rawMsgs: any[]): any[] {
    return [...rawMsgs].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

/** Extract raw array from API response */
function extractRaw(data: any): any[] {
    return Array.isArray(data.messages) ? data.messages : data.messages?.data || [];
}

export function useMessages(activeChat: Chat | null, selectedCreatorId: string) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Infinite message scroll
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const nextLastIdRef = useRef<string | null>(null);

    // Media map
    const [mediaMap, setMediaMap] = useState<Record<string, { src: string; preview: string; type: string }>>({});
    const mediaMapRef = useRef(mediaMap);
    mediaMapRef.current = mediaMap;

    // Jump to date
    const [jumpingToDate, setJumpingToDate] = useState(false);
    const [jumpProgress, setJumpProgress] = useState(0);
    const isJumpedRef = useRef(false);
    const [isJumped, setIsJumped] = useState(false);

    // AI Suggest
    const [aiSuggestLoading, setAiSuggestLoading] = useState(false);

    // --- Fetch messages + fresh media, then poll ---
    useEffect(() => {
        if (!activeChat) return;
        const cId = activeChat._creatorId || (selectedCreatorId !== "all" ? selectedCreatorId : "");
        if (!cId) return;

        setMsgsLoading(true);
        setMessages([]);
        setMediaMap({});
        setHasMoreMessages(true);
        nextLastIdRef.current = null;
        isJumpedRef.current = false;
        setIsJumped(false);

        Promise.all([
            fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50`)
                .then((r) => r.json())
                .catch(() => ({ messages: [], hasMore: false })),
            fetch(`/api/inbox/media?creatorId=${cId}&chatId=${activeChat.id}`)
                .then((r) => r.json())
                .catch(() => ({ media: {} })),
        ]).then(([msgData, mediaData]) => {
            const freshMedia = mediaData.media || {};
            if (mediaData.media) setMediaMap(freshMedia);
            const raw = sortAsc(extractRaw(msgData));
            setMessages(mapRawMessages(raw, activeChat, freshMedia));
            setHasMoreMessages(msgData.hasMore !== false);
            nextLastIdRef.current = msgData.nextLastId || null;
            setMsgsLoading(false);
            if (!isJumpedRef.current) {
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
        });

        // Poll every 5s (skip when viewing historical)
        const pollInterval = setInterval(() => {
            if (isJumpedRef.current) return;
            fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50`)
                .then((r) => r.json())
                .then((data) => {
                    const raw = sortAsc(extractRaw(data));
                    setMessages(mapRawMessages(raw, activeChat, mediaMapRef.current));
                })
                .catch(console.error);
        }, 5000);

        // Refresh media URLs every 60s to prevent CDN expiry
        const mediaRefreshInterval = setInterval(() => {
            fetch(`/api/inbox/media?creatorId=${cId}&chatId=${activeChat.id}`)
                .then((r) => r.json())
                .then((d) => { if (d.media) setMediaMap(d.media); })
                .catch(console.error);
        }, 60000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(mediaRefreshInterval);
        };
    }, [activeChat]);

    // --- Load older messages on scroll-to-top ---
    const handleLoadOlderMessages = useCallback(() => {
        if (loadingOlder || !hasMoreMessages || !activeChat) return;
        const cId = activeChat._creatorId;
        if (!cId) return;
        const cursor = nextLastIdRef.current || messages[0]?.id;
        if (!cursor) return;

        setLoadingOlder(true);
        fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50&before=${cursor}`)
            .then((r) => r.json())
            .then((data) => {
                const raw = sortAsc(extractRaw(data));
                const older = mapRawMessages(raw, activeChat, mediaMapRef.current);
                if (older.length > 0) {
                    setMessages((prev) => {
                        const existingIds = new Set(prev.map((m) => m.id));
                        const unique = older.filter((m) => !existingIds.has(m.id));
                        return [...unique, ...prev];
                    });
                }
                nextLastIdRef.current = data.nextLastId || null;
                setHasMoreMessages(data.hasMore === true);
                setLoadingOlder(false);
            })
            .catch((err) => {
                console.error("Failed to load older messages", err);
                setLoadingOlder(false);
            });
    }, [loadingOlder, hasMoreMessages, activeChat, messages]);

    // --- Jump to date ---
    const handleJumpToDate = useCallback(
        async (targetDate: Date) => {
            if (!activeChat) return;
            const cId = activeChat._creatorId;
            if (!cId) return;

            setJumpingToDate(true);
            setJumpProgress(0);
            setMessages([]);
            isJumpedRef.current = true;
            setIsJumped(true);

            const targetDayStart = new Date(
                targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(),
            ).getTime();
            let cursor: string | undefined;
            const allRaw: any[] = [];
            let reachedTarget = false;
            let iterations = 0;
            let lastNextLastId: string | null = null;
            let canLoadOlder = true;

            try {
                while (!reachedTarget && iterations < 30) {
                    iterations++;
                    let url = `/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=100`;
                    if (cursor) url += `&before=${cursor}`;
                    const res = await fetch(url);
                    const data = await res.json();
                    const rawMsgs = extractRaw(data);
                    if (rawMsgs.length === 0) { canLoadOlder = false; break; }

                    allRaw.push(...rawMsgs);
                    setJumpProgress(allRaw.length);

                    const oldestTime = new Date(rawMsgs[rawMsgs.length - 1].createdAt).getTime();
                    if (oldestTime <= targetDayStart) reachedTarget = true;

                    lastNextLastId = data.nextLastId || null;
                    cursor = lastNextLastId || undefined;
                    if (!cursor || data.hasMore === false) {
                        canLoadOlder = data.hasMore !== false && !!cursor;
                        break;
                    }
                }

                const sorted = sortAsc(allRaw);
                const idx = sorted.findIndex((m: any) => new Date(m.createdAt).getTime() >= targetDayStart);

                let windowRaw: any[];
                if (idx >= 0) {
                    windowRaw = sorted.slice(Math.max(0, idx - 50), Math.min(sorted.length, idx + 150));
                } else {
                    windowRaw = sorted.slice(-200);
                }

                setMessages(mapRawMessages(windowRaw, activeChat, mediaMapRef.current));
                nextLastIdRef.current = windowRaw[0]?.id ?? lastNextLastId;
                setHasMoreMessages(canLoadOlder);
            } catch (err) {
                console.error("Jump to date failed:", err);
            } finally {
                setJumpingToDate(false);
            }
        },
        [activeChat],
    );

    // --- Return to latest ---
    const handleReturnToLatest = useCallback(() => {
        isJumpedRef.current = false;
        setIsJumped(false);
        if (!activeChat) return;
        const cId = activeChat._creatorId || (selectedCreatorId !== "all" ? selectedCreatorId : "");
        if (!cId) return;

        setMsgsLoading(true);
        nextLastIdRef.current = null;
        setHasMoreMessages(true);

        fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50`)
            .then((r) => r.json())
            .then((data) => {
                const raw = sortAsc(extractRaw(data));
                setMessages(mapRawMessages(raw, activeChat, mediaMapRef.current));
                setHasMoreMessages(data.hasMore !== false);
                nextLastIdRef.current = data.nextLastId || null;
                setMsgsLoading(false);
                setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            })
            .catch(() => setMsgsLoading(false));
    }, [activeChat, selectedCreatorId]);

    // --- AI Suggest ---
    const handleAiSuggest = useCallback(async () => {
        if (!activeChat || aiSuggestLoading) return;
        const cId = activeChat._creatorId;
        const fanId = activeChat.withUser?.id;
        if (!cId || !fanId) return;

        setAiSuggestLoading(true);
        try {
            const res = await fetch("/api/inbox/ai-hints", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creatorId: cId, chatId: activeChat.id, fanOfapiId: fanId }),
            });
            const data = await res.json();
            if (data.hints?.draftMessage) setInputText(data.hints.draftMessage);
        } catch (e) {
            console.error("AI Suggest failed:", e);
        } finally {
            setAiSuggestLoading(false);
        }
    }, [activeChat, aiSuggestLoading]);

    // --- Send message ---
    const handleSend = useCallback(async () => {
        const sendCreatorId = activeChat?._creatorId || selectedCreatorId;
        if (!inputText.trim() || !activeChat || !sendCreatorId || sendCreatorId === "all") return;

        const optimisticMsg: Message = {
            id: `temp_${Date.now()}`,
            text: inputText,
            createdAt: new Date().toISOString(),
            fromUser: { id: sendCreatorId },
            isFromCreator: true,
            senderName: "You",
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        const textToSend = inputText;
        setInputText("");
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

        try {
            await fetch("/api/inbox/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creatorId: sendCreatorId, chatId: activeChat.id, text: textToSend }),
            });
        } catch (e) {
            console.error("Failed to send", e);
        }
    }, [activeChat, selectedCreatorId, inputText]);

    // Reset jump state (for switching chats/creators)
    const resetJumpState = useCallback(() => {
        isJumpedRef.current = false;
        setIsJumped(false);
    }, []);

    return {
        messages,
        msgsLoading,
        inputText,
        setInputText,
        messagesEndRef,
        loadingOlder,
        hasMoreMessages,
        jumpingToDate,
        jumpProgress,
        isJumped,
        aiSuggestLoading,
        handleLoadOlderMessages,
        handleJumpToDate,
        handleReturnToLatest,
        handleAiSuggest,
        handleSend,
        resetJumpState,
    };
}
