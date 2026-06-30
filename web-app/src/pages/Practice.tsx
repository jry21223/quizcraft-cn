import { useEffect, useReducer, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Shuffle, Target, ListOrdered, ChevronRight } from 'lucide-react';
import { bankApi, practiceApi, userApi } from '@/api/client';
import { useQuizStore } from '@/stores/quizStore';
import type { PracticeMode } from '@/types';
import { IS_OPS_MODE } from '@/config/appMode';

const PRACTICE_MODES = [
  {
    key: 'random' as PracticeMode,
    label: '随机模式',
    desc: '从题库中随机抽取题目',
    icon: Shuffle,
  },
  {
    key: 'hard' as PracticeMode,
    label: '难题模式',
    desc: '专攻正确率低的题目',
    icon: Target,
  },
  {
    key: 'chapter' as PracticeMode,
    label: '章节模式',
    desc: '按章节进行针对性练习',
    icon: ListOrdered,
  },
];

const readStoredUserId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('user_id')?.trim() || '';
};

type PracticeUiState = {
  mode: PracticeMode;
  count: number;
  unlimitedCount: boolean;
  chapterId: string;
  threshold: number;
  loading: boolean;
  displayUserId: string;
  userIdInput: string;
};

const createInitialPracticeUiState = (): PracticeUiState => ({
  mode: 'random',
  count: 20,
  unlimitedCount: false,
  chapterId: '',
  threshold: 50,
  loading: false,
  displayUserId: IS_OPS_MODE ? '' : readStoredUserId(),
  userIdInput: IS_OPS_MODE ? readStoredUserId() : '',
});

const mergePracticeUiState = (
  state: PracticeUiState,
  updates: Partial<PracticeUiState>,
) => ({
  ...state,
  ...updates,
});

