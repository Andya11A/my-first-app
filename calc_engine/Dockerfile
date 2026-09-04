FROM python:3.11-slim

WORKDIR /app

# 依赖清单先复制，利用 Docker 层缓存
# 实际依赖为 FastAPI/SQLAlchemy/psycopg[binary]/ezdxf，均为纯 Python 或带预编译 wheel，无需 gcc/OCR 系统库
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 复制源码（.dockerignore 已排除 .env / 本地数据库 / 测试）
COPY . .

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
