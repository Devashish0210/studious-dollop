import { generateObject, createDataStreamResponse, streamText } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { azure } from "@/lib/aoi";
import { insightsModel } from "@/lib/fw";
import { insightsPrompt } from "@/lib/prompts";

export const maxDuration = 30;

// API Function to handle POST requests for AI insights processing
export async function POST(req: NextRequest) {
  try {
    // Ensure JSON is valid
    const bodyText = await req.text();
    if (!bodyText) {
      return NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      );
    }

    let requestBody;
    try {
      requestBody = JSON.parse(bodyText);
    } catch (error) {
      return NextResponse.json(
        { error: "Invalid JSON format" },
        { status: 400 }
      );
    }

    const { userInput, responseSQL, executionResult } = requestBody;

    //  Ensure required fields exist
    if (!userInput || !responseSQL || !Array.isArray(executionResult)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    return createDataStreamResponse({
      async execute(dataStream) {
        dataStream.writeData("Processing Insights...");
        try {
          const { object: classification } = await generateObject({
            model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
            schema: z.object({
              category: z.enum([
                "trend_analysis",
                "anomaly_detection",
                "summary",
                "unknown",
              ]),
              reasoning: z.string(),
            }),
            prompt: `Classify this database query insight:
            - User Query: ${userInput}
            - Query Results: ${executionResult}
            - SQL Executed: ${responseSQL}

            Categories:
            - 'trend_analysis': Detect patterns/trends in the data.
            - 'anomaly_detection': Identify unusual data points.
            - 'summary': Provide a high-level summary.
            - 'unknown': Not classifiable.`,
            system: `You are an expert data analyst. Your task is to analyze SQL results and classify insights into appropriate categories.
            Explain the reasoning behind your classification.`,
          });

          dataStream.writeData({
            type: "Classification",
            result: classification,
          });

          const stream = streamText({
            model: insightsModel,
            system:
              classification?.category &&
              classification.category in insightsPrompt
                ? insightsPrompt[
                    classification.category as keyof typeof insightsPrompt
                  ]
                : "",
            prompt: `
              Analyze the given SQL execution result and provide data insights:
              - User Query: ${userInput}
              - Classification: ${classification?.reasoning}
              - SQL Query: ${responseSQL}
              - Query Results: ${JSON.stringify(executionResult, null, 2)}
    
              Provide detailed insights in Markdown format.`,
            onChunk({ chunk }) {
              if (chunk.type === "reasoning") {
                dataStream.writeData({
                  type: "Reasoning",
                  result: chunk.textDelta,
                });
                dataStream.writeMessageAnnotation({ chunk: chunk.textDelta });
              }
            },
            onFinish() {
              dataStream.writeMessageAnnotation({
                other: "Processing Completed",
              });
              dataStream.writeData("Insights generation completed.");
            },
          }).mergeIntoDataStream(dataStream);
        } catch (error) {
          console.error("AI Processing Error:", error);
          dataStream.writeData({
            type: "Error",
            result: "Error generating insights.",
          });
        }
      },
    });
  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
