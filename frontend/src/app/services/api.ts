import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { APIResponse, PaginatedResponse } from '../types';
import { apiBaseURL, attachAuthentication } from './http';

class APIService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: apiBaseURL,
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    attachAuthentication(this.api);
  }

  // Generic request methods
  async get<T>(url: string, params?: any): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.api.get(url, { params });
      return response.data;
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async post<T>(url: string, data?: any, config?: any): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.api.post(url, data, config);
      return response.data;
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async put<T>(url: string, data?: any): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.api.put(url, data);
      return response.data;
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async delete<T>(url: string): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.api.delete(url);
      return response.data;
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async upload<T>(url: string, formData: FormData): Promise<APIResponse<T>> {
    try {
      const response: AxiosResponse<APIResponse<T>> = await this.api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  // Paginated requests
  async getPaginated<T>(
    url: string,
    page: number = 1,
    limit: number = 10,
    params?: any
  ): Promise<PaginatedResponse<T>> {
    try {
      console.log('=== getPaginated called ===');
      console.log('URL:', url);
      console.log('Params:', { page, limit, ...params });
      
      // Backend returns { success: true, data: [...], pagination: {...} }
      // We need to extract data and pagination from the response
      const response: AxiosResponse<any> = await this.api.get(url, {
        params: { page, limit, ...params },
      });
      
      console.log('getPaginated raw axios response status:', response.status);
      console.log('getPaginated raw response.data:', response.data);
      console.log('response.data type:', typeof response.data);
      console.log('response.data keys:', Object.keys(response.data));
      console.log('response.data.success:', response.data.success);
      console.log('response.data.data type:', typeof response.data.data);
      console.log('response.data.data is array:', Array.isArray(response.data.data));
      console.log('response.data.data length:', response.data.data?.length);
      
      // Handle backend response format with success field
      if (response.data && response.data.success !== undefined) {
        const result = {
          data: response.data.data || [],
          pagination: response.data.pagination || {
            page: 1,
            limit: 10,
            total: 0,
            totalPages: 0,
          },
        };
        console.log('Returning formatted result:', result);
        console.log('Result data length:', result.data.length);
        return result;
      }
      
      // Fallback to direct response if no success field
      console.log('No success field, returning direct response');
      return response.data;
    } catch (error: any) {
      console.error('getPaginated error:', error);
      console.error('Error response:', error.response?.data);
      throw error;
    }
  }

  private handleError(error: any): APIResponse<any> {
    // Re-throw cancellation errors — they are intentional and callers handle them
    if (
      error?.code === 'ERR_CANCELED' ||
      error?.message === 'canceled' ||
      error?.name === 'CanceledError' ||
      error?.name === 'AbortError'
    ) {
      throw error;
    }

    if (error.response) {
      return {
        success: false,
        error: error.response.data?.error || error.response.data?.message || 'An error occurred',
        message: error.response.data?.message,
        details: error.response.data?.details,
      };
    }

    if (error.request) {
      return {
        success: false,
        error: 'No response from server. Please check your connection.',
      };
    }

    return {
      success: false,
      error: error.message || 'Network error occurred',
    };
  }
}

export const apiService = new APIService();
export default apiService;