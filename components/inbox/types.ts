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
};
