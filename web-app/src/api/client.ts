import axios, { AxiosInstance, AxiosError } from 'axios';
import type { 
  QuestionBank, 
  Question, 
  PracticeSettings,
  RankItem,
  UserStats 
} from '@/types';

// 创建 axios 实例
const api: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const userId = localStorage.getItem('user_id');
    if (userId) {
      config.headers['X-User-Id'] = userId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器
api.interceptors.response.use(
  (response) => response.data,
  (error: AxiosError) => {
    const responseData = error.response?.data as { message?: string } | undefined;
    const message = responseData?.message || error.message || '请求失败';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// 题库 API
export const bankApi = {
  // 获取题库列表
  getList: (): Promise<{ banks: QuestionBank[] }> => {
    return api.get('/banks');
  },
  
  // 获取题库统计
  getStats: (bankKey: string): Promise<any> => {
    return api.get('/stats/global', { params: { bank: bankKey } });
  },
};

// 练习 API
export const practiceApi = {
  // 开始练习
  start: (bank: string, settings: PracticeSettings): Promise<{ 
    questions: Question[]; 
    total: number;
    avg_rate?: number;
  }> => {
    return api.post('/practice/start', {
      bank,
      mode: settings.mode,
      params: {
        count: settings.count,
        chapter_id: settings.chapterId,
        threshold: settings.threshold,
      },
    });
  },
  
  // 提交答案
  submitAnswer: (bank: string, questionId: string, answer: any): Promise<{
    correct: boolean;
    correct_answer: any;
    analysis?: string;
    stats?: any;
    user_stats?: UserStats;
  }> => {
    return api.post('/practice/submit', {
      bank,
      question_id: questionId,
      answer,
      user_id: localStorage.getItem('user_id'),
    });
  },
};

// 用户 API
export const userApi = {
  // 设置用户名
  setName: (name: string): Promise<UserStats> => {
    return api.post('/user', { name }).then((res: any) => {
      localStorage.setItem('user_id', res.user_id);
      return res;
    });
  },
  
  // 获取排行榜
  getRanking: (): Promise<{ ranking: RankItem[] }> => {
    return api.get('/ranking');
  },
};

// 解析生成 API
export const analysisApi = {
  // 上传文件并解析
  parseFile: (file: File): Promise<{
    content: string;
    questions: any[];
  }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/extract/parse', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
  
  // 生成解析
  generateAnalysis: (questions: any[], config: any): Promise<{
    questions: any[];
  }> => {
    return api.post('/extract/analyze', {
      questions,
      config,
    });
  },
  
  // 导出题库
  exportBank: (questions: any[], name: string): Promise<{
    download_url: string;
  }> => {
    return api.post('/extract/export', {
      questions,
      name,
    });
  },
};

export default api;
