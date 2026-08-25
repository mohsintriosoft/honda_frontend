import $ from "jquery";
import { toast } from "react-toastify";
import { storeData } from "../LocalConnection/LocalConnection.js";

let time_iso_normal = 1; ///< time in iso format normalized 12:34:56
const validateEmail = (email) => {
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  return emailRegex.test(email);
};
const handleEmailChange = (e) => {
  // Check if the input contains leading spaces or exceeds 72 characters
  if (/^\s/.test(e.target.value) || e.target.value.length > 72) {
    e.target.value = ""; // Clear the input
    return;
  }

  // Check if the input contains any characters other than letters, digits, '@', '.', and '_'
  if (!/^[a-zA-Z0-9@._]*$/.test(e.target.value)) {
    e.target.value = ""; // Clear the input
  }
};
const handleEmailRegex = (e) => {
  const allowedKeys = [
    "Backspace",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Delete",
    " ",
  ];

  const key = e.key;
  const isValidChar = /^[a-zA-Z0-9@. ]$/.test(key);

  if (!isValidChar && !allowedKeys.includes(key)) {
    e.preventDefault();
  }
};
const handleError = (message_show) => {
  if (message_show === "network") {
    message_show = "Failed to connect to the server. Please try again later.";
  }
  if (message_show === "duplicate_time_slot") {
    message_show = "Duplicate Time Slot Find! Please Check Again.";
  }
  toast.error(message_show, {
    position: "top-right",
    autoClose: 3000,
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    className: "custom-toast-error",
  });
};

const validateName = (name) => {
  const nameRegex = /^[A-Za-z\s]+$/;
  return nameRegex.test(name);
};

const validateMobile = (mobile) => {
  // Remove leading and trailing whitespaces
  const trimmedMobile = mobile.trim();

  // Check if the trimmed mobile number is either a 10-digit numeric string or a "+91" followed by 10 digits
  const mobileRegex = /^(?:\+91)?[0-9]{10}$/;
  //  const mobileRegex = /^(?:(?:\+46\d{1,9})|(?:\+91\d{10}))$/;

  return mobileRegex.test(trimmedMobile);
};

const validateMobileplus = (mobile) => {
  // Remove leading and trailing whitespaces
  const trimmedMobile = mobile.trim();

  // Remove everything except digits and the "+" symbol
  const sanitizedMobile = trimmedMobile.replace(/[^+\d]/g, "");

  return sanitizedMobile;
};

const validateMobileSweden = (mobile) => {
  // Remove leading and trailing whitespaces
  const trimmedMobile = mobile.trim();

  // Check if the trimmed mobile number is either a 10-digit numeric string or a "+91" followed by 10 digits
  const mobileRegex = /^(?:\+91)?[0-9]{10}$/;
  //const mobileRegex = /^(?:(?:\+46\d{1,9})|(?:\+91\d{10}))$/;

  return mobileRegex.test(trimmedMobile);
};

const validateZip = (zip) => {
  const zipRegex = /^\d{6}$/;
  return zipRegex.test(zip);
};

