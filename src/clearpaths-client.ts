import axios, { AxiosInstance } from 'axios';

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  area_id: number | null;
  effective_area_id: number | null;
  goal_tier_id: number;
  parent_id: number | null;
  chapter_id: number;
  completed_at: string | null;
  cancelled_at: string | null;
  deferred: boolean;
  sequential_children: boolean;
  sort_order: number;
  is_blocked: boolean;
  created_at: string;
  updated_at: string;
  area?: Area | null;
  effective_area?: Area | null;
  goal_tier?: GoalTier | null;
  children?: Goal[];
  blocked_by?: Goal[];
  blocking?: Goal[];
  comments?: GoalComment[];
}

export interface Area {
  id: number;
  description: string;
  sort_order: number;
  chapter_id: number;
  created_at: string;
  updated_at: string;
}

export interface GoalTier {
  id: number;
  description: string;
  sort_order: number;
  chapter_id: number;
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: number;
  title: string;
  focus: string | null;
  started_at: string;
  ended_at: string | null;
  is_current: boolean;
  created_at: string;
  updated_at: string;
}

export interface GoalComment {
  id: number;
  body: string;
  goal_id: number;
  created_at: string;
}

export interface GoalSummary {
  chapter_id: number;
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  deferred: number;
  blocked: number;
}

interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export class ClearpathsClient {
  private http: AxiosInstance;

  constructor(baseUrl: string, token: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
  }

  // Chapters
  async listChapters(): Promise<Chapter[]> {
    const res = await this.http.get<ApiResponse<Chapter[]>>('/api/chapters');
    return res.data.data;
  }

  async getChapter(id: number): Promise<Chapter> {
    const res = await this.http.get<ApiResponse<Chapter>>(`/api/chapters/${id}`);
    return res.data.data;
  }

  // Goals
  async listGoals(params?: {
    status?: string;
    area_id?: number;
    goal_tier_id?: number;
    parent_id?: number;
    roots_only?: boolean;
    chapter_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Goal>> {
    const res = await this.http.get<PaginatedResponse<Goal>>('/api/goals', { params });
    return res.data;
  }

  async listAllGoals(params?: {
    status?: string;
    area_id?: number;
    goal_tier_id?: number;
    parent_id?: number;
    roots_only?: boolean;
  }): Promise<Goal[]> {
    const all: Goal[] = [];
    let page = 1;
    let lastPage = 1;
    do {
      const res = await this.listGoals({ ...params, page, per_page: 100 });
      all.push(...res.data);
      lastPage = res.meta.last_page;
      page++;
    } while (page <= lastPage);
    return all;
  }

  async getGoal(id: number): Promise<Goal> {
    const res = await this.http.get<ApiResponse<Goal>>(`/api/goals/${id}`);
    return res.data.data;
  }

  async getGoalTree(id: number): Promise<Goal> {
    const res = await this.http.get<ApiResponse<Goal>>(`/api/goals/${id}/tree`);
    return res.data.data;
  }

  async createGoal(data: {
    title: string;
    description?: string;
    area_id?: number;
    goal_tier_id: number;
    parent_id?: number;
    deferred?: boolean;
  }): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>('/api/goals', data);
    return res.data.data;
  }

  async updateGoal(
    id: number,
    data: {
      title?: string;
      description?: string;
      area_id?: number;
      goal_tier_id?: number;
      parent_id?: number;
    },
  ): Promise<Goal> {
    const res = await this.http.patch<ApiResponse<Goal>>(`/api/goals/${id}`, data);
    return res.data.data;
  }

  async deleteGoal(id: number): Promise<void> {
    await this.http.delete(`/api/goals/${id}`);
  }

  async completeGoal(id: number, note?: string): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${id}/complete`, { note });
    return res.data.data;
  }

  async cancelGoal(id: number, note?: string): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${id}/cancel`, { note });
    return res.data.data;
  }

  async deferGoal(id: number, note?: string): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${id}/defer`, { note });
    return res.data.data;
  }

  async undeferGoal(id: number): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${id}/undefer`);
    return res.data.data;
  }

  async blockGoal(goalId: number, blockingGoalId: number): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${goalId}/block`, {
      blocking_goal_id: blockingGoalId,
    });
    return res.data.data;
  }

  async unblockGoal(goalId: number, blockingGoalId: number): Promise<Goal> {
    const res = await this.http.post<ApiResponse<Goal>>(`/api/goals/${goalId}/unblock`, {
      blocking_goal_id: blockingGoalId,
    });
    return res.data.data;
  }

  async getGoalSummary(chapterId?: number): Promise<GoalSummary> {
    const res = await this.http.get<GoalSummary>('/api/goals/summary', {
      params: chapterId ? { chapter_id: chapterId } : undefined,
    });
    return res.data;
  }

  // Comments
  async listComments(goalId: number): Promise<GoalComment[]> {
    const res = await this.http.get<ApiResponse<GoalComment[]>>(`/api/goals/${goalId}/comments`);
    return res.data.data;
  }

  async addComment(goalId: number, body: string): Promise<GoalComment> {
    const res = await this.http.post<ApiResponse<GoalComment>>(`/api/goals/${goalId}/comments`, {
      body,
    });
    return res.data.data;
  }

  async deleteComment(goalId: number, commentId: number): Promise<void> {
    await this.http.delete(`/api/goals/${goalId}/comments/${commentId}`);
  }

  // Areas
  async listAreas(chapterId?: number): Promise<Area[]> {
    const res = await this.http.get<ApiResponse<Area[]>>('/api/areas', {
      params: chapterId ? { chapter_id: chapterId } : undefined,
    });
    return res.data.data;
  }

  // Goal Tiers
  async listGoalTiers(chapterId?: number): Promise<GoalTier[]> {
    const res = await this.http.get<ApiResponse<GoalTier[]>>('/api/goal-tiers', {
      params: chapterId ? { chapter_id: chapterId } : undefined,
    });
    return res.data.data;
  }
}
