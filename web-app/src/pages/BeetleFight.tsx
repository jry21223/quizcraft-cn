import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LinearScale,
  ChartConfiguration
} from 'chart.js';
import html2canvas from 'html2canvas';

// 注册 Chart.js 组件
ChartJS.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  LinearScale
);

// 等级规则
const GRADE_RULES: Array<{ grade: string; min: number }> = [
  { grade: 'SSS', min: 97 },
  { grade: 'SS', min: 92 },
  { grade: 'S', min: 86 },
  { grade: 'A+', min: 80 },
  { grade: 'A', min: 74 },
  { grade: 'B+', min: 67 },
  { grade: 'B', min: 60 },
  { grade: 'C+', min: 50 },
  { grade: 'C', min: 40 },
  { grade: 'D', min: 0 }
];

const GRADE_COLORS: Record<string, string> = {
  SSS: '#ff3df2',
  SS: '#ff7a00',
  S: '#ffe45e',
  'A+': '#74f9ff',
  A: '#00d8ff',
  'B+': '#62ff8f',
  B: '#2cd96b',
  'C+': '#9fd870',
  C: '#c2cbd5',
  D: '#8b95a3'
};

const valueToGrade = (v: number): string => {
  for (const rule of GRADE_RULES) {
    if (v >= rule.min) return rule.grade;
  }
  return 'D';
};

const gradeColor = (grade: string): string => GRADE_COLORS[grade] || '#fff';

const normValue = (v: number | string): number => {
  const n = Number(v);
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const normCount = (v: number | string): number => {
  const n = Number(v);
  if (isNaN(n)) return 6;
  return Math.max(3, Math.min(30, Math.round(n)));
};

const randomHex = (): string => {
  const colors = ['#00d9ff', '#7b61ff', '#ff4fd8', '#ffa34d', '#00ffa6', '#ff5f7a', '#7dff5a', '#ffd84d', '#7d9dff', '#ff7af5'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const alphaColor = (hex: string, alpha = '28'): string => hex + alpha;

const escapeHtml = (str: string): string => String(str).replace(/[&<>]/g, (m) => {
  if (m === '&') return '&amp;';
  if (m === '<') return '&lt;';
  if (m === '>') return '&gt;';
  return m;
});

// 自定义插件：顶点标签
const valueLabelPlugin = {
  id: 'valueLabelPlugin',
  afterDatasetsDraw(chart: ChartJS, _args: unknown, pluginOptions: { mode: string }) {
    const mode = pluginOptions?.mode || 'none';
    if (mode === 'none') return;

    const ctx = chart.ctx;
    const scale = chart.scales.r as RadialLinearScale & { yCenter: number; xCenter: number };
    if (!scale) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex: number) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.data) return;
      const data = dataset.data as number[];

      meta.data.forEach((point: { x: number; y: number }, pointIndex: number) => {
        const rawValue = data[pointIndex];
        const grade = valueToGrade(rawValue);
        const text = mode === 'grade' ? grade : String(rawValue);
        const textColor = mode === 'grade' ? gradeColor(grade) : '#fff';

        const angle = Math.atan2(point.y - scale.yCenter, point.x - scale.xCenter);
        const spread = 18 + datasetIndex * 16;
        const x = point.x + Math.cos(angle) * spread;
        const y = point.y + Math.sin(angle) * spread;

        ctx.shadowBlur = 16;
        ctx.shadowColor = textColor;
        ctx.font = mode === 'grade' ? '900 18px "Microsoft YaHei"' : '900 16px "Microsoft YaHei"';

        ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(0,0,0,0.86)';
        ctx.strokeText(text, x, y);

        ctx.fillStyle = textColor;
        ctx.fillText(text, x, y);

        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.strokeText(text, x, y);
      });
    });
    ctx.restore();
  }
};

ChartJS.register(valueLabelPlugin);

interface Role {
  id: number;
  name: string;
  fillColor: string;
  borderColor: string;
  values: number[];
  hidden: boolean;
}

interface FloatingEditor {
  visible: boolean;
  x: number;
  y: number;
  type: 'dimension' | 'value' | null;
  title: string;
  value: string;
  dimensionIndex: number | null;
  datasetVisibleIndex: number | null;
  realRoleIndex: number | null;
}

