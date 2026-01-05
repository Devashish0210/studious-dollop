"use client";

import { useState, useEffect } from "react";
import { Search, ChevronDown, RefreshCw, Info, ChevronUp } from "lucide-react";
import { fetchGenerations } from "@/lib/api";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import "../../app/globals.css";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";

// Define the type for a query item
interface QueryItem {
  id: string;
  queryId: string;
  database: string;
  question: string;
  generatedSql: string;
  time: string;
  user: string;
  status: string;
  source: string;
}

// Custom Table Components
const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full overflow-auto">
    <table className="w-full caption-bottom text-sm">{children}</table>
  </div>
);

// Custom Table header Component
const TableHeader = ({ children }: { children: React.ReactNode }) => (
  <thead className="[&_tr]:border-b">{children}</thead>
);

// Custom Table Body Component
const TableBody = ({ children }: { children: React.ReactNode }) => (
  <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
);

// Custom Table Head Component
const TableHead = ({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <th
    className={cn(
      "h-12 px-4 text-left align-middle font-medium [&:has([role=checkbox])]:pr-0",
      "text-[var(--color-text-dark)]",
      onClick && "cursor-pointer hover:text-[var(--color-text-highlight)]",
      className
    )}
    onClick={onClick}
  >
    {children}
  </th>
);

// Custom Table Row Component
const TableRow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <tr
    className={cn(
      "border-b transition-colors",
      "hover:text-[var(--color-text-highlight)]",
      "data-[state=selected]:bg-[var(--color-button-highlight)] data-[state=selected]:text-[var(--color-text-highlight)]",
      className
    )}
  >
    {children}
  </tr>
);

