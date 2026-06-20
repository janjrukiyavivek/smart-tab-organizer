const groupsContainer = document.getElementById('groupsContainer');
const addGroupBtn = document.getElementById('addGroupBtn');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');
const importBtn = document.getElementById('importBtn');
const statusEl = document.getElementById('status');
const groupOthersCheckbox = document.getElementById('groupOthersCheckbox');
const otherGroupNameRow = document.getElementById('otherGroupNameRow');
const otherGroupNameInput = document.getElementById('otherGroupNameInput');
const ignorePinnedCheckbox = document.getElementById('ignorePinnedCheckbox');
const organizeNowBtn = document.getElementById('organizeNowBtn');
const cleanupBtn = document.getElementById('cleanupBtn');
const syncCheckbox = document.getElementById('syncCheckbox');
const syncStatusEl = document.getElementById('syncStatus');
const ruleSetSelect = document.getElementById('ruleSetSelect');
const newRuleSetBtn = document.getElementById('newRuleSetBtn');
const deleteRuleSetBtn = document.getElementById('deleteRuleSetBtn');
const colorPreviewEl = document.getElementById('colorPreview');

let groupOrder = [];
let groupRules = {};
let groupOthersEnabled = false;
let unmatchedGroupName = '';
let ignorePinnedTabs = false;
let ruleSets = {};
let activeRuleSet = 'Default';
let syncEnabled = false;
let syncStorageSupported = Boolean(chrome.storage?.sync);
const STATE_KEYS = ['ruleSets', 'activeRuleSet', 'syncEnabled'];
const ALLOWED_GROUP_COLORS = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const MAX_GROUPS = 100;
const MAX_RULES_PER_GROUP = 200;
const MAX_STRING_LENGTH = 256;


const STORAGE_KEYS = ['rules', 'order', 'colors', 'groupOthersEnabled', 'unmatchedGroupName', 'ignorePinnedTabs'];

function normalizeGroupColor(color, fallback = 'grey') {
  return ALLOWED_GROUP_COLORS.includes(color) ? color : fallback;
}

function normalizeColorsMap(colors) {
  const normalized = {};
  Object.entries(colors || {}).forEach(([name, color]) => {
    normalized[name] = normalizeGroupColor(color);
  });
  return normalized;
}

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, MAX_STRING_LENGTH);
}

function isSafeObjectKey(key) {
  return typeof key === 'string' && !FORBIDDEN_OBJECT_KEYS.has(key);
}

function sanitizeRules(rawRules) {
  const sanitized = {};
  if (!rawRules || typeof rawRules !== 'object' || Array.isArray(rawRules)) {
    return sanitized;
  }

  for (const [groupName, rawDomains] of Object.entries(rawRules)) {
    if (!isSafeObjectKey(groupName)) continue;
    const safeGroupName = sanitizeString(groupName);
    if (!safeGroupName) continue;
    if (!Array.isArray(rawDomains)) continue;

    const domains = rawDomains
      .filter((domain) => typeof domain === 'string')
      .map((domain) => sanitizeString(domain))
      .filter(Boolean)
      .slice(0, MAX_RULES_PER_GROUP);

    if (domains.length) {
      sanitized[safeGroupName] = domains;
      if (Object.keys(sanitized).length >= MAX_GROUPS) break;
    }
  }

  return sanitized;
}

function sanitizeOrder(rawOrder, groupNames) {
  if (!Array.isArray(rawOrder)) return groupNames.slice();
  const seen = new Set();
  const ordered = [];
  rawOrder.forEach((item) => {
    const name = sanitizeString(item);
    if (!name || !groupNames.includes(name) || seen.has(name)) return;
    seen.add(name);
    ordered.push(name);
  });
  groupNames.forEach((name) => {
    if (!seen.has(name)) ordered.push(name);
  });
  return ordered;
}

