import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { azure } from "@/lib/aoi";
import { z } from "zod";

export const config = {
  runtime: "edge",
};

// Define types for better type safety
interface DataItem {
  [key: string]: string | number | Date | null;
}

interface ColumnTypes {
  [key: string]: "numeric" | "temporal" | "categorical";
}

interface GraphRecommendation {
  recommendedGraphs: string[];
  reasoning: string;
  dataMapping?: Record<string, string>;
  formattedData?: any[];
}

export async function POST(req: NextRequest) {
  if (req.method !== "POST") {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const data = await req.json();
    const { userInput, executionResult } = data;

    if (
      !userInput ||
      !Array.isArray(executionResult) ||
      executionResult.length === 0
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const graphRecommendation = await determineGraphTypes(
      userInput,
      executionResult
    );
    return NextResponse.json(graphRecommendation);
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}

async function determineGraphTypes(
  userInput: string,
  executionResult: DataItem[]
): Promise<GraphRecommendation> {
  if (!executionResult || executionResult.length === 0) {
    return {
      recommendedGraphs: [],
      reasoning: "No data provided to analyze.",
    };
  }

  // Identify column types
  const columnTypes: ColumnTypes = {};
  const keys = Object.keys(executionResult[0]);

  keys.forEach((key) => {
    // Sample the first few values to determine type
    const samples = executionResult.slice(0, 5).map((row) => row[key]);

    if (
      samples.some(
        (val) => typeof val === "number" || !isNaN(parseFloat(val as string))
      )
    ) {
      columnTypes[key] = "numeric";
    } else if (
      samples.some(
        (val) =>
          typeof val === "string" &&
          (val.match(/^\d{4}-\d{2}-\d{2}$/) || // YYYY-MM-DD
            val.match(/^\d{2}\/\d{2}\/\d{4}$/) || // MM/DD/YYYY
            val.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) // M/D/YY
      ) ||
      ["date", "time", "year", "month", "day"].some((word) =>
        key.toLowerCase().includes(word)
      )
    ) {
      columnTypes[key] = "temporal";
    } else {
      columnTypes[key] = "categorical";
    }
  });

  // Use generateObject with Azure OpenAI
  try {
    const responseJSON = await generateObject({
      model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
      system:
        "You are a data visualization expert. Given data characteristics and user input, recommend appropriate graph types and explain your reasoning.",
      prompt: `
        Determine which graph types would be most appropriate for visualizing this data:
        
        User Input: ${userInput}
        
        Data structure:
        ${JSON.stringify(columnTypes, null, 2)}
        
        Sample data:
        ${JSON.stringify(executionResult.slice(0, 3), null, 2)}
        
        IMPORTANT: In your dataMapping object, please use 'x' and 'y' fields to indicate which columns should be used for x and y axes.
        For example: { "x": "month_column", "y": "value_column" }
      `,
      schema: z.object({
        recommendedGraphs: z
          .array(z.string())
          .describe(
            "Array of recommended graph types in order of preference (line, bar, pie, scatter, etc.)"
          ),
        reasoning: z
          .string()
          .describe("Brief explanation of why these graphs are appropriate"),
        dataMapping: z
          .any(z.any())
          .describe(
            "Object showing how data should be mapped to the primary recommended graph. Include 'x' and 'y' fields."
          ),
      }),
    });

    // Create a result object with the AI response
    const result: GraphRecommendation = { ...responseJSON.object };

    // Format data based on the dataMapping if x and y fields are present
    if (
      responseJSON.object.dataMapping &&
      responseJSON.object.dataMapping.x &&
      responseJSON.object.dataMapping.y
    ) {
      // Format data based on the mapping
      const formattedData = formatDataBasedOnMapping(
        executionResult,
        responseJSON.object.dataMapping
      );

      // Add formatted data to the result
      result.formattedData = formattedData;
    }
    // If no specific mapping is provided but we have recommendations
    else if (result.recommendedGraphs && result.recommendedGraphs.length > 0) {
      // Use the fallback formatter with the first recommended graph type
      const primaryGraph = result.recommendedGraphs[0];
      result.formattedData = formatDataForGraph(
        executionResult,
        primaryGraph,
        columnTypes
      );
    }
    return result;
  } catch (error) {
    const fallbackResult: GraphRecommendation = {
      recommendedGraphs: determineGraphTypesFallback(
        columnTypes,
        executionResult.length
      ),
      reasoning: "Determined using fallback logic based on data structure.",
      dataMapping: {},
    };

    // Add formatted data even in fallback scenario
    if (fallbackResult.recommendedGraphs.length > 0) {
      const primaryGraph = fallbackResult.recommendedGraphs[0];
      fallbackResult.formattedData = formatDataForGraph(
        executionResult,
        primaryGraph,
        columnTypes
      );
    }

    return fallbackResult;
  }
}

// Format data specifically based on the dataMapping
function formatDataBasedOnMapping(
  data: DataItem[],
  mapping: Record<string, string>
): DataItem[] {
  return data.map((item) => {
    const result: DataItem = { ...item }; // Copy all original data

    // Apply each mapping
    Object.entries(mapping).forEach(([targetKey, sourceKey]) => {
      // Handle numeric values for y-axis
      if (
        targetKey === "y" &&
        typeof item[sourceKey] === "string" &&
        !isNaN(parseFloat(item[sourceKey] as string))
      ) {
        result[targetKey] = parseFloat(item[sourceKey] as string);
      } else {
        result[targetKey] = item[sourceKey];
      }
    });

    return result;
  });
}

// Fallback function for graph type determination
function determineGraphTypesFallback(
  columnTypes: ColumnTypes,
  dataLength: number
): string[] {
  const types = Object.values(columnTypes);
  const numericCount = types.filter((t) => t === "numeric").length;
  const temporalCount = types.filter((t) => t === "temporal").length;
  const categoricalCount = types.filter((t) => t === "categorical").length;

  // Line chart: temporal + numeric
  if (temporalCount > 0 && numericCount > 0) {
    return ["line", "bar"];
  }

  // Pie chart: one categorical + one numeric, limited data points
  if (categoricalCount === 1 && numericCount === 1 && dataLength <= 10) {
    return ["pie", "bar"];
  }

  // Scatter plot: two numeric columns
  if (numericCount >= 2) {
    return ["scatter", "bar"];
  }

  // Bar chart as default
  if (numericCount > 0 && categoricalCount > 0) {
    return ["bar"];
  }

  return ["table"]; // Default fallback
}

// Format data for specific graph types
function formatDataForGraph(
  data: DataItem[],
  graphType: string,
  columnTypes: ColumnTypes
): DataItem[] {
  const numericColumns = Object.keys(columnTypes).filter(
    (key) => columnTypes[key] === "numeric"
  );
  const temporalColumns = Object.keys(columnTypes).filter(
    (key) => columnTypes[key] === "temporal"
  );
  const categoricalColumns = Object.keys(columnTypes).filter(
    (key) => columnTypes[key] === "categorical"
  );

  switch (graphType.toLowerCase()) {
    case "line":
      const timeKey = temporalColumns[0] || categoricalColumns[0];
      const valueKey = numericColumns[0];
      return data.map((item) => ({
        x: item[timeKey],
        y: parseFloat((item[valueKey] as string) || "0"),
        ...item,
      }));

    case "bar":
      const labelKey =
        categoricalColumns[0] || temporalColumns[0] || Object.keys(data[0])[0];
      const valueKey2 = numericColumns[0];
      return data.map((item) => ({
        label: item[labelKey],
        value: parseFloat((item[valueKey2] as string) || "0"),
        ...item,
      }));

    case "pie":
      const catKey = categoricalColumns[0] || Object.keys(data[0])[0];
      const numKey = numericColumns[0];
      return data.map((item) => ({
        label: item[catKey],
        value: parseFloat((item[numKey] as string) || "0"),
        ...item,
      }));

    case "scatter":
      const xKey = numericColumns[0];
      const yKey = numericColumns[1] || numericColumns[0];
      return data.map((item) => ({
        x: parseFloat((item[xKey] as string) || "0"),
        y: parseFloat((item[yKey] as string) || "0"),
        ...item,
      }));

    default:
      return data;
  }
}
