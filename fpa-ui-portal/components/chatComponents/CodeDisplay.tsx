import { CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Button } from "@/components/ui/button";
import { Check, Clipboard, Code } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// Props for the CodeDisplay component
interface CodeDisplayProps {
  sqlQuery: string;
}

// CodeDisplay component to display SQL queries with copy functionality
export default function CodeDisplay({ sqlQuery }: CodeDisplayProps) {
  const [copied, setCopied] = useState(false);

  // Function to handle copying the SQL query to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(sqlQuery);
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
      <div className="flex justify-between items-center p-5">
        <h2 className="text-lg font-semibold flex items-center">
          <Code className="w-5 h-5 mr-2 text-purple-500" />
          SQL Query
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
      <CardContent>
        <SyntaxHighlighter
          language="sql"
          style={dracula}
          className="rounded-md"
        >
          {sqlQuery}
        </SyntaxHighlighter>
      </CardContent>
    </motion.div>
  );
}
