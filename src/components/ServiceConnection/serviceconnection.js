import axios from "axios";
import { retrieveData, storeData, removeData } from "../LocalConnection/LocalConnection.js";

/* =========================================================
   CONFIG
========================================================= */

const APL_LINK = "https://omhonda.triosoft.ai/";
// const APL_LINK = "http://192.168.1.20:8000/";
// const APL_LINK = "https://molecular-mama-riverside.ngrok-free.dev/";

const AUDIO_BASE_URL = "/media/call_recordings/";

const ADMIN_WEB_APP = "manager";

const NO_TOKEN_VALUES = new Set(["0", "1", "", null, undefined]);

const HTTP_METHODS_WITHOUT_BODY = new Set(["GET", "HEAD", "OPTIONS"]);

/* =========================================================
   URL HELPERS
========================================================= */

const joinUrl = (...parts) =>
  parts
    .map((part, index) => {
      if (part === null || part === undefined) return "";

      const value = String(part);

      return index === 0
        ? value.replace(/\/+$/, "")
        : value.replace(/^\/+/, "").replace(/\/+$/, "");
    })
    .filter(Boolean)
    .join("/");

const getWsBaseUrl = () =>
  APL_LINK.replace(/^https?/i, (protocol) => (protocol.toLowerCase() === "https" ? "wss" : "ws"));

/* =========================================================
   WEBSOCKET
========================================================= */

const WS_URL = `${getWsBaseUrl()}/api/voice/ws/audio`;

const getListenWsUrl = (sessionId) => {
  const token = encodeURIComponent(getAccessToken() || "");

  return `${getWsBaseUrl()}/api/voice/ws/listen/${encodeURIComponent(sessionId)}/?token=${token}`;
};

// Backward compatibility
const getListenWsUrl2 = getListenWsUrl;

/* =========================================================
   API ENDPOINTS
========================================================= */

/* ---------- AUTH ---------- */

const login_user_email = `${APL_LINK}/api/login_user_email`;
const register_user_email = `${APL_LINK}/api/register_user_email`;
const logout_user_email = `${APL_LINK}/api/logout_user_email`;

/* ---------- DASHBOARD / ANALYTICS ---------- */

const get_dashboard_summary = `${APL_LINK}/api/dashboard/`;
const get_analytics_summary = `${APL_LINK}/api/analytics/`;
const get_analytics = get_analytics_summary;

/* ---------- SEGMENTS ---------- */

const get_segments = `${APL_LINK}/api/segments/`;

const get_segment_detail = (segmentId) => `${APL_LINK}/api/segments/${segmentId}/`;

const patch_segment = get_segment_detail;

const get_segment_customers = (segmentId, page = 1, pageSize = 20) =>
  `${APL_LINK}/api/segments/${segmentId}/customers/?page=${page}&page_size=${pageSize}`;

/* ---------- LLM / TTS ---------- */

const get_llm_settings = `${APL_LINK}/api/llm-settings/`;
const get_tts_voices = `${APL_LINK}/api/tts-voices/`;
const update_llm_setting = get_llm_settings;

/* ---------- KNOWLEDGE ---------- */

const get_agent_knowledge = (agentId) => `${APL_LINK}/api/agents/${agentId}/knowledge/`;

const get_kb_documents = `${APL_LINK}/api/kb/documents/`;
const kb_store_url = `${APL_LINK}/api/kb/store/`;

const kb_document_update_url = (docId) => `${APL_LINK}/api/kb/documents/${docId}/update/`;

const kb_document_delete_url = (docId) => `${APL_LINK}/api/kb/documents/${docId}/`;

/* ---------- RECORDINGS ---------- */

const get_recordings = `${APL_LINK}/api/recordings/`;

const get_recording_detail = (id) => `${APL_LINK}/api/recordings/${id}/`;

const patch_recording = get_recording_detail;

/* ---------- VOICE ---------- */

const get_live_calls = `${APL_LINK}/api/live-calls/`;