const validatePassword = (value_send) => {
  const mobileRegex = /^(?=.*[!@#$%^&*(),.?":{}|<>])(?=.*[A-Z]).{8,}$/g;
  return mobileRegex.test(value_send);
};

const check_vaild_save = (class_name) => {
  var isValid = true;
  let triocity_search = false;
  let searchInput_google;
  let triocity_search_id;
  let triocity_search2 = false;
  let searchInput_google2;
  let triocity_search_id2;
  let confirm_new_passwordlElement;
  let new_passwordlElement_id;
  let confirm_new_passwordlElement_id;
  $("#" + class_name + " #searchInput").each(function () {
    triocity_search = $(this).attr("id").includes("searchInput");
    triocity_search_id = $(this);
  });
  $("#" + class_name + " .searchInput_google").each(function () {
    searchInput_google = $(this).val();
  });
  $("#" + class_name + " #searchInput2").each(function () {
    triocity_search2 = $(this).attr("id").includes("searchInput2");
    triocity_search_id2 = $(this);
  });
  $("#" + class_name + " .searchInput_google2").each(function () {
    searchInput_google2 = $(this).val();
  });

  $("#" + class_name + " .new_password").each(function () {
    new_passwordlElement_id = $(this);
  });
  $("#" + class_name + " .confirm_new_password").each(function () {
    confirm_new_passwordlElement = $(this)
      .attr("class")
      .includes("confirm_new_password");
    confirm_new_passwordlElement_id = $(this);
  });

  $("#" + class_name + " .form-control").each(function () {
    let input_type = $(this).attr("type");
    let triotrio_mandatory = $(this).attr("class").includes("trio_mandatory");
    let trioEmailElement = $(this).attr("class").includes("trio_email");

    let trioMobnolElement = $(this).attr("class").includes("trio_no");
    let triopasswordlElement = $(this).attr("class").includes("trio_password");
    let triocountlElement = $(this).attr("class").includes("trio_count");
    let trioNamelElement = $(this).attr("class").includes("trio_name");
    let trioZiplElement = $(this).attr("class").includes("trio_zip");
    let minlength = $(this).attr("minlength");
    if (input_type !== "file") {
      $(this).val($(this).val().trim());
    }

    let value_show = $(this).val();
    let minlength_data = minlength;
    if ($(this).is("select")) {
      minlength_data = 1;
    }

    $(this).css({
      border: "",
      background: "",
    });
    $(this).nextAll(".condition_error:first").hide();
    if (triotrio_mandatory) {
      if (
        value_show === "" ||
        value_show === null ||
        value_show.length < minlength_data
      ) {
        isValid = false;
        $(this).css({
          border: "1px solid red",
          width: "50px !important",
        });
        $(this)
          .nextAll(".condition_error:first")
          .html("Please Fill The Mandatory Information")
          .show();
      } else {
        if (trioEmailElement) {
          if (!validateEmail(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            isValid = false;
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Email Id")
              .show();
          }
        }
        if (trioZiplElement) {
          if (!validateZip(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            isValid = false;
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Enter Valid Zip Code")
              .show();
          }
        }
        if (trioNamelElement) {
          if (!validateName(value_show)) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Name")
              .show();
          }
        }
        if (trioNamelElement) {
          if (value_show.length < 3) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Name")
              .show();
          }
        }
        if (trioMobnolElement) {
          if (!validateMobileSweden(value_show)) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Enter Valid Mobile No")
              .show();
          }
        }
        if (triopasswordlElement) {
          if (!validatePassword(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html(
                "Password length must be 8 characters or longer .Include A-Z, a-z,0-9 and special characters."
              )
              .show();
            isValid = false;
          }
        }
        if (triocountlElement) {
          if (Number(value_show) === 0) {
            alert("Please Add Items");
            isValid = false;
          }
        }
      }
    } else {
      if (value_show !== "") {
        if (trioEmailElement) {
          if (!validateEmail(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            isValid = false;
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Email Id")
              .show();
          }
        }
        if (trioZiplElement) {
          if (!validateZip(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            isValid = false;
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Enter Valid Zip Code")
              .show();
          }
        }
        if (trioNamelElement) {
          if (!validateName(value_show)) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Name")
              .show();
          }
        }
        if (trioNamelElement) {
          if (value_show.length < 3) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Fill Valid Name")
              .show();
          }
        }
        if (trioMobnolElement) {
          if (!validateMobile(value_show)) {
            isValid = false;
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html("Please Enter Valid Mobile No")
              .show();
          }
        }
        if (triopasswordlElement) {
          if (!validatePassword(value_show)) {
            $(this).css({
              border: "1px solid red",
              width: "50px !important",
            });
            $(this)
              .nextAll(".condition_error:first")
              .html(
                "Password length must be 8 characters or longer .Include A-Z, a-z,0-9 and symbol like @,#$%..etc."
              )
              .show();
            isValid = false;
          }
        }
        if (triocountlElement) {
          if (Number(value_show) === 0) {
            alert("Please Add Items");
            isValid = false;
          }
        }
      }
    }
  });

  if (triocity_search) {
    if (searchInput_google === "") {
      triocity_search_id
        .nextAll(".condition_error:first")
        .html("Please Select City From Search")
        .show();
      isValid = false;
    } else if (triocity_search_id.val() === "") {
      triocity_search_id
        .nextAll(".condition_error:first")
        .html("Please Select City From Search")
        .show();
      isValid = false;
    } else {
      triocity_search_id.css({
        border: "",
        background: "",
      });
      triocity_search_id.nextAll(".condition_error:first").hide();
    }
  }
  if (triocity_search2) {
    if (searchInput_google2 === "") {
      triocity_search_id2
        .nextAll(".condition_error:first")
        .html("Please Select City From Search")
        .show();
      isValid = false;
    } else if (triocity_search_id2.val() === "") {
      triocity_search_id2
        .nextAll(".condition_error:first")
        .html("Please Select City From Search")
        .show();
      isValid = false;
    } else {
      triocity_search_id2.css({
        border: "",
        background: "",
      });
      triocity_search_id2.nextAll(".condition_error:first").hide();
    }
  }
  if (confirm_new_passwordlElement) {
    if (confirm_new_passwordlElement_id.val() === "") {
      confirm_new_passwordlElement_id
        .nextAll(".condition_error:first")
        .html("Please confirm password.")
        .show();
      isValid = false;
    } else if (
      confirm_new_passwordlElement_id.val() !== new_passwordlElement_id.val()
    ) {
      confirm_new_passwordlElement_id
        .nextAll(".condition_error:first")
        .html("Password and confirm password do not match.")
        .show();
      isValid = false;
    }
  }

  return isValid;
};

const combiled_form_data = (form_name, dynaicimage) => {
  const fd = new FormData(document.getElementById(form_name));
  for (const [key, value] of fd.entries()) {
    if (value.type && dynaicimage != null) {
      fd.append(key + "_new", dynaicimage[key]);
    }
  }
  return fd;
};

const empty_form = (class_name) => {
  if (class_name !== "form_data_profile") {
    $("#" + class_name + " .form-control").each(function () {
      $(this).val("");
      $(this).css({
        border: "",
        background: "",
      });
    });
  }
};

const getRandomSixLetterString = () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let randomString = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    randomString += alphabet[randomIndex];
  }
  return randomString;
};

