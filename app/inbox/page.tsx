"use client";

import { useState, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import type { Chat } from "@/components/inbox/types";
import { NavBar } from "@/components/inbox/NavBar";
import { FanList } from "@/components/inbox/FanList";
import { ChatTopBar } from "@/components/inbox/ChatTopBar";
import { MessageFeed } from "@/components/inbox/MessageFeed";
import { FloatingChatBar } from "@/components/inbox/FloatingChatBar";
import { FanSidebar } from "@/components/inbox/FanSidebar";
import { SpendBuckets } from "@/components/inbox/SpendBuckets";
import { WhaleOnlineAlert } from "@/components/inbox/WhaleOnlineAlert";
import { PanelSlider } from "@/components/inbox/PanelSlider";
import { useChats } from "@/components/inbox/hooks/useChats";
import { useMessages } from "@/components/inbox/hooks/useMessages";

export default function InboxPage() {
    const {
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
        hasMoreChats,
        tempTick,
        handleSelectCreator,
        handleLoadMoreChats,
    } = useChats();

    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [mobileView, setMobileView] = useState<"list" | "chat">("list");
    const [sortBy, setSortBy] = useState("recent");
    const [unreadFirst, setUnreadFirst] = useState(false);
    const [filters, setFilters] = useState<any>(null);
    const [isSfw, setIsSfw] = useState(false);
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [sidebarWidth, setSidebarWidth] = useState(300);

    const {
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
    } = useMessages(activeChat, selectedCreatorId);

    const handleSidebarResize = useCallback((deltaX: number) => {
        setSidebarWidth((prev) => Math.max(220, Math.min(500, prev + deltaX)));
    }, []);

    const handleSelectCreatorAndReset = (id: string) => {
        handleSelectCreator(id);
        setActiveChat(null);
        setMobileView("list");
        resetJumpState();
    };

    const handleSelectChat = (chat: Chat) => {
        resetJumpState();
        setActiveChat(chat);
        setMobileView("chat");
    };

    const handleBack = () => {
        setActiveChat(null);
        setMobileView("list");
    };

    const handleSuggestMessage = useCallback((text: string) => {
        setInputText(text);
    }, [setInputText]);

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
                <SpendBuckets
                    activeBucket={spendBucket}
                    onBucketChange={(min) => { setSpendBucket(min); setActiveChat(null); }}
                    onlineOnly={onlineOnly}
                    onOnlineToggle={() => { setOnlineOnly(!onlineOnly); setActiveChat(null); }}
                />
                <FanList
                    creators={creators}
                    selectedCreatorId={selectedCreatorId}
                    onSelectCreator={handleSelectCreatorAndReset}
                    chats={spendFilteredChats || chats}
                    activeChat={activeChat}
                    onSelectChat={handleSelectChat}
                    loading={loading || loadingMoreChats || loadingSpendFilter}
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
                } md:flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden`}
                style={{ backgroundColor: "#1a1a1a" }}
            >
                {activeChat ? (
                    <>
                        <WhaleOnlineAlert
                            creatorId={activeChat._creatorId || selectedCreatorId}
                            onNavigateToFan={(fanId) => {
                                const targetChat = chats.find(c => String(c.withUser?.id) === String(fanId));
                                if (targetChat) handleSelectChat(targetChat);
                            }}
                        />
                        <ChatTopBar
                            chat={activeChat}
                            isSfw={isSfw}
                            onToggleSfw={() => setIsSfw(!isSfw)}
                            onShowInsights={() => setShowMobileSidebar(true)}
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
                            isJumped={isJumped}
                            onReturnToLatest={handleReturnToLatest}
                        />
                        <FloatingChatBar
                            inputText={inputText}
                            onTyping={(e) => setInputText(e.target.value)}
                            onSend={handleSend}
                            onSetText={setInputText}
                            disabled={msgsLoading}
                            onAiSuggest={handleAiSuggest}
                            aiSuggestLoading={aiSuggestLoading}
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

            {/* Fan Sidebar — desktop: resizable with slider, mobile: slide-over */}
            {activeChat && (
                <>
                    <div className="hidden xl:flex">
                        <PanelSlider onResize={handleSidebarResize} side="left" />
                        <FanSidebar chat={activeChat} width={sidebarWidth} onSuggestMessage={handleSuggestMessage} />
                    </div>

                    {showMobileSidebar && (
                        <div className="xl:hidden fixed inset-0 z-50 flex">
                            <div
                                className="flex-1 bg-black/60 backdrop-blur-sm"
                                onClick={() => setShowMobileSidebar(false)}
                            />
                            <div className="w-[85vw] max-w-[380px] animate-in slide-in-from-right">
                                <div className="h-full flex flex-col bg-[#1a1a1a] border-l border-white/[0.06]">
                                    <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
                                        <span className="text-sm font-semibold text-white/80">Fan Insights</span>
                                        <button
                                            onClick={() => setShowMobileSidebar(false)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/40"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex-1 overflow-y-auto">
                                        <FanSidebar chat={activeChat} width={9999} onSuggestMessage={(text) => { handleSuggestMessage(text); setShowMobileSidebar(false); }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
