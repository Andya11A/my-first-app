"""实验室全流程设计管理平台 —— 后端计算引擎入口。

启动方式（在 calc_engine 目录下）:
    python -m uvicorn main:app --reload --port 8100

文档地址:
    http://localhost:8100/docs
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import router as api_v1_router
from app.config import get_settings
from app.database import Base, engine

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # 数据库已配置时自动建表（计算记录表）；未配置则跳过，不影响计算
    if engine is not None:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.engine_version,
    description="实验室全流程设计管理平台 · 专业计算引擎（暖通/电气/供气/装修/智能化）",
    lifespan=lifespan,
)

# 前端（Next.js 平台层）跨域调用
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router, prefix=settings.api_v1_prefix)


@app.get("/health", summary="健康检查")
def health() -> dict:
    return {
        "status": "ok",
        "engine": settings.app_name,
        "engine_version": settings.engine_version,
        "database_configured": engine is not None,
    }
