"""calc_engine HTTP 端点端到端测试（修正版）。

用 Python urllib 调用所有路由，避免 PowerShell 中文乱码问题。
所有 payload 严格按 app/schemas/ 下 Pydantic 模型构造。
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request
import urllib.error
import uuid
from typing import Any

BASE = "http://127.0.0.1:8100"

# Disable proxy (sandbox may set HTTP_PROXY which breaks localhost)
_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

results: list[dict[str, Any]] = []


def call(method: str, path: str, body: Any = None) -> tuple[int, Any, str]:
    url = BASE + path
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with _opener.open(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
            return resp.status, parsed, ""
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed, f"HTTPError: {e}"
    except Exception as e:
        return 0, None, f"{type(e).__name__}: {e}"


def call_multipart(path: str, field_name: str, filename: str, content: bytes) -> tuple[int, Any, str]:
    """Upload a file via multipart/form-data."""
    boundary = uuid.uuid4().hex
    lines = []
    lines.append(f"--{boundary}".encode())
    lines.append(f'Content-Disposition: form-data; name="{field_name}"; filename="{filename}"'.encode())
    lines.append(b"Content-Type: application/dxf")
    lines.append(b"")
    lines.append(content)
    lines.append(f"--{boundary}--".encode())
    lines.append(b"")
    body = b"\r\n".join(lines)
    req = urllib.request.Request(
        BASE + path,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with _opener.open(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
            return resp.status, parsed, ""
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            parsed = raw
        return e.code, parsed, f"HTTPError: {e}"
    except Exception as e:
        return 0, None, f"{type(e).__name__}: {e}"


def record(name: str, method: str, path: str, status: int, ok: bool, detail: str):
    results.append({
        "name": name, "method": method, "path": path,
        "status": status, "ok": ok, "detail": detail,
    })
    flag = "PASS" if ok else "FAIL"
    print(f"[{flag}] {method:4} {path:40} -> {status}  {detail}")


def get_data(body: Any) -> dict:
    """Extract .data from CalculationResult wrapper."""
    if isinstance(body, dict):
        return body.get("data", {}) or {}
    return {}


# ---------- 1. health ----------
st, body, err = call("GET", "/health")
ok = st == 200 and isinstance(body, dict) and body.get("status") == "ok"
record("健康检查", "GET", "/health", st, ok,
       f"engine={body.get('engine') if isinstance(body,dict) else body} db={body.get('database_configured') if isinstance(body,dict) else '?'}")

# ---------- 2. modules ----------
st, body, err = call("GET", "/api/v1/modules")
mods = body if isinstance(body, list) else []
ok = st == 200 and len(mods) >= 9
record("模块清单", "GET", "/api/v1/modules", st, ok, f"模块数={len(mods)}")

# ---------- 3. process/calculate (BSL-2) ----------
payload = {
    "lab_type": "bsl2",
    "personnel_count": 6,
    "room_function": "culture_room",
    "equipment": [
        {"name": "生物安全柜", "length_m": 1.5, "width_m": 0.8, "count": 2},
        {"name": "培养箱", "length_m": 0.6, "width_m": 0.6, "count": 3},
    ],
}
st, body, err = call("POST", "/api/v1/process/calculate", payload)
data = get_data(body)
zones = data.get("zones", {}).get("zones") if isinstance(data, dict) else None
ok = st == 200 and isinstance(data, dict) and "zones" in data
record("工艺规划(BSL-2)", "POST", "/api/v1/process/calculate", st, ok,
       f"功能区数={len(zones) if isinstance(zones,list) else 'n/a'}")

# ---------- 4. hvac/calculate V2 (BSL-2) ----------
payload = {
    "area": 60,
    "height": 2.8,
    "lab_type": "bsl2",
    "room_function": "biological_lab",
    "fume_hood_count": 2,
    "exhaust_gas_type": "biological",
    "equipment_heat_load_w": 5000,
    "personnel_count": 6,
    "lighting_power_w": 1000,
    "summer_outdoor_temp_c": 34,
    "indoor_summer_temp_c": 24,
}
st, body, err = call("POST", "/api/v1/hvac/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "load" in data
cool_w = data.get("load", {}).get("total_cooling_load_w") if isinstance(data, dict) else None
record("暖通V2(BSL-2)", "POST", "/api/v1/hvac/calculate", st, ok,
       f"冷负荷={cool_w}W" if cool_w else f"err={err}")

# ---------- 5. electrical/calculate ----------
payload = {
    "equipment": [
        {"name": "通风柜排风机", "power_kw": 15, "voltage_v": 380, "phase": "3-phase", "load_type": "power"},
        {"name": "空调机组", "power_kw": 20, "voltage_v": 380, "phase": "3-phase", "load_type": "hvac"},
        {"name": "照明", "power_kw": 5, "voltage_v": 220, "phase": "1-phase", "load_type": "lighting"},
    ],
    "installation_method": "bridge",
    "temperature": 30,
    "transformer_kva": 1000,
    "uk_percent": 6,
    "distance_m": 50,
    "breaker_capacity_ka": 35,
}
st, body, err = call("POST", "/api/v1/electrical/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "load" in data
pjs = data.get("load", {}).get("pjs_kw") if isinstance(data, dict) else None
record("电气计算", "POST", "/api/v1/electrical/calculate", st, ok,
       f"有功计算负荷={pjs}kW" if pjs else f"err={err}")

# ---------- 6. decoration/calculate ----------
payload = {
    "rooms": [
        {"name": "化学实验室", "area": 96, "height_m": 2.8, "room_type": "chemical_lab", "door_count": 2, "window_count": 0, "has_cleanroom": False, "has_anti_static": False},
        {"name": "缓冲间", "area": 12, "height_m": 2.8, "room_type": "corridor", "door_count": 2, "window_count": 0},
    ],
}
st, body, err = call("POST", "/api/v1/decoration/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "rooms" in data
rooms_n = len(data.get("rooms", [])) if isinstance(data, dict) else "n/a"
cost = data.get("summary", {}).get("total_cost_yuan") if isinstance(data, dict) else None
record("装修工程量", "POST", "/api/v1/decoration/calculate", st, ok,
       f"房间数={rooms_n} 总造价={cost}")

# ---------- 7. calc/hvac V1 ----------
payload = {
    "length_m": 6,
    "width_m": 5,
    "height_m": 3,
    "lab_type": "chemistry",
    "devices": [{"type": "fume_hood", "count": 2, "face_velocity": 0.5, "sash_area": 1.0}],
    "supply_ratio": 0.85,
    "summer_outdoor_temp_c": 34,
    "indoor_summer_temp_c": 24,
    "outdoor_enthalpy_kjkg": 90,
    "indoor_enthalpy_kjkg": 52,
    "equipment_power_kw": 10,
    "occupants": 4,
}
st, body, err = call("POST", "/api/v1/calc/hvac", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "exhaust" in data
exhaust = data.get("exhaust", {}).get("total_m3h") if isinstance(data, dict) else None
record("暖通V1", "POST", "/api/v1/calc/hvac", st, ok,
       f"排风量={exhaust}m³/h" if exhaust else f"err={err}")

# ---------- 8. calc/gas-supply ----------
payload = {
    "points": [
        {"gas": "N2", "count": 2, "peak_flow_lpm": 50, "avg_flow_lpm": 15},
        {"gas": "Ar", "count": 1, "peak_flow_lpm": 30, "avg_flow_lpm": 10},
    ],
    "purity": "high_purity",
    "operating_hours_per_day": 8,
    "delivery_pressure_bar": 0.8,
    "line_velocity_mps": 8,
    "line_length_m": 30,
}
st, body, err = call("POST", "/api/v1/calc/gas-supply", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "lines" in data
lines_n = len(data.get("lines", [])) if isinstance(data, dict) else "n/a"
pts = data.get("total_points") if isinstance(data, dict) else None
record("集中供气", "POST", "/api/v1/calc/gas-supply", st, ok,
       f"气路数={lines_n} 用气点={pts}")

# ---------- 9. materials/gases ----------
st, body, err = call("GET", "/api/v1/materials/gases")
gases = body if isinstance(body, list) else []
ok = st == 200 and len(gases) > 0
record("气体特性库", "GET", "/api/v1/materials/gases", st, ok, f"气体数={len(gases)}")

# ---------- 10. materials/gas-pipe ----------
st, body, err = call("GET", "/api/v1/materials/gas-pipe?gas=N2&purity=high_purity")
ok = st == 200 and isinstance(body, dict) and "pipe_material" in body
record("管材推荐", "GET", "/api/v1/materials/gas-pipe", st, ok,
       f"管材={body.get('pipe_material') if isinstance(body,dict) else body}")

# ---------- 11. materials/benches ----------
st, body, err = call("GET", "/api/v1/materials/benches")
benches = body if isinstance(body, list) else []
ok = st == 200 and len(benches) > 0
record("实验台库", "GET", "/api/v1/materials/benches", st, ok, f"台面数={len(benches)}")

# ---------- 12. materials/floorings ----------
st, body, err = call("GET", "/api/v1/materials/floorings")
floors = body if isinstance(body, list) else []
ok = st == 200 and len(floors) > 0
record("地坪库", "GET", "/api/v1/materials/floorings", st, ok, f"地坪数={len(floors)}")

# ---------- 13. materials/match (URL-encoded Chinese) ----------
grade_enc = urllib.parse.quote("耐酸碱")
st, body, err = call("GET", f"/api/v1/materials/match?grade={grade_enc}")
ok = st == 200 and isinstance(body, dict)
keys = list(body.keys()) if isinstance(body, dict) else body
record("跨专业匹配", "GET", "/api/v1/materials/match", st, ok, f"keys={keys}")

# ---------- 14. materials/fan-match ----------
st, body, err = call("GET", "/api/v1/materials/fan-match?acid_resistance=high")
ok = st == 200 and isinstance(body, dict)
record("风机材质匹配", "GET", "/api/v1/materials/fan-match", st, ok,
       f"材质={body.get('material') if isinstance(body,dict) else body}")

# ---------- 15. workflow/calculate-hvac (equipments list) ----------
payload = {
    "equipments": [
        {"name": "FUME_HOOD", "insert": [0.0, 0.0], "xscale": 1.0, "yscale": 1.0},
        {"name": "fume-hood", "insert": [5.0, 0.0], "xscale": 2.0, "yscale": 2.0},
    ],
}
st, body, err = call("POST", "/api/v1/workflow/calculate-hvac", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "fume_hoods" in data
hoods = data.get("fume_hoods", []) if isinstance(data, dict) else []
airflow = sum(h.get("airflow", 0) for h in hoods) if isinstance(hoods, list) else None
record("图纸联动暖通", "POST", "/api/v1/workflow/calculate-hvac", st, ok,
       f"通风柜数={len(hoods)} 总风量={airflow}")

# ---------- 16. drawing/parse (multipart file upload) ----------
# Minimal valid DXF (R12) with two INSERT blocks named FUME_HOOD
dxf_content = b"""0
SECTION
2
HEADER
0
ENDSEC
0
SECTION
2
TABLES
0
ENDSEC
0
SECTION
2
BLOCKS
0
BLOCK
8
0
2
FUME_HOOD
70
0
10
0.0
20
0.0
30
0.0
0
ENDBLK
0
ENDSEC
0
SECTION
2
ENTITIES
0
INSERT
8
0
2
FUME_HOOD
10
0.0
20
0.0
30
0.0
41
1.0
42
1.0
0
INSERT
8
0
2
fume-hood
10
5.0
20
0.0
30
0.0
41
2.0
42
2.0
0
ENDSEC
0
EOF
"""
st, body, err = call_multipart("/api/v1/drawing/parse", "file", "test.dxf", dxf_content)
data = body.get("data", {}) if isinstance(body, dict) else {}
ok = st == 200 and isinstance(data, dict)
equips = data.get("equipments", []) if isinstance(data, dict) else []
nb = len(equips) if isinstance(equips, list) else "n/a"
record("图纸解析", "POST", "/api/v1/drawing/parse", st, ok,
       f"图块数={nb}" + (f" err={err}" if err else ""))

# ---------- 17. plumbing/calculate ----------
payload = {
    "equipment": [
        {"name": "洗手盆", "drainage_l_s": 0.5, "drainage_type": "waste"},
        {"name": "通风柜排水", "drainage_l_s": 1.0, "drainage_type": "acid"},
        {"name": "紧急喷淋", "drainage_l_s": 1.5, "drainage_type": "waste"},
    ],
    "velocity_min": 0.6,
    "velocity_max": 2.5,
}
st, body, err = call("POST", "/api/v1/plumbing/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "flow" in data
flow = data.get("flow", {}).get("total_l_s") if isinstance(data, dict) else None
record("给排水计算", "POST", "/api/v1/plumbing/calculate", st, ok,
       f"总排水流量={flow}L/s" if flow else f"err={err}")

# ---------- 18. weak-current/calculate ----------
payload = {
    "area": 80,
    "room_type": "lab",
    "workstation_count": 8,
    "equipment_count": 4,
    "door_count": 2,
    "corridor_length": 20,
    "hvac_zones": 2,
    "lightning_class": "II",
}
st, body, err = call("POST", "/api/v1/weak-current/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "info_points" in data
pts_total = data.get("info_points", {}).get("total_with_redundancy") if isinstance(data, dict) else None
record("弱电智能化", "POST", "/api/v1/weak-current/calculate", st, ok,
       f"信息点(含冗余)={pts_total}" if pts_total else f"err={err}")

# ---------- 19. intelligence/calculate ----------
payload = {
    "rooms": [
        {"name": "化学实验室", "function": "lab", "lab_type": "chemical", "area": 80, "count": 1},
        {"name": "办公区", "function": "office", "area": 40, "count": 1},
    ],
    "distribution_boxes": 2,
    "water_inlets": 2,
}
st, body, err = call("POST", "/api/v1/intelligence/calculate", payload)
data = get_data(body)
ok = st == 200 and isinstance(data, dict) and "items" in data
items_n = len(data.get("items", [])) if isinstance(data, dict) else "n/a"
record("智能化设计", "POST", "/api/v1/intelligence/calculate", st, ok,
       f"结果条目数={items_n}")

# ==================== 汇总 ====================
passed = sum(1 for r in results if r["ok"])
failed = sum(1 for r in results if not r["ok"])
print("\n" + "=" * 70)
print(f"HTTP 端点测试汇总: {passed} PASS / {failed} FAIL / {len(results)} TOTAL")
print("=" * 70)
if failed:
    print("\n失败明细:")
    for r in results:
        if not r["ok"]:
            print(f"  {r['method']} {r['path']} -> {r['status']}  {r['detail']}")
