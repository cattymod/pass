/*
==========================================================
 CattyPassword Manager - background.js
 Part of the CattyPassword Manager browser extension
 Developed by: The CattyMod Team 🐾
 
 You MUST credit:
 https://github.com/cattymod/pass

 License: MIT
==========================================================
*/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadFile") {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename,
      saveAs: true
    }).then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true; // Keep the message channel open for async response
  }
});
