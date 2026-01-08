import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions['adapter'],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;

        // Fetch user points and badges from database
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            points: true,
            badges: true,
            reportsCount: true,
            videosCount: true,
          },
        });

        if (dbUser) {
          session.user.points = dbUser.points;
          session.user.badges = dbUser.badges;
          session.user.reportsCount = dbUser.reportsCount;
          session.user.videosCount = dbUser.videosCount;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
};
