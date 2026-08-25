import axios from "axios";
import { retrieveData } from "../LocalConnection/LocalConnection.js";
let APL_LINK = "http://192.168.1.9/wowreviews_final/";
APL_LINK = "http://localhost:8000/";

const bulk_upload_menu = APL_LINK + "bulk_upload_menu";
const login_user_email = APL_LINK + "login_user_email";
const get_segments = APL_LINK + "api/segments/";
const get_llm_settings = APL_LINK + "api/llm-settings/";
const get_tts_voices = APL_LINK + "api/tts-voices/";
const update_llm_setting = APL_LINK + "api/tts-voices/";

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

export {
  APL_LINK,
  bulk_upload_menu,
  server_post_data,
  get_segments,
  get_llm_settings,
  update_llm_setting,
  get_tts_voices,
};
