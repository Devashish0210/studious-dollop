"use client";

import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import "../../app/globals.css";

// Define the structure of data points
interface DataPoint {
  [key: string]: string | number;
}

// Props for the CustomizableGraph component
interface CustomizableGraphProps {
  data?: DataPoint[];
  columns?: string[];
  defaultXColumn?: string;
  defaultYColumn?: string;
  hideTitle?: boolean;
}

// CustomizableGraph component
const CustomizableGraph: React.FC<CustomizableGraphProps> = ({
  data: propData,
  columns,
  defaultXColumn,
  defaultYColumn,
  hideTitle = false,
}) => {
  // Sample data if none provided
  const defaultData: DataPoint[] = [
    {
      month: "Jan",
      sales: 4000,
      revenue: 2400,
      customers: 240,
      expenses: 1800,
    },
    {
      month: "Feb",
      sales: 3000,
      revenue: 1398,
      customers: 221,
      expenses: 1200,
    },
    {
      month: "Mar",
      sales: 2000,
      revenue: 9800,
      customers: 229,
      expenses: 2100,
    },
    {
      month: "Apr",
      sales: 2780,
      revenue: 3908,
      customers: 200,
      expenses: 1900,
    },
    {
      month: "May",
      sales: 1890,
      revenue: 4800,
      customers: 218,
      expenses: 2300,
    },
    {
      month: "Jun",
      sales: 2390,
      revenue: 3800,
      customers: 250,
      expenses: 2000,
    },
    {
      month: "Jul",
      sales: 3490,
      revenue: 4300,
      customers: 210,
      expenses: 2400,
    },
  ];

  const data = propData || defaultData;

  // Use defaultXColumn and defaultYColumn if provided, otherwise fall back to existing logic
  const [xAxis, setXAxis] = useState<string>(defaultXColumn || "month");
  const [yAxis, setYAxis] = useState<string>(defaultYColumn || "sales");
  const [pieCategory, setPieCategory] = useState<string>("month"); // For pie chart category
  const [pieValue, setPieValue] = useState<string>("sales"); // For pie chart values
  const [chartType, setChartType] = useState<
    "line" | "bar" | "area" | "scatter" | "pie"
  >("line");
  const [isAccordionOpen, setIsAccordionOpen] = useState<boolean>(false);

  // Get available keys from data, use columns prop if provided
  // Update the availableKeys useMemo to handle potential undefined/null data
  const availableKeys = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (!data || data.length === 0) return [];
    return Object.keys(data[0] || {});
  }, [data, columns]);

  // Get numeric keys for pie chart values and regular Y-axis - more flexible detection
  // Update the numericKeys useMemo with null checks
  const numericKeys = useMemo(() => {
    if (!data || data.length === 0) return availableKeys;

    return availableKeys.filter((key) => {
      if (!data[0]) return false;
      // Check multiple data points to ensure consistency
      const values = data.slice(0, Math.min(5, data.length)).map((d) => d[key]);
      return values.every(
        (val) =>
          typeof val === "number" ||
          (typeof val === "string" &&
            !isNaN(parseFloat(val)) &&
            isFinite(parseFloat(val)))
      );
    });
  }, [data, availableKeys]);

  // Get non-numeric keys for pie chart categories - more flexible
  const categoryKeys = useMemo(() => {
    if (data.length === 0) return availableKeys; // Fallback to all keys if no data

    const nonNumeric = availableKeys.filter(
      (key) => !numericKeys.includes(key)
    );
    return nonNumeric.length > 0 ? nonNumeric : availableKeys; // Fallback if no non-numeric found
  }, [data, availableKeys, numericKeys]);

  // Helper function to safely convert values to numbers
  const safeToNumber = (value: string | number): number => {
    if (typeof value === "number") return value;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  // Generate pie chart data with better error handling
  // Update pieData useMemo with additional checks
  const pieData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return [];

    return data
      .filter((d) => d !== null && d !== undefined)
      .map((d, index) => ({
        name: String(d[pieCategory] || `Item ${index + 1}`),
        value: safeToNumber(d[pieValue] || 0),
      }))
      .filter((item) => item.value > 0); // Filter out zero values
  }, [data, pieCategory, pieValue]);

  // Process data for non-pie charts to handle mixed data types
  // Update processedData useMemo with null checks
  const processedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    return data
      .filter((item) => item !== null && item !== undefined)
      .map((item) => ({
        ...item,
        [yAxis]: safeToNumber(item[yAxis] || 0),
      }));
  }, [data, yAxis]);

  const renderChart = (): React.ReactElement => {
    const commonProps = {
      data: processedData,
      margin: { top: 20, right: 30, left: 40, bottom: 20 }, // Increased left margin for Y-axis
    };

    switch (chartType) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              width={60} // Fixed width for Y-axis
            />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxis}
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ fill: "#8884d8", strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );

      case "bar":
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Legend />
            <Bar dataKey={yAxis} fill="#8884d8" />
          </BarChart>
        );

      case "area":
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey={yAxis}
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.6}
            />
          </AreaChart>
        );

      case "scatter":
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Legend />
            <Scatter dataKey={yAxis} fill="#8884d8" />
          </ScatterChart>
        );

      case "pie": {
        const COLORS = [
          "#8884d8",
          "#82ca9d",
          "#ffc658",
          "#ff8042",
          "#00C49F",
          "#8dd1e1",
          "#d084d0",
          "#ffb347",
        ];

        // Show error message if no valid pie data
        if (pieData.length === 0) {
          return (
            <div className="w-full h-full flex items-center justify-center">
              <div className={cn(
                "text-center",
                "text-neutral-500"
              )}>
                <p className="text-lg font-medium">
                  No valid data for pie chart
                </p>
                <p className="text-sm">
                  Please select a numeric column for values
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <Tooltip
                  formatter={(value: any) => [value, "Value"]}
                  labelFormatter={(label: any) => `Category: ${label}`}
                />
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="60%"
                  innerRadius="0%"
                  label={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }

      default:
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={xAxis}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} width={60} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey={yAxis}
              stroke="#8884d8"
              strokeWidth={2}
              dot={{ fill: "#8884d8", strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        );
    }
  };

  const renderControls = () => {
    if (chartType === "pie") {
      // Special controls for pie chart
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Category Selector for Pie Chart */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              Categories (Parts of Whole)
            </label>
            <select
              value={pieCategory}
              onChange={(e) => setPieCategory(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              {categoryKeys?.map((key) => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Value Selector for Pie Chart */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              Values (Size of Parts)
            </label>
            <select
              value={pieValue}
              onChange={(e) => setPieValue(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              {numericKeys.length > 0
                ? numericKeys?.map((key) => (
                  <option key={key} value={key}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </option>
                ))
                : availableKeys?.map((key) => (
                  <option key={key} value={key}>
                    {key.charAt(0).toUpperCase() + key.slice(1)}
                  </option>
                ))}
            </select>
          </div>

          {/* Chart Type Selector */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              Chart Type
            </label>
            <select
              value={chartType}
              onChange={(e) =>
                setChartType(
                  e.target.value as "line" | "bar" | "area" | "scatter" | "pie"
                )
              }
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="area">Area Chart</option>
              <option value="scatter">Scatter Plot</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>
        </div>
      );
    } else {
      // Regular controls for other chart types
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* X-Axis Selector */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              X-Axis Data
            </label>
            <select
              value={xAxis}
              onChange={(e) => setXAxis(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              {availableKeys?.map((key) => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Y-Axis Selector */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              Y-Axis Data
            </label>
            <select
              value={yAxis}
              onChange={(e) => setYAxis(e.target.value)}
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              {availableKeys?.map((key) => (
                <option key={key} value={key}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                  {!numericKeys.includes(key) && " (will convert to number)"}
                </option>
              ))}
            </select>
          </div>

          {/* Chart Type Selector */}
          <div className="space-y-2">
            <label className={cn(
              "block text-sm font-medium",
              "text-[var(--color-text-dark)]"
            )}>
              Chart Type
            </label>
            <select
              value={chartType}
              onChange={(e) =>
                setChartType(
                  e.target.value as "line" | "bar" | "area" | "scatter" | "pie"
                )
              }
              className={cn(
                "w-full px-3 py-2 border rounded-md transition-colors",
                "border-neutral-300 dark:border-neutral-700",
                "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
                "text-[var(--color-text-dark)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-text-highlight)] focus:border-transparent"
              )}
            >
              <option value="line">Line Chart</option>
              <option value="bar">Bar Chart</option>
              <option value="area">Area Chart</option>
              <option value="scatter">Scatter Plot</option>
              <option value="pie">Pie Chart</option>
            </select>
          </div>
        </div>
      );
    }
  };

  const renderPieChartAccordion = () => {
    if (chartType !== "pie" || pieData.length === 0) return null;

    const COLORS = [
      "#8884d8",
      "#82ca9d",
      "#ffc658",
      "#ff8042",
      "#00C49F",
      "#8dd1e1",
      "#d084d0",
      "#ffb347",
    ];
    const total = pieData.reduce((sum, item) => sum + item.value, 0);

    return (
      <div className={cn(
        "mt-4 border rounded-lg overflow-hidden",
        "border-neutral-300 dark:border-neutral-700"
      )}>
        <button
          onClick={() => setIsAccordionOpen(!isAccordionOpen)}
          className={cn(
            "w-full px-4 py-3 flex items-center justify-between text-left transition-colors",
            "bg-neutral-50 dark:bg-neutral-800",
            "hover:bg-[var(--color-button-highlight)]"
          )}
        >
          <span className={cn(
            "text-sm font-medium",
            "text-[var(--color-text-dark)]"
          )}>
            Chart Details ({pieData.length} items)
          </span>
          {isAccordionOpen ? (
            <ChevronUp className="w-4 h-4 text-neutral-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-neutral-500" />
          )}
        </button>

        {isAccordionOpen && (
          <div className={cn(
            "px-4 py-3 border-t",
            "bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]",
            "border-neutral-300 dark:border-neutral-700"
          )}>
            <div className="space-y-2">
              {pieData?.map((item, index) => {
                const percentage =
                  total > 0 ? ((item.value / total) * 100).toFixed(1) : "0.0";
                return (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center justify-between py-2 border-b last:border-b-0",
                      "border-neutral-200 dark:border-neutral-700"
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      />
                      <span className={cn(
                        "text-sm font-medium",
                        "text-[var(--color-text-dark)]"
                      )}>
                        {item.name}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-sm font-semibold",
                        "text-[var(--color-text-dark)]"
                      )}>
                        {item.value.toLocaleString()}
                      </div>
                      <div className="text-xs text-neutral-500">{percentage}%</div>
                    </div>
                  </div>
                );
              })}
              <div className={cn(
                "pt-2 mt-2 border-t",
                "border-neutral-300 dark:border-neutral-700"
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-sm font-medium",
                    "text-[var(--color-text-dark)]"
                  )}>
                    Total
                  </span>
                  <span className={cn(
                    "text-sm font-semibold",
                    "text-[var(--color-text-dark)]"
                  )}>
                    {total.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn(
      "w-full max-w-6xl mx-auto p-6 rounded-lg shadow-lg",
    )}>
      {/* Conditionally render the title based on hideTitle prop */}
      {!hideTitle && (
        <h2 className={cn(
          "text-2xl font-bold mb-6",
          "text-[var(--color-text-dark)]"
        )}>
          Data Visualization
        </h2>
      )}

      {/* Dynamic Controls based on chart type */}
      {renderControls()}

      {/* Chart Container */}
      <div className={cn(
        "w-full h-96 rounded-lg overflow-hidden",
      )}>
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>

      {/* Pie Chart Accordion */}
      {renderPieChartAccordion()}
    </div>
  );
};

export default CustomizableGraph;
