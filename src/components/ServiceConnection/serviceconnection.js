import axios from "axios";
import { retrieveData } from "../LocalConnection/LocalConnection.js";
let APL_LINK = "http://192.168.1.9/wowreviews_final/";
APL_LINK = "https://www.superpanel.wowreviews.co/";

const bulk_upload_menu = local_server_link_react_aireport + "bulk_upload_menu";
const login_user_email = local_server_link_react_aireport + "login_user_email";
//==================Menu

/* New Python APIS  */
const server_post_data = async (url_for, Data) => {
  try {
    if (Data === null) {
      Data = new FormData();
    }

    let customer_id = retrieveData("customer_id");
    let final_bus_id = retrieveData("final_bus_id");
    let counter_bus_id = retrieveData("counter_bus_id");
    let access_token = retrieveData("access_token");
    Data.append("key_secret", "wowreviews_key@2022");
    Data.append("admin_web_app", "manager");
    Data.append("final_buu_id", customer_id);
    Data.append("final_bus_id", final_bus_id);
    Data.append("counter_bus_id", counter_bus_id);
    const response = await axios.post(url_for, Data, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(access_token &&
          access_token !== "1" &&
          url_for !== login_user_email && {
            Authorization: `Bearer ${access_token}`,
          }),
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export { APL_LINK, bulk_upload_menu, server_post_data };
