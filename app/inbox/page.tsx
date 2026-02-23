"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import type { Chat, Message } from "@/components/inbox/types";
import { NavBar } from "@/components/inbox/NavBar";
import { FanList } from "@/components/inbox/FanList";
import { ChatTopBar } from "@/components/inbox/ChatTopBar";
import { MessageFeed } from "@/components/inbox/MessageFeed";
import { FloatingChatBar } from "@/components/inbox/FloatingChatBar";
import { FanSidebar } from "@/components/inbox/FanSidebar";

// Helper: map raw OFAPI chat to our Chat type
function mapRawChat(c: any): Chat {
    return {
        id: c.fan?.id || c.chat_id || c.id || Math.random().toString(),
        withUser: {
            id: c.fan?.id || c.withUser?.id || "unknown",
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
        // Use DB lifetimeSpend if available (persistent), fallback to OFAPI snapshot
        totalSpend: c._dbLifetimeSpend || c.fan?.subscribedOnData?.totalSumm || c.totalSpend || 0,
        _creatorId: c._creatorId || "",
        _creatorName: c._creatorName || "",
        // lastPurchaseAt comes from DB (persistent) — set by /api/sync
        _lastPurchaseAt: c._lastPurchaseAt || undefined,
    };
}

export default function InboxPage() {
    const [creators, setCreators] = useState<any[]>([]);
    const [selectedCreatorId, setSelectedCreatorId] = useState<string>("all");
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [isSfw, setIsSfw] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Mobile view state: "list" or "chat"
    const [mobileView, setMobileView] = useState<"list" | "chat">("list");

    // Sort & Filter state
    const [sortBy, setSortBy] = useState("recent");
    const [unreadFirst, setUnreadFirst] = useState(false);
    const [filters, setFilters] = useState<any>(null);

    // --- Infinite message scroll state ---
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);
    const nextLastIdRef = useRef<string | null>(null);

    // Guard: track which creator selection is active to prevent stale appends
    const activeCreatorSelectionRef = useRef<string>("");

    // --- Infinite fan list scroll state ---
    const [chatOffset, setChatOffset] = useState(0);
    const [hasMoreChats, setHasMoreChats] = useState(true);
    const [loadingMoreChats, setLoadingMoreChats] = useState(false);

    // --- Media map ---
    const [mediaMap, setMediaMap] = useState<Record<string, { src: string; preview: string; type: string }>>({});

    // --- Jump to date state ---
    const [jumpingToDate, setJumpingToDate] = useState(false);
    const [jumpProgress, setJumpProgress] = useState(0); // number of messages loaded so far

    // --- Temperature ring tick — re-renders FanRows every 30s so green ring fades in real time ---
    const [tempTick, setTempTick] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setTempTick(t => t + 1), 30000);
        return () => clearInterval(interval);
    }, []);

    // 1. Fetch connected creators on load
    useEffect(() => {
        fetch("/api/creators")
            .then((res) => res.json())
            .then((data) => {
                const available = data.creators || [];
                setCreators(available);
            })
            .catch(console.error);
    }, []);

    // Helper: enrich chats with creator avatars and names
    const enrichWithAvatars = useCallback((chatList: Chat[]) => {
        const avatarMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        creators.forEach((c: any) => {
            if (c.id && c.avatarUrl) avatarMap[c.id] = c.avatarUrl;
            if (c.id && c.name) nameMap[c.id] = c.name;
        });
        chatList.forEach(c => {
            if (c._creatorId) {
                if (avatarMap[c._creatorId]) c._creatorAvatar = avatarMap[c._creatorId];
                if (nameMap[c._creatorId]) c._creatorName = nameMap[c._creatorId];
            }
        });
        return chatList;
    }, [creators]);

    // 2. Fetch initial Chat List, then auto-load remaining pages in background
    useEffect(() => {
        if (!selectedCreatorId) return;
        setLoading(true);
        setChats([]); // Clear immediately to prevent stale chats from other creators
        setChatOffset(0);
        setHasMoreChats(true);

        // Use a unique key for this selection so stale appends get rejected
        const selectionKey = `${selectedCreatorId}_${Date.now()}`;
        activeCreatorSelectionRef.current = selectionKey;

        const baseUrl = selectedCreatorId === "all"
            ? "/api/inbox/chats?all=true&limit=10"
            : `/api/inbox/chats?creatorId=${selectedCreatorId}&limit=10`;

        // First page — show immediately
        fetch(`${baseUrl}&offset=0`)
            .then((res) => res.json())
            .then(async (data) => {
                if (activeCreatorSelectionRef.current !== selectionKey) return;
                const rawArray = Array.isArray(data.chats) ? data.chats : data.chats?.data || [];
                const firstPage: Chat[] = enrichWithAvatars(Array.isArray(rawArray) ? rawArray.map(mapRawChat) : []);
                firstPage.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
                setChats(firstPage);
                setLoading(false);

                // Auto-load remaining pages in background
                let currentOffset = 10;
                let more = data.hasMore === true;
                while (more && activeCreatorSelectionRef.current === selectionKey && currentOffset < 200) {
                    try {
                        const res = await fetch(`${baseUrl}&offset=${currentOffset}`);
                        const nextData = await res.json();
                        if (activeCreatorSelectionRef.current !== selectionKey) break;
                        const nextRaw = Array.isArray(nextData.chats) ? nextData.chats : nextData.chats?.data || [];
                        const nextChats: Chat[] = enrichWithAvatars(Array.isArray(nextRaw) ? nextRaw.map(mapRawChat) : []);
                        if (nextChats.length > 0) {
                            setChats(prev => {
                                if (activeCreatorSelectionRef.current !== selectionKey) return prev;
                                const ids = new Set(prev.map(c => c.id));
                                const unique = nextChats.filter(c => !ids.has(c.id));
                                const merged = [...prev, ...unique];
                                merged.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
                                return merged;
                            });
                        }
                        more = nextData.hasMore === true;
                        currentOffset += 10;
                    } catch { break; }
                }
                setChatOffset(currentOffset);
                setHasMoreChats(false);
            })
            .catch((err) => {
                console.error("Failed to fetch chats", err);
                setLoading(false);
            });

    }, [selectedCreatorId]);

    // Re-enrich chats with creator avatars/names when creators load after chats
    useEffect(() => {
        if (creators.length === 0 || chats.length === 0) return;
        const avatarMap: Record<string, string> = {};
        const nameMap: Record<string, string> = {};
        creators.forEach((c: any) => {
            if (c.id && c.avatarUrl) avatarMap[c.id] = c.avatarUrl;
            if (c.id && c.name) nameMap[c.id] = c.name;
        });
        // Only update if any chat is missing creator data
        const needsUpdate = chats.some(c => c._creatorId && (!c._creatorAvatar || !c._creatorName));
        if (!needsUpdate) return;
        setChats(prev => prev.map(c => ({
            ...c,
            _creatorAvatar: c._creatorId && avatarMap[c._creatorId] ? avatarMap[c._creatorId] : c._creatorAvatar,
            _creatorName: c._creatorId && nameMap[c._creatorId] ? nameMap[c._creatorId] : c._creatorName,
        })));
    }, [creators, chats.length]);

    // --- Phase 3: Infinite fan list scroll ---
    const handleLoadMoreChats = useCallback(() => {
        if (loadingMoreChats || !hasMoreChats) return;
        setLoadingMoreChats(true);
        const chatUrl = selectedCreatorId === "all"
            ? `/api/inbox/chats?all=true&limit=10&offset=${chatOffset}`
            : `/api/inbox/chats?creatorId=${selectedCreatorId}&limit=10&offset=${chatOffset}`;
        fetch(chatUrl)
            .then((res) => res.json())
            .then((data) => {
                const rawArray = Array.isArray(data.chats) ? data.chats : data.chats?.data || [];
                const newChats: Chat[] = Array.isArray(rawArray) ? rawArray.map(mapRawChat) : [];
                // Enrich with creator avatars
                const creatorAvatarMap: Record<string, string> = {};
                creators.forEach((c: any) => { if (c.id && c.avatarUrl) creatorAvatarMap[c.id] = c.avatarUrl; });
                newChats.forEach(c => { if (c._creatorId && creatorAvatarMap[c._creatorId]) c._creatorAvatar = creatorAvatarMap[c._creatorId]; });
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
    }, [loadingMoreChats, hasMoreChats, selectedCreatorId, chatOffset]);

    // 3. Fetch messages + fresh media, then poll
    const activeCreatorId = activeChat?._creatorId || selectedCreatorId;

    // Keep a ref for the mediaMap so processMessages always sees latest
    const mediaMapRef = useRef(mediaMap);
    mediaMapRef.current = mediaMap;

    useEffect(() => {
        if (!activeChat || (!activeCreatorId || activeCreatorId === "all")) return;
        setMsgsLoading(true);
        setMediaMap({});
        setHasMoreMessages(true);
        nextLastIdRef.current = null;

        const cId = activeChat._creatorId || selectedCreatorId;

        // Fetch messages AND fresh media URLs in parallel
        Promise.all([
            fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50`).then(r => r.json()).catch(() => ({ messages: [], hasMore: false })),
            fetch(`/api/inbox/media?creatorId=${cId}&chatId=${activeChat.id}`).then(r => r.json()).catch(() => ({ media: {} })),
        ]).then(([msgData, mediaData]) => {
            if (mediaData.media) setMediaMap(mediaData.media);
            processMessages(msgData, false);
            setHasMoreMessages(msgData.hasMore !== false);
            nextLastIdRef.current = msgData.nextLastId || null;
            setMsgsLoading(false);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        });

        // Poll messages every 5s (new messages only, no before param)
        const pollInterval = setInterval(() => {
            fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50`)
                .then(r => r.json())
                .then(data => processMessages(data, false))
                .catch(console.error);
        }, 5000);

        // Phase 1: Auto-refresh media URLs every 60s to prevent CDN expiry
        const mediaRefreshInterval = setInterval(() => {
            fetch(`/api/inbox/media?creatorId=${cId}&chatId=${activeChat.id}`)
                .then(r => r.json())
                .then(mediaData => {
                    if (mediaData.media) setMediaMap(mediaData.media);
                })
                .catch(console.error);
        }, 60000);

        return () => {
            clearInterval(pollInterval);
            clearInterval(mediaRefreshInterval);
        };
    }, [activeChat, activeCreatorId]);

    // --- Phase 2: Load older messages on scroll-to-top ---
    const handleLoadOlderMessages = useCallback(() => {
        if (loadingOlder || !hasMoreMessages || !activeChat) return;
        const cId = activeChat._creatorId || selectedCreatorId;
        if (!cId || cId === "all") return;

        // Use OFAPI's nextLastId cursor, fall back to oldest message ID
        const cursor = nextLastIdRef.current || messages[0]?.id;
        if (!cursor) return;

        setLoadingOlder(true);
        fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=50&before=${cursor}`)
            .then(r => r.json())
            .then(data => {
                const rawMsgs = Array.isArray(data.messages) ? data.messages : data.messages?.data || [];
                const olderMapped = mapRawMessages(rawMsgs);
                if (olderMapped.length > 0) {
                    setMessages(prev => {
                        const existingIds = new Set(prev.map(m => m.id));
                        const unique = olderMapped.filter(m => !existingIds.has(m.id));
                        return [...unique, ...prev];
                    });
                }
                // Update cursor for next page
                nextLastIdRef.current = data.nextLastId || null;
                setHasMoreMessages(data.hasMore === true);
                setLoadingOlder(false);
            })
            .catch(err => {
                console.error("Failed to load older messages", err);
                setLoadingOlder(false);
            });
    }, [loadingOlder, hasMoreMessages, activeChat, selectedCreatorId, messages]);

    // Map raw OFAPI messages to our Message type
    const mapRawMessages = useCallback((rawMsgs: any[]): Message[] => {
        const sorted = [...rawMsgs].sort(
            (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        return sorted.map((m: any) => {
            const fromId = m.fromUser?.id || m.author?.id || "unknown";
            const isCreator = fromId !== activeChat?.withUser?.id;
            const cleanText = (m.text || "").replace(/<[^>]*>?/gm, "");
            const currentMediaMap = mediaMapRef.current;
            return {
                id: m.id || m.message_id || Math.random().toString(),
                text: cleanText,
                media: Array.isArray(m.media)
                    ? m.media.map((med: any) => {
                          const medId = med.id?.toString() || "";
                          // Fresh URLs from /media endpoint (refreshed every 60s)
                          const fresh = currentMediaMap[medId];
                          // OFAPI files structure: files.full.url, files.preview.url, files.thumb.url, files.squarePreview.url
                          // Note: files.full.url can be NULL for DRM video even when canView=true
                          const src = fresh?.src
                              || med.files?.full?.url
                              || med.files?.preview?.url
                              || med.files?.thumb?.url
                              || med.src || med.full
                              || med.source?.source || med.source?.url
                              || med.video?.url || med.audio?.url
                              || med.preview || med.thumb || med.squarePreview || "";
                          const preview = fresh?.preview
                              || med.files?.preview?.url
                              || med.files?.thumb?.url
                              || med.files?.squarePreview?.url
                              || med.preview || med.thumb || med.squarePreview
                              || src || "";
                          return {
                              id: medId || Math.random().toString(),
                              type: fresh?.type || (med.type === "gif" ? "photo" : (med.type || "photo")),
                              canView: med.canView !== false,
                              preview,
                              src,
                          };
                      }).filter((med: any) => med.src || med.preview)
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
        });
    }, [activeChat]);

    const processMessages = (data: any, prepend: boolean) => {
        const rawMsgs = Array.isArray(data.messages) ? data.messages : data.messages?.data || [];
        const mappedMsgs = mapRawMessages(rawMsgs);
        if (prepend) {
            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const unique = mappedMsgs.filter(m => !existingIds.has(m.id));
                return [...unique, ...prev];
            });
        } else {
            setMessages(mappedMsgs);
        }
    };

    // Jump to date: rapid-paginate backwards until we reach messages from the target date
    // OFAPI has no date filter — we page with id cursor until createdAt crosses targetDate
    const handleJumpToDate = useCallback(async (targetDate: Date) => {
        if (!activeChat) return;
        const cId = activeChat._creatorId || selectedCreatorId;
        if (!cId || cId === "all") return;

        setJumpingToDate(true);
        setJumpProgress(0);
        setMessages([]);

        const targetDayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();
        let cursor: string | undefined = undefined;
        const allMessages: any[] = [];
        let reachedTarget = false;
        let iterations = 0;
        const maxIterations = 30; // Safety cap: 30 pages x 100 = 3000 messages max
        let lastNextLastId: string | null = null;
        let canLoadOlder = true; // Track if there are still older messages beyond what we fetched

        try {
            while (!reachedTarget && iterations < maxIterations) {
                iterations++;
                let fetchUrl = `/api/inbox/messages?creatorId=${cId}&chatId=${activeChat.id}&limit=100`;
                if (cursor) fetchUrl += `&before=${cursor}`;
                const res = await fetch(fetchUrl);
                const data = await res.json();
                const rawMsgs: any[] = Array.isArray(data.messages) ? data.messages : data.messages?.data || [];

                if (rawMsgs.length === 0) {
                    canLoadOlder = false;
                    break;
                }

                allMessages.push(...rawMsgs);
                setJumpProgress(allMessages.length);

                // OFAPI returns order=desc (newest first), so last element is oldest in page
                const oldestMsg = rawMsgs[rawMsgs.length - 1];
                const oldestTime = new Date(oldestMsg.createdAt).getTime();
                if (oldestTime <= targetDayStart) {
                    reachedTarget = true;
                }

                // Use the server's nextLastId cursor (extracted from _pagination.next_page)
                lastNextLastId = data.nextLastId || null;
                cursor = lastNextLastId || undefined;
                if (!cursor || data.hasMore === false) {
                    canLoadOlder = data.hasMore !== false && !!cursor;
                    break;
                }
            }

            // Sort all collected messages chronologically (ascending) for slicing
            allMessages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            // Find the first message on or after the target date
            const idx = allMessages.findIndex((m: any) => new Date(m.createdAt).getTime() >= targetDayStart);

            let windowMsgs: any[];
            if (idx >= 0) {
                // Show context: 50 messages before target + 150 after (clamped to bounds)
                const start = Math.max(0, idx - 50);
                const end = Math.min(allMessages.length, idx + 150);
                windowMsgs = allMessages.slice(start, end);
            } else {
                // Didn't reach the date — show the oldest chunk we have
                windowMsgs = allMessages.slice(-200);
            }

            const mapped = mapRawMessages(windowMsgs);
            setMessages(mapped);

            // Set "load older" cursor = oldest message in the window (asc order, so index 0)
            // mapRawMessages sorts asc internally, so messages[0] is oldest displayed
            nextLastIdRef.current = windowMsgs[0]?.id ?? lastNextLastId;
            // Only allow "load older" if we didn't exhaust the chat history
            setHasMoreMessages(canLoadOlder);
        } catch (err) {
            console.error("Jump to date failed:", err);
        } finally {
            setJumpingToDate(false);
        }
    }, [activeChat, selectedCreatorId, mapRawMessages]);

    const handleSelectCreator = (id: string) => {
        setSelectedCreatorId(id);
        setChats([]);
        setActiveChat(null);
        setMessages([]);
        setMobileView("list");
    };

    const handleSelectChat = (chat: Chat) => {
        setActiveChat(chat);
        setMobileView("chat");
    };

    const handleBack = () => {
        setActiveChat(null);
        setMobileView("list");
    };

    const handleSend = async () => {
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
        setMessages([...messages, optimisticMsg]);
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
    };

    return (
        <div className="flex h-screen text-white/90 overflow-hidden" style={{ backgroundColor: "#2d2d2d" }}>
            {/* Nav sidebar — hidden on mobile */}
            <div className="hidden md:block">
                <NavBar />
            </div>

            {/* Fan list — full width on mobile, fixed width on desktop */}
            <div
                className={`${
                    mobileView === "list" ? "flex" : "hidden"
                } md:flex w-full md:w-[340px] flex-col flex-shrink-0 border-r border-white/[0.06]`}
            >
                <FanList
                    creators={creators}
                    selectedCreatorId={selectedCreatorId}
                    onSelectCreator={handleSelectCreator}
                    chats={chats}
                    activeChat={activeChat}
                    onSelectChat={handleSelectChat}
                    loading={loading || loadingMoreChats}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    unreadFirst={unreadFirst}
                    onUnreadFirstChange={setUnreadFirst}
                    onApplyFilters={setFilters}
                    onLoadMore={handleLoadMoreChats}
                    hasMoreChats={hasMoreChats}
                    tempTick={tempTick}
                />
            </div>

            {/* Chat panel — full width on mobile, flex on desktop */}
            <div
                className={`${
                    mobileView === "chat" ? "flex" : "hidden"
                } md:flex flex-1 flex-col min-w-0`}
                style={{ backgroundColor: "#1a1a1a" }}
            >
                {activeChat ? (
                    <>
                        <ChatTopBar
                            chat={activeChat}
                            isSfw={isSfw}
                            onToggleSfw={() => setIsSfw(!isSfw)}
                            onBack={handleBack}
                            onJumpToDate={handleJumpToDate}
                            jumpingToDate={jumpingToDate}
                        />
                        <MessageFeed
                            ref={messagesEndRef}
                            messages={messages}
                            loading={msgsLoading}
                            isSfw={isSfw}
                            onDisableSfw={() => setIsSfw(false)}
                            loadingOlder={loadingOlder}
                            hasMore={hasMoreMessages}
                            onLoadOlder={handleLoadOlderMessages}
                            creatorId={activeChat?._creatorId || selectedCreatorId}
                            jumpingToDate={jumpingToDate}
                            jumpProgress={jumpProgress}
                        />
                        <FloatingChatBar
                            inputText={inputText}
                            onTyping={(e) => setInputText(e.target.value)}
                            onSend={handleSend}
                            onSetText={setInputText}
                            disabled={msgsLoading}
                        />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/40">
                        <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                            <MessageSquare size={28} className="text-white/15" />
                        </div>
                        <h3 className="text-lg font-medium text-white/60">Select a conversation</h3>
                        <p className="text-sm mt-2 text-white/25 max-w-xs text-center">
                            Pick a fan from the list to view their chat thread
                        </p>
                    </div>
                )}
            </div>

            {/* Fan Sidebar — desktop only */}
            {activeChat && (
                <div className="hidden xl:block">
                    <FanSidebar chat={activeChat} width={300} />
                </div>
            )}
        </div>
    );
}
