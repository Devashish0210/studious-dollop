// import nessessary modules and types
import { authOptions } from "@/lib/authOptions";
import { getServerSession, type Session, type User } from "next-auth";

interface ExtendedSession extends Session {
    user: User;
}

export async function getCurrentSession() {
    const session = await getServerSession(authOptions);

    return session as ExtendedSession | null;
}