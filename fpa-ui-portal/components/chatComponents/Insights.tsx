import { motion } from "framer-motion";
import { Lightbulb, Clipboard, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// Props interface for Insights component
interface InsightsProps {
  insights: string;
}

// Insights component to display AI-generated insights
export default function Insights({ insights }: InsightsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(insights);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto pb-6"
    >
      <div className="flex justify-between my-4">
        <h2 className="text-lg font-semibold flex">
          <Lightbulb className="w-5 h-5 mr-2 text-amber-500" />
          AI Insights
        </h2>
        <Button
          className={cn(
            "transition-all",
            "bg-neutral-800 border-neutral-700 text-[var(--color-text-light)] hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
          )}
          onClick={handleCopy}
          variant="outline"
          size="sm"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 mr-1 text-green-500" /> Copied!
            </>
          ) : (
            <>
              <Clipboard className="w-4 h-4 mr-1" /> Copy
            </>
          )}
        </Button>
      </div>

      <div className="text-white border border-neutral-700 rounded-md bg-neutral-800 p-4 text-left">
        <ReactMarkdown>{insights}</ReactMarkdown>
      </div>
    </motion.div>
  );
}
