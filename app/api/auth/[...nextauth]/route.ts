import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const authOptions = {
    adapter: PrismaAdapter(prisma),
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
    ],
    callbacks: {
        async session({ session, user }: any) {
            if (session.user) {
                session.user.id = user.id;
                // Optionally fetch the Role directly
                const dbUser = await prisma.user.findUnique({
                    where: { id: user.id },
                    select: { role: true },
                });
                session.user.role = dbUser?.role || "UNASSIGNED";
            }
            return session;
        },
    },
    pages: {
        signIn: '/api/auth/signin',
        newUser: '/onboarding'
    }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