export default function Practice() {
  const navigate = useNavigate();
  const { 
    banks, 
    setBanks, 
    setUser, 
    currentBank, 
    setCurrentBank, 
    startPractice 
  } = useQuizStore();
  
  const [ui, setUi] = useReducer(
    mergePracticeUiState,
    undefined,
    createInitialPracticeUiState,
  );
  const {
    mode,
    count,
    unlimitedCount,
    chapterId,
    threshold,
    loading,
    displayUserId,
    userIdInput,
  } = ui;
  
  // 用于处理中文输入法的 composition 状态
  const userIdCompositionRef = useRef(false);
  
  useEffect(() => {
    bankApi.getList().then((res) => {
      setBanks(res.banks);
      const activeBank = useQuizStore.getState().currentBank;
      const activeBankExists = res.banks.some((bank) => bank.key === activeBank);
      if (res.banks.length > 0 && (!activeBank || !activeBankExists)) {
        setCurrentBank(res.banks[0].key);
      }
    });
  }, [setBanks, setCurrentBank]);

  const currentBankData = banks.find((b) => b.key === currentBank);
  const countLabel = mode === 'random' && unlimitedCount ? '不限（全部）' : `${count} 道`;
  
  const handleStart = async () => {
    if (!currentBank) return;

    if (IS_OPS_MODE) {
      const normalizedId = userIdInput.trim();
      if (!normalizedId) {
        alert('请输入ID');
        return;
      }
    }

    setUi({ loading: true });
    try {
      const normalizedUserId = userIdInput.trim();
      const savedUserId = readStoredUserId();

      if (IS_OPS_MODE) {
        localStorage.setItem('user_id', normalizedUserId);
      } else {
        if (!savedUserId) {
          const user = await userApi.ensureUser();
          setUser(user);
          setUi({ displayUserId: user.userId });
        }
      }

      const requestCount = mode === 'random' && unlimitedCount ? 0 : count;
      const result = await practiceApi.start(currentBank, {
        mode,
        count: requestCount,
        chapterId: mode === 'chapter' ? chapterId : undefined,
        threshold: mode === 'hard' ? threshold : undefined,
      });
      
      startPractice(result.questions, currentBank);
      navigate('/quiz');
    } catch (error) {
      alert('开始练习失败: ' + (error as Error).message);
    } finally {
      setUi({ loading: false });
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <BookOpen className="w-6 h-6 text-primary-500" />
        开始练习
      </h1>
      
      {/* 用户 ID 提示 */}
      {!IS_OPS_MODE && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <div className="text-sm font-medium text-gray-700 mb-2">
            排行榜将直接显示你的 ID
          </div>
          <p className="text-sm text-gray-600">
            {displayUserId
              ? `当前 ID：${displayUserId}`
              : '首次开始练习时会自动生成一个 ID。'}
          </p>
        </div>
      )}

      {/* OPS 模式 ID 输入 */}
      {IS_OPS_MODE && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
          <label htmlFor="practice-user-id" className="block text-sm font-medium text-gray-700 mb-2">
            输入你的 ID
          </label>
          <input
            id="practice-user-id"
            type="text"
            value={userIdInput}
            onChange={(e) => {
              if (!userIdCompositionRef.current) {
                setUi({ userIdInput: e.target.value });
              } else {
                setUi({ userIdInput: e.target.value });
              }
            }}
            onCompositionStart={() => {
              userIdCompositionRef.current = true;
            }}
            onCompositionEnd={(e) => {
              userIdCompositionRef.current = false;
              setUi({ userIdInput: (e.target as HTMLInputElement).value });
            }}
            placeholder="请输入学号/工号/自定义ID"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-2">
            该 ID 会用于排行榜统计，可随时修改
          </p>
        </div>
      )}
      
      {/* 选择题库 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="block text-sm font-medium text-gray-700 mb-3">
          选择题库
        </div>
        <div className="grid grid-cols-2 gap-3">
          {banks.map((bank) => (
            <button
              type="button"
              key={bank.key}
              onClick={() => setCurrentBank(bank.key)}
              className={`p-3 rounded-lg border-2 text-left transition-all ${
                currentBank === bank.key
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className="font-medium text-gray-800">{bank.name}</div>
              <div className="text-xs text-gray-500 mt-1">{bank.total} 题</div>
            </button>
          ))}
        </div>
      </div>
      
      {/* 选择模式 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="block text-sm font-medium text-gray-700 mb-3">
          练习模式
        </div>
        <div className="space-y-3">
          {PRACTICE_MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => setUi({ mode: m.key })}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                mode === m.key
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-100 hover:border-gray-200'
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                mode === m.key ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-500'
              }`}>
                <m.icon className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <div className="font-medium text-gray-800">{m.label}</div>
                <div className="text-xs text-gray-500">{m.desc}</div>
              </div>
              <ChevronRight className={`w-5 h-5 ${mode === m.key ? 'text-primary-500' : 'text-gray-300'}`} />
            </button>
          ))}
        </div>
      </div>
      
      {/* 模式设置 */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="block text-sm font-medium text-gray-700 mb-3">
          设置
        </div>
        
        {/* 题目数量 */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">题目数量</span>
            <span className="font-medium text-gray-800">{countLabel}</span>
          </div>
          {mode === 'random' && (
            <button
              type="button"
              onClick={() => setUi({ unlimitedCount: !unlimitedCount })}
              className={`mb-3 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                unlimitedCount
                  ? 'bg-primary-50 border-primary-500 text-primary-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {unlimitedCount ? '已启用不限（抽取全部）' : '启用不限（抽取全部）'}
            </button>
          )}
          <input
            aria-label="题目数量"
            type="range"
            min={5}
            max={mode === 'random' ? Math.max(5, currentBankData?.total || 100) : 50}
            step={mode === 'random' ? 1 : 5}
            value={count}
            onChange={(e) => setUi({ count: Number(e.target.value) })}
            disabled={mode === 'random' && unlimitedCount}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
        </div>
        
        {/* 章节选择 */}
        {mode === 'chapter' && currentBankData && (
          <div className="mb-4">
            <label htmlFor="practice-chapter" className="block text-sm text-gray-600 mb-2">选择章节</label>
            <select
              id="practice-chapter"
              value={chapterId}
              onChange={(e) => setUi({ chapterId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="">请选择章节</option>
              {currentBankData.chapters.map((ch) => (
                <option key={ch.id} value={ch.id}>{ch.name}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* 难度阈值 */}
        {mode === 'hard' && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">正确率阈值</span>
              <span className="font-medium text-gray-800">&lt; {threshold}%</span>
            </div>
            <input
              aria-label="正确率阈值"
              type="range"
              min={30}
              max={70}
              step={5}
              value={threshold}
              onChange={(e) => setUi({ threshold: Number(e.target.value) })}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              只选择正确率低于 {threshold}% 的题目
            </p>
          </div>
        )}
      </div>
      
      {/* 开始按钮 */}
      <button
        type="button"
        onClick={handleStart}
        disabled={loading || (mode === 'chapter' && !chapterId) || (IS_OPS_MODE && !userIdInput.trim())}
        className="w-full py-3 bg-primary-500 text-white font-medium rounded-xl hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '加载中...' : '开始练习'}
      </button>
    </div>
  );
}
