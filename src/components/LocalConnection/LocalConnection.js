import { handleLinkClick } from "../CommonJquery/CommonJquery";

const send_null_value = "0";
// Storing data
const storeData = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // Handle the error
  }
};

// Retrieving data
const retrieveData = (key) => {
  try {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
    return send_null_value;
  } catch (error) {
    return send_null_value;
  }
};

// Removing data
const removeData = (navigate) => {
  try {
    localStorage.clear();
    handleLinkClick("/Sign-In");
  } catch (error) {
    //err
  }
};

export { storeData, retrieveData, removeData };
