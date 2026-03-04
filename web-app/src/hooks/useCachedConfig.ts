import { useState, useEffect } from 'react';
import type { AnalysisConfig } from '@/types';

const CACHE_KEY = 'quiz_app_llm_config';
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 天过期

interface CachedConfig {
  config: AnalysisConfig;
  timestamp: number;
}

export function useCachedConfig() {
  const [config, setConfig] = useState<AnalysisConfig>({
    provider: 'deepseek',
    apiKey: '',
    apiUrl: '',
    model: '',
  });
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data: CachedConfig = JSON.parse(cached);
        // 检查是否过期
        if (Date.now() - data.timestamp < CACHE_EXPIRY) {
          setConfig(data.config);
        } else {
          // 过期清除
          localStorage.removeItem(CACHE_KEY);
        }
      }
    } catch (e) {
      console.error('加载缓存配置失败:', e);
    }
    setIsLoaded(true);
  }, []);

  // 保存到 localStorage
  const saveConfig = (newConfig: AnalysisConfig) => {
    setConfig(newConfig);
    try {
      const data: CachedConfig = {
        config: newConfig,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('保存配置失败:', e);
    }
  };

  // 清除缓存
  const clearConfig = () => {
    setConfig({
      provider: 'deepseek',
      apiKey: '',
      apiUrl: '',
      model: '',
    });
    localStorage.removeItem(CACHE_KEY);
  };

  // 更新单个字段
  const updateConfig = (updates: Partial<AnalysisConfig>) => {
    const newConfig = { ...config, ...updates };
    saveConfig(newConfig);
  };

  // 获取 API Key 数量（用于显示）
  const keyCount = config.apiKey
    .split(/[,\n;]+/)
    .filter(k => k.trim())
    .length;

  return {
    config,
    setConfig: saveConfig,
    updateConfig,
    clearConfig,
    isLoaded,
    keyCount,
  };
}
