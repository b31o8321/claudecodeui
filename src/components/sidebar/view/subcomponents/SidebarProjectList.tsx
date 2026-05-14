import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { TFunction } from 'i18next';

import { cn } from '../../../../lib/utils';
import type { LoadingProgress, Project, ProjectSession, LLMProvider } from '../../../../types/app';
import type { SessionWithProvider } from '../../types/types';
import {
  getProjectLastActivity,
  startOfToday,
  startOfYesterday,
  startOfThisMonday,
} from '../../utils/utils';

import SidebarProjectItem from './SidebarProjectItem';
import SidebarProjectsState from './SidebarProjectsState';

export type SidebarProjectListProps = {
  projects: Project[];
  filteredProjects: Project[];
  selectedProject: Project | null;
  selectedSession: ProjectSession | null;
  isLoading: boolean;
  loadingProgress: LoadingProgress | null;
  expandedProjects: Set<string>;
  editingProject: string | null;
  editingName: string;
  initialSessionsLoaded: Set<string>;
  currentTime: Date;
  editingSession: string | null;
  editingSessionName: string;
  deletingProjects: Set<string>;
  searchFilter: string;
  getProjectSessions: (project: Project) => SessionWithProvider[];
  onLoadMoreSessions: (projectId: string) => void;
  loadingMoreProjects: Set<string>;
  isProjectStarred: (projectName: string) => boolean;
  onEditingNameChange: (value: string) => void;
  onToggleProject: (projectName: string) => void;
  onProjectSelect: (project: Project) => void;
  onToggleStarProject: (projectName: string) => void;
  onStartEditingProject: (project: Project) => void;
  onCancelEditingProject: () => void;
  onSaveProjectName: (projectName: string) => void;
  onDeleteProject: (project: Project) => void;
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
  onNewSession: (project: Project) => void;
  onEditingSessionNameChange: (value: string) => void;
  onStartEditingSession: (sessionId: string, initialName: string) => void;
  onCancelEditingSession: () => void;
  onSaveEditingSession: (projectName: string, sessionId: string, summary: string, provider: LLMProvider) => void;
  t: TFunction;
};

type ProjectBucket = {
  key: 'starred' | 'today' | 'yesterday' | 'thisWeek' | 'older';
  label: string;
  projects: Project[];
};

function bucketProjects(projects: Project[], t: TFunction): ProjectBucket[] {
  const today = startOfToday();
  const yesterday = startOfYesterday();
  const thisMonday = startOfThisMonday();

  const starredArr: Project[] = [];
  const todayArr: Project[] = [];
  const yesterdayArr: Project[] = [];
  const thisWeekArr: Project[] = [];
  const olderArr: Project[] = [];

  for (const project of projects) {
    if (project.isStarred) {
      starredArr.push(project);
      continue;
    }

    const activity = getProjectLastActivity(project);

    if (activity >= today) {
      todayArr.push(project);
    } else if (activity >= yesterday) {
      yesterdayArr.push(project);
    } else if (activity >= thisMonday) {
      thisWeekArr.push(project);
    } else {
      olderArr.push(project);
    }
  }

  const byActivity = (a: Project, b: Project) =>
    getProjectLastActivity(b).getTime() - getProjectLastActivity(a).getTime();

  const buckets: ProjectBucket[] = [
    { key: 'starred', label: t('projects.bucketStarred'), projects: starredArr.sort(byActivity) },
    { key: 'today', label: t('projects.bucketToday'), projects: todayArr.sort(byActivity) },
    { key: 'yesterday', label: t('projects.bucketYesterday'), projects: yesterdayArr.sort(byActivity) },
    { key: 'thisWeek', label: t('projects.bucketThisWeek'), projects: thisWeekArr.sort(byActivity) },
    { key: 'older', label: t('projects.bucketOlder'), projects: olderArr.sort(byActivity) },
  ];

  return buckets.filter((bucket) => bucket.projects.length > 0);
}

