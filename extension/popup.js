/*
==========================================================
 CattyPassword Manager - popup.js
 Part of the CattyPassword Manager browser extension
 Developed by: The CattyMod Team 🐾
 
 You MUST credit:
 https://github.com/cattymod/pass

 License: MIT
==========================================================
*/

// =======================
// Globals
// =======================
const passwordsKey = 'passwords';
const tabs = ['Generate', 'Manage', 'Settings', 'Credits'];

// =======================
// Tab switching
// =======================
tabs.forEach(tab => {
  document.getElementById('tab' + tab).addEventListener('click', () => {
    setActiveTab(tab);
  });
});

function setActiveTab(tab) {
  tabs.forEach(t => {
    document.getElementById('tab' + t).classList.toggle('active', t === tab);
    document.getElementById('page' + t).classList.toggle('active', t === tab);
  });
  if (tab === 'Manage') loadPasswords();
}

// =======================
// Modal functions
// =======================
const modalOverlay = document.getElementById('modalOverlay');
const modalMessage = document.getElementById('modalMessage');
const modalClose = document.getElementById('modalClose');

function showModal(message) {
  modalMessage.innerHTML = message;
  modalOverlay.style.display = 'flex';
}
modalClose.onclick = () => { modalOverlay.style.display = 'none'; };

// =======================
// Password Generator
// =======================
const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;':,./<>?";
document.getElementById('btnGenerate').onclick = () => {
  const len = 16;
  let pass = "";
  for (let i = 0; i < len; i++) pass += chars.charAt(Math.floor(Math.random() * chars.length));
  document.getElementById('genPassword').value = pass;
};

document.getElementById('btnSaveGenerated').onclick = async () => {
  const site = document.getElementById('siteName').value.trim();
  const password = document.getElementById('genPassword').value.trim();
  const username = document.getElementById('inputUsername')?.value.trim() || "";
  const note = document.getElementById('inputNote')?.value.trim() || "";

  if (!site || !password) {
    showModal('Please provide both site name and password to save.');
    return;
  }

  const data = await chrome.storage.local.get(passwordsKey);
  const passwords = data[passwordsKey] || {};
  passwords[site] = { username, password, note };
  await chrome.storage.local.set({ [passwordsKey]: passwords });

  showModal(`Password for "${escapeHTML(site)}" saved!`);
  loadPasswords();
};

// =======================
// Manage Page
// =======================
async function loadPasswords() {
  const container = document.getElementById('passwordList');
  container.innerHTML = '';

  const data = await chrome.storage.local.get(passwordsKey);
  const passwords = data[passwordsKey] || {};

  if (Object.keys(passwords).length === 0) {
    container.textContent = "No saved passwords yet.";
    return;
  }

  Object.entries(passwords).forEach(([site, obj]) => {
    const item = document.createElement('div');
    item.className = 'password-item';

    const content = document.createElement('div');
    content.style.flex = '1';
    content.innerHTML = `
      <strong>${escapeHTML(site)}</strong><br>
      <em>Username:</em> ${escapeHTML(obj.username || '')}<br>
      <em>Password:</em> ${escapeHTML(obj.password)}<br>
      <em>Note:</em> ${escapeHTML(obj.note || '')}
    `;

    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.marginLeft = '10px';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Edit';
    editBtn.className = 'small-btn';
    editBtn.onclick = () => openEditModal(site, obj);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = 'Delete';
    deleteBtn.className = 'small-btn';
    deleteBtn.style.backgroundColor = '#d43f3f';
    deleteBtn.style.color = 'white';
    deleteBtn.onclick = async () => {
      if (confirm(`Delete password for "${site}"?`)) {
        delete passwords[site];
        await chrome.storage.local.set({ [passwordsKey]: passwords });
        loadPasswords();
      }
    };

    controls.appendChild(editBtn);
    controls.appendChild(deleteBtn);
    item.appendChild(content);
    item.appendChild(controls);
    container.appendChild(item);
  });
}

function openEditModal(site, obj) {
  modalMessage.innerHTML = `
    <strong>Edit: ${escapeHTML(site)}</strong><br><br>
    <label>Username:<br><input type="text" id="modalUsername" value="${escapeHTML(obj.username || '')}" style="width:100%;"></label><br>
    <label>Password:<br><input type="text" id="modalPassword" value="${escapeHTML(obj.password)}" style="width:100%;"></label><br>
    <label>Note:<br><textarea id="modalNote" rows="3" style="width:100%;">${escapeHTML(obj.note || '')}</textarea></label><br>
    <button id="modalSaveEdit">Save</button>
  `;
  modalOverlay.style.display = 'flex';

  document.getElementById('modalSaveEdit').onclick = async () => {
    const newUsername = document.getElementById('modalUsername').value.trim();
    const newPassword = document.getElementById('modalPassword').value.trim();
    const newNote = document.getElementById('modalNote').value.trim();
    if (!newPassword) {
      alert('Password cannot be empty!');
      return;
    }
    const data = await chrome.storage.local.get(passwordsKey);
    const passwords = data[passwordsKey] || {};
    passwords[site] = { username: newUsername, password: newPassword, note: newNote };
    await chrome.storage.local.set({ [passwordsKey]: passwords });
    modalOverlay.style.display = 'none';
    loadPasswords();
  };
}

// =======================
// Export JSON
// =======================
document.getElementById('btnExport').onclick = async () => {
  const data = await chrome.storage.local.get(passwordsKey);
  const passwords = data[passwordsKey] || {};
  if (Object.keys(passwords).length === 0) {
    showModal("No passwords to export.");
    return;
  }
  const jsonStr = JSON.stringify(passwords, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({
    action: "downloadFile",
    url,
    filename: 'cattypass-passwords.json'
  }, () => {
    URL.revokeObjectURL(url);
  });
};

// =======================
// CSV Import
// =======================
const csvInput = document.getElementById('importCSVFile');

document.getElementById('btnImportCSV').onclick = () => {
  csvInput.value = '';
  csvInput.click();
};

csvInput.onchange = async () => {
  if (csvInput.files.length === 0) return;
  const file = csvInput.files[0];
  const text = await file.text();
  let importedPasswords;
  try {
    importedPasswords = parseCSV(text);
  } catch {
    showModal("Failed to parse CSV file.");
    return;
  }
  if (!importedPasswords || Object.keys(importedPasswords).length === 0) {
    showModal("No valid passwords found in CSV.");
    return;
  }
  const data = await chrome.storage.local.get(passwordsKey);
  const passwords = data[passwordsKey] || {};
  Object.assign(passwords, importedPasswords);
  await chrome.storage.local.set({ [passwordsKey]: passwords });
  showModal("Imported passwords successfully!");
  loadPasswords();
};

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const result = {};
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 4) continue;
    const name = parts[0].trim();
    const username = parts[2].trim();
    const password = parts[3].trim();
    const note = parts.slice(4).join(',').trim();
    if (name && password) {
      result[name] = { username, password, note };
    }
  }
  return result;
}

// =======================
// Escape HTML helper
// =======================
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[s]);
}
