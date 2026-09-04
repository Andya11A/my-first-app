"use client";

import { useEffect, useRef } from "react";
import { Canvas, Rect, Line, FabricText, Group, Point } from "fabric";
import type { FabricObject } from "fabric";

interface FabricCanvasProps {
  tool: 'select' | 'wall' | 'delete' | 'dimension' | 'rotate';
  deviceToAdd: { equipmentName: string; specification: string } | null;
  onDeviceAdded: () => void;
  onCanvasReady?: (canvas: Canvas) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
}

export function FabricCanvas({ tool, deviceToAdd, onDeviceAdded, onCanvasReady, onHistoryChange }: FabricCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const toolRef = useRef(tool);
  const isDrawingWall = useRef(false);
  const wallStart = useRef<Point | null>(null);
  const tempLine = useRef<Line | null>(null);
  const dimensionStart = useRef<Point | null>(null);
  const history = useRef<string[]>([]);
  const historyIndex = useRef(-1);
  const isRestoring = useRef(false);

  // 同步 tool 到 ref
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  // 保存历史
  const saveHistory = (canvas: Canvas) => {
    if (isRestoring.current) return;
    const json = JSON.stringify(canvas.toJSON());
    // 删掉当前位置之后的历史
    history.current = history.current.slice(0, historyIndex.current + 1);
    history.current.push(json);
    historyIndex.current = history.current.length - 1;
    // 限制历史长度
    if (history.current.length > 50) {
      history.current.shift();
      historyIndex.current--;
    }
    onHistoryChange?.(historyIndex.current > 0, historyIndex.current < history.current.length - 1);
  };

  const undo = () => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndex.current <= 0) return;
    historyIndex.current--;
    isRestoring.current = true;
    canvas.loadFromJSON(JSON.parse(history.current[historyIndex.current])).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
      onHistoryChange?.(historyIndex.current > 0, historyIndex.current < history.current.length - 1);
    });
  };

  const redo = () => {
    const canvas = fabricRef.current;
    if (!canvas || historyIndex.current >= history.current.length - 1) return;
    historyIndex.current++;
    isRestoring.current = true;
    canvas.loadFromJSON(JSON.parse(history.current[historyIndex.current])).then(() => {
      canvas.renderAll();
      isRestoring.current = false;
      onHistoryChange?.(historyIndex.current > 0, historyIndex.current < history.current.length - 1);
    });
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: canvasRef.current.parentElement?.clientWidth || 800,
      height: canvasRef.current.parentElement?.clientHeight || 600,
      backgroundColor: '#ffffff',
    });

    fabricRef.current = canvas;
    onCanvasReady?.(canvas);

    // 初始历史
    history.current = [JSON.stringify(canvas.toJSON())];
    historyIndex.current = 0;

    // 吸附对齐
    canvas.on('object:moving', (opt) => {
      const movingObj = opt.target;
      if (!movingObj) return;
      const snapThreshold = 10;
      const movingCenter = movingObj.getCenterPoint();
      const objects = canvas.getObjects().filter((obj) => obj !== movingObj);
      for (const obj of objects) {
        const objCenter = obj.getCenterPoint();
        const objRight = obj.left + obj.width * obj.scaleX;
        const objBottom = obj.top + obj.height * obj.scaleY;
        const movingRight = movingObj.left + movingObj.width * movingObj.scaleX;
        const movingBottom = movingObj.top + movingObj.height * movingObj.scaleY;
        if (Math.abs(movingCenter.x - objCenter.x) < snapThreshold) {
          movingObj.set('left', objCenter.x - (movingObj.width * movingObj.scaleX) / 2);
        }
        if (Math.abs(movingCenter.y - objCenter.y) < snapThreshold) {
          movingObj.set('top', objCenter.y - (movingObj.height * movingObj.scaleY) / 2);
        }
        if (Math.abs(movingObj.left - obj.left) < snapThreshold) {
          movingObj.set('left', obj.left);
        }
        if (Math.abs(movingRight - objRight) < snapThreshold) {
          movingObj.set('left', objRight - movingObj.width * movingObj.scaleX);
        }
        if (Math.abs(movingObj.top - obj.top) < snapThreshold) {
          movingObj.set('top', obj.top);
        }
        if (Math.abs(movingBottom - objBottom) < snapThreshold) {
          movingObj.set('top', objBottom - movingObj.height * movingObj.scaleY);
        }
      }
    });

    // 对象修改后保存历史（跳过 isTemp 临时对象，避免画墙过程中 history flooding）
    const skipIfTemp = (opt: { target?: FabricObject }) => {
      if (isRestoring.current) return true;
      const t = opt.target as FabricObject & { isTemp?: boolean };
      return !!t?.isTemp;
    };

    canvas.on('object:modified', (opt) => {
      if (!skipIfTemp(opt)) saveHistory(canvas);
    });
    canvas.on('object:added', (opt) => {
      if (!skipIfTemp(opt)) saveHistory(canvas);
    });
    canvas.on('object:removed', (opt) => {
      if (!skipIfTemp(opt)) saveHistory(canvas);
    });

    // 旋转工具：选中对象后可旋转
    canvas.on('mouse:down', (opt) => {
      const point = opt.scenePoint;
      if (toolRef.current === 'wall') {
        isDrawingWall.current = true;
        wallStart.current = point;
      } else if (toolRef.current === 'dimension') {
        dimensionStart.current = point;
      } else if (toolRef.current === 'delete' && opt.target) {
        canvas.remove(opt.target);
        canvas.discardActiveObject();
        canvas.renderAll();
      }
    });

    canvas.on('mouse:move', (opt) => {
      const point = opt.scenePoint;
      if (toolRef.current === 'wall' && isDrawingWall.current && wallStart.current) {
        if (tempLine.current) {
          (tempLine.current as any).isTemp = true;
          canvas.remove(tempLine.current);
        }
        const line = new Line(
          [wallStart.current.x, wallStart.current.y, point.x, point.y],
          { stroke: '#000000', strokeWidth: 3 }
        );
        (line as any).isTemp = true;
        tempLine.current = line;
        canvas.add(tempLine.current);
        canvas.renderAll();
      }
    });

    canvas.on('mouse:up', (opt) => {
      if (toolRef.current === 'wall' && isDrawingWall.current) {
        isDrawingWall.current = false;
        if (tempLine.current) {
          (tempLine.current as any).isTemp = false;
          tempLine.current.setCoords();
          saveHistory(canvas);
        }
        wallStart.current = null;
        tempLine.current = null;
      } else if (toolRef.current === 'dimension' && dimensionStart.current) {
        const endPoint = opt.scenePoint;
        const distance = Math.round(
          Math.sqrt(
            Math.pow(endPoint.x - dimensionStart.current.x, 2) +
            Math.pow(endPoint.y - dimensionStart.current.y, 2)
          )
        );
        const midX = (dimensionStart.current.x + endPoint.x) / 2;
        const midY = (dimensionStart.current.y + endPoint.y) / 2;
        const line = new Line(
          [dimensionStart.current.x, dimensionStart.current.y, endPoint.x, endPoint.y],
          { stroke: '#ff0000', strokeWidth: 1, strokeDashArray: [5, 5] }
        );
        const label = new FabricText(`${distance}mm`, {
          left: midX - 20,
          top: midY - 20,
          fontSize: 12,
          fill: '#ff0000',
          backgroundColor: 'rgba(255,255,255,0.8)',
        });
        canvas.add(line, label);
        canvas.renderAll();
        dimensionStart.current = null;
        saveHistory(canvas);
      }
    });

    // 暴露 undo/redo 到 window（供外部按钮调用）
    (window as any).__designerUndo = undo;
    (window as any).__designerRedo = redo;

    const handleResize = () => {
      if (canvasRef.current?.parentElement) {
        canvas.setDimensions({
          width: canvasRef.current.parentElement.clientWidth,
          height: canvasRef.current.parentElement.clientHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      delete (window as any).__designerUndo;
      delete (window as any).__designerRedo;
      canvas.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 工具变化
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.selection = tool === 'select' || tool === 'rotate';
    canvas.defaultCursor = tool === 'wall' || tool === 'dimension' ? 'crosshair' : 'default';
    if (tool === 'wall' || tool === 'dimension') {
      canvas.discardActiveObject();
    }
  }, [tool]);

  // 添加设备
  useEffect(() => {
    if (!deviceToAdd || !fabricRef.current) return;
    const canvas = fabricRef.current;
    const rect = new Rect({
      left: 100 + Math.random() * 50,
      top: 100 + Math.random() * 50,
      width: 80,
      height: 50,
      fill: 'rgba(59, 130, 246, 0.3)',
      stroke: '#2563eb',
      strokeWidth: 2,
    });
    const text = new FabricText(deviceToAdd.equipmentName, {
      left: 100,
      top: 155,
      fontSize: 12,
      fill: '#1e40af',
    });
    const group = new Group([rect, text], { objectCaching: false });
    canvas.add(group);
    canvas.setActiveObject(group);
    canvas.renderAll();
    onDeviceAdded();
  }, [deviceToAdd, onDeviceAdded]);

  return <canvas ref={canvasRef} className="w-full h-full" />;
}
