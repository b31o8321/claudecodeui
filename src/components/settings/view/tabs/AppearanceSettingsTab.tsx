import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DarkModeToggle } from '../../../../shared/view/ui';
import type { CodeEditorSettingsState, ProjectSortOrder } from '../../types/types';
import LanguageSelector from '../../../../shared/view/ui/LanguageSelector';
import SettingsCard from '../SettingsCard';
import SettingsRow from '../SettingsRow';
import SettingsSection from '../SettingsSection';
import SettingsToggle from '../SettingsToggle';
import { authenticatedFetch } from '../../../../utils/api';

type UntitledCountResponse = {
  success?: boolean;
  data?: { count?: number };
};

type GenerateTitlesProgress = {
  completed: number;
  total: number;
};

function useAiTitles() {
  const [untitledCount, setUntitledCount] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerateTitlesProgress | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [hasError, setHasError] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await authenticatedFetch('/api/providers/sessions/untitled-count');
      if (!res.ok) {
        return;
      }
      const json = (await res.json()) as UntitledCountResponse;
      setUntitledCount(json.data?.count ?? 0);
    } catch {
      // Silently ignore
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  const startGeneration = useCallback(() => {
    if (isGenerating) {
      return;
    }

    setIsGenerating(true);
    setIsDone(false);
    setHasError(false);
    setProgress(null);

    const token = localStorage.getItem('auth-token');
    const url = '/api/providers/sessions/generate-titles';
    // EventSource doesn't support POST with a body, so we use fetch + ReadableStream
    const ctrl = new AbortController();

    fetch(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      signal: ctrl.signal,
    })
      .then(async (res) => {
        if (!res.body) {
          throw new Error('No response body');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const lines = part.split('\n');
            let eventType = 'message';
            let dataLine = '';
            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice('event: '.length).trim();
              } else if (line.startsWith('data: ')) {
                dataLine = line.slice('data: '.length).trim();
              }
            }

            if (!dataLine) {
              continue;
            }

            let parsed: GenerateTitlesProgress | null = null;
            try {
              parsed = JSON.parse(dataLine) as GenerateTitlesProgress;
            } catch {
              continue;
            }

            if (eventType === 'progress') {
              setProgress(parsed);
            } else if (eventType === 'done') {
              setProgress(parsed);
              setIsDone(true);
              setIsGenerating(false);
              void fetchCount();
            } else if (eventType === 'error') {
              setHasError(true);
              setIsGenerating(false);
            }
          }
        }
      })
      .catch((err: unknown) => {
        const isAbort = err instanceof DOMException && err.name === 'AbortError';
        if (!isAbort) {
          setHasError(true);
        }
        setIsGenerating(false);
      });

    // Store abort fn so component cleanup can cancel
    eventSourceRef.current = { abort: () => ctrl.abort() } as unknown as EventSource;
  }, [isGenerating, fetchCount]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        (eventSourceRef.current as unknown as { abort: () => void }).abort?.();
      }
    };
  }, []);

  return { untitledCount, isGenerating, progress, isDone, hasError, startGeneration };
}

type AppearanceSettingsTabProps = {
  projectSortOrder: ProjectSortOrder;
  onProjectSortOrderChange: (value: ProjectSortOrder) => void;
  codeEditorSettings: CodeEditorSettingsState;
  onCodeEditorThemeChange: (value: 'dark' | 'light') => void;
  onCodeEditorWordWrapChange: (value: boolean) => void;
  onCodeEditorShowMinimapChange: (value: boolean) => void;
  onCodeEditorLineNumbersChange: (value: boolean) => void;
  onCodeEditorFontSizeChange: (value: string) => void;
  defaultWorkspacePath: string;
  onDefaultWorkspacePathChange: (value: string) => void;
};

