"""材料与设备基础库 (Material Database)
========================================

职责：为各专业计算模块提供"基础数据 + 特性匹配"查询能力。

设计说明
--------
- 当前以进程内静态种子数据实现（零依赖、启动即用）；
- 数据结构均用 Pydantic 模型描述，后续可无缝迁移到 PostgreSQL（SQLAlchemy 表），
  只需保持 ``MaterialLibrary`` 的查询接口签名不变，各计算模块无感知升级。

跨专业匹配示例（本库核心价值）:
    - 选了"耐酸碱"环境等级 → 自动匹配 316L BA 管材 / PP 风管 / FRP 防腐风机
    - 输入气体代码 HCl     → 自动返回腐蚀性属性 → 推荐管材与减压阀材质
    - 选了"超高纯"等级     → 自动升级 EP 级内表面 + VCR 接头
"""
from __future__ import annotations

from functools import lru_cache
from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from app.core.constants import CYLINDER_USABLE_NM3, FAN_MATERIAL_BY_ACID


# ==================== 数据结构定义 ====================


class GasProperty(BaseModel):
    """气体特性：供气模块做管材/阀件/安全配置选型的依据。"""

    code: str
    name: str
    category: str = Field(..., description="inert惰性/oxidizing氧化性/flammable可燃/corrosive腐蚀/toxic有毒")
    density_kg_nm3: float = Field(..., description="标态密度 kg/Nm³")
    corrosive: bool = False
    flammable: bool = False
    oxidizing: bool = False
    toxic: bool = False
    cylinder_usable_nm3: float = Field(default=CYLINDER_USABLE_NM3, description="标准 40L/15MPa 钢瓶可供气量 Nm³")
    liquid_expansion_ratio: Optional[float] = Field(
        None, description="液态→气态膨胀比 (1L 液体汽化 Nm³)；None 表示不适用杜瓦罐方案"
    )


class LabBench(BaseModel):
    """实验台材质。"""

    id: str
    name: str
    grade: str = Field(..., description="适用环境等级: general/耐酸碱/强腐蚀/洁净")
    acid_alkali: bool = Field(False, description="耐酸碱")
    solvent: bool = Field(False, description="耐有机溶剂")
    price_per_m2: float = Field(..., description="参考单价 元/m²（示例价，以询价为准）")


class FlooringMaterial(BaseModel):
    id: str
    name: str
    grade: str
    anti_static: bool = False
    chemical_resistant: bool = False
    price_per_m2: float


class DuctFanMaterial(BaseModel):
    """风管/风机防腐材质组合。"""

    scenario: str = Field(..., description="standard常规/corrosive腐蚀/high_temp高温")
    duct: str
    fan: str


# ==================== 种子数据 ====================

GAS_PROPERTIES: Dict[str, GasProperty] = {
    "N2":  GasProperty(code="N2",  name="氮气",   category="inert",     density_kg_nm3=1.25, liquid_expansion_ratio=681.0),
    "O2":  GasProperty(code="O2",  name="氧气",   category="oxidizing", density_kg_nm3=1.43, oxidizing=True, liquid_expansion_ratio=842.0),
    "Ar":  GasProperty(code="Ar",  name="氩气",   category="inert",     density_kg_nm3=1.78, liquid_expansion_ratio=839.0),
    "He":  GasProperty(code="He",  name="氦气",   category="inert",     density_kg_nm3=0.18),
    "H2":  GasProperty(code="H2",  name="氢气",   category="flammable", density_kg_nm3=0.09, flammable=True),
    "CO2": GasProperty(code="CO2", name="二氧化碳", category="inert",   density_kg_nm3=1.98),
    "CH4": GasProperty(code="CH4", name="甲烷",   category="flammable", density_kg_nm3=0.72, flammable=True),
    "C2H2": GasProperty(code="C2H2", name="乙炔", category="flammable", density_kg_nm3=1.17, flammable=True),
    "NH3": GasProperty(code="NH3", name="氨气",   category="corrosive", density_kg_nm3=0.77, corrosive=True, toxic=True),
    "CL2": GasProperty(code="CL2", name="氯气",   category="toxic",     density_kg_nm3=3.21, corrosive=True, toxic=True),
    "HCL": GasProperty(code="HCL", name="氯化氢", category="corrosive", density_kg_nm3=1.64, corrosive=True, toxic=True),
    "H2S": GasProperty(code="H2S", name="硫化氢", category="toxic",     density_kg_nm3=1.54, corrosive=True, toxic=True),
}

# 纯度等级 → 管材内表面等级
PURITY_TO_PIPE = {
    "industrial": "316L 无缝钢管（自动焊+卡套连接）",
    "high_purity": "316L BA级不锈钢管（内表面光亮退火，自动焊/VCR）",
    "ultra_high_purity": "316L EP级不锈钢管（内表面电解抛光，VCR 接头）",
}

