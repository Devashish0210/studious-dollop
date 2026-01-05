"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Table, Code, Lightbulb, Sparkles, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import DataTable from "./DataTable";
import CustomizableGraph from "../queryComponents/customizableGraph";
import CodeDisplay from "./CodeDisplay";
import Insights from "./Insights";

interface ChatArtifactsProps {
  tableData?: {
    columns: string[];
    rows: any[][];
  } | null;
  graphData?: {
    data: any;
  } | null;
  codeData?: string | null;
  insightsData?: string | null;
  onGenerateInsights?: () => void;
  isGeneratingInsights?: boolean;
}

export default function ChatArtifacts({
  tableData,
  graphData,
  codeData,
  insightsData,
  onGenerateInsights,
  isGeneratingInsights = false,
}: ChatArtifactsProps) {
  // Determine default tab based on availability, prioritizing Table -> Graph -> Code -> Insights
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (tableData) return "table";
    if (graphData) return "graph";
    if (codeData) return "code";
    if (insightsData) return "insights";
    return "table";
  });

  const renderContent = () => {
    switch (activeTab) {
      case "table":
        return tableData ? (
          <DataTable data={tableData} />
        ) : (
          <div className="p-4 text-neutral-500">No table data available</div>
        );
      case "graph":
        return graphData ? (
          <CustomizableGraph data={graphData.data} />
        ) : (
          <div className="p-4 text-neutral-500">No graph data available</div>
        );
      case "code":
        return <CodeDisplay sqlQuery={codeData || ""} />;
      case "insights":
        if (insightsData) {
          return <Insights insights={insightsData} hideHeader={true} />;
        }
        return (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <p className="text-neutral-400 text-sm text-center max-w-md">
              Generate AI-powered insights based on the data retrieved from your query.
            </p>
            <Button
              onClick={onGenerateInsights}
              disabled={isGeneratingInsights}
              className={cn(
                "flex items-center space-x-2 transition-all",
                "bg-[var(--color-button-highlight)] text-white hover:opacity-90"
              )}
            >
              {isGeneratingInsights ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Generating Insights...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Insights</span>
                </>
              )}
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full mt-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-4 mb-3 bg-transparent gap-2 p-0 h-auto">
          <TabsTrigger
            value="table"
            disabled={!tableData}
            className={cn(
              "transition-all py-2 rounded-md border border-neutral-700/50 bg-neutral-900/30",
              "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-white data-[state=active]:border-transparent hover:bg-neutral-800"
            )}
          >
            <Table className="h-4 w-4 mr-2" />
            Table
          </TabsTrigger>
          <TabsTrigger
            value="graph"
            disabled={!graphData}
            className={cn(
              "transition-all py-2 rounded-md border border-neutral-700/50 bg-neutral-900/30",
              "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-white data-[state=active]:border-transparent hover:bg-neutral-800"
            )}
          >
            <BarChart className="h-4 w-4 mr-2" />
            Graph
          </TabsTrigger>
          <TabsTrigger
            value="code"
            disabled={!codeData}
            className={cn(
              "transition-all py-2 rounded-md border border-neutral-700/50 bg-neutral-900/30",
              "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-white data-[state=active]:border-transparent hover:bg-neutral-800"
            )}
          >
            <Code className="h-4 w-4 mr-2" />
            SQL
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className={cn(
              "transition-all py-2 rounded-md border border-neutral-700/50 bg-neutral-900/30",
              "data-[state=active]:bg-[var(--color-button-highlight)] data-[state=active]:text-white data-[state=active]:border-transparent hover:bg-neutral-800"
            )}
          >
            <Lightbulb className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        <div className="flex-grow overflow-auto border rounded-lg p-3 border-neutral-700 bg-neutral-900/50 max-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full"
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
}