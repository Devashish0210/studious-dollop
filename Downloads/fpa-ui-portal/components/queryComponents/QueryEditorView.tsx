"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { oneDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  Play,
  Save,
  Table,
  Download,
  BarChart,
  Edit,
  Database,
  ChartLine,
} from "lucide-react";
import { toPng } from "html-to-image";
import { fetchGenerationById, postSQLToGeneration } from "@/lib/api";
import { useSession } from "next-auth/react";
import CustomizableGraph from "@/components/queryComponents/customizableGraph";
import DataTable from "@/components/chatComponents/DataTable";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

export default function QueryEditorView() {
  const params = useParams();
  const queryId = params.queryId as string;
  const { data: session, status } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);

  const [sql, setSql] = useState("");
  const [originalSql, setOriginalSql] = useState("");
  const [output, setOutput] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [editable, setEditable] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSql, setShowSql] = useState(false);

  // Add viewMode state
  const [viewMode, setViewMode] = useState("table");

  // State for sidebar functionality
  const [activeTab, setActiveTab] = useState<string>("");
  const [sidebarContent, setSidebarContent] = useState<any>(null);
  const [showSidebar, setShowSidebar] = useState(false);

  // State for graph container reference
  const [graphRef, setGraphRef] = useState<HTMLDivElement | null>(null);

  // State for save confirmation popup
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Function to get line numbers based on SQL content
  const getLineNumbers = () => {
    const lines = sql.split("\n");
    return lines.map((_, index) => index + 1);
  };

  // Check if data is suitable for graphs
  const hasGraphData =
    output?.sql_result?.rows &&
    output.sql_result.rows.length > 0 &&
    output.sql_result.columns.length >= 2;

  // Transform SQL result data for graph component
  const transformDataForGraph = () => {
    if (!output?.sql_result?.rows || !output?.sql_result?.columns) return null;

    const { rows, columns } = output.sql_result;

    // Find numeric columns for potential Y-axis
    const numericColumns = columns.filter((col: string) => {
      return rows.some(
        (row: any) => !isNaN(parseFloat(row[col])) && isFinite(row[col])
      );
    });

    // Find string columns for potential X-axis (categories)
    const stringColumns = columns.filter((col: string) => {
      return rows.some(
        (row: any) => isNaN(parseFloat(row[col])) || !isFinite(row[col])
      );
    });

    if (numericColumns.length === 0) return null;

    // Use first string column as X-axis, first numeric as Y-axis
    const xColumn = stringColumns[0] || columns[0];
    const yColumn = numericColumns[0];

    // Transform rows to match CustomizableGraph expected format
    const transformedData = rows.map((row: any) => {
      const transformedRow: { [key: string]: string | number } = {};
      columns.forEach((col: string) => {
        transformedRow[col] = row[col];
      });
      return transformedRow;
    });

    return {
      data: transformedData,
      xColumn,
      yColumn,
      allColumns: columns,
    };
  };

  // Handler functions
  const handleGenerateTable = () => {
    setViewMode("table");
  };

  const handleGenerateGraph = () => {
    setViewMode("graph");
  };

  const handleDownloadExcel = async () => {
    if (viewMode === "graph" && graphRef) {
      // Download graph as PNG
      try {
        const dataUrl = await toPng(graphRef, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: "#ffffff",
        });

        const link = document.createElement("a");
        link.download = `graph_${new Date().getTime()}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error("Error downloading graph:", error);
      }
    } else if (output?.sql_result) {
      // Download table data as CSV
      const headers = output.sql_result.columns.join(",");
      const rows = output.sql_result.rows
        .map((row: any) =>
          output.sql_result.columns
            .map((col: string) => `"${row[col] || ""}"`)
            .join(",")
        )
        .join("\n");

      const csvContent = `${headers}\n${rows}`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `query_results_${new Date().getTime()}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Handle Edit/Save toggle
  const handleEditSave = () => {
    if (editable) {
      // If currently in edit mode, show save confirmation
      setShowSaveConfirmation(true);
    } else {
      // If not in edit mode, enable editing
      setEditable(true);
    }
  };

  // Handle save confirmation
  const handleSaveConfirmation = async (confirmed: boolean) => {
    setShowSaveConfirmation(false);

    if (confirmed) {
      setSaving(true);
      try {
        // Save the query to the database
        const result = await postSQLToGeneration(token!, queryId, sql);

        if (result) {
          // Successfully saved
          setOriginalSql(sql);
          setHasUnsavedChanges(false);
          setEditable(false);
          // You might want to show a success message here
        } else {
          console.error("Failed to save query");
          // You might want to show an error message here
        }
      } catch (error) {
        console.error("Error saving query:", error);
        // You might want to show an error message here
      } finally {
        setSaving(false);
      }
    } else {
      // When cancelled, go back to read-only mode
      setSql(originalSql);
      setHasUnsavedChanges(false);
      setEditable(false); // This will show Edit button and disable SQL compiler
    }
  };

  const handleButtonClick = (type: string, data?: any) => {
    setActiveTab(type);
    setShowSidebar(true);

    let content = null;
    switch (type) {
      case "table":
        content = data ? (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className={cn(
                "text-lg font-semibold",
                "text-[var(--color-text-dark)]"
              )}>
                Table View
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className={cn(
                  "transition-colors",
                  "text-neutral-500 hover:text-[var(--color-text-highlight)]"
                )}
              >
                ✕
              </button>
            </div>
            <DataTable data={data} />
          </div>
        ) : (
          <div className="p-4 text-neutral-500">No table data available</div>
        );
        break;
      case "graph":
        content = data ? (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className={cn(
                "text-lg font-semibold",
                "text-[var(--color-text-dark)]"
              )}>
                Graph View
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className={cn(
                  "transition-colors",
                  "text-neutral-500 hover:text-[var(--color-text-highlight)]"
                )}
              >
                ✕
              </button>
            </div>
            <CustomizableGraph
              data={data.data}
              columns={data.allColumns}
              defaultXColumn={data.xColumn}
              defaultYColumn={data.yColumn}
              hideTitle={true}
            />
          </div>
        ) : (
          <div className="p-4 text-neutral-500">No graph data available</div>
        );
        break;
      case "code":
        content = (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className={cn(
                "text-lg font-semibold",
                "text-[var(--color-text-dark)]"
              )}>
                SQL Code
              </h3>
              <button
                onClick={() => setShowSidebar(false)}
                className={cn(
                  "transition-colors",
                  "text-neutral-500 hover:text-[var(--color-text-highlight)]"
                )}
              >
                ✕
              </button>
            </div>
            <SyntaxHighlighter
              language="sql"
              style={oneDark}
              className="rounded-md"
            >
              {sql}
            </SyntaxHighlighter>
          </div>
        );
        break;
    }

    setSidebarContent(content);
  };

  // Set token when session is available
  useEffect(() => {
    if (session?.user) {
      const accessToken = (session as any)?.user?.accessToken;
      setToken(accessToken);
    }
  }, [session]);

  // Fetch SQL from API when queryId and token are ready
  useEffect(() => {
    const fetchSql = async () => {
      if (!queryId || !token) {
        console.warn("Missing queryId or token");
        return;
      }

      try {
        const generation = await fetchGenerationById(token, queryId);
        if (generation?.prompt_text) {
          setQuestion(generation.prompt_text);
        } else {
          setQuestion("-- No question found for this generation.");
        }

        if (generation?.sql) {
          setSql(generation.sql);
          setOriginalSql(generation.sql);
        } else {
          const defaultSql = "-- No SQL found for this generation.";
          setSql(defaultSql);
          setOriginalSql(defaultSql);
        }
      } catch (err) {
        console.error("Error fetching generation:", err);
        const errorSql = "-- Error loading SQL query.";
        setSql(errorSql);
        setOriginalSql(errorSql);
      }
    };

    fetchSql();
  }, [queryId, token]);

  // Handle SQL run
  const handleRun = async () => {
    if (!token || !queryId) {
      setOutput({ error: "Missing authentication token or query ID." });
      return;
    }

    // Prevent running if there are unsaved changes
    if (hasUnsavedChanges) {
      const confirmRun = window.confirm(
        "You have unsaved changes. Do you want to save them before running?"
      );
      if (confirmRun) {
        setShowSaveConfirmation(true);
        return;
      }
    }
    setLoading(true);
    setOutput(null);
    try {
      const data = await postSQLToGeneration(token, queryId, sql);

      if (data) {
        setOutput(data);
      } else {
        setOutput({ error: "Failed to execute query." });
      }
    } catch (error) {
      console.error("Error running SQL:", error);
      setOutput({ error: "Failed to execute query." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex min-h-screen",
      "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
      "text-[var(--color-text-dark)]"
    )}>
      {/* Main Content */}
      <div
        className={`${showSidebar ? "w-1/2" : "w-full"
          } transition-all duration-300 flex flex-col`}
      >
        <div className="flex-1 px-6 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className={cn(
              "text-xl font-semibold",
              "text-[var(--color-text-dark)]"
            )}>
              <span className="text-neutral-500">Query Editor:</span>{" "}
              <span className="text-[var(--color-text-dark)]">{question}</span>
            </h1>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {/* Show SQL Button */}
                <button
                  onClick={() => setShowSql((prev) => !prev)}
                  className={cn(
                    "flex items-center px-4 py-2 rounded-md transition-colors text-sm gap-2",
                    "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                    "border border-neutral-300 dark:border-neutral-700",
                    "text-[var(--color-text-dark)]",
                    "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                  )}
                >
                  {showSql ? "Hide SQL" : "Show SQL"}
                </button>
                <button
                  onClick={handleEditSave}
                  disabled={saving}
                  className={cn(
                    "flex items-center px-4 py-2 rounded-md transition-colors text-sm gap-2",
                    "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                    "border border-neutral-300 dark:border-neutral-700",
                    "text-[var(--color-text-dark)]",
                    "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]",
                    saving && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {editable ? (
                    <>
                      <Save className="w-4 h-4" />
                      {saving ? "Saving..." : "Save"}
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      Edit
                    </>
                  )}
                </button>
                <button
                  onClick={handleRun}
                  disabled={editable}
                  className={cn(
                    "flex items-center px-4 py-2 rounded-md transition-colors text-sm gap-2",
                    editable
                      ? "bg-neutral-200 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 text-neutral-400 cursor-not-allowed"
                      : cn(
                        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                        "border border-neutral-300 dark:border-neutral-700",
                        "text-[var(--color-text-dark)]",
                        "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                      )
                  )}
                >
                  <Play className="h-4 w-4" />
                  Run
                </button>
              </div>
            </div>
          </div>

          {/* SQL Editor */}
          {showSql && (
            <div className="relative">
              {editable ? (
                <div className={cn(
                  "flex border rounded h-64 overflow-hidden",
                  "border-neutral-300 dark:border-neutral-700",
                  "bg-gray-900"
                )}>
                  {/* Line Numbers */}
                  <div className="bg-gray-800 text-gray-400 text-sm font-mono px-3 py-4 select-none border-r border-gray-700 min-w-[3rem] text-right">
                    {getLineNumbers().map((lineNum) => (
                      <div key={lineNum} className="leading-5">
                        {lineNum}
                      </div>
                    ))}
                  </div>

                  {/* Code Editor */}
                  <textarea
                    className="flex-1 p-4 font-mono text-sm bg-gray-900 text-gray-200 focus:outline-none resize-none leading-5"
                    value={sql}
                    onChange={(e) => setSql(e.target.value)}
                    style={{
                      background: "#1a1a1a",
                      color: "#e6e6e6",
                      caretColor: "#00ff00",
                      whiteSpace: "pre",
                      overflowWrap: "normal",
                      wordWrap: "normal",
                      lineHeight: "1.25rem",
                      tabSize: 2,
                    }}
                    spellCheck={false}
                  />
                </div>
              ) : (
                <div className={cn(
                  "w-full h-64 border rounded overflow-hidden",
                  "border-neutral-300 dark:border-neutral-700"
                )}>
                  <SyntaxHighlighter
                    language="sql"
                    style={oneDark}
                    className="w-full h-full m-0"
                    customStyle={{
                      margin: 0,
                      padding: "16px",
                      background: "#1a1a1a",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      height: "100%",
                      overflow: "auto",
                    }}
                    showLineNumbers={true}
                    lineNumberStyle={{
                      color: "#6b7280",
                      paddingRight: "16px",
                      marginRight: "16px",
                      borderRight: "1px solid #374151",
                      minWidth: "3em",
                      textAlign: "right",
                    }}
                    wrapLines={true}
                    wrapLongLines={true}
                  >
                    {sql}
                  </SyntaxHighlighter>
                </div>
              )}
            </div>
          )}

          {/* Output */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              {/* Tab-style Action Buttons moved to left */}
              {output?.sql_result?.rows &&
                output.sql_result.rows.length > 0 && (
                  <div className="flex gap-1 ml-4">
                    <button
                      onClick={() => handleGenerateTable()}
                      className={cn(
                        "flex items-center px-3 py-1 rounded-md text-sm transition-colors",
                        viewMode === "table"
                          ? cn(
                            "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                            "text-[var(--color-text-dark)]",
                            "border border-neutral-300 dark:border-neutral-700",
                            "shadow-sm"
                          )
                          : cn(
                            "text-neutral-500",
                            "hover:text-[var(--color-text-highlight)]",
                            "hover:bg-[var(--color-button-highlight)]"
                          )
                      )}
                    >
                      <Table className="h-4 w-4 mr-1" />
                      Table
                    </button>

                    <button
                      onClick={() => handleGenerateGraph()}
                      disabled={!hasGraphData}
                      className={cn(
                        "flex items-center px-3 py-1 rounded-md text-sm transition-colors",
                        hasGraphData
                          ? viewMode === "graph"
                            ? cn(
                              "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                              "text-[var(--color-text-dark)]",
                              "border border-neutral-300 dark:border-neutral-700",
                              "shadow-sm"
                            )
                            : cn(
                              "text-neutral-500",
                              "hover:text-[var(--color-text-highlight)]",
                              "hover:bg-[var(--color-button-highlight)]"
                            )
                          : "text-neutral-300 cursor-not-allowed"
                      )}
                    >
                      <BarChart className="h-4 w-4 mr-1" />
                      Graph
                    </button>
                  </div>
                )}
            </div>

            {loading && (
              <p className="text-neutral-600">Running query...</p>
            )}
            {output?.error && (
              <p className="text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-800 mb-4">
                {output.error}
              </p>
            )}

            {/* Query Results Section */}
            {output?.sql_result?.rows && output.sql_result.rows.length > 0 && (
              <div className={cn(
                "rounded-lg p-6",
                "bg-neutral-50 dark:bg-neutral-900"
              )}>
                {/* Header with Query Results title and Export button */}

                {viewMode === "graph" && (
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                        <ChartLine className="w-5 h-5 mr-2 text-blue-500" />
                      <h3 className={cn(
                        "text-lg font-semibold",
                        "text-[var(--color-text-dark)]"
                      )}>
                        Visualization
                      </h3>
                    </div>

                    <button
                      onClick={handleDownloadExcel}
                      className={cn(
                        "flex items-center px-4 py-2 rounded-md transition-colors text-sm",
                        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                        "border border-neutral-300 dark:border-neutral-700",
                        "text-[var(--color-text-dark)]",
                        "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
                      )}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download Graph
                    </button>
                  </div>
                )}

                {/* Table or Graph Display Area */}
                <div className={cn(
                  "rounded-lg",
                  "bg-neutral-50 dark:bg-neutral-900"
                )}>
                  {viewMode === "table" ? (
                      <DataTable
                        data={{
                          columns: output.sql_result.columns,
                          rows: output.sql_result.rows.map((row: any) =>
                            output.sql_result.columns.map((col: string) => row[col])
                          )
                        }}
                      />
                  ) : (
                    <div
                      className={cn(
                        "w-full min-h-96 flex items-center justify-center",
                        "bg-neutral-50 dark:bg-neutral-900"
                      )}
                      ref={setGraphRef}
                    >
                      {/* Graph component rendered here */}
                      {hasGraphData && transformDataForGraph() ? (
                        <div className="w-full">
                          <CustomizableGraph
                            data={transformDataForGraph()!.data}
                            columns={transformDataForGraph()!.allColumns}
                            defaultXColumn={transformDataForGraph()!.xColumn}
                            defaultYColumn={transformDataForGraph()!.yColumn}
                            hideTitle={true}
                          />
                        </div>
                      ) : (
                        <div className="text-neutral-500">
                          Graph visualization will be displayed here
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {output?.message && (
              <p className="text-neutral-600 mt-4">{output.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Save Confirmation Modal */}
      {showSaveConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={cn(
            "rounded-lg p-6 max-w-md w-full mx-4 shadow-xl",
            "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]"
          )}>
            <div className="flex justify-between items-start mb-4">
              <h3 className={cn(
                "text-lg font-semibold",
                "text-[var(--color-text-dark)]"
              )}>
                Save Query Changes
              </h3>
              <button
                onClick={() => handleSaveConfirmation(false)}
                disabled={saving}
                className={cn(
                  "transition-colors disabled:opacity-50",
                  "text-neutral-400 hover:text-[var(--color-text-highlight)]"
                )}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <p className="text-neutral-600 mb-6">
              Are you sure you want to save this query? This will update the
              query in the database.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleSaveConfirmation(false)}
                disabled={saving}
                className={cn(
                  "px-4 py-2 rounded-md transition-colors disabled:opacity-50",
                  "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                  "border border-neutral-300 dark:border-neutral-700",
                  "text-[var(--color-text-dark)]",
                  "hover:bg-[var(--color-button-highlight)]"
                )}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveConfirmation(true)}
                disabled={saving}
                className={cn(
                  "px-4 py-2 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2",
                  "bg-[var(--color-text-highlight)] text-white",
                  "hover:opacity-90"
                )}
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
