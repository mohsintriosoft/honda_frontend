import axios from "axios";
import { retrieveData } from "../LocalConnection/LocalConnection.js";

/* =========================================================
   BASE URL
========================================================= */

let APL_LINK = "http://192.168.1.9/wowreviews_final/";
APL_LINK = "http://localhost:8000/";

/* =========================================================
   API ENDPOINTS
========================================================= */

const bulk_upload_menu = APL_LINK + "bulk_upload_menu";
const login_user_email = APL_LINK + "login_user_email";

const get_segments = APL_LINK + "api/segments/";
const get_llm_settings = APL_LINK + "api/llm-settings/";
const get_tts_voices = APL_LINK + "api/tts-voices/";
const update_llm_setting = APL_LINK + "api/tts-voices/";

/* =========================================================
   COMMON CONFIG
========================================================= */

const KEY_SECRET = "wowreviews_key@2022";
const ADMIN_WEB_APP = "manager";

/* =========================================================
   GET ACCESS TOKEN
========================================================= */

const getAccessToken = () => {
  try {
    return retrieveData("access_token");
  } catch (error) {
    console.error("Unable to retrieve access token:", error);
    return null;
  }
};

/* =========================================================
   GET COMMON DATA
========================================================= */

const getCommonData = () => {
  let customer_id = "";
  let final_bus_id = "";
  let counter_bus_id = "";

  try {
    customer_id = retrieveData("customer_id") || "";
    final_bus_id = retrieveData("final_bus_id") || "";
    counter_bus_id = retrieveData("counter_bus_id") || "";
  } catch (error) {
    console.error("Unable to retrieve local data:", error);
  }

  return {
    customer_id,
    final_bus_id,
    counter_bus_id,
  };
};

/* =========================================================
   CHECK FORM DATA
========================================================= */

const isFormData = (data) => {
  return typeof FormData !== "undefined" && data instanceof FormData;
};

/* =========================================================
   APPEND COMMON DATA TO FORM DATA
========================================================= */

const appendCommonFormData = (formData) => {
  const { customer_id, final_bus_id, counter_bus_id } = getCommonData();

  // Only append if not already present
  if (!formData.has("key_secret")) {
    formData.append("key_secret", KEY_SECRET);
  }

  if (!formData.has("admin_web_app")) {
    formData.append("admin_web_app", ADMIN_WEB_APP);
  }

  if (!formData.has("final_buu_id")) {
    formData.append("final_buu_id", customer_id);
  }

  if (!formData.has("final_bus_id")) {
    formData.append("final_bus_id", final_bus_id);
  }

  if (!formData.has("counter_bus_id")) {
    formData.append("counter_bus_id", counter_bus_id);
  }

  return formData;
};

/* =========================================================
   GET AUTH HEADERS
========================================================= */

const getAuthHeaders = (url_for) => {
  const access_token = getAccessToken();

  const headers = {};

  if (access_token && access_token !== "1" && url_for !== login_user_email) {
    headers.Authorization = `Bearer ${access_token}`;
  }

  return headers;
};

/* =========================================================
   GET REQUEST CONFIG
========================================================= */

const getRequestConfig = (url_for, extraConfig = {}) => {
  return {
    ...extraConfig,
    headers: {
      ...getAuthHeaders(url_for),
      ...(extraConfig.headers || {}),
    },
  };
};

/* =========================================================
   CREATE FORM DATA
========================================================= */

const createFormData = (data = {}) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    // Array support
    if (Array.isArray(value)) {
      value.forEach((item) => {
        formData.append(`${key}[]`, item);
      });

      return;
    }

    // File / Blob / string / number / boolean
    formData.append(key, value);
  });

  return appendCommonFormData(formData);
};

/* =========================================================
   GET
========================================================= */