function sanitizeSettings(rawSettings) {
  const rules = sanitizeRules(rawSettings?.rules);
  const groupNames = Object.keys(rules);
  const colorsInput = (rawSettings?.colors && typeof rawSettings.colors === 'object' && !Array.isArray(rawSettings.colors))
    ? rawSettings.colors
    : {};
  const colors = {};
  groupNames.forEach((name) => {
    colors[name] = normalizeGroupColor(colorsInput[name], 'grey');
  });

  return {
    rules,
    order: sanitizeOrder(rawSettings?.order, groupNames),
    colors,
    groupOthersEnabled: Boolean(rawSettings?.groupOthersEnabled),
    unmatchedGroupName: sanitizeString(rawSettings?.unmatchedGroupName),
    ignorePinnedTabs: Boolean(rawSettings?.ignorePinnedTabs)
  };
}

function getStorageArea() {
  return syncEnabled && syncStorageSupported ? chrome.storage.sync : chrome.storage.local;
}

function persistCurrentSettings(settings, callback) {
  chrome.storage.local.set(settings, () => {
    if (syncEnabled && syncStorageSupported) {
      chrome.storage.sync.set(settings, () => {
        if (callback) callback();
      });
    } else if (callback) {
      callback();
    }
  });
}

function loadStoredState(callback) {
  if (syncStorageSupported) {
    chrome.storage.sync.get(STATE_KEYS, (syncRes) => {
      chrome.storage.local.get(STATE_KEYS, (localRes) => {
        const merged = {};
        STATE_KEYS.forEach((key) => {
          merged[key] = Object.hasOwn(syncRes, key) ? syncRes[key] : localRes[key];
        });
        callback(merged);
      });
    });
  } else {
    chrome.storage.local.get(STATE_KEYS, callback);
  }
}

function persistState(callback) {
  const state = { ruleSets, activeRuleSet, syncEnabled };
  chrome.storage.local.set(state, () => {
    if (syncEnabled && syncStorageSupported) {
      chrome.storage.sync.set(state, () => {
        if (callback) callback();
      });
    } else if (callback) {
      callback();
    }
  });
}

function removeStoredState(callback) {
  chrome.storage.local.remove(STATE_KEYS, () => {
    if (syncEnabled && syncStorageSupported) {
      chrome.storage.sync.remove(STATE_KEYS, () => {
        if (callback) callback();
      });
    } else if (callback) {
      callback();
    }
  });
}

function updateSyncStatus() {
  if (!syncStorageSupported) {
    syncCheckbox.checked = false;
    syncCheckbox.disabled = true;
    syncStatusEl.textContent = 'Sync storage not available in this browser.';
    syncStatusEl.className = 'status-area error';
    syncEnabled = false;
    return;
  }

  syncCheckbox.disabled = false;
  if (syncEnabled) {
    syncStatusEl.textContent = 'Sync enabled. Settings are saved to both local and Chrome sync storage.';
    syncStatusEl.className = 'status-area';
  } else {
    syncStatusEl.textContent = 'Sync disabled. Settings are saved locally only.';
    syncStatusEl.className = 'status-area';
  }
}

function updateRuleSetSelect() {
  ruleSetSelect.innerHTML = '';
  Object.keys(ruleSets).forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    if (name === activeRuleSet) option.selected = true;
    ruleSetSelect.appendChild(option);
  });
}

function ensureActiveRuleSet() {
  if (!Object.hasOwn(ruleSets, activeRuleSet)) {
    activeRuleSet = Object.keys(ruleSets)[0] || 'Default';
  }
  if (!Object.hasOwn(ruleSets, activeRuleSet)) {
    ruleSets[activeRuleSet] = { rules: {}, order: [], colors: {}, groupOthersEnabled: false, unmatchedGroupName: '', ignorePinnedTabs: false };
  }
}

function updateColorPreview() {
  colorPreviewEl.innerHTML = '';
  const { colors } = readEditorState();
  Object.entries(colors).forEach(([name, color]) => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = color || getAutoColor(name);
    const label = document.createElement('span');
    label.textContent = `${name} (${color || 'auto'})`;
    chip.appendChild(dot);
    chip.appendChild(label);
    colorPreviewEl.appendChild(chip);
  });
}

