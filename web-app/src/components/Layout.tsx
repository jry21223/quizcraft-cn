import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Trophy,
  FileText,
  Home,
  Dices,
  Github,
  Heart,
  MessageCircle,
  MessageSquare,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { IS_OPS_MODE } from '@/config/appMode';
import { useRef, useState } from 'react';

const navItems = IS_OPS_MODE
  ? [
      { path: '/practice', icon: BookOpen, label: '刷题' },
      { path: '/ranking', icon: Trophy, label: '排行榜' },
      { path: '/feedback-board', icon: MessageSquare, label: '反馈看板' },
      { path: '/wheel', icon: Dices, label: '随机大转盘' },
    ]
  : [
      { path: '/', icon: Home, label: '首页' },
      { path: '/practice', icon: BookOpen, label: '刷题' },
      { path: '/extract', icon: FileText, label: '题库工坊' },
      { path: '/ranking', icon: Trophy, label: '排行榜' },
      { path: '/feedback-board', icon: MessageSquare, label: '反馈看板' },
      { path: '/wheel', icon: Dices, label: '随机大转盘' },
  ];

const donateQrUrl =
  (import.meta.env.VITE_DONATE_QR_URL?.trim()) || '/wechat-receive-qrcode.jpg';
const qqGroupQrUrl =
  (import.meta.env.VITE_QQ_GROUP_QR_URL?.trim()) || '/henu-kit-qq-group.png';

const defaultAnnouncementMessage =
  '✨祝大家考试旗开得胜，一切顺利！刷题发现题目错误、功能问题欢迎进群反馈，QQ群：1031855485，后续网站维护、更换网址都会在群内通知';
const defaultAnnouncementQqText = 'QQ群：';

