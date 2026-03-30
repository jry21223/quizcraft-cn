import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  Wand2,
  Download,
  ChevronDown,
  X,
  Zap,
  AlertCircle,
  Clock,
  Key,
  Save,
  Plus,
  Trash2,
  Copy,
  PackagePlus,
  RefreshCw,
} from 'lucide-react';
import {
  analysisApi,
  bankApi,
  buildBrowserURL,
  buildWebSocketURL,
} from '@/api/client';
import { useCachedConfig } from '@/hooks/useCachedConfig';
import { useQuizStore } from '@/stores/quizStore';
import type { ParsedQuestion, QuestionType } from '@/types';

type BuilderStep = 'select' | 'parse' | 'review' | 'analyze';

interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

interface EditableQuestion extends ParsedQuestion {
  options?: string[];
  analysis?: string;
  chapter?: string;
}

type EditableQuestionInput =
  | EditableQuestion
  | (Partial<EditableQuestion> & Record<string, unknown>);

const DEFAULT_BANK_COLOR = '#1976d2';

const QUESTION_TYPE_OPTIONS: Array<{ value: QuestionType; label: string }> = [
  { value: 'single', label: '单选题' },
  { value: 'multi', label: '多选题' },
  { value: 'judge', label: '判断题' },
];

const createQuestionId = () =>
  `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const letterFromIndex = (index: number) => String.fromCharCode(65 + index);

const indexFromLetter = (letter: string) => {
  const code = letter.toUpperCase().charCodeAt(0) - 65;
  return code >= 0 && code < 26 ? code : -1;
};

const normalizeJudgeAnswerText = (value: unknown) => {
  if (value === true) return '对';
  if (value === false) return '错';

  const text = String(value ?? '').trim().toLowerCase();
  if (!text) return '';
  if (['对', '正确', '是', 'true', '1', '√', 'yes', 'y'].includes(text)) {
    return '对';
  }
  if (['错', '错误', '否', 'false', '0', '×', 'no', 'n'].includes(text)) {
    return '错';
  }
  return '';
};

const extractChoiceIndexes = (value: unknown) => {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((item) => Number(item))
          .filter((item) => Number.isInteger(item) && item >= 0 && item < 26)
      )
    ).sort((a, b) => a - b);
  }

  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < 26) {
    return [value];
  }

  const letters = String(value ?? '')
    .toUpperCase()
    .match(/[A-Z]/g) ?? [];

  return Array.from(
    new Set(
      letters
        .map(indexFromLetter)
        .filter((item) => item >= 0)
    )
  ).sort((a, b) => a - b);
};

const indexesToAnswerText = (indexes: number[]) =>
  Array.from(new Set(indexes))
    .sort((a, b) => a - b)
    .map(letterFromIndex)
    .join('');

const normalizeAnswerText = (value: unknown, type: QuestionType) => {
  if (type === 'judge') {
    return normalizeJudgeAnswerText(value);
  }

  const indexes = extractChoiceIndexes(value);
  if (type === 'single') {
    return indexes.length ? letterFromIndex(indexes[0]) : '';
  }
  return indexesToAnswerText(indexes);
};

const slugifyBankKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
    .replace(/^_+|_+$/g, '');

const createEmptyQuestion = (index: number): EditableQuestion => ({
  id: createQuestionId(),
  number: String(index),
  type: 'single',
  content: '',
  options: ['', ''],
  answer: '',
  analysis: '',
  chapter: '默认章节',
});

const normalizeEditableQuestion = (
  raw: EditableQuestionInput,
  index: number
): EditableQuestion => {
  const type: QuestionType =
    raw.type === 'multi' || raw.type === 'judge' ? raw.type : 'single';

  const options =
    type === 'judge'
      ? []
      : Array.isArray(raw.options) && raw.options.length > 0
        ? raw.options.map((option) => String(option ?? ''))
        : ['', ''];

  return {
    id: String(raw.id || createQuestionId()),
    number: String(raw.number ?? index),
    type,
    content: String(raw.content ?? '').trim(),
    options,
    answer: normalizeAnswerText(raw.answer, type),
    analysis: String(raw.analysis ?? '').trim(),
    chapter: String(raw.chapter ?? '默认章节').trim() || '默认章节',
  };
};

const reindexQuestions = (questions: EditableQuestion[]) =>
  questions.map((question, index) =>
    normalizeEditableQuestion({ ...question, number: String(index + 1) }, index + 1)
  );

const mergeAnalyzedQuestions = (
  current: EditableQuestion[],
  incoming: Array<Record<string, unknown>>
) => {
  const incomingMap = new Map(
    incoming
      .map((question, index) => {
        const normalized = normalizeEditableQuestion(
          question as Partial<EditableQuestion> & Record<string, unknown>,
          index + 1
        );
        return [normalized.id, normalized] as const;
      })
  );

  return current.map((question, index) =>
    incomingMap.has(question.id)
      ? normalizeEditableQuestion(
          { ...question, ...incomingMap.get(question.id)! },
          index + 1
        )
      : normalizeEditableQuestion(question, index + 1)
  );
};

const getTypeBadgeClass = (type: QuestionType) => {
  if (type === 'single') return 'bg-blue-100 text-blue-700';
  if (type === 'multi') return 'bg-purple-100 text-purple-700';
  return 'bg-green-100 text-green-700';
};

export default function Extract() {
  const { config, updateConfig, clearConfig, keyCount } = useCachedConfig();
  const { setBanks } = useQuizStore();

  const [step, setStep] = useState<BuilderStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<EditableQuestion[]>([]);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [bankName, setBankName] = useState('');
  const [bankKey, setBankKey] = useState('');
  const [bankColor, setBankColor] = useState(DEFAULT_BANK_COLOR);
  const [keyTouched, setKeyTouched] = useState(false);
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [analyzeTime, setAnalyzeTime] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const clearAsyncState = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(null);
    setAnalyzeTime(0);
    setIsProcessing(false);
  }, []);

  const resetWorkspace = useCallback(() => {
    clearAsyncState();
    setStep('select');
    setFile(null);
    setQuestions([]);
    setExpandedQ(null);
    setBankName('');
    setBankKey('');
    setBankColor(DEFAULT_BANK_COLOR);
    setKeyTouched(false);
    setOverwriteExisting(false);
    setError('');
    setSuccess('');
  }, [clearAsyncState]);

  const applyQuestions = useCallback((items: EditableQuestionInput[]) => {
    const normalized = reindexQuestions(
      items.map((question, index) =>
        normalizeEditableQuestion(
          question as Partial<EditableQuestion> & Record<string, unknown>,
          index + 1
        )
      )
    );
    setQuestions(normalized);
    setExpandedQ(normalized[0]?.id ?? null);
    return normalized;
  }, []);

  const patchQuestions = useCallback(
    (updater: (current: EditableQuestion[]) => EditableQuestion[]) => {
      setQuestions((current) => {
        const next = reindexQuestions(updater(current));
        setExpandedQ((prev) => {
          if (prev && next.some((question) => question.id === prev)) {
            return prev;
          }
          return next[0]?.id ?? null;
        });
        return next;
      });
    },
    []
  );

  const handleBankNameChange = (value: string) => {
    setBankName(value);
    if (!keyTouched) {
      setBankKey(slugifyBankKey(value));
    }
  };

  const startBlankBank = () => {
    clearAsyncState();
    const draftName = '新建题库';
    setStep('review');
    setFile(null);
    setError('');
    setSuccess('');
    setBankColor(DEFAULT_BANK_COLOR);
    setOverwriteExisting(false);
    setKeyTouched(false);
    setBankName(draftName);
    setBankKey(slugifyBankKey(draftName));
    applyQuestions([createEmptyQuestion(1)]);
  };

  const processFile = useCallback(async (selectedFile: File) => {
    clearAsyncState();
    setFile(selectedFile);
    setStep('parse');
    setError('');
    setSuccess('');

    const inferredName = selectedFile.name.replace(/\.[^/.]+$/, '');
    setBankName(inferredName);
    setBankKey(slugifyBankKey(inferredName));
    setBankColor(DEFAULT_BANK_COLOR);
    setKeyTouched(false);
    setOverwriteExisting(false);

    try {
      const result = await analysisApi.parseFile(selectedFile);
      const normalized = applyQuestions(result.questions);
      if (normalized.length === 0) {
        throw new Error('未识别到可编辑的题目');
      }
      setStep('review');
      setSuccess(`已导入 ${normalized.length} 道题目，可以在线继续编辑`);
    } catch (err) {
      setStep('select');
      setError('文件解析失败: ' + (err as Error).message);
    }
  }, [applyQuestions, clearAsyncState]);

  const handleFileDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, [processFile]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
      event.target.value = '';
    }
  };

  const updateQuestion = (
    questionId: string,
    updater: (question: EditableQuestion) => EditableQuestion
  ) => {
    patchQuestions((current) =>
      current.map((question) =>
        question.id === questionId ? updater(question) : question
      )
    );
  };

  const addQuestion = () => {
    patchQuestions((current) => [...current, createEmptyQuestion(current.length + 1)]);
    setSuccess('');
  };

  const duplicateQuestion = (questionId: string) => {
    patchQuestions((current) => {
      const index = current.findIndex((question) => question.id === questionId);
      if (index < 0) return current;
      const duplicated = normalizeEditableQuestion(
        {
          ...current[index],
          id: createQuestionId(),
        },
        index + 2
      );
      const next = [...current];
      next.splice(index + 1, 0, duplicated);
      return next;
    });
    setSuccess('');
  };

  const removeQuestion = (questionId: string) => {
    if (questions.length <= 1) {
      setError('至少保留 1 道题目');
      return;
    }
    patchQuestions((current) =>
      current.filter((question) => question.id !== questionId)
    );
    setSuccess('');
  };

  const changeQuestionType = (questionId: string, nextType: QuestionType) => {
    updateQuestion(questionId, (question) => {
      if (nextType === 'judge') {
        return {
          ...question,
          type: 'judge',
          options: [],
          answer: normalizeJudgeAnswerText(question.answer) || '',
        };
      }

      const currentIndexes = extractChoiceIndexes(question.answer);
      const options =
        question.options && question.options.length >= 2
          ? question.options
          : ['', ''];

      return {
        ...question,
        type: nextType,
        options,
        answer:
          nextType === 'single'
            ? currentIndexes.length
              ? letterFromIndex(currentIndexes[0])
              : ''
            : indexesToAnswerText(currentIndexes),
      };
    });
  };

  const addOption = (questionId: string) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      options: [...(question.options ?? []), ''],
    }));
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    updateQuestion(questionId, (question) => {
      const options = (question.options ?? []).filter((_, index) => index !== optionIndex);
      if (options.length < 2) {
        setError('选择题至少保留 2 个选项');
        return question;
      }

      if (question.type === 'single') {
        const currentIndex = extractChoiceIndexes(question.answer)[0];
        let nextAnswer = question.answer;
        if (currentIndex === optionIndex) {
          nextAnswer = '';
        } else if (currentIndex > optionIndex) {
          nextAnswer = letterFromIndex(currentIndex - 1);
        }
        return {
          ...question,
          options,
          answer: nextAnswer,
        };
      }

      const adjustedIndexes = extractChoiceIndexes(question.answer)
        .filter((index) => index !== optionIndex)
        .map((index) => (index > optionIndex ? index - 1 : index));

      return {
        ...question,
        options,
        answer: indexesToAnswerText(adjustedIndexes),
      };
    });
  };

  const setSingleAnswer = (questionId: string, optionIndex: number) => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answer: letterFromIndex(optionIndex),
    }));
  };

  const toggleMultiAnswer = (questionId: string, optionIndex: number) => {
    updateQuestion(questionId, (question) => {
      const currentIndexes = extractChoiceIndexes(question.answer);
      const nextIndexes = currentIndexes.includes(optionIndex)
        ? currentIndexes.filter((index) => index !== optionIndex)
        : [...currentIndexes, optionIndex];

      return {
        ...question,
        answer: indexesToAnswerText(nextIndexes),
      };
    });
  };

  const setJudgeAnswer = (questionId: string, value: '对' | '错') => {
    updateQuestion(questionId, (question) => ({
      ...question,
      answer: value,
    }));
  };

  const validateBeforePersist = () => {
    if (!bankName.trim()) {
      setError('请先填写题库名称');
      return false;
    }
    if (questions.length === 0) {
      setError('题库里至少需要 1 道题目');
      return false;
    }
    return true;
  };

  const handleExport = async () => {
    if (!validateBeforePersist()) return;

    setError('');
    setSuccess('');
    try {
      const result = await analysisApi.exportBank(questions, bankName.trim());
      window.open(buildBrowserURL(result.download_url), '_blank');
      setSuccess('标准 JSON 已生成，浏览器正在下载');
    } catch (err) {
      setError('导出失败: ' + (err as Error).message);
    }
  };

  const handleSaveBank = async () => {
    if (!validateBeforePersist()) return;

    setError('');
    setSuccess('');
    setIsSaving(true);

    try {
      const result = await bankApi.save({
        name: bankName.trim(),
        key: bankKey.trim() || slugifyBankKey(bankName),
        color: bankColor,
        questions,
        overwrite: overwriteExisting,
      });

      const latestBanks = await bankApi.getList();
      setBanks(latestBanks.banks);
      setBankKey(result.bank.key);
      setKeyTouched(true);
      setSuccess(`题库已保存到 ${result.file}，现在可以在刷题页直接使用`);
    } catch (err) {
      setError('保存失败: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateAnalysis = async () => {
    if (!config.apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }

    const pendingQuestions = questions.filter((question) => !question.analysis?.trim());
    if (pendingQuestions.length === 0) {
      setSuccess('当前所有题目都已经有解析了');
      return;
    }

    setError('');
    setSuccess('');
    setIsProcessing(true);
    setStep('analyze');
    setProgress({
      current: 0,
      total: pendingQuestions.length,
      percentage: 0,
      message: '正在连接...',
    });
    setAnalyzeTime(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setAnalyzeTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const clientId = `extract_${Date.now()}`;
    const wsUrl = buildWebSocketURL(`/ws/analyze/${clientId}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        questions: pendingQuestions,
        config,
      }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case 'progress':
          setProgress({
            current: data.current,
            total: data.total,
            percentage: data.percentage,
            message: data.message,
          });
          break;
        case 'complete':
          setQuestions((current) => mergeAnalyzedQuestions(current, data.questions ?? []));
          clearAsyncState();
          setStep('review');
          setSuccess('AI 解析已补齐到当前题库草稿');
          break;
        case 'error':
          clearAsyncState();
          setStep('review');
          setError(data.error || 'AI 解析失败');
          break;
      }
    };

    ws.onerror = async () => {
      try {
        setProgress({
          current: 0,
          total: pendingQuestions.length,
          percentage: 0,
          message: 'WebSocket 失败，切换备用模式...',
        });

        const result = await analysisApi.generateAnalysis(pendingQuestions, config);
        setQuestions((current) => mergeAnalyzedQuestions(current, result.questions ?? []));
        setSuccess('已通过备用模式补齐 AI 解析');
      } catch (err) {
        setError('生成解析失败: ' + (err as Error).message);
      } finally {
        clearAsyncState();
        setStep('review');
      }
    };
  };

  const totalQuestions = questions.length;
  const pendingAnalysisCount = questions.filter((question) => !question.analysis?.trim()).length;
  const singleCount = questions.filter((question) => question.type === 'single').length;
  const multiCount = questions.filter((question) => question.type === 'multi').length;
  const judgeCount = questions.filter((question) => question.type === 'judge').length;
  const estimatedTime = progress ? Math.ceil((progress.total - progress.current) * 2) : 0;

  return (
    <div className="max-w-5xl mx-auto animate-fade-in space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          题库工坊
        </h1>
        <p className="text-gray-500">
          在线新建题库、编写题目、上传导入文件，并导出或保存为标准 JSON
        </p>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3"
        >
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <span className="text-green-700">{success}</span>
          <button
            onClick={() => setSuccess('')}
            className="ml-auto text-green-400 hover:text-green-600"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {step === 'select' && (
        <div className="grid gap-4 md:grid-cols-2">
          <button
            onClick={startBlankBank}
            className="bg-white rounded-2xl border border-gray-100 p-6 text-left shadow-sm hover:shadow-md transition-all"
          >
            <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center mb-4">
              <PackagePlus className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">在线新建题库</h2>
            <p className="text-sm text-gray-500 leading-6">
              从空白题库开始，在线添加题目、选项、答案和解析，编辑完直接保存到系统。
            </p>
          </button>

          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleFileDrop}
            className="bg-white rounded-2xl border-2 border-dashed border-gray-300 p-6 shadow-sm hover:border-primary-400 hover:bg-primary-50/30 transition-colors"
          >
            <input
              type="file"
              accept=".txt,.json,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
              id="bank-builder-file-input"
            />
            <label htmlFor="bank-builder-file-input" className="cursor-pointer block text-left">
              <div className="w-12 h-12 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center mb-4">
                <Upload className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">上传导入题库</h2>
              <p className="text-sm text-gray-500 leading-6">
                支持 JSON、PDF、Word、TXT。导入后会进入在线编辑区，你可以继续修改并保存。
              </p>
              <p className="text-xs text-gray-400 mt-3">
                拖拽文件到这里，或点击选择文件
              </p>
            </label>
          </div>
        </div>
      )}

      {step === 'parse' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-medium text-gray-800 mb-2">正在解析文件...</p>
          <p className="text-sm text-gray-500">{file?.name}</p>
        </div>
      )}

      {step === 'analyze' && progress && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8">
          <div className="text-center mb-6">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-20 h-20 transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#e5e7eb"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#1976d2"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${progress.percentage * 2.26} 226`}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-primary-600">
                  {Math.round(progress.percentage)}%
                </span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mt-4">AI 正在生成解析...</h2>
            <p className="text-gray-500 mt-1">{progress.message}</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">进度</span>
              <span className="font-medium">{progress.current} / {progress.total}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary-500"
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                <span>已用时间</span>
              </div>
              <div className="font-mono font-medium">
                {`${String(Math.floor(analyzeTime / 60)).padStart(2, '0')}:${String(analyzeTime % 60).padStart(2, '0')}`}
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">速度</div>
              <div className="font-medium">
                {progress.current > 0 ? (analyzeTime / progress.current).toFixed(1) : '-'} 秒/题
              </div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">预估剩余</div>
              <div className="font-medium">~{estimatedTime} 秒</div>
            </div>
          </div>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary-500" />
                  在线题库编辑
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  题库会统一保存为标准 JSON 结构，并自动加入首页和练习页的题库列表。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm">
                  共 {totalQuestions} 题
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm">
                  单选 {singleCount}
                </span>
                <span className="px-3 py-1 rounded-full bg-purple-100 text-purple-700 text-sm">
                  多选 {multiCount}
                </span>
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm">
                  判断 {judgeCount}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mt-6">
              <div className="xl:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  题库名称
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(event) => handleBankNameChange(event.target.value)}
                  placeholder="例如：马克思主义基本原理"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  题库代号
                </label>
                <input
                  type="text"
                  value={bankKey}
                  onChange={(event) => {
                    setBankKey(event.target.value);
                    setKeyTouched(true);
                  }}
                  placeholder="例如：marxism"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  主题颜色
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={bankColor}
                    onChange={(event) => setBankColor(event.target.value)}
                    className="h-10 w-14 rounded border border-gray-200 bg-white p-1"
                  />
                  <span className="text-sm text-gray-500">{bankColor}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-6">
              <button
                onClick={addQuestion}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600"
              >
                <Plus className="w-4 h-4" />
                新增题目
              </button>
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                下载标准 JSON
              </button>
              <button
                onClick={handleSaveBank}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存到题库
              </button>
              <button
                onClick={resetWorkspace}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
                重新选择来源
              </button>
            </div>

            <label className="mt-4 inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(event) => setOverwriteExisting(event.target.checked)}
                className="rounded border-gray-300"
              />
              允许覆盖同名题库代号
            </label>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-5 h-5 text-primary-500" />
              <h3 className="font-medium">AI 解析（可选）</h3>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                待补解析 {pendingAnalysisCount} 题
              </span>
            </div>

            {keyCount > 0 && !showKeyInput && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {config.provider === 'openai'
                        ? 'OpenAI'
                        : config.provider === 'deepseek'
                          ? 'DeepSeek'
                          : 'SiliconFlow'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {keyCount} 个 API Key 已保存
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowKeyInput(true)}
                      className="text-xs px-2 py-1 text-primary-600 hover:bg-primary-50 rounded"
                    >
                      修改
                    </button>
                    <button
                      onClick={clearConfig}
                      className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded"
                    >
                      清除
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(showKeyInput || keyCount === 0) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={config.provider}
                    onChange={(event) => updateConfig({ provider: event.target.value as any })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="deepseek">DeepSeek（推荐）</option>
                    <option value="openai">OpenAI</option>
                    <option value="siliconflow">SiliconFlow</option>
                  </select>

                  <input
                    type="text"
                    value={config.model}
                    onChange={(event) => updateConfig({ model: event.target.value })}
                    placeholder="模型名称（可选）"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>

                <div className="relative">
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(event) => updateConfig({ apiKey: event.target.value })}
                    placeholder="输入 API Key（支持逗号/分号/换行；也支持 deepseek:sk-xxx）"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm pr-20"
                  />
                  {config.apiKey && (
                    <button
                      onClick={() => setShowKeyInput(false)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      保存
                    </button>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  支持多 API 异步：`sk1,sk2` 或 `deepseek:sk` 或 `openai|sk|url|model`
                </p>
              </div>
            )}

            <button
              onClick={handleGenerateAnalysis}
              disabled={isProcessing || keyCount === 0}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {keyCount > 0 ? '为缺失题目生成解析' : '请先输入 API Key'}
            </button>
          </div>

          <div className="space-y-3">
            {questions.map((question, index) => {
              const selectedSingleAnswer = extractChoiceIndexes(question.answer)[0];
              const selectedMultiAnswer = extractChoiceIndexes(question.answer);
              const isExpanded = expandedQ === question.id;

              return (
                <div
                  key={question.id}
                  className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedQ(isExpanded ? null : question.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {index + 1}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${getTypeBadgeClass(question.type)}`}>
                      {QUESTION_TYPE_OPTIONS.find((item) => item.value === question.type)?.label}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{question.chapter || '默认章节'}</span>
                    <span className="flex-1 text-left truncate text-gray-700">
                      {question.content || '未填写题干'}
                    </span>
                    {question.analysis?.trim() && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                        已解析
                      </span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100"
                      >
                        <div className="p-5 space-y-4">
                          <div className="flex flex-wrap gap-3 justify-end">
                            <button
                              onClick={() => duplicateQuestion(question.id)}
                              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-primary-600"
                            >
                              <Copy className="w-4 h-4" />
                              复制题目
                            </button>
                            <button
                              onClick={() => removeQuestion(question.id)}
                              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                              删除题目
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                章节名称
                              </label>
                              <input
                                type="text"
                                value={question.chapter || ''}
                                onChange={(event) =>
                                  updateQuestion(question.id, (current) => ({
                                    ...current,
                                    chapter: event.target.value,
                                  }))
                                }
                                placeholder="例如：第一章 导论"
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                题目类型
                              </label>
                              <select
                                value={question.type}
                                onChange={(event) =>
                                  changeQuestionType(question.id, event.target.value as QuestionType)
                                }
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                              >
                                {QUESTION_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              题干
                            </label>
                            <textarea
                              value={question.content}
                              onChange={(event) =>
                                updateQuestion(question.id, (current) => ({
                                  ...current,
                                  content: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="请输入题目内容"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                          </div>

                          {question.type !== 'judge' ? (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">
                                  选项与答案
                                </label>
                                <button
                                  onClick={() => addOption(question.id)}
                                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                                >
                                  <Plus className="w-4 h-4" />
                                  新增选项
                                </button>
                              </div>

                              {(question.options ?? []).map((option, optionIndex) => {
                                const checked =
                                  question.type === 'single'
                                    ? selectedSingleAnswer === optionIndex
                                    : selectedMultiAnswer.includes(optionIndex);

                                return (
                                  <div key={optionIndex} className="flex items-center gap-3">
                                    <input
                                      type={question.type === 'single' ? 'radio' : 'checkbox'}
                                      name={`answer-${question.id}`}
                                      checked={checked}
                                      onChange={() =>
                                        question.type === 'single'
                                          ? setSingleAnswer(question.id, optionIndex)
                                          : toggleMultiAnswer(question.id, optionIndex)
                                      }
                                      className="h-4 w-4"
                                    />
                                    <span className="w-6 text-sm font-medium text-gray-500">
                                      {letterFromIndex(optionIndex)}.
                                    </span>
                                    <input
                                      type="text"
                                      value={option}
                                      onChange={(event) =>
                                        updateQuestion(question.id, (current) => {
                                          const nextOptions = [...(current.options ?? [])];
                                          nextOptions[optionIndex] = event.target.value;
                                          return {
                                            ...current,
                                            options: nextOptions,
                                          };
                                        })
                                      }
                                      placeholder={`选项 ${letterFromIndex(optionIndex)}`}
                                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                                    />
                                    <button
                                      onClick={() => removeOption(question.id, optionIndex)}
                                      className="text-gray-400 hover:text-red-500 disabled:opacity-40"
                                      disabled={(question.options ?? []).length <= 2}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                );
                              })}

                              <div className="text-xs text-gray-400">
                                当前答案：{question.answer || '未设置'}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                正确答案
                              </label>
                              <div className="grid grid-cols-2 gap-3">
                                {['对', '错'].map((value) => (
                                  <button
                                    key={value}
                                    onClick={() => setJudgeAnswer(question.id, value as '对' | '错')}
                                    className={`py-3 rounded-xl border-2 font-medium transition-colors ${
                                      question.answer === value
                                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                                        : 'border-gray-200 text-gray-600 hover:border-primary-300'
                                    }`}
                                  >
                                    {value}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              解析（可选）
                            </label>
                            <textarea
                              value={question.analysis || ''}
                              onChange={(event) =>
                                updateQuestion(question.id, (current) => ({
                                  ...current,
                                  analysis: event.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="可以手写解析，也可以稍后用 AI 批量补齐"
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