export default function SidebarProjectList({
  projects,
  filteredProjects,
  selectedProject,
  selectedSession,
  isLoading,
  loadingProgress,
  expandedProjects,
  editingProject,
  editingName,
  initialSessionsLoaded,
  currentTime,
  editingSession,
  editingSessionName,
  deletingProjects,
  searchFilter,
  getProjectSessions,
  onLoadMoreSessions,
  loadingMoreProjects,
  isProjectStarred,
  onEditingNameChange,
  onToggleProject,
  onProjectSelect,
  onToggleStarProject,
  onStartEditingProject,
  onCancelEditingProject,
  onSaveProjectName,
  onDeleteProject,
  onSessionSelect,
  onDeleteSession,
  onTogglePin,
  isSessionPinned,
  onRegenerateTitle,
  isSessionTitleRegenerating,
  onNewSession,
  onEditingSessionNameChange,
  onStartEditingSession,
  onCancelEditingSession,
  onSaveEditingSession,
  t,
}: SidebarProjectListProps) {
  const [olderExpanded, setOlderExpanded] = useState(false);

  useEffect(() => {
    let baseTitle = 'CloudCLI UI';
    const displayName = selectedProject?.displayName?.trim();
    if (displayName) {
      baseTitle = `${displayName} - ${baseTitle}`;
    }
    document.title = baseTitle;
  }, [selectedProject]);

  const state = (
    <SidebarProjectsState
      isLoading={isLoading}
      loadingProgress={loadingProgress}
      projectsCount={projects.length}
      filteredProjectsCount={filteredProjects.length}
      t={t}
    />
  );

  const showProjects = !isLoading && projects.length > 0 && filteredProjects.length > 0;

  const renderProjectItem = (project: Project) => (
    <SidebarProjectItem
      key={project.projectId}
      project={project}
      selectedProject={selectedProject}
      selectedSession={selectedSession}
      isExpanded={expandedProjects.has(project.projectId)}
      isDeleting={deletingProjects.has(project.projectId)}
      isStarred={isProjectStarred(project.projectId)}
      editingProject={editingProject}
      editingName={editingName}
      sessions={getProjectSessions(project)}
      initialSessionsLoaded={initialSessionsLoaded.has(project.projectId)}
      isLoadingMoreSessions={loadingMoreProjects.has(project.projectId)}
      currentTime={currentTime}
      editingSession={editingSession}
      editingSessionName={editingSessionName}
      onEditingNameChange={onEditingNameChange}
      onToggleProject={onToggleProject}
      onProjectSelect={onProjectSelect}
      onToggleStarProject={onToggleStarProject}
      onStartEditingProject={onStartEditingProject}
      onCancelEditingProject={onCancelEditingProject}
      onSaveProjectName={onSaveProjectName}
      onDeleteProject={onDeleteProject}
      onSessionSelect={onSessionSelect}
      onDeleteSession={onDeleteSession}
      onTogglePin={onTogglePin}
      isSessionPinned={isSessionPinned}
      onRegenerateTitle={onRegenerateTitle}
      isSessionTitleRegenerating={isSessionTitleRegenerating}
      onLoadMoreSessions={onLoadMoreSessions}
      onNewSession={onNewSession}
      onEditingSessionNameChange={onEditingSessionNameChange}
      onStartEditingSession={onStartEditingSession}
      onCancelEditingSession={onCancelEditingSession}
      onSaveEditingSession={onSaveEditingSession}
      t={t}
    />
  );

  if (!showProjects) {
    return <div className="pb-safe-area-inset-bottom md:space-y-1">{state}</div>;
  }

  // When searching, render flat (no bucketing — confusing during search)
  if (searchFilter.trim()) {
    return (
      <div className="pb-safe-area-inset-bottom md:space-y-1">
        {filteredProjects.map(renderProjectItem)}
      </div>
    );
  }

  // Grouped render
  const buckets = bucketProjects(filteredProjects, t);

  return (
    <div className="pb-safe-area-inset-bottom md:space-y-1">
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
              {bucket.projects.map(renderProjectItem)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
