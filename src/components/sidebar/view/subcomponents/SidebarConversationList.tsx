import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TFunction } from 'i18next';

import { cn } from '../../../../lib/utils';
import type { Project, ProjectSession, LLMProvider } from '../../../../types/app';
import type { SessionWithProvider } from '../../types/types';
import {
  getAllSessions,
  getSessionDate,
  startOfToday,
  startOfYesterday,
  startOfThisMonday,
} from '../../utils/utils';
import SidebarSessionItem from './SidebarSessionItem';

type FlatSession = SessionWithProvider & {
  __projectId: string;
  __projectDisplayName: string;
  __projectPath: string;
};

type SessionBucketKey = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'older';

type SessionBucket = {
  key: SessionBucketKey;
  label: string;
  sessions: FlatSession[];
};

function flattenAllSessions(projects: Project[]): FlatSession[] {
  const result: FlatSession[] = [];
  for (const project of projects) {
    const sessions = getAllSessions(project);
    for (const session of sessions) {
      result.push({
        ...session,
        __projectId: project.projectId,
        __projectDisplayName: project.displayName || project.projectId,
        __projectPath: project.fullPath || project.path || '',
      });
    }
  }
  return result;
}

function bucketFlatSessions(
  sessions: FlatSession[],
  isSessionPinned: (id: string) => boolean,
  t: TFunction,
): SessionBucket[] {
  const today = startOfToday();
  const yesterday = startOfYesterday();
  const thisMonday = startOfThisMonday();

  const pinned: FlatSession[] = [];
  const todayArr: FlatSession[] = [];
  const yesterdayArr: FlatSession[] = [];
  const thisWeekArr: FlatSession[] = [];
  const olderArr: FlatSession[] = [];

  for (const session of sessions) {
    if (isSessionPinned(session.id)) {
      pinned.push(session);
      continue;
    }

    const date = getSessionDate(session);
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

  const byDate = (a: FlatSession, b: FlatSession) =>
    getSessionDate(b).getTime() - getSessionDate(a).getTime();

  const buckets: SessionBucket[] = [
    { key: 'pinned', label: t('sessions.bucketPinned', 'Pinned'), sessions: pinned.sort(byDate) },
    { key: 'today', label: t('sessions.bucketToday', 'Today'), sessions: todayArr.sort(byDate) },
    { key: 'yesterday', label: t('sessions.bucketYesterday', 'Yesterday'), sessions: yesterdayArr.sort(byDate) },
    { key: 'thisWeek', label: t('sessions.bucketThisWeek', 'This Week'), sessions: thisWeekArr.sort(byDate) },
    { key: 'older', label: t('sessions.bucketOlder', 'Older'), sessions: olderArr.sort(byDate) },
  ];

  return buckets.filter((bucket) => bucket.sessions.length > 0);
}

type SidebarConversationListProps = {
  projects: Project[];
  selectedSession: ProjectSession | null;
  selectedProject: Project | null;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  onEditingSessionNameChange: (value: string) => void;
  onStartEditingSession: (sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectId: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  onSessionSelect: (session: FlatSession) => void;
  onDeleteSession: (projectId: string, sessionId: string, sessionTitle: string, provider: LLMProvider) => void;
  onTogglePin: (sessionId: string) => void;
  isSessionPinned: (sessionId: string) => boolean;
  onRegenerateTitle?: (sessionId: string) => void;
  isSessionTitleRegenerating?: (sessionId: string) => boolean;
  t: TFunction;
};

export default function SidebarConversationList({
  projects,
  selectedSession,
  currentTime,
  editingSession,
  editingSessionName,
  onEditingSessionNameChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  onSessionSelect,
  onDeleteSession,
  onTogglePin,
  isSessionPinned,
  onRegenerateTitle,
  isSessionTitleRegenerating,
  t,
}: SidebarConversationListProps) {
  const [olderExpanded, setOlderExpanded] = useState(false);

  const allSessions = flattenAllSessions(projects);

  if (allSessions.length === 0) {
    return (
      <div className="px-4 py-12 text-center md:py-8">
        <p className="text-sm text-muted-foreground">
          {t('conversations.empty', 'No conversations yet')}
        </p>
      </div>
    );
  }

  const buckets = bucketFlatSessions(allSessions, isSessionPinned, t);

  // A stub project used to satisfy SidebarSessionItem's `project` prop.
  // The project name line below session title is rendered via __projectDisplayName.
  const stubProject = (session: FlatSession): Project => {
    const match = projects.find((p) => p.projectId === session.__projectId);
    if (match) return match;
    // Orphan session — parent project no longer exists. Return a minimal stub.
    return {
      projectId: session.__projectId,
      displayName: session.__projectDisplayName,
      path: session.__projectPath,
      fullPath: session.__projectPath,
      sessions: [],
    } as unknown as Project;
  };

  return (
    <div className="space-y-1">
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
              {bucket.sessions.map((session) => {
                const project = stubProject(session);
                return (
                  <SidebarSessionItem
                    key={`${session.__projectId}:${session.id}`}
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
                    onProjectSelect={() => {
                      // no-op: project selection is handled inside onSessionSelect
                    }}
                    onSessionSelect={() => {
                      onSessionSelect(session);
                    }}
                    onDeleteSession={onDeleteSession}
                    onTogglePin={onTogglePin}
                    onRegenerateTitle={onRegenerateTitle}
                    isRegeneratingTitle={isSessionTitleRegenerating ? isSessionTitleRegenerating(session.id) : false}
                    showProjectName
                    t={t}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
