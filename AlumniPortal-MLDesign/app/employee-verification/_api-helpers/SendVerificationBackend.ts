import { toast } from "react-toastify";
import axios from "axios";
// import "reactjs-popup/dist/index.css";
//@ts-ignore
import Cookies from "js-cookie";
import logout from "./Logout";
import { clientLogger } from "@/lib/client-logger";

("./Logout");
const sendVerificationToBackend = async (
  email: string,
  otp: string,
  employeeNumber: string,
  lastWorkingDay: string,
  dob: string,
  dispatch: any
) => {
  try {
    const response = await axios.post(
      `${process.env.NEXT_PUBLIC_BGV_REQUEST_ENDPOINT}`,
      {
        employee_id: employeeNumber,
        last_working_day: lastWorkingDay,
        dob: dob,
      },

      {
        headers: {
          "content-type": "application/json",
          "X-EMAIL": email,
          "X-OTP": otp,
        },
        validateStatus: function (status) {
          return (
            (status >= 200 && status < 300) ||
            status === 404 ||
            status === 418 ||
            status === 403
          );
        },
      }
    );
    
    if (response.status === 403) {
      clientLogger.error("BGV_Backend_AuthFail", "SendVerificationBackend.ts", new Error(`403 Forbidden for ${email}`));
      logout(dispatch);
      return response;
    }
    return response;
  } catch (err) {
    clientLogger.error("BGV_Backend_Exception", "SendVerificationBackend.ts", err);

    if (axios.isAxiosError(err)) {
      if (err.response && err.response.status === 403) {
        logout(dispatch);
      } else {
        console.log(err);
      }
    } else {
      console.log(err);
    }
    return { status: 500 };
  }
};

export default sendVerificationToBackend;