import { apiClient } from './client';
import { Evidence, UploadEvidenceResponse, VerifyEvidenceResponse, BlockchainVerificationResponse, UnifiedVerificationResponse } from '../types';

export const evidenceApi = {
  list: async (): Promise<Evidence[]> => {
    const response = await apiClient.get<Evidence[]>('/evidence');
    return response.data;
  },

  getById: async (id: number): Promise<Evidence> => {
    const response = await apiClient.get<Evidence>(`/evidence/${id}`);
    return response.data;
  },

  upload: async (caseId: number, file: File): Promise<UploadEvidenceResponse> => {
    const formData = new FormData();
    formData.append('case_id', String(caseId));
    formData.append('file', file);

    const response = await apiClient.post<UploadEvidenceResponse>('/evidence/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  verify: async (id: number): Promise<VerifyEvidenceResponse> => {
    const response = await apiClient.post<VerifyEvidenceResponse>(`/evidence/${id}/verify`);
    return response.data;
  },

  verifyBlockchain: async (id: number): Promise<BlockchainVerificationResponse> => {
    const response = await apiClient.post<BlockchainVerificationResponse>(`/evidence/${id}/blockchain/verify`);
    return response.data;
  },

  unifiedVerify: async (id: number): Promise<UnifiedVerificationResponse> => {
    const response = await apiClient.post<UnifiedVerificationResponse>(`/evidence/${id}/unified-verify`);
    return response.data;
  },

  download: async (id: number, filename: string): Promise<void> => {
    const response = await apiClient.get(`/evidence/${id}/download`, {
      responseType: 'blob',
    });

    // Create a Blob from the PDF Stream
    const file = new Blob([response.data], { type: 'application/octet-stream' });

    // Build a URL from the file
    const fileURL = URL.createObjectURL(file);

    // Construct the 'a' element and click it
    const downloadLink = document.createElement('a');
    downloadLink.href = fileURL;
    downloadLink.setAttribute('download', filename);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(fileURL);
  }
};