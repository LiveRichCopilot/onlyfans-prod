"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Image as ImageIcon, Search, CheckCheck, MoreHorizontal, UserCircle, Activity, Eye, EyeOff, FolderOpen } from "lucide-react";

type Chat = {
    id: string;
    withUser: {
        id: string;
        username: string;
        name: string;
        avatar?: string;
    };
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

    // 3. Fetch Messages when a Chat is clicked
    useEffect(() => {
        if (!activeChat || !selectedCreatorId) return;
        setMsgsLoading(true);

        fetch(`/api/inbox/messages?creatorId=${selectedCreatorId}&chatId=${activeChat.id}`)
            .then(res => res.json())
            .then(data => {
                const rawMsgs = Array.isArray(data.messages) ? data.messages : (data.messages?.data || []);

                // Usually messages arrive in reverse chronological order from OFAPI, we need chronological for chat view
                const sortedRaw = [...rawMsgs].sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                const mappedMsgs: Message[] = typeof sortedRaw.map === 'function' ? sortedRaw.map((m: any) => {
                    const fromId = m.fromUser?.id || m.author?.id || "unknown";
                    const isCreator = fromId !== activeChat.withUser.id;

                    return {
                        id: m.id || m.message_id || Math.random().toString(),
                        text: m.text || "",
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
                        senderName: m.author?.name || (isCreator ? "Creator" : activeChat.withUser.name)
                    };
                }) : [];

                setMessages(mappedMsgs);
                setMsgsLoading(false);
                setTimeout(scrollToBottom, 50);
            })
            .catch(err => {
                console.error("Failed to load messages", err);
                setMsgsLoading(false);
            });
    }, [activeChat, selectedCreatorId]);

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
        <div className="flex h-screen bg-[#1c1c21] text-white overflow-hidden">

            {/* LEFT SIDEBAR: Chat List */}
            <div className="w-[340px] border-r border-[#2d2d34] flex flex-col bg-[#1c1c21]">
                {/* Creator Selector Header */}
                <div className="p-4 border-b border-[#2d2d34] flex items-center justify-between">
                    <select
                        value={selectedCreatorId}
                        onChange={(e) => {
                            setSelectedCreatorId(e.target.value);
                            setChats([]);
                            setActiveChat(null);
                        }}
                        className="w-full bg-[#2d2d34] text-sm text-white rounded-lg px-3 py-2 outline-none border border-[#2d2d34] focus:border-teal-500 transition-colors"
                    >
                        <option value="">Select a Creator</option>
                        {creators.map(c => (
                            <option key={c.id} value={c.id}>{c.name || 'Unnamed Creator'} {c.ofapiToken === 'unlinked' ? '(Unlinked)' : ''}</option>
                        ))}
                    </select>
                </div>

                <div className="p-4 border-b border-[#2d2d34] flex items-center justify-between">
                    <div className="flex bg-[#2d2d34] rounded-full p-1 relative w-full">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search chats"
                            className="bg-transparent border-none outline-none w-full pl-8 pr-4 text-sm py-1.5"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-[#2d2d34]">
                    <button className="px-3 py-1 bg-[#14b8a6] rounded-full text-xs font-medium">All</button>
                    <button className="px-3 py-1 bg-[#2d2d34] rounded-full text-xs font-medium text-gray-300">Unread</button>
                    <button className="px-3 py-1 bg-[#2d2d34] rounded-full text-xs font-medium text-gray-300">Super Fans</button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {!selectedCreatorId ? (
                        <div className="p-6 text-center text-sm text-gray-500">Please select a creator to view chats.</div>
                    ) : loading ? (
                        <div className="p-6 text-center text-sm text-gray-500 flex flex-col items-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-t-2 border-[#14b8a6] mb-3"></div>
                            Loading Live Live Chats...
                        </div>
                    ) : chats.length === 0 ? (
                        <div className="p-6 text-center text-sm text-gray-500">No chats found for this creator.</div>
                    ) : (
                        chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveChat(chat)}
                                className={`flex items-start p-4 cursor-pointer hover:bg-[#25252b] transition-colors ${activeChat?.id === chat.id ? 'bg-[#25252b]' : ''}`}
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3">
                                    {chat.withUser.avatar ? (
                                        <img src={chat.withUser.avatar} alt="Avatar" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                                    ) : (
                                        <UserCircle size={28} className="text-gray-400" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0 border-b border-[#2d2d34] pb-4">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-medium text-sm truncate">{chat.withUser.name} <span className="text-xs text-gray-500 font-normal">@{chat.withUser.username}</span></h3>
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
            <div className="flex-1 flex flex-col bg-[#16161a]">
                {activeChat ? (
                    <>
                        {/* Chat Header */}
                        <div className="h-16 px-6 border-b border-[#2d2d34] flex items-center justify-between shrink-0 bg-[#1c1c21]">
                            <div className="flex items-center">
                                <h2 className="font-semibold text-lg">{activeChat.withUser.name} <span className="text-sm font-normal text-gray-400">@{activeChat.withUser.username}</span></h2>
                            </div>
                            <div className="flex items-center gap-4 text-gray-400">
                                <button onClick={() => setIsSfw(!isSfw)} className={`transition-colors ${isSfw ? 'text-[#14b8a6]' : 'hover:text-gray-200'}`} title="Toggle Safe For Work Mode">
                                    {isSfw ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                                <Activity size={18} />
                                <MoreHorizontal size={18} />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto min-h-0 p-6 flex flex-col gap-4 relative">
                            <div className="text-center text-xs text-gray-500 my-4">Live API Chat Thread Synced Securely</div>

                            {msgsLoading && (
                                <div className="absolute inset-0 bg-[#16161a] z-10 flex flex-col items-center justify-center text-gray-500">
                                    <div className="animate-spin w-8 h-8 rounded-full border-t-2 border-[#14b8a6] mb-3"></div>
                                    Syncing OnlyFans chat payload...
                                </div>
                            )}

                            {!msgsLoading && messages.map((msg, i) => {
                                const isSelf = msg.isFromCreator;
                                return (
                                    <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isSelf
                                            ? 'bg-[#0f766e] text-white rounded-br-sm'
                                            : 'bg-[#25252b] text-gray-100 rounded-bl-sm'
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
                        <div className="p-4 bg-[#1c1c21] border-t border-[#2d2d34]">
                            <div className="flex items-center bg-[#25252b] rounded-xl px-2 py-1">
                                <button className="p-2 text-gray-400 hover:text-[#0d9488] transition-colors" title="Upload Local Media">
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
                                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm"
                                    disabled={msgsLoading}
                                />

                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim() || msgsLoading}
                                    className={`p-2 rounded-lg transition-colors ${inputText.trim() ? 'bg-[#0f766e] text-white hover:bg-[#0d9488]' : 'text-gray-500'
                                        }`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500 relative">
                        <div className="w-16 h-16 rounded-full bg-[#25252b] flex items-center justify-center mb-4">
                            <Search size={32} className="text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300">Select an active conversation</h3>
                        <p className="text-sm mt-2 max-w-sm text-center">Click a fan on the left sidebar to securely sync this workspace with their live OnlyFans chat thread.</p>
                    </div>
                )}
            </div>

            {/* RIGHT PANEL: Stats / Insights */}
            {activeChat && (
                <div className="w-[300px] border-l border-[#2d2d34] bg-[#1c1c21] hidden lg:block p-6">
                    <div className="flex justify-between border-b border-[#2d2d34] pb-3 mb-6">
                        <span className="text-[#14b8a6] border-b-2 border-[#14b8a6] pb-3 -mb-3 font-medium text-sm">Insights</span>
                        <span className="text-gray-500 text-sm">Purchase History</span>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold">Preferences</h4>
                                <button className="text-[#14b8a6] text-xs font-semibold">+ Add</button>
                            </div>
                            <p className="text-xs text-gray-500">No profile preferences saved yet.</p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold">Notes</h4>
                                <button className="text-[#14b8a6] text-xs font-semibold">+ Add</button>
                            </div>
                            <p className="text-xs text-gray-500">No CRM notes saved yet.</p>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold mb-4">Financials</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Total lifetime spend</span>
                                    <span className="font-bold text-[#14b8a6]">${activeChat.totalSpend || 0}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-400">Last seen parsing</span>
                                    <span className="text-xs">Live Feed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