export default function AppearanceSettingsTab({
  projectSortOrder,
  onProjectSortOrderChange,
  codeEditorSettings,
  onCodeEditorThemeChange,
  onCodeEditorWordWrapChange,
  onCodeEditorShowMinimapChange,
  onCodeEditorLineNumbersChange,
  onCodeEditorFontSizeChange,
  defaultWorkspacePath,
  onDefaultWorkspacePathChange,
}: AppearanceSettingsTabProps) {
  const { t } = useTranslation('settings');
  const { untitledCount, isGenerating, progress, isDone, hasError, startGeneration } = useAiTitles();

  return (
    <div className="space-y-8">
      <SettingsSection title={t('appearanceSettings.darkMode.label')}>
        <SettingsCard>
          <SettingsRow
            label={t('appearanceSettings.darkMode.label')}
            description={t('appearanceSettings.darkMode.description')}
          >
            <DarkModeToggle ariaLabel={t('appearanceSettings.darkMode.label')} />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('mainTabs.appearance')}>
        <SettingsCard>
          <LanguageSelector />
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('appearanceSettings.projectSorting.label')}>
        <SettingsCard>
          <SettingsRow
            label={t('appearanceSettings.projectSorting.label')}
            description={t('appearanceSettings.projectSorting.description')}
          >
            <select
              value={projectSortOrder}
              onChange={(event) => onProjectSortOrderChange(event.target.value as ProjectSortOrder)}
              className="w-full rounded-lg border border-input bg-card p-2.5 text-sm text-foreground touch-manipulation focus:border-primary focus:ring-1 focus:ring-primary sm:w-36"
            >
              <option value="name">{t('appearanceSettings.projectSorting.alphabetical')}</option>
              <option value="date">{t('appearanceSettings.projectSorting.recentActivity')}</option>
            </select>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('appearanceSettings.defaultWorkspacePath.label')}>
        <SettingsCard>
          <SettingsRow
            label={t('appearanceSettings.defaultWorkspacePath.label')}
            description={t('appearanceSettings.defaultWorkspacePath.helper')}
          >
            <input
              type="text"
              value={defaultWorkspacePath}
              onChange={(event) => onDefaultWorkspacePathChange(event.target.value)}
              placeholder={t('appearanceSettings.defaultWorkspacePath.placeholder')}
              className="w-full rounded-lg border border-input bg-card p-2.5 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary sm:w-64"
            />
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('appearanceSettings.aiTitles.sectionTitle')}>
        <SettingsCard>
          <SettingsRow
            label={t('appearanceSettings.aiTitles.sectionTitle')}
            description={t('appearanceSettings.aiTitles.description')}
          >
            <div className="flex flex-col items-end gap-2">
              {untitledCount !== null && !isGenerating && !isDone && (
                <span className="text-sm text-muted-foreground">
                  {t('appearanceSettings.aiTitles.countLabel', { count: untitledCount })}
                </span>
              )}
              {isGenerating && progress && (
                <div className="w-40">
                  <div className="mb-1 text-xs text-muted-foreground text-right">
                    {t('appearanceSettings.aiTitles.generating', {
                      completed: progress.completed,
                      total: progress.total,
                    })}
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-primary transition-all"
                      style={{
                        width: progress.total > 0
                          ? `${Math.min(100, Math.round((progress.completed / progress.total) * 100))}%`
                          : '0%',
                      }}
                    />
                  </div>
                </div>
              )}
              {isDone && (
                <span className="text-sm text-green-600 dark:text-green-400">
                  {t('appearanceSettings.aiTitles.done')}
                </span>
              )}
              {hasError && (
                <span className="text-sm text-destructive">
                  {t('appearanceSettings.aiTitles.error')}
                </span>
              )}
              <button
                type="button"
                disabled={isGenerating || (untitledCount !== null && untitledCount === 0)}
                onClick={startGeneration}
                className="rounded-lg border border-input bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating
                  ? t('appearanceSettings.aiTitles.generating', {
                      completed: progress?.completed ?? 0,
                      total: progress?.total ?? 0,
                    })
                  : t('appearanceSettings.aiTitles.generateButton')}
              </button>
            </div>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>

      <SettingsSection title={t('appearanceSettings.codeEditor.title')}>
        <SettingsCard divided>
          <SettingsRow
            label={t('appearanceSettings.codeEditor.theme.label')}
            description={t('appearanceSettings.codeEditor.theme.description')}
          >
            <DarkModeToggle
              checked={codeEditorSettings.theme === 'dark'}
              onToggle={(enabled) => onCodeEditorThemeChange(enabled ? 'dark' : 'light')}
              ariaLabel={t('appearanceSettings.codeEditor.theme.label')}
            />
          </SettingsRow>

          <SettingsRow
            label={t('appearanceSettings.codeEditor.wordWrap.label')}
            description={t('appearanceSettings.codeEditor.wordWrap.description')}
          >
            <SettingsToggle
              checked={codeEditorSettings.wordWrap}
              onChange={onCodeEditorWordWrapChange}
              ariaLabel={t('appearanceSettings.codeEditor.wordWrap.label')}
            />
          </SettingsRow>

          <SettingsRow
            label={t('appearanceSettings.codeEditor.showMinimap.label')}
            description={t('appearanceSettings.codeEditor.showMinimap.description')}
          >
            <SettingsToggle
              checked={codeEditorSettings.showMinimap}
              onChange={onCodeEditorShowMinimapChange}
              ariaLabel={t('appearanceSettings.codeEditor.showMinimap.label')}
            />
          </SettingsRow>

          <SettingsRow
            label={t('appearanceSettings.codeEditor.lineNumbers.label')}
            description={t('appearanceSettings.codeEditor.lineNumbers.description')}
          >
            <SettingsToggle
              checked={codeEditorSettings.lineNumbers}
              onChange={onCodeEditorLineNumbersChange}
              ariaLabel={t('appearanceSettings.codeEditor.lineNumbers.label')}
            />
          </SettingsRow>

          <SettingsRow
            label={t('appearanceSettings.codeEditor.fontSize.label')}
            description={t('appearanceSettings.codeEditor.fontSize.description')}
          >
            <select
              value={codeEditorSettings.fontSize}
              onChange={(event) => onCodeEditorFontSizeChange(event.target.value)}
              className="w-full rounded-lg border border-input bg-card p-2.5 text-sm text-foreground touch-manipulation focus:border-primary focus:ring-1 focus:ring-primary sm:w-28"
            >
              <option value="10">10px</option>
              <option value="11">11px</option>
              <option value="12">12px</option>
              <option value="13">13px</option>
              <option value="14">14px</option>
              <option value="15">15px</option>
              <option value="16">16px</option>
              <option value="18">18px</option>
              <option value="20">20px</option>
            </select>
          </SettingsRow>
        </SettingsCard>
      </SettingsSection>
    </div>
  );
}
