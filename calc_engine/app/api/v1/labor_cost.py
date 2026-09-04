"""人工费估算API"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db, save_calculation_record
from app.schemas.common import CalculationResult
from app.services import labor_cost_db, cost_rate_db, labor_cost_service

router = APIRouter(prefix="/labor-cost", tags=["labor_cost"])


# ==================== 查询接口 ====================


@router.get("/regions", summary="查询所有可用地区")
def list_regions():
    daily = labor_cost_db.list_regions()
    rates = cost_rate_db.list_regions() if hasattr(cost_rate_db, "list_regions") else []
    return {
        "daily_wage_regions": daily,
        "rate_regions": rates,
    }


@router.get("/trades", summary="查询所有工种及数据可用性")
def list_trades():
    return labor_cost_service.list_all_trades()


@router.get("/rates", summary="查询所有费率数据概览")
def list_rates():
    return labor_cost_service.list_all_rates()


@router.get("/daily-wage/{region}", summary="查询某地区日工资信息价")
def get_daily_wage(region: str, trade: Optional[str] = Query(None, description="工种名（不传则返回全部）")):
    return labor_cost_db.get_daily_wage(region, trade)


@router.get("/trade/{trade_name}", summary="查询某工种人工费数据（含所有地区）")
def get_trade_cost(trade_name: str):
    return labor_cost_db.get_trade_labor_cost(trade_name)


@router.get("/aux-ratio/{material_type}", summary="查询辅材费占主材费的比例")
def get_aux_ratio(material_type: str):
    return labor_cost_db.get_aux_ratio(material_type)


@router.get("/management-fee", summary="查询企业管理费费率")
def get_mgmt_fee(
    region: str = Query("湖南", description="地区"),
    project_type: str = Query("装饰装修工程", description="工程类型"),
):
    return cost_rate_db.get_management_fee_rate(region, project_type)


@router.get("/profit", summary="查询利润率")
def get_profit(
    region: str = Query("湖南", description="地区"),
    project_type: str = Query("装饰装修工程", description="工程类型"),
):
    return cost_rate_db.get_profit_rate(region, project_type)


@router.get("/vat", summary="查询增值税税率")
def get_vat(method: str = Query("一般计税方法", description="计税方法")):
    return cost_rate_db.get_vat_rate(method)


@router.get("/measure-fee", summary="查询措施费费率")
def get_measure_fee(project_type: str = Query("装饰装修工程", description="工程类型")):
    return cost_rate_db.get_measure_fee_rate(project_type)


# ==================== 估算接口 ====================


@router.post(
    "/pvc-flooring",
    response_model=CalculationResult[dict],
    summary="PVC地板铺设人工费估算（三种方法交叉验证）",
)
def estimate_pvc_flooring(
    area: float = Query(100, gt=0, description="铺设面积(㎡)"),
    region: str = Query("深圳", description="地区"),
    pvc_type: str = Query("卷材", description="PVC类型（卷材/片材/防静电型）"),
    include_subfloor: bool = Query(True, description="是否含自流平基层处理"),
    db: Optional[Session] = Depends(get_db),
):
    import time
    t0 = time.perf_counter()

    data = labor_cost_service.estimate_pvc_flooring_labor(
        area=area, region=region, pvc_type=pvc_type, include_subfloor=include_subfloor,
    )

    result = CalculationResult.ok(
        module="labor_cost",
        module_version="1.0.0",
        data=data,
        references=[
            "GB 50073-2013 洁净厂房设计规范",
            "GB 50591-2010 洁净室施工及验收规范",
            "JGJ 91-2019 科学实验建筑设计规范",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    record_id = save_calculation_record(
        db, module="labor_cost", module_version="1.0.0",
        status=result.status.value,
        input_data={"area": area, "region": region, "pvc_type": pvc_type, "include_subfloor": include_subfloor},
        output_data=result.data, warnings=result.warnings,
    )
    if record_id and result.meta:
        result.meta.record_id = record_id
    return result


@router.post(
    "/fume-hood",
    response_model=CalculationResult[dict],
    summary="通风柜安装人工费估算（工时法+市场报价区间）",
)
def estimate_fume_hood(
    count: int = Query(1, gt=0, description="通风柜数量（台）"),
    region: str = Query("深圳", description="地区"),
    hood_type: str = Query("全钢", description="通风柜类型（全钢/PP/玻璃钢）"),
    include_ductwork: bool = Query(True, description="是否含排风管对接"),
    db: Optional[Session] = Depends(get_db),
):
    import time
    t0 = time.perf_counter()

    data = labor_cost_service.estimate_fume_hood_labor(
        count=count, region=region, hood_type=hood_type, include_ductwork=include_ductwork,
    )

    result = CalculationResult.ok(
        module="labor_cost",
        module_version="1.0.0",
        data=data,
        references=[
            "ANSI/AIHA Z9.5 实验室通风设计",
            "ASHRAE 110 通风柜认证",
            "NFPA 45 消防安全",
            "JGJ 91-2019 科学实验建筑设计规范",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    record_id = save_calculation_record(
        db, module="labor_cost", module_version="1.0.0",
        status=result.status.value,
        input_data={"count": count, "region": region, "hood_type": hood_type, "include_ductwork": include_ductwork},
        output_data=result.data, warnings=result.warnings,
    )
    if record_id and result.meta:
        result.meta.record_id = record_id
    return result


@router.post(
    "/project-cost",
    response_model=CalculationResult[dict],
    summary="工程造价汇总计算（人工+材料→管理费→利润→措施费→增值税）",
)
def calc_project_cost(
    material_cost: float = Query(0, ge=0, description="材料费(元)"),
    labor_cost: float = Query(0, ge=0, description="人工费(元)"),
    region: str = Query("湖南", description="地区"),
    project_type: str = Query("装饰装修工程", description="工程类型"),
    vat_method: str = Query("一般计税方法", description="增值税计税方法"),
    custom_measure_fee: float = Query(0, ge=0, description="自定义措施费（0=自动按费率计算）"),
    db: Optional[Session] = Depends(get_db),
):
    import time
    t0 = time.perf_counter()

    data = labor_cost_service.calculate_project_cost(
        material_cost=material_cost, labor_cost=labor_cost,
        region=region, project_type=project_type,
        vat_method=vat_method, custom_measure_fee=custom_measure_fee,
    )

    result = CalculationResult.ok(
        module="labor_cost",
        module_version="1.0.0",
        data=data,
        references=[
            "建标〔2013〕44号 建筑安装工程费用项目组成",
            "湖南省住建厅建筑安装工程费用标准表（2025-09）",
            "福建省住建厅闽建筑〔2025〕2号",
        ],
        duration_ms=(time.perf_counter() - t0) * 1000.0,
    )
    record_id = save_calculation_record(
        db, module="labor_cost", module_version="1.0.0",
        status=result.status.value,
        input_data={
            "material_cost": material_cost, "labor_cost": labor_cost,
            "region": region, "project_type": project_type,
            "vat_method": vat_method, "custom_measure_fee": custom_measure_fee,
        },
        output_data=result.data, warnings=result.warnings,
    )
    if record_id and result.meta:
        result.meta.record_id = record_id
    return result