const get_quick_call_meta = `${APL_LINK}/api/quick-call/meta/`;

const post_quick_call_save = `${APL_LINK}/api/quick-call/save/`;

const get_quick_call_list = `${APL_LINK}/api/quick-call/list/`;

const get_quick_call_status = (sessionId) =>
  `${APL_LINK}/api/quick-call/status/?session_id=${encodeURIComponent(sessionId)}`;

const get_quick_vehicle_customer_lookup = (phone) =>
  `${APL_LINK}/api/quick-vehicle/customer-lookup/?phone=${encodeURIComponent(phone)}`;

const post_quick_vehicle_save = `${APL_LINK}/api/quick-vehicle/save/`;

const post_plivo_call = `${APL_LINK}/api/voice/plivo/call/`;

const post_plivo_end_call = `${APL_LINK}/api/voice/plivo/end-call/`;

/* ---------- CUSTOMERS ---------- */

const get_customers = `${APL_LINK}/api/customers/`;

const get_customer_detail = (customerId) => `${APL_LINK}/api/customers/${customerId}/`;

const get_call_tasks = `${APL_LINK}/api/call-tasks/`;

/* ---------- DEALERS / BRANCHES ---------- */

const get_dealers = `${APL_LINK}/api/dealers/`;
const get_branches = `${APL_LINK}/api/branches/`;

const get_branch_detail = (id) => `${APL_LINK}/api/branches/${id}/`;

const patch_branch = get_branch_detail;

/* ---------- CALENDAR ---------- */

const get_branch_calendar = (branchId, start, range = "week") =>
  `${APL_LINK}/api/branches/${branchId}/calendar/?start=${encodeURIComponent(
    start,
  )}&range=${encodeURIComponent(range)}`;

const post_manual_slot = (branchId) => `${APL_LINK}/api/branches/${branchId}/manual-slot/`;

const get_slot_blocks = (branchId, date) =>
  `${APL_LINK}/api/branches/${branchId}/slot-blocks/${
    date ? `?date=${encodeURIComponent(date)}` : ""
  }`;

const post_slot_block = (branchId) => `${APL_LINK}/api/branches/${branchId}/slot-blocks/`;

const delete_slot_block = (id) => `${APL_LINK}/api/slot-blocks/${id}/`;

const get_appointments = `${APL_LINK}/api/appointments/`;

const delete_appointment = (id) => `${APL_LINK}/api/appointments/${id}/`;

/* ---------- CALLBACKS ---------- */

const get_callbacks = `${APL_LINK}/api/callbacks/`;

const patch_callback = (id) => `${APL_LINK}/api/callbacks/${id}/`;

const delete_callback = patch_callback;

/* ---------- CRM ---------- */

const get_booking_availability = `${APL_LINK}/api/crm/booking-availability/`;

const post_create_booking = `${APL_LINK}/api/crm/booking/create/`;

const post_cancel_booking = `${APL_LINK}/api/crm/booking/cancel/`;

/* ---------- CAMPAIGNS ---------- */

const get_campaigns = `${APL_LINK}/api/campaigns/`;

const get_campaign_detail = (campaignId) => `${APL_LINK}/api/campaigns/${campaignId}/`;

const patch_campaign = get_campaign_detail;

const campaign_pause = (campaignId) => `${APL_LINK}/api/campaigns/${campaignId}/pause/`;

const campaign_pause_clear = (campaignId) => `${APL_LINK}/api/campaigns/${campaignId}/pause-clear/`;

const campaign_resume = (campaignId) => `${APL_LINK}/api/campaigns/${campaignId}/resume/`;

const get_campaign_batches = (campaignId) => `${APL_LINK}/api/campaigns/${campaignId}/batches/`;

/* ---------- INTENTS ---------- */

const get_intents = `${APL_LINK}/api/intents/`;

const get_intent_summary = (id) => `${APL_LINK}/api/intents/?id=${encodeURIComponent(id)}`;

const get_intent_turns = (id) => `${APL_LINK}/api/intents/${id}/turns/`;

