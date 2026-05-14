import { useState, useEffect } from 'react';
import { version } from '../../package.json';
import { ReleaseInfo } from '../types/sharedTypes';

/**
 * Compare two semantic version strings
 * Works only with numeric versions separated by dots (e.g. "1.2.3")
 * @param {string} v1
 * @param {string} v2
 * @returns positive if v1 > v2, negative if v1 < v2, 0 if equal
 */
const compareVersions = (v1: string, v2: string) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 !== p2) return p1 - p2;
  }
  return 0;
};

/**
 * Generic hook that fetches the latest release from a GitHub repo and
 * compares it to the current package.json version.
 *
 * Returns { updateAvailable, latestVersion, releaseInfo }.
 * Silently swallows 404s (repo has no releases) and network errors.
 */
export const useGitHubLatestRelease = (owner: string, repo: string) => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);

  useEffect(() => {
    const checkVersion = async () => {
      try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/latest`);

        // 404 = no releases yet for this repo — not an error, just silent
        if (response.status === 404) {
          setUpdateAvailable(false);
          setLatestVersion(null);
          setReleaseInfo(null);
          return;
        }

        const data = await response.json();

        // Handle the case where there might not be any releases
        if (data.tag_name) {
          const latest = data.tag_name.replace(/^v/, '');
          setLatestVersion(latest);
          // Only show update if latest version is actually newer
          setUpdateAvailable(compareVersions(latest, version) > 0);

          // Store release information
          setReleaseInfo({
            title: data.name || data.tag_name,
            body: data.body || '',
            htmlUrl: data.html_url || `https://github.com/${owner}/${repo}/releases/latest`,
            publishedAt: data.published_at
          });
        } else {
          // No releases found, don't show update notification
          setUpdateAvailable(false);
          setLatestVersion(null);
          setReleaseInfo(null);
        }
      } catch (error) {
        // On error, don't show update notification
        setUpdateAvailable(false);
        setLatestVersion(null);
        setReleaseInfo(null);
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [owner, repo]);

  return { updateAvailable, latestVersion, currentVersion: version, releaseInfo };
};

// Legacy alias kept for backward compatibility — checks siteboon/claudecodeui upstream.
// The `installMode` field is removed; auto-update was removed entirely.
export const useVersionCheck = (owner: string, repo: string) => {
  return useGitHubLatestRelease(owner, repo);
};

// Re-export InstallMode as a no-op type so imports in SidebarModals don't break
// during transition. Will be cleaned up after full removal.
export type InstallMode = 'git' | 'npm';
