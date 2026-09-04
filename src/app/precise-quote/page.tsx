"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Cookies from "js-cookie";
import {
  MATERIAL_GRADES,
  gradeTierClass,
  gradeBadgeClass,
  gradeAfterPatch,
} from "@/lib/precise-quote-grades";

// ================================================================
// 部位类型
// ================================================================
type PartType = "ground" | "partition" | "wall" | "ceiling" | "door" | "countertop" | "custom";

const PART_OPTIONS: { value: PartType; label: string; unit: string }[] = [
  { value: "ground", label: "地面", unit: "㎡" },
  { value: "partition", label: "墙体", unit: "㎡" },
  { value: "wall", label: "墙面", unit: "㎡" },
  { value: "ceiling", label: "吊顶", unit: "㎡" },
  { value: "door", label: "门窗", unit: "樘" },
  { value: "countertop", label: "台面", unit: "延米" },
  { value: "custom", label: "自定义", unit: "项" },
];

// 宽度系数（仅台面）
const WIDTH_FACTORS = [
  { value: 1.0, label: "边台 ×1.0（750mm）" },
  { value: 1.2, label: "仪器台 ×1.2（900mm）" },
  { value: 2.0, label: "中央台 ×2.0（1500mm）" },
  { value: 0.8, label: "天平台 ×0.8（600mm）" },
];

// ================================================================
// 内置材料清单（按部位分组，名称取自后端 finish_material_db / wall_system_db，
// 后端支持模糊匹配，可直接命中）。custom 部位用文本框自由输入。
// ================================================================
const MATERIALS: Record<Exclude<PartType, "custom">, string[]> = {
  ground: [
    "PVC卷材（同质透心）", "环氧自流平地坪", "聚氨酯地坪", "防静电环氧地坪",
    "橡胶地板", "水磨石", "防腐砖（耐酸砖）", "导静电瓷砖",
  ],
  partition: [
    "彩钢板隔墙", "轻钢龙骨石膏板隔墙", "轻质砖/加气块隔墙",
    "玻璃隔断", "玻镁板隔墙", "铝蜂窝板隔墙", "活动隔断",
  ],
  wall: [
    "手工彩钢板", "机制彩钢板", "岩棉芯彩钢板", "玻镁彩钢板", "铝蜂窝彩钢板",
    "玻镁板", "铝蜂窝板（全铝）", "不锈钢墙板", "实验室瓷砖",
    "抗菌涂料", "医用洁净板（冰火板）", "防撞墙板",
  ],
  ceiling: [
    "彩钢板吊顶", "铝扣板吊顶", "玻镁板吊顶",
    "石膏板吊顶", "硅酸钙板吊顶", "FFU龙骨吊顶（T-Grid系统）",
  ],
  door: [
    "实验室气密门", "钢制门", "不锈钢门", "防火门", "观察窗",
    "传递窗（机械式）", "传递窗（层流式）", "传递窗（带消毒UV）",
  ],
  countertop: [
    "理化板（威盛亚/富美家）", "环氧树脂台面", "陶瓷台面", "不锈钢台面", "石英石台面",
  ],
};

const CITIES = ["广州", "深圳", "上海", "北京", "成都", "其他"];

// 材料档位数据与配色/联动逻辑见 src/lib/precise-quote-grades.ts（含单元测试）

// ================================================================
// 汇总费用行（顺序即展示顺序）
// ================================================================
const SUMMARY_ROWS: { key: string; label: string; emphasize?: boolean }[] = [
  { key: "material_fee", label: "材料费" },
  { key: "labor_fee", label: "人工费" },
  { key: "auxiliary_fee", label: "辅材费" },
  { key: "machinery_fee", label: "机械费" },
  { key: "direct_fee", label: "直接费小计" },
  { key: "management_fee", label: "管理费（15.15%）" },
  { key: "profit", label: "利润（13.91%）" },
  { key: "measure_fee", label: "措施费（6.66%）" },
  { key: "pre_tax_total", label: "税前合计" },
  { key: "vat", label: "增值税" },
  { key: "total_with_tax", label: "含税总价", emphasize: true },
];

// ================================================================
// 类型
// ================================================================
interface QuoteItem {
  part_type: PartType;
  material_name: string;
  quantity: string;
  width_factor: number;
  material_grade: string;
}

