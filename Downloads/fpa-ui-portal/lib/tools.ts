import axios from "axios";

const API_ENGINE_URL = process.env.API_ENGINE_URL;
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.API_AUTH_KEY;
const AZURE_LLM_NAME = process.env.AZURE_LLM_NAME;
const AZURE_OPENAI_API_BASE = process.env.AZURE_OPENAI_API_BASE;

const headers = {
  accept: "application/json",
  "X-OpenAI-Key": API_KEY,
  "Content-Type": "application/json",
};

// Tool Used to generate SQL query from the user question (Natural Language)
export const fetchSQLQuery = async (query: string, db_connection_id:string ) => {
  try {
    const response = await axios.post(
      `${API_ENGINE_URL}/prompts/sql-generations`,
      {
        low_latency_mode: false,
        llm_config: {
          llm_name: AZURE_LLM_NAME,
          api_base: AZURE_OPENAI_API_BASE,
        },
        evaluate: false,
        metadata: {},
        prompt: {
          text: query,
          db_connection_id: db_connection_id,
          // schemas: ["public"],
          metadata: {},
        },
      },
      { headers }
    );

    return response?.data;
  } catch (error) {
    console.error("Error fetching SQL query:", error);
    return null;
  }
};

// Tool Used to execute SQL query using the generated SQL query ID
export const executeSQLQuery = async (id: string) => {
  try {
    const response = await axios.get(
      `${API_ENGINE_URL}/sql-generations/${id}/execute`,
      { headers }
    );
    return response?.data;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    return null;
  }
};

// Tool Used to stream SQL generations from the API
export const streamSQLGenerations = async (
  token: string,
  prompt: string,
  db_connection_id: string
) => {
  const url = `${NEXT_PUBLIC_API_URL}/generations/prompts/sql-generations/stream`;

  try {
    const response = await axios.post(
      url,
      {
        prompt,
        db_connection_id,
      },
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        responseType: "stream",
      }
    );
    return response?.data;
  } catch (error) {
    console.error("Error streaming SQL generations:", error);
    return null;
  }
};
