# PhotoLeo - 智能摄影助手

PhotoLeo 是一个多平台智能摄影助手项目，集成了AI图像分析、实时摄影指导和语音交互功能。

## 项目架构

### 核心组件

1. **Flutter 移动应用** (`photomaster/`)
   - 跨平台移动应用，支持iOS和Android
   - 实时相机预览和图像分析
   - 语音交互和TTS功能
   - 构图辅助线和摄影指导

2. **React Native Web应用** (`photography-master-app_3/`)
   - 基于Next.js的Web应用
   - 响应式设计，支持移动端和桌面端
   - 现代化UI组件库
   - 相机集成和图像处理

3. **Python API服务** (`photography-master-app_3/api/`)
   - Flask后端服务
   - AI图像分析接口
   - 语音识别和合成
   - 摄影知识库集成

4. **前端组件库** (`frontend/`)
   - 可复用的React组件
   - 实时相机分析功能

## 技术栈

### 移动端 (Flutter)
- Flutter 3.7+
- Camera插件
- HTTP客户端
- 语音识别和合成
- 图像处理

### Web端 (React Native)
- Next.js 15
- React Native Web
- Expo Camera
- Tailwind CSS
- Radix UI组件

### 后端 (Python)
- Flask
- 图像分析AI
- 语音处理
- CORS支持

## 主要功能

1. **实时摄影指导**
   - 构图辅助线显示
   - 光线分析
   - 场景识别
   - 拍摄建议

2. **AI图像分析**
   - 图像质量评估
   - 构图分析
   - 技术参数建议
   - 改进建议

3. **语音交互**
   - 语音指令识别
   - 语音反馈
   - 多语言支持

4. **多场景支持**
   - 人像摄影
   - 风景摄影
   - 美食摄影
   - 自定义场景

## 开发环境

### 移动端
```bash
cd photomaster
flutter pub get
flutter run
```

### Web端
```bash
cd photography-master-app_3
npm install
npm run dev
```

### API服务
```bash
cd photography-master-app_3/api
pip install -r requirements.txt
python api_server.py
```

## 项目结构

```
PhotoLeo/
├── photomaster/                 # Flutter移动应用
├── photography-master-app_3/    # React Native Web应用
│   ├── api/                    # Python后端服务
│   ├── app/                    # Next.js页面
│   └── components/             # React组件
├── frontend/                   # 前端组件库
└── agent/                      # 代理服务
```

## 许可证

MIT License