import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      points?: number;
      badges?: string[];
      reportsCount?: number;
      videosCount?: number;
    };
  }

  interface User {
    id: string;
    points?: number;
    badges?: string[];
    reportsCount?: number;
    videosCount?: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
  }
}
