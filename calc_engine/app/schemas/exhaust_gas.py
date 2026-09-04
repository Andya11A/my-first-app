"""废气处理Schema"""
from pydantic import BaseModel, Field


class ExhaustTreatmentInput(BaseModel):
    pollutant_type: str = Field(..., description="污染物类型：VOCs/HCl/H2SO4/HNO3/NH3/H2S/Cl2/SO2/NOx")
    inlet_concentration_mg_m3: float = Field(..., gt=0, description="进口浓度(mg/m³)")
    exhaust_flow_m3_h: float = Field(..., gt=0, description="废气量(m³/h)")
    treatment_technology: str = Field(..., description="处理技术：activated_carbon/wet_scrubber/uv_photolysis/plasma")


class ExhaustTreatmentResult(BaseModel):
    pollutant_type: str
    inlet_concentration_mg_m3: float
    treatment_technology: str
    removal_efficiency_pct: float
    outlet_concentration_mg_m3: float
    emission_limit_mg_m3: float
    is_compliant: bool
    annual_emission_kg: float
    formula: str


class CarbonLifetimeInput(BaseModel):
    pollutant_type: str = Field(default="VOCs", description="污染物类型")
    inlet_concentration_mg_m3: float = Field(..., gt=0, description="进口浓度(mg/m³)")
    exhaust_flow_m3_h: float = Field(..., gt=0, description="废气量(m³/h)")
    carbon_fill_kg: float = Field(default=500, gt=0, description="活性炭填充量(kg)")
    carbon_adsorption_capacity_pct: float = Field(default=0.15, gt=0, le=0.5, description="吸附容量")


class CarbonLifetimeResult(BaseModel):
    carbon_fill_kg: float
    total_adsorption_capacity_g: float
    hourly_adsorption_g: float
    lifetime_hours: float
    lifetime_days: float
    replacement_cycle: str
    formula: str
