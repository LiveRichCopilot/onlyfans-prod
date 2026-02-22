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
import { PanelSlider } from "@/components/inbox/PanelSlider";

export default function InboxPage() {
    const [creators, setCreators] = useState<any[]>([]);
    const [selectedCreatorId, setSelectedCreatorId] = useState<string>("");
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [isSfw, setIsSfw] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Sort & Filter state
    const [sortBy, setSortBy] = useState("recent");
    const [unreadFirst, setUnreadFirst] = useState(false);
    const [filters, setFilters] = useState<any>(null);

    // Panel slider state
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const handleSidebarResize = useCallback((delta: number) => {
        setSidebarWidth(prev => Math.max(200, Math.min(500, prev + delta)));
    }, []);

    // 1. Fetch connected creators on load
    useEffect(() => {
        fetch("/api/creators")
            .then(res => res.json())
            .then(data => {
                const available = data.creators || [];
                setCreators(available);
                const firstLinked = available.find((c: any) => c.ofapiToken && c.ofapiToken !== "unlinked");
                if (firstLinked) setSelectedCreatorId(firstLinked.id);
                else if (available.length > 0) setSelectedCreatorId(available[0].id);
            })
            .catch(console.error);
    }, []);

    // 2. Fetch Chat List when a creator is selected
    useEffect(() => {
        if (!selectedCreatorId) return;
        setLoading(true);
        fetch(`/api/inbox/chats?creatorId=${selectedCreatorId}`)
            .then(res => res.json())
            .then(data => {
                const rawArray = Array.isArray(data.chats) ? data.chats : (data.chats?.data || []);
                const mappedChats: Chat[] = typeof rawArray.map === 'function' ? rawArray.map((c: any) => ({
                    id: c.fan?.id || c.chat_id || c.id || Math.random().toString(),
                    withUser: {
                        id: c.fan?.id || c.withUser?.id || "unknown",
                        username: c.fan?.username || c.withUser?.username || "Fan",
                        name: c.fan?.name || c.withUser?.name || "Anonymous",
                        avatar: c.fan?.avatar || c.withUser?.avatar || ""
                    },
                    lastMessage: {
                        text: c.lastMessage?.text?.replace(/<[^>]*>?/gm, '') || (c.lastMessage?.media?.length > 0 || c.hasMedia ? "[Media Attachment]" : "No message"),
                        createdAt: c.lastMessage?.createdAt || new Date().toISOString(),
                        isRead: c.lastMessage?.isOpened ?? true
                    },
                    totalSpend: c.totalSpend || 0
                })) : [];
                mappedChats.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
                setChats(mappedChats);
                setLoading(false);
            })
            .catch(err => { console.error("Failed to fetch chats", err); setLoading(false); });
    }, [selectedCreatorId]);

    // 3. Fetch messages + live polling
    useEffect(() => {
        if (!activeChat || !selectedCreatorId) return;
        setMsgsLoading(true);
        fetchMessages();
        const pollInterval = setInterval(() => { fetchMessages(false); }, 5000);
        return () => clearInterval(pollInterval);
    }, [activeChat, selectedCreatorId]);

    const fetchMessages = (showLoader = true) => {
        if (showLoader) setMsgsLoading(true);
        fetch(`/api/inbox/messages?creatorId=${selectedCreatorId}&chatId=${activeChat?.id}`)
            .then(res => res.json())
            .then(data => {
                const rawMsgs = Array.isArray(data.messages) ? data.messages : (data.messages?.data || []);
                const sortedRaw = [...rawMsgs].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
                const mappedMsgs: Message[] = typeof sortedRaw.map === 'function' ? sortedRaw.map((m: any) => {
                    const fromId = m.fromUser?.id || m.author?.id || "unknown";
                    const isCreator = fromId !== activeChat?.withUser?.id && fromId !== activeChat?.fan?.id;
                    const cleanText = (m.text || "").replace(/<[^>]*>?/gm, '');
                    return {
                        id: m.id || m.message_id || Math.random().toString(),
                        text: cleanText,
                        media: Array.isArray(m.media) ? m.media.map((med: any) => ({
                            id: med.id?.toString() || Math.random().toString(),
                            type: med.type || 'photo',
                            canView: med.canView !== false,
                            preview: med.preview || med.thumb || med.squarePreview || med.source?.source || med.full || "",
                            src: med.full || med.source?.source || med.preview || med.video?.url || med.audio?.url || ""
                        })) : [],
                        createdAt: m.createdAt || new Date().toISOString(),
                        fromUser: { id: fromId },
                        isFromCreator: isCreator,
                        senderName: (isCreator ? "Creator" : (activeChat?.withUser?.name || activeChat?.fan?.name || "Fan"))
                    };
                }) : [];
                setMessages(mappedMsgs);
                if (showLoader) {
                    setMsgsLoading(false);
                    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
                }
            })
            .catch(err => { console.error("Failed to load messages", err); if (showLoader) setMsgsLoading(false); });
    };

    const handleSelectCreator = (id: string) => { setSelectedCreatorId(id); setChats([]); setActiveChat(null); setMessages([]); };

    const handleSend = async () => {
        if (!inputText.trim() || !activeChat || !selectedCreatorId) return;
        const optimisticMsg: Message = { id: `temp_${Date.now()}`, text: inputText, createdAt: new Date().toISOString(), fromUser: { id: selectedCreatorId }, isFromCreator: true, senderName: "Sending..." };
        setMessages([...messages, optimisticMsg]);
        const textToSend = inputText;
        setInputText("");
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        try {
            await fetch('/api/inbox/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ creatorId: selectedCreatorId, chatId: activeChat.id, text: textToSend }) });
        } catch (e) { console.error("Failed to send", e); }
    };

    return (
        <div className="flex bg-black text-white/90 min-h-screen overflow-hidden relative">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute top-[20%] left-[60%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

            <NavBar />

            <FanList
                creators={creators} selectedCreatorId={selectedCreatorId} onSelectCreator={handleSelectCreator}
                chats={chats} activeChat={activeChat} onSelectChat={setActiveChat} loading={loading}
                sortBy={sortBy} onSortChange={setSortBy} unreadFirst={unreadFirst} onUnreadFirstChange={setUnreadFirst} onApplyFilters={setFilters}
            />

            {/* Main Chat Panel */}
            <div className="flex-1 flex flex-col m-4 z-10 glass-panel rounded-3xl overflow-hidden border-white/10 relative shadow-2xl">
                {activeChat ? (
                    <>
                        <ChatTopBar chat={activeChat} isSfw={isSfw} onToggleSfw={() => setIsSfw(!isSfw)} />
                        <MessageFeed ref={messagesEndRef} messages={messages} loading={msgsLoading} isSfw={isSfw} onDisableSfw={() => setIsSfw(false)} />
                        <FloatingChatBar inputText={inputText} onTyping={(e) => setInputText(e.target.value)} onSend={handleSend} onSetText={setInputText} disabled={msgsLoading} />
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-white/40 relative bg-black/10">
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                            <MessageSquare size={36} className="text-white/20" />
                        </div>
                        <h3 className="text-xl font-medium text-white/80">Select an active conversation</h3>
                        <p className="text-sm mt-3 max-w-sm text-center font-medium leading-relaxed">Click a fan on the left sidebar to securely sync this workspace with their live OnlyFans chat thread.</p>
                    </div>
                )}
            </div>

            {/* Panel Slider + Fan Sidebar */}
            {activeChat && (
                <>
                    <PanelSlider onResize={handleSidebarResize} side="right" />
                    <FanSidebar chat={activeChat} width={sidebarWidth} />
                </>
            )}
        </div>
    );
}
