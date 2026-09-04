"""废气废水工艺链推荐API"""
from fastapi import APIRouter

from app.services.exhaust_process_chain import (
    recommend_exhaust_chain,
    TREATMENT_TECHNOLOGIES,
    POLLUTANT_TYPES,
)
from app.services.wastewater_process_chain import (
    recommend_wastewater_chain,
    TREATMENT_PROCESSES,
    WASTEWATER_TYPES,
)

router = APIRouter(prefix="/process-chain", tags=["process_chain"])


@router.get("/exhaust/{lab_type}", summary="废气处理工艺链推荐")
def get_exhaust_chain(lab_type: str):
    return recommend_exhaust_chain(lab_type)


@router.get("/wastewater/{lab_type}", summary="废水处理工艺链推荐")
def get_wastewater_chain(lab_type: str):
    return recommend_wastewater_chain(lab_type)


@router.get("/exhaust-technologies", summary="废气处理技术清单")
def get_exhaust_technologies():
    return TREATMENT_TECHNOLOGIES


@router.get("/wastewater-processes", summary="废水处理工艺清单")
def get_wastewater_processes():
    return TREATMENT_PROCESSES


@router.get("/pollutants", summary="废气污染物类型清单")
def get_pollutants():
    return POLLUTANT_TYPES


@router.get("/wastewater-types", summary="废水类型清单")
def get_wastewater_types():
    return WASTEWATER_TYPES
