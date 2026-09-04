"""人工费估算Schema"""
from pydantic import BaseModel, Field


class PVCFlooringInput(BaseModel):
    area: float = Field(default=100, gt=0, description="铺设面积(㎡)")
    region: str = Field(default="深圳", description="地区（深圳/广州/北京/上海/海口/成都）")
    pvc_type: str = Field(default="卷材", description="PVC类型（卷材/片材/防静电型）")
    include_subfloor: bool = Field(default=True, description="是否含自流平基层处理")


class FumeHoodInput(BaseModel):
    count: int = Field(default=1, gt=0, description="通风柜数量（台）")
    region: str = Field(default="深圳", description="地区（深圳/广州/北京/上海/海口/成都）")
    hood_type: str = Field(default="全钢", description="通风柜类型（全钢/PP/玻璃钢）")
    include_ductwork: bool = Field(default=True, description="是否含排风管对接")


class ProjectCostInput(BaseModel):
    material_cost: float = Field(default=0, ge=0, description="材料费(元)")
    labor_cost: float = Field(default=0, ge=0, description="人工费(元)")
    region: str = Field(default="湖南", description="地区（用于查管理费/利润率）")
    project_type: str = Field(default="装饰装修工程", description="工程类型（装饰装修工程/建筑工程/安装工程等）")
    vat_method: str = Field(default="一般计税方法", description="增值税计税方法")
    custom_measure_fee: float = Field(default=0, ge=0, description="自定义措施费（为0时自动按费率计算）")