const fnExcelReport = () => {
  var tab_text = "<table border='1px'><tr bgcolor='#ffffff'>";
  var j = 0;
  var tab = document.getElementById("dynamic-table1"); // id of table
  if (tab.rows.length > 1) {
    for (j = 0; j < tab.rows.length; j++) {
      if (!tab.rows[j].innerHTML.includes("table-detail")) {
        let datata = tab.rows[j].innerHTML.replace(
          '<button type="button" class="btn mr-2 mb-2 btn-primary" data-toggle="modal" data-target="#exampleModal">See More</button>',
          ""
        ); // remove if you want links in your table
        datata = datata.replace(
          '<button type="button" aria-haspopup="true" aria-expanded="false" data-toggle="dropdown" class="mb-2 mr-2 dropdown-toggle btn btn-outline-secondary ">Action</button>',
          ""
        ); // remove if you want links in your table

        tab_text = tab_text + datata + "</tr>";
      }
    }

    tab_text = tab_text.replace(/<a[^>]*>|<\/a>/g, ""); // remove if you want links in your table
    tab_text = tab_text.replace(/<img[^>]*>/gi, ""); // remove if you want images in your table
    tab_text = tab_text.replace(/<input[^>]*>|<\/input>/gi, ""); // removes input params
    tab_text = tab_text.replace(/<button[^>]*>|<\/button>/gi, ""); // removes input params
    tab_text = tab_text + "</table>";

    // Create a Blob containing the table data
    var blob = new Blob([tab_text], {
      type: "application/vnd.ms-excel",
    });

    // Create a URL for the Blob
    var url = URL.createObjectURL(blob);

    // Create an anchor element and trigger a download
    var a = document.createElement("a");
    a.href = url;
    a.download = "table_data.xls";
    a.click();
    // Clean up the URL object to release resources
    URL.revokeObjectURL(url);
  }
};

