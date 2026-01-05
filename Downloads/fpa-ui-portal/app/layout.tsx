// Importing google fonts, CSS Styling and metadata
import { Geist, Geist_Mono } from "next/font/google";
import type { Metadata } from "next";
import "./globals.css";

// Importing UI and app components
import AppTopNavbar from "@/components/HeadNavbar";
import SessionWrapper from "@/components/SessionWrapper";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeContext";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentSession } from "@/lib/session";
import { AppSidebar } from "@/components/AppSidebar";

// Google Fonts
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

// Metadata for the application
export const metadata: Metadata = {
  title: "MIA Finance",
  description: "Microland's FPA Portal built with Next.js",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get session on the server side
  const session = await getCurrentSession();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body
          className="font-sans antialiased bg-[var(--color-bg-dark)] text-[var(--color-text-light)]"
      >
        {/* Session Wrapper for Authentication and Session management */}
        <SessionWrapper>
          <ThemeProvider>
            <SidebarProvider>
              
              {!!session && (<AppSidebar />)}

                <SidebarInset>
                  <div className="h-screen overflow-hidden flex flex-col w-full">
                    {/* Top Navbar */}
                    <AppTopNavbar isAuthenticated={!!session} />
                    {/* Main content area */}
                    <main className="flex-1 w-full overflow-y-auto">{children}</main>
                    {/* Toaster to display alerts or messages */}
                    <Toaster />
                  </div>
                </SidebarInset>
            </SidebarProvider>
          </ThemeProvider>
        </SessionWrapper>
      </body>
    </html>
  );
}
