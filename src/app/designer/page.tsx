"use client";

import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FabricCanvas } from "@/components/FabricCanvas";
import type { Canvas } from "fabric";

interface DeviceTemplate {
  id: number;
  equipmentName: string;
  specification: string;
  unit: string;
}

function DesignerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [devices, setDevices] = useState<DeviceTemplate[]>([]);
  const [selectedTool, setSelectedTool] = useState<'select' | 'wall' | 'delete' | 'dimension' | 'rotate'>('select');
  const [selectedDevice, setSelectedDevice] = useState<DeviceTemplate | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const canvasInstanceRef = useRef<Canvas | null>(null);

  // 比例尺：画布上 100px 代表多少米（默认 100px=1m，即 0.01 m/px）
  const [meterPer100px, setMeterPer100px] = useState<number>(1.0);
  const [wallHeight, setWallHeight] = useState<number>(3.0); // 层高（米），用于墙体面积折算
  const [extract, setExtract] = useState<{
    wallLenM: number; counterM: number; doors: number;
    lineCount: number; counterCount: number; doorCount: number;
  } | null>(null);

  const projectId = searchParams.get('projectId');

  // Mock 设备数据（真实接口可用时替换）
  const mockDevices: DeviceTemplate[] = [
    { id: 1, equipmentName: '通风柜', specification: '1500×850×2350', unit: '台' },
    { id: 2, equipmentName: '实验台', specification: '3000×1500×850', unit: '组' },
    { id: 3, equipmentName: '生物安全柜', specification: 'BSC-II A2', unit: '台' },
    { id: 4, equipmentName: '超净工作台', specification: '双人单面', unit: '台' },
    { id: 5, equipmentName: '试剂柜', specification: '900×450×1800', unit: '个' },
    { id: 6, equipmentName: 'PCR仪', specification: '96孔', unit: '台' },
    { id: 7, equipmentName: '离心机', specification: '高速冷冻', unit: '台' },
    { id: 8, equipmentName: '超低温冰箱', specification: '-86℃', unit: '台' },
    { id: 9, equipmentName: '灭菌器', specification: '100L', unit: '台' },
    { id: 10, equipmentName: '纯水机', specification: '20L/h', unit: '台' },
  ];

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      setDevices(mockDevices);
    }
  }, [authLoading, user, router]);

  // 注意：useCallback 等 Hook 必须在下方早返回之前声明，否则违反 Hooks 规则
  const handleCanvasReady = useCallback((canvas: Canvas) => {
    canvasInstanceRef.current = canvas;
  }, []);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const handleAddDevice = (device: DeviceTemplate) => {
    setSelectedDevice(device);
    setSelectedTool('select');
  };

  const handleUndo = () => {
    (window as any).__designerUndo?.();
  };

  const handleRedo = () => {
    (window as any).__designerRedo?.();
  };

  const handleExportImage = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 });
    const link = document.createElement('a');
    link.download = `平面设计-${new Date().toISOString().slice(0, 10)}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleExportDxf = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const objects = canvas.getObjects();
    let dxfContent = '0\nSECTION\n2\nENTITIES\n';

    objects.forEach((obj: any) => {
      if (obj.type === 'line') {
        dxfContent += `0\nLINE\n8\n0\n10\n${obj.x1}\n20\n${obj.y1}\n11\n${obj.x2}\n21\n${obj.y2}\n`;
      } else if (obj.type === 'rect') {
        const x = obj.left || 0;
        const y = obj.top || 0;
        const w = (obj.width || 0) * (obj.scaleX || 1);
        const h = (obj.height || 0) * (obj.scaleY || 1);
        dxfContent += `0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n${x}\n20\n${y}\n10\n${x + w}\n20\n${y}\n10\n${x + w}\n20\n${y + h}\n10\n${x}\n20\n${y + h}\n`;
      } else if (obj.type === 'group') {
        obj.getObjects?.().forEach((sub: any) => {
          if (sub.type === 'rect') {
            const x = sub.left || 0;
            const y = sub.top || 0;
            const w = (sub.width || 0) * (sub.scaleX || 1);
            const h = (sub.height || 0) * (sub.scaleY || 1);
            dxfContent += `0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n10\n${x}\n20\n${y}\n10\n${x + w}\n20\n${y}\n10\n${x + w}\n20\n${y + h}\n10\n${x}\n20\n${y + h}\n`;
          }
        });
      }
    });

    dxfContent += '0\nENDSEC\n0\nEOF\n';
    const blob = new Blob([dxfContent], { type: 'application/dxf' });
    const link = document.createElement('a');
    link.download = `平面设计-${new Date().toISOString().slice(0, 10)}.dxf`;
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  const handleSaveToProject = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON());
    localStorage.setItem(`designer-layout-project-${projectId || 'default'}`, json);
    alert(`布局已保存到项目${projectId ? ` #${projectId}` : ''}`);
  };

  const handleLoadFromProject = () => {
    const saved = localStorage.getItem(`designer-layout-project-${projectId || 'default'}`);
    if (saved && canvasInstanceRef.current) {
      canvasInstanceRef.current.loadFromJSON(JSON.parse(saved)).then(() => {
        canvasInstanceRef.current?.renderAll();
        alert('项目布局已加载');
      });
    } else {
      alert('该项目还没有保存的布局');
    }
  };

  // ---------------- 提取工程量 ----------------
  const COUNTERTOP_KEYWORDS = ['实验台', '边台', '中央台', '仪器台', '天平台'];

  const handleExtract = () => {
    const canvas = canvasInstanceRef.current;
    if (!canvas) return;
    const mPerPx = (meterPer100px || 1) / 100; // m/px
    let wallPx = 0;
    let counterPx = 0;
    let lineCount = 0;
    let counterCount = 0;
    let doorCount = 0;

    canvas.getObjects().forEach((obj: any) => {
      if (obj?.isTemp) return; // 绘制中的临时线
      // 墙线：黑色实线；排除红色虚线标注
      if (obj.type === 'line') {
        const isDimension = obj.strokeDashArray || obj.stroke === '#ff0000' || obj.stroke === 'red';
        if (!isDimension) {
          const dx = (obj.x2 ?? 0) - (obj.x1 ?? 0);
          const dy = (obj.y2 ?? 0) - (obj.y1 ?? 0);
          wallPx += Math.hypot(dx, dy);
          lineCount += 1;
        }
      } else if (obj.type === 'group') {
        // 设备组：读内部 FabricText 文字判定
        const subs = obj.getObjects?.() ?? [];
        const text = subs
          .filter((s: any) => s.type === 'text')
          .map((s: any) => String(s.text ?? ''))
          .join(' ');
        if (!text) return;
        if (COUNTERTOP_KEYWORDS.some((kw) => text.includes(kw))) {
          const w = typeof obj.getScaledWidth === 'function'
            ? obj.getScaledWidth()
            : (obj.width || 0) * (obj.scaleX || 1);
          counterPx += w;
          counterCount += 1;
        }
        if (text.includes('门')) {
          doorCount += 1;
        }
      }
    });

    setExtract({
      wallLenM: wallPx * mPerPx,
      counterM: counterPx * mPerPx,
      doors: doorCount,
      lineCount,
      counterCount,
      doorCount,
    });
  };

  // 确认并带入报价：写 localStorage 后跳转报价页
  const handleConfirmPrefill = () => {
    if (!extract) return;
    const wallArea = +(extract.wallLenM * (wallHeight || 3)).toFixed(2);
    const prefill: Record<string, unknown>[] = [];
    if (wallArea > 0) {
      prefill.push({ part_type: 'partition', material_name: '彩钢板隔墙', quantity: wallArea });
    }
    if (extract.counterM > 0) {
      prefill.push({ part_type: 'countertop', material_name: '不锈钢台面', quantity: +extract.counterM.toFixed(2), width_factor: 1.0 });
    }
    if (extract.doors > 0) {
      prefill.push({ part_type: 'door', material_name: '实验室气密门', quantity: extract.doors });
    }
    localStorage.setItem('precise-quote-prefill', JSON.stringify(prefill));
    router.push('/precise-quote');
  };

  return (
    <main className="h-screen flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-gray-900">2D 平面设计器</h1>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedTool('select')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTool === 'select' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>🔵 选择</button>
            <button onClick={() => setSelectedTool('wall')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTool === 'wall' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>🧱 画墙</button>
            <button onClick={() => setSelectedTool('dimension')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTool === 'dimension' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>📏 标注</button>
            <button onClick={() => setSelectedTool('rotate')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTool === 'rotate' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>🔄 旋转</button>
            <button onClick={() => setSelectedTool('delete')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${selectedTool === 'delete' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600'}`}>🗑️ 删除</button>
          </div>
          <div className="flex gap-2">
            <button onClick={handleUndo} disabled={!canUndo} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 disabled:opacity-40">↩️ 撤销</button>
            <button onClick={handleRedo} disabled={!canRedo} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 disabled:opacity-40">↪️ 重做</button>
          </div>
          {/* 比例尺设置 */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
            📏 比例尺
            <input
              type="number"
              min={0.01}
              step={0.1}
              value={meterPer100px}
              onChange={(e) => setMeterPer100px(Math.max(0.01, Number(e.target.value) || 0.01))}
              className="w-14 px-1 py-0.5 border border-gray-300 rounded text-xs"
            />
            <span>米 / 100px（1px={((meterPer100px || 1) / 100 * 1000).toFixed(0)}mm）</span>
          </label>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleSaveToProject} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm">💾 存项目</button>
          <button onClick={handleLoadFromProject} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">📂 读项目</button>
          <button onClick={handleExtract} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm">📊 提取工程量</button>
          <button onClick={handleExportImage} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm">🖼️ 导出图</button>
          <button onClick={handleExportDxf} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm">📐 导出DXF</button>
          <button onClick={() => router.push(projectId ? `/projects/${projectId}` : '/')} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm">返回</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-56 bg-white border-r border-gray-200 overflow-y-auto p-3">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">设备库</h2>
          <div className="space-y-2">
            {devices.map((device) => (
              <button key={device.id} onClick={() => handleAddDevice(device)} className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                <p className="text-sm font-medium text-gray-800">{device.equipmentName}</p>
                <p className="text-xs text-gray-500">{device.specification}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 bg-gray-50 relative">
          <FabricCanvas
            tool={selectedTool}
            deviceToAdd={selectedDevice}
            onDeviceAdded={() => setSelectedDevice(null)}
            onCanvasReady={handleCanvasReady}
            onHistoryChange={(u, r) => { setCanUndo(u); setCanRedo(r); }}
          />
        </div>
      </div>

      {/* 提取工程量结果面板 */}
      {extract && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setExtract(null)}>
          <div className="bg-white rounded-xl shadow-xl w-[440px] max-w-[92vw] p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-1">📊 提取工程量</h2>
            <p className="text-xs text-gray-500 mb-4">
              比例尺 {meterPer100px} 米 / 100px；依据画布墙线与设备文字识别
            </p>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-gray-700 font-medium">墙体总长度</p>
                  <p className="text-xs text-gray-400">识别墙线 {extract.lineCount} 段</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{extract.wallLenM.toFixed(2)} <span className="text-sm font-normal text-gray-500">米</span></p>
              </div>

              <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-blue-700 font-medium">墙体工程量（隔墙）</p>
                  <p className="text-xs text-blue-400">墙长 × 层高
                    <input
                      type="number" min={2} step={0.1} value={wallHeight}
                      onChange={(e) => setWallHeight(Math.max(2, Number(e.target.value) || 3))}
                      className="w-12 ml-1 px-1 py-0.5 border border-blue-200 rounded text-xs"
                    /> 米
                  </p>
                </div>
                <p className="text-lg font-bold text-blue-700">{(extract.wallLenM * wallHeight).toFixed(1)} <span className="text-sm font-normal">㎡</span></p>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <div>
                  <p className="text-gray-700 font-medium">台面总延米</p>
                  <p className="text-xs text-gray-400">识别实验台/边台/中央台等 {extract.counterCount} 组</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{extract.counterM.toFixed(2)} <span className="text-sm font-normal text-gray-500">延米</span></p>
              </div>

              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                <p className="text-gray-700 font-medium">门数量</p>
                <p className="text-lg font-bold text-gray-900">{extract.doors} <span className="text-sm font-normal text-gray-500">樘</span></p>
              </div>

              {(extract.lineCount + extract.counterCount + extract.doors) === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  未识别到墙线或设备：请先用「🧱 画墙」绘制墙线，并从设备库放置含「实验台」「门」字样的设备。
                </p>
              )}
            </div>

            <div className="flex gap-2 mt-5">
              <button
                onClick={handleConfirmPrefill}
                disabled={(extract.lineCount + extract.counterCount + extract.doors) === 0}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:bg-gray-300"
              >
                确认并带入报价 →
              </button>
              <button onClick={() => setExtract(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function DesignerPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-gray-500">加载中...</div>}>
      <DesignerContent />
    </Suspense>
  );
}
