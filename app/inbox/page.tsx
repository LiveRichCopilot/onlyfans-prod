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

    // 1. Fetch connected creators on load
    useEffect(() => {
        fetch("/api/creators")
            .then((res) => res.json())
            .then((data) => {
                const available = data.creators || [];
                setCreators(available);
                // Default stays "all" — show all creators' chats merged
            })
            .catch(console.error);
    }, []);

    // 2. Fetch Chat List when a creator is selected (or all)
    useEffect(() => {
        if (!selectedCreatorId) return;
        setLoading(true);
        const chatUrl = selectedCreatorId === "all"
            ? "/api/inbox/chats?all=true"
            : `/api/inbox/chats?creatorId=${selectedCreatorId}`;
        fetch(chatUrl)
            .then((res) => res.json())
            .then((data) => {
                const rawArray = Array.isArray(data.chats) ? data.chats : data.chats?.data || [];
                const mappedChats: Chat[] =
                    typeof rawArray.map === "function"
                        ? rawArray.map((c: any) => ({
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
                              totalSpend: c.totalSpend || 0,
                              _creatorId: c._creatorId || "",
                              _creatorName: c._creatorName || "",
                          }))
                        : [];
                mappedChats.sort(
                    (a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime()
                );
                setChats(mappedChats);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Failed to fetch chats", err);
                setLoading(false);
            });
    }, [selectedCreatorId]);

    // 3. Fetch messages + live polling
    // Use the chat's creatorId when in "all" mode
    const activeCreatorId = activeChat?._creatorId || selectedCreatorId;

    useEffect(() => {
        if (!activeChat || (!activeCreatorId || activeCreatorId === "all")) return;
        setMsgsLoading(true);
        fetchMessages();
        const pollInterval = setInterval(() => fetchMessages(false), 5000);
        return () => clearInterval(pollInterval);
    }, [activeChat, activeCreatorId]);

    const fetchMessages = (showLoader = true) => {
        if (showLoader) setMsgsLoading(true);
        const cId = activeChat?._creatorId || selectedCreatorId;
        fetch(`/api/inbox/messages?creatorId=${cId}&chatId=${activeChat?.id}`)
            .then((res) => res.json())
            .then((data) => {
                const rawMsgs = Array.isArray(data.messages) ? data.messages : data.messages?.data || [];
                const sortedRaw = [...rawMsgs].sort(
                    (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                const mappedMsgs: Message[] =
                    typeof sortedRaw.map === "function"
                        ? sortedRaw.map((m: any) => {
                              const fromId = m.fromUser?.id || m.author?.id || "unknown";
                              const isCreator = fromId !== activeChat?.withUser?.id;
                              const cleanText = (m.text || "").replace(/<[^>]*>?/gm, "");
                              return {
                                  id: m.id || m.message_id || Math.random().toString(),
                                  text: cleanText,
                                  media: Array.isArray(m.media)
                                      ? m.media.map((med: any) => {
                                            // Extract the best URL from various OFAPI response shapes
                                            const src = med.src || med.full || med.source?.source || med.source?.url
                                                || med.files?.source?.url || med.files?.preview?.url
                                                || med.video?.url || med.audio?.url
                                                || med.preview || med.thumb || med.squarePreview || "";
                                            const preview = med.preview || med.thumb || med.squarePreview
                                                || med.files?.preview?.url || med.source?.source || src || "";
                                            return {
                                                id: med.id?.toString() || Math.random().toString(),
                                                type: med.type === "gif" ? "photo" : (med.type || "photo"),
                                                canView: med.canView !== false,
                                                preview,
                                                src,
                                            };
                                        }).filter((med: any) => med.src || med.preview) // Skip media with no URLs
                                      : [],
                                  createdAt: m.createdAt || new Date().toISOString(),
                                  fromUser: { id: fromId },
                                  isFromCreator: isCreator,
                                  senderName: isCreator ? "Creator" : activeChat?.withUser?.name || "Fan",
                              };
                          })
                        : [];
                setMessages(mappedMsgs);
                if (showLoader) {
                    setMsgsLoading(false);
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                }
            })
            .catch((err) => {
                console.error("Failed to load messages", err);
                if (showLoader) setMsgsLoading(false);
            });
    };

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
        <div className="flex h-screen text-white/90 overflow-hidden bg-black">
            {/* Nav sidebar — hidden on mobile */}
            <div className="hidden md:block">
                <NavBar />
            </div>

            {/* Fan list — full width on mobile, fixed width on desktop */}
            <div
                className={`${
                    mobileView === "list" ? "flex" : "hidden"
                } md:flex w-full md:w-[340px] flex-col flex-shrink-0 border-r border-white/[0.06] bg-black/40`}
            >
                <FanList
                    creators={creators}
                    selectedCreatorId={selectedCreatorId}
                    onSelectCreator={handleSelectCreator}
                    chats={chats}
                    activeChat={activeChat}
                    onSelectChat={handleSelectChat}
                    loading={loading}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    unreadFirst={unreadFirst}
                    onUnreadFirstChange={setUnreadFirst}
                    onApplyFilters={setFilters}
                />
            </div>

            {/* Chat panel — full width on mobile, flex on desktop */}
            <div
                className={`${
                    mobileView === "chat" ? "flex" : "hidden"
                } md:flex flex-1 flex-col min-w-0 bg-black/20`}
            >
                {activeChat ? (
                    <>
                        <ChatTopBar
                            chat={activeChat}
                            isSfw={isSfw}
                            onToggleSfw={() => setIsSfw(!isSfw)}
                            onBack={handleBack}
                        />
                        <MessageFeed
                            ref={messagesEndRef}
                            messages={messages}
                            loading={msgsLoading}
                            isSfw={isSfw}
                            onDisableSfw={() => setIsSfw(false)}
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
