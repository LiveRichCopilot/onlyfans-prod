import { useState, useEffect, useCallback, useRef } from "react";
import type { Chat } from "../types";
import { mapRawChats } from "../mappers";

/** Sort chats by most recent message (returns a new array, never mutates) */
const sortByRecent = (list: Chat[]) =>
    [...list].sort(
        (a, b) =>
            new Date(b.lastMessage.createdAt).getTime() -
            new Date(a.lastMessage.createdAt).getTime(),
    );

export function useChats() {
    const [creators, setCreators] = useState<any[]>([]);
    const [selectedCreatorId, setSelectedCreatorId] = useState<string>("all");
    const [chats, setChats] = useState<Chat[]>([]);
    const [loading, setLoading] = useState(true);

    // Spend bucket filter
    const [spendBucket, setSpendBucket] = useState(0);
    const [onlineOnly, setOnlineOnly] = useState(false);
    const [spendFilteredChats, setSpendFilteredChats] = useState<Chat[] | null>(null);
    const [loadingSpendFilter, setLoadingSpendFilter] = useState(false);

    // Infinite fan list scroll
    const [chatOffset, setChatOffset] = useState(0);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMoreChats, setLoadingMoreChats] = useState(false);

    // Temperature ring tick — re-renders FanRows every 30s
    const [tempTick, setTempTick] = useState(0);

    // Guard: track which creator selection is active to prevent stale appends
    const activeCreatorSelectionRef = useRef<string>("");

    // --- Temperature tick ---
    useEffect(() => {
        const interval = setInterval(() => setTempTick((t) => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    // --- Fetch connected creators ---
    useEffect(() => {
        fetch("/api/creators")
            .then((res) => res.json())
            .then((data) => setCreators(data.creators || []))
            .catch(console.error);
    }, []);

    // Enrich chats with creator avatars/names (pure — returns new array, never mutates)
    const enrichWithAvatars = useCallback(
        (chatList: Chat[]): Chat[] => {
            const avatarMap: Record<string, string> = {};
            const nameMap: Record<string, string> = {};
            creators.forEach((c: any) => {
                if (c.id && c.avatarUrl) avatarMap[c.id] = c.avatarUrl;
                if (c.id && c.name) nameMap[c.id] = c.name;
            });
            return chatList.map((c) => ({
                ...c,
                _creatorAvatar: c._creatorId && avatarMap[c._creatorId] ? avatarMap[c._creatorId] : c._creatorAvatar,
                _creatorName: c._creatorId && nameMap[c._creatorId] ? nameMap[c._creatorId] : c._creatorName,
            }));
        },
        [creators],
    );

    // --- Spend bucket filter ---
    useEffect(() => {
        if (spendBucket === 0 && !onlineOnly) {
            setSpendFilteredChats(null);
            return;
        }
        setLoadingSpendFilter(true);
        const params = new URLSearchParams();
        params.set("creatorId", selectedCreatorId);
        params.set("minSpend", String(spendBucket));
        if (onlineOnly) params.set("online", "true");

        fetch(`/api/inbox/fans-by-spend?${params.toString()}`)
            .then((r) => r.json())
            .then((data) => {
                if (!data.error && data.fans) {
                    const mapped: Chat[] = data.fans.map((f: any) => ({
                        id: String(f.id),
                        withUser: {
                            id: String(f.id),
                            username: f.username || "Fan",
                            name: f.name || "Anonymous",
                            avatar: f.avatar || "",
                        },
                        lastMessage: {
                            text: f.isOnline
                                ? "Online now"
                                : f.lastSeen
                                  ? `Last seen ${new Date(f.lastSeen).toLocaleDateString()}`
                                  : "",
                            createdAt: f.lastSeen || new Date().toISOString(),
                            isRead: true,
                        },
                        totalSpend: f.totalSpend || 0,
                        _creatorId: f._creatorId,
                        _creatorName: f._creatorName,
                        _creatorAvatar: f._creatorAvatar,
                    }));
                    setSpendFilteredChats(mapped);
                }
                setLoadingSpendFilter(false);
            })
            .catch(() => setLoadingSpendFilter(false));
    }, [spendBucket, onlineOnly, selectedCreatorId]);

    // --- Fetch initial chat list + background-load remaining pages ---
    useEffect(() => {
        if (!selectedCreatorId) return;
        setLoading(true);
        setChats([]);
        setChatOffset(0);
        setHasMoreChats(true);

        const selectionKey = `${selectedCreatorId}_${Date.now()}`;
        activeCreatorSelectionRef.current = selectionKey;

        const baseUrl =
            selectedCreatorId === "all"
                ? "/api/inbox/chats?all=true&limit=10"
                : `/api/inbox/chats?creatorId=${selectedCreatorId}&limit=10`;

        fetch(`${baseUrl}&offset=0`)
            .then((res) => res.json())
            .then(async (data) => {
                if (activeCreatorSelectionRef.current !== selectionKey) return;
                const rawArray = Array.isArray(data.chats) ? data.chats : data.chats?.data || [];
                const firstPage = sortByRecent(enrichWithAvatars(mapRawChats(rawArray)));
                setChats(firstPage);
                setLoading(false);

                // Background-load remaining pages
                let currentOffset = 10;
                let more = data.hasMore === true;
                while (more && activeCreatorSelectionRef.current === selectionKey && currentOffset < 200) {
                    try {
                        const res = await fetch(`${baseUrl}&offset=${currentOffset}`);
                        const nextData = await res.json();
                        if (activeCreatorSelectionRef.current !== selectionKey) break;
                        const nextRaw = Array.isArray(nextData.chats) ? nextData.chats : nextData.chats?.data || [];
                        const nextChats = enrichWithAvatars(mapRawChats(nextRaw));
                        if (nextChats.length > 0) {
                            setChats((prev) => {
                                if (activeCreatorSelectionRef.current !== selectionKey) return prev;
                                const ids = new Set(prev.map((c) => c.id));
                                const unique = nextChats.filter((c) => !ids.has(c.id));
                                return sortByRecent([...prev, ...unique]);
                            });
                        }
                        more = nextData.hasMore === true;
                        currentOffset += 10;
                    } catch {
                        break;
                    }
                }
                setChatOffset(currentOffset);
                setHasMoreChats(more); // true if API still has more beyond offset 200
            })
            .catch((err) => {
                console.error("Failed to fetch chats", err);
                setLoading(false);
            });
    }, [selectedCreatorId]);

    // Re-enrich chats when creators load after chats
    useEffect(() => {
        if (!creators.length) return;
        setChats((prev) => enrichWithAvatars(prev));
    }, [creators, enrichWithAvatars]);

    // Re-enrich spend-filtered chats when creators load
    useEffect(() => {
        if (!spendFilteredChats?.length) return;
        setSpendFilteredChats((prev) => (prev ? enrichWithAvatars(prev) : prev));
    }, [creators, enrichWithAvatars]);

    // --- Infinite scroll: load more chats ---
    const handleLoadMoreChats = useCallback(() => {
        if (loadingMoreChats || !hasMoreChats) return;
        setLoadingMoreChats(true);
        const chatUrl =
            selectedCreatorId === "all"
                ? `/api/inbox/chats?all=true&limit=10&offset=${chatOffset}`
                : `/api/inbox/chats?creatorId=${selectedCreatorId}&limit=10&offset=${chatOffset}`;
        fetch(chatUrl)
            .then((res) => res.json())
            .then((data) => {
                const rawArray = Array.isArray(data.chats) ? data.chats : data.chats?.data || [];
                const newChats = enrichWithAvatars(mapRawChats(rawArray));
                if (newChats.length > 0) {
                    setChats((prev) => {
                        const existingIds = new Set(prev.map((c) => c.id));
                        const unique = newChats.filter((c) => !existingIds.has(c.id));
                        return [...prev, ...unique];
                    });
                    setChatOffset((prev) => prev + 10);
                }
                setHasMoreChats(data.hasMore === true);
                setLoadingMoreChats(false);
            })
            .catch((err) => {
                console.error("Failed to load more chats", err);
                setLoadingMoreChats(false);
            });
    }, [loadingMoreChats, hasMoreChats, selectedCreatorId, chatOffset, enrichWithAvatars]);

    // --- Select creator (resets filters) ---
    const handleSelectCreator = useCallback((id: string) => {
        setSelectedCreatorId(id);
        setChats([]);
        setSpendBucket(0);
        setOnlineOnly(false);
        setSpendFilteredChats(null);
    }, []);

    return {
        creators,
        selectedCreatorId,
        chats,
        loading,
        loadingMoreChats,
        loadingSpendFilter,
        spendBucket,
        setSpendBucket,
        onlineOnly,
        setOnlineOnly,
        spendFilteredChats,
        hasMoreChats: spendFilteredChats ? false : hasMoreChats,
        tempTick,
        handleSelectCreator,
        handleLoadMoreChats,
    };
}
