export type TaskStatus = "BACKLOG" | "IN_PROGRESS" | "REVIEW" | "DONE";

export type DerivedDependencyState = "READY" | "BLOCKED" | "DONE";

export interface PrerequisiteDetail {
  id: string;
  title: string;
  status: string;
}

export interface Task {
  _id?: string;
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  startDate?: string | null;
  dueDate?: string | null;
  duration?: number;
  position?: number;
  dependencyIds: string[];
  dependencies?: PrerequisiteDetail[];
  // Computed / Derived states
  dependencyState?: DerivedDependencyState;
  isBlocked?: boolean;
  isReady?: boolean;
  blockingPrerequisites?: PrerequisiteDetail[];
  completedPrerequisites?: PrerequisiteDetail[];
  readinessPercentage?: number;
  directDownstreamCount?: number;
  transitiveDownstreamCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumnDefinition {
  id: TaskStatus;
  title: string;
  accentColor: string;
  borderAccent: string;
  bgTint: string;
}

export interface DashboardStats {
  totalTasks: number;
  backlogTasks: number;
  inProgressTasks: number;
  reviewTasks: number;
  completedTasks: number;
  blockedTasks: number;
  readyTasks: number;
}
