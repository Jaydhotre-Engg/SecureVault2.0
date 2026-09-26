import { apiClient } from './client';
import {
  Case,
  CreateCaseRequest,
  UpdateCaseRequest,
} from '../types';

export const casesApi = {

  list: async (): Promise<Case[]> => {
    const response = await apiClient.get<Case[]>('/cases');
    return response.data;
  },

  getById: async (id: number): Promise<Case> => {
    const response = await apiClient.get<Case>(`/cases/${id}`);
    return response.data;
  },

  create: async (
    data: CreateCaseRequest
  ): Promise<Case> => {
    const response = await apiClient.post<Case>(
      '/cases',
      data
    );

    return response.data;
  },

  update: async (
    id: number,
    data: UpdateCaseRequest
  ): Promise<Case> => {
    const response = await apiClient.patch<Case>(
      `/cases/${id}`,
      data
    );

    return response.data;
  },
};