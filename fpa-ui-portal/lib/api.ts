import axios from "axios";
 
// --- Constants ---
const API_ENGINE_URL = process.env.API_ENGINE_URL;
const API_KEY = process.env.API_AUTH_KEY;
const DB_CONNECTION_ID = process.env.AZURE_DB_CONNECTION_ID;
const AZURE_LLM_NAME = process.env.AZURE_LLM_NAME;
const AZURE_OPENAI_API_BASE = process.env.AZURE_OPENAI_API_BASE;
const NEXT_PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL;
const NEXT_PUBLIC_BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH || "/copilot/fpa-chat";
 
// Headers for API requests
const headers = {
  accept: "application/json",
  "X-OpenAI-Key": API_KEY,
  "Content-Type": "application/json",
};
 
// Used to stream SQL generations from the API
export const streamSQLGenerations = async (
  token: string,
  prompt: string,
  db_connection_id: string
) => {
  const url = `http://localhost:3591/generations/prompts/sql-generations/stream`;
 
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
        responseType: "stream", // If you want to handle streaming responses
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error streaming SQL generations:", error);
    return null;
  }
};
 
// Used to generate SQL query from the user question (Natural Language)
export const fetchSQLQuery = async (query: string) => {
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
          db_connection_id: DB_CONNECTION_ID,
          schemas: ["public"],
          metadata: {},
        },
      },
      { headers }
    );
 
    return response.data;
  } catch (error) {
    console.error("Error fetching SQL query:", error);
    return null;
  }
};
 
// Used to execute SQL query using the generated SQL query ID
export const executeSQLQuery = async (id: string) => {
  try {
    const response = await axios.get(
      `${API_ENGINE_URL}/sql-generations/${id}/execute`,
      { headers }
    );
 
    return response.data;
  } catch (error) {
    console.error("Error executing SQL query:", error);
    return null;
  }
};
 
