import axios from "axios";
import { InitialState } from "@/redux-toolkit/features/employee-login-state";
import { InitialStateData as TicketStatusInitialStatus } from "@/redux-toolkit/features/ticket-status";
import handleLogout from '../../_api-helpers/LogOut'
import { AppDispatch } from "@/redux-toolkit/store";
import JSZip from "jszip";
import { clientLogger } from "@/lib/client-logger";

type CreateTicket = {
  "ticket_category": string,
  "ticketTitle": string,
  "ticketDetails": string,
  "mobile": string,
  "attachment_filename": string,
  "attachment": string
}

type CreateTicket2 = {
  "ticket_category": string,
  "ticketTitle": string,
  "ticketDetails": string,
  "mobile": string
}

// ✅ NEW: Add response type
type CreateTicketResponse = {
  success: boolean;
  ticket_no?: string;
  attachment_added?: boolean;
  error_message?: string;
}

// ✅ NEW: Helper function to create ZIP from multiple files
const createZipFromFiles = async (files: File[]): Promise<string> => {
  const zip = new JSZip();
  
  // Add each file to the ZIP
  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    zip.file(file.name, arrayBuffer);
  }
  
  // Generate ZIP as base64
  const zipBlob = await zip.generateAsync({ type: "blob" });
  
  // Convert blob to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split("base64,")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(zipBlob);
  });
};

// ✅ MODIFIED: Change return type from boolean to CreateTicketResponse
const createTickets = async (
  data: CreateTicket | CreateTicket2, 
  employeeLoginState: InitialState, 
  dispatch: AppDispatch, 
  router: any,
  files?: File[]
): Promise<CreateTicketResponse> => {
  try {
    // ✅ NEW: If multiple files provided, zip them
    if (files && files.length > 1) {
      const zipBase64 = await createZipFromFiles(files);
      (data as CreateTicket).attachment = zipBase64;
      (data as CreateTicket).attachment_filename = "attachments.zip";
    }

    const response = await axios.post(
      process.env.NEXT_PUBLIC_BACKEND_BASE_URL + "/alumni/tickets/create-tickets", 
      data, 
      {
        headers: {
          'X-EMAIL': employeeLoginState.email,
          'X-ALUMNIOTP': employeeLoginState.otp,
          'X-EMPID': employeeLoginState.empID
        }
      }
    );

    if (response.status === 403) {
      clientLogger.error("Ticket_Create_AuthFail", "create-ticket.tsx", new Error("403 Forbidden"));
      handleLogout(dispatch, router);
      return { success: false, error_message: "Authentication failed" };
    }

    if (response.status < 200 || response.status >= 300) {
      clientLogger.error(`Ticket_Create_Fail_${response.status}`, "create-ticket.tsx", new Error(response.statusText));
      return { success: false, error_message: "Request failed" };
    }

    // ✅ MODIFIED: Return full response with ticket number
    return {
      success: true,
      ticket_no: response.data.ticket_no,
      attachment_added: response.data.attachment_added,
      error_message: response.data.error_message
    };

  } catch (err) {
    // Log the exception to Azure via proxy
    clientLogger.error("Ticket_Create_Exception", "create-ticket.tsx", err);

    if (axios.isAxiosError(err)) {
      if (err.response && err.response.status === 403) {
        handleLogout(dispatch, router);
      } else {
        console.error("Error creating ticket:", err);
      }
    } else {
      console.error("Error creating ticket:", err);
    }
    return { success: false, error_message: "An error occurred" };
  }
};

export default createTickets;