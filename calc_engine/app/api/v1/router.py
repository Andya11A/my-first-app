"""计算引擎 API v1 路由
========================

- POST /calc/hvac         暖通空调计算
- POST /hvac/calculate    暖通综合计算 V2（冷热负荷/通风量/压差/废气/系统选型）
- POST /electrical/calculate 电气综合计算（负荷/电缆/断路器/短路校核）
- POST /process/calculate 工艺规划计算（分区/面积/环境/设备负荷/动线）
- POST /decoration/calculate 装修工程量计算（地面/墙面/吊顶/门窗/造价）
- POST /plumbing/calculate 给排水计算（排水流量/管径/坡度/流速校核/管材）
- POST /weak-current/calculate 弱电智能化计算（信息点/线缆/安防/环监/防雷）
- POST /intelligence/calculate 智能化设计计算（点位/环境监控/能耗监测）
- POST /workflow/calculate-hvac 图纸联动暖通计算（DXF→通风柜识别→逐台风量）
- POST /psychrometrics/state     空气状态点计算（焓湿图：干湿球/干球+相对湿度 → 完整状态）
- POST /psychrometrics/supply-air 送风量/冷量/除湿量计算（焓差法）
- POST /lighting/calculate       照度计算（利用系数法灯具数量）
- POST /ups/calculate            UPS容量与电池配置计算
- POST /fire-extinguisher/calculate 灭火器配置计算（GB 50140-2005）
- POST /pure-water/calculate     纯水系统设计计算（制水设备/储罐/原水消耗）
- POST /cooling-water/calculate  冷却塔选型计算（流量/容量/补水/接近度）
- POST /cable-tray/calculate     电缆桥架尺寸选型（填充率法）
- POST /smoke-exhaust/calculate  消防排烟量计算（GB 51251-2017）
- POST /lightning/calculate      防雷等级与接闪器布置计算（GB 50057-2010）
- POST /fire-hydrant/calculate   消火栓配置与用水量计算（GB 50974-2014）
- POST /chiller/calculate        冷水机组与水泵选型（N-1冗余）
- POST /duct/calculate           风管尺寸计算（风速法+50mm模数取整）
- POST /energy/calculate         年运行能耗与电费估算
- POST /control-points/calculate 自控系统点位表+DDC控制器数量
- POST /exhaust-gas/treatment   废气处理设备选型与达标核算
- POST /exhaust-gas/carbon-lifetime 活性炭寿命与更换周期计算
- POST /noise/calculate          噪声传播衰减计算（GB 12348-2008）
- POST /wastewater/calculate     废水处理系统计算（GB 8978-1996）
- POST /exhaust-system/calculate 完整废气系统设计（收集→风管→阻力→风机→处理→排放）
- POST /calc/gas-supply   集中供气计算
- GET  /labor-cost/*      人工费定额与估算（日工资/工种/费率/PVC地板/通风柜/造价汇总）
- GET  /materials/*       材料库查询（气体特性/管材/实验台/地坪/跨专业匹配）
- GET  /modules           模块清单与实现状态
- POST /drawing/parse     DXF 图纸解析（墙体/门窗/设备图块）
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.v1.cable_tray import router as cable_tray_router
from app.api.v1.chiller import router as chiller_router
from app.api.v1.control_points import router as control_points_router
from app.api.v1.cooling_water import router as cooling_water_router
from app.api.v1.decoration import router as decoration_router
from app.api.v1.drawing import router as drawing_router
from app.api.v1.duct import router as duct_router
from app.api.v1.electrical import router as electrical_router
from app.api.v1.energy import router as energy_router
from app.api.v1.exhaust_gas import router as exhaust_gas_router
from app.api.v1.export import router as export_router
from app.api.v1.ffu import router as ffu_router
from app.api.v1.finish_config import router as finish_config_router
from app.api.v1.exhaust_system import router as exhaust_system_router
from app.api.v1.fire_hydrant import router as fire_hydrant_router
from app.api.v1.lightning import router as lightning_router
from app.api.v1.smoke_exhaust import router as smoke_exhaust_router
from app.api.v1.fire_extinguisher import router as fire_extinguisher_router
from app.api.v1.hvac import router as hvac_v2_router
from app.api.v1.intelligence import router as intelligence_router
from app.api.v1.labor_cost import router as labor_cost_router
from app.api.v1.lighting import router as lighting_router
from app.api.v1.noise import router as noise_router
from app.api.v1.plumbing import router as plumbing_router
from app.api.v1.process import router as process_router
from app.api.v1.process_chain import router as process_chain_router
from app.api.v1.quote_integration import router as quote_integration_router
from app.api.v1.precise_quote import router as precise_quote_router
from app.api.v1.pure_water import router as pure_water_router
from app.api.v1.ups import router as ups_router
from app.api.v1.wastewater import router as wastewater_router
from app.api.v1.auto_match import router as auto_match_router
from app.api.v1.weak_current import router as weak_current_router
from app.api.v1.workflow import router as workflow_router
from app.api.v1.psychrometrics import router as psychrometrics_router
from app.api.v1.records import router as records_router
from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.schemas.gas import GasSupplyInput, GasSupplyOutput
from app.schemas.hvac import HvacInput, HvacOutput
from app.services.gas_supply_service import GasSupplyService
from app.services.hvac_service import HvacService
from app.services.material_db import get_material_library

router = APIRouter()
router.include_router(drawing_router)
router.include_router(hvac_v2_router)
router.include_router(electrical_router)
router.include_router(process_router)
router.include_router(decoration_router)
router.include_router(plumbing_router)
router.include_router(weak_current_router)
router.include_router(intelligence_router)
router.include_router(workflow_router)
router.include_router(psychrometrics_router)
router.include_router(lighting_router)
router.include_router(ups_router)
router.include_router(fire_extinguisher_router)
router.include_router(pure_water_router)
router.include_router(cooling_water_router)
router.include_router(cable_tray_router)
router.include_router(smoke_exhaust_router)
router.include_router(lightning_router)
router.include_router(fire_hydrant_router)
router.include_router(chiller_router)
router.include_router(duct_router)
router.include_router(energy_router)
router.include_router(control_points_router)
router.include_router(exhaust_gas_router)
router.include_router(noise_router)
router.include_router(wastewater_router)
router.include_router(exhaust_system_router)
router.include_router(process_chain_router)
router.include_router(quote_integration_router)
router.include_router(auto_match_router)
router.include_router(records_router)
router.include_router(ffu_router)
router.include_router(finish_config_router)
router.include_router(labor_cost_router)
router.include_router(precise_quote_router)
router.include_router(export_router)

MODULE_STATUS = [
    {"module": "hvac", "name": "暖通空调", "status": "ready", "endpoint": "/calc/hvac"},
    {"module": "gas", "name": "集中供气", "status": "ready", "endpoint": "/calc/gas-supply"},
    {"module": "electrical", "name": "电气动力", "status": "ready", "endpoint": "/electrical/calculate"},
    {"module": "process", "name": "工艺规划", "status": "ready", "endpoint": "/process/calculate"},
    {"module": "decoration", "name": "装饰装修", "status": "ready", "endpoint": "/decoration/calculate"},
    {"module": "plumbing", "name": "给排水", "status": "ready", "endpoint": "/plumbing/calculate"},
    {"module": "weak_current", "name": "弱电智能化", "status": "ready", "endpoint": "/weak-current/calculate"},
    {"module": "intelligence", "name": "智能化", "status": "ready", "endpoint": "/intelligence/calculate"},
    {"module": "workflow", "name": "图纸联动工作流", "status": "ready", "endpoint": "/workflow/calculate-hvac"},
    {"module": "psychrometrics", "name": "焓湿计算", "status": "ready", "endpoint": "/psychrometrics/state"},
    {"module": "lighting", "name": "照度计算", "status": "ready", "endpoint": "/lighting/calculate"},
    {"module": "ups", "name": "UPS容量", "status": "ready", "endpoint": "/ups/calculate"},
    {"module": "fire_extinguisher", "name": "灭火器配置", "status": "ready", "endpoint": "/fire-extinguisher/calculate"},
    {"module": "pure_water", "name": "纯水系统", "status": "ready", "endpoint": "/pure-water/calculate"},
    {"module": "cooling_water", "name": "冷却水系统", "status": "ready", "endpoint": "/cooling-water/calculate"},
    {"module": "cable_tray", "name": "桥架选型", "status": "ready", "endpoint": "/cable-tray/calculate"},
    {"module": "smoke_exhaust", "name": "消防排烟", "status": "ready", "endpoint": "/smoke-exhaust/calculate"},
    {"module": "lightning", "name": "防雷接地", "status": "ready", "endpoint": "/lightning/calculate"},
    {"module": "fire_hydrant", "name": "消火栓配置", "status": "ready", "endpoint": "/fire-hydrant/calculate"},
    {"module": "chiller", "name": "冷热源选型", "status": "ready", "endpoint": "/chiller/calculate"},
    {"module": "duct", "name": "风管尺寸", "status": "ready", "endpoint": "/duct/calculate"},
    {"module": "energy", "name": "能耗估算", "status": "ready", "endpoint": "/energy/calculate"},
    {"module": "control_points", "name": "自控点位", "status": "ready", "endpoint": "/control-points/calculate"},
    {"module": "exhaust_gas", "name": "废气处理", "status": "ready", "endpoint": "/exhaust-gas/treatment"},
    {"module": "noise", "name": "噪声计算", "status": "ready", "endpoint": "/noise/calculate"},
    {"module": "wastewater", "name": "废水处理", "status": "ready", "endpoint": "/wastewater/calculate"},
    {"module": "exhaust_system", "name": "废气系统", "status": "ready", "endpoint": "/exhaust-system/calculate"},
    {"module": "process_chain", "name": "工艺链推荐", "status": "ready", "endpoint": "/process-chain/exhaust/化学实验室"},
    {"module": "quote_integration", "name": "一键报价", "status": "ready", "endpoint": "/quote/integrated"},
    {"module": "ffu", "name": "FFU数量计算", "status": "ready", "endpoint": "/ffu/calculate"},
    {"module": "finish_config", "name": "装修配置方案", "status": "ready", "endpoint": "/finish-config/plan"},
    {"module": "labor_cost", "name": "人工费定额", "status": "ready", "endpoint": "/labor-cost/pvc-flooring"},
    {"module": "precise_quote", "name": "精确报价", "status": "ready", "endpoint": "/precise-quote/calculate"},
]


# ==================== 模块清单 ====================


@router.get("/modules", summary="模块清单与实现状态")
def list_modules() -> list[dict]:
    return MODULE_STATUS


# ==================== 专业计算 ====================


@router.post(
    "/calc/hvac",
    response_model=CalculationResult[HvacOutput],
    summary="暖通空调计算（排风/补风/负荷/管径/风机）",
)
def calc_hvac(payload: HvacInput, db: Optional[Session] = Depends(get_db)):
    service = HvacService()
    result = service.calculate(payload)
    save_calculation_record(
        db,
        module=service.module_name,
        module_version=service.module_version,
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result


@router.post(
    "/calc/gas-supply",
    response_model=CalculationResult[GasSupplyOutput],
    summary="集中供气计算（流量/管径材质/瓶组方案/减压配置）",
)
def calc_gas_supply(payload: GasSupplyInput, db: Optional[Session] = Depends(get_db)):
    service = GasSupplyService()
    result = service.calculate(payload)
    save_calculation_record(
        db,
        module=service.module_name,
        module_version=service.module_version,
        status=result.status.value,
        input_data=payload,
        output_data=result.data,
        warnings=result.warnings,
    )
    return result


# ==================== 材料库 ====================

_library = get_material_library()


@router.get("/materials/gases", summary="气体特性库")
def list_gases() -> list[dict]:
    return [g.model_dump() for g in _library.gases()]


@router.get("/materials/gas-pipe", summary="按气体+纯度推荐管材")
def gas_pipe(gas: str = "N2", purity: str = "high_purity") -> dict:
    return {"gas": gas, "purity": purity, "pipe_material": _library.gas_pipe_material(gas, purity)}


@router.get("/materials/benches", summary="实验台材质库")
def list_benches() -> list[dict]:
    return [b.model_dump() for b in _library.benches()]


@router.get("/materials/floorings", summary="地坪材质库")
def list_floorings() -> list[dict]:
    return [f.model_dump() for f in _library.floorings()]


@router.get("/materials/match", summary="按环境等级跨专业匹配材料（例：耐酸碱）")
def match_by_grade(grade: str = "耐酸碱") -> dict:
    return _library.match_by_grade(grade)


@router.get("/materials/fan-match", summary="按排风耐酸碱等级匹配风机/叶轮材质（high/medium/low）")
def fan_match(acid_resistance: str = "medium") -> dict:
    material = _library.fan_match(acid_resistance)
    if material is None:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail=f"未知耐酸碱等级: {acid_resistance}（可选 high/medium/low）")
    return {
        "acid_resistance": acid_resistance.lower(),
        **material,
    }
