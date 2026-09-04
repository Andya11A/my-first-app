"""装修配置Schema"""
from pydantic import BaseModel, Field


class FinishConfigInput(BaseModel):
    lab_type: str = Field(..., description="实验室类型（支持别名：PCR/理化/动物/医院/GMP/电子等）")
    clean_level: str = Field(default="十万级", description="洁净等级（百级/千级/万级/十万级/普通/SPF级/普通级等）")
    area: float = Field(default=100, gt=0, description="面积(㎡)")
    countertop_type: str = Field(default="边台", description="台面类型（边台/中央台/仪器台/天平台）")


class FinishConfigResult(BaseModel):
    lab_type: str
    matched_key: str = ""
    matched: str = "exact"
    name: str = ""
    industry: str = ""
    clean_level: str = ""
    available_clean_levels: list = []
    standards: list = []
    env: dict = {}
    area_m2: float
    countertop_type: str = "边台"
    config: dict
    special_notes: list = []
    cost_estimate: dict = {}
