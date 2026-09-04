"""废气废水自动匹配API"""
from fastapi import APIRouter

from app.services.auto_match_service import auto_match_all, auto_match_exhaust, auto_match_wastewater

router = APIRouter(prefix="/auto-match", tags=["auto_match"])


@router.get("/all/{lab_type}", summary="自动匹配废气+废水完整方案")
def match_all(lab_type: str):
    return auto_match_all(lab_type)


@router.get("/exhaust/{lab_type}", summary="自动匹配废气处理方案")
def match_exhaust(lab_type: str):
    return auto_match_exhaust(lab_type)


@router.get("/wastewater/{lab_type}", summary="自动匹配废水处理方案")
def match_wastewater(lab_type: str):
    return auto_match_wastewater(lab_type)
