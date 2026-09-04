import { describe, it, expect } from "vitest";
import {
  MATERIAL_GRADES,
  hasGrades,
  gradePosition,
  gradeTierClass,
  gradeBadgeClass,
  gradeAfterPatch,
} from "./precise-quote-grades";

const STEEL = MATERIAL_GRADES["不锈钢台面"]; // 3 档：201 / 304 / 316L
const DOOR = MATERIAL_GRADES["防火门"];      // 3 档：甲级 / 乙级 / 丙级（注意 label 顺序）
const SINGLE = MATERIAL_GRADES["玻镁板吊顶"]; // 仅 1 档：高晶

describe("MATERIAL_GRADES 档位数据完整性", () => {
  it("关键材料档位存在且 value 正确", () => {
    expect(STEEL.map((g) => g.value)).toEqual(["201", "304", "316L"]);
    expect(DOOR.map((g) => g.value)).toEqual(["甲级", "乙级", "丙级"]);
    expect(MATERIAL_GRADES["实验室气密门"].map((g) => g.value)).toEqual(["国产", "中端", "高端"]);
    expect(MATERIAL_GRADES["彩钢板吊顶"].map((g) => g.value)).toEqual(["岩棉", "手工", "机制"]);
  });

  it("覆盖 30 种以上分档材料，且每个档位 value/label 非空、value 在同一材料内唯一", () => {
    const names = Object.keys(MATERIAL_GRADES);
    expect(names.length).toBeGreaterThanOrEqual(30);
    for (const name of names) {
      const grades = MATERIAL_GRADES[name];
      expect(grades.length).toBeGreaterThanOrEqual(1);
      const values = grades.map((g) => g.value);
      expect(new Set(values).size, `${name} 档位 value 重复`).toBe(values.length);
      for (const g of grades) {
        expect(g.value.trim().length, `${name} 存在空 value`).toBeGreaterThan(0);
        expect(g.label.trim().length, `${name} 存在空 label`).toBeGreaterThan(0);
      }
    }
  });

  it("hasGrades：分档材料为 true，单档材料（如彩钢板隔墙/抗菌涂料之外的普通材料）为 false", () => {
    expect(hasGrades("不锈钢台面")).toBe(true);
    expect(hasGrades("防火门")).toBe(true);
    expect(hasGrades("实验室气密门")).toBe(true);
    // 以下材料未在档位表中登记（标准单档），应返回 false
    expect(hasGrades("彩钢板隔墙")).toBe(false);
    expect(hasGrades("不存在的材料XYZ")).toBe(false);
  });
});

describe("gradePosition 档位位置归一化", () => {
  it("首档=0、末档=1、中间=0.5", () => {
    expect(gradePosition(STEEL, "201")).toBe(0);
    expect(gradePosition(STEEL, "304")).toBeCloseTo(0.5);
    expect(gradePosition(STEEL, "316L")).toBe(1);
  });
  it("4 档材料：索引/（n-1）", () => {
    const pvc = MATERIAL_GRADES["PVC卷材（同质透心）"];
    expect(gradePosition(pvc, "国产")).toBe(0);
    expect(gradePosition(pvc, "中端")).toBeCloseTo(0.5);
    expect(gradePosition(pvc, "进口")).toBe(1);
    const epoxy = MATERIAL_GRADES["防静电环氧地坪"]; // 4 档
    expect(gradePosition(epoxy, "砂浆")).toBeCloseTo(1 / 3);
    expect(gradePosition(epoxy, "自流平")).toBeCloseTo(2 / 3);
  });
  it("单一档位材料返回 0（不除以 0）", () => {
    expect(gradePosition(SINGLE, "高晶")).toBe(0);
  });
  it("找不到档位返回 -1", () => {
    expect(gradePosition(STEEL, "999K")).toBe(-1);
    expect(gradePosition(STEEL, "")).toBe(-1);
  });
});

describe("gradeTierClass 下拉框配色", () => {
  it("未选档位 = 蓝色虚线提示", () => {
    const cls = gradeTierClass(STEEL, "");
    expect(cls).toContain("border-dashed");
    expect(cls).toContain("blue");
  });
  it("入门升级档（首档）= 琥珀色", () => {
    expect(gradeTierClass(STEEL, "201")).toContain("amber");
  });
  it("中间档 = 橙色", () => {
    expect(gradeTierClass(STEEL, "304")).toContain("orange");
    expect(gradeTierClass(DOOR, "乙级")).toContain("orange");
  });
  it("最高档 = 玫红且加粗", () => {
    const high = gradeTierClass(STEEL, "316L");
    expect(high).toContain("rose");
    expect(high).toContain("font-semibold");
    expect(gradeTierClass(DOOR, "丙级")).toContain("rose");
  });
  it("不存在的档位 = 灰色回退", () => {
    expect(gradeTierClass(STEEL, "999K")).toContain("gray");
  });
});

describe("gradeBadgeClass 结果区徽标配色", () => {
  it("未选/未知/低中高档配色规则", () => {
    expect(gradeBadgeClass(STEEL, "")).toContain("bg-gray");
    expect(gradeBadgeClass(STEEL, "201")).toContain("amber");
    expect(gradeBadgeClass(STEEL, "304")).toContain("orange");
    expect(gradeBadgeClass(STEEL, "316L")).toContain("rose");
    expect(gradeBadgeClass(STEEL, "999K")).toContain("green"); // 未知值兜底绿
  });
  it("徽标配色与下拉配色档位语义一致（同档位色系相同）", () => {
    for (const v of ["201", "304", "316L"]) {
      const tier = gradeTierClass(STEEL, v);
      const badge = gradeBadgeClass(STEEL, v);
      const color = v === "201" ? "amber" : v === "304" ? "orange" : "rose";
      expect(tier).toContain(color);
      expect(badge).toContain(color);
    }
  });
});

describe("gradeAfterPatch 行编辑档位联动", () => {
  it("切换材料时档位重置为空（旧档位对新材料可能不适用）", () => {
    expect(gradeAfterPatch({ material_name: "环氧树脂台面" }, "304")).toBe("");
  });
  it("切换部位时档位重置为空", () => {
    expect(gradeAfterPatch({ part_type: "wall" }, "304")).toBe("");
  });
  it("部位+材料同时切换也重置", () => {
    expect(gradeAfterPatch({ part_type: "door", material_name: "防火门" }, "中端")).toBe("");
  });
  it("仅修改档位时取新档位", () => {
    expect(gradeAfterPatch({ material_grade: "316L" }, "304")).toBe("316L");
    expect(gradeAfterPatch({ material_grade: "" }, "304")).toBe(""); // 用户主动清空
  });
  it("修改工程量/宽度系数时保留当前档位", () => {
    expect(gradeAfterPatch({ quantity: "50" } as any, "304")).toBe("304");
    expect(gradeAfterPatch({ width_factor: 2.0 } as any, "中端")).toBe("中端");
  });
  it("空 patch 保留当前档位", () => {
    expect(gradeAfterPatch({}, "304")).toBe("304");
    expect(gradeAfterPatch({}, "")).toBe("");
  });
});
