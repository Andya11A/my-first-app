"""图纸解析 API 路由
====================

- POST /drawing/parse   上传 DXF 文件并解析为结构化 JSON

接口接收一个上传的 DXF 文件，调用 drawing_parser 进行处理，
返回包含 walls / doors / windows / equipments 的 JSON 结果，
供前端画布进行重绘。
"""
from __future__ import annotations

import os
import tempfile
from typing import Any, Dict

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.drawing_parser import parse_dxf_to_json

router = APIRouter(prefix="/drawing", tags=["图纸解析"])

# 允许的文件扩展名
ALLOWED_EXTENSIONS = {".dxf"}

# 最大文件大小 20MB（DXF 文本文件通常不大）
MAX_FILE_SIZE = 20 * 1024 * 1024


@router.post("/parse", summary="解析 DXF 图纸文件")
async def parse_drawing(file: UploadFile = File(..., description="DXF 图纸文件")) -> Dict[str, Any]:
    """上传 DXF 文件，提取墙体/门窗/设备图块信息。

    返回结构:
    ```json
    {
      "success": true,
      "data": {
        "walls": [...],
        "doors": [...],
        "windows": [...],
        "equipments": [...],
        "meta": { "entity_count": 123, "layers": [...], ... }
      }
    }
    ```
    """
    # 1) 文件名与扩展名校验
    file_name = file.filename or "upload.dxf"
    ext = os.path.splitext(file_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"仅支持 DXF 文件，收到 .{ext.lstrip('.')}",
        )

    # 2) 读取文件内容并校验大小
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"文件大小不能超过 {MAX_FILE_SIZE // 1024 // 1024}MB",
        )
    if not content:
        raise HTTPException(status_code=400, detail="文件内容为空")

    # 3) 写入临时文件（ezdxf 需要文件路径，不支持纯字节流读取）
    tmp_path = None
    try:
        # suffix 保持 .dxf，ezdxf 按扩展名判断格式
        with tempfile.NamedTemporaryFile(suffix=".dxf", delete=False, mode="wb") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        # 4) 调用解析引擎
        data = parse_dxf_to_json(tmp_path)

        # 5) 返回统一结构
        return {"success": True, "data": data}

    except HTTPException:
        raise
    except Exception as e:
        # 解析过程中的未预期错误
        raise HTTPException(status_code=500, detail=f"图纸解析失败: {e}")
    finally:
        # 清理临时文件
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass  # 清理失败不影响主流程
