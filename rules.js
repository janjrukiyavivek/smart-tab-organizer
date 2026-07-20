// Shared rule-matching logic used by background.js and popup.js.
// Keeping one implementation avoids the two matchers drifting apart.

function ruleHostMatches(hostname, ruleHost) {
  if (!ruleHost) return false;
  if (ruleHost.startsWith('*.')) {
    const base = ruleHost.slice(2);
    return hostname === base || hostname.endsWith('.' + base);
  }
  return hostname === ruleHost || hostname.endsWith('.' + ruleHost);
}

function stripSlashes(value) {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '/') start++;
  while (end > start && value[end - 1] === '/') end--;
  return value.slice(start, end);
}

function rulePathMatches(pathname, rulePath) {
  const trimmedRule = stripSlashes(rulePath);
  if (!trimmedRule) return true;
  const normalizedPath = pathname || '/';
  const prefix = '/' + trimmedRule;
  return normalizedPath === prefix || normalizedPath.startsWith(prefix + '/');
}

function ruleMatchesUrl(rule, hostname, pathname) {
  if (!rule) return false;

  if (rule.startsWith('contains:')) {
    const needle = rule.slice('contains:'.length);
    return Boolean(needle) && hostname.includes(needle);
  }

  if (rule.startsWith('regex:')) {
    const pattern = rule.slice('regex:'.length);
    if (!pattern) return false;
    try {
      return new RegExp(pattern).test(hostname);
    } catch {
      return false;
    }
  }

  const slashIndex = rule.indexOf('/');
  if (slashIndex === -1) return ruleHostMatches(hostname, rule);

  const ruleHost = rule.slice(0, slashIndex);
  const rulePath = rule.slice(slashIndex + 1);
  return ruleHostMatches(hostname, ruleHost) && rulePathMatches(pathname, rulePath);
}

function findGroupForUrl(rules, hostname, pathname) {
  for (const [group, domains] of Object.entries(rules || {})) {
    if (!Array.isArray(domains)) continue;
    for (const domain of domains) {
      if (ruleMatchesUrl(domain, hostname, pathname)) return group;
    }
  }
  return null;
}
