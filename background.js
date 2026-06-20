// runtime RULES, order, unmatched-group settings, and colors can be overridden from chrome.storage via Options UI
let RULES = {};
let ORDER = [];
let groupOthersEnabled = false;
let unmatchedGroupName = '';
let COLORS = {};
let ignorePinnedTabs = false;
const ALLOWED_GROUP_COLORS = new Set(['grey', 'blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange']);

function normalizeGroupColor(color, fallback = 'grey') {
  return ALLOWED_GROUP_COLORS.has(color) ? color : fallback;
}

function normalizeColorsMap(colors) {
  const normalized = {};
  Object.entries(colors || {}).forEach(([name, color]) => {
    normalized[name] = normalizeGroupColor(color);
  });
  return normalized;
}

// Initialize RULES, order, unmatched-group settings and colors from storage if available
function loadStorageState() {
  chrome.storage.sync.get(['rules','order','colors','groupOthersEnabled','unmatchedGroupName','ignorePinnedTabs'], (syncRes) => {
    chrome.storage.local.get(['rules','order','colors','groupOthersEnabled','unmatchedGroupName','ignorePinnedTabs'], (localRes) => {
      const source = {};
      ['rules','order','colors','groupOthersEnabled','unmatchedGroupName','ignorePinnedTabs'].forEach((key) => {
        source[key] = Object.hasOwn(syncRes, key) ? syncRes[key] : localRes[key];
      });

      if (source?.rules) {
        RULES = source.rules;
        console.log('Loaded custom rules from storage');
      }
      if (Array.isArray(source?.order) && source.order.length) {
        ORDER = source.order;
      }
      if (!ORDER.length && source?.rules && typeof source.rules === 'object') {
        ORDER = Object.keys(source.rules);
      }
      if (typeof source?.groupOthersEnabled === 'boolean') {
        groupOthersEnabled = source.groupOthersEnabled;
      }
      if (typeof source?.unmatchedGroupName === 'string') {
        unmatchedGroupName = source.unmatchedGroupName;
      }
      if (source?.colors && typeof source.colors === 'object') {
        COLORS = normalizeColorsMap(source.colors);
      }
      if (typeof source?.ignorePinnedTabs === 'boolean') {
        ignorePinnedTabs = source.ignorePinnedTabs;
      }
    });
  });
}

loadStorageState();

// Listen for storage changes to update RULES, order, unmatched group config and colors live
chrome.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local' && area !== 'sync') return;

  const updateMap = {
    rules: (value) => {
      RULES = value || {};
      console.log('RULES updated from storage change');
    },
    order: (value) => {
      ORDER = Array.isArray(value) && value.length ? value : ORDER;
      console.log('ORDER updated from storage change', ORDER);
    },
    colors: (value) => {
      COLORS = normalizeColorsMap(value || {});
      console.log('COLORS updated from storage change', COLORS);
    },
    groupOthersEnabled: (value) => {
      groupOthersEnabled = Boolean(value);
      console.log('groupOthersEnabled updated from storage change', groupOthersEnabled);
    },
    unmatchedGroupName: (value) => {
      unmatchedGroupName = value || '';
      console.log('unmatchedGroupName updated from storage change', unmatchedGroupName);
    },
    ignorePinnedTabs: (value) => {
      ignorePinnedTabs = Boolean(value);
      console.log('ignorePinnedTabs updated from storage change', ignorePinnedTabs);
    }
  };

  Object.entries(changes).forEach(([key, change]) => {
    if (updateMap[key]) updateMap[key](change.newValue);
  });
});

function getGroup(hostname) {
  for (const [group, domains] of Object.entries(RULES)) {
    for (const domain of domains) {
      if (!domain) continue;
      if (domain.startsWith('*.' )) {
        const base = domain.slice(2);
        if (hostname === base || hostname.endsWith('.' + base)) return group;
      } else if (hostname === domain || hostname.endsWith('.' + domain)) {
        return group;
      }
    }
  }
  return null;
}

async function moveToGroup(tabId, groupTitle) {
  if (!groupTitle || typeof groupTitle !== 'string') return;

  const tab = await chrome.tabs.get(tabId);
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });

  // Find all groups with the desired title (possible duplicates)
  const matches = groups.filter(g => g.title === groupTitle);

  if (matches.length > 0) {
    // Ensure we use the first match as the target, and merge duplicates into it
    const target = matches[0];
    if (matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
        try {
          const other = matches[i];
          const otherTabs = await chrome.tabs.query({ groupId: other.id });
          const tabIds = otherTabs.map(t => t.id);
          if (tabIds.length) {
            await chrome.tabs.group({ groupId: target.id, tabIds });
          }
        } catch (e) {
          console.warn('Error merging groups', e);
        }
      }
    }

    await chrome.tabs.group({ groupId: target.id, tabIds: [tabId] });
    await chrome.tabGroups.update(target.id, {
      title: groupTitle,
      color: normalizeGroupColor(COLORS[groupTitle], 'grey')
    });
    return;
  }

  const groupId = await chrome.tabs.group({ tabIds: [tabId] });
  await chrome.tabGroups.update(groupId, {
    title: groupTitle,
    color: normalizeGroupColor(COLORS[groupTitle], 'grey')
  });
}

