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

// 验证答案是否正确
export const validateAnswer = (
  userAnswer: any,
  correctAnswer: any,
  type: QuestionType
): boolean => {
  if (type === 'judge') {
    const user = normalizeJudgeAnswer(userAnswer);
    const correct = normalizeJudgeAnswer(correctAnswer);
    return user !== null && correct !== null && user === correct;
  }
  
  if (type === 'multi') {
    const user = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
    const correct = Array.isArray(correctAnswer) ? [...correctAnswer].sort() : [];
    return JSON.stringify(user) === JSON.stringify(correct);
  }
  
  // 单选题
  return userAnswer === correctAnswer;
};

// 验证文件类型
export const validateFileType = (file: File): boolean => {
  const allowedTypes = [
    'text/plain',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];
  return allowedTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.pdf') || file.name.endsWith('.docx') || file.name.endsWith('.doc');
};

// 获取文件类型名称
export const getFileTypeName = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    txt: '文本文件',
    pdf: 'PDF 文档',
    docx: 'Word 文档',
    doc: 'Word 文档',
  };
  return map[ext || ''] || '未知文件';
};
