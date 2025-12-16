import axios from "axios";
import { clientLogger } from "@/lib/client-logger";

const handleVerifyCaptcha = async (value: string | null) => {
    try {
        // Send reCAPTCHA response to the server for verification
        const response = await axios.post(process.env.NEXT_PUBLIC_BACKEND_BASE_URL + "/verify", {
            recaptchaValue: value,
        });
        if (response.status === 201) {
            return true
        }
        else {
            clientLogger.error(`Recaptcha_Fail_${response.status}`, "recaptcha-api.ts");
            return false
        }
    } catch (error) {
        clientLogger.error("Recaptcha_Exception", "recaptcha-api.ts", error);
        return false
    }
};

export default handleVerifyCaptcha;