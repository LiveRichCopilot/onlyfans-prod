import crypto from "crypto";

function getSecret(): string {
    const secret = process.env.UPLOAD_LINK_SECRET;
    if (!secret) throw new Error("UPLOAD_LINK_SECRET is not set");
    return secret;
}

export interface UploadTokenPayload {
    creatorId: string;
    account: string; // ofapiCreatorId e.g. acct_XXX
    iat: number;     // issued at (seconds)
    exp: number;     // expires at (seconds)
}

export function createUploadToken(creatorId: string, account: string, ttlMinutes = 30): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: UploadTokenPayload = {
        creatorId,
        account,
        iat: now,
        exp: now + ttlMinutes * 60,
    };
    const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const sig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
    return `${data}.${sig}`;
}

export function verifyUploadToken(token: string): UploadTokenPayload | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 2) return null;
        const [data, sig] = parts;
        if (!data || !sig) return null;

        const expectedSig = crypto.createHmac("sha256", getSecret()).update(data).digest("base64url");
        const sigBuf = Buffer.from(sig, "base64url");
        const expectedBuf = Buffer.from(expectedSig, "base64url");
        if (sigBuf.length !== expectedBuf.length) return null;
        if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

        const payload: UploadTokenPayload = JSON.parse(Buffer.from(data, "base64url").toString());
        if (payload.exp < Date.now() / 1000) return null;
        return payload;
    } catch {
        return null;
    }
}
