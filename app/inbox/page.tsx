"use client";

import { useState, useCallback } from "react";
import { useLanguage } from "@/lib/LanguageContext";
import { MessageSquare } from "lucide-react";
import type { Chat } from "@/components/inbox/types";
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

function EmptyChatPlaceholder() {
    const { t } = useLanguage();
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-white/40 px-4">
            <div className="w-16 h-16 rounded-full bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
                <MessageSquare size={28} className="text-white/15" />
            </div>
            <h3 className="text-lg font-medium text-white/60">{t("selectConversation")}</h3>
            <p className="text-sm mt-2 text-white/25 max-w-xs text-center">{t("pickFanFromList")}</p>
        </div>
    );
}

export default function InboxPage() {
    const { t } = useLanguage();
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
        chatsError,
        retryChats,
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
        <div className="min-h-screen text-white/90 p-4 md:p-6">
            {/* Header */}
            <header className="glass-panel rounded-2xl p-4 mb-4 border-white/10">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white/95">{t("liveInbox")}</h1>
                <p className="text-xs sm:text-sm text-white/50 mt-0.5">{t("pickFanFromList")}</p>
            </header>

            {/* Main workspace — glass panel */}
            <div className="glass-panel rounded-3xl overflow-hidden border-white/10 flex flex-col min-h-[calc(100vh-12rem)]">
                <div className="flex flex-1 min-h-0">
                    {/* Fan list — full width on mobile, fixed width on desktop */}
                    <div
                        className={`${
                            mobileView === "list" ? "flex" : "hidden"
                        } md:flex w-full md:w-[340px] md:max-w-[380px] flex-col flex-shrink-0 border-r border-white/[0.08] min-h-0 min-w-0 overflow-hidden bg-black/20`}
                    >
                        <SpendBuckets
                            activeBucket={spendBucket}
                            onBucketChange={(min) => { setSpendBucket(min); setActiveChat(null); }}
                            onlineOnly={onlineOnly}
                            onOnlineToggle={() => { setOnlineOnly(!onlineOnly); setActiveChat(null); }}
                        />
                        {chatsError && (
                            <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
                                <p className="text-sm text-amber-400/90">{t("failedToLoadChats")}</p>
                                <button onClick={retryChats} className="glass-button px-3 py-2 rounded-lg text-sm font-medium text-teal-400 border border-teal-500/30 hover:bg-teal-500/10">
                                    {t("retry")}
                                </button>
                            </div>
                        )}
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
                        } md:flex flex-1 flex-col min-w-0 min-h-0 overflow-hidden bg-black/10`}
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
                            <EmptyChatPlaceholder />
                        )}
                    </div>

                    {/* Fan Sidebar — desktop: resizable with slider, mobile: slide-over */}
                    {activeChat && (
                        <>
                            <div className="hidden xl:flex flex-shrink-0">
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
                                        <div className="h-full flex flex-col glass-panel border-l border-white/[0.08]">
                                            <div className="flex items-center justify-between p-3 border-b border-white/[0.06]">
                                                <span className="text-sm font-semibold text-white/80">{t("fanInsights")}</span>
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
            </div>
        </div>
    );
}
