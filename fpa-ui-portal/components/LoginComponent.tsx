"use client";

import { User, Lock } from "lucide-react";
import { signIn } from "next-auth/react";

// This component handles the login functionality for the application
export default function LoginComponent() {
  const handleLogin = async () => {
    try {
      // Initiates the sign-in process with Azure AD
      await signIn("azure-ad", {
        callbackUrl: "/",
      });
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-8 bg-zinc-900 rounded-xl shadow-lg">
        <div className="text-center flex flex-col items-center">
          <div className="h-12 w-12 rounded-full flex items-center justify-center bg-zinc-800">
          <Lock className="h-6 w-6 text-red-400" />
          </div>
         <h2 className="mt-6 text-3xl font-extrabold text-white">
            Welcome to FPA Chat
          </h2>
          <p className="mt-2 text-sm text-gray-300">
            Please login in to your account to continue
          </p>
        </div>

        <div className="mt-8">
          <button
            onClick={handleLogin}
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 focus:ring-offset-zinc-900"
          >
            <User className="w-5 h-5 mr-2" />
            Sign in with Microsoft
          </button>
        </div>
      </div>
    </div>
  );
}
