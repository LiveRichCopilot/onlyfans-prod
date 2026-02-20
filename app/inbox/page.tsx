"use client";

import { useEffect, useState, useRef } from "react";
import { Send, Image as ImageIcon, Search, CheckCheck, MoreHorizontal, UserCircle, Activity } from "lucide-react";

// Types based on the standard OFAPI chat response structure
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
    // We append the calculated total spend based on the new CRM logic
    totalSpend?: number;
};

type Message = {
    id: string;
    text: string;
    createdAt: string;
    fromUser: {
        id: string;
    };
    isFromCreator: boolean;
};

export default function InboxPage() {
    const [chats, setChats] = useState<Chat[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [inputText, setInputText] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Simulated Creator ID for this prototype (would come from NextAuth session in prod)
    const MOCK_CREATOR_ID = "c_12345";

    // 1. Fetch Chat List on Load
    useEffect(() => {
        // In a real implementation, this would hit our Next.js API route 
        // which securely calls the ofapi.ts `listChats` using the linked account token.
        // We simulate the data structure here based on the Scribe API docs.
        const mockChats: Chat[] = [
            {
                id: "chat_1",
                withUser: { id: "u_1", username: "alexkayvip", name: "Alex" },
                lastMessage: { text: "it always is alex.. i could drop a...", createdAt: new Date().toISOString(), isRead: true },
                totalSpend: 228
            },
            {
                id: "chat_2",
                withUser: { id: "u_2", username: "gman", name: "Gman" },
                lastMessage: { text: "just full nude from the...", createdAt: new Date(Date.now() - 600000).toISOString(), isRead: false },
                totalSpend: 0
            },
            {
                id: "chat_3",
                withUser: { id: "u_3", username: "fapatologist", name: "Fapatologist" },
                lastMessage: { text: "hey you 😉", createdAt: new Date(Date.now() - 1200000).toISOString(), isRead: true },
                totalSpend: 70
            },
            {
                id: "chat_4",
                withUser: { id: "u_4", username: "bmwenjoyer", name: "BMW Enjoyer" },
                lastMessage: { text: "You already mad...", createdAt: new Date(Date.now() - 3600000).toISOString(), isRead: true },
                totalSpend: 49
            }
        ];

        setChats(mockChats);
        setLoading(false);
    }, []);

    // 2. Fetch Messages when a Chat is clicked
    useEffect(() => {
        if (!activeChat) return;

        // Simulating ofapi.ts `searchChatMessages`
        const mockMessages: Message[] = [
            { id: "m_1", text: "it's worth it ?", createdAt: new Date(Date.now() - 86400000).toISOString(), fromUser: { id: activeChat.withUser.id }, isFromCreator: false },
            { id: "m_2", text: "it always is alex.. i could drop a discount if you wanna see it...", createdAt: new Date(Date.now() - 82000000).toISOString(), fromUser: { id: MOCK_CREATOR_ID }, isFromCreator: true },
            { id: "m_3", text: "Mmm", createdAt: new Date(Date.now() - 4000000).toISOString(), fromUser: { id: activeChat.withUser.id }, isFromCreator: false },
            { id: "m_4", text: "Show me the offer", createdAt: new Date(Date.now() - 3900000).toISOString(), fromUser: { id: activeChat.withUser.id }, isFromCreator: false },
            { id: "m_5", text: "can you do it for 20?", createdAt: new Date(Date.now() - 1000000).toISOString(), fromUser: { id: MOCK_CREATOR_ID }, isFromCreator: true }
        ];

        setMessages(mockMessages);
        scrollToBottom();
    }, [activeChat]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // 3. Handle Typing Events (Simulating ofapi.ts `startTypingIndicator`)
    const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputText(e.target.value);
        // In prod: Debounce and fire `startTypingIndicator` every ~4s while typing
    };

    // 4. Send Message (Simulating ofapi.ts `sendChatMessage`)
    const handleSend = () => {
        if (!inputText.trim() || !activeChat) return;

        const newMsg: Message = {
            id: `m_${Date.now()}`,
            text: inputText,
            createdAt: new Date().toISOString(),
            fromUser: { id: MOCK_CREATOR_ID },
            isFromCreator: true
        };

        setMessages([...messages, newMsg]);
        setInputText("");
        setTimeout(scrollToBottom, 100);

        // In prod: Fire `sendChatMessage(account, activeChat.id, inputText)` via API
    };

    return (
        <div className="flex h-screen bg-[#1c1c21] text-white">

            {/* LEFT SIDEBAR: Chat List (Matches Supercreator layout) */}
            <div className="w-[340px] border-r border-[#2d2d34] flex flex-col bg-[#1c1c21]">
                {/* Header */}
                <div className="p-4 border-b border-[#2d2d34] flex items-center justify-between">
                    <div className="flex bg-[#2d2d34] rounded-full p-1 relative w-full">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                        <input
                            type="text"
                            placeholder="Search"
                            className="bg-transparent border-none outline-none w-full pl-8 pr-4 text-sm py-1.5"
                        />
                    </div>
                </div>

                {/* Filters */}
                <div className="px-4 py-3 flex gap-2 overflow-x-auto border-b border-[#2d2d34]">
                    <button className="px-3 py-1 bg-[#b459f6] rounded-full text-xs font-medium">All</button>
                    <button className="px-3 py-1 bg-[#2d2d34] rounded-full text-xs font-medium text-gray-300">Unread</button>
                    <button className="px-3 py-1 bg-[#2d2d34] rounded-full text-xs font-medium text-gray-300">Super Fans</button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-6 text-center text-sm text-gray-500">Loading chats...</div>
                    ) : (
                        chats.map(chat => (
                            <div
                                key={chat.id}
                                onClick={() => setActiveChat(chat)}
                                className={`flex items-start p-4 cursor-pointer hover:bg-[#25252b] transition-colors`}
                            >
                                <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 flex items-center justify-center overflow-hidden mr-3">
                                    <UserCircle size={28} className="text-gray-400" />
                                </div>
                                <div className="flex-1 min-w-0 border-b border-[#2d2d34] pb-4">
                                    <div className="flex justify-between items-baseline mb-1">
                                        <h3 className="font-medium text-sm truncate">{chat.withUser.name}</h3>
                                        <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                                            {new Date(chat.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-xs">
                                        {chat.totalSpend !== undefined && chat.totalSpend > 0 ? (
                                            <span className="text-[#a855f7] font-semibold mr-2">${chat.totalSpend}</span>
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
                                <h2 className="font-semibold text-lg">{activeChat.withUser.name}</h2>
                            </div>
                            <div className="flex items-center gap-4 text-gray-400">
                                <Activity size={18} />
                                <MoreHorizontal size={18} />
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                            <div className="text-center text-xs text-gray-500 my-4">Chat context loaded securely</div>

                            {messages.map((msg, i) => {
                                const isSelf = msg.isFromCreator;
                                return (
                                    <div key={msg.id} className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isSelf
                                            ? 'bg-[#b459f6] text-white rounded-br-sm'
                                            : 'bg-[#25252b] text-gray-100 rounded-bl-sm'
                                            }`}>
                                            {msg.text}
                                            {isSelf && (
                                                <div className="flex justify-end mt-1">
                                                    <CheckCheck size={12} className="text-white/60" />
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
                                <button className="p-2 text-gray-400 hover:text-white transition-colors">
                                    <ImageIcon size={20} />
                                </button>

                                <input
                                    type="text"
                                    value={inputText}
                                    onChange={handleTyping}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm"
                                />

                                <button
                                    onClick={handleSend}
                                    disabled={!inputText.trim()}
                                    className={`p-2 rounded-lg transition-colors ${inputText.trim() ? 'bg-[#b459f6] text-white' : 'text-gray-500'
                                        }`}
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    /* Empty State */
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <div className="w-16 h-16 rounded-full bg-[#25252b] flex items-center justify-center mb-4">
                            <Search size={32} className="text-gray-600" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300">Select a creator to start chatting</h3>
                        <p className="text-sm mt-2 max-w-sm text-center">Expand the sidebar on the left to choose creators and start chatting with their fans</p>
                    </div>
                )}
            </div>

            {/* RIGHT PANEL: Stats (Optional extension based on the screenshot) */}
            {activeChat && (
                <div className="w-[300px] border-l border-[#2d2d34] bg-[#1c1c21] hidden lg:block p-6">
                    <div className="flex justify-between border-b border-[#2d2d34] pb-3 mb-6">
                        <span className="text-[#a855f7] border-b-2 border-[#a855f7] pb-3 -mb-3 font-medium text-sm">Insights</span>
                        <span className="text-gray-500 text-sm">Purchase History</span>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold">Preferences</h4>
                                <button className="text-[#a855f7] text-xs">+ Add</button>
                            </div>
                            <p className="text-xs text-gray-500">No preferences yet</p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="text-sm font-semibold">Notes</h4>
                                <button className="text-[#a855f7] text-xs">+ Add</button>
                            </div>
                            <p className="text-xs text-gray-500">No notes yet</p>
                        </div>

                        <div>
                            <h4 className="text-sm font-semibold mb-4">Info</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Total spend</span>
                                    <span className="font-medium">${activeChat.totalSpend || 0}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Last paid</span>
                                    <span>24 Feb, 2026</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