DUCT_FAN_MATERIALS: Dict[str, DuctFanMaterial] = {
    "standard": DuctFanMaterial(scenario="standard", duct="镀锌钢板风管", fan="碳钢喷涂离心风机"),
    "corrosive": DuctFanMaterial(scenario="corrosive", duct="PP聚丙烯/玻璃钢(FRP)风管", fan="PP/FRP 防腐风机"),
}

LAB_BENCHES: List[LabBench] = [
    LabBench(id="phenolic", name="理化板实验台", grade="耐酸碱", acid_alkali=True, price_per_m2=1800),
    LabBench(id="epoxy", name="环氧树脂台面", grade="强腐蚀", acid_alkali=True, solvent=True, price_per_m2=2600),
    LabBench(id="pp", name="PP 实验台", grade="强腐蚀(HF)", acid_alkali=True, solvent=True, price_per_m2=3000),
    LabBench(id="ss304", name="304 不锈钢台面", grade="洁净/无菌", price_per_m2=3200),
]

FLOORINGS: List[FlooringMaterial] = [
    FlooringMaterial(id="pvc", name="PVC 卷材地板", grade="general", price_per_m2=260),
    FlooringMaterial(id="epoxy_floor", name="环氧自流平", grade="耐酸碱", chemical_resistant=True, price_per_m2=380),
    FlooringMaterial(id="epoxy_anti_static", name="环氧防静电自流平", grade="耐酸碱/防静电", chemical_resistant=True, anti_static=True, price_per_m2=450),
    FlooringMaterial(id="emery", name="金刚砂耐磨地坪", grade="general", price_per_m2=200),
]


# ==================== 查询接口 ====================


class MaterialLibrary:
    """材料库查询接口 —— 各计算模块统一通过本类访问基础数据。"""

    # ---- 气体 ----
    def gas(self, code: str) -> Optional[GasProperty]:
        return GAS_PROPERTIES.get(code.upper())

    def gases(self) -> List[GasProperty]:
        return list(GAS_PROPERTIES.values())

    # ---- 供气管材：气体特性 × 纯度等级 → 管材 ----
    def gas_pipe_material(self, gas_code: str, purity: str = "high_purity") -> str:
        prop = self.gas(gas_code)
        if prop is None:
            return PURITY_TO_PIPE.get(purity, PURITY_TO_PIPE["high_purity"])
        # 腐蚀性/有毒气体：即使工业级也强制 BA 级内表面（抗点蚀）
        if prop.corrosive or prop.toxic:
            return "316L BA级不锈钢管（耐腐蚀，内表面光亮退火，自动焊）"
        return PURITY_TO_PIPE.get(purity, PURITY_TO_PIPE["high_purity"])

    # ---- 暖通风管/风机：是否腐蚀性排气 → 材质 ----
    def duct_material(self, corrosive: bool) -> str:
        return DUCT_FAN_MATERIALS["corrosive" if corrosive else "standard"].duct

    def fan_material(self, corrosive: bool) -> str:
        return DUCT_FAN_MATERIALS["corrosive" if corrosive else "standard"].fan

    # ---- 风机防腐材质联动（耐酸碱三级匹配，来源：洁净EPC-AI 合并）----
    def fan_match(self, acid_resistance: str) -> dict:
        """按耐酸碱等级 (high/medium/low) 匹配风机与叶轮材质。

        与 fan_material(corrosive: bool) 的布尔档相比，本方法提供三档精细选型，
        可直接被暖通排风选型与前端材料推荐联动调用。
        未知等级返回 None（由 API 层转换为 404）。
        """
        return FAN_MATERIAL_BY_ACID.get(acid_resistance.lower())

    # ---- 装修材料 ----
    def benches(self) -> List[LabBench]:
        return LAB_BENCHES

    def floorings(self) -> List[FlooringMaterial]:
        return FLOORINGS

    def match_by_grade(self, grade: str) -> dict:
        """按环境等级做跨专业匹配。

        例: grade="耐酸碱" → 返回耐腐蚀实验台/地坪 + PP风管 + FRP风机，
        供装修模块与暖通模块联动选材。
        """
        anti_chemical = ("酸碱" in grade) or ("腐蚀" in grade)
        bench = next((b for b in LAB_BENCHES if grade in b.grade), None)
        flooring = next((f for f in FLOORINGS if grade in f.grade), None)
        return {
            "grade": grade,
            "bench": (bench or LAB_BENCHES[0]).model_dump(),
            "flooring": (flooring or FLOORINGS[0]).model_dump(),
            "duct": self.duct_material(anti_chemical),
            "fan": self.fan_material(anti_chemical),
            "gas_pipe": self.gas_pipe_material("HCL") if anti_chemical else self.gas_pipe_material("N2"),
        }


@lru_cache
def get_material_library() -> MaterialLibrary:
    return MaterialLibrary()