function saveCurrentRuleSet(showStatus = true) {
  const { rules, order, colors } = readEditorState();
  let finalOrder = order.slice();
  if (groupOthersEnabled && unmatchedGroupName) {
    if (!finalOrder.includes(unmatchedGroupName)) finalOrder.push(unmatchedGroupName);
  }
  const settings = { rules, order: finalOrder, colors, groupOthersEnabled, unmatchedGroupName, ignorePinnedTabs };
  ruleSets[activeRuleSet] = settings;
  persistState(() => {
    persistCurrentSettings(settings, () => {
      if (showStatus) setStatus('Saved settings to rule set: ' + activeRuleSet);
      updateRuleSetSelect();
    });
  });
}

function getAutoColor(name) {
  const autoColors = ['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange'];
  if (!name) return 'grey';
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = ((hash << 5) - hash) + name.codePointAt(i);
    hash = Math.trunc(hash);
  }
  return autoColors[Math.abs(hash) % autoColors.length];
}

function setStatus(msg, ok = true) {
  statusEl.textContent = msg;
  statusEl.style.color = ok ? 'green' : 'crimson';
}

function createGroupRow(title = '', domains = [], color = 'auto') {
  const row = document.createElement('div');
  row.className = 'group-row';
  row.dataset.group = title;

  const titleLabel = document.createElement('label');
  titleLabel.textContent = 'Group name';
  const titleInput = document.createElement('input');
  titleInput.value = title;
  titleInput.placeholder = 'Group name';
  titleInput.addEventListener('input', () => {
    row.dataset.group = titleInput.value.trim();
  });

  const colorLabel = document.createElement('label');
  colorLabel.textContent = 'Group color';
  const colorSelect = document.createElement('select');
  ALLOWED_GROUP_COLORS.forEach((clr) => {
    const opt = document.createElement('option');
    opt.value = clr;
    opt.textContent = clr;
    if (clr === color) opt.selected = true;
    colorSelect.appendChild(opt);
  });
  const colorSwatch = document.createElement('span');
  colorSwatch.className = 'color-swatch';
  colorSwatch.style.display = 'inline-block';
  colorSwatch.style.width = '16px';
  colorSwatch.style.height = '16px';
  colorSwatch.style.borderRadius = '50%';
  colorSwatch.style.border = '1px solid #ccc';
  colorSwatch.style.background = color;
  colorSelect.addEventListener('change', () => {
    colorSwatch.style.background = colorSelect.value;
  });

  const domainsLabel = document.createElement('label');
  domainsLabel.textContent = 'Domains (one per line)';
  const domainsArea = document.createElement('textarea');
  domainsArea.value = domains.join('\n');
  domainsArea.placeholder = 'example.com';

  function updateSwatch() {
    const value = colorSelect.value;
    colorSwatch.style.background = value === 'auto' ? getAutoColor(titleInput.value.trim() || 'group') : value;
  }

  titleInput.addEventListener('input', () => {
    row.dataset.group = titleInput.value.trim();
    if (colorSelect.value === 'auto') updateSwatch();
  });

  colorSelect.addEventListener('change', updateSwatch);
  updateSwatch();

  const controls = document.createElement('div');
  controls.className = 'controls';

  const addBtn = document.createElement('button');
  addBtn.type = 'button';
  addBtn.className = 'small';
  addBtn.textContent = '+';
  addBtn.title = 'Insert new group below';
  addBtn.addEventListener('click', () => {
    row.after(createGroupRow('', []));
  });

  const moveUp = document.createElement('button');
  moveUp.type = 'button';
  moveUp.className = 'small';
  moveUp.textContent = '▲';
  moveUp.title = 'Move up';
  moveUp.addEventListener('click', () => moveRow(row, -1));

  const moveDown = document.createElement('button');
  moveDown.type = 'button';
  moveDown.className = 'small';
  moveDown.textContent = '▼';
  moveDown.title = 'Move down';
  moveDown.addEventListener('click', () => moveRow(row, 1));

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'small remove';
  removeBtn.textContent = '−';
  removeBtn.title = 'Remove group';
  removeBtn.addEventListener('click', () => row.remove());

  controls.append(addBtn, moveUp, moveDown, removeBtn);
  row.append(titleLabel, titleInput, colorLabel, colorSelect, colorSwatch, domainsLabel, domainsArea, controls);
  return row;
}