const handleLinkClick = (link, blank = "") => {
  const currentActiveSection = localStorage.getItem("activeSection");
  const currentPath = window.location.pathname;

  if (currentPath.includes("/")) {
    localStorage.setItem("activeSection", "home");
  } else if (currentActiveSection === link) {
    localStorage.removeItem("activeSection");
  } else {
    localStorage.setItem("activeSection", link);
  }

  if (blank === "") {
    window.location.href = link;
  } else {
    window.open(link, blank);
  }
};

const handleConfimDeleteClick = () => {
  // Display a confirmation dialog
  const isConfirmed = window.confirm("Are you sure you want to delete?");
  return isConfirmed;
};

const handleIaphabetnumberChange = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z0-9\s]/g, "");
};
const handleAlphabetRightId = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z0-9-_]/g, "");
};

// const handleAphabetsChange = (e) => {
//   e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
// };

const handleAphabetsChange = (e) => {
  // Check if the input contains leading spaces
  if (/^\s/.test(e.target.value)) {
    e.target.value = ""; // Clear the input
    return;
  }

  // Replace the password input based on the regex pattern
  e.target.value = e.target.value.replace(/[^A-Za-z\s]/g, "");
};

const handleAlphabetsWithoutSpaceChange = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z]/g, "");
};

const handleAlphabetsNumberWithoutSpaceChange = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z0-9]/g, "");
};

const handleNumbersChange = (e) => {
  // e.target.value = e.target.value.replace(/[^0-9]/g, "");
  e.target.value = e.target.value.slice(0, 14).replace(/[^0-9]/g, "");

  // Also, allow up to 10 digits after the country code for India and 9 digits for Sweden
};
const handlecoordinatory_no = (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, "");

  //only  6 dxt allowed
  e.target.value = e.target.value.slice(0, 6);
};
const handlepersonal_id_no = (e) => {
  e.target.value = e.target.value.replace(/[^0-9]/g, "");

  //only  12 dxt allowed
  e.target.value = e.target.value.slice(0, 12);
};

const handleNumbersDecimalChange = (e) => {
  e.target.value = e.target.value.replace(/[^0-9.]/g, ""); // Allow only digits and decimal point
  e.target.value = e.target.value.replace(/(\d{0,9}(?:\.\d{0,2})?).*$/g, "$1"); // Limit to 3 digits before the decimal and 2 digits after
};
const handleURLChange = (e) => {
  const urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;
  e.target.value = e.target.value.match(urlRegex) ? e.target.value : "";
};

const handleURLChange_Modify = (e) => {
  let inputValue = e.target.value.trim(); // Remove leading and trailing whitespace
  // Regular expression to match a valid URL pattern without "http://" or "/"
  const urlRegex = /^[a-zA-Z0-9\-_\.]+$/;

  // Check if the input value matches the URL regex
  if (urlRegex.test(inputValue)) {
    // If the input value is a valid URL pattern, set it as is
    e.target.value = inputValue;
  } else {
    // If the input value is not a valid URL pattern, clear the input value
    e.target.value = "";
  }
};

const handleAphabetswithhashChange = (e) => {
  e.target.value = e.target.value.replace(
    /[^A-Za-z0-9_/-]|\/{2,}|-{2,}/g,
    (match) => {
      // Replace consecutive slashes, hyphens, or underscores with a single instance
      return match.length === 2 ? match[0] : "";
    }
  );
};

const handleIaphabetnumberkeywordChange = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z0-9\s,]/g, "");
};

const handleIaphabetnumbercommaChange = (e) => {
  e.target.value = e.target.value.replace(/[^A-Za-z0-9\s,]/g, "");
};

