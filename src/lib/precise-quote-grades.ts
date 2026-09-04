/**
 * 精确报价 - 材料档位纯逻辑（数据 + 配色 + 联动规则）
 * 从 src/app/precise-quote/page.tsx 抽出，便于 vitest 单元测试（node 环境，无 DOM 依赖）。
 *
 * 档位 value 为后端价格串中的档位关键词（后端 _parse_price_tiers 按此取价）；
 * label 供界面展示，包含价格区间提示。
 */

export interface GradeOpt {
  value: string;
  label: string;
}

/** 材料档位（多档价格材料）。未列入的材料表示无分档，使用默认（经济/最低档）价格。 */
export const MATERIAL_GRADES: Record<string, GradeOpt[]> = {
  // ---- 地面 ----
  "PVC卷材（同质透心）": [
    { value: "国产", label: "国产 14-60" },
    { value: "中端", label: "中端 60-120" },
    { value: "进口", label: "进口 120-260" },
  ],
  "环氧自流平地坪": [
    { value: "国产", label: "国产普通 40-100" },
    { value: "中端", label: "中端 100-180" },
    { value: "进口", label: "进口西卡 180-600" },
  ],
  "聚氨酯地坪": [
    { value: "国产", label: "国产 80-180" },
    { value: "进口", label: "进口西卡 180-400" },
    { value: "高端", label: "高端耐温 300-500" },
  ],
  "防静电环氧地坪": [
    { value: "薄涂", label: "薄涂 60-120" },
    { value: "砂浆", label: "砂浆 120-220" },
    { value: "自流平", label: "自流平 150-280" },
    { value: "进口", label: "进口西卡 220-400" },
  ],
  "橡胶地板": [
    { value: "国产", label: "国产 80-180" },
    { value: "进口", label: "进口得嘉/诺拉 180-350" },
    { value: "ESD", label: "ESD防静电 150-400" },
  ],
  "水磨石": [
    { value: "传统", label: "传统现浇 80-200" },
    { value: "中档", label: "中档 300-500" },
    { value: "高档", label: "高档/无机磨石 500-1000" },
    { value: "定制", label: "定制 1000+" },
  ],
  "导静电瓷砖": [
    { value: "PVC", label: "PVC导静电片 30-80" },
    { value: "陶瓷", label: "陶瓷直铺 60-150" },
    { value: "架空", label: "全钢架空 150-350" },
  ],
  // ---- 墙体 ----
  "玻璃隔断": [
    { value: "单玻", label: "单玻钢化 280-450" },
    { value: "双玻", label: "双玻中空百叶 450-850" },
    { value: "全景", label: "全景无框 500-900" },
  ],
  "活动隔断": [
    { value: "65型", label: "65型 轻型" },
    { value: "100型", label: "100型 高隔声" },
    { value: "超高", label: "超高型/电动" },
  ],
  // ---- 墙面 ----
  "手工彩钢板": [
    { value: "50mm", label: "50mm厚 60-100" },
    { value: "100mm", label: "100mm厚 100-130" },
  ],
  "岩棉芯彩钢板": [
    { value: "机制", label: "机制50mm 30-40" },
    { value: "手工", label: "手工50mm 60-66" },
    { value: "100mm", label: "100mm厚 100-120" },
  ],
  "玻镁彩钢板": [
    { value: "中空", label: "中空玻镁 约53" },
    { value: "手工", label: "手工玻镁岩棉 60-100" },
  ],
  "铝蜂窝彩钢板": [
    { value: "手工", label: "手工板 50-90" },
    { value: "洁净", label: "洁净室专用 130-200" },
  ],
  "玻镁板": [
    { value: "基础", label: "基础板 30-80" },
    { value: "出厂", label: "含税出厂 14-40" },
  ],
  "铝蜂窝板（全铝）": [
    { value: "常规", label: "常规装饰 14-60" },
    { value: "洁净", label: "洁净室专用 50-150" },
    { value: "高端", label: "高端幕墙 120-174" },
  ],
  "不锈钢墙板": [
    { value: "普通", label: "普通板 80-160" },
    { value: "蜂窝", label: "不锈钢蜂窝 130-680" },
  ],
  "实验室瓷砖": [
    { value: "国产", label: "国产耐酸砖 30-80" },
    { value: "进口", label: "进口 50-150" },
    { value: "内墙", label: "内墙瓷砖 约32" },
  ],
  "抗菌涂料": [
    { value: "中端", label: "中端 15-25" },
    { value: "医用", label: "医用抗菌 20-30" },
  ],
  "医用洁净板（冰火板）": [
    { value: "普通", label: "普通 20-40" },
    { value: "A级", label: "A级抗菌 30-50" },
  ],
  "防撞墙板": [
    { value: "普通", label: "普通SPC 17-43" },
    { value: "医用", label: "医用防撞 150-250" },
  ],
  // ---- 吊顶 ----
  "彩钢板吊顶": [
    { value: "岩棉", label: "岩棉50mm 50-66" },
    { value: "手工", label: "手工吊顶板 60-90" },
    { value: "机制", label: "机制 30-53" },
  ],
  "铝扣板吊顶": [
    { value: "普通", label: "普通 60-100" },
    { value: "纳米", label: "纳米抗油污 100-150" },
    { value: "穿孔", label: "穿孔吸音 200-250" },
  ],
  "玻镁板吊顶": [
    { value: "高晶", label: "高晶抗菌板 约38" },
  ],
  "石膏板吊顶": [
    { value: "普通", label: "普通 17-30" },
    { value: "PVC", label: "PVC石膏 6-16" },
    { value: "矿棉", label: "矿棉吸音 10-20" },
  ],
  "硅酸钙板吊顶": [
    { value: "吊顶", label: "吊顶板 7-40" },
    { value: "工程", label: "工程板 14-30" },
    { value: "防火", label: "A级防火装饰板 17-50" },
  ],
  // ---- 门窗 ----
  "实验室气密门": [
    { value: "国产", label: "国产普通 210-1000" },
    { value: "中端", label: "中端 1200-3000" },
    { value: "高端", label: "高端电动感应 3000-8000+" },
  ],
  "钢制门": [
    { value: "普通", label: "普通型 100-412" },
    { value: "净化", label: "净化型 380-1000" },
  ],
  "不锈钢门": [
    { value: "国产", label: "国产 300-1000+" },
    { value: "高端", label: "高端进口 790-890" },
  ],
  "防火门": [
    { value: "甲级", label: "甲级 600-1500" },
    { value: "乙级", label: "乙级 400-800" },
    { value: "丙级", label: "丙级 300-500" },
  ],
  "观察窗": [
    { value: "国产", label: "国产 75-390" },
    { value: "高端", label: "高端 390-660" },
  ],
  // ---- 台面 ----
  "理化板（威盛亚/富美家）": [
    { value: "经济", label: "经济款 150-300" },
    { value: "威盛亚", label: "威盛亚/富美家 300-600" },
  ],
  "环氧树脂台面": [
    { value: "国产", label: "国产 600-1500" },
    { value: "进口", label: "进口Durcon 1500-2600" },
  ],
  "陶瓷台面": [
    { value: "国产", label: "国产 400-800" },
    { value: "进口", label: "进口Systemceram 800-2000" },
  ],
  "不锈钢台面": [
    { value: "201", label: "201材质 600-1200" },
    { value: "304", label: "304材质 1000-2500（生物安全/洁净推荐）" },
    { value: "316L", label: "316L 2000-4000（强腐蚀）" },
  ],
  "石英石台面": [
    { value: "国产", label: "国产 200-400" },
    { value: "中高端", label: "中高端 400-800" },
  ],
};