function moveRow(row, delta) {
  const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
  if (!sibling) return;
  if (delta < 0) sibling.before(row);
  else row.before(sibling);
}

function renderGroups(colors = {}) {
  groupsContainer.innerHTML = '';
  const ordered = [...groupOrder];
  ordered.forEach((groupName) => {
    groupsContainer.appendChild(createGroupRow(groupName, groupRules[groupName] || [], colors[groupName] || 'auto'));
  });
}

function readEditorState() {
  const rows = Array.from(groupsContainer.querySelectorAll('.group-row'));
  const rules = {};
  const order = [];
  const colors = {};
  rows.forEach((row) => {
    const nameInput = row.querySelector('input');
    const area = row.querySelector('textarea');
    const colorSelect = row.querySelector('select');
    const title = nameInput.value.trim();
    if (!title) return;
    order.push(title);
    const domains = area.value.split(/\r?\n/).map(d => d.trim()).filter(Boolean);
    rules[title] = domains;
    colors[title] = colorSelect.value || 'grey';
  });
  return { rules, order, colors };
}

function loadSettings(settings) {
  groupRules = settings.rules || {};
  groupOrder = Array.isArray(settings.order) && settings.order.length
    ? settings.order
    : Object.keys(groupRules);
  groupOthersEnabled = Boolean(settings.groupOthersEnabled);
  unmatchedGroupName = settings.unmatchedGroupName || '';
  ignorePinnedTabs = Boolean(settings.ignorePinnedTabs);
  groupOthersCheckbox.checked = groupOthersEnabled;
  otherGroupNameInput.value = unmatchedGroupName;
  otherGroupNameRow.style.display = groupOthersEnabled ? '' : 'none';
  ignorePinnedCheckbox.checked = ignorePinnedTabs;
  renderGroups(settings.colors || {});
  updateColorPreview();
}

// ── Event listeners ──────────────────────────────────────────────────────────

addGroupBtn.addEventListener('click', () => {
  groupsContainer.appendChild(createGroupRow('', []));
});

saveBtn.addEventListener('click', () => {
  saveCurrentRuleSet(true);
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Clear all rule sets and settings?')) return;
  ruleSets = {};
  activeRuleSet = 'Default';
  groupRules = {};
  groupOrder = [];
  groupOthersEnabled = false;
  unmatchedGroupName = '';
  ignorePinnedTabs = false;
  syncEnabled = false;
  groupsContainer.innerHTML = '';
  removeStoredState(() => {
    chrome.storage.local.clear(() => {
      if (syncEnabled && syncStorageSupported) {
        chrome.storage.sync.clear(() => setStatus('All settings cleared.'));
      } else {
        setStatus('All settings cleared.');
      }
    });
    ensureActiveRuleSet();
    updateRuleSetSelect();
    updateSyncStatus();
    updateColorPreview();
  });
});

groupOthersCheckbox.addEventListener('change', () => {
  groupOthersEnabled = groupOthersCheckbox.checked;
  otherGroupNameRow.style.display = groupOthersEnabled ? '' : 'none';
});

otherGroupNameInput.addEventListener('input', () => {
  unmatchedGroupName = otherGroupNameInput.value.trim();
});

ignorePinnedCheckbox.addEventListener('change', () => {
  ignorePinnedTabs = ignorePinnedCheckbox.checked;
});

syncCheckbox.addEventListener('change', () => {
  syncEnabled = syncCheckbox.checked;
  updateSyncStatus();
});

organizeNowBtn.addEventListener('click', () => {
  saveCurrentRuleSet(false);
  chrome.windows.getCurrent((win) => {
    chrome.runtime.sendMessage({ action: 'organizeWindow', windowId: win.id }, (resp) => {
      setStatus(resp?.ok ? 'Organized current window.' : ('Organize failed: ' + (resp?.error || '')), Boolean(resp?.ok));
    });
  });
});

cleanupBtn.addEventListener('click', () => {
  chrome.windows.getCurrent((win) => {
    chrome.runtime.sendMessage({ action: 'cleanupEmptyGroups', windowId: win.id }, (resp) => {
      setStatus(resp?.ok ? 'Empty groups cleaned.' : ('Cleanup failed: ' + (resp?.error || '')), Boolean(resp?.ok));
    });
  });
});

