import axios from "axios";
import { InitialState } from "@/redux-toolkit/features/employee-login-state";
import handleLogout from "./LogOut";
import { AppDispatch } from "@/redux-toolkit/store";
import { clientLogger } from "@/lib/client-logger";

const getEmployeeDetails = async (employeeLoginState: InitialState, dispatch: AppDispatch, router: any) => {
    try {
        const response = await axios.post(process.env.NEXT_PUBLIC_BACKEND_BASE_URL + "/alumni/emp-details", {}, {
            headers: {
                'X-EMAIL': employeeLoginState.email,
                'X-ALUMNIOTP': employeeLoginState.otp,
                'X-EMPID': employeeLoginState.empID
            }
        });
        
        if (response.status === 403) {
            clientLogger.error("EmpDetails_Auth_403", "emp-details.ts");
            handleLogout(dispatch, router)
            return { "doj": "", "lwd": "", "name": "", "title": "", "empID": "" }
        }
        return response.data;
    } catch (err) {
        clientLogger.error("EmpDetails_Fetch_Exception", "emp-details.ts", err);
        
        if (axios.isAxiosError(err)) {
            if (err.response && err.response.status === 403) {
                handleLogout(dispatch, router)
            }
        }
        return { "doj": "", "lwd": "", "name": "", "title": "", "empID": "" };
    }
};

export default getEmployeeDetails;