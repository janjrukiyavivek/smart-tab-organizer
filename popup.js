document.getElementById('organizeBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('organizeBtn');

  btn.disabled = true;
  statusEl.className = 'status';

  try {
    const window = await chrome.windows.getCurrent();
    const tabs = await chrome.tabs.query({ windowId: window.id });

    let organized = 0;
    let skipped = 0;

    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) {
        skipped++;
        continue;
      }

      try {
        const hostname = new URL(tab.url).hostname;
        const group = await getGroupForHostname(hostname);
        const groupTitle = group || (groupOthersEnabled && unmatchedGroupName ? unmatchedGroupName : null);

        if (!groupTitle) {
          skipped++;
          continue;
        }

        await organizeTab(tab.id, groupTitle);
        organized++;
      } catch (e) {
        console.error('Failed to organize tab:', tab.url, e);
        skipped++;
      }
    }

    const win = await chrome.windows.getCurrent();
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'reorderWindow', windowId: win.id }, (resp) => {
        if (!resp?.ok) {
          console.warn('Reorder after organize failed', resp?.error);
        }
        resolve();
      });
    });

    statusEl.className = 'status success';
    statusEl.textContent = `✓ Organized ${organized} tabs`;
  } catch (err) {
    console.error('Error:', err);
    statusEl.className = 'status error';
    statusEl.textContent = `✗ Error organizing tabs`;
  } finally {
    btn.disabled = false;
    setTimeout(() => {
      statusEl.className = 'status';
    }, 3000);
  }
});

document.getElementById('reorderBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('status');
  const btn = document.getElementById('reorderBtn');
  btn.disabled = true;
  statusEl.className = 'status';

  try {
    const win = await chrome.windows.getCurrent();
    // Ask background to reorder using default order
    chrome.runtime.sendMessage({ action: 'reorderWindow', windowId: win.id }, (resp) => {
      if (resp?.ok) {
        const moved = resp.moved || 0;
        const groups = resp.reorderedGroups || 0;
        statusEl.className = 'status success';
        statusEl.textContent = `✓ Reordered window — moved ${moved} tabs in ${groups} groups`;
      } else {
        statusEl.className = 'status error';
        statusEl.textContent = resp?.error ? `✗ Reorder failed: ${resp.error}` : '✗ Reorder failed';
      }
      btn.disabled = false;
      setTimeout(() => statusEl.className = 'status', 3500);
    });
  } catch (e) {
    console.error('Reorder failed', e);
    statusEl.className = 'status error';
    statusEl.textContent = '✗ Reorder failed';
    btn.disabled = false;
    setTimeout(() => statusEl.className = 'status', 2500);
  }
});

async function updatePopupMessage(text, isError = false) {
  const statusEl = document.getElementById('status');
  statusEl.className = isError ? 'status error' : 'status success';
  statusEl.textContent = text;
  setTimeout(() => {
    statusEl.className = 'status';
    statusEl.textContent = '';
  }, 3500);
}

async function sendTabAction(action, successText, failureText) {
  const statusEl = document.getElementById('status');
  const tabButton = document.getElementById(action === 'groupCurrentTab' ? 'groupTabBtn' : 'ungroupTabBtn');
  tabButton.disabled = true;
  statusEl.className = 'status';
  statusEl.textContent = action === 'groupCurrentTab' ? 'Grouping current tab...' : 'Ungrouping current tab...';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('No active tab found');
    await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action, tabId: tab.id, url: tab.url }, (resp) => {
        if (resp?.ok) {
          updatePopupMessage(successText, false);
        } else {
          updatePopupMessage(resp?.error ? `${failureText}: ${resp.error}` : failureText, true);
        }
        resolve();
      });
    });
  } catch (e) {
    updatePopupMessage(`✗ ${e.message}`, true);
  } finally {
    tabButton.disabled = false;
  }
}

document.getElementById('groupTabBtn').addEventListener('click', () => {
  sendTabAction('groupCurrentTab', '✓ Current tab grouped', '✗ Failed to group tab');
});

document.getElementById('ungroupTabBtn').addEventListener('click', () => {
  sendTabAction('ungroupCurrentTab', '✓ Current tab ungrouped', '✗ Failed to ungroup tab');
});

let RULES_CACHE = null;
let groupOthersEnabled = false;
let unmatchedGroupName = '';
let COLORS = {};

function getRuleSource() {
  return new Promise((resolve) => {
    if (RULES_CACHE) return resolve(RULES_CACHE);
    chrome.storage.local.get(['rules', 'groupOthersEnabled', 'unmatchedGroupName', 'colors'], (res) => {
      RULES_CACHE = res?.rules ?? {};
      groupOthersEnabled = Boolean(res?.groupOthersEnabled);
      unmatchedGroupName = typeof res?.unmatchedGroupName === 'string' ? res.unmatchedGroupName : '';
      COLORS = res?.colors || {};
      resolve(RULES_CACHE);
    });
  });
}

async function getGroupForHostname(hostname) {
  const RULES = await getRuleSource();
  for (const [group, domains] of Object.entries(RULES)) {
    for (const domain of domains) {
      if (hostname === domain || hostname.endsWith("." + domain)) {
        return group;
      }
    }
  }
  return null;
}

async function organizeTab(tabId, groupTitle) {
  if (!groupTitle || typeof groupTitle !== 'string') {
    console.warn('Skipping organizeTab because groupTitle is not a valid string', groupTitle);
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const existing = groups.find(g => g.title === groupTitle);

  if (existing) {
    await chrome.tabs.group({ groupId: existing.id, tabIds: [tabId] });
    return;
  }

  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups.update(groupId, {
    title: groupTitle,
    color: COLORS[groupTitle] || "grey"
  });
}
