import { Settings, ArrowUpCircle, Bug } from 'lucide-react';
import type { TFunction } from 'i18next';
import { IS_PLATFORM } from '../../../../constants/config';
import type { ReleaseInfo } from '../../../../types/sharedTypes';

const GITHUB_ISSUES_URL = 'https://github.com/b31o8321/claudecodeui/issues/new';
const GITHUB_REPO_URL = 'https://github.com/b31o8321/claudecodeui';

type SidebarFooterProps = {
  // Upstream (siteboon) update
  updateAvailable: boolean;
  releaseInfo: ReleaseInfo | null;
  latestVersion: string | null;
  currentVersion: string;
  onShowVersionModal: () => void;
  // Fork (b31o8321) update
  forkUpdateAvailable: boolean;
  forkLatestVersion: string | null;
  onShowForkModal: () => void;
  onShowSettings: () => void;
  t: TFunction;
};

export default function SidebarFooter({
  updateAvailable,
  releaseInfo,
  latestVersion,
  currentVersion,
  onShowVersionModal,
  forkUpdateAvailable,
  forkLatestVersion,
  onShowForkModal,
  onShowSettings,
  t,
}: SidebarFooterProps) {
  return (
    <div className="flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}>
      {/* Compact update pills — tiny icon buttons, click to open detail modal */}
      {(updateAvailable || forkUpdateAvailable) && (
        <>
          <div className="nav-divider" />
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {updateAvailable && (
              <button
                className="group flex items-center gap-1 rounded-full bg-blue-50/80 px-2 py-0.5 text-[10px] font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:bg-blue-900/15 dark:text-blue-300 dark:hover:bg-blue-900/30"
                onClick={onShowVersionModal}
                title={t('update.upstreamBadge')}
                aria-label={t('update.upstreamBadge')}
              >
                <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                </span>
                <ArrowUpCircle className="h-3 w-3" />
                <span className="tabular-nums">v{latestVersion}</span>
              </button>
            )}
            {forkUpdateAvailable && (
              <button
                className="group flex items-center gap-1 rounded-full bg-green-50/80 px-2 py-0.5 text-[10px] font-medium text-green-600 transition-colors hover:bg-green-100 dark:bg-green-900/15 dark:text-green-300 dark:hover:bg-green-900/30"
                onClick={onShowForkModal}
                title={t('update.forkBadge')}
                aria-label={t('update.forkBadge')}
              >
                <span className="relative flex h-1.5 w-1.5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
                </span>
                <ArrowUpCircle className="h-3 w-3" />
                <span className="tabular-nums">v{forkLatestVersion}</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Community + Settings */}
      <div className="nav-divider" />

      {/* Desktop Report Issue */}
      <div className="hidden px-2 pt-1.5 md:block">
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          <Bug className="h-3.5 w-3.5" />
          <span className="text-sm">{t('actions.reportIssue')}</span>
        </a>
      </div>

      {/* Desktop settings */}
      <div className="hidden px-2 py-1.5 md:block">
        <button
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          onClick={onShowSettings}
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="text-sm">{t('actions.settings')}</span>
        </button>
      </div>

      {/* Desktop version brand line (OSS mode only) */}
      {!IS_PLATFORM && (
        <div className="hidden px-3 py-2 text-center md:block">
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-muted-foreground/40 transition-colors hover:text-muted-foreground"
          >
            CloudCLI v{currentVersion} – {t('branding.openSource')}
          </a>
        </div>
      )}

      {/* Mobile Report Issue */}
      <div className="px-3 pt-3 md:hidden">
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 w-full items-center gap-3.5 rounded-xl bg-muted/40 px-4 transition-all hover:bg-muted/60 active:scale-[0.98]"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-background/80">
            <Bug className="w-4.5 h-4.5 text-muted-foreground" />
          </div>
          <span className="text-base font-medium text-foreground">{t('actions.reportIssue')}</span>
        </a>
      </div>

      {/* Mobile settings */}
      <div className="px-3 pb-3 pt-2 md:hidden">
        <button
          className="flex h-12 w-full items-center gap-3.5 rounded-xl bg-muted/40 px-4 transition-all hover:bg-muted/60 active:scale-[0.98]"
          onClick={onShowSettings}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-background/80">
            <Settings className="w-4.5 h-4.5 text-muted-foreground" />
          </div>
          <span className="text-base font-medium text-foreground">{t('actions.settings')}</span>
        </button>
      </div>
    </div>
  );
}
