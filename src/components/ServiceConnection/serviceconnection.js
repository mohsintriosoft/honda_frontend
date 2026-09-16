import axios from "axios";
import { retrieveData } from "../LocalConnection/LocalConnection.js";

/* =========================================================
   BASE URL
========================================================= */

let APL_LINK = "https://omhonda.triosoft.ai/";
// APL_LINK = "http://localhost:8000/";

const AUDIO_BASE_URL = "/media/call_recordings/";

/* =========================================================
   API ENDPOINTS
========================================================= */

const bulk_upload_menu = APL_LINK + "bulk_upload_menu";
const login_user_email = APL_LINK + "login_user_email";

const get_segments = APL_LINK + "api/segments/";
// 🔥 DYNAMIC CONVERSATION FLOW — opening_line/closing_line now live on
// Segment, not LLMSetting (docs: segments can each say something different,
// e.g. Missed Service vs FREE 01, even though they share one Agent). Agent
// detail pages PATCH these directly instead of going through llm-settings.
const get_segment_detail = (segmentId) => `${APL_LINK}api/segments/${segmentId}/`;
const patch_segment = (segmentId) => `${APL_LINK}api/segments/${segmentId}/`;
// Customers actually queued for a segment right now (reads CsvSegmentData
// server-side) -- powers the "Customers in this segment" table on the
// segment detail page. Paginated the same way get_customers is.
const get_segment_customers = (segmentId, page = 1, pageSize = 20) =>
  `${APL_LINK}api/segments/${segmentId}/customers/?page=${page}&page_size=${pageSize}`;
const get_llm_settings = APL_LINK + "api/llm-settings/";
const get_tts_voices = APL_LINK + "api/tts-voices/";
// BUGFIX: this was pointing at api/tts-voices/, which meant any caller
// using this constant to save an agent would silently hit the wrong
// endpoint. Kept for backwards compatibility with any existing callers;
// new code should just use get_llm_settings + `${agentId}/` directly,
// same as _app_agents__agentId.tsx already does.
const update_llm_setting = APL_LINK + "api/llm-settings/";

// Read-only knowledge-via-segments view for a single agent (docs §9.9 / §19.5).
// Agent detail pages must use this instead of the general kb/documents
// endpoints, which are editable and gated by can_edit_knowledge.
const get_agent_knowledge = (agentId) => `${APL_LINK}api/agents/${agentId}/knowledge/`;

const get_recordings = APL_LINK + "api/recordings/";
const get_recording_detail = (id) => `${APL_LINK}api/recordings/${id}/`;
const patch_recording = (id) => `${APL_LINK}api/recordings/${id}/`;
// 🔥 NEW — Voice index page (Live tab). Reuses api/recordings/ (same
// CallSession rows the Completed tab reads) with a comma-separated
// status filter (backend change in views_admin.recordings), so "still on
// the phone" calls (initiated/ringing/ongoing) come back in one poll
// instead of one request per status. Pass to get_recordings via
// server_get_data(get_recordings, { status: LIVE_CALL_STATUSES, page_size }).
const LIVE_CALL_STATUSES = "initiated,ringing,ongoing";

// 🔥 NEW — Quick Call (test page) endpoints, reused by the Voice index
// page's "Add / Call customer" dialog so it saves + dials the exact same
// way quick_call.html does.
const get_quick_call_meta = APL_LINK + "api/quick-call/meta/";
const post_quick_call_save = APL_LINK + "api/quick-call/save/";
const get_quick_call_list = APL_LINK + "api/quick-call/list/";
const get_quick_call_status = (sessionId) =>
  `${APL_LINK}api/quick-call/status/?session_id=${sessionId}`;
// Places the outbound call itself (Plivo). NOTE: param names below are
// inferred from quick_call_save's shape (phone_number/dealer_id/branch_id)
// — views_voice.plivo_call() wasn't in the files I read, so double check
// its expected body against quick_call.html before wiring this up.
const post_plivo_call = APL_LINK + "api/voice/plivo/call/";
const get_customers = APL_LINK + "api/customers/";
// Customer 360 detail page (_app_customers__id.tsx).
const get_customer_detail = (customerId) => `${APL_LINK}api/customers/${customerId}/`;
const get_call_tasks = APL_LINK + "api/call-tasks/";

