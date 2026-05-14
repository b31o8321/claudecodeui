import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { TFunction } from 'i18next';

import { Button } from '../../../../shared/view/ui';
import { cn } from '../../../../lib/utils';
import type { Project, ProjectSession, LLMProvider } from '../../../../types/app';
import type { SessionWithProvider } from '../../types/types';
import { startOfToday, startOfYesterday, startOfThisMonday } from '../../utils/utils';

import SidebarSessionItem from './SidebarSessionItem';

type SidebarProjectSessionsProps = {
  project: Project;
  isExpanded: boolean;
  sessions: SessionWithProvider[];
  selectedSession: ProjectSession | null;
  initialSessionsLoaded: boolean;
  hasMoreSessions: boolean;
  isLoadingMoreSessions: boolean;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  onEditingSessionNameChange: (value: string) => void;
  onStartEditingSession: (sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  onProjectSelect: (project: Project) => void;
  onSessionSelect: (session: SessionWithProvider, projectName: string) => void;
  onDeleteSession: (
    projectName: string,
    sessionId: string,
    sessionTitle: string,
    provider: LLMProvider,
  ) => void;
  onTogglePin: (sessionId: string) => void;
  isSessionPinned: (sessionId: string) => boolean;
  onRegenerateTitle?: (sessionId: string) => void;
  isSessionTitleRegenerating?: (sessionId: string) => boolean;
  onLoadMoreSessions: (projectId: string) => void;
  onNewSession: (project: Project) => void;
  t: TFunction;
};


type SessionBucket = {
  key: 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'older';
  label: string;
  sessions: SessionWithProvider[];
};

function bucketSessions(sessions: SessionWithProvider[], isSessionPinned: (id: string) => boolean, t: TFunction): SessionBucket[] {
  const today = startOfToday();
  const yesterday = startOfYesterday();
  const thisMonday = startOfThisMonday();

  const pinned: SessionWithProvider[] = [];
  const todayArr: SessionWithProvider[] = [];
  const yesterdayArr: SessionWithProvider[] = [];
  const thisWeekArr: SessionWithProvider[] = [];
  const olderArr: SessionWithProvider[] = [];

  for (const session of sessions) {
    if (isSessionPinned(session.id)) {
      pinned.push(session);
      continue;
    }

    const activity = session.lastActivity ?? session.updated_at ?? session.created_at;
    const date = activity ? new Date(activity) : new Date(0);

    if (date >= today) {
      todayArr.push(session);
    } else if (date >= yesterday) {
      yesterdayArr.push(session);
    } else if (date >= thisMonday) {
      thisWeekArr.push(session);
    } else {
      olderArr.push(session);
    }
  }

  const byActivity = (a: SessionWithProvider, b: SessionWithProvider) => {
    const aTime = new Date(a.lastActivity ?? a.updated_at ?? a.created_at ?? 0).getTime();
    const bTime = new Date(b.lastActivity ?? b.updated_at ?? b.created_at ?? 0).getTime();
    return bTime - aTime;
  };

  const buckets: SessionBucket[] = [
    { key: 'pinned', label: t('sessions.bucketPinned'), sessions: pinned.sort(byActivity) },
    { key: 'today', label: t('sessions.bucketToday'), sessions: todayArr.sort(byActivity) },
    { key: 'yesterday', label: t('sessions.bucketYesterday'), sessions: yesterdayArr.sort(byActivity) },
    { key: 'thisWeek', label: t('sessions.bucketThisWeek'), sessions: thisWeekArr.sort(byActivity) },
    { key: 'older', label: t('sessions.bucketOlder'), sessions: olderArr.sort(byActivity) },
  ];

  return buckets.filter((bucket) => bucket.sessions.length > 0);
}

function SessionListSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="rounded-md p-2">
          <div className="flex items-start gap-2">
            <div className="mt-0.5 h-3 w-3 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1">
              <div className="h-3 animate-pulse rounded bg-muted" style={{ width: `${60 + index * 15}%` }} />
              <div className="h-2 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

export default function SidebarProjectSessions({
  project,
  isExpanded,
  sessions,
  selectedSession,
  initialSessionsLoaded,
  hasMoreSessions,
  isLoadingMoreSessions,
  currentTime,
  editingSession,
  editingSessionName,
  onEditingSessionNameChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onProjectSelect,
  onSessionSelect,
  onDeleteSession,
  onTogglePin,
  isSessionPinned,
  onRegenerateTitle,
  isSessionTitleRegenerating,
  onLoadMoreSessions,
  onNewSession,
  t,
}: SidebarProjectSessionsProps) {
  const [olderExpanded, setOlderExpanded] = useState(false);

  if (!isExpanded) {
    return null;
  }

  const hasSessions = sessions.length > 0;
  const buckets = hasSessions ? bucketSessions(sessions, isSessionPinned, t) : [];

  const renderSessionItem = (session: SessionWithProvider) => (
    <SidebarSessionItem
      key={session.id}
      project={project}
      session={session}
      selectedSession={selectedSession}
      currentTime={currentTime}
      editingSession={editingSession}
      editingSessionName={editingSessionName}
      isPinned={isSessionPinned(session.id)}
      onEditingSessionNameChange={onEditingSessionNameChange}
      onStartEditingSession={onStartEditingSession}
      onCancelEditingSession={onCancelEditingSession}
      onSaveEditingSession={onSaveEditingSession}
      onProjectSelect={onProjectSelect}
      onSessionSelect={onSessionSelect}
      onDeleteSession={onDeleteSession}
      onTogglePin={onTogglePin}
      onRegenerateTitle={onRegenerateTitle}
      isRegeneratingTitle={isSessionTitleRegenerating ? isSessionTitleRegenerating(session.id) : false}
      t={t}
    />
  );

  return (
    <div className="ml-3 space-y-1 border-l border-border pl-3">
      <div className="px-3 pb-1 pt-1 md:hidden">
        <button
          className="flex h-8 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
          onClick={() => {
            onProjectSelect(project);
            onNewSession(project);
          }}
        >
          <Plus className="h-3 w-3" />
          {t('sessions.newSession')}
        </button>
      </div>

      <Button
        variant="default"
        size="sm"
        className="hidden h-8 w-full justify-start gap-2 bg-primary text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 md:flex"
        onClick={() => onNewSession(project)}
      >
        <Plus className="h-3 w-3" />
        {t('sessions.newSession')}
      </Button>

      {!initialSessionsLoaded ? (
        <SessionListSkeleton />
      ) : !hasSessions ? (
        <div className="px-3 py-2 text-left">
          <p className="text-xs text-muted-foreground">{t('sessions.noSessions')}</p>
        </div>
      ) : (
        <>
          {buckets.map((bucket) => {
            const isOlder = bucket.key === 'older';
            return (
              <div key={bucket.key}>
                {isOlder ? (
                  <button
                    className="flex w-full items-center gap-1 px-3 py-1 text-left"
                    onClick={() => setOlderExpanded((prev) => !prev)}
                  >
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {bucket.label}
                    </span>
                    {olderExpanded ? (
                      <ChevronDown className="ml-auto h-3 w-3 text-muted-foreground/50" />
                    ) : (
                      <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground/50" />
                    )}
                  </button>
                ) : (
                  <div className="px-3 py-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      {bucket.label}
                    </span>
                  </div>
                )}
                <div className={cn(isOlder && !olderExpanded && 'hidden')}>
                  {bucket.sessions.map(renderSessionItem)}
                </div>
              </div>
            );
          })}

          {hasMoreSessions && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-center text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onLoadMoreSessions(project.projectId)}
              disabled={isLoadingMoreSessions}
            >
              {isLoadingMoreSessions ? t('sessions.loadingSessions') : 'Load more sessions'}
            </Button>
          )}
        </>
      )}
    </div>
  );
}
