"""全局配置 —— 通过环境变量 / .env 文件覆盖默认值。"""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Lab Design Calculation Engine"
    engine_version: str = "1.0.0"
    api_v1_prefix: str = "/api/v1"

    # PostgreSQL 连接串；留空则跳过"计算记录"持久化，计算功能不受影响
    # 示例: postgresql+psycopg://postgres:postgres@localhost:5432/lab_design
    database_url: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