// Custom Table Cell Component
const TableCell = ({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) => (
  <td
    className={cn(
      "p-4 align-middle [&:has([role=checkbox])]:pr-0",
      className
    )}
    colSpan={colSpan}
  >
    {children}
  </td>
);

// Custom Button Component
const Button = ({
  children,
  variant = "default",
  size = "default",
  className,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline";
  size?: "default" | "sm";
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const variantClasses = {
    default: cn(
      "bg-[var(--color-text-dark)] text-[var(--color-bg-light)] dark:text-[var(--color-bg-dark)]",
      "hover:opacity-90"
    ),
    outline: cn(
      "border border-neutral-300 dark:border-neutral-700",
      "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
      "text-[var(--color-text-dark)]",
      "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
    ),
  };

  const sizeClasses = {
    default: "h-10 px-4 py-2",
    sm: "h-9 px-3 text-sm",
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-highlight)] focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};

// Custom Input Component
const Input = ({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) => (
  <input
    className={cn(
      "flex h-10 w-full rounded-md border px-3 py-2 text-sm transition-colors",
      "border-neutral-300 dark:border-neutral-700",
      "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
      "text-[var(--color-text-dark)]",
      "placeholder:text-neutral-500",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-highlight)] focus-visible:ring-offset-2",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
  />
);

// Custom Dropdown Menu Components
const DropdownMenu = ({ children }: { children: React.ReactNode }) => {
  return <div className="relative inline-block text-left">{children}</div>;
};

// Custom Dropdown Menu Trigger
const DropdownMenuTrigger = ({
  asChild,
  children,
}: {
  asChild?: boolean;
  children: React.ReactNode;
}) => {
  return <>{children}</>;
};

// Custom Dropdown Menu Content Component
const DropdownMenuContent = ({
  children,
  align = "center",
}: {
  children: React.ReactNode;
  align?: "center" | "end" | "start";
}) => {
  const alignClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div
      className={cn(
        "absolute z-10 mt-2 w-56 rounded-md shadow-lg ring-1 ring-black ring-opacity-5",
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
        "border border-neutral-300 dark:border-neutral-700",
        alignClasses[align]
      )}
    >
      <div className="py-1">{children}</div>
    </div>
  );
};

// Custom Dropdown Menu Item Component
const DropdownMenuItem = ({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) => {
  return (
    <button
      className={cn(
        "block w-full px-4 py-2 text-left text-sm transition-colors",
        "text-[var(--color-text-dark)]",
        "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
      )}
      onClick={onSelect}
    >
      {children}
    </button>
  );
};

// Main QueryTable component
export default function QueryTable() {
  const { data: session, status } = useSession();
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQueries, setTotalQueries] = useState(0);

  // Search and sorting state
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("queryId");
  const [sortDirection, setSortDirection] = useState("asc");

  // Column visibility state - Updated to show only desired columns by default
  const [visibleColumns, setVisibleColumns] = useState({
    queryId: true,
    database: true,
    question: true,
    generatedSql: true,
    time: false,
    user: false,
    status: false,
    source: false,
  });
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Token for API authentication
  const [token, setToken] = useState<string | null>(null);

  // Fetch token from session storage and set it in state
  useEffect(() => {
    setToken((session as any)?.user?.accessToken);
  }, []);

  // Function to load queries from API
  const loadQueries = async () => {
    if (!token) {
      setError("Authentication token not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch queries from the API
      const data = await fetchGenerations(token, page, pageSize);

      if (data) {
        // Transform the API response to match our QueryItem interface
        const formattedQueries =
          data?.map((item: any) => ({
            id: item?.id || "Unknown",
            queryId: item?.display_id || "Unknown",
            database: item?.db_connection_alias || "Unknown",
            question: item?.prompt_text || "Unknown",
            generatedSql: item?.sql || "No SQL generated",
            time: new Date(item?.created_at).toLocaleString() || "Unknown",
            user: item?.created_by || "Unknown",
            status: item?.status || "Unknown",
            source: item?.source || "Unknown",
          })) || [];

        setQueries(formattedQueries);
        setTotalPages(Math.ceil((data?.total || 0) / pageSize));
        setTotalQueries(data?.total || 0);
      } else {
        setError("Failed to fetch queries");
      }
    } catch (err) {
      setError("An error occurred while fetching data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    if (token) {
      loadQueries();
    }
  }, [token, page, pageSize]);

  // Filter queries based on search term
  const filteredQueries =
    queries?.filter(
      (query) =>
        query?.queryId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        query?.question?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        query?.database?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        query?.user?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  // Sort queries based on sort field and direction
  const sortedQueries = [...filteredQueries].sort((a, b) => {
    const fieldA = a[sortField as keyof QueryItem];
    const fieldB = b[sortField as keyof QueryItem];

    if (sortDirection === "asc") {
      return fieldA < fieldB ? -1 : fieldA > fieldB ? 1 : 0;
    } else {
      return fieldA > fieldB ? -1 : fieldA < fieldB ? 1 : 0;
    }
  });

  // Toggle sort field and direction
  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Toggle column visibility
  const toggleColumn = (column: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [column]: !prev[column as keyof typeof visibleColumns],
    }));
    setDropdownOpen(false);
  };

  // Handle refresh button click
  const handleRefresh = () => {
    loadQueries();
  };

  // Handle pagination
  const nextPage = () => {
    if (page < totalPages - 1) {
      setPage(page + 1);
    }
  };

  // Handle previous page click
  const prevPage = () => {
    if (page > 0) {
      setPage(page - 1);
    }
  };

  // Handle outside click for dropdown
  useEffect(() => {
    const handleOutsideClick = () => {
      if (dropdownOpen) setDropdownOpen(false);
    };

    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [dropdownOpen]);

  const router = useRouter();

  return (
    <Card className={cn(
      "w-full p-4 space-y-4",
      "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
      "text-[var(--color-text-dark)]"
    )}>
      <h1 className={cn(
        "text-2xl font-bold",
        "text-[var(--color-text-dark)]"
      )}>
        Queries
      </h1>

      <div className="flex items-center justify-between">
        <div className="relative w-80">
          <Search className={cn(
            "absolute left-2 top-2.5 h-4 w-4",
            "text-neutral-500"
          )} />
          <Input
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <div
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen(!dropdownOpen);
              }}
            >
              <DropdownMenuTrigger>
                <Button variant="outline" size="sm" className={cn(
                  "ml-auto transition-all group",
                  "text-[var(--color-text-dark)]",
                  "hover:text-[var(--color-text-highlight)]",
                  "hover:bg-[var(--color-button-highlight)]",
                )}>
                  <span>Select visible columns</span>
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </div>

            {dropdownOpen && (
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => toggleColumn("queryId")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.queryId}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Query ID</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("database")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.database}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Database</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("question")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.question}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Question</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("generatedSql")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.generatedSql}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Generated SQL</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("time")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.time}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Time</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("user")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.user}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>User</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("status")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.status}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Status</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => toggleColumn("source")}>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={visibleColumns?.source}
                      onChange={() => { }}
                      className="mr-2"
                    />
                    <span>Source</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            )}
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className={cn(
              "px-2 transition-all group",
              "text-[var(--color-text-dark)]",
              "hover:text-[var(--color-text-highlight)]",
              "hover:bg-[var(--color-button-highlight)]",
            )}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded-md">
          {error}
        </div>
      )}

      <div className={cn(
        "border rounded-md",
        "border-neutral-300 dark:border-neutral-700",
        "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]"
      )}>
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns?.queryId && (
                <TableHead
                  onClick={() => toggleSort("queryId")}
                  className="cursor-pointer"
                >
                  <div className="flex items-center">
                    QUERY ID
                    {sortField === "queryId" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="ml-1 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-1 h-4 w-4" />
                      ))}
                  </div>
                </TableHead>
              )}

              {visibleColumns?.database && <TableHead>DATABASE</TableHead>}

              {visibleColumns?.question && <TableHead>QUESTION</TableHead>}

              {visibleColumns?.generatedSql && (
                <TableHead>GENERATED SQL</TableHead>
              )}

              {visibleColumns?.time && (
                <TableHead
                  onClick={() => toggleSort("time")}
                  className="cursor-pointer"
                >
                  <div className="flex items-center">
                    TIME
                    {sortField === "time" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="ml-1 h-4 w-4" />
                      ) : (
                        <ChevronDown className="ml-1 h-4 w-4" />
                      ))}
                  </div>
                </TableHead>
              )}

              {visibleColumns?.user && <TableHead>USER</TableHead>}

              {visibleColumns?.status && <TableHead>STATUS</TableHead>}

              {visibleColumns?.source && <TableHead>SOURCE</TableHead>}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={
                    Object.values(visibleColumns)?.filter(Boolean).length
                  }
                  className="text-center py-4"
                >
                  <div className="flex justify-center items-center">
                    <RefreshCw className="animate-spin h-5 w-5 mr-2" />
                    Loading queries...
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedQueries?.length > 0 ? (
              sortedQueries?.map((query) => (
                <TableRow
                  key={query?.queryId}
                  className="cursor-pointer"
                >
                  {visibleColumns?.queryId && (
                    <TableCell className="font-medium">
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.queryId}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.database && (
                    <TableCell>
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.database}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.question && (
                    <TableCell className="max-w-xs truncate">
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.question}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.generatedSql && (
                    <TableCell className="max-w-xs truncate">
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.generatedSql}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.time && (
                    <TableCell>
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.time}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.user && (
                    <TableCell>
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.user}
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.status && (
                    <TableCell>
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${query?.status === "Completed"
                              ? "bg-green-100 text-green-800"
                              : query?.status === "Failed"
                                ? "bg-red-100 text-red-800"
                                : query?.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {query?.status}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns?.source && (
                    <TableCell>
                      <div
                        onClick={() => router.push(`/queries/query-editor/${query?.id}`)}
                        className="cursor-pointer"
                        style={{ display: 'contents' }}
                      >
                        {query?.source}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={
                    Object.values(visibleColumns)?.filter(Boolean).length
                  }
                  className="text-center py-4"
                >
                  No queries found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-4">
        <div className={cn(
          "text-sm",
          "text-neutral-500"
        )}>
          Showing {sortedQueries?.length || 0} of {totalQueries} queries
        </div>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "transition-all group",
              "text-[var(--color-text-dark)]",
              "hover:text-[var(--color-text-highlight)]",
              "hover:bg-[var(--color-button-highlight)]",
            )}
            onClick={prevPage}
            disabled={page === 0 || loading}
          >
            Previous
          </Button>
          <span className={cn(
            "flex items-center px-3",
            "text-[var(--color-text-dark)]"
          )}>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "transition-all group",
              "text-[var(--color-text-dark)]",
              "hover:text-[var(--color-text-highlight)]",
              "hover:bg-[var(--color-button-highlight)]",
            )}
            onClick={nextPage}
            disabled={page >= totalPages - 1 || loading}
          >
            Next
          </Button>
          <select
            className={cn(
              "h-9 rounded-md border px-3 text-sm",
              "border-neutral-300 dark:border-neutral-700",
              "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
              "text-[var(--color-text-dark)]"
            )}
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0); // Reset to first page (0) when changing page size
            }}
          >
            <option value="10">10 per page</option>
            <option value="20">20 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
        </div>
      </div>
    </Card>
  );
}