/** 某材料是否有分档（有则渲染档位下拉，无则显示"标准单档"占位）。 */
export function hasGrades(materialName: string): boolean {
  return Array.isArray(MATERIAL_GRADES[materialName]) && MATERIAL_GRADES[materialName].length > 0;
}

/** 档位在选项中的归一化位置（0=入门升级档 … 1=最高档）；找不到返回 -1。 */
export function gradePosition(grades: GradeOpt[], value: string): number {
  const i = grades.findIndex((g) => g.value === value);
  if (i < 0) return -1;
  return grades.length <= 1 ? 0 : i / (grades.length - 1);
}

/**
 * 档位下拉框配色 class。
 * 未选=蓝色虚线（提示可选）；入门升级=琥珀；中端=橙；最高档=玫红。
 */
export function gradeTierClass(grades: GradeOpt[], value: string): string {
  if (!value) return "border-dashed border-blue-200 text-blue-600";
  const ratio = gradePosition(grades, value);
  if (ratio < 0) return "border-gray-300 text-gray-700";
  if (ratio >= 0.99) return "border-rose-300 bg-rose-50 text-rose-700 font-semibold";
  if (ratio >= 0.5) return "border-orange-300 bg-orange-50 text-orange-700 font-medium";
  return "border-amber-300 bg-amber-50 text-amber-700";
}

/** 结果区档位徽标配色（与下拉配色同逻辑，无边框）。 */
export function gradeBadgeClass(grades: GradeOpt[], value: string): string {
  if (!value) return "bg-gray-100 text-gray-600";
  const ratio = gradePosition(grades, value);
  if (ratio < 0) return "bg-green-100 text-green-700";
  if (ratio >= 0.99) return "bg-rose-100 text-rose-700";
  if (ratio >= 0.5) return "bg-orange-100 text-orange-700";
  return "bg-amber-100 text-amber-700";
}

/**
 * 行编辑后档位联动规则：
 * - 切换部位或材料时，旧档位对新材料可能不适用 → 重置为默认（空串）；
 * - 仅修改档位/工程量/宽度系数时保留档位。
 */
export function gradeAfterPatch(
  patch: { part_type?: string; material_name?: string; material_grade?: string },
  currentGrade: string
): string {
  if (patch.part_type !== undefined || patch.material_name !== undefined) return "";
  if (patch.material_grade !== undefined) return patch.material_grade;
  return currentGrade;
}
