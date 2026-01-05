import { Loader2 } from "lucide-react";
import React from "react";

// Full Screen Loader Component
export function FullScreenLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="flex flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-white" />
        <p className="mt-4 text-white text-lg">Loading...</p>
      </div>
    </div>
  );
}