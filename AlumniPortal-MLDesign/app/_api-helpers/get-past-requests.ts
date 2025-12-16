import { toast } from "react-toastify";
import { clientLogger } from "@/lib/client-logger";

const sendGetRequestToBackend = async (email: string, otp: string) => {
    const url = process.env.NEXT_PUBLIC_BACKEND_BASE_URL+"/get_past_requests";

    // Define headers for the GET request
    const headers = new Headers();
    headers.append("X-EMAIL", email);
    headers.append("X-OTP", otp);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: headers,
        });

        if (response.ok) {
            const responseBody = await response.json();
            return responseBody;
        } else {
            clientLogger.error(`PastReq_Fetch_Fail_${response.status}`, "get-past-requests.ts", new Error(response.statusText));
            toast.error("Error in GET request:", { autoClose: 1500 });
        }
    } catch (error) {
        clientLogger.error("PastReq_Fetch_Exception", "get-past-requests.ts", error);
        console.error("Error during GET request:", error);
    }
};
export default sendGetRequestToBackend;