exportBtn.addEventListener('click', () => {
  const { rules, order, colors } = readEditorState();
  const data = JSON.stringify({ rules, order, colors, groupOthersEnabled, unmatchedGroupName, ignorePinnedTabs }, null, 2);
  const a = document.createElement('a');
  a.href = 'data:application/json,' + encodeURIComponent(data);
  a.download = 'smart-tab-organizer-settings.json';
  a.click();
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', () => {
  const file = importFile.files[0];
  if (!file) return;
  file.text().then((text) => {
    try {
      const raw = JSON.parse(text);
      const safe = sanitizeSettings(raw);
      loadSettings(safe);
      setStatus('Settings imported. Save to apply.');
    } catch {
      setStatus('Import failed: invalid JSON.', false);
    }
  });
  importFile.value = '';
});

ruleSetSelect.addEventListener('change', () => {
  if (ruleSetSelect.value === activeRuleSet) return;
  activeRuleSet = ruleSetSelect.value;
  ensureActiveRuleSet();
  loadSettings(ruleSets[activeRuleSet] || {});
  updateRuleSetSelect();
});

newRuleSetBtn.addEventListener('click', () => {
  const name = prompt('New rule set name:');
  if (!name?.trim()) return;
  const safe = sanitizeString(name);
  if (!safe || !isSafeObjectKey(safe)) { setStatus('Invalid name.', false); return; }
  if (Object.hasOwn(ruleSets, safe)) { setStatus('Rule set already exists.', false); return; }
  ruleSets[safe] = { rules: {}, order: [], colors: {}, groupOthersEnabled: false, unmatchedGroupName: '', ignorePinnedTabs: false };
  activeRuleSet = safe;
  loadSettings(ruleSets[activeRuleSet]);
  updateRuleSetSelect();
  setStatus('New rule set created: ' + safe);
});

deleteRuleSetBtn.addEventListener('click', () => {
  if (Object.keys(ruleSets).length <= 1) { setStatus('Cannot delete the last rule set.', false); return; }
  if (!confirm('Delete rule set: ' + activeRuleSet + '?')) return;
  delete ruleSets[activeRuleSet];
  activeRuleSet = Object.keys(ruleSets)[0];
  loadSettings(ruleSets[activeRuleSet] || {});
  persistState(() => setStatus('Rule set deleted.'));
  updateRuleSetSelect();
});

groupsContainer.addEventListener('input', updateColorPreview);

// ── Initialization ────────────────────────────────────────────────────────────

loadStoredState((state) => {
  syncEnabled = Boolean(state?.syncEnabled);
  syncCheckbox.checked = syncEnabled;
  updateSyncStatus();

  if (state?.ruleSets && typeof state.ruleSets === 'object' && !Array.isArray(state.ruleSets) && Object.keys(state.ruleSets).length) {
    ruleSets = state.ruleSets;
    activeRuleSet = typeof state.activeRuleSet === 'string' && Object.hasOwn(ruleSets, state.activeRuleSet)
      ? state.activeRuleSet
      : Object.keys(ruleSets)[0];
  } else {
    // Migrate legacy flat settings
    const storageArea = syncEnabled && syncStorageSupported ? chrome.storage.sync : chrome.storage.local;
    storageArea.get(STORAGE_KEYS, (legacy) => {
      if (legacy?.rules && Object.keys(legacy.rules).length) {
        const safe = sanitizeSettings(legacy);
        ruleSets['Default'] = safe;
      } else {
        ruleSets['Default'] = { rules: {}, order: [], colors: {}, groupOthersEnabled: false, unmatchedGroupName: '', ignorePinnedTabs: false };
      }
      activeRuleSet = 'Default';
      ensureActiveRuleSet();
      loadSettings(ruleSets[activeRuleSet]);
      updateRuleSetSelect();
    });
    return;
  }

  ensureActiveRuleSet();
  loadSettings(ruleSets[activeRuleSet] || {});
  updateRuleSetSelect();
});