const DEFAULT_ITEMS: QuoteItem[] = [
  { part_type: "ground", material_name: "PVC卷材（同质透心）", quantity: "100", width_factor: 1.0, material_grade: "" },
  { part_type: "partition", material_name: "彩钢板隔墙", quantity: "250", width_factor: 1.0, material_grade: "" },
  { part_type: "wall", material_name: "抗菌涂料", quantity: "220", width_factor: 1.0, material_grade: "" },
  { part_type: "ceiling", material_name: "彩钢板吊顶", quantity: "100", width_factor: 1.0, material_grade: "" },
  { part_type: "door", material_name: "实验室气密门", quantity: "4", width_factor: 1.0, material_grade: "" },
  { part_type: "countertop", material_name: "不锈钢台面", quantity: "24", width_factor: 1.0, material_grade: "" },
];

const unitOf = (pt: PartType) => PART_OPTIONS.find((p) => p.value === pt)?.unit ?? "项";

const fmt = (n: any, digits = 0) =>
  n === null || n === undefined || isNaN(Number(n))
    ? "—"
    : Number(n).toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export default function PreciseQuotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">加载中...</p>
        </div>
      }
    >
      <PreciseQuotePageInner />
    </Suspense>
  );
}

function PreciseQuotePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const projectName = searchParams.get("projectName") || "";
  const { user, loading: authLoading } = useAuth();

  const [city, setCity] = useState("广州");
  const [taxType, setTaxType] = useState<"general" | "simplified">("general");
  const [items, setItems] = useState<QuoteItem[]>(DEFAULT_ITEMS);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveErr, setSaveErr] = useState("");
  const [snapshotInfo, setSnapshotInfo] = useState<{ savedAt: string; mid: number } | null>(null);
  const [dirtyAfterLoad, setDirtyAfterLoad] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/login");
  }, [authLoading, user, router]);

  // ---------------- 从项目载入已保存报价快照（回显） ----------------
  useEffect(() => {
    if (authLoading || !user || !projectId) return;
    const token = Cookies.get("token");
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!data.success || cancelled) return;
        const raw: string | null = data.data?.preciseQuoteJson;
        if (!raw) return;
        const snap = JSON.parse(raw);
        const d = snap?.data;
        if (!d?.items?.length) return;
        // 还原全局参数
        if (d.meta?.city) setCity(d.meta.city);
        setTaxType(d.meta?.tax_type === "simplified" ? "simplified" : "general");
        // 还原工程量清单
        const restored: QuoteItem[] = d.items.map((it: any) => {
          let partType: PartType = PART_OPTIONS.some((p) => p.value === it.part_type) ? it.part_type : "custom";
          const name = String(it.material_input ?? it.material_resolved ?? "");
          // 材料名不在该部位下拉选项中 → 转自定义文本项，保证仍可回显
          if (partType !== "custom" && !(MATERIALS[partType] || []).includes(name)) partType = "custom";
          return {
            part_type: partType,
            material_name: name,
            quantity: it.quantity ?? it.effective_qty ?? 0,
            width_factor: typeof it.width_factor === "number" ? it.width_factor : 1.0,
            material_grade: it.material_grade || "",
          };
        });
        setItems(restored);
        setResult(snap);
        setExpanded(0);
        setSnapshotInfo({ savedAt: data.data.updatedAt, mid: d.price_tiers?.mid ?? 0 });
        setDirtyAfterLoad(false);
      } catch {
        // 快照缺失/损坏时静默忽略，不影响新建报价
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, projectId]);

  // ---------------- 从设计器带入工程量（localStorage 预填，一次性） ----------------
  useEffect(() => {
    const KEY = "precise-quote-prefill";
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const prefill = JSON.parse(raw);
      localStorage.removeItem(KEY); // 读后即清，避免下次再读到
      if (!Array.isArray(prefill) || prefill.length === 0) return;
      const toItem = (p: any): QuoteItem => ({
        part_type: PART_OPTIONS.some((o) => o.value === p.part_type) ? p.part_type : "custom",
        material_name: String(p.material_name ?? ""),
        quantity: p.quantity != null && p.quantity !== "" ? String(p.quantity) : "",
        width_factor: typeof p.width_factor === "number" ? p.width_factor : 1.0,
        material_grade: p.material_grade ?? "",
      });
      const have = new Set(prefill.map((p: any) => p.part_type));
      // 补齐地面/墙面/吊顶默认行（工程量留空待填），确保清单部位完整
      const fillers: QuoteItem[] = [];
      if (!have.has("ground")) fillers.push({ part_type: "ground", material_name: "PVC卷材（同质透心）", quantity: "", width_factor: 1.0, material_grade: "" });
      if (!have.has("wall")) fillers.push({ part_type: "wall", material_name: "抗菌涂料", quantity: "", width_factor: 1.0, material_grade: "" });
      if (!have.has("ceiling")) fillers.push({ part_type: "ceiling", material_name: "彩钢板吊顶", quantity: "", width_factor: 1.0, material_grade: "" });
      // 按部位标准顺序排列
      const order: PartType[] = ["ground", "partition", "wall", "ceiling", "door", "countertop", "custom"];
      const merged = [...prefill.map(toItem), ...fillers].sort(
        (a, b) => order.indexOf(a.part_type) - order.indexOf(b.part_type)
      );
      setItems(merged);
      setResult(null); // 新清单，清除已有结果
      setSnapshotInfo(null);
      setDirtyAfterLoad(false);
    } catch {
      localStorage.removeItem(KEY);
    }
  }, []);

  const apiBase = process.env.NEXT_PUBLIC_CALC_ENGINE_URL || "http://localhost:8101";

  // ---------------- 清单编辑 ----------------
  function updateItem(idx: number, patch: Partial<QuoteItem>) {
    setItems((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, ...patch };
        // 切换部位时：若当前材料不属于新部位，重置材料为新部位第一项
        if (patch.part_type && patch.part_type !== it.part_type && patch.part_type !== "custom") {
          const list = MATERIALS[patch.part_type];
          if (!list.includes(it.material_name)) next.material_name = list[0];
        }
        // 部位/材料变化时档位联动重置为默认；仅改档位时取新档位（规则见 lib）
        next.material_grade = gradeAfterPatch(patch, it.material_grade);
        return next;
      })
    );
  }
  function addItem() {
    setItems((prev) => [...prev, { part_type: "ground", material_name: MATERIALS.ground[0], quantity: "", width_factor: 1.0, material_grade: "" }]);
  }
  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const validCount = useMemo(
    () => items.filter((it) => it.material_name.trim() && Number(it.quantity) > 0).length,
    [items]
  );

  // ---------------- 计算 ----------------
  async function handleCalc() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        city,
        tax_type: taxType,
        items: items
          .filter((it) => it.material_name.trim() && Number(it.quantity) > 0)
          .map((it) => ({
            part_type: it.part_type,
            material_name: it.material_name,
            quantity: Number(it.quantity),
            ...(it.material_grade ? { material_grade: it.material_grade } : {}),
            ...(it.part_type === "countertop" ? { width_factor: it.width_factor } : {}),
          })),
      };
      const res = await fetch(`${apiBase}/api/v1/precise-quote/calculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.status === "failed") {
        setError(data.warnings?.[0]?.message || "计算失败");
        return;
      }
      setResult(data);
      setExpanded(data.data?.items?.length ? 0 : null);
      setSaveMsg("");
      setSaveErr("");
      if (projectId) setDirtyAfterLoad(true);
    } catch {
      setError("无法连接计算引擎服务（端口8101），请确认已启动");
    } finally {
      setLoading(false);
    }
  }

  // ---------------- 保存到项目 ----------------
  async function handleSaveToProject() {
    if (!projectId || !result) return;
    const token = Cookies.get("token");
    if (!token) {
      setSaveErr("未登录，请重新登录后再保存");
      return;
    }
    setSaving(true);
    setSaveMsg("");
    setSaveErr("");
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ preciseQuoteJson: JSON.stringify(result) }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveMsg("已保存到项目 ✓");
        setDirtyAfterLoad(false);
        if (data.data?.updatedAt) {
          setSnapshotInfo((prev) => prev ? { ...prev, savedAt: data.data.updatedAt } : prev);
        }
      } else {
        setSaveErr(data.error || "保存失败");
      }
    } catch {
      setSaveErr("网络错误，保存失败");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">加载中...</p>
      </div>
    );
  }

  const summary = result?.data?.summary;
  const tiers = result?.data?.price_tiers;
  const resultItems = result?.data?.items ?? [];
  const meta = result?.data?.meta;

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">💰 精确报价中心</h1>
          <p className="text-gray-500 text-sm mt-1">
            材料 + 人工 + 辅材 + 管理费 + 利润 + 措施费 + 税金，按工程量清单三档报价
          </p>
          {projectId && (
            <p className="text-green-700 text-sm mt-1.5 font-medium">
              📁 项目：{projectName || `#${projectId}`}（计算后可将报价保存到此项目）
            </p>
          )}
        </div>
        <button onClick={() => router.push("/calc-engine")} className="px-4 py-2 bg-white border border-gray-300 text-gray-600 rounded-lg text-sm">
          返回计算中心
        </button>
      </div>

      {/* 已保存快照回显提示 */}
      {projectId && snapshotInfo && (
        <div className={`rounded-xl border px-4 py-2.5 text-sm mb-5 flex items-center gap-2 flex-wrap ${
          dirtyAfterLoad ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-green-50 border-green-200 text-green-800"
        }`}>
          <span className="font-medium">{dirtyAfterLoad ? "🔄 已重新计算" : "📂 已载入该项目保存的报价快照"}</span>
          <span>
            {dirtyAfterLoad
              ? "新结果尚未保存到项目，请点击下方「💾 保存到项目」覆盖旧快照。"
              : `保存时间 ${new Date(snapshotInfo.savedAt).toLocaleString("zh-CN")}，中档总价 ¥${fmt(snapshotInfo.mid)}。已自动还原清单与结果，修改后请重新计算并再次保存。`}
          </span>
        </div>
      )}

      {/* 全局参数 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">地区（影响人工费城市系数）</label>
            <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">计税方式</label>
            <select value={taxType} onChange={(e) => setTaxType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="general">一般计税（增值税 9%）</option>
              <option value="simplified">简易计税（增值税 3%）</option>
            </select>
          </div>
        </div>
      </div>

      {/* 工程量清单 */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">工程量清单（{validCount} 项有效）</h2>
          <button onClick={addItem} className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg text-sm font-medium hover:bg-blue-100">
            + 添加一项
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-2 font-medium w-10">#</th>
                <th className="py-2 pr-2 font-medium min-w-[110px]">部位</th>
                <th className="py-2 pr-2 font-medium min-w-[190px]">材料名称</th>
                <th className="py-2 pr-2 font-medium min-w-[200px]">规格 / 档位</th>
                <th className="py-2 pr-2 font-medium min-w-[120px]">工程量</th>
                <th className="py-2 font-medium w-14"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-100 align-middle">
                  <td className="py-2 pr-2 text-gray-400">{idx + 1}</td>
                  <td className="py-2 pr-2">
                    <select
                      value={it.part_type}
                      onChange={(e) => updateItem(idx, { part_type: e.target.value as PartType })}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      {PART_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value}>{p.label}（{p.unit}）</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 pr-2">
                    {it.part_type === "custom" ? (
                      <input
                        type="text"
                        value={it.material_name}
                        placeholder="输入材料/项目名称"
                        onChange={(e) => updateItem(idx, { material_name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                    ) : (
                      <select
                        value={it.material_name}
                        onChange={(e) => updateItem(idx, { material_name: e.target.value })}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                      >
                        {MATERIALS[it.part_type].map((m) => <option key={m}>{m}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="space-y-1.5">
                      {/* 台型宽度系数（仅台面） */}
                      {it.part_type === "countertop" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 w-7 shrink-0">台型</span>
                          <select
                            value={it.width_factor}
                            onChange={(e) => updateItem(idx, { width_factor: Number(e.target.value) })}
                            title="台面宽度系数（材料单价基准为 750mm 边台）"
                            className="flex-1 min-w-0 px-1.5 py-1 border border-gray-300 rounded-md text-xs bg-white"
                          >
                            {WIDTH_FACTORS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
                          </select>
                        </div>
                      )}
                      {/* 材料档位 */}
                      {MATERIAL_GRADES[it.material_name] ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-400 w-7 shrink-0">档位</span>
                          <select
                            value={it.material_grade}
                            onChange={(e) => updateItem(idx, { material_grade: e.target.value })}
                            title={`可选档位：${MATERIAL_GRADES[it.material_name].map((g) => g.label).join(" / ")}`}
                            className={`flex-1 min-w-0 px-1.5 py-1 border rounded-md text-xs bg-white ${gradeTierClass(MATERIAL_GRADES[it.material_name], it.material_grade)}`}
                          >
                            <option value="">默认（经济档）</option>
                            {MATERIAL_GRADES[it.material_name].map((g) => (
                              <option key={g.value} value={g.value}>{g.label}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-300 pl-0.5">标准单档 · 无需选择</p>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                        className="w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm"
                      />
                      <span className="text-xs text-gray-500 whitespace-nowrap">{unitOf(it.part_type)}</span>
                    </div>
                  </td>
                  <td className="py-2">
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm px-2" title="删除">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-[11px] text-gray-400 flex items-center gap-2 flex-wrap">
          <span>档位配色：</span>
          <span className="inline-block w-3 h-3 rounded border border-dashed border-blue-300 bg-blue-50"></span>未选=经济档
          <span className="inline-block w-3 h-3 rounded bg-amber-100"></span>入门升级
          <span className="inline-block w-3 h-3 rounded bg-orange-100"></span>中端
          <span className="inline-block w-3 h-3 rounded bg-rose-100"></span>高端
          <span className="text-gray-300">|</span>
          <span>「台型」仅台面显示，材料单价基准为 750mm 边台</span>
        </p>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleCalc}
            disabled={loading || validCount === 0}
            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300"
          >
            {loading ? "计算中..." : "📊 计算报价"}
          </button>
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
      </div>

      {/* 结果区 */}
      {result && tiers && (
        <>
        <div className="space-y-5">
          {/* 三档大数字 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "低档报价", val: tiers.low, cls: "from-blue-50 to-white border-blue-200 text-blue-700" },
              { label: "中档报价", val: tiers.mid, cls: "from-green-50 to-white border-green-300 text-green-700 ring-2 ring-green-200" },
              { label: "高档报价", val: tiers.high, cls: "from-orange-50 to-white border-orange-200 text-orange-700" },
            ].map((t) => (
              <div key={t.label} className={`rounded-xl border bg-gradient-to-b p-5 ${t.cls}`}>
                <p className="text-sm font-medium opacity-80">{t.label}（含税）</p>
                <p className="text-2xl font-bold mt-2">¥ {fmt(t.val)}</p>
              </div>
            ))}
          </div>

          {/* 告警 */}
          {(result.warnings?.length > 0 || meta?.warnings?.length > 0) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm font-medium text-yellow-800 mb-1">⚠️ 需人工复核</p>
              <ul className="text-xs text-yellow-700 list-disc pl-5 space-y-0.5">
                {(meta?.warnings ?? result.warnings?.map((w: any) => w.message) ?? []).slice(0, 8).map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* 费用汇总表 */}
          {summary && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-900 mb-3">
                费用汇总表
                <span className="text-xs text-gray-400 ml-2">
                  {meta?.city}（人工系数 {meta?.city_factor}）· {meta?.tax_name}
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 border-b border-gray-200">
                      <th className="py-2 text-left font-medium">费用项</th>
                      <th className="py-2 text-right font-medium">低档（元）</th>
                      <th className="py-2 text-right font-medium">中档（元）</th>
                      <th className="py-2 text-right font-medium">高档（元）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUMMARY_ROWS.map((row) => {
                      const v = summary[row.key];
                      return (
                        <tr key={row.key} className={`border-b border-gray-100 ${row.emphasize ? "bg-green-50 font-bold text-green-800" : ""}`}>
                          <td className="py-2">{row.label}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(v?.low)}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(v?.mid)}</td>
                          <td className="py-2 text-right tabular-nums">{fmt(v?.high)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 逐项明细 */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-3">逐项计价明细（点击展开单价）</h2>
            <div className="space-y-2">
              {resultItems.map((it: any) => {
                const open = expanded === it.index;
                return (
                  <div key={it.index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpanded(open ? null : it.index)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-gray-400 text-xs w-5">{it.index}.</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs whitespace-nowrap">{it.part_name}</span>
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {it.material_resolved}
                          {!it.material_matched && <span className="text-red-500 ml-1">（未匹配）</span>}
                        </span>
                        {it.material_grade && (
                          <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${gradeBadgeClass(MATERIAL_GRADES[it.material_input] ?? [], it.material_grade)}`}>
                            档位：{it.material_grade}
                          </span>
                        )}
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          {it.quantity}{it.unit}{it.width_factor && it.width_factor !== 1 ? ` ×${it.width_factor}` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm whitespace-nowrap">
                        <span className="text-gray-500">含税分项 <b className="text-gray-800">¥{fmt(it.item_total?.mid)}</b></span>
                        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {open && (
                      <div className="px-4 pb-4 pt-1 bg-gray-50/60 text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                          <Info label="人工工种" value={it.labor_trade || "—"} />
                          <Info label="材料档位" value={it.material_grade ? `已选「${it.material_grade}」` : "默认（经济档）"} />
                          <Info label="辅材系数" value={`${(it.aux_ratio * 100).toFixed(0)}%（${it.aux_category}）`} />
                          <Info label="有效工程量" value={`${it.effective_qty} ${it.unit}`} />
                          <Info label="材料匹配" value={it.material_matched ? "已命中" : "未命中，需询价"} />
                        </div>
                        <div className="overflow-x-auto mt-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-gray-500 border-b border-gray-200">
                                <th className="py-1.5 text-left font-medium">项目</th>
                                <th className="py-1.5 text-right font-medium">低档</th>
                                <th className="py-1.5 text-right font-medium">中档</th>
                                <th className="py-1.5 text-right font-medium">高档</th>
                              </tr>
                            </thead>
                            <tbody className="tabular-nums">
                              <tr className="border-b border-gray-100">
                                <td className="py-1.5">材料单价（元/{it.unit}）</td>
                                <td className="py-1.5 text-right">{fmt(it.material_unit_price?.low, 1)}</td>
                                <td className="py-1.5 text-right">{fmt(it.material_unit_price?.mid, 1)}</td>
                                <td className="py-1.5 text-right">{fmt(it.material_unit_price?.high, 1)}</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-1.5">人工单价（元/{it.unit}）</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_unit_price?.low, 1)}</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_unit_price?.mid, 1)}</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_unit_price?.high, 1)}</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-1.5">材料费</td>
                                <td className="py-1.5 text-right">{fmt(it.material_cost?.low)}</td>
                                <td className="py-1.5 text-right">{fmt(it.material_cost?.mid)}</td>
                                <td className="py-1.5 text-right">{fmt(it.material_cost?.high)}</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-1.5">人工费</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_cost?.low)}</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_cost?.mid)}</td>
                                <td className="py-1.5 text-right">{fmt(it.labor_cost?.high)}</td>
                              </tr>
                              <tr className="border-b border-gray-100">
                                <td className="py-1.5">辅材费</td>
                                <td className="py-1.5 text-right">{fmt(it.auxiliary_cost?.low)}</td>
                                <td className="py-1.5 text-right">{fmt(it.auxiliary_cost?.mid)}</td>
                                <td className="py-1.5 text-right">{fmt(it.auxiliary_cost?.high)}</td>
                              </tr>
                              <tr className="font-semibold text-gray-800">
                                <td className="py-1.5">分项合计（直接费）</td>
                                <td className="py-1.5 text-right">{fmt(it.item_total?.low)}</td>
                                <td className="py-1.5 text-right">{fmt(it.item_total?.mid)}</td>
                                <td className="py-1.5 text-right">{fmt(it.item_total?.high)}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        {it.warnings?.length > 0 && (
                          <ul className="mt-2 text-yellow-700 list-disc pl-4 space-y-0.5">
                            {it.warnings.map((w: string, i: number) => <li key={i}>{w}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-gray-400 leading-relaxed">
              计价口径：材料费=工程量×材料单价（三档）；人工费=工程量×工种人工单价（按{meta?.city}城市系数{meta?.city_factor}调整）；
              辅材费=材料费×辅材系数；管理费/利润/措施费以人工费为基数（机械费0）；增值税=税前合计×税率。依据 GB 50500-2013 及湖南省住建厅费用标准（2025-09）。
            </p>
          </div>
        </div>

        {/* 保存到项目（仅从项目带参进入时显示） */}
        {projectId && (
          <div className="mt-4 flex items-center gap-3 flex-wrap bg-white rounded-xl border border-green-200 p-4">
            <button
              onClick={handleSaveToProject}
              disabled={saving}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "💾 保存到项目"}
            </button>
            {saveMsg && <span className="text-sm text-green-700 font-medium">{saveMsg}</span>}
            {saveErr && <span className="text-sm text-red-600">{saveErr}</span>}
            <span className="text-xs text-gray-400">
              将当前报价结果（{resultItems.length} 项工程量，中档总价 ¥{fmt(tiers?.mid)}）快照保存到「{projectName || `项目#${projectId}`}」
            </span>
          </div>
        )}
        </>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
      <p className="text-gray-400">{label}</p>
      <p className="text-gray-800 font-medium mt-0.5">{value}</p>
    </div>
  );
}
