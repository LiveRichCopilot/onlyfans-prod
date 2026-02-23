export type Chat = {
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
    _creatorId?: string;    // Which creator this chat belongs to
    _creatorName?: string;  // Creator display name
    _creatorAvatar?: string; // Creator profile photo URL
};

export type Message = {
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
    price?: number;
    isTip?: boolean;
    isOpened?: boolean;
    isFree?: boolean;
};
