import {
  Table,
  TableHead,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Database, Download } from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// Props for the DataTable component
interface DataTableProps {
  data: { columns: string[]; rows: any[][] };
}

// DataTable component to display query results in a table format
export default function DataTable({ data }: DataTableProps) {
  if (!data || data?.rows?.length === 0) {
    return (
      <p className={cn(
        "text-neutral-500 p-4"
      )}>
        No data available
      </p>
    );
  }

  // Function to handle exporting table data as CSV
  const handleExport = () => {
    // Function to export table data as CSV
    const headers = data.columns.join(",");
    const csvRows = data.rows.map((row) => row.join(","));
    const csvContent = [headers, ...csvRows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "query_results.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mx-auto"
    >
      <div className="flex justify-between items-center p-5">
        <h2 className={cn(
          "text-lg font-semibold flex items-center",
          "text-[var(--color-text-light)]"
        )}>
          <Database className="w-5 h-5 mr-2 text-blue-500" />
          Query Results
        </h2>
        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className={cn(
            "transition-all",
            "bg-neutral-800 border-neutral-700 text-[var(--color-text-light)] hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]"
          )}
        >
          <Download className="w-4 h-4 mr-1" /> Export CSV
        </Button>
      </div>

      <CardContent className={cn(
  "bg-[var(--color-bg-dark)] p-0"
)}>
        <div className={cn(
  "h-75 border-y overflow-auto",
  "border-neutral-700 bg-neutral-900"
)}>
          <Table>
            <TableHeader className={cn(
               "bg-neutral-800"
            )}>
              <TableRow className="border-b">
                {data?.columns?.map((col, idx) => (
                  <TableHead
                    key={idx}
                    className="py-3 px-4 font-semibold text-white"
                  >
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rows?.map((row, rowIndex) => (
                <TableRow
                  key={rowIndex}
                  className={cn(
                    "border-b border-neutral-700 transition-colors",
                    "hover:bg-[var(--color-button-highlight)] hover:text-[var(--color-text-highlight)]",
                    rowIndex % 2 === 0
                      ? "bg-neutral-800"
                : "bg-neutral-700"
                  )}
                >
                  {row?.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}
                      className={cn(
                        "py-2 px-4",
                        "text-[var(--color-text-light)]",
                      )}
                    >
                      {cell !== null && cell !== undefined ? String(cell) : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className={cn(
  "mt-2 text-sm px-5 pb-5",
  "text-neutral-500"
)}>
          {data?.rows?.length} records found
        </div>
      </CardContent>
    </motion.div>
  );
}