const handlePasswordChange = (e) => {
  // Check if the input contains leading spaces
  if (/^\s/.test(e.target.value)) {
    e.target.value = ""; // Clear the input
    return;
  }

  // Replace the password input based on the regex pattern
  e.target.value = e.target.value.replace(
    /^(?=.*[!@#$%^&*(),.?":{}|<>])(?=.*[A-Z]).$/g,
    ""
  );
};

const handleNumbersRatingChange = (e) => {
  e.target.value = e.target.value.replace(/[^0-9.]/g, ""); // Allow only digits and decimal point
  e.target.value = e.target.value.replace(/^(\d{1,2}(?:\.\d{0,1})?).*$/g, "$1"); // Limit to 2 digits before the decimal and 1 digit after

  // Ensure the value is less than or equal to 5.0
  const ratingValue = parseFloat(e.target.value);
  if (ratingValue > 5.0) {
    e.target.value = "5.0";
  }
};
const computeTodayDateDatePicker = () => {
  const todayDate = new Date();
  const minDate = new Date(todayDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  return minDate; // Format as YYYY-MM-DD
};

const computeTodayDate = () => {
  const today = new Date();
  if (time_iso_normal === 0) {
    return today.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = today.getFullYear();
    const month = ("0" + (today.getMonth() + 1)).slice(-2);
    const day = ("0" + today.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};

const computeFutureDate = () => {
  const today = new Date();
  const maxDate = new Date(
    today.getFullYear() + 1,
    today.getMonth(),
    today.getDate() + 1
  );
  if (time_iso_normal === 0) {
    return maxDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = maxDate.getFullYear();
    const month = ("0" + (maxDate.getMonth() + 1)).slice(-2);
    const day = ("0" + maxDate.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};
const computeTodayDateCustom = (input_date, adddays = 0) => {
  const today = new Date(input_date);
  const maxDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + adddays
  );
  if (time_iso_normal === 0) {
    return maxDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = maxDate.getFullYear();
    const month = ("0" + (maxDate.getMonth() + 1)).slice(-2);
    const day = ("0" + maxDate.getDate()).slice(-2);
    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};
const computeplussevendays = () => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  if (time_iso_normal === 0) {
    return sevenDaysAgo.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = sevenDaysAgo.getFullYear();
    const month = ("0" + (sevenDaysAgo.getMonth() + 1)).slice(-2);
    const day = ("0" + sevenDaysAgo.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};

const calculateMaxDate = () => {
  var maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  if (time_iso_normal === 0) {
    return maxDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = maxDate.getFullYear();
    const month = ("0" + (maxDate.getMonth() + 1)).slice(-2);
    const day = ("0" + maxDate.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};

const calculateMinJoinDate = () => {
  var today = new Date();
  var minDate = new Date(today);
  minDate.setDate(minDate.getDate() - 10); // 10 days back
  if (time_iso_normal === 0) {
    return minDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = minDate.getFullYear();
    const month = ("0" + (minDate.getMonth() + 1)).slice(-2);
    const day = ("0" + minDate.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};
const calculateMaxJoinDate = () => {
  var today = new Date();
  var maxDate = new Date(today);
  maxDate.setMonth(maxDate.getMonth() + 3); // 3 months later
  if (time_iso_normal === 0) {
    return maxDate.toISOString().split("T")[0]; // Format as YYYY-MM-DD
  } else {
    const year = maxDate.getFullYear();
    const month = ("0" + (maxDate.getMonth() + 1)).slice(-2);
    const day = ("0" + maxDate.getDate()).slice(-2);

    const formattedDateString = `${year}-${month}-${day}`;
    return formattedDateString;
  }
};

const generateWeekdays = () => {
  let week_length = 7;
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const today = new Date();
  const nextWeekdays = Array.from({ length: week_length }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const month = date.toLocaleDateString("en-US", { month: "short" }); // Get short month name
    const day = date.getDate().toString().padStart(2, "0"); // Get day with leading zero if needed
    let day_yy_mm_dd = "";
    if (time_iso_normal === 0) {
      day_yy_mm_dd = date.toISOString().split("T")[0]; // Format as YYYY-MM-DD
    } else {
      const year = date.getFullYear();
      const month = ("0" + (date.getMonth() + 1)).slice(-2);
      const day = ("0" + date.getDate()).slice(-2);

      day_yy_mm_dd = `${year}-${month}-${day}`;
    }
    return {
      day: daysOfWeek[date.getDay()],
      date: `${month} ${day}`,
      day_yy_mm_dd: day_yy_mm_dd,
    };
  });
  return nextWeekdays;
};

const handleDateChange = (e) => {
  e.target.value = e.target.value.replace(/[^0-9-]/g, ""); // Assuming you want to allow only digits and hyphen for date
};

const inputdateformateChange = (input_data) => {
  const inputDate = new Date(input_data);

  const day = inputDate.getDate();
  const month = inputDate.toLocaleString("en-US", { month: "long" });
  const year = inputDate.getFullYear();

  const getOrdinalSuffix = (day) => {
    if (day > 3 && day < 21) return "th";
    switch (day % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  const dayWithSuffix = `${day}${getOrdinalSuffix(day)}`;
  const formattedDate = `${dayWithSuffix} ${month}, ${year}`;

  return formattedDate;
};

const inputdateformateChangeyear = (input_data = "") => {
  let inputDate = new Date();
  if (input_data !== "") {
    inputDate = new Date(input_data);
  }

  // Array of days of the week
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Get the day of the week (e.g., "Sun", "Mon", etc.)
  const dayOfWeek = daysOfWeek[inputDate.getDay()];

  // Options for formatting the date (excluding the year)
  const options = { month: "short", day: "2-digit" };

  // Format the date string using toLocaleDateString
  const formattedDate = `${dayOfWeek} ${inputDate.toLocaleDateString(
    "en-US",
    options
  )}`;

  return formattedDate;
};
const TimeformateChange = (originalTime) => {
  const formattedTime = new Date(
    `2000-01-01T${originalTime}`
  ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return formattedTime;
};

const formatTimeintotwodigit = (timeString) => {
  try {
    const timeParts = timeString.split(":");
    const hours = parseInt(timeParts[0], 10);
    const minutes = parseInt(timeParts[1], 10);
    const seconds = timeParts.length > 2 ? parseInt(timeParts[2], 10) : 0; // Check if seconds exist

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(seconds);

    const hours_one = String(date.getHours()).padStart(2, "0");
    const minutes_one = String(date.getMinutes()).padStart(2, "0");
    return `${hours_one}:${minutes_one}`;
  } catch (err) {
    return null;
  }
};

const DateormateBlogChange = (originalDateString) => {
  const dateObject = new Date(originalDateString);

  const formattedDateString = dateObject.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return formattedDateString;
};

const handleSuccess = (message_show, show_msg_data = 0) => {
  toast.success(message_show, {
    position: "top-right",
    autoClose: 3000, // Duration in milliseconds
    hideProgressBar: false,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: true,
    className: "custom-toast-success",
  });

  if (show_msg_data === 1) {
    handleSuccessSession("", "");
  }
};

const handleSuccessSession = (message_show, link_call) => {
  storeData("session_msg", message_show);
  if (link_call !== "") {
    handleLinkClick(link_call);
  }
};

const formatDateString = (dateString) => {
  const options = { year: "numeric", month: "long", day: "numeric" };
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", options);
};

const formatDateStringdot = (originalDateString) => {
  // Create a Date object from the originalDateString
  const dateObject = new Date(originalDateString);

  // Format the date object into a string with the specified options
  const formattedDateString = dateObject.toLocaleDateString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Split the formatted date string by "/"
  const [month, day, year] = formattedDateString.split("/");

  // Rearrange the date parts and join them with "."
  const rearrangedDateString = `${day}.${month}.${year}`;

  // Return the rearranged date string
  return rearrangedDateString;
};

const formatTimeFormat = () => {
  const inputDate = new Date();

  // Format options for time
  const timeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  // Format the time
  const formattedTime = inputDate.toLocaleTimeString(
    "en-US",
    timeFormatOptions
  );

  return formattedTime;
};
const formatTimeFormatcustom = (custom_input) => {
  const inputDate = new Date(custom_input);

  // Format options for time
  const timeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  };

  // Format the time
  const formattedTime = inputDate.toLocaleTimeString(
    "en-US",
    timeFormatOptions
  );

  return formattedTime;
};
const make_image_from_letter = (name) => {
  if (name == null) return;
  name = getInitials(name);
  const size = 45;
  const color = "rgba(227, 55, 69, 1)";
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = canvas.height = size;

  context.fillStyle = "#ffffff";
  context.fillStyle = `${color} 50`;
  context.beginPath();
  context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  context.closePath();
  context.fill();
  context.fillStyle = color;

  context.fillStyle = color;
  context.textBaseline = "middle";
  context.textAlign = "center";
  context.font = `${size / 2}px Roboto`;
  context.fillText(name, size / 2, size / 2);

  return canvas.toDataURL();
};

const getInitials = (name) => {
  let initials;
  const nameSplit = name.split(" ");
  const nameLength = nameSplit.length;
  if (nameLength > 1) {
    initials =
      nameSplit[0].substring(0, 1) + nameSplit[nameLength - 1].substring(0, 1);
  } else if (nameLength === 1) {
    initials = nameSplit[0].substring(0, 1);
  } else return;

  return initials.toUpperCase();
};

const handleEmailClick = (email_click) => {
  window.location.href = `mailto:` + email_click;
};
const handleCallClick = (call_click) => {
  window.location.href = `tel:` + call_click;
};
const cancelChanges = () => {
  window.location.reload();
};
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

const formatDateweekdate = (dateString) => {
  const date = new Date(dateString);

  const options = {
    weekday: "short", // abbreviated weekday
    day: "2-digit",
    month: "short",
    year: "2-digit", // abbreviated year (2-digit)
  };

  const formattedDate = new Intl.DateTimeFormat("en-GB", options).format(date);

  return formattedDate;
};

export {
  handlecoordinatory_no,
  handlepersonal_id_no,
  handleAlphabetRightId,
  validateName,
  formatDateStringdot,
  empty_form,
  check_vaild_save,
  combiled_form_data,
  getRandomSixLetterString,
  handleLinkClick,
  handleIaphabetnumberChange,
  handleEmailChange,
  handleAphabetsChange,
  handleNumbersChange,
  handleNumbersDecimalChange,
  handleURLChange,
  handleURLChange_Modify,
  fnExcelReport,
  handleConfimDeleteClick,
  handleAphabetswithhashChange,
  handleIaphabetnumberkeywordChange,
  handleIaphabetnumbercommaChange,
  handleNumbersRatingChange,
  computeTodayDate,
  handlePasswordChange,
  handleDateChange,
  computeFutureDate,
  inputdateformateChange,
  handleSuccess,
  handleError,
  handleSuccessSession,
  TimeformateChange,
  DateormateBlogChange,
  handleAlphabetsWithoutSpaceChange,
  formatDateString,
  validateMobile,
  handleEmailClick,
  formatTimeintotwodigit,
  make_image_from_letter,
  handleAlphabetsNumberWithoutSpaceChange,
  cancelChanges,
  inputdateformateChangeyear,
  handleCallClick,
  formatTimeFormat,
  computeTodayDateCustom,
  formatTimeFormatcustom,
  generateWeekdays,
  computeTodayDateDatePicker,
  computeplussevendays,
  calculateMaxDate,
  calculateMinJoinDate,
  calculateMaxJoinDate,
  validateEmail,
  getDistance,
  validateMobileplus,
  formatDateweekdate,
  handleEmailRegex,
};
