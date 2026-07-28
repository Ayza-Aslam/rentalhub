import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const res = await fetch("http://localhost:4000/auth/login", {
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
      token.role = user.role;
      token.id = user.id;
      token.apiToken = user.apiToken;
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