import NextAuth from "next-auth";
import { authOptions } from "@/lib/authOptions";

// This file handles authentication routes for NextAuth.js
// It exports GET and POST handlers for authentication requests
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
