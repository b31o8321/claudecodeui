import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '../../../../shared/view/ui';
import { authenticatedFetch } from '../../../../utils/api';
import { getRatesForModel, estimateCost, formatCostUSD } from '../../../../utils/modelPricing';
import TokenUsagePie from './TokenUsagePie';

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

interface ProjectMeta {
  gitBranch: string | null;
  claudeMdCount: number;
  mcpServerCount: number;
}

interface TodayActivity {
  date: string;
  messageCount?: number;
  sessionCount?: number;
  toolCallCount?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  tokenBudget: TokenBudget | null;
  toolCounts: Map<string, number>;
  sessionStartedAt?: Date | number | null;
  projectId?: string | null;
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function fmtK(n: number): string {
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(' ');
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export default function ChatStatusDetailModal({
  open,
  onClose,
  tokenBudget,
  toolCounts,
  sessionStartedAt,
  projectId,
}: Props) {
  const { t } = useTranslation('chat');
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [todayActivity, setTodayActivity] = useState<TodayActivity | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());

    // Fetch project meta
    if (projectId) {
      authenticatedFetch(`/api/system/project-meta?projectId=${encodeURIComponent(projectId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => setProjectMeta(data))
        .catch(() => setProjectMeta(null));
    }

    // Fetch today's activity
    authenticatedFetch('/api/system/today-activity')
      .then(r => r.ok ? r.json() : null)
      .then(data => setTodayActivity(data))
      .catch(() => setTodayActivity(null));
  }, [open, projectId]);

  const used = tokenBudget?.used ?? 0;
  const total = tokenBudget?.total ?? 200000;
  const cumulative = tokenBudget?.cumulative;
  const model = tokenBudget?.model ?? null;
  const costUSD = tokenBudget?.costUSD ?? null;

  const sessionStart = sessionStartedAt
    ? sessionStartedAt instanceof Date
      ? sessionStartedAt
      : new Date(sessionStartedAt)
    : null;

  const durationMs = sessionStart ? now - sessionStart.getTime() : 0;

  // Cache hit rate
  const cacheHitRate = cumulative
    ? pct(cumulative.cacheReadTokens, cumulative.cacheReadTokens + cumulative.inputTokens)
    : null;

  // Cost breakdown via modelPricing utility
  const rates = getRatesForModel(model);
  const costBreakdown = (rates && cumulative) ? estimateCost(rates, cumulative) : null;

  const sortedTools = [...toolCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[85vh] w-full max-w-md overflow-y-auto p-0">
        <DialogTitle className="sr-only">{t('statusBar.detailsButton')}</DialogTitle>

        <div className="sticky top-0 flex items-center justify-between border-b bg-popover px-4 py-3">
          <span className="font-semibold">{t('statusBar.detailsButton')}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 p-4">

          {/* Session */}
          <section>
            <SectionHeader>{t('statusBar.modal.session')}</SectionHeader>
            {model && <Row label="Model" value={<span className="font-mono">{model}</span>} />}
            {projectMeta?.gitBranch && (
              <Row label="Branch" value={<span className="font-mono">🌿 {projectMeta.gitBranch}</span>} />
            )}
            {sessionStart && (
              <Row label="Started" value={sessionStart.toLocaleTimeString()} />
            )}
            {durationMs > 0 && (
              <Row label="Duration" value={formatDuration(durationMs)} />
            )}
          </section>

          {/* Context window */}
          {total > 0 && (
            <section>
              <SectionHeader>{t('statusBar.modal.contextWindow')}</SectionHeader>
              <div className="mb-2 flex items-center gap-3">
                <TokenUsagePie used={used} total={total} />
                <span className="text-sm">
                  {fmtK(used)} / {fmtK(total)} ({pct(used, total)})
                </span>
              </div>
              {cumulative && (
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Input</span>
                    <span className="font-mono">{fmtK(tokenBudget?.used ? tokenBudget.used - (cumulative.cacheReadTokens + cumulative.cacheCreationTokens) : 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cache read</span>
                    <span className="font-mono">{fmtK(cumulative.cacheReadTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cache created</span>
                    <span className="font-mono">{fmtK(cumulative.cacheCreationTokens)}</span>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Cumulative tokens */}
          {cumulative && (
            <section>
              <SectionHeader>{t('statusBar.modal.cumulativeTokens')}</SectionHeader>
              <Row label="Total input" value={<span className="font-mono">{fmt(cumulative.inputTokens)}</span>} />
              <Row label="Total output" value={<span className="font-mono">{fmt(cumulative.outputTokens)}</span>} />
              {cacheHitRate && (
                <Row label="Cache hit rate" value={cacheHitRate} />
              )}
            </section>
          )}

          {/* Cost */}
          <section>
            <SectionHeader>{t('statusBar.modal.cost')}</SectionHeader>
            {costUSD !== null ? (
              <>
                <Row label="Total" value={<span className="font-mono">{formatCostUSD(costUSD)}</span>} />
                {costBreakdown && (
                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Input</span>
                      <span className="font-mono">{formatCostUSD(costBreakdown.input)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output</span>
                      <span className="font-mono">{formatCostUSD(costBreakdown.output)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cache</span>
                      <span className="font-mono">{formatCostUSD(costBreakdown.cache)}</span>
                    </div>
                  </div>
                )}
              </>
            ) : costBreakdown ? (
              <>
                <Row label="Estimated" value={<span className="font-mono">{formatCostUSD(costBreakdown.total)}</span>} />
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Input</span>
                    <span className="font-mono">{formatCostUSD(costBreakdown.input)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output</span>
                    <span className="font-mono">{formatCostUSD(costBreakdown.output)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cache</span>
                    <span className="font-mono">{formatCostUSD(costBreakdown.cache)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {model
                  ? t('statusBar.noPricing', { model })
                  : t('statusBar.unknownModel')}
              </p>
            )}
          </section>

          {/* Tools */}
          {sortedTools.length > 0 && (
            <section>
              <SectionHeader>{t('statusBar.modal.tools')}</SectionHeader>
              <div className="space-y-0.5">
                {sortedTools.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between">
                    <span className="font-mono text-sm">{name}</span>
                    <span className="text-sm font-medium">×{count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Today's activity */}
          {todayActivity && (
            <section>
              <SectionHeader>{t('statusBar.modal.todayActivity')}</SectionHeader>
              {todayActivity.messageCount !== undefined && (
                <Row label="Messages" value={fmt(todayActivity.messageCount)} />
              )}
              {todayActivity.sessionCount !== undefined && (
                <Row label="Sessions" value={fmt(todayActivity.sessionCount)} />
              )}
              {todayActivity.toolCallCount !== undefined && (
                <Row label="Tool calls" value={fmt(todayActivity.toolCallCount)} />
              )}
            </section>
          )}

          {/* MCP / CLAUDE.md */}
          {projectMeta && (
            <section>
              <SectionHeader>{t('statusBar.modal.mcpConfig')}</SectionHeader>
              <Row label="CLAUDE.md files" value={projectMeta.claudeMdCount} />
              <Row label="MCP servers" value={projectMeta.mcpServerCount} />
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