/* ---------- FILLERS ---------- */

const get_intent_fillers_summary = `${APL_LINK}/api/intents/fillers/`;

const get_intent_fillers_detail = (id) => `${APL_LINK}/api/intents/${id}/fillers/`;

const post_intent_filler = get_intent_fillers_detail;

const patch_filler = (id) => `${APL_LINK}/api/fillers/${id}/`;

const delete_filler = patch_filler;

/* ---------- IMPORTS ---------- */

const get_imports = `${APL_LINK}/api/imports/`;

const post_import_upload = get_imports;

const get_import_detail = (id) => `${APL_LINK}/api/imports/${id}/`;

const get_import_preview = (id) => `${APL_LINK}/api/imports/${id}/preview/`;

const post_import_commit = (id) => `${APL_LINK}/api/imports/${id}/commit/`;

const post_import_revert = (id) => `${APL_LINK}/api/imports/${id}/revert/`;

const post_import_delete = (id) => `${APL_LINK}/api/imports/${id}/delete/`;

const get_import_errors = (id) => `${APL_LINK}/api/imports/${id}/errors/`;

const get_import_unmatched = (id) => `${APL_LINK}/api/imports/${id}/unmatched/`;

const post_import_assign_segment = (id) => `${APL_LINK}/api/imports/${id}/assign-segment/`;

const get_import_rows = (id) => `${APL_LINK}/api/imports/${id}/rows/`;

/* ---------- DIALER ---------- */

const get_dialer_schedule = `${APL_LINK}/api/dialer-schedule/`;

const post_dialer_schedule = `${APL_LINK}/api/dialer-schedule/update/`;

/* ---------- PROVIDERS ---------- */

const get_provider_settings = `${APL_LINK}/api/provider-settings/`;

const post_provider_settings = `${APL_LINK}/api/provider-settings/update/`;

const get_provider_health = `${APL_LINK}/api/provider-health/`;

/* ---------- USERS / ROLES ---------- */

const get_users = `${APL_LINK}/api/users/`;

const post_user = get_users;

const patch_user = (id) => `${APL_LINK}/api/users/${id}/`;

const get_roles = `${APL_LINK}/api/roles/`;

const post_role = get_roles;

const role_url = (id) => `${APL_LINK}/api/roles/${id}/`;

const get_profile = `${APL_LINK}/api/profile/`;

/* ---------- SETTINGS ---------- */

const get_workspace_settings = `${APL_LINK}/api/settings/workspace/`;

const patch_workspace_settings = get_workspace_settings;

const patch_profile = `${APL_LINK}/api/profile/update/`;

const post_change_password = `${APL_LINK}/api/profile/password/`;

const patch_settings_voice = (id) => `${APL_LINK}/api/settings/voices/${id}/`;

/* ---------- SHOWROOM VISITS ---------- */

const get_visit_batches = `${APL_LINK}/api/showroom-visits/batches/`;

const post_visit_upload = get_visit_batches;

const visit_batch_url = (id) => `${APL_LINK}/api/showroom-visits/batches/${id}/`;

const post_visit_process = (id) => `${APL_LINK}/api/showroom-visits/batches/${id}/process/`;

const get_visit_records = `${APL_LINK}/api/showroom-visits/records/`;

const visit_record_url = (id) => `${APL_LINK}/api/showroom-visits/records/${id}/`;

const get_visit_summary = `${APL_LINK}/api/showroom-visits/summary/`;

/* ---------- NAV / SEARCH / UI ---------- */

const get_nav_badges = `${APL_LINK}/api/nav-badges/`;

const get_global_search = `${APL_LINK}/api/search/`;

const get_my_ui_rules = `${APL_LINK}/api/ui-rules/`;

const get_all_ui_rules = `${APL_LINK}/api/ui-rules/all/`;

const post_ui_rule = get_all_ui_rules;

const ui_rule_url = (id) => `${APL_LINK}/api/ui-rules/${id}/`;

