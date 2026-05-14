import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot, GitBranch, Clock, Activity, Wrench, Info } from 'lucide-react';
import { authenticatedFetch } from '../../../../utils/api';
import ChatStatusDetailModal from './ChatStatusDetailModal';

interface TokenBudget {
  used?: number;
  total?: number;
  cumulative?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
  model?: string | null;
  costUSD?: number | null;
}

interface ChatStatusBarProps {
  tokenBudget: TokenBudget | null;
  toolCounts: Map<string, number>;
  sessionStartedAt?: Date | number | null;
  projectPath?: string | null;
  projectId?: string | null;
  permissionMode?: string;
}

interface ProjectMeta {
  gitBranch: string | null;
  claudeMdCount: number;
  mcpServerCount: number;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Normalise a raw model ID to a short readable label. */
function toShortModelLabel(model: string): string {
  // e.g. "claude-sonnet-4-6" → "Sonnet 4.6"
  return model
    .replace(/^claude-/, '')
    .replace(/-(\d)/, ' $1')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function Separator() {
  return <span className="text-muted-foreground/40 select-none">·</span>;
}

export default function ChatStatusBar({
  tokenBudget,
  toolCounts,
  sessionStartedAt,
  projectPath: _projectPath,
  projectId,
  permissionMode,
}: ChatStatusBarProps) {
  const { t } = useTranslation('chat');
  const [modalOpen, setModalOpen] = useState(false);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [, forceRender] = useState(0);

  // Re-render every 30 s to keep elapsed time live
  useEffect(() => {
    if (!sessionStartedAt) return;
    const interval = setInterval(() => forceRender((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  useEffect(() => {
    if (!projectId) {
      setProjectMeta(null);
      return;
    }
    let cancelled = false;
    authenticatedFetch(`/api/system/project-meta?projectId=${encodeURIComponent(projectId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled) setProjectMeta(data); })
      .catch(() => { if (!cancelled) setProjectMeta(null); });
    return () => { cancelled = true; };
  }, [projectId]);

  const used = tokenBudget?.used ?? 0;
  const total = tokenBudget?.total ?? 200000;
  const percentage = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const model = tokenBudget?.model ?? null;

  const modelShort = model ? toShortModelLabel(model) : null;

  const elapsedStr = sessionStartedAt
    ? formatElapsed(Date.now() - (sessionStartedAt instanceof Date ? sessionStartedAt.getTime() : sessionStartedAt))
    : null;

  // Top tools (up to 3), sorted by count desc
  const sortedTools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]);
  const topTools = sortedTools.slice(0, 3);
  const hasMoreTools = sortedTools.length > 3;

  const contextColor =
    percentage < 50
      ? 'text-blue-500 dark:text-blue-400'
      : percentage < 75
        ? 'text-amber-500 dark:text-amber-400'
        : 'text-red-500 dark:text-red-400';

  // Nothing to show yet → render nothing (returns null)
  if (!tokenBudget && toolCounts.size === 0 && !sessionStartedAt) {
    return null;
  }

  return (
    <>
      {/* Status strip — sits below the composer as a single scrollable line */}
      <div className="mx-auto mt-1 w-full max-w-4xl">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap px-1 py-0.5 text-[11px] text-muted-foreground scrollbar-hide">

          {/* Model */}
          {modelShort && (
            <span className="flex shrink-0 items-center gap-1">
              <Bot className="h-3 w-3 shrink-0" aria-hidden />
              <span className="font-mono font-medium">{modelShort}</span>
            </span>
          )}

          {/* Git branch */}
          {projectMeta?.gitBranch && (
            <>
              <Separator />
              <span className="hidden shrink-0 items-center gap-1 md:flex">
                <GitBranch className="h-3 w-3 shrink-0" aria-hidden />
                <span className="font-mono">{projectMeta.gitBranch}</span>
              </span>
            </>
          )}

          {/* Elapsed */}
          {elapsedStr && (
            <>
              <Separator />
              <span className="hidden shrink-0 items-center gap-1 md:flex">
                <Clock className="h-3 w-3 shrink-0" aria-hidden />
                <span>{elapsedStr}</span>
              </span>
            </>
          )}

          {/* Context */}
          {tokenBudget && total > 0 && (
            <>
              <Separator />
              <span className={`hidden shrink-0 items-center gap-1 md:flex ${contextColor}`}>
                <Activity className="h-3 w-3 shrink-0" aria-hidden />
                <span>
                  {t('statusBar.context')} {percentage}%{' '}
                  <span className="font-mono text-muted-foreground">
                    ({formatTokens(used)}/{formatTokens(total)})
                  </span>
                </span>
              </span>
            </>
          )}

          {/* Tools */}
          {topTools.length > 0 && (
            <>
              <Separator />
              <span className="hidden shrink-0 items-center gap-1 md:flex">
                <Wrench className="h-3 w-3 shrink-0" aria-hidden />
                <span>
                  {topTools.map(([name, count], i) => (
                    <span key={name}>
                      {i > 0 && <span className="mr-0.5 text-muted-foreground/40"> </span>}
                      <span className="font-mono">{name}×{count}</span>
                    </span>
                  ))}
                  {hasMoreTools && <span className="ml-0.5 text-muted-foreground/40">…</span>}
                </span>
              </span>
            </>
          )}

          {/* Permission mode (non-default only) */}
          {permissionMode && permissionMode !== 'default' && (
            <>
              <Separator />
              <span className="hidden shrink-0 font-mono md:inline">▶▶ {permissionMode}</span>
            </>
          )}

          {/* Info icon — always last */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="ml-auto shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            title={t('statusBar.detailsButton')}
            aria-label={t('statusBar.detailsButton')}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ChatStatusDetailModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tokenBudget={tokenBudget}
        toolCounts={toolCounts}
        sessionStartedAt={sessionStartedAt}
        projectId={projectId}
      />
    </>
  );
}
