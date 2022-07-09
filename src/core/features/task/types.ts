export interface Task {
  id: string;
  title: string;
  detail?: string;
  is_complete: boolean;
  created_at: string;
}

export interface TaskState extends Task {
  userId: string;
}
