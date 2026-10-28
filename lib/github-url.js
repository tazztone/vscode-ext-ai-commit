'use strict';

/**
 * Convert a git remote URL (SSH, HTTPS, with/without auth or ports) to a GitHub web URL.
 * e.g.:
 * - git@github.com:user/repo.git -> https://github.com/user/repo
 * - ssh://git@github.com/user/repo.git -> https://github.com/user/repo
 * - ssh://git@github.com:22/user/repo.git -> https://github.com/user/repo
 * - https://github.com/user/repo.git -> https://github.com/user/repo
 * - https://token@github.com/user/repo.git -> https://github.com/user/repo
 */
function gitRemoteToGitHubUrl(remoteUrl){
  if(!remoteUrl || typeof remoteUrl !== 'string') return null;
  const trimmed = remoteUrl.trim();

  // SCP-style SSH: git@github.com:owner/repo(.git)
  if(/^git@github\.com:/.test(trimmed)){
    const pathPart = trimmed.slice('git@github.com:'.length).replace(/\.git\/?$/, '').replace(/^\/+|\/+$/g, '');
    if(pathPart && pathPart.includes('/')) return `https://github.com/${pathPart}`;
  }

  // URL-style: ssh://... or https://...
  try {
    const parsed = new URL(trimmed);
    if(parsed.hostname.toLowerCase() === 'github.com'){
      const pathPart = parsed.pathname.replace(/\.git\/?$/, '').replace(/^\/+|\/+$/g, '');
      if(pathPart && pathPart.includes('/')) return `https://github.com/${pathPart}`;
    }
  } catch {
    // ignore invalid URL parsing
  }

  return null;
}

module.exports = { gitRemoteToGitHubUrl };
