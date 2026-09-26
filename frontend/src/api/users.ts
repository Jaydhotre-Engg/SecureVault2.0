import { apiClient } from './client';
import { User } from '../types';

export const usersApi = {
  list: async (): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/users');
    return response.data;
  },

  getById: async (id: number): Promise<User> => {
    const response = await apiClient.get<User>(`/users/${id}`);
    return response.data;
  },

  deactivate: async (id: number): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}/deactivate`);
    return response.data;
  },

  reactivate: async (id: number): Promise<User> => {
    const response = await apiClient.patch<User>(`/users/${id}/reactivate`);
    return response.data;
  },
};
