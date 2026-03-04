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
  Save
} from 'lucide-react';
import { analysisApi } from '@/api/client';
import { useCachedConfig } from '@/hooks/useCachedConfig';
import type { ParsedQuestion } from '@/types';

interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message: string;
}

export default function Extract() {
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<'upload' | 'parse' | 'review' | 'analyze' | 'export'>('upload');
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<ProgressInfo | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const { config, updateConfig, clearConfig, keyCount } = useCachedConfig();
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [bankName, setBankName] = useState('');
  const [error, setError] = useState('');
  const [analyzeTime, setAnalyzeTime] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // 清理 WebSocket
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
  
  // 文件上传
  const handleFileDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      await processFile(droppedFile);
    }
  }, []);
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      await processFile(selectedFile);
    }
  };
  
  const processFile = async (f: File) => {
    setFile(f);
    setBankName(f.name.replace(/\.[^/.]+$/, ''));
    setIsProcessing(true);
    setStep('parse');
    setError('');
    
    try {
      const result = await analysisApi.parseFile(f);
      setQuestions(result.questions);
      setStep('review');
    } catch (err) {
      setError('文件解析失败: ' + (err as Error).message);
      setStep('upload');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // WebSocket 生成解析
  const handleGenerateAnalysis = async () => {
    if (!config.apiKey.trim()) {
      setError('请输入 API Key');
      return;
    }
    
    setIsProcessing(true);
    setStep('analyze');
    setError('');
    setProgress({ current: 0, total: questions.length, percentage: 0, message: '正在连接...' });
    setAnalyzeTime(0);
    
    // 计时器
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setAnalyzeTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    // 生成 client_id
    const clientId = 'extract_' + Date.now();
    // WebSocket 直接连接后端（避免代理问题）
    const wsUrl = `ws://127.0.0.1:10086/ws/analyze/${clientId}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket 已连接');
      // 发送题目和配置
      ws.send(JSON.stringify({
        questions: questions.filter(q => !q.analysis),
        config: config
      }));
    };
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('收到消息:', data);
      
      switch (data.type) {
        case 'progress':
          setProgress({
            current: data.current,
            total: data.total,
            percentage: data.percentage,
            message: data.message
          });
          break;
          
        case 'complete':
          setQuestions(data.questions);
          setStep('export');
          setIsProcessing(false);
          if (timerRef.current) clearInterval(timerRef.current);
          ws.close();
          break;
          
        case 'error':
          setError(data.error);
          setIsProcessing(false);
          if (timerRef.current) clearInterval(timerRef.current);
          ws.close();
          break;
      }
    };
    
    ws.onerror = (err) => {
      console.error('WebSocket 错误:', err);
      setError('连接失败，请使用普通模式');
      setIsProcessing(false);
      if (timerRef.current) clearInterval(timerRef.current);
      // 降级到普通 HTTP 模式
      fallbackToHttpMode();
    };
    
    ws.onclose = () => {
      console.log('WebSocket 已关闭');
    };
  };
  
  // 降级到 HTTP 模式（备用）
  const fallbackToHttpMode = async () => {
    try {
      setProgress({ current: 0, total: questions.length, percentage: 0, message: '使用备用模式...' });
      
      const result = await analysisApi.generateAnalysis(
        questions.filter(q => !q.analysis),
        config
      );
      
      setQuestions(result.questions);
      setStep('export');
      setIsProcessing(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } catch (err) {
      setError('生成解析失败: ' + (err as Error).message);
      setStep('review');
      setIsProcessing(false);
    }
  };
  
  // 导出题库
  const handleExport = async () => {
    try {
      const result = await analysisApi.exportBank(questions, bankName);
      window.open(result.download_url, '_blank');
    } catch (err) {
      setError('导出失败: ' + (err as Error).message);
    }
  };
  
  // 更新题目
  const updateQuestion = (id: string, updates: Partial<ParsedQuestion>) => {
    setQuestions((qs) =>
      qs.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };
  
  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // 计算预估时间
  const estimatedTime = progress ? Math.ceil((progress.total - progress.current) * 2) : 0;
  
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-500" />
          AI 题库提取
        </h1>
        <p className="text-gray-500">上传 JSON、PDF、Word 或 TXT，AI 自动生成解析</p>
      </div>
      
      {/* 错误提示 */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error}</span>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
      
      {/* 步骤指示器 */}
      <div className="flex items-center justify-between mb-8 bg-white rounded-xl p-4 border border-gray-100">
        {[
          { key: 'upload', label: '上传文件', icon: Upload },
          { key: 'parse', label: '解析题目', icon: FileText },
          { key: 'review', label: '检查编辑', icon: ChevronDown },
          { key: 'analyze', label: 'AI 解析', icon: Wand2 },
          { key: 'export', label: '导出题库', icon: Download },
        ].map((s, idx) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isPast = ['upload', 'parse', 'review', 'analyze', 'export'].indexOf(step) > idx;
          
          return (
            <div key={s.key} className="flex items-center">
              <div className={`flex flex-col items-center gap-1 ${isActive ? 'text-primary-600' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  isActive ? 'bg-primary-100' : isPast ? 'bg-green-100' : 'bg-gray-100'
                }`}>
                  {isPast ? <CheckCircle2 className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-xs">{s.label}</span>
              </div>
              {idx < 4 && <div className="w-8 h-px bg-gray-200 mx-2" />}
            </div>
          );
        })}
      </div>
      
      {/* 上传区域 */}
      {step === 'upload' && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-primary-400 hover:bg-primary-50/30 transition-colors cursor-pointer"
        >
          <input
            type="file"
            accept=".txt,.json,.pdf,.doc,.docx"
            onChange={handleFileSelect}
            className="hidden"
            id="file-input"
          />
          <label htmlFor="file-input" className="cursor-pointer">
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-2">
              拖拽文件到此处，或点击上传
            </p>
            <p className="text-sm text-gray-400">
              支持 JSON、PDF、Word (.doc/.docx)、TXT 格式
            </p>
          </label>
        </div>
      )}
      
      {/* 解析中 */}
      {step === 'parse' && (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <Loader2 className="w-12 h-12 text-primary-500 mx-auto mb-4 animate-spin" />
          <p className="text-lg font-medium text-gray-800 mb-2">正在解析文件...</p>
          <p className="text-sm text-gray-500">{file?.name}</p>
        </div>
      )}
      
      {/* AI 解析中 - 带实时进度 */}
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
                <span className="text-2xl font-bold text-primary-600">{Math.round(progress.percentage)}%</span>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mt-4">AI 正在生成解析...</h2>
            <p className="text-gray-500 mt-1">{progress.message}</p>
          </div>
          
          {/* 进度条 */}
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
          
          {/* 统计信息 */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-sm mb-1">
                <Clock className="w-4 h-4" />
                <span>已用时间</span>
              </div>
              <div className="font-mono font-medium">{formatTime(analyzeTime)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">速度</div>
              <div className="font-medium">{progress.current > 0 ? (analyzeTime / progress.current).toFixed(1) : '-'} 秒/题</div>
            </div>
            <div className="text-center">
              <div className="text-gray-500 text-sm mb-1">预估剩余</div>
              <div className="font-medium">~{estimatedTime} 秒</div>
            </div>
          </div>
          
          {/* 多 Key 提示 */}
          {keyCount > 1 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-center gap-2">
              <Zap className="w-4 h-4" />
              正在使用 {keyCount} 个 API 配置并发加速
            </div>
          )}
        </div>
      )}
      
      {/* 检查编辑 & 配置 */}
      {(step === 'review' || step === 'analyze') && (
        <div className="space-y-4">
          {/* API 配置 */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wand2 className="w-5 h-5 text-primary-500" />
              <h3 className="font-medium">AI 解析配置</h3>
              {keyCount > 0 && (
                <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                  已缓存 {keyCount} 个 Key
                </span>
              )}
            </div>
            
            {/* 显示已缓存的 Key 状态 */}
            {keyCount > 0 && !showKeyInput && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {config.provider === 'openai' ? 'OpenAI' : 
                       config.provider === 'deepseek' ? 'DeepSeek' : 'SiliconFlow'}
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
            
            {/* Key 输入表单 */}
            {(showKeyInput || keyCount === 0) && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={config.provider}
                    onChange={(e) => updateConfig({ provider: e.target.value as any })}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="deepseek">DeepSeek（推荐）</option>
                    <option value="openai">OpenAI</option>
                    <option value="siliconflow">SiliconFlow</option>
                  </select>
                  
                  <input
                    type="text"
                    value={config.model}
                    onChange={(e) => updateConfig({ model: e.target.value })}
                    placeholder="模型名称（可选）"
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                
                <div className="relative">
                  <input
                    type="password"
                    value={config.apiKey}
                    onChange={(e) => updateConfig({ apiKey: e.target.value })}
                    placeholder="输入 API Key（支持逗号/分号/换行；也支持 deepseek:sk-xxx）"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm pr-20"
                  />
                  {config.apiKey && (
                    <button
                      onClick={() => {
                        setShowKeyInput(false);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 bg-primary-500 text-white rounded hover:bg-primary-600 flex items-center gap-1"
                    >
                      <Save className="w-3 h-3" />
                      保存
                    </button>
                  )}
                </div>
                
                <p className="text-xs text-gray-400">
                  💡 支持多 API 异步：`sk1,sk2` 或 `deepseek:sk` 或 `openai|sk|url|model`
                </p>
              </div>
            )}
            
            {step === 'review' && (
              <button
                onClick={handleGenerateAnalysis}
                disabled={isProcessing || keyCount === 0}
                className="mt-4 w-full py-2 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isProcessing ? '连接中...' : keyCount > 0 ? '开始 AI 解析' : '请先输入 API Key'}
              </button>
            )}
          </div>
          
          {/* 题目列表 */}
          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">共 {questions.length} 道题目</span>
                <span className="text-xs text-gray-400">点击展开编辑</span>
              </div>
              
              {questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-xl border border-gray-100 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                    className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-600">
                      {idx + 1}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {q.type === 'single' ? '单选' : q.type === 'multi' ? '多选' : '判断'}
                    </span>
                    <span className="flex-1 text-left truncate text-gray-700">
                      {q.content.slice(0, 50)}...
                    </span>
                    {q.analysis && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">
                        已解析
                      </span>
                    )}
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedQ === q.id ? 'rotate-180' : ''
                    }`} />
                  </button>
                  
                  <AnimatePresence>
                    {expandedQ === q.id && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="border-t border-gray-100"
                      >
                        <div className="p-4 space-y-3">
                          <textarea
                            value={q.content}
                            onChange={(e) => updateQuestion(q.id, { content: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            rows={2}
                          />
                          {q.options && (
                            <div className="space-y-2">
                              {q.options.map((opt, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-sm text-gray-500 w-6">
                                    {String.fromCharCode(65 + i)}.
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={(e) => {
                                      const newOptions = [...q.options!];
                                      newOptions[i] = e.target.value;
                                      updateQuestion(q.id, { options: newOptions });
                                    }}
                                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-3">
                            <input
                              type="text"
                              value={q.answer}
                              onChange={(e) => updateQuestion(q.id, { answer: e.target.value })}
                              className="w-24 px-3 py-1.5 border border-gray-200 rounded text-sm"
                              placeholder="答案"
                            />
                          </div>
                          {q.analysis && (
                            <div className="bg-green-50 rounded-lg p-3">
                              <div className="text-xs text-green-600 font-medium mb-1">AI 解析</div>
                              <p className="text-sm text-gray-700">{q.analysis}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 导出 */}
      {step === 'export' && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl border border-gray-100 p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">解析完成！</h2>
          <p className="text-gray-500 mb-6">
            共 {questions.length} 道题目，{questions.filter(q => q.analysis).length} 道已生成解析
          </p>
          
          <div className="max-w-sm mx-auto space-y-3">
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="题库名称"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center"
            />
            <button
              onClick={handleExport}
              className="w-full py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              下载题库文件
            </button>
            <button
              onClick={() => {
                setFile(null);
                setQuestions([]);
                setStep('upload');
                setProgress(null);
              }}
              className="w-full py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200"
            >
              提取新题库
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
