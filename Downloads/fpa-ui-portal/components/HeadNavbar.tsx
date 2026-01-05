"use client";

// Import necessary modules and components
import React from 'react'
import Image from 'next/image'
import { SidebarToggle } from './SiderbarToggle'
import "../app/globals.css";

const STATIC_COPILOT_URL = process.env.NEXT_PUBLIC_BASE_PATH;

const AppTopNavbar = ({ isAuthenticated = true }: { isAuthenticated?: boolean }) => {

  return (
    <header className="shrink-0 h-14 flex items-center px-4 border-b border-zinc-800 bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          {/* {isAuthenticated} */}
          <Image
              src={`${STATIC_COPILOT_URL}/images/mia.png`}
              alt="FPA Intelligeni Logo"
              width={140}
              height={40}
              className="h-7 w-auto object-contain"
              priority
            />
          <span className="text-md text-neutral-400 font-medium">Finance</span>
        </div>
      </div>
    </header>
  )
}

export default AppTopNavbar;