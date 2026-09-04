"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

interface EquipmentItem {
  id: number;
  equipmentName: string;
  specification: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  isRequired: boolean;
  sortOrder: number;
}

interface ConstructionItem {
  id: number;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  category: string;
  sortOrder: number;
}

interface QuoteResult {
  projectName: string;
  labTypeName: string;
  labTypeParams: {
    cleanLevelDefault: string;
    pressureRequirement: string;
    tempHumidity: string;
    airChangesPerHour: number;
    illuminationLux: number;
    notes: string | null;
  };
  area: number;
  cleanLevel: string;
  budgetLevel: string;
  specialRequirements?: string;
  equipmentList: EquipmentItem[];
  equipmentTotal: number;
  constructionList: ConstructionItem[];
  constructionTotal: number;
  constructionByCategory: { category: string; subtotal: number }[];
  managementFee: number;
  profit: number;
  grandTotal: number;
  quoteComparison: {
    levelName: string;
    equipmentTotal: number;
    constructionTotal: number;
    managementFee: number;
    profit: number;
    grandTotal: number;
  }[];
  generatedAt: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [activeTab, setActiveTab] = useState<"equipment" | "construction" | "comparison">("equipment");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = sessionStorage.getItem("lastQuote");
    if (cached) {
      setQuote(JSON.parse(cached));
      setLoading(false);
    } else {
      const projectId = searchParams.get("projectId");
      fetch(`/api/projects/${projectId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setQuote(JSON.parse(data.data.generatedJson));
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-lg">加载中...</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-gray-500 text-lg">未找到报价数据，请重新生成</p>
        <button
          onClick={() => router.push("/")}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          返回首页
        </button>
      </div>
    );
  }

  const projectId = searchParams.get("projectId");

  const handleExportDocx = () => {
    if (!projectId) return;
    const token = document.cookie.match(/(?:^|;\s*)token=([^;]+)/)?.[1] || "";
    window.open(`/api/quote/export-docx?projectId=${projectId}&token=${token}`, "_blank");
  };

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      {/* 头部信息 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{quote.projectName}</h1>
            <p className="text-gray-500 text-sm mt-1">
              {quote.labTypeName} | {quote.area}㎡ | {quote.cleanLevel} | {quote.budgetLevel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">最终报价</p>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(quote.grandTotal)}</p>
          </div>
        </div>

        {/* 设计参数 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">压差要求</p>
            <p className="text-sm font-medium">{quote.labTypeParams.pressureRequirement}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">温湿度</p>
            <p className="text-sm font-medium">{quote.labTypeParams.tempHumidity}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">换气次数</p>
            <p className="text-sm font-medium">{quote.labTypeParams.airChangesPerHour} 次/h</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">照度</p>
            <p className="text-sm font-medium">{quote.labTypeParams.illuminationLux} lux</p>
          </div>
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab("equipment")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "equipment"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          设备清单 ({quote.equipmentList.length})
        </button>
        <button
          onClick={() => setActiveTab("construction")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "construction"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          工程量表 ({quote.constructionList.length})
        </button>
        <button
          onClick={() => setActiveTab("comparison")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === "comparison"
              ? "bg-blue-600 text-white"
              : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
          }`}
        >
          三档报价对比
        </button>
      </div>

      {/* 设备清单 */}
      {activeTab === "equipment" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">设备名称</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">规格型号</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">数量</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">单价</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.equipmentList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {item.equipmentName}
                    {item.isRequired && (
                      <span className="ml-2 text-xs text-red-500">*必配</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.specification}</td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium">
                  设备总价
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">
                  {formatCurrency(quote.equipmentTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 工程量表 */}
      {activeTab === "construction" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">项目名称</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">分类</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">工程量</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">单价</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">小计</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quote.constructionList.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{item.itemName}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-block px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                      {item.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right font-medium">
                  工程量总价
                </td>
                <td className="px-4 py-3 text-right font-bold text-blue-600">
                  {formatCurrency(quote.constructionTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* 分类汇总 */}
          <div className="p-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">分类汇总</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quote.constructionByCategory.map((cat) => (
                <div key={cat.category} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{cat.category}</p>
                  <p className="text-sm font-semibold">{formatCurrency(cat.subtotal)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 三档报价对比 */}
      {activeTab === "comparison" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {quote.quoteComparison.map((q) => (
            <div
              key={q.levelName}
              className={`bg-white rounded-xl shadow-sm border p-6 ${
                q.levelName === quote.budgetLevel
                  ? "border-blue-500 ring-2 ring-blue-100"
                  : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-semibold text-gray-900">{q.levelName}</p>
                {q.levelName === quote.budgetLevel && (
                  <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    当前选择
                  </span>
                )}
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">设备</span>
                  <span>{formatCurrency(q.equipmentTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">工程量</span>
                  <span>{formatCurrency(q.constructionTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">管理费</span>
                  <span>{formatCurrency(q.managementFee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">利润</span>
                  <span>{formatCurrency(q.profit)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">总计</span>
                  <span className="text-2xl font-bold text-blue-600">
                    {formatCurrency(q.grandTotal)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部按钮 */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={() => router.push("/")}
          className="flex-1 px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
        >
          重新编辑需求
        </button>
        {projectId && (
          <button
            onClick={handleExportDocx}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-center"
          >
            导出Word方案书
          </button>
        )}
      </div>
    </main>
  );
}

export default function ResultPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p>加载中...</p></div>}>
      <ResultContent />
    </Suspense>
  );
}