const get_dealers = APL_LINK + "api/dealers/";
const get_branches = APL_LINK + "api/branches/";
const get_branch_detail = (id) => `${APL_LINK}api/branches/${id}/`;
const patch_branch = (id) => `${APL_LINK}api/branches/${id}/`;

// Appointments / calendar — branch-driven (timing, slot length, and
// capacity all come from the Branch row itself, see docs). `range` is
// 'week' | '15day' | 'month'; `start` moves the window back/forward for
// the prev/next control.
const get_branch_calendar = (branchId, start, range = "week") =>
  `${APL_LINK}api/branches/${branchId}/calendar/?start=${start}&range=${range}`;
const post_manual_slot = (branchId) => `${APL_LINK}api/branches/${branchId}/manual-slot/`;
const get_slot_blocks = (branchId, date) =>
  `${APL_LINK}api/branches/${branchId}/slot-blocks/${date ? `?date=${date}` : ""}`;
const post_slot_block = (branchId) => `${APL_LINK}api/branches/${branchId}/slot-blocks/`;
const delete_slot_block = (id) => `${APL_LINK}api/slot-blocks/${id}/`;
const get_appointments = APL_LINK + "api/appointments/";

// Callback Requests — customer/team callback scheduling (docs §8.5). List
// is filterable (branch_id/callback_type/status/department/start/end);
// detail is PATCH (status/staffNotes/staffId) or DELETE (soft-delete) only
// -- rows are created from the live call, never from this dashboard.
const get_callbacks = APL_LINK + "api/callbacks/";
const patch_callback = (id) => `${APL_LINK}api/callbacks/${id}/`;
const delete_callback = (id) => `${APL_LINK}api/callbacks/${id}/`;
const get_booking_availability = APL_LINK + "api/crm/booking-availability/";
const post_create_booking = APL_LINK + "api/crm/booking/create/";
const post_cancel_booking = APL_LINK + "api/crm/booking/cancel/";
const get_kb_documents = APL_LINK + "api/kb/documents/";
const kb_store_url = APL_LINK + "api/kb/store/";
const kb_document_update_url = (docId) => `${APL_LINK}api/kb/documents/${docId}/update/`;
const kb_document_delete_url = (docId) => `${APL_LINK}api/kb/documents/${docId}/`;