/* =========================================================
   AUTH / LOCAL STORAGE
========================================================= */

const getAccessToken = () => {
  try {
    return retrieveData("access_token") || null;
  } catch (error) {
    console.error("Unable to retrieve access token:", error);
    return null;
  }
};

const setAuthSession = (accessToken, staffUser = null) => {
  try {
    storeData("access_token", accessToken);

    if (staffUser) {
      storeData("staff_user", JSON.stringify(staffUser));
    }
  } catch (error) {
    console.error("Unable to persist auth session:", error);
  }
};

const getStaffUser = () => {
  try {
    const raw = retrieveData("staff_user");

    if (NO_TOKEN_VALUES.has(raw)) {
      return null;
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Unable to read staff user:", error);
    return null;
  }
};

const clearAuthSession = () => {
  try {
    removeData();
  } catch (error) {
    console.error("Unable to clear auth session:", error);
  }
};

const isAuthenticated = () => !NO_TOKEN_VALUES.has(getAccessToken());

/* =========================================================
   COMMON DATA
========================================================= */

const getCommonData = () => {
  try {
    return {
      customer_id: retrieveData("customer_id") || "",
      final_bus_id: retrieveData("final_bus_id") || "",
      counter_bus_id: retrieveData("counter_bus_id") || "",
    };
  } catch (error) {
    console.error("Unable to retrieve local data:", error);

    return {
      customer_id: "",
      final_bus_id: "",
      counter_bus_id: "",
    };
  }
};

/* =========================================================
   AUTH HEADERS
========================================================= */

const getAuthHeaders = (url = "") => {
  const token = getAccessToken();

  if (NO_TOKEN_VALUES.has(token) || url === login_user_email) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

/* =========================================================
   COMMON FORM DATA
========================================================= */

const appendIfMissing = (formData, key, value) => {
  if (!formData.has(key) && value !== undefined && value !== null) {
    formData.append(key, value);
  }
};

const appendCommonFormData = (formData) => {
  const { customer_id, final_bus_id, counter_bus_id } = getCommonData();

  appendIfMissing(formData, "admin_web_app", ADMIN_WEB_APP);

  appendIfMissing(formData, "final_buu_id", customer_id);

  appendIfMissing(formData, "final_bus_id", final_bus_id);

  appendIfMissing(formData, "counter_bus_id", counter_bus_id);

  return formData;
};

/* =========================================================
   FORM DATA
========================================================= */

const isFormData = (data) => typeof FormData !== "undefined" && data instanceof FormData;

const createFormData = (data = {}) => {
  const formData = new FormData();

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          formData.append(`${key}[]`, item);
        }
      });

      return;
    }

    formData.append(key, value);
  });

  return appendCommonFormData(formData);
};

const normalizeFormData = (data = {}) => {
  if (isFormData(data)) {
    return appendCommonFormData(data);
  }

  return createFormData(data);
};

/* =========================================================
   REQUEST CONFIG
========================================================= */

const getRequestConfig = (url, config = {}) => ({
  ...config,

  headers: {
    ...getAuthHeaders(url),
    ...(config.headers || {}),
  },
});

/* =========================================================
   401 HANDLER
========================================================= */

const EXEMPT_401_URLS = new Set([login_user_email, register_user_email]);

const handleUnauthorized = (error) => {
  const status = error?.response?.status;
  const requestUrl = error?.config?.url;

  if (status === 401 && !EXEMPT_401_URLS.has(requestUrl)) {
    clearAuthSession();

    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }

  return Promise.reject(error);
};

/* =========================================================
   AXIOS INSTANCE
========================================================= */

const apiClient = axios.create({
  baseURL: APL_LINK,
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();

    if (!NO_TOKEN_VALUES.has(token) && config.url !== login_user_email) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error("API Status:", error.response.status);

      console.error("API Response:", error.response.data);
    } else if (error.request) {
      console.error("No response received from server");
    } else {
      console.error("Axios Error:", error.message);
    }

    return handleUnauthorized(error);
  },
);

