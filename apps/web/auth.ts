import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth }: {
  handlers: any;
  signIn: any;
  signOut: any;
  auth: any;
} = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(credentials),
        });

        if (!res.ok) return null;

        const user = await res.json();
        return user;
      },
    }),
  ],
  session: { strategy: "jwt" },
 callbacks: {
  jwt: async ({ token, user }) => {
    if (user) {
      token.role = (user as any).role;
      token.id = (user as any).id;
      token.apiToken = (user as any).apiToken;
    }
    return token;
  },
  session: async ({ session, token }) => {
    if (session.user) {
      session.user.role = token.role as string;
      session.user.id = token.id as string;
      session.user.apiToken = token.apiToken as string;
    }
    return session;
  },
},
});