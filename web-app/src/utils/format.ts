import type { QuestionType } from '@/types';

const JUDGE_TRUE_VALUES = new Set([
  'true', 't', '1', 'yes', 'y', 'right',
  '对', '正确', '是', '√',
]);
const JUDGE_FALSE_VALUES = new Set([
  'false', 'f', '0', 'no', 'n', 'wrong',
  '错', '错误', '否', '×',
]);

const normalizeJudgeAnswer = (value: any): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase();
    if (JUDGE_TRUE_VALUES.has(text)) return true;
    if (JUDGE_FALSE_VALUES.has(text)) return false;
  }
  return null;
};

// 格式化正确率
export const formatRate = (rate: number): string => {
  return `${rate.toFixed(1)}%`;
};

// 格式化题目类型
export const formatQuestionType = (type: QuestionType): string => {
  const map: Record<QuestionType, string> = {
    single: '单选题',
    multi: '多选题',
    judge: '判断题',
  };
  return map[type];
};

// 获取题目类型颜色
export const getTypeColor = (type: QuestionType): string => {
  const map: Record<QuestionType, string> = {
    single: 'bg-blue-100 text-blue-700',
    multi: 'bg-purple-100 text-purple-700',
    judge: 'bg-orange-100 text-orange-700',
  };
  return map[type];
};

// 格式化时间
export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// 格式化日期
export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 获取难度标签
export const getDifficultyLabel = (rate: number): { label: string; color: string } => {
  if (rate >= 70) return { label: '简单', color: 'text-green-600 bg-green-50' };
  if (rate >= 50) return { label: '中等', color: 'text-yellow-600 bg-yellow-50' };
  return { label: '困难', color: 'text-red-600 bg-red-50' };
};

// 将索引转为选项字母
export const indexToOption = (index: number): string => {
  return String.fromCharCode(65 + index);  // 0 -> A, 1 -> B, ...
};

// 将选项字母转为索引
export const optionToIndex = (option: string): number => {
  return option.toUpperCase().charCodeAt(0) - 65;
};

// 将答案数组转为字符串
export const formatAnswer = (answer: any, type: QuestionType): string => {
  if (type === 'judge') {
    const normalized = normalizeJudgeAnswer(answer);
    if (normalized === true) return '对';
    if (normalized === false) return '错';
    return String(answer);
  }
  if (type === 'multi' && Array.isArray(answer)) {
    return answer.map(indexToOption).join('');
  }
  if (typeof answer === 'number') {
    return indexToOption(answer);
  }
  return String(answer);
};

// 解析用户输入的答案
export const parseAnswer = (input: string, type: QuestionType): any => {
  if (type === 'judge') {
    const normalized = input.trim().toLowerCase();
    return normalized === 'y' || normalized === '对' || normalized === 'true';
  }
  if (type === 'multi') {
    return input.split('').map(optionToIndex);
  }
  return optionToIndex(input);
};