/* =========================================================
   CORE REQUEST
========================================================= */

const request = async ({
  method = "GET",
  url,
  data = null,
  params,
  headers = {},
  config = {},
  useFormData = false,
  responseType,
}) => {
  if (!url) {
    throw new Error("API URL is required");
  }

  const normalizedMethod = method.toUpperCase();

  let finalData = data;

  if (useFormData && !HTTP_METHODS_WITHOUT_BODY.has(normalizedMethod)) {
    finalData = normalizeFormData(data);
  }

  const finalConfig = {
    ...config,
    method: normalizedMethod,
    url,
    params,
    data: finalData,
    responseType,
    headers: {
      ...headers,
      ...(config.headers || {}),
    },
  };

  try {
    const response = await apiClient.request(finalConfig);

    return response.data;
  } catch (error) {
    console.error(`${normalizedMethod} API Error:`, url, error);

    throw error;
  }
};

/* =========================================================
   HTTP METHODS
========================================================= */

const server_get_data = (url, params = {}, config = {}) =>
  request({
    method: "GET",
    url,
    params,
    config,
  });

const server_post_data = (url, data = null, config = {}) =>
  request({
    method: "POST",
    url,
    data,
    config,
    useFormData: true,
  });

const server_post_json = (url, data = {}, config = {}) => {
  const commonData = getCommonData();

  const finalData = {
    ...data,

    admin_web_app: data.admin_web_app ?? ADMIN_WEB_APP,

    final_buu_id: data.final_buu_id ?? commonData.customer_id,

    final_bus_id: data.final_bus_id ?? commonData.final_bus_id,

    counter_bus_id: data.counter_bus_id ?? commonData.counter_bus_id,
  };

  return request({
    method: "POST",
    url,
    data: finalData,
    config,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

const server_put_data = (url, data = {}, config = {}) =>
  request({
    method: "PUT",
    url,
    data,
    config,
    headers: {
      "Content-Type": "application/json",
    },
  });

const server_put_form_data = (url, data = null, config = {}) =>
  request({
    method: "PUT",
    url,
    data,
    config,
    useFormData: true,
  });

const server_patch_data = (url, data = {}, config = {}) =>
  request({
    method: "PATCH",
    url,
    data,
    config,
    headers: {
      "Content-Type": "application/json",
    },
  });

const server_patch_form_data = (url, data = null, config = {}) =>
  request({
    method: "PATCH",
    url,
    data,
    config,
    useFormData: true,
  });

const server_delete_data = (url, data = {}, config = {}) =>
  request({
    method: "DELETE",
    url,
    data: data && Object.keys(data).length ? data : undefined,
    config,
  });

const server_delete_form_data = (url, data = null, config = {}) =>
  request({
    method: "DELETE",
    url,
    data,
    config,
    useFormData: true,
  });

const server_head_data = (url, config = {}) =>
  request({
    method: "HEAD",
    url,
    config,
  });

const server_options_data = (url, config = {}) =>
  request({
    method: "OPTIONS",
    url,
    config,
  });

/* =========================================================
   GENERIC REQUEST
========================================================= */

const server_request = ({
  method = "GET",
  url,
  data = null,
  params = {},
  headers = {},
  config = {},
  useFormData = false,
} = {}) =>
  request({
    method,
    url,
    data,
    params,
    headers,
    config,
    useFormData,
  });

/* =========================================================
   FILE UPLOAD
========================================================= */

const server_upload_file = async (url, file, fieldName = "file", extraData = {}, config = {}) => {
  const formData = new FormData();

  formData.append(fieldName, file);

  Object.entries(extraData).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  appendCommonFormData(formData);

  return request({
    method: "POST",
    url,
    data: formData,
    config,
  });
};

/* =========================================================
   DOWNLOAD
========================================================= */

const server_download_file = (url, params = {}, config = {}) =>
  apiClient
    .get(
      url,
      getRequestConfig(url, {
        ...config,
        params,
        responseType: "blob",
      }),
    )
    .catch(handleUnauthorized);

/* =========================================================
   AUDIO
========================================================= */

const getAudioUrl = (session) => {
  if (!session?.id) {
    return "";
  }

  return `${joinUrl(APL_LINK, "api/recordings", session.id, "audio")}/`;
};

/* =========================================================
   EXPORTS
========================================================= */

export {
  APL_LINK,
  AUDIO_BASE_URL,
  WS_URL,

  /* Auth */
  login_user_email,
  register_user_email,
  logout_user_email,
  setAuthSession,
  getStaffUser,
  clearAuthSession,
  isAuthenticated,
  getAccessToken,

  /* Dashboard */
  get_dashboard_summary,
  get_analytics_summary,
  get_analytics,

  /* Segments */
  get_segments,
  get_segment_detail,
  patch_segment,
  get_segment_customers,

  /* LLM */
  get_llm_settings,
  get_tts_voices,
  update_llm_setting,

  /* Recordings */
  get_recordings,
  get_recording_detail,
  patch_recording,

  /* Voice */
  get_live_calls,
  get_quick_call_meta,
  post_quick_call_save,
  get_quick_call_list,
  get_quick_call_status,
  get_quick_vehicle_customer_lookup,
  post_quick_vehicle_save,
  post_plivo_call,
  post_plivo_end_call,

  /* Customers */
  get_customers,
  get_customer_detail,
  get_call_tasks,

  /* Dealers / Branches */
  get_dealers,
  get_branches,
  get_branch_detail,
  patch_branch,

  /* Calendar */
  get_branch_calendar,
  post_manual_slot,
  get_slot_blocks,
  post_slot_block,
  delete_slot_block,
  get_appointments,
  delete_appointment,

  /* Callbacks */
  get_callbacks,
  patch_callback,
  delete_callback,

  /* CRM */
  get_booking_availability,
  post_create_booking,
  post_cancel_booking,

  /* Knowledge */
  get_kb_documents,
  kb_store_url,
  kb_document_update_url,
  kb_document_delete_url,
  get_agent_knowledge,

  /* Campaigns */
  get_campaigns,
  get_campaign_detail,
  patch_campaign,
  campaign_pause,
  campaign_pause_clear,
  campaign_resume,
  get_campaign_batches,

  /* Intents */
  get_intents,
  get_intent_summary,
  get_intent_turns,

  /* Fillers */
  get_intent_fillers_summary,
  get_intent_fillers_detail,
  post_intent_filler,
  patch_filler,
  delete_filler,

  /* Imports */
  get_imports,
  post_import_upload,
  get_import_detail,
  get_import_preview,
  post_import_commit,
  post_import_revert,
  post_import_delete,
  get_import_errors,
  get_import_unmatched,
  post_import_assign_segment,
  get_import_rows,

  /* Dialer */
  get_dialer_schedule,
  post_dialer_schedule,

  /* Provider */
  get_provider_settings,
  post_provider_settings,
  get_provider_health,

  /* Users */
  get_users,
  post_user,
  patch_user,

  /* Roles */
  get_roles,
  post_role,
  role_url,

  /* Profile */
  get_profile,
  patch_profile,
  post_change_password,

  /* Settings */
  get_workspace_settings,
  patch_workspace_settings,
  patch_settings_voice,

  /* Showroom */
  get_visit_batches,
  post_visit_upload,
  visit_batch_url,
  post_visit_process,
  get_visit_records,
  visit_record_url,
  get_visit_summary,

  /* Navigation */
  get_nav_badges,
  get_global_search,

  /* UI Rules */
  get_my_ui_rules,
  get_all_ui_rules,
  post_ui_rule,
  ui_rule_url,

  /* HTTP */
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
  server_request,

  /* Files */
  server_upload_file,
  server_download_file,

  /* WebSocket */
  getListenWsUrl,
  getListenWsUrl2,

  /* Audio */
  getAudioUrl,

  /* Axios */
  apiClient,
};
