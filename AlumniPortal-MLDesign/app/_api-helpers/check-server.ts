import axios from "axios";

const checkServerStatus = async () => {
    try {
        const response = await axios.get(process.env.NEXT_PUBLIC_BACKEND_BASE_URL + "/alumni/sys-verify");
        if (response.status === 200) {
            return true;
        }
        else {
            return false
        }
    } catch (error) {
        // Handle error communicating with the server for sending the email
        console.error("Error sending email to server:", error);
        return false;
    }
};

export default checkServerStatus;
