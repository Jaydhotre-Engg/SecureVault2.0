import { apiClient } from './client';

export interface CustodyEvent {
  id: number;
  evidence_id: number;
  event_type: string;
  user_id: number;
  timestamp: string;
  description?: string;
  from_user_id?: number;
  to_user_id?: number;
  previous_event_hash?: string;
  event_hash: string;
}

export interface CustodyChainVerificationResponse {
  status: string;
  message: string;
  failed_event_id?: number;
}

export const custodyApi = {
  getEvents: async (evidenceId: number): Promise<CustodyEvent[]> => {
    const response = await apiClient.get<CustodyEvent[]>(`/evidence/${evidenceId}/custody`);
    return response.data;
  },

  verifyChain: async (evidenceId: number): Promise<CustodyChainVerificationResponse> => {
    const response = await apiClient.post<CustodyChainVerificationResponse>(`/evidence/${evidenceId}/custody/verify`);
    return response.data;
  },

  transferCustody: async (evidenceId: number, toUserId: number, description?: string): Promise<CustodyEvent> => {
    const response = await apiClient.post<CustodyEvent>(`/evidence/${evidenceId}/custody/transfer`, {
      to_user_id: toUserId,
      description,
    });
    return response.data;
  },

  addManualEvent: async (evidenceId: number, eventType: string, description?: string): Promise<CustodyEvent> => {
    const response = await apiClient.post<CustodyEvent>(`/evidence/${evidenceId}/custody`, {
      event_type: eventType,
      description,
    });
    return response.data;
  },
};