interface NearestPoint {
  datasetIndex: number;
  pointIndex: number;
  x: number;
  y: number;
}

interface DragState {
  dragging: boolean;
  datasetIndex: number | null;
  pointIndex: number | null;
  pendingValue: number | null;
  hasMoved: boolean;
}

export default function BeetleFight() {
  const [mainTitle, setMainTitle] = useState('赛博斗蛐蛐 · 角色面板');
  const [introText, setIntroText] = useState('高频震荡型个体，具备较强爆发与压制性能。综合面板偏进攻向，适合截图展示、角色对比与赛博斗蛐蛐风格展示。');
  const [pointLabelMode, setPointLabelMode] = useState<string>('grade');
  const [tooltipMode, setTooltipMode] = useState<string>('both');
  const [lineStyle, setLineStyle] = useState<string>('curve');
  const [dimensions, setDimensions] = useState<string[]>(['攻击', '防御', '速度', '技巧', '耐久', '气势']);
  const [roles, setRoles] = useState<Role[]>([
    {
      id: 1,
      name: '赤电斗蛐',
      fillColor: '#00d9ff',
      borderColor: '#7b61ff',
      values: [86, 72, 91, 77, 66, 88],
      hidden: false
    },
    {
      id: 2,
      name: '紫焰斗蛐',
      fillColor: '#ff4fd8',
      borderColor: '#ffa34d',
      values: [79, 81, 73, 88, 69, 84],
      hidden: false
    }
  ]);
  const [roleIdSeed, setRoleIdSeed] = useState(3);
  const [status, setStatus] = useState<{ text: string; isError: boolean }>({ text: '已加载默认数据', isError: false });
  const [floatingEditor, setFloatingEditor] = useState<FloatingEditor>({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    title: '',
    value: '',
    dimensionIndex: null,
    datasetVisibleIndex: null,
    realRoleIndex: null
  });

  const radarChartRef = useRef<HTMLCanvasElement>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const eventCleanupRef = useRef<(() => void) | null>(null);
  const rolesRef = useRef<Role[]>(roles);
  const dimensionsRef = useRef<string[]>(dimensions);
  const suppressClickRef = useRef(false);
  const dragStateRef = useRef<DragState>({
    dragging: false,
    datasetIndex: null,
    pointIndex: null,
    pendingValue: null,
    hasMoved: false
  });
  const canvasEventsBoundRef = useRef(false);
  const captureAreaRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    rolesRef.current = roles;
  }, [roles]);

  useEffect(() => {
    dimensionsRef.current = dimensions;
  }, [dimensions]);

  const getVisibleRoleIndexes = useCallback((sourceRoles: Role[] = rolesRef.current): number[] => {
    return sourceRoles.reduce<number[]>((indexes, role, index) => {
      if (!role.hidden) indexes.push(index);
      return indexes;
    }, []);
  }, []);

  const getVisibleRoles = useCallback((): Role[] => {
    return getVisibleRoleIndexes().map(index => rolesRef.current[index]);
  }, [getVisibleRoleIndexes]);

  const visibleDatasetIndexToRealRoleIndex = useCallback((datasetIndex: number): number | undefined => {
    return getVisibleRoleIndexes()[datasetIndex];
  }, [getVisibleRoleIndexes]);

  const getMousePos = (canvas: HTMLCanvasElement, evt: MouseEvent | TouchEvent): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect();
    const src = 'touches' in evt && evt.touches ? evt.touches[0] : (evt as MouseEvent);
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top
    };
  };

  const findNearestPoint = (evt: MouseEvent | TouchEvent): NearestPoint | null => {
    if (!chartInstanceRef.current) return null;
    const canvas = chartInstanceRef.current.canvas;
    const pos = getMousePos(canvas, evt);
    let nearest: NearestPoint | null = null;
    let min = Infinity;
    const threshold = 32;

    chartInstanceRef.current.data.datasets.forEach((_ds, datasetIndex: number) => {
      const meta = chartInstanceRef.current!.getDatasetMeta(datasetIndex);
      if (!meta.data) return;
      meta.data.forEach((pt: { x: number; y: number }, pointIndex: number) => {
        const dx = pt.x - pos.x;
        const dy = pt.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold && dist < min) {
          min = dist;
          nearest = { datasetIndex, pointIndex, x: pt.x, y: pt.y };
        }
      });
    });

    return nearest;
  };

  const findAxisLabelIndex = (evt: MouseEvent | TouchEvent): number => {
    if (!chartInstanceRef.current) return -1;
    const canvas = chartInstanceRef.current.canvas;
    const pos = getMousePos(canvas, evt);
    const scale = chartInstanceRef.current.scales.r as RadialLinearScale & {
      getPointPositionForValue: (index: number, value: number) => { x: number; y: number };
      max: number;
    };
    const hitRadius = 36;

    for (let i = 0; i < dimensionsRef.current.length; i++) {
      const p = scale.getPointPositionForValue(i, scale.max + 10);
      const dx = p.x - pos.x;
      const dy = p.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= hitRadius) return i;
    }
    return -1;
  };

  const getFloatingEditorPosition = useCallback((localX: number, localY: number) => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper) {
      return { x: localX + 12, y: localY + 12 };
    }

    const maxLeft = Math.max(12, wrapper.clientWidth - 260);
    const maxTop = Math.max(12, wrapper.clientHeight - 120);
    return {
      x: Math.max(12, Math.min(localX + 12, maxLeft)),
      y: Math.max(12, Math.min(localY + 12, maxTop))
    };
  }, []);

  const updateDragValue = (evt: MouseEvent | TouchEvent) => {
    if (!dragStateRef.current.dragging || !chartInstanceRef.current) return;
    if (dragStateRef.current.datasetIndex === null || dragStateRef.current.pointIndex === null) return;

    const canvas = chartInstanceRef.current.canvas;
    const pos = getMousePos(canvas, evt);
    const scale = chartInstanceRef.current.scales.r as RadialLinearScale & {
      yCenter: number;
      xCenter: number;
      drawingArea: number;
      max: number;
      min: number;
      getValueForDistanceFromCenter?: (distance: number) => number;
    };
    const dx = pos.x - scale.xCenter;
    const dy = pos.y - scale.yCenter;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let value: number;
    if (typeof scale.getValueForDistanceFromCenter === 'function') {
      value = scale.getValueForDistanceFromCenter(distance);
    } else {
      value = (distance / scale.drawingArea) * (scale.max - scale.min) + scale.min;
    }

    value = Math.max(0, Math.min(100, Math.round(value)));
    const realRoleIndex = visibleDatasetIndexToRealRoleIndex(dragStateRef.current.datasetIndex);
    if (realRoleIndex === undefined) return;
    dragStateRef.current.pendingValue = value;
    dragStateRef.current.hasMoved = true;

    const dataset = chartInstanceRef.current.data.datasets[dragStateRef.current.datasetIndex] as { data: number[] };
    dataset.data[dragStateRef.current.pointIndex] = value;
    chartInstanceRef.current.update('none');

    const roleName = rolesRef.current[realRoleIndex]?.name || `角色 ${realRoleIndex + 1}`;
    const dimensionName = dimensionsRef.current[dragStateRef.current.pointIndex] || `维度 ${dragStateRef.current.pointIndex + 1}`;
    setStatus({ text: `拖动中：${roleName} · ${dimensionName} = ${value}`, isError: false });
  };

  const initChart = useCallback(() => {
    if (!radarChartRef.current) return;

    const visibleRoles = getVisibleRoles();
    const datasets = visibleRoles.map(role => ({
      label: role.name,
      data: [...role.values],
      backgroundColor: alphaColor(role.fillColor, '28'),
      borderColor: role.borderColor,
      borderWidth: 3,
      pointBackgroundColor: '#ffffff',
      pointBorderColor: role.borderColor,
      pointBorderWidth: 3,
      pointRadius: 6,
      pointHitRadius: 26,
      pointHoverRadius: 9,
      tension: lineStyle === 'curve' ? 0.22 : 0
    }));

    const chartData = {
      labels: dimensions,
      datasets
    };

    const options: ChartConfiguration<'radar'>['options'] = {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 850,
        easing: 'easeOutQuart'
      },
      interaction: {
        mode: 'nearest',
        intersect: false
      },
      layout: {
        padding: { top: 44, right: 54, bottom: 44, left: 54 }
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: {
            stepSize: 20,
            color: '#81a7bf',
            backdropColor: 'transparent',
            font: { size: 12 }
          },
          angleLines: { color: 'rgba(0,255,255,0.18)' },
          grid: { color: 'rgba(123,97,255,0.22)' },
          pointLabels: {
            color: '#d9f4ff',
            font: { size: 15, weight: 700 }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(7,15,28,0.95)',
          borderColor: 'rgba(0,255,255,0.28)',
          borderWidth: 1,
          titleColor: '#ffffff',
          bodyColor: '#d9f6ff',
          callbacks: {
            label: (ctx) => {
              const v = ctx.raw as number;
              const g = valueToGrade(v);
              if (tooltipMode === 'grade') {
                return `${ctx.dataset.label} · ${ctx.label}: ${g}`;
              }
              if (tooltipMode === 'both') {
                return `${ctx.dataset.label} · ${ctx.label}: ${v} 分（${g}）`;
              }
              return `${ctx.dataset.label} · ${ctx.label}: ${v} 分`;
            }
          }
        }
      }
    };

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    chartInstanceRef.current = new ChartJS(radarChartRef.current, {
      type: 'radar',
      data: chartData,
      options
    });

    // 绑定事件
    if (!canvasEventsBoundRef.current && chartInstanceRef.current) {
      canvasEventsBoundRef.current = true;
      const canvas = chartInstanceRef.current.canvas;
      canvas.style.touchAction = 'none';

      const startDrag = (evt: MouseEvent | TouchEvent) => {
        setFloatingEditor(prev => ({ ...prev, visible: false }));
        const nearest = findNearestPoint(evt);
        if (!nearest) return;
        dragStateRef.current.dragging = true;
        dragStateRef.current.datasetIndex = nearest.datasetIndex;
        dragStateRef.current.pointIndex = nearest.pointIndex;
        dragStateRef.current.pendingValue = null;
        dragStateRef.current.hasMoved = false;
        suppressClickRef.current = false;
        setIsDragging(true);
        if (evt.cancelable) evt.preventDefault();
      };

      const moveDrag = (evt: MouseEvent | TouchEvent) => {
        if (!dragStateRef.current.dragging) return;
        if (evt.cancelable) evt.preventDefault();
        updateDragValue(evt);
      };

      const endDrag = () => {
        if (!dragStateRef.current.dragging) return;
        const { datasetIndex, pointIndex, pendingValue, hasMoved } = dragStateRef.current;
        if (datasetIndex !== null && pointIndex !== null && pendingValue !== null) {
          const realRoleIndex = visibleDatasetIndexToRealRoleIndex(datasetIndex);
          if (realRoleIndex !== undefined) {
            setRoles(prev => prev.map((role, roleIndex) => {
              if (roleIndex !== realRoleIndex) return role;
              const nextValues = [...role.values];
              nextValues[pointIndex] = pendingValue;
              return { ...role, values: nextValues };
            }));
            const roleName = rolesRef.current[realRoleIndex]?.name || `角色 ${realRoleIndex + 1}`;
            const dimensionName = dimensionsRef.current[pointIndex] || `维度 ${pointIndex + 1}`;
            setStatus({ text: `已更新：${roleName} · ${dimensionName} = ${pendingValue}`, isError: false });
          }
        } else if (hasMoved) {
          setStatus({ text: '拖动完成', isError: false });
        }
        suppressClickRef.current = hasMoved;

        dragStateRef.current.dragging = false;
        dragStateRef.current.datasetIndex = null;
        dragStateRef.current.pointIndex = null;
        dragStateRef.current.pendingValue = null;
        dragStateRef.current.hasMoved = false;
        setIsDragging(false);
      };

      const clickHandler = (evt: MouseEvent) => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false;
          return;
        }
        if (dragStateRef.current.dragging) return;
        const labelIndex = findAxisLabelIndex(evt);
        if (labelIndex !== -1) {
          const pos = getMousePos(canvas, evt);
          const editorPos = getFloatingEditorPosition(pos.x, pos.y);
          setFloatingEditor({
            visible: true,
            x: editorPos.x,
            y: editorPos.y,
            type: 'dimension',
            title: `编辑维度 ${labelIndex + 1} 名称`,
            value: dimensionsRef.current[labelIndex],
            dimensionIndex: labelIndex,
            datasetVisibleIndex: null,
            realRoleIndex: null
          });
        }
      };

      const dblclickHandler = (evt: MouseEvent) => {
        const nearest = findNearestPoint(evt);
        if (!nearest) return;
        const realRoleIndex = visibleDatasetIndexToRealRoleIndex(nearest.datasetIndex);
        if (realRoleIndex === undefined) return;
        const role = rolesRef.current[realRoleIndex];
        const pos = getMousePos(canvas, evt);
        const editorPos = getFloatingEditorPosition(pos.x, pos.y);

        setFloatingEditor({
          visible: true,
          x: editorPos.x,
          y: editorPos.y,
          type: 'value',
          title: `${role.name} · ${dimensionsRef.current[nearest.pointIndex]}`,
          value: String(role.values[nearest.pointIndex]),
          dimensionIndex: nearest.pointIndex,
          datasetVisibleIndex: nearest.datasetIndex,
          realRoleIndex: realRoleIndex
        });
      };

      canvas.addEventListener('mousedown', startDrag);
      window.addEventListener('mousemove', moveDrag);
      window.addEventListener('mouseup', endDrag);
      canvas.addEventListener('touchstart', startDrag, { passive: false });
      window.addEventListener('touchmove', moveDrag, { passive: false });
      window.addEventListener('touchend', endDrag, { passive: false });
      window.addEventListener('touchcancel', endDrag, { passive: false });
      canvas.addEventListener('click', clickHandler);
      canvas.addEventListener('dblclick', dblclickHandler);

      eventCleanupRef.current = () => {
        canvas.removeEventListener('mousedown', startDrag);
        window.removeEventListener('mousemove', moveDrag);
        window.removeEventListener('mouseup', endDrag);
        canvas.removeEventListener('touchstart', startDrag);
        window.removeEventListener('touchmove', moveDrag);
        window.removeEventListener('touchend', endDrag);
        window.removeEventListener('touchcancel', endDrag);
        canvas.removeEventListener('click', clickHandler);
        canvas.removeEventListener('dblclick', dblclickHandler);
      };
    }
  }, [dimensions, getFloatingEditorPosition, getVisibleRoles, lineStyle, pointLabelMode, roles, tooltipMode, visibleDatasetIndexToRealRoleIndex]);

  useEffect(() => {
    if (radarChartRef.current) {
      initChart();
    }
  }, [initChart]);

  useEffect(() => {
    return () => {
      eventCleanupRef.current?.();
      chartInstanceRef.current?.destroy();
    };
  }, []);

  const handleDragStart = (e: React.DragEvent, id: number) => {
    e.dataTransfer.setData('text/plain', String(id));
    (e.target as HTMLElement).classList.add('dragging');
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove('dragging');
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const sourceId = parseInt(e.dataTransfer.getData('text/plain'));
    if (sourceId === targetId) return;
    const sourceIndex = roles.findIndex(r => r.id === sourceId);
    const targetIndex = roles.findIndex(r => r.id === targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;
    const newRoles = [...roles];
    const [movedRole] = newRoles.splice(sourceIndex, 1);
    newRoles.splice(targetIndex, 0, movedRole);
    setRoles(newRoles);
    setStatus({ text: '角色顺序已调整', isError: false });
  };

  const addRole = () => {
    const newId = roleIdSeed;
    setRoleIdSeed(prev => prev + 1);
    setRoles(prev => [...prev, {
      id: newId,
      name: `斗蛐${prev.length + 1}`,
      fillColor: randomHex(),
      borderColor: randomHex(),
      values: Array.from({ length: dimensions.length }, () => 60),
      hidden: false
    }]);
    setStatus({ text: '已新增角色', isError: false });
  };

  const removeRole = (id: number) => {
    if (roles.length <= 1) {
      setStatus({ text: '至少保留一个角色', isError: true });
      return;
    }
    setRoles(prev => prev.filter(r => r.id !== id));
    setStatus({ text: '角色已移除', isError: false });
  };

  const toggleRoleHidden = (id: number) => {
    const role = roles.find(r => r.id === id);
    if (!role) return;
    const visibleCount = roles.filter(r => !r.hidden).length;
    if (!role.hidden && visibleCount <= 1) {
      setStatus({ text: '至少保留一个显示中的角色', isError: true });
      return;
    }
    setRoles(prev => prev.map(r => r.id === id ? { ...r, hidden: !r.hidden } : r));
    setStatus({ text: role.hidden ? `已显示：${role.name}` : `已隐藏：${role.name}`, isError: false });
  };

  const updateRoleName = (id: number, name: string) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, name } : r));
  };

  const updateRoleFillColor = (id: number, color: string) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, fillColor: color } : r));
  };

  const updateRoleBorderColor = (id: number, color: string) => {
    setRoles(prev => prev.map(r => r.id === id ? { ...r, borderColor: color } : r));
  };

  const applyDimensionCount = (targetCount: number) => {
    const count = normCount(targetCount);
    const oldCount = dimensions.length;
    const preset = ['攻击', '防御', '速度', '技巧', '耐久', '气势', '爆发', '控场', '成长', '稳定', '压制', '回复', '命中', '闪避', '韧性', '心态', '狡诈', '侵略', '统治', '适应', '抗压', '智慧', '敏锐', '恢复', '谋略', '反应', '续航', '强袭', '穿透', '支配'];

    if (count > oldCount) {
      const newDimensions = [...dimensions];
      for (let i = oldCount; i < count; i++) {
        newDimensions.push(preset[i] || `维度${i + 1}`);
      }
      setDimensions(newDimensions);
      setRoles(prev => prev.map(role => ({
        ...role,
        values: [...role.values, ...Array(count - oldCount).fill(60)]
      })));
    } else if (count < oldCount) {
      setDimensions(dimensions.slice(0, count));
      setRoles(prev => prev.map(role => ({
        ...role,
        values: role.values.slice(0, count)
      })));
    }
    setStatus({ text: `维度数量已更新为 ${count}`, isError: false });
  };

  const addDimension = () => {
    applyDimensionCount(dimensions.length + 1);
  };

  const updateDimensionName = (index: number, name: string) => {
    const newDimensions = [...dimensions];
    newDimensions[index] = name;
    setDimensions(newDimensions);
    setStatus({ text: `维度已改名：${name}`, isError: false });
  };

  const exportJson = () => {
    const data = {
      version: 'cyber-radar-final-v3',
      mainTitle,
      introText,
      pointLabelMode,
      tooltipMode,
      lineStyle,
      dimensions,
      roles: roles.map(r => ({
        id: r.id,
        name: r.name,
        fillColor: r.fillColor,
        borderColor: r.borderColor,
        values: [...r.values],
        hidden: r.hidden
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `${(mainTitle || '赛博斗蛐蛐配置').replace(/[\\/:*?"<>|]/g, '_')}.json`;
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ text: 'JSON 已保存', isError: false });
  };

  const importJson = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setMainTitle(data.mainTitle || '赛博斗蛐蛐 · 角色面板');
        setIntroText(data.introText || '');
        setPointLabelMode(data.pointLabelMode || 'grade');
        setTooltipMode(data.tooltipMode || 'both');
        setLineStyle(data.lineStyle || 'curve');
        setDimensions(Array.isArray(data.dimensions) && data.dimensions.length ? data.dimensions.slice(0, 30) : ['攻击', '防御', '速度', '技巧', '耐久', '气势']);
        const newRoles: Role[] = Array.isArray(data.roles) && data.roles.length
          ? data.roles.map((r: Partial<Role>, index: number) => ({
              id: r.id || index + 1,
              name: r.name || `斗蛐${index + 1}`,
              fillColor: r.fillColor || randomHex(),
              borderColor: r.borderColor || randomHex(),
              values: Array.isArray(r.values) ? r.values.map(v => normValue(v)) : Array.from({ length: dimensions.length }, () => 60),
              hidden: !!r.hidden
            }))
          : [{
              id: 1,
              name: '赤电斗蛐',
              fillColor: '#00d9ff',
              borderColor: '#7b61ff',
              values: Array.from({ length: dimensions.length }, () => 60),
              hidden: false
            }];
        setRoles(newRoles);
        const maxId = Math.max(...newRoles.map(r => r.id), 0);
        setRoleIdSeed(maxId + 1);
        setStatus({ text: 'JSON 已读取', isError: false });
      } catch {
        setStatus({ text: 'JSON 文件格式错误', isError: true });
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const saveAsImage = async () => {
    if (!captureAreaRef.current) return;
    try {
      setStatus({ text: '正在生成图片...', isError: false });
      const watermark = document.createElement('div');
      watermark.className = 'export-watermark';
      watermark.textContent = 'Designer @ XRJprogram';
      watermark.style.cssText = `
        position: absolute;
        right: 18px;
        bottom: 14px;
        font-size: 28px;
        font-weight: 900;
        letter-spacing: 2px;
        color: rgba(255,255,255,0.16);
        pointer-events: none;
        user-select: none;
        z-index: 5;
        text-shadow: 0 0 10px rgba(255,255,255,0.08);
      `;
      captureAreaRef.current.appendChild(watermark);

      const canvas = await html2canvas(captureAreaRef.current);

      watermark.remove();

      const link = document.createElement('a');
      link.download = `${(mainTitle || '赛博斗蛐蛐').replace(/[\\/:*?"<>|]/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      setStatus({ text: '图片已保存（已附带右下角水印）', isError: false });
    } catch {
      const old = document.querySelector('.export-watermark');
      if (old) old.remove();
      setStatus({ text: '保存图片失败', isError: true });
    }
  };

  const saveFloatingEditor = () => {
    if (!floatingEditor.visible) return;
    const val = floatingEditor.value.trim();

    if (floatingEditor.type === 'dimension' && floatingEditor.dimensionIndex !== null) {
      if (!val) {
        setStatus({ text: '维度名称不能为空', isError: true });
        return;
      }
      updateDimensionName(floatingEditor.dimensionIndex, val);
      setFloatingEditor(prev => ({ ...prev, visible: false }));
    } else if (floatingEditor.type === 'value' && floatingEditor.realRoleIndex !== null && floatingEditor.dimensionIndex !== null) {
      const num = normValue(val);
      const realRoleIndex = floatingEditor.realRoleIndex;
      const dimIndex = floatingEditor.dimensionIndex;
      setRoles(prev => {
        const newRoles = [...prev];
        newRoles[realRoleIndex].values[dimIndex] = num;
        return newRoles;
      });
      setFloatingEditor(prev => ({ ...prev, visible: false }));
      setStatus({ text: `已修改：${roles[realRoleIndex]?.name} · ${dimensions[dimIndex]} = ${num}`, isError: false });
    }
  };

  const renderRoleCards = () => {
    return roles.map((role, index) => (
      <div
        key={role.id}
        className="role-card"
        draggable
        onDragStart={(e) => handleDragStart(e, role.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, role.id)}
      >
        <h3 className="role-card-title">
          <span>角色 {index + 1} {role.hidden && '（已隐藏）'}</span>
          <span className="role-order-tip">拖拽排序</span>
        </h3>
        <div className="role-fields">
          <div className="field-full">
            <label>角色名称</label>
            <input
              type="text"
              value={role.name}
              onChange={(e) => updateRoleName(role.id, e.target.value)}
            />
          </div>
          <div className="field-half">
            <label>填充色</label>
            <input
              type="color"
              value={role.fillColor}
              onChange={(e) => updateRoleFillColor(role.id, e.target.value)}
            />
          </div>
          <div className="field-half">
            <label>边框色</label>
            <input
              type="color"
              value={role.borderColor}
              onChange={(e) => updateRoleBorderColor(role.id, e.target.value)}
            />
          </div>
          <div className="field-full field-buttons">
            <button className="outline-btn" onClick={() => toggleRoleHidden(role.id)}>
              {role.hidden ? '显示角色' : '隐藏角色'}
            </button>
            <button className="outline-btn" onClick={() => removeRole(role.id)}>删除角色</button>
          </div>
        </div>
      </div>
    ));
  };

  return (
    <div className="beetle-container">
      <div className="beetle-panel">
        <h1 className="beetle-title">赛博斗蛐蛐 · 战力雷达矩阵</h1>

        <div className="control-row">
          <div className="control-item">
            <label>主标题：</label>
            <input type="text" value={mainTitle} onChange={(e) => setMainTitle(e.target.value)} />
          </div>
          <div className="control-item">
            <label>维度数量：</label>
            <input
              type="number"
              min={3}
              max={30}
              value={dimensions.length}
              onChange={(e) => applyDimensionCount(Number(e.target.value))}
            />
          </div>
          <div className="control-item">
            <label>顶点显示：</label>
            <select value={pointLabelMode} onChange={(e) => setPointLabelMode(e.target.value)}>
              <option value="none">不显示</option>
              <option value="number">显示数值</option>
              <option value="grade">显示等级</option>
            </select>
          </div>
          <div className="control-item">
            <label>悬浮提示：</label>
            <select value={tooltipMode} onChange={(e) => setTooltipMode(e.target.value)}>
              <option value="number">原始数值</option>
              <option value="grade">等级</option>
              <option value="both">数值 + 等级</option>
            </select>
          </div>
          <div className="control-item">
            <label>线条样式：</label>
            <select value={lineStyle} onChange={(e) => setLineStyle(e.target.value)}>
              <option value="curve">曲线</option>
              <option value="straight">直线</option>
            </select>
          </div>
        </div>

        <div className="control-row">
          <div className="control-item control-block">
            <label>介绍：</label>
            <textarea value={introText} onChange={(e) => setIntroText(e.target.value)}></textarea>
          </div>
        </div>

        <div className="action-row">
          <button className="outline-btn" onClick={() => applyDimensionCount(dimensions.length)}>应用维度数量</button>
          <button className="outline-btn" onClick={addDimension}>新增维度</button>
          <button className="outline-btn" onClick={addRole}>新增角色</button>
          <button className="outline-btn" onClick={exportJson}>保存JSON</button>
          <button className="outline-btn" onClick={() => document.getElementById('importJsonInput')?.click()}>读取JSON</button>
          <button className="outline-btn" onClick={saveAsImage}>保存图片</button>
          <input
            type="file"
            id="importJsonInput"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
          />
        </div>

        <div className="sub-title">角色配置（支持拖拽排序）</div>
        <div className="roles-wrap">
          {renderRoleCards()}
        </div>

        <div className="status-bar" style={{ color: status.isError ? '#ff9b9b' : '#9fdfff' }}>
          {status.text}
        </div>
      </div>

      <div className="beetle-panel chart-card" ref={captureAreaRef} style={{ position: 'relative' }}>
        <div className="chart-header">
          <div className="chart-main-title">{mainTitle}</div>
          <div className="chart-subtitle">{introText}</div>
          <div className="fighters-line">
            {roles.map(r => r.name).join('  VS  ')}
          </div>
          <div className="legend-mini">
            {roles.map(role => (
              <div
                key={role.id}
                className={`legend-item ${role.hidden ? 'hidden' : ''}`}
                onClick={() => toggleRoleHidden(role.id)}
                style={{ color: role.borderColor }}
              >
                <span className="legend-dot" style={{ background: role.borderColor }}></span>
                <span>{escapeHtml(role.name)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`chart-wrapper ${isDragging ? 'dragging' : ''}`} ref={chartWrapperRef}>
          <canvas ref={radarChartRef}></canvas>

          {floatingEditor.visible && (
            <div
              className="floating-editor active"
              style={{
                position: 'absolute',
                left: floatingEditor.x,
                top: floatingEditor.y,
                zIndex: 20,
                minWidth: '220px',
                maxWidth: '260px'
              }}
            >
              <div className="floating-editor-title">
                {floatingEditor.title}
              </div>
              <input
                type="text"
                value={floatingEditor.value}
                onChange={(e) => setFloatingEditor(prev => ({ ...prev, value: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveFloatingEditor();
                  if (e.key === 'Escape') setFloatingEditor(prev => ({ ...prev, visible: false }));
                }}
              />
              <div className="floating-actions">
                <button className="outline-btn mini-btn" onClick={() => setFloatingEditor(prev => ({ ...prev, visible: false }))}>取消</button>
                <button className="outline-btn mini-btn" onClick={saveFloatingEditor}>确定</button>
              </div>
            </div>
          )}
        </div>

        <div className="tips">
          图上操作说明：<br />
          1. 拖动顶点：修改数值<br />
          2. 双击顶点：弹浮层精确输入数值<br />
          3. 点击维度名称：弹浮层修改维度名<br />
          4. 点击图例：隐藏/显示角色<br />
          5. 左侧角色卡可拖拽排序
        </div>
      </div>
    </div>
  );
}
