import { generateObject, createDataStreamResponse, streamText, tool } from "ai";
import { z } from "zod";
import { getToken } from "next-auth/jwt";
import { NextRequest } from "next/server";

import { azure } from "@/lib/aoi";
import {
  conversationResponsePrompt,
  greetingResponsePrompt,
  databaseQueryToolPrompt,
  insightsPrompt,
  classificationPrompt,
} from "@/lib/prompts";
import { executeSQLQuery, fetchSQLQuery } from "@/lib/tools";
import { insightsModel } from "@/lib/fw";
import { streamSQLGenerations } from "@/lib/api";

export const maxDuration = 30;

// API Function to handle POST requests for AI insights processing
export async function POST(req: NextRequest) {
  /* ------------------------------------------------------------------->
  This function processes user input, generates SQL queries, 
  executes them, and provides insights based on the results.

  It uses AI to classify the type of question and respond accordingly, 
  handling different types of user interactions such as greetings, 
  conversations, and database queries.

  It also includes error handling for invalid requests and ensures that 
  the request is authenticated before processing. 
  -------------------------------------------------------------------> */

  try {
    // Ensure the request is authenticated
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const accessToken =
      typeof token?.accessToken === "string" ? token.accessToken : undefined;

    // Check if the access token is present
    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const { messages, db_connection_id } = await req.json();

    // Stream the response
    return createDataStreamResponse({
      async execute(dataStream) {
        // generateObject to classify the user input
        const { object: classification } = await generateObject({
          model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
          schema: z.object({
            route: z.enum(["Greeting", "Conversation", "DatabaseQuery"]),
            confidence: z.number().min(0).max(1).optional(),
            question: z
              .string()
              .describe("The User input or question to be classified"),
          }),
          messages,
          system: classificationPrompt,
        });

        console.log(classification, "classification");

        // Initial state - thinking about the response
        dataStream.writeData({
          type: "ProcessingState",
          state: "thinking",
        });

        // Handle different classification routes
        // check if the classification is a "Greeting"
        if (classification.route === "Greeting") {
          const result = streamText({
            model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
            system: greetingResponsePrompt,
            messages,
          });
          // Merge the result into the data stream
          result.mergeIntoDataStream(dataStream);
        }

        // check if the classification is a general "Conversation"
        if (classification.route === "Conversation") {
          const result = streamText({
            model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
            system: conversationResponsePrompt,
            messages,
          });
          // Merge the result into the data stream
          result.mergeIntoDataStream(dataStream);
        }

        // check if the classification is a "DatabaseQuery"
        if (classification.route === "DatabaseQuery") {
          // streamText to handle database queries
          const stream = streamText({
            model: azure(process.env.AZURE_OPENAI_DEPLOYMENT_NAME!),
            system: databaseQueryToolPrompt,
            messages: messages,
            maxSteps: 3, // reduced steps to lower execution time
            // Tools for sequential execution
            tools: {
              // Tool 1: Generate SQL Query
              generateSQLQuery: tool({
                description:
                  "Generates a SQL query based on the user's question",
                parameters: z.object({
                  question: z
                    .string()
                    .describe(
                      "The user question for which SQL query should be generated"
                    ),
                }),
                execute: async ({ question }) => {
                  // Signal that we're generating SQL Query
                  dataStream.writeData({
                    type: "ProcessingState",
                    state: "fetchingSQL",
                  });

                  try {
                    // Generate SQL Query
                    const generatedQuery = await fetchSQLQuery(
                      classification?.question || question || "",
                      db_connection_id
                    );

                    // Check if the response is valid and generated a SQL Query
                    if (!generatedQuery || !generatedQuery?.id) {
                      dataStream.writeData({
                        type: "Error",
                        text: "Failed to generate SQL query.",
                      });
                      return {
                        success: false,
                        error: "Failed to generate SQL query.",
                      };
                    }

                    // Return the generated query details
                    return {
                      success: true,
                      queryId: generatedQuery?.id,
                      sql: generatedQuery?.sql,
                      message: `SQL query generated successfully. Query ID: ${generatedQuery?.id}`,
                    };
                  } catch (error) {
                    console.error("Error generating SQL:", error);
                    dataStream.writeData({
                      type: "Error",
                      text: `Failed to generate SQL query: ${error}`,
                    });
                    return {
                      success: false,
                      error: `Failed to generate SQL query: ${error}`,
                    };
                  }
                },
              }),

              // Tool 2: Execute SQL Query
              executeSQLQuery: tool({
                description:
                  "Executes a generated SQL query using its query ID",
                parameters: z.object({
                  queryId: z
                    .string()
                    .describe("The ID of the generated SQL query to execute"),
                }),
                execute: async ({ queryId }) => {
                  // Signal that we're executing SQL Query
                  dataStream.writeData({
                    type: "ProcessingState",
                    state: "executingSQL",
                  });

                  try {
                    // Execute the SQL Query
                    const executionResult = await executeSQLQuery(queryId);

                    // Check if the execution result is valid
                    if (!executionResult) {
                      dataStream.writeData({
                        type: "Error",
                        text: "Failed to execute SQL Query.",
                      });
                      return {
                        success: false,
                        error: "Failed to execute SQL Query.",
                      };
                    }

                    // Return execution results
                    return {
                      success: true,
                      queryResults: executionResult,
                      message: `SQL query executed successfully. Rows returned: ${
                        Array.isArray(executionResult)
                          ? executionResult?.length
                          : 0
                      }`,
                    };
                  } catch (error) {
                    console.error("Error executing SQL:", error);
                    dataStream.writeData({
                      type: "Error",
                      text: `Failed to execute SQL Query: ${error}`,
                    });
                    return {
                      success: false,
                      error: `Failed to execute SQL Query: ${error}`,
                    };
                  }
                },
              }),

              // Tool 3: Generate Insights (simplified to avoid extra classification call)
              generateInsights: tool({
                description: "Generates insights from SQL execution results",
                parameters: z.object({
                  question: z.string().describe("The original user question"),
                  sql: z.string().describe("The SQL query that was executed"),
                  results: z
                    .any()
                    .describe("The results from the SQL query execution"),
                }),
                execute: async ({ question, sql, results }, { toolCallId }) => {
                  try {
                    // Signal that we're generating insights
                    dataStream.writeData({
                      type: "ProcessingState",
                      state: "generatingInsights",
                    });

                    // Directly stream insights using the summary prompt to reduce extra model call overhead
                    const insightsStream = streamText({
                      model: insightsModel,
                      system: insightsPrompt.summary || "",
                      prompt: `Analyze SQL execution result:
                            - User Query: ${classification?.question}
                          - SQL Query: ${sql}
                          - Query Results: ${JSON.stringify(results, null, 2)}
                          Provide detailed, useful insights in Markdown format.`,
                      onChunk({ chunk }) {
                        if (chunk.type === "reasoning") {
                          dataStream?.writeData({
                            type: "Reasoning",
                            result: chunk.textDelta,
                            toolCallId,
                          });
                        }
                      },
                    }).mergeIntoDataStream(dataStream);

                    // Signal completion
                    dataStream.writeData({
                      type: "ProcessingState",
                      state: "completed",
                    });

                    return {
                      success: true,
                      message: "Insights generated successfully",
                      queryInsight: insightsStream,
                    };
                  } catch (error) {
                    console.error("Error generating insights:", error);
                    dataStream.writeData({
                      type: "Error",
                      text: `Failed to generate insights: ${error}`,
                    });
                    return {
                      success: false,
                      error: `Failed to generate insights: ${error}`,
                    };
                  }
                },
              }),

              // Tool 4: Stream SQL Generations
              streamSQLGenerations: tool({
                description: "Stream additional SQL generation variants",
                parameters: z.object({
                  question: z.string().describe("The original user question"),
                }),
                execute: async ({ question }) => {
                  try {
                    // Use streamSQLGenerations with token for streaming SQL generations
                    const streamResponse = await streamSQLGenerations(
                      accessToken,
                      classification?.question,
                      db_connection_id
                    );

                    // Check if the stream response is valid
                    if (!streamResponse) {
                      dataStream.writeData({
                        type: "Error",
                        text: "Failed to generate and execute SQL query via streaming.",
                      });
                      return {
                        success: false,
                        error:
                          "Failed to generate and execute SQL query via streaming.",
                      };
                    }

                    return {
                      success: true,
                      message: "SQL generation streamed successfully",
                    };
                  } catch (error) {
                    console.error("Error with streamSQLGenerations:", error);
                    dataStream.writeData({
                      type: "Error",
                      text: `Failed to process SQL query via streaming : ${error}`,
                    });
                    return {
                      success: false,
                      error: `Failed to process SQL query via streaming : ${error}`,
                    };
                  }
                },
              }),
            },
          });

          // Merge the stream into the data stream
          stream.mergeIntoDataStream(dataStream);
        }
      },
    });
  } catch (error) {
    console.error("Error in POST handler:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