// Campaigns — list/detail/toggle ONLY, no create endpoint. Campaigns are
// permanent, 1:1 with a Segment, and seeded once at setup (docs §11);
// there is no "New campaign" flow to wire up here.
const get_campaigns = APL_LINK + "api/campaigns/";
const get_campaign_detail = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/`;
const patch_campaign = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/`;
const campaign_pause = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/pause/`;
const campaign_pause_clear = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/pause-clear/`;
const campaign_resume = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/resume/`;
const get_campaign_batches = (campaignId) => `${APL_LINK}api/campaigns/${campaignId}/batches/`;

// Intent Accuracy — kept as two endpoints on purpose: the index page only
// ever calls get_intents (a cheap per-intent rollup), never get_intent_turns.
// get_intent_turns is only hit once a card is opened (the /intents/:code page).
const get_intents = APL_LINK + "api/intents/";
const get_intent_summary = (code) => `${APL_LINK}api/intents/?code=${code}`;
const get_intent_turns = (code) => `${APL_LINK}api/intents/${code}/turns/`;

// Fillers — separate page/section from Intent accuracy above. Index card
// grid (state_count/filler_count per intent) + per-intent state/filler
// detail (GET, and POST to add a new filler line), plus one-row PATCH/
// DELETE for editing or removing a single filler.
const get_intent_fillers_summary = APL_LINK + "api/intents/fillers/";
const get_intent_fillers_detail = (code) => `${APL_LINK}api/intents/${code}/fillers/`;
const post_intent_filler = (code) => `${APL_LINK}api/intents/${code}/fillers/`;
const patch_filler = (id) => `${APL_LINK}api/fillers/${id}/`;
const delete_filler = (id) => `${APL_LINK}api/fillers/${id}/`;

// Data Import (docs §7 / Module 3, §19.9). GET on get_imports lists upload
// history; POST (via server_upload_file) on the same URL registers + parses
// a new file. Everything under {id}/ operates on one CsvStats row.
// commit/revert are POSTs with no body — the pk in the URL is enough.
const get_imports = APL_LINK + "api/imports/";
const post_import_upload = APL_LINK + "api/imports/";
const get_import_detail = (id) => `${APL_LINK}api/imports/${id}/`;
const get_import_preview = (id) => `${APL_LINK}api/imports/${id}/preview/`;
const post_import_commit = (id) => `${APL_LINK}api/imports/${id}/commit/`;
const post_import_revert = (id) => `${APL_LINK}api/imports/${id}/revert/`;
const get_import_errors = (id) => `${APL_LINK}api/imports/${id}/errors/`;
const get_import_unmatched = (id) => `${APL_LINK}api/imports/${id}/unmatched/`;
const post_import_assign_segment = (id) => `${APL_LINK}api/imports/${id}/assign-segment/`;
const get_import_rows = (id) => `${APL_LINK}api/imports/${id}/rows/`;



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

    if (Array.isArray(value)) {
      value.forEach((item) => {
        formData.append(`${key}[]`, item);
      });

      return;
    }

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
========================================================= */

const server_post_data = async (url_for, Data = null, config = {}) => {
  try {
    if (Data === null || Data === undefined) {
      Data = new FormData();
    }

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

apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      console.error("API Status:", error.response.status);
      console.error("API Response:", error.response.data);
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
  AUDIO_BASE_URL,
  // API URLs
  bulk_upload_menu,
  login_user_email,
  get_segments,
  get_segment_detail,
  patch_segment,
  get_segment_customers,
  get_llm_settings,
  get_tts_voices,
  update_llm_setting,
  // NEW — recordings page
  get_recordings,
  get_recording_detail,
  patch_recording,
  // NEW — Voice index page (Live tab + Add/Call customer dialog)
  LIVE_CALL_STATUSES,
  get_quick_call_meta,
  post_quick_call_save,
  get_quick_call_list,
  get_quick_call_status,
  post_plivo_call,
  get_customers,
  get_customer_detail,
  get_call_tasks,
  // NEW — knowledge base / branches
  get_branches,
  get_branch_detail,
  patch_branch,
  // NEW — appointments / calendar (branch-driven)
  get_branch_calendar,
  post_manual_slot,
  get_slot_blocks,
  post_slot_block,
  delete_slot_block,
  get_appointments,
  // NEW — callback requests (customer/team)
  get_callbacks,
  patch_callback,
  delete_callback,
  get_booking_availability,
  post_create_booking,
  post_cancel_booking,
  get_kb_documents,
  kb_store_url,
  kb_document_update_url,
  kb_document_delete_url,
  get_dealers,
  // NEW — read-only knowledge-via-segments view for an agent (docs §9.9)
  get_agent_knowledge,
  // NEW — campaigns (list/detail/toggle only, no create — docs §11)
  get_campaigns,
  get_campaign_detail,
  patch_campaign,
  campaign_pause,
  campaign_pause_clear,
  campaign_resume,
  get_campaign_batches,
  // NEW — intent accuracy (index = summary rollup only, detail = per-intent turns)
  get_intents,
  get_intent_summary,
  get_intent_turns,
  // NEW — fillers (index card grid + per-intent state/filler editor)
  get_intent_fillers_summary,
  get_intent_fillers_detail,
  post_intent_filler,
  patch_filler,
  delete_filler,
  // NEW — Data Import (docs §7 / Module 3, §19.9)
  get_imports,
  post_import_upload,
  get_import_detail,
  get_import_preview,
  post_import_commit,
  post_import_revert,
  get_import_errors,
  get_import_unmatched,
  post_import_assign_segment,
  get_import_rows,
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