// Reorder groups in a window according to provided order array
async function reorderGroupsInWindow(windowId, order = ORDER) {
  try {
    const groups = await chrome.tabGroups.query({ windowId });
    // Map title -> group
    const groupsByTitle = {};
    for (const g of groups) groupsByTitle[g.title] = g;

    let currentIndex = 0;
    let moved = 0;
    let reorderedGroups = 0;
    for (const title of order) {
      const g = groupsByTitle[title];
      if (!g) continue;
      const tabs = await chrome.tabs.query({ windowId, groupId: g.id });
      if (!tabs.length) continue;
      const ids = tabs.map(t => t.id);
      // Move group's tabs as a block to the currentIndex
      await chrome.tabs.move(ids, { index: currentIndex });
      currentIndex += ids.length;
      moved += ids.length;
      reorderedGroups += 1;
    }

    console.log(`Reordered window ${windowId}: moved ${moved} tabs across ${reorderedGroups} groups`);
    return { moved, reorderedGroups };
  } catch (e) {
    console.error('Failed to reorder groups', e);
    throw e;
  }
}

// Clean up empty tab groups in a window
async function cleanupEmptyGroups(windowId) {
  try {
    const groups = await chrome.tabGroups.query({ windowId });
    for (const group of groups) {
      const tabs = await chrome.tabs.query({ groupId: group.id });
      if (!tabs.length) {
        await chrome.tabGroups.update(group.id, { collapsed: false });
        await chrome.tabGroups.move(group.id, { index: -1 });
      }
    }
    return true;
  } catch (e) {
    console.error('Failed cleanupEmptyGroups', e);
    throw e;
  }
}

// Handle runtime messages (from popup/options) to reorder or organize a window
chrome.runtime?.onMessage?.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'reorderWindow' && msg.windowId) {
    reorderGroupsInWindow(msg.windowId, msg.order || ORDER)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error('reorderWindow handler failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg?.action === 'organizeWindow' && msg.windowId) {
    organizeWindowTabs(msg.windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('organizeWindow handler failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg?.action === 'cleanupEmptyGroups' && msg.windowId) {
    cleanupEmptyGroups(msg.windowId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('cleanupEmptyGroups handler failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }
  if (msg?.action === 'groupCurrentTab' && msg.tabId && msg.url) {
    processTab(msg.tabId, msg.url)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('groupCurrentTab handler failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }

  if (msg?.action === 'ungroupCurrentTab' && msg.tabId) {
    chrome.tabs.ungroup(msg.tabId)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('ungroupCurrentTab handler failed', err);
        sendResponse({ ok: false, error: String(err) });
      });
    return true;
  }
});

async function processTab(tabId, url) {
  try {
    if (!url) return;
    const tab = await chrome.tabs.get(tabId);
    if (ignorePinnedTabs && tab.pinned) return;
    const hostname = new URL(url).hostname;
    let group = getGroup(hostname);
    if (!group && groupOthersEnabled && unmatchedGroupName) {
      group = unmatchedGroupName;
    }
    if (!group) return;
    await moveToGroup(tabId, group);
  } catch (e) {
    console.error(e);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    processTab(tabId, tab.url);
  }
});

async function organizeWindowTabs(windowId) {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    for (const tab of tabs) {
      if (!tab.url || tab.url.startsWith('chrome://')) continue;
      await processTab(tab.id, tab.url);
    }
  } catch (e) {
    console.error('Error organizing window:', e);
  }
}

chrome.windows.onCreated.addListener((window) => {
  organizeWindowTabs(window.id);
});

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'group-current-tab',
      title: 'Group current tab by rules',
      contexts: ['page', 'tab']
    });
    chrome.contextMenus.create({
      id: 'ungroup-current-tab',
      title: 'Ungroup current tab',
      contexts: ['page', 'tab']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.windows.getAll(async (windows) => {
    for (const window of windows) {
      await organizeWindowTabs(window.id);
    }
  });
  registerContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  registerContextMenus();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === 'group-current-tab') {
    if (tab.url) await processTab(tab.id, tab.url);
  } else if (info.menuItemId === 'ungroup-current-tab') {
    if (tab.groupId && tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE) {
      await chrome.tabs.ungroup(tab.id);
    }
  }
});