export default function Layout() {
  const location = useLocation();
  const donateDialogRef = useRef<HTMLDialogElement | null>(null);
  const qqGroupDialogRef = useRef<HTMLDialogElement | null>(null);
  const [shouldLoadDonateQr, setShouldLoadDonateQr] = useState(false);
  const [shouldLoadQqGroupQr, setShouldLoadQqGroupQr] = useState(false);
  const [qrLoadFailed, setQrLoadFailed] = useState(false);
  const [qqQrLoadFailed, setQqQrLoadFailed] = useState(false);
  const announcementMessage = (import.meta.env.VITE_ANNOUNCEMENT_MESSAGE || '').trim();
  const announcementQq = (import.meta.env.VITE_ANNOUNCEMENT_QQ || '').trim();
  const announcementText = announcementMessage || defaultAnnouncementMessage;
  const shouldAppendAnnouncementQq =
    announcementQq.length > 0 && !announcementText.includes(announcementQq);

  const shouldShowAnnouncement =
    announcementMessage.length > 0 || announcementQq.length > 0;

  const openDonateDialog = () => {
    setShouldLoadDonateQr(true);
    setQrLoadFailed(false);
    donateDialogRef.current?.showModal();
  };

  const openQqGroupDialog = () => {
    setShouldLoadQqGroupQr(true);
    setQqQrLoadFailed(false);
    qqGroupDialogRef.current?.showModal();
  };
  
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-gray-50 to-white">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={IS_OPS_MODE ? "/practice" : "/"} className="flex items-center gap-2">
            <img
              src="/apple-touch-icon.png"
              alt="刷题助手"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-bold text-lg text-gray-800">
              {IS_OPS_MODE ? '在线刷题' : '刷题助手'}
            </span>
          </Link>
          
          <nav className="flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                  location.pathname === item.path
                    ? 'bg-primary-50 text-primary-600'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      {shouldShowAnnouncement && (
        <section className="border-b border-emerald-100 bg-emerald-50">
          <div className="max-w-5xl mx-auto px-4 py-2 text-sm text-emerald-800">
            <div className="flex flex-col items-center justify-center gap-2 text-center font-medium sm:flex-row sm:flex-wrap">
              <span>
                {announcementText}
                {shouldAppendAnnouncementQq && (
                  <>
                    {' '}
                    {defaultAnnouncementQqText}
                    <span className="font-bold">{announcementQq}</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={openQqGroupDialog}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                <span>扫码进群</span>
              </button>
            </div>
          </div>
        </section>
      )}
      
      {/* 主内容区 */}
      <main className="w-full max-w-5xl mx-auto px-4 py-6 flex-1">
        <Outlet />
      </main>
      
      {/* 页脚 */}
      <footer className="border-t border-white/70 bg-white/55 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-6 text-center">
          <div className="flex flex-col items-center gap-2 text-sm text-gray-500">
            <p>刷题助手 · Jerry</p>
            <button
              type="button"
              onClick={openQqGroupDialog}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              <span>加入 QQ 群</span>
            </button>
            <button
              type="button"
              onClick={openDonateDialog}
              className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 transition-colors hover:border-yellow-300 hover:bg-yellow-100"
            >
              <Heart className="h-3.5 w-3.5" />
              <span>Buy me a coffee</span>
            </button>
            <a
              href="https://github.com/jry21223/quizcraft-cn"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:border-primary-200 hover:text-primary-600"
            >
              <Github className="h-3.5 w-3.5" />
              <span>开源项目，可自行部署</span>
            </a>
          </div>
        </div>
      </footer>

      <dialog
        ref={donateDialogRef}
        aria-labelledby="donate-modal-title"
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 shadow-xl backdrop:bg-black/50"
      >
            <div className="flex items-center justify-between mb-4">
              <h2 id="donate-modal-title" className="text-lg font-semibold text-gray-800">支持作者</h2>
              <button
                type="button"
                onClick={() => donateDialogRef.current?.close()}
                className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 transition-colors"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">微信扫码支持 · 感谢支持</p>
            <div className="rounded-xl border border-gray-100 p-3 flex items-center justify-center bg-gray-50">
              {qrLoadFailed ? (
                <p className="text-xs text-gray-500 leading-relaxed text-center">
                  未配置微信收款码，请在 VITE_DONATE_QR_URL 中配置图片链接
                </p>
              ) : shouldLoadDonateQr ? (
                <img
                  src={donateQrUrl}
                  alt="微信收款码"
                  loading="lazy"
                  decoding="async"
                  className="w-full max-w-[240px] rounded-lg border border-gray-100"
                  onError={() => setQrLoadFailed(true)}
                />
              ) : (
                <p className="text-xs text-gray-500 leading-relaxed text-center">
                  打开后加载微信收款码
                </p>
              )}
            </div>
      </dialog>

      <dialog
        ref={qqGroupDialogRef}
        aria-labelledby="qq-group-modal-title"
        className="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-5 shadow-xl backdrop:bg-black/50"
      >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="qq-group-modal-title" className="text-lg font-semibold text-gray-800">加入 QQ 群</h2>
              <button
                type="button"
                onClick={() => qqGroupDialogRef.current?.close()}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
                aria-label="关闭"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm text-gray-600">扫码加入河大Kit群 · 题库更新和问题反馈都会同步</p>
            <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 p-3">
              {qqQrLoadFailed ? (
                <p className="text-center text-xs leading-relaxed text-gray-500">
                  未配置 QQ 群二维码，请在 VITE_QQ_GROUP_QR_URL 中配置图片链接
                </p>
              ) : shouldLoadQqGroupQr ? (
                <img
                  src={qqGroupQrUrl}
                  alt="河大Kit QQ 群二维码"
                  loading="lazy"
                  decoding="async"
                  className="w-full max-w-[260px] rounded-lg border border-gray-100"
                  onError={() => setQqQrLoadFailed(true)}
                />
              ) : (
                <p className="text-center text-xs leading-relaxed text-gray-500">
                  打开后加载 QQ 群二维码
                </p>
              )}
            </div>
      </dialog>
    </div>
  );
}
