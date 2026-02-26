// Barrel file — re-exports all OFAPI functions from split modules
// Consumers can keep importing from "@/lib/ofapi" unchanged

export {
    getProfile,
    getTransactions,
    fetchAllTransactions,
    getMe,
    getActiveFans,
    listAllFans,
    getNotificationCounts,
    calculateTopFans,
} from "./ofapi-core";

export {
    getTransactionsSummary,
    getEarningsOverview,
    getTransactionsByType,
    getRevenueForecast,
    getProfitability,
    listMessageBuyers,
    getHistoricalPerformance,
    getPeriodComparison,
    getEarningsByType,
    getStatisticsOverview,
    getOFProfile,
    getModelStartDate,
    getTopPercentage,
} from "./ofapi-analytics";

export {
    listChats,
    getChatMessages,
    searchChatMessages,
    sendChatMessage,
    deleteChatMessage,
    attachReleaseTags,
    startTypingIndicator,
    sendTypingIndicator,
    getChatMedia,
    fetchAllChats,
    markChatAsRead,
    hideChat,
    getMassMessages,
    getMassMessageChart,
    uploadToVault,
    updateVaultMedia,
    sendVaultMediaToFan,
} from "./ofapi-chat";