// Used to generate AI Insights using the generated SQL query and execution result
export const fetchAIInsights = async (
  userInput: string,
  responseSQL: string,
  executionResult: any[]
) => {
  try {
    const response = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/ai`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput, responseSQL, executionResult }),
    });
 
    // Ensure response is a readable stream
    if (!response.body) {
      throw new Error("Readable stream not found in response.");
    }
 
    // Process stream correctly
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let insights = "";
 
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
 
      const decodedChunk = decoder.decode(value, { stream: true });
 
      // Extract JSON objects and append only the "result" field
      try {
        const jsonChunks = decodedChunk.match(/\{.*?\}/g); // Extract JSON objects
        if (jsonChunks) {
          jsonChunks.forEach((chunk) => {
            try {
              const parsed = JSON.parse(chunk);
              if (parsed.result) {
                insights += parsed.result + " "; // Append the result text
              }
            } catch (error) {
              console.error("Error parsing chunk:", error);
            }
          });
        }
      } catch (error) {
        console.error("Error processing stream chunk:", error);
      }
    }
 
    return insights.trim() || "No insights available.";
  } catch (error) {
    console.error("Error fetching AI insights:", error);
    return "Unable to generate insights.";
  }
};
 
// Used to generate Graphs/Charts using the user query and execution result
export const fetchGraphType = async (
  userInput: string,
  executionResult: any[]
) => {
  try {
    const response = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/graphs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput, executionResult }),
    });
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const graphData = await response.json();
    return graphData;
  } catch (error) {
    console.error("Error determining graph type:", error);
    return {
      recommendedGraphs: ["bar"],
      reasoning: "Default fallback due to error",
      formattedData: executionResult,
    };
  }
};
 
// <-------------------------- Query Generations API Functions -------------------------------------->
 
// Used to fetch the generations (ALL Queries asked by the users) from the API
export const fetchGenerations = async (
  token: string,
  page: number,
  pageSize: number
) => {
  const url = `${NEXT_PUBLIC_API_URL}/generations`;
 
  try {
    const response = await axios.get(url, {
      params: {
        page,
        page_size: pageSize,
        order: "created_at",
        ascend: false,
      },
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-OpenAI-Key": API_KEY,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching generations:", error);
    return null;
  }
};
 
// Used to fetch a single generation by ID.
export const fetchGenerationById = async (
  token: string,
  generationId: string
) => {
  const url = `${NEXT_PUBLIC_API_URL}/generations/${generationId}`;
 
  try {
    const response = await axios.get(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching generation by ID:", error);
    return null;
  }
};
 
// used to post SQL query to a specific generation and get result.
export const postSQLToGeneration = async (
  token: string,
  generationId: string,
  sql: string
) => {
  const url = `${NEXT_PUBLIC_API_URL}/generations/${generationId}/sql-generations`;
 
  try {
    const response = await axios.post(
      url,
      { sql },
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error posting SQL to generation:", error);
    return null;
  }
};
// <-------------------------- Database API Functions -------------------------------------->
 
// Used to fetch the databases and tables (table-descriptions/databases API) from the API
export const fetchConnectedDatabases = async (token: string) => {
  const url = `http://localhost:3591/table-descriptions/database/list`;
 
  try {
    const response = await axios.get(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
        "X-OpenAI-Key": API_KEY,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching databases:", error);
    return null;
  }
};
 
// Used to Add the databases from the API
export const addConnectDatabases = async (token: string, payload: any) => {
  const url = `${NEXT_PUBLIC_API_URL}/database-connections`;
 
  try {
    const response = await axios.post(url, payload, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching databases:", error);
    return null;
  }
};
 
// Used to sync Database table schemas from the API
export const syncDatabaseSchemas = async (token: string, ids: any[]) => {
  const url = `${NEXT_PUBLIC_API_URL}/table-descriptions/sync-schemas`;
 
  try {
    const response = await axios.post(
      url,
      { ids: ids },
      {
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
 
    return response.data;
  } catch (error) {
    console.error("Error syncing schemas:", error);
    return null;
  }
};
 
// Used to refresh all table descriptions from the API
export const refreshAllDatabaseSchemas = async (token: string) => {
  const url = `${NEXT_PUBLIC_API_URL}/table-descriptions/refresh-all`;
 
  try {
    const response = await axios.post(
      url,
      {}, // Empty payload
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
 
    return response.data;
  } catch (error) {
    console.error("Error refreshing schemas:", error);
    return null;
  }
};
 
// <-------------------------- Table Descriptions API Functions -------------------------------------->
 
// Fetch a specific table description by table id
export async function getTableDescriptionById(table_id: string, token: string) {
  try {
    const response = await axios.get(
      `${NEXT_PUBLIC_API_URL}/table-descriptions/${table_id}`,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Table description fetched:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching table description id:", error);
    return null;
  }
}
 
// Update Table Description
export async function updateTableDescription(
  table_id: string,
  table_description: string,
  token: string
) {
  try {
    const response = await axios.put(
      `${NEXT_PUBLIC_API_URL}/table-descriptions/${table_id}`,
      { description: table_description },
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Table description updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updating table description:", error);
    return null;
  }
}
 
// <-------------------------- User/Team API Functions -------------------------------------->
 
// Used to fetch the users from the API
export const fetchUsers = async (token: string) => {
  const url = `${NEXT_PUBLIC_API_URL}/users`;
 
  try {
    const response = await axios.get(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching Users:", error);
    return null;
  }
};
 
// Used to fetch the users from the API
export const deleteUser = async (token: string, id: string) => {
  const url = `${NEXT_PUBLIC_API_URL}/users/${id}`;
 
  try {
    const response = await axios.delete(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error deleting user:", error);
    return null;
  }
};
 
// Used to Add the users from the API
export const inviteUserToOrganization = async (token: string, payload: any) => {
  const url = `${NEXT_PUBLIC_API_URL}/users/invite`;
 
  try {
    const response = await axios.post(url, payload, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error inviting user:", error);
    return null;
  }
};
 
// <-------------------------- Organization API Functions ------------------------------------>
 
// Used to fetch the Organization Details from the API
export const fetchOrganization = async (token: string, org_id: string) => {
  const url = `${NEXT_PUBLIC_API_URL}/organizations/${org_id}`;
 
  try {
    const response = await axios.get(url, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error fetching organization:", error);
    return null;
  }
};
 
// Used to Update the Organization Details from the API
export const updateOrganization = async (
  token: string,
  org_id: string,
  payload: any
) => {
  const url = `${NEXT_PUBLIC_API_URL}/organizations/${org_id}`;
 
  try {
    const response = await axios.put(url, payload, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
 
    return response.data;
  } catch (error) {
    console.error("Error updating organization:", error);
    return null;
  }
};
 
// <-------------------------- Autoresponder Mailbox API Functions -------------------------->
 
// Used to fetch Autoresponder Mailbox from the API Route
export const fetchAutoresponderMailbox = async () => {
  try {
    const response = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/autoresponder`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const mailboxData = await response.json();
    return mailboxData;
  } catch (error) {
    console.error("Error fetching Autoresponder Mailbox:", error);
    throw error;
  }
};
 
// Used to fetch a single Autoresponder Mailbox by ID from the API Route
export const fetchAutoresponderMailboxById = async (id: string) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder/${id}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const mailboxData = await response.json();
    return mailboxData;
  } catch (error) {
    console.error("Error fetching Autoresponder Mailbox by ID:", error);
    throw error;
  }
};
 
// Used to create/add Autoresponder Mailbox from the API Route
export const addAutoresponderMailbox = async (payload: any) => {
  try {
    const response = await fetch(`${NEXT_PUBLIC_BASE_PATH}/api/autoresponder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const mailboxData = await response.json();
    return mailboxData;
  } catch (error) {
    console.error("Error adding Autoresponder Mailbox:", error);
    throw error;
  }
};
 
// Used to update Autoresponder Mailbox from the API Route
export const updateAutoresponderMailbox = async (id: string, payload: any) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const mailboxData = await response.json();
    return mailboxData;
  } catch (error) {
    console.error("Error updating Autoresponder Mailbox:", error);
    throw error;
  }
};
 
// Used to delete Autoresponder Mailbox from the API Route
export const deleteAutoresponderMailbox = async (id: string) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder/${id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error deleting Autoresponder Mailbox:", error);
    throw error;
  }
};
 
// <-------------------------- Autoresponder Categories API Functions -------------------------->
 
// Used to fetch all Autoresponder Categories from the API Route
export const fetchAutoresponderCategories = async () => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const categoriesData = await response.json();
    return categoriesData;
  } catch (error) {
    console.error("Error fetching Autoresponder Categories:", error);
    throw error;
  }
};
 
// Used to fetch a single Autoresponder Category by ID
export const fetchAutoresponderCategoryById = async (id: string) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories/${id}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const categoryData = await response.json();
    return categoryData;
  } catch (error) {
    console.error("Error fetching Autoresponder Category by ID:", error);
    throw error;
  }
};
 
// Used to fetch categories by autoresponder ID
export const fetchCategoriesByAutoresponderID = async (
  autoresponderID: string
) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const allCategories = await response.json();
    // Filter by autoresponderID on the client side
    const filteredCategories = allCategories.filter(
      (category: any) => category.autoresponderID === autoresponderID
    );
 
    return filteredCategories;
  } catch (error) {
    console.error("Error fetching Categories by Autoresponder ID:", error);
    throw error;
  }
};
 
// Used to create/add Autoresponder Category from the API Route
export const addAutoresponderCategory = async (payload: any) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const categoryData = await response.json();
    return categoryData;
  } catch (error) {
    console.error("Error adding Autoresponder Category:", error);
    throw error;
  }
};
 
// Used to update Autoresponder Category from the API Route
export const updateAutoresponderCategory = async (id: string, payload: any) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories/${id}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const categoryData = await response.json();
    return categoryData;
  } catch (error) {
    console.error("Error updating Autoresponder Category:", error);
    throw error;
  }
};
 
