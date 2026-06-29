import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Archive,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Inbox,
  MessageSquare,
  RefreshCw,
} from 'lucide-react';
import { feedbackApi, getAdminToken } from '@/api/client';
import type { FeedbackBoardItem, FeedbackDashboard } from '@/types';

const emptyDashboard: FeedbackDashboard = {
  summary: {
    today_total: 0,
    pending_total: 0,
    resolved_total: 0,
    archived_total: 0,
  },
  pending_items: [],
  resolved_items: [],
  archived_items: [],
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getBankLabel = (item: FeedbackBoardItem) => {
  return item.question_bank || '未知题库';
};

const FeedbackCard = ({
  item,
  action,
}: {
  item: FeedbackBoardItem;
  action?: ReactNode;
}) => {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-gray-100 px-2 py-1 font-medium text-gray-600">
              #{item.feedback_id}
            </span>
            <span>{getBankLabel(item)}</span>
            <span>第 {item.question_index} 题</span>
            <span>{formatDateTime(item.created_at)}</span>
          </div>
          {item.question_content && (
            <p className="mt-3 line-clamp-2 text-sm font-medium text-gray-800">
              {item.question_content}
            </p>
          )}
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
            {item.suggestion}
          </p>
          {item.status === 'resolved' && (
            <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <div className="font-medium">
                已处理 · {formatDateTime(item.resolved_at)}
              </div>
              {item.resolution_note && (
                <div className="mt-1 text-emerald-700">{item.resolution_note}</div>
              )}
            </div>
          )}
          {item.status === 'archived' && (
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <div className="font-medium">已归档</div>
              {item.resolution_note && (
                <div className="mt-1 text-slate-600">{item.resolution_note}</div>
              )}
            </div>
          )}
        </div>
        {action}
      </div>
    </div>
  );
};

export default function FeedbackBoard() {
  const [dashboard, setDashboard] = useState<FeedbackDashboard>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});

  const canManage = useMemo(() => Boolean(getAdminToken()), []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await feedbackApi.getDashboard();
      setDashboard(res);
    } catch (err) {
      setError((err as Error).message || '加载反馈看板失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const markResolved = async (item: FeedbackBoardItem) => {
    setUpdatingId(item.feedback_id);
    setError('');
    try {
      await feedbackApi.updateStatus(item.feedback_id, {
        status: 'resolved',
        resolution_note: notes[item.feedback_id]?.trim() || '',
      });
      await loadDashboard();
    } catch (err) {
      setError((err as Error).message || '更新反馈状态失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const archiveFeedback = async (item: FeedbackBoardItem) => {
    setUpdatingId(item.feedback_id);
    setError('');
    try {
      await feedbackApi.updateStatus(item.feedback_id, {
        status: 'archived',
        resolution_note: notes[item.feedback_id]?.trim() || '归档，不计入待处理',
      });
      await loadDashboard();
    } catch (err) {
      setError((err as Error).message || '更新反馈状态失败');
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = [
    {
      label: '今日总反馈',
      value: dashboard.summary.today_total,
      icon: MessageSquare,
      color: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    {
      label: '待处理反馈',
      value: dashboard.summary.pending_total,
      icon: Clock3,
      color: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    {
      label: '已处理反馈',
      value: dashboard.summary.resolved_total,
      icon: CheckCircle2,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      label: '已归档反馈',
      value: dashboard.summary.archived_total,
      icon: Archive,
      color: 'bg-slate-50 text-slate-700 border-slate-100',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl animate-fade-in space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500 text-white shadow-sm">
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">反馈看板</h1>
            <p className="text-sm text-gray-500">
              题库纠错反馈、处理进度和已处理明细
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadDashboard}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:border-primary-200 hover:text-primary-600 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {stats.map((item) => (
          <div
            key={item.label}
            className={`rounded-xl border p-4 shadow-sm ${item.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.label}</span>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="mt-3 text-3xl font-bold">{item.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">待处理反馈</h2>
          <span className="text-sm text-gray-400">
            {canManage ? '可在本页标记处理' : '公开查看'}
          </span>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : dashboard.pending_items.length > 0 ? (
          <div className="space-y-3">
            {dashboard.pending_items.map((item) => (
              <FeedbackCard
                key={item.feedback_id}
                item={item}
                action={
                  canManage ? (
                    <div className="w-full shrink-0 space-y-2 sm:w-56">
                      <textarea
                        value={notes[item.feedback_id] || ''}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [item.feedback_id]: event.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={1000}
                        placeholder="处理备注"
                        className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
                      />
                      <button
                        type="button"
                        onClick={() => markResolved(item)}
                        disabled={updatingId === item.feedback_id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {updatingId === item.feedback_id ? '处理中...' : '标记已处理'}
                      </button>
                      <button
                        type="button"
                        onClick={() => archiveFeedback(item)}
                        disabled={updatingId === item.feedback_id}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Archive className="h-4 w-4" />
                        {updatingId === item.feedback_id ? '处理中...' : '归档'}
                      </button>
                    </div>
                  ) : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-500">
            <Inbox className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            暂无待处理反馈
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">已处理反馈明细</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : dashboard.resolved_items.length > 0 ? (
          <div className="space-y-3">
            {dashboard.resolved_items.map((item) => (
              <FeedbackCard key={item.feedback_id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-500">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            暂无已处理反馈
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-800">已归档反馈</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
            ))}
          </div>
        ) : dashboard.archived_items.length > 0 ? (
          <div className="space-y-3">
            {dashboard.archived_items.map((item) => (
              <FeedbackCard key={item.feedback_id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-100 bg-white py-10 text-center text-gray-500">
            <Archive className="mx-auto mb-2 h-8 w-8 text-gray-300" />
            暂无已归档反馈
          </div>
        )}
      </section>
    </div>
  );
}