const server_get_data = async (url_for, params = {}, config = {}) => {
  try {
    const response = await axios.get(
      url_for,
      getRequestConfig(url_for, {
        ...config,
        params,
      }),
    );

    return response.data;
  } catch (error) {
    console.error("GET API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   POST
   Default: FormData
========================================================= */

const server_post_data = async (url_for, Data = null, config = {}) => {
  try {
    if (Data === null || Data === undefined) {
      Data = new FormData();
    }

    // If plain object -> convert to FormData
    if (!isFormData(Data)) {
      Data = createFormData(Data);
    } else {
      Data = appendCommonFormData(Data);
    }

    const response = await axios.post(
      url_for,
      Data,
      getRequestConfig(url_for, {
        ...config,
        headers: {
          ...config.headers,
          // Do NOT manually set multipart boundary.
          // Axios/browser will set correct Content-Type.
        },
      }),
    );

    return response.data;
  } catch (error) {
    console.error("POST API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   POST JSON
========================================================= */

const server_post_json = async (url_for, Data = {}, config = {}) => {
  try {
    const commonData = getCommonData();

    const finalData = {
      ...Data,
      key_secret: Data.key_secret ?? KEY_SECRET,
      admin_web_app: Data.admin_web_app ?? ADMIN_WEB_APP,
      final_buu_id: Data.final_buu_id ?? commonData.customer_id,
      final_bus_id: Data.final_bus_id ?? commonData.final_bus_id,
      counter_bus_id: Data.counter_bus_id ?? commonData.counter_bus_id,
    };

    const response = await axios.post(
      url_for,
      finalData,
      getRequestConfig(url_for, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
      }),
    );

    return response.data;
  } catch (error) {
    console.error("POST JSON API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   PUT
   Default: JSON
========================================================= */

const server_put_data = async (url_for, Data = {}, config = {}) => {
  try {
    const response = await axios.put(
      url_for,
      Data,
      getRequestConfig(url_for, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
      }),
    );

    return response.data;
  } catch (error) {
    console.error("PUT API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   PUT FORM DATA
========================================================= */

const server_put_form_data = async (url_for, Data = null, config = {}) => {
  try {
    if (Data === null || Data === undefined) {
      Data = new FormData();
    }

    if (!isFormData(Data)) {
      Data = createFormData(Data);
    } else {
      Data = appendCommonFormData(Data);
    }

    const response = await axios.put(url_for, Data, getRequestConfig(url_for, config));

    return response.data;
  } catch (error) {
    console.error("PUT FormData API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   PATCH
========================================================= */

const server_patch_data = async (url_for, Data = {}, config = {}) => {
  try {
    const response = await axios.patch(
      url_for,
      Data,
      getRequestConfig(url_for, {
        ...config,
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {}),
        },
      }),
    );

    return response.data;
  } catch (error) {
    console.error("PATCH API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   PATCH FORM DATA
========================================================= */

const server_patch_form_data = async (url_for, Data = null, config = {}) => {
  try {
    if (Data === null || Data === undefined) {
      Data = new FormData();
    }

    if (!isFormData(Data)) {
      Data = createFormData(Data);
    } else {
      Data = appendCommonFormData(Data);
    }

    const response = await axios.patch(url_for, Data, getRequestConfig(url_for, config));

    return response.data;
  } catch (error) {
    console.error("PATCH FormData API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   DELETE
========================================================= */

const server_delete_data = async (url_for, Data = {}, config = {}) => {
  try {
    const finalConfig = getRequestConfig(url_for, {
      ...config,
    });

    /*
      Axios DELETE body goes inside config.data
    */

    if (Data && Object.keys(Data).length > 0) {
      finalConfig.data = Data;
    }

    const response = await axios.delete(url_for, finalConfig);

    return response.data;
  } catch (error) {
    console.error("DELETE API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   DELETE FORM DATA
========================================================= */

const server_delete_form_data = async (url_for, Data = null, config = {}) => {
  try {
    if (Data === null || Data === undefined) {
      Data = new FormData();
    }

    if (!isFormData(Data)) {
      Data = createFormData(Data);
    } else {
      Data = appendCommonFormData(Data);
    }

    const finalConfig = getRequestConfig(url_for, {
      ...config,
    });

    finalConfig.data = Data;

    const response = await axios.delete(url_for, finalConfig);

    return response.data;
  } catch (error) {
    console.error("DELETE FormData API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   HEAD
========================================================= */

const server_head_data = async (url_for, config = {}) => {
  try {
    const response = await axios.head(url_for, getRequestConfig(url_for, config));

    return response;
  } catch (error) {
    console.error("HEAD API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   OPTIONS
========================================================= */

const server_options_data = async (url_for, config = {}) => {
  try {
    const response = await axios.options(url_for, getRequestConfig(url_for, config));

    return response.data;
  } catch (error) {
    console.error("OPTIONS API Error:", url_for, error);
    throw error;
  }
};

/* =========================================================
   GENERIC REQUEST
   Supports:
   GET
   POST
   PUT
   PATCH
   DELETE
   HEAD
   OPTIONS
========================================================= */

const server_request = async ({
  method = "GET",
  url,
  data = null,
  params = {},
  headers = {},
  config = {},
  useFormData = false,
}) => {
  try {
    if (!url) {
      throw new Error("API URL is required");
    }

    let finalData = data;

    /* ---------------------------------------------
       FormData handling
    --------------------------------------------- */

    if (
      useFormData &&
      method.toUpperCase() !== "GET" &&
      method.toUpperCase() !== "HEAD" &&
      method.toUpperCase() !== "OPTIONS"
    ) {
      if (!isFormData(finalData)) {
        finalData = createFormData(finalData || {});
      } else {
        finalData = appendCommonFormData(finalData);
      }
    }

    /* ---------------------------------------------
       Axios Config
    --------------------------------------------- */

    const finalConfig = {
      ...config,
      method: method.toUpperCase(),
      url,
      params,
      data: finalData,
      headers: {
        ...getAuthHeaders(url),
        ...headers,
        ...(config.headers || {}),
      },
    };

    const response = await axios(finalConfig);

    return response.data;
  } catch (error) {
    console.error(`${method.toUpperCase()} API Error:`, url, error);

    throw error;
  }
};

/* =========================================================
   FILE UPLOAD
========================================================= */

const server_upload_file = async (
  url_for,
  file,
  fieldName = "file",
  extraData = {},
  config = {},
) => {
  try {
    const formData = new FormData();

    formData.append(fieldName, file);

    Object.entries(extraData).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }

      formData.append(key, value);
    });

    appendCommonFormData(formData);

    const response = await axios.post(url_for, formData, getRequestConfig(url_for, config));

    return response.data;
  } catch (error) {
    console.error("FILE UPLOAD API Error:", url_for, error);

    throw error;
  }
};

/* =========================================================
   DOWNLOAD FILE / BLOB
========================================================= */

const server_download_file = async (url_for, params = {}, config = {}) => {
  try {
    const response = await axios.get(
      url_for,
      getRequestConfig(url_for, {
        ...config,
        params,
        responseType: "blob",
      }),
    );

    return response;
  } catch (error) {
    console.error("DOWNLOAD FILE API Error:", url_for, error);

    throw error;
  }
};

/* =========================================================
   RAW AXIOS INSTANCE
========================================================= */

const apiClient = axios.create({
  baseURL: APL_LINK,
  timeout: 30000,
});

/* =========================================================
   AXIOS REQUEST INTERCEPTOR
========================================================= */

apiClient.interceptors.request.use(
  (config) => {
    try {
      const access_token = getAccessToken();

      if (access_token && access_token !== "1" && config.url !== login_user_email) {
        config.headers.Authorization = `Bearer ${access_token}`;
      }

      return config;
    } catch (error) {
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  },
);

/* =========================================================
   AXIOS RESPONSE INTERCEPTOR
========================================================= */

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    /*
      Central error handling
    */

    if (error.response) {
      console.error("API Status:", error.response.status);

      console.error("API Response:", error.response.data);

      /*
      Example:

      if (error.response.status === 401) {
        // logout user
      }
      */
    } else if (error.request) {
      console.error("No response received from server");
    } else {
      console.error("Axios Error:", error.message);
    }

    return Promise.reject(error);
  },
);

/* =========================================================
   EXPORT
========================================================= */

export {
  APL_LINK,
  // API URLs
  bulk_upload_menu,
  login_user_email,
  get_segments,
  get_llm_settings,
  get_tts_voices,
  update_llm_setting,
  // Basic Methods
  server_get_data,
  server_post_data,
  server_post_json,
  server_put_data,
  server_put_form_data,
  server_patch_data,
  server_patch_form_data,
  server_delete_data,
  server_delete_form_data,
  server_head_data,
  server_options_data,
  // Generic Method
  server_request,
  // File Methods
  server_upload_file,
  server_download_file,

  // Axios Instance
  apiClient,
};
