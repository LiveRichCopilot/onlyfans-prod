"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Send, Image as ImageIcon, Search, CheckCheck, MoreHorizontal, UserCircle, Activity, Eye, EyeOff, FolderOpen, LayoutGrid, MessageSquare } from "lucide-react";

type Chat = {
    id: string;
    withUser: {
        id: string;
        username: string;
        name: string;
        avatar?: string;
    };
    fan?: any;
    lastMessage: {
        text: string;
        createdAt: string;
        isRead: boolean;
    };
    totalSpend?: number;
};

type Message = {
    id: string;
    text: string;
    media?: {
        id: string;
        type: string;
        canView: boolean;
        preview: string;
        src: string;
    }[];
    createdAt: string;
    fromUser: {
        id: string;
    };
    isFromCreator: boolean;
    senderName: string;
};

export default function InboxPage() {
    const [creators, setCreators] = useState<any[]>([]);
    const [selectedCreatorId, setSelectedCreatorId] = useState<string>("");

    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const [msgsLoading, setMsgsLoading] = useState(false);
    const [isSfw, setIsSfw] = useState(true); // Default to Safe For Work Mode
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Fetch connected creators on load
    useEffect(() => {
        fetch("/api/creators")
            .then(res => res.json())
            .then(data => {
                const available = data.creators || [];
                setCreators(available);
                const firstLinked = available.find((c: any) => c.ofapiToken && c.ofapiToken !== "unlinked");
                if (firstLinked) {
                    setSelectedCreatorId(firstLinked.id);
                } else if (available.length > 0) {
                    setSelectedCreatorId(available[0].id);
                }
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
                        text: c.lastMessage?.text?.replace(/<[^>]*>?/gm, '') || (c.lastMessage?.media?.length > 0 || c.hasMedia ? "📸 [Media Attachment]" : "No message"),
                        createdAt: c.lastMessage?.createdAt || new Date().toISOString(),
                        isRead: c.lastMessage?.isOpened ?? true
                    },
                    totalSpend: c.totalSpend || 0
                })) : [];
                // Sort by recent messages
                mappedChats.sort((a, b) => new Date(b.lastMessage.createdAt).getTime() - new Date(a.lastMessage.createdAt).getTime());
                setChats(mappedChats);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch chats", err);
                setLoading(false);
            });
    }, [selectedCreatorId]);

    useEffect(() => {
        if (!activeChat || !selectedCreatorId) return;

        // Initial load
        setMsgsLoading(true);
        fetchMessages();

        // Start Live Polling (every 5 seconds)
        const pollInterval = setInterval(() => {
            fetchMessages(false); // Silent fetch, no loading spinner
        }, 5000);

        return () => clearInterval(pollInterval);
    }, [activeChat, selectedCreatorId]);

    const fetchMessages = (showLoader = true) => {
        if (showLoader) setMsgsLoading(true);

        fetch(`/api/inbox/messages?creatorId=${selectedCreatorId}&chatId=${activeChat?.id}`)
            .then(res => res.json())
            .then(data => {
                const rawMsgs = Array.isArray(data.messages) ? data.messages : (data.messages?.data || []);

                // Usually messages arrive in reverse chronological order from OFAPI, we need chronological for chat view
                const sortedRaw = [...rawMsgs].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                const mappedMsgs: Message[] = typeof sortedRaw.map === 'function' ? sortedRaw.map((m: any) => {
                    const fromId = m.fromUser?.id || m.author?.id || "unknown";
                    const isCreator = fromId !== activeChat?.withUser?.id && fromId !== activeChat?.fan?.id;

                    const rawText = m.text || "";
                    // Basic HTML text strip for clean display
                    const cleanText = rawText.replace(/<[^>]*>?/gm, '');

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
                    setTimeout(scrollToBottom, 50);
                }
            })
            .catch(err => {
                console.error("Failed to load messages", err);
                if (showLoader) setMsgsLoading(false);
            });
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);
    };

    const handleSend = async () => {
        if (!inputText.trim() || !activeChat || !selectedCreatorId) return;

        // Optimistic UI Update
        const optimisticMsg: Message = {
            id: `temp_${Date.now()}`,
            text: inputText,
            createdAt: new Date().toISOString(),
            fromUser: { id: selectedCreatorId },
            isFromCreator: true,
            senderName: "Sending..."
        };
        setMessages([...messages, optimisticMsg]);
        const textToSend = inputText;
        setInputText("");
        setTimeout(scrollToBottom, 50);

        try {
            await fetch('/api/inbox/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatorId: selectedCreatorId,
                    chatId: activeChat.id,
                    text: textToSend
                })
            });
            // We could refetch messages here, but optimistic is usually fine
        } catch (e) {
            console.error("Failed to send", e);
        }
    };

    return (
        <div className="flex bg-black text-white/90 min-h-screen overflow-hidden relative">

            {/* Background Orbs/Gradients */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[120px] mix-blend-screen pointer-events-none" />
            <div className="absolute top-[20%] left-[60%] w-[30%] h-[30%] bg-cyan-600/10 rounded-full blur-[100px] mix-blend-screen pointer-events-none" />

            {/* Global Nav Sidebar from Dashboard */}
            <aside className="w-16 lg:w-64 glass-panel m-4 mr-0 rounded-3xl p-4 lg:p-6 hidden md:flex flex-col z-10 border-white/10">
                <div className="flex items-center gap-3 mb-10">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-teal-600 to-gray-700 flex items-center justify-center font-bold text-lg shadow-lg shadow-teal-900/50">
                        OF
                    </div>
                    <div className="hidden lg:block">
                        <div className="text-xl font-bold tracking-tight text-white/90">HQ</div>
                        <div className="text-xs text-white/50">Agency Workspace</div>
                    </div>
                </div>

                <nav className="space-y-8 flex-1">
                    <div>
                        <div className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-3 px-2 hidden lg:block">Management</div>
                        <ul className="space-y-2">
                            <Link href="/">
                                <li className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 text-white/60 hover:text-white transition rounded-xl hover:bg-white/5 cursor-pointer">
                                    <LayoutGrid size={20} /> <span className="hidden lg:inline text-sm">Dashboard</span>
                                </li>
                            </Link>
                            <li className="flex items-center justify-center lg:justify-start gap-3 px-3 py-2.5 rounded-xl bg-white/10 text-white shadow-sm border border-white/10">
                                <MessageSquare size={20} /> <span className="hidden lg:inline text-sm">Live Inbox</span>
                            </li>
                        </ul>
                    </div>
                </nav>
            </aside>

            {/* LEFT SIDEBAR: Chat List */}
            <div className="w-[340px] m-4 mr-0 flex flex-col z-10 glass-panel rounded-3xl overflow-hidden border-white/10">
                {/* Creator Selector Header */}
                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <select
                        value={selectedCreatorId}
                        onChange={(e) => {
                            setSelectedCreatorId(e.target.value);
                            setChats([]);
                            setActiveChat(null);
                            setMessages([]);
                        }}
                        className="w-full bg-white/5 text-sm text-white rounded-xl px-3 py-2 outline-none border border-white/10 focus:border-teal-500 transition-colors appearance-none"
                    >
                        <option value="" className="text-black">Select a Creator</option>
                        {creators.map(c => (
                            <option key={c.id} value={c.id} className="text-black">{c.name || 'Unnamed Creator'} {c.ofapiToken === 'unlinked' ? '(Unlinked)' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/20">
                    <div className="flex bg-white/5 rounded-xl border border-white/10 p-1 relative w-full">
                        <Search className="absolute left-3 top-2.5 text-white/40" size={16} />
                        <input
                            type="text"
                            placeholder="Search chats"
                            className="bg-transparent border-none outline-none w-full pl-8 pr-4 text-sm py-1.5 text-white placeholder-white/30"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-white/10 bg-black/10">
                    <button className="px-4 py-1.5 bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-full text-xs font-semibold tracking-wide">All</button>
                    <button className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-full text-xs font-semibold text-white/60">Unread</button>
                    <button className="px-4 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-full text-xs font-semibold text-white/60">Super Fans</button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
                    {!selectedCreatorId ? (
                        <div className="p-6 text-center text-sm text-white/40">Please select a creator to view chats.</div>
                    ) : loading ? (
                        <div className="p-6 text-center text-sm text-white/50 flex flex-col items-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-t-2 border-teal-500 mb-3"></div>
                            Loading Live Live Chats...
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="p-6 text-center text-sm text-white/40">No chats found for this creator.</div>
                    ) : (
                        chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveChat(chat)}
                                className={`flex items-start p-4 cursor-pointer border-b border-white/5 transition-colors ${activeChat?.id === chat.id ? 'bg-white/10 border-l-2 border-l-teal-500' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
                            >
                                <div className="w-11 h-11 rounded-full bg-white/10 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3 border border-white/10 shadow-sm">
                                    {chat.withUser.avatar ? (
                                        <img src={`/api/proxy-media?url=${encodeURIComponent(chat.withUser.avatar)}`} alt="Avatar" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle size={24} className="text-white/30" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-semibold text-sm truncate text-white/90">{chat.withUser.name} <span className="text-xs text-white/40 font-normal">@{chat.withUser.username}</span></h3>
                                        <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                                            {chat.lastMessage.createdAt ? new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-xs">
                                        {chat.totalSpend !== undefined && chat.totalSpend > 0 ? (
                                            <span className="text-[#14b8a6] font-semibold mr-2">${chat.totalSpend}</span>
                                        ) : null}
                                        <p className="text-gray-400 truncate w-full">{chat.lastMessage.text}</p>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* MAIN PANEL: Active Chat */}
            <div className="flex-1 flex flex-col m-4 z-10 glass-panel rounded-3xl overflow-hidden border-white/10 relative shadow-2xl">
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-6 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/20 backdrop-blur-md">
                            <div className="flex items-center">
                                <h2 className="font-semibold text-lg tracking-wide text-white/95">{activeChat.withUser.name} <span className="text-sm font-normal text-white/40 ml-1">@{activeChat.withUser.username}</span></h2>
                            </div>
                            <div className="flex items-center gap-4 text-white/50">
                                <button onClick={() => setIsSfw(!isSfw)} className={`transition-colors p-2 rounded-lg hover:bg-white/10 ${isSfw ? 'text-teal-400 bg-teal-500/10' : 'hover:text-white'}`} title="Toggle Safe For Work Mode">
                                    {isSfw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <button className="p-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors"><Activity size={18} /></button>
                                <button className="p-2 rounded-lg hover:bg-white/10 hover:text-white transition-colors"><MoreHorizontal size={18} /></button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-4 relative custom-scrollbar bg-black/10">
                            <div className="text-center text-[10px] text-white/30 uppercase tracking-widest my-4 bg-black/20 py-1.5 px-4 rounded-full mx-auto border border-white/5 shadow-inner">Live API Chat Thread Synced Securely</div>

                            {msgsLoading && (
                                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-white/60">
                                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-teal-500 mb-3"></div>
                                    Syncing OnlyFans payload...
                                </div>
                            )}

                            {!msgsLoading && messages.map((msg, i) => {
                                const isSelf = msg.isFromCreator;
                                return (
                                    <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-md ${isSelf
                                            ? 'bg-teal-600/80 backdrop-blur-md text-white rounded-br-sm border border-teal-500/30'
                                            : 'bg-white/10 backdrop-blur-md text-white/95 rounded-bl-sm border border-white/10'
                                            }`}>
                                            {msg.media && msg.media.length > 0 && (
                                                <div className={`grid gap-1.5 mb-2 ${msg.media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                                    {msg.media.map(med => {
                                                        const mediaUrl = med.canView ? med.src : med.preview;
                                                        const proxyUrl = mediaUrl ? `/api/proxy-media?url=${encodeURIComponent(mediaUrl)}` : '';
                                                        return (
                                                            <div key={med.id} className="relative rounded-xl overflow-hidden bg-black/40 flex items-center justify-center min-h-[150px] border border-white/5">
                                                                {med.type === 'video' ? (
                                                                    <video src={proxyUrl} poster={med.preview ? `/api/proxy-media?url=${encodeURIComponent(med.preview)}` : undefined} controls controlsList="nodownload" className={`w-full h-full max-h-[320px] object-cover ${(!med.canView || isSfw) ? 'blur-xl scale-110' : ''}`} />
                                                                ) : med.type === 'audio' ? (
                                                                    <audio src={proxyUrl} controls className={`w-full max-w-[220px] m-4 ${!med.canView ? 'blur-md' : ''}`} />
                                                                ) : (
                                                                    <img
                                                                        src={proxyUrl}
                                                                        alt="Media Attachment"
                                                                        referrerPolicy="no-referrer"
                                                                        className={`w-full h-full max-h-[320px] object-cover ${(!med.canView || isSfw) ? 'blur-xl scale-110 cursor-pointer' : ''}`}
                                                                        onClick={() => { if (isSfw) setIsSfw(false); }}
                                                                        onError={(e) => {
                                                                            e.currentTarget.style.display = 'none';
                                                                            e.currentTarget.parentElement!.innerHTML += '<div class="absolute inset-0 flex flex-col items-center justify-center text-[10px] text-white/50 bg-[#16161a]"><span>Expired Media</span><span class="text-[8px] opacity-50 mt-1">API URL revoked</span></div>';
                                                                        }}
                                                                    />
                                                                )}
                                                                {!med.canView && (
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-10 pointer-events-none">
                                                                        <div className="bg-black/60 backdrop-blur-md shadow-xl text-white text-[11px] px-3 py-1.5 rounded-full font-medium border border-white/10 flex items-center gap-1.5">
                                                                            <span>🔒</span> Locked PPV
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                            {msg.text && (
                                                <div
                                                    dangerouslySetInnerHTML={{ __html: msg.text }}
                                                    className="break-words whitespace-pre-wrap [&>p]:m-0 [&>p]:inline"
                                                />
                                            )}
                                            {isSelf && (
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-[10px] text-white/50 bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                                                        Sent by {msg.senderName}
                                                    </span>
                                                    <CheckCheck size={12} className="text-[#0d9488]" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
                            <div className="flex items-center bg-white/5 border border-white/10 rounded-2xl px-2 py-1.5 shadow-inner">
                                <button className="p-2.5 text-white/40 hover:bg-white/10 hover:text-white rounded-xl transition-colors" title="Upload Local Media">
                                    <ImageIcon size={20} />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-[#0d9488] transition-colors" title="Attach from OnlyFans Vault">
                                    <FolderOpen size={20} />
                                </button>

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message to send directly to OnlyFans..."
                                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-white placeholder-white/30"
                                    disabled={msgsLoading}
                                />

                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || msgsLoading}
                                    className={`p-2.5 rounded-xl transition-all shadow-sm ${inputText.trim() ? 'bg-teal-500 text-white hover:bg-teal-400 active:scale-95' : 'bg-white/5 text-white/30'
                                        }`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-white/40 relative bg-black/10">
                        <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-inner">
                            <MessageSquare size={36} className="text-white/20" />
                        </div>
                        <h3 className="text-xl font-medium text-white/80">Select an active conversation</h3>
                        <p className="text-sm mt-3 max-w-sm text-center font-medium leading-relaxed">Click a fan on the left sidebar to securely sync this workspace with their live OnlyFans chat thread.</p>
                    </div>
                )}
            </div>

            {/* RIGHT PANEL: Stats / Insights */}
            {activeChat && (
                <div className="w-[300px] m-4 ml-0 flex flex-col z-10 glass-panel rounded-3xl overflow-y-auto custom-scrollbar border-white/10 p-6 hidden xl:block shadow-2xl">
                    <div className="flex justify-between border-b border-white/10 pb-3 mb-6 sticky top-0 bg-black/20 backdrop-blur-xl z-20">
                        <span className="text-teal-400 border-b-2 border-teal-400 pb-3 -mb-3 font-semibold text-sm tracking-wide">Insights</span>
                        <span className="text-white/40 text-sm font-medium hover:text-white transition-colors cursor-pointer">Purchase History</span>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold tracking-tight text-white/90">Preferences</h4>
                                <button className="text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20 text-xs font-bold hover:bg-teal-500/20 transition-colors">+ Add</button>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xs text-white/40">No profile preferences saved yet.</p>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="text-sm font-bold tracking-tight text-white/90">Notes</h4>
                                <button className="text-teal-400 bg-teal-500/10 px-2 py-1 rounded border border-teal-500/20 text-xs font-bold hover:bg-teal-500/20 transition-colors">+ Add</button>
                            </div>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                                <p className="text-xs text-white/40">No CRM notes saved yet.</p>
                            </div>
                        </div>

                        <div className="bg-black/20 border border-white/10 rounded-2xl p-4">
                            <h4 className="text-sm font-bold tracking-tight text-white/90 mb-4">Financials</h4>
                            <div className="space-y-4 text-sm font-medium">
                                <div className="flex justify-between items-center">
                                    <span className="text-white/50">Total lifetime spend</span>
                                    <span className="font-bold text-teal-400 bg-teal-500/10 px-2.5 py-1 rounded-lg border border-teal-500/20">${activeChat.totalSpend || 0}</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 -mx-4 -mb-4 px-4 py-3 rounded-b-2xl border-t border-white/5">
                                    <span className="text-white/50 text-xs">Last seen parsing</span>
                                    <span className="text-xs text-white/80 flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,1)]"></div>Live Feed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
