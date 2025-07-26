# 摄影智能引导 API 服务

这是一个独立的摄影智能引导API服务，可以为团队提供图片分析功能。

## 功能特性

- 🖼️ 图片分析：上传图片获取摄影建议
- 🤖 AI驱动：基于OpenAI minimax-01模型
- 📚 知识库：包含802个摄影知识点
- ⚡ 高性能：支持缓存和优化
- 🔒 安全：支持多种图片格式

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

创建 `.env` 文件（可选）：

```bash
# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=minimax-01

# 服务器配置
API_PORT=5002
API_HOST=0.0.0.0
```

### 3. 启动服务

```bash
python api_server.py
```

服务将在 `http://localhost:5002` 启动

## API 接口

### 健康检查

```bash
GET /api/health
```

响应：
```json
{
  "status": "success",
  "message": "摄影智能引导API服务运行正常",
  "timestamp": "2024-01-01T12:00:00",
  "version": "1.0.0"
}
```

### 图片分析

```bash
POST /api/analyze
```

**请求格式：**

1. **JSON格式（Base64编码）**
```bash
curl -X POST http://localhost:5002/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
    "prompt": "分析这张照片的构图和光线"
  }'
```

2. **FormData格式（文件上传）**
```bash
curl -X POST http://localhost:5002/api/analyze \
  -F "image=@your_photo.jpg" \
  -F "prompt=分析这张照片的构图和光线"
```

**响应格式：**
```json
{
  "status": "success",
  "guidance": {
    "steps": [
      {
        "step": 1,
        "action": "调整构图",
        "description": "将主体放在三分线上，创造更好的视觉平衡"
      },
      {
        "step": 2,
        "action": "改善光线",
        "description": "利用自然光，避免阴影过重"
      }
    ],
    "summary": "整体构图良好，建议在光线方面进行优化"
  },
  "processing_time": 2.5,
  "timestamp": "2024-01-01T12:00:00"
}
```

## 支持的图片格式

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)
- GIF (.gif)

## 配置说明

### 服务器配置

在 `api_server.py` 中可以修改：

```python
# 服务器配置
API_PORT = 5002
API_HOST = "0.0.0.0"
DEBUG_MODE = True
```

### AI模型配置

在 `data/config.py` 中可以修改：

```python
# OpenAI配置
OPENAI_MODEL = "minimax-01"
MAX_TOKENS = 1000
TEMPERATURE = 0.7
```

## 错误处理

### 常见错误码

- `400`: 请求参数错误
- `413`: 图片文件过大
- `415`: 不支持的图片格式
- `500`: 服务器内部错误

### 错误响应格式

```json
{
  "status": "error",
  "message": "错误描述",
  "error_code": "ERROR_CODE"
}
```

## 性能优化

- **缓存机制**: 相同图片的分析结果会被缓存
- **图片压缩**: 自动压缩大图片以提高处理速度
- **并发处理**: 支持多个请求同时处理

## 日志

服务运行时会输出详细日志：

```
📚 找到知识库文件: extracted_photography_knowledge.json
✅ 已加载 802 个精简知识点
✅ 摄影代理初始化成功
🚀 API服务器启动中...
📡 监听地址: http://0.0.0.0:5002
🎯 API文档: http://localhost:5002/api/health
```

## 故障排除

### 1. 端口被占用

如果5002端口被占用，可以修改 `api_server.py` 中的端口号：

```python
API_PORT = 5003  # 改为其他端口
```

### 2. 依赖安装失败

确保使用Python 3.8+版本：

```bash
python --version
```

### 3. API密钥问题

确保设置了正确的OpenAI API密钥：

```bash
export OPENAI_API_KEY=your_api_key_here
```

## 开发说明

### 项目结构

```
photography_api/
├── api_server.py              # 主服务器文件
├── data/                      # 数据目录
│   ├── config.py             # 配置文件
│   ├── photography_agent.py  # AI代理
│   └── photography_knowledge.py # 知识库
├── extracted_photography_knowledge.json # 知识库数据
├── requirements.txt          # 依赖列表
└── README.md                # 说明文档
```

### 扩展功能

可以通过修改 `photography_agent.py` 来：

- 调整AI提示词
- 修改分析逻辑
- 添加新的分析维度

## 许可证

本项目仅供团队内部使用。

## 联系方式

如有问题，请联系开发团队。 