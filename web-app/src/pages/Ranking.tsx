import { useEffect, useState } from 'react';
import { Trophy, Medal, User, Crown } from 'lucide-react';
import { userApi } from '@/api/client';
import type { RankItem } from '@/types';

export default function Ranking() {
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    userApi.getRanking()
      .then((res) => {
        setRanking(res.ranking);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);
  
  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-5 h-5 text-yellow-500" />;
    if (index === 1) return <Medal className="w-5 h-5 text-gray-400" />;
    if (index === 2) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="w-5 h-5 flex items-center justify-center text-sm text-gray-400">{index + 1}</span>;
  };
  
  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-200';
    if (index === 1) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200';
    if (index === 2) return 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200';
    return 'bg-white border-gray-100';
  };
  
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
          <Trophy className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">排行榜</h1>
          <p className="text-sm text-gray-500">看看谁是最强刷题王</p>
        </div>
      </div>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : ranking.length > 0 ? (
        <div className="space-y-3">
          {ranking.map((item, index) => (
            <div
              key={item.user_id}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${getRankBg(index)}`}
            >
              <div className="flex-shrink-0">
                {getRankIcon(index)}
              </div>
              
              <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 truncate">
                  {item.user_id}
                </div>
                <div className="text-sm text-gray-500">
                  答对 {item.correct} / {item.total} 题
                </div>
              </div>
              
              <div className="text-right">
                <div className={`text-lg font-bold ${
                  item.accuracy >= 80 ? 'text-green-600' : 
                  item.accuracy >= 60 ? 'text-blue-600' : 'text-gray-600'
                }`}>
                  {item.accuracy}%
                </div>
                <div className="text-xs text-gray-400">正确率</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100">
          <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">暂无排行榜数据</p>
          <p className="text-sm text-gray-400 mt-1">快来刷题成为第一名吧！</p>
        </div>
      )}
    </div>
  );
}
