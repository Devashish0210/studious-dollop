"use client";
import axios from "axios";
import { useChat } from "ai/react";
import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { InitialInput } from "./initial-input";
import { Messages } from "../components/messages/messages";
import { Header } from "./header";
import Cookies from "js-cookie";
import { AlertCircle } from "lucide-react";
import { BarLoader } from "react-spinners";
import APILogger from "./APILogger";
import { v4 as uuidv4 } from "uuid";
import DocumentsTab from "../documents/_components/DocumentsTab";
import LinkTabs from "../_components/link-tabs";
import { linkTabsData } from "../_components/link-tabs-data";
import { useRouter } from "next/navigation";

// ⭐ IMPORT REDUX
import { useSelector } from "react-redux";
import { RootState } from "@/redux-toolkit/store";

// Define types for better type safety
interface UserDetails {
  empID?: string;
  firstName?: string;
  email?: string;
  name?: string;
  [key: string]: any;
}

interface Ticket {
  ticketNo: string;
  category: string;
  createdOn: string;
  lastUpdatedOn: string;
  status: string;
}

export const Chat = () => {
  // ⭐ GET AUTH FROM REDUX STORE
  const router = useRouter();
  const employeeLoginState = useSelector(
    (state: RootState) => state.employeeLoginState
  );

  // ⭐ GET EMPLOYEE DETAILS (including name) FROM REDUX
  const employeeDetails = useSelector(
    (state: RootState) => state.employeeDetails
  );

  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [userGeography, setUserGeography] = useState("India");
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  const logger = new APILogger("https://ai.microland.com/logger");
  
  // State for IDs
  const [requestId, setRequestId] = useState<string | null>(null);
  // chatId: Unique ID for the current conversation (Resets on New Chat/Refresh)
  const [chatId, setChatId] = useState(""); 
  // userSessionId: Unique ID for the User's Login Session (Persists until logout)
  const [userSessionId, setUserSessionId] = useState("");

  // Ref to ensure we always access the latest requestId in callbacks/hooks
  const currentRequestIdRef = useRef<string | null>(null);

  const [leaveBalanceData, setLeaveBalanceData] = useState<any>(null);
  const [identifiedTool, setIdentifiedTool] = useState<string | null>(null);

  // ============== Ticket Pre-fetch State ==============
  const [ticketCache, setTicketCache] = useState<Ticket[] | null>(null);
  const [ticketCacheTimestamp, setTicketCacheTimestamp] = useState<number | null>(
    null
  );
  const [isTicketsPrefetching, setIsTicketsPrefetching] = useState(false);

  // ============== NDC Pre-fetch State ==============
  const [ndcCache, setNdcCache] = useState<any>(null);
  const [ndcCacheTimestamp, setNdcCacheTimestamp] = useState<number | null>(
    null
  );
  const [isNdcPrefetching, setIsNdcPrefetching] = useState(false);
  const [hasNdcFetched, setHasNdcFetched] = useState(false);

  // ============== Initialize IDs ==============
  useEffect(() => {
    // 1. Generate a fresh Conversation ID (Chat ID) on every mount/refresh
    setChatId(uuidv4());

    // 2. Manage Persistent User Session ID
    let storedSessionId = localStorage.getItem("user_session_id");
    if (!storedSessionId) {
      storedSessionId = uuidv4();
      localStorage.setItem("user_session_id", storedSessionId);
    }
    setUserSessionId(storedSessionId);
  }, []);

  // ⭐ SET USER DETAILS FROM REDUX
  useEffect(() => {
    // console.log("🔍 [REDUX DEBUG] Current employeeLoginState:", {
    //   empID: employeeLoginState?.empID,
    //   email: employeeLoginState?.email,
    //   hasOtp: !!employeeLoginState?.otp,
    //   timestamp: new Date().toISOString(),
    // });

    const geography = Cookies.get("selectedGeography");
    if (geography) {
      setUserGeography(geography);
    }

    // ⭐ EXTRACT NAME FROM employeeDetails REDUX SLICE
    const fullName = employeeDetails?.name || "";
    const firstName = fullName.split(" ")[0] || "";

    // ⭐ USE REDUX STATE FOR USER DETAILS
    if (employeeLoginState?.empID) {
      setUserDetails({
        empID: employeeLoginState.empID,
        email: employeeLoginState.email,
        name: fullName,
        firstName: firstName,
      });
      setIsAuthenticating(false);
    } else {
      setIsAuthenticating(false);
    }
  }, [employeeLoginState, employeeDetails]);

  // ============== Pre-fetch NDC Function ==============
  const prefetchNDC = useCallback(async () => {
    if (
      !employeeLoginState?.empID ||
      !employeeLoginState?.email ||
      !employeeLoginState?.otp
    ) {
      return;
    }

    setIsNdcPrefetching(true);
    try {
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/alumni/ndc-details`,
        {},
        {
          headers: {
            "X-EMAIL": employeeLoginState.email,
            "X-ALUMNIOTP": employeeLoginState.otp,
            "X-EMPID": employeeLoginState.empID,
          },
        }
      );

      const rawData = response.data;

      // ⭐ TRANSFORM: Convert flat structure to departments array
      const normalizeStatus = (status: string) => {
        return status === "Unknown" || status === "unknown"
          ? "Pending"
          : status;
      };

      const transformedData = {
        // Keep raw data for compatibility
        raw: rawData,

        // Create departments array for easy iteration
        departments: [
          {
            name: "RM",
            status: normalizeStatus(rawData.rm_ndc),
            comment: "",
          },
          {
            name: "Finance",
            status: normalizeStatus(rawData.finance_ndc),
            comment: "",
          },
          {
            name: "Admin",
            status: normalizeStatus(rawData.admin_ndc),
            comment: "",
            idCardReturned: rawData.admin_ndc_idcard || false,
          },
          {
            name: "CIS",
            status: normalizeStatus(rawData.cis_ndc),
            comment: rawData.cis_comment || "",
            assetReturned: rawData.cis_ndc_asset_returned || false,
          },
          {
            name: "HRSS",
            status: normalizeStatus(rawData.hrss_ndc),
            comment: "",
          },
          {
            name: "Payroll",
            status: normalizeStatus(rawData.payroll_ndc),
            comment: rawData.payroll_ndc_comment || "",
          },
        ],
      };

      setNdcCache(transformedData);
      setNdcCacheTimestamp(Date.now());
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          console.warn(
            "⚠️ NDC pre-fetch failed with status:",
            error.response.status
          );
        } else if (error.request) {
          console.error("❌ No response from server (NDC)");
        } else {
          console.error("❌ Request setup error (NDC):", error.message);
        }
      } else {
        console.error("❌ Pre-fetch NDC error:", error);
      }
    } finally {
      setIsNdcPrefetching(false);
    }
  }, [employeeLoginState]);

  // ============== Pre-fetch NDC on Mount ==============
  useEffect(() => {
    if (
      employeeLoginState?.empID &&
      employeeLoginState?.email &&
      employeeLoginState?.otp
    ) {
      prefetchNDC();
      setHasNdcFetched(true);

      // Refresh cache every 10 minutes (NDC status changes less frequently than tickets)
      const interval = setInterval(() => {
        prefetchNDC();
      }, 10 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [employeeLoginState, prefetchNDC]);

  // ============== Pre-fetch Tickets Function ==============
  const prefetchTickets = useCallback(async () => {
    if (
      !employeeLoginState?.empID ||
      !employeeLoginState?.email ||
      !employeeLoginState?.otp
    ) {
      return;
    }

    setIsTicketsPrefetching(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/alumni/tickets/get-tickets`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-EMAIL": employeeLoginState.email, // ⭐ FROM REDUX
            "X-ALUMNIOTP": employeeLoginState.otp, // ⭐ FROM REDUX
            "X-EMPID": employeeLoginState.empID, // ⭐ FROM REDUX
          },
          body: JSON.stringify({}),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const ticketList = data?.objTicketList || [];

        const formattedTickets: Ticket[] = ticketList.map((ticket: any) => ({
          ticketNo: ticket.ticketDisplayNo || "",
          category: ticket.classificationName || "",
          createdOn: ticket.createdOn || "",
          lastUpdatedOn: ticket.lastUpdatedOn || "",
          status: ticket.statusName || "",
        }));

        setTicketCache(formattedTickets);
        setTicketCacheTimestamp(Date.now());
      } else {
        console.warn("⚠️ Pre-fetch failed with status:", response.status);
      }
    } catch (error) {
      console.error("❌ Pre-fetch tickets error:", error);
    } finally {
      setIsTicketsPrefetching(false);
    }
  }, [employeeLoginState]);

  // ============== Pre-fetch on Mount ==============
  useEffect(() => {
    if (
      employeeLoginState?.empID &&
      employeeLoginState?.email &&
      employeeLoginState?.otp
    ) {
      prefetchTickets();

      // Refresh cache every 5 minutes
      const interval = setInterval(() => {
        prefetchTickets();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [employeeLoginState, prefetchTickets]);

  // ============== useChat Hook ==============
  const {
    messages: rawMessages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    setMessages,
    append,
  } = useChat({
    maxSteps: 10,
    api: "/api/chat",
    body: {
      // 🟢 MAPPING FIX: Pass Conversation ID as 'sessionId' for backend logging grouping
      sessionId: chatId, 
      // Pass the persistent user session separately if needed
      userSessionId: userSessionId,
      
      // Pass the generated Request ID for this specific turn
      requestId: requestId,
      
      geography: userGeography,
      ticketCache: ticketCache,
      ticketCacheTimestamp: ticketCacheTimestamp,
      ndcCache: ndcCache,
      ndcCacheTimestamp: ndcCacheTimestamp,
      empID: employeeLoginState?.empID,
      email: employeeLoginState?.email,
      otp: employeeLoginState?.otp,
      userDetails: userDetails,
    },

    onFinish: (message) => {
      // console.log("✅ [CHAT] Message finished:", {
      //   role: message.role,
      //   contentLength: message.content?.length,
      //   timestamp: new Date().toISOString(),
      // });

      // 🟢 ID SYNC: Update the Assistant message ID in the UI to match the Backend UUID
      // This ensures the "Like" button sends the same ID that is in the logs
      if (currentRequestIdRef.current) {
        setMessages((currentMessages) =>
          currentMessages.map((m) =>
            m.id === message.id ? { ...m, id: currentRequestIdRef.current! } : m
          )
        );
      }
    },

    onResponse: (response: any) => {
      // ============== CHECK FOR ERROR HEADERS ==============
      const errorOccurred = response.headers.get("X-Error-Occurred");
      const errorType = response.headers.get("X-Error-Type");
      const shouldRedirect = response.headers.get("X-Should-Redirect");

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      // Check for leave balance data in headers
      const leaveBalanceHeader = response.headers.get("X-Leave-Balance");
      if (leaveBalanceHeader) {
        try {
          const decodedData = atob(leaveBalanceHeader);
          const leaveData = JSON.parse(decodedData);
          setLeaveBalanceData(leaveData);
        } catch (e) {
          console.error("Error parsing leave balance data:", e);
        }
      }

      // Get identified tool from headers
      const identifiedToolHeader = response.headers.get("X-Identified-Tool");
      if (identifiedToolHeader) {
        setIdentifiedTool(identifiedToolHeader);
      }

      return response;
    },
    onError: async (error) => {
      console.error("❌ Chat error in useChat hook:", error);

      // ============== EXTRACT ERROR INFO FROM BACKEND ==============
      let errorMessage =
        "I encountered an unexpected error. Please try again or contact HR for assistance.";
      let shouldRedirect = false;
      let errorType = "UNKNOWN_ERROR";

      // Try to get the last response headers (they contain our error info)
      try {
        // The error message from backend is in error.message
        if (error.message && error.message.trim()) {
          errorMessage = error.message;
        }

        // Check error type from message content
        if (
          errorMessage.includes("session has expired") ||
          errorMessage.includes("Redirecting to login")
        ) {
          shouldRedirect = true;
          errorType = "AUTH_ERROR";
        } else if (errorMessage.includes("can't help with that request")) {
          errorType = "CONTENT_FILTER";
        } else if (
          errorMessage.includes("connectivity issues") ||
          errorMessage.includes("connection")
        ) {
          errorType = "NETWORK_ERROR";
        }
      } catch (e) {
        console.error("Error parsing error details:", e);
      }

      // console.log(`📋 Error type: ${errorType}, Message: ${errorMessage}`);

      // ============== MANUALLY ADD ASSISTANT MESSAGE ==============
      const errorAssistantMessage = {
        id: `error-${Date.now()}`,
        role: "assistant" as const,
        content: errorMessage,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, errorAssistantMessage]);

      // ============== HANDLE AUTH ERRORS - REDIRECT TO LOGIN ==============
      if (shouldRedirect && errorType === "AUTH_ERROR") {
        // console.log("🔐 Redirecting to login due to auth error...");

        // Give user 2 seconds to see the error message before redirect
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    },
  });

  // Filter out messages with empty content
  const messages = rawMessages.filter(
    (message) => message.content.trim() !== ""
  );

  // Clear Chat Logic
  const clearChat = () => {
    setMessages([]);
    setLeaveBalanceData(null);
    setIdentifiedTool(null);

    // 🟢 RE-GENERATE CONVERSATION ID (Reset Session)
    setChatId(uuidv4());
  };

  const customHandleSubmit = async () => {
    const newRequestId = uuidv4();
    setRequestId(newRequestId);
    currentRequestIdRef.current = newRequestId;
    
    // 🟢 PASS REQUEST ID IN BODY
    // @ts-ignore
    handleSubmit(undefined, { body: { requestId: newRequestId } });
  };

  const handleAddMessage = useCallback(
    (message: any) => {
      if (message.skipLLMProcessing) {
        // Static message - just add to array
        setMessages((prev) => [
          ...prev,
          {
            ...message,
            id: message.id || `msg-${Date.now()}`,
            createdAt: message.createdAt || new Date(),
          },
        ]);
      } else {
        // Normal message - trigger LLM
        const newRequestId = uuidv4();
        setRequestId(newRequestId);
        currentRequestIdRef.current = newRequestId;
        
        // 🟢 PASS REQUEST ID IN BODY
        // @ts-ignore
        append(message, { body: { requestId: newRequestId } });
      }
    },
    [append, setMessages]
  );

  const handleSuggestionSubmit = (suggestion: string) => {
    const syntheticEvent = {
      target: { value: suggestion },
    } as React.ChangeEvent<HTMLInputElement>;
    handleInputChange(syntheticEvent);
    setTimeout(async () => {
      const newRequestId = uuidv4();
      setRequestId(newRequestId);
      currentRequestIdRef.current = newRequestId;
      
      // 🟢 PASS REQUEST ID IN BODY
      // @ts-ignore
      handleSubmit(undefined, { body: { requestId: newRequestId } });
    }, 50);
  };

  // Show cache status in console (dev mode)
  useEffect(() => {
    if (ticketCache && ticketCache.length > 0) {
      const ageInSeconds = ticketCacheTimestamp
        ? Math.round((Date.now() - ticketCacheTimestamp) / 1000)
        : 0;
    }
  }, [ticketCache, ticketCacheTimestamp]);

  // ⭐ AUTH CHECK - Show error if not authenticated
  if (
    !isAuthenticating &&
    (!employeeLoginState?.empID ||
      !employeeLoginState?.email ||
      !employeeLoginState?.otp)
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-4">
            Please log in to access the chat assistant.
          </p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (isAuthenticating) {
    return (
      <div className="flex items-center justify-center h-screen">
        <BarLoader color="#3B82F6" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ⭐ Pass Conversation ID (chatId) to Header for Chat Feedback */}
      <Header onClearChat={clearChat} sessionId={chatId} />

      {/* Optional: Show cache indicator in dev mode */}
      {process.env.NODE_ENV === "development" &&
        ticketCache &&
        ticketCache.length > 0 && (
          <div className="bg-green-100 text-green-800 text-sm px-4 py-2 text-center">
            ✅ {ticketCache.length} tickets cached • Ready for instant display
          </div>
        )}
      {process.env.NODE_ENV === "development" && ndcCache && (
        <div
          style={{
            position: "fixed",
            bottom: "80px",
            left: "20px",
            padding: "8px 12px",
            backgroundColor: "#10b981",
            color: "white",
            borderRadius: "8px",
            fontSize: "12px",
            zIndex: 1000,
          }}
        >
          ✅ NDC cached •{ndcCache.departments?.length || 0} departments • Age:{" "}
          {ndcCacheTimestamp
            ? Math.round((Date.now() - ndcCacheTimestamp) / 1000)
            : 0}
          s
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {messages.length === 0 ? (
          <InitialInput
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={customHandleSubmit}
            isLoading={isLoading}
            handleSuggestionSubmit={handleSuggestionSubmit}
          />
        ) : (
          <Messages
            messages={messages}
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={customHandleSubmit}
            isLoading={isLoading}
            requestId={requestId}
            // ⭐ Pass Conversation ID (chatId) so Feedback buttons use the same ID as backend logs
            sessionId={chatId}
            leaveBalanceData={leaveBalanceData}
            identifiedTool={identifiedTool}
            clearChat={clearChat}
            ticketCache={ticketCache}
            ticketCacheTimestamp={ticketCacheTimestamp}
            append={handleAddMessage}
          />
        )}
      </div>
    </div>
  );
};

export default Chat;