// Used to delete Autoresponder Category from the API Route
export const deleteAutoresponderCategory = async (id: string) => {
  try {
    const response = await fetch(
      `${NEXT_PUBLIC_BASE_PATH}/api/autoresponder-categories/${id}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      }
    );
 
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
 
    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error deleting Autoresponder Category:", error);
    throw error;
  }
};
 
// <-------------------------- Chat History API Functions -------------------------------------->
 
// Save a chat message (creates chat if needed)
export async function saveChatMessage({
  user_id,
  chat_id,
  role,
  content,
  title,
  token,
}: {
  user_id: string;
  chat_id?: string;
  role: "user" | "assistant";
  content: string;
  title?: string;
  token: string;
}) {
  try {
    const response = await axios.post(
      `${NEXT_PUBLIC_API_URL}/chat/store`,
      { user_id, chat_id, role, content, title },
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Chat data saved:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error saving user chat:", error);
    return null;
  }
}
 
// Fetch all chats for a user
export async function getUserChats(user_id: string, token: string) {
  try {
    const response = await axios.get(`${NEXT_PUBLIC_API_URL}/chat/history`, {
      params: { user_id },
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("Chat data fetched:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching user chat:", error);
    return null;
  }
}
 
// Fetch a specific chat with messages by chat ID
export async function getChatById(
  user_id: string,
  chat_id: string,
  token: string
) {
  try {
    const response = await axios.get(
      `${NEXT_PUBLIC_API_URL}/chat/history/${chat_id}`,
      {
        params: { user_id },
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Chat data fetched:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error fetching chat messages by Id:", error);
    return null;
  }
}
 
// Update chat title
export async function updateChatTitle(
  user_id: string,
  chat_id: string,
  title: string,
  token: string
) {
  try {
    const response = await axios.put(
      `${NEXT_PUBLIC_API_URL}/chat/history/${chat_id}`,
      {
        params: { user_id, title },
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Chat Title Updated:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error updatin chat title:", error);
    return null;
  }
}
 
// Delete chat by ID (soft or hard delete)
export async function deleteChatById(
  user_id: string,
  chat_id: string,
  soft_delete: boolean,
  token: string
) {
  try {
    const response = await axios.delete(
      `${NEXT_PUBLIC_API_URL}/chat/history/${chat_id}`,
      {
        params: { user_id, soft_delete },
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );
    console.log("Chat Title Deleted:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error deleting chat by Id:", error);
    return null;
  }
}