import axios from "axios";
import { clientLogger } from "@/lib/client-logger";

const validateQR = async (email: string, uri: string) => {
    try {
        const response = await axios.post(`${process.env.NEXT_PUBLIC_BACKEND_BASE_URL}/qrverify`, {
            "uri": uri,
            "email": email
        });
        if (response.status === 200) {
            return true
        }
        else {
            clientLogger.info(`QR_Validate_Fail_${response.status}`, "validate-qr.ts");
            return false
        }
    } catch (err) {
        clientLogger.error("QR_Validate_Exception", "validate-qr.ts", err);
        return false;
    }
};
export default validateQR;