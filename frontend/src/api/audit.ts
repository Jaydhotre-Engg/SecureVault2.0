import { apiClient } from './client';
import { AuditLog } from '../types';

export const auditApi = {
  getLogs: async (limit: number = 100): Promise<AuditLog[]> => {
    const response = await apiClient.get<AuditLog[]>(`/users/audit-logs?limit=${limit}`);
    return response.data;
  },
};
