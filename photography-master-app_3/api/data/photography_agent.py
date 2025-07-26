#!/usr/bin/env python3
"""
手机摄影指导Agent
结合OpenCV精确水平检测和视觉理解的优势
"""

import json
import base64
import os
import hashlib
from typing import Dict, List
from PIL import Image
import cv2
import numpy as np
import math
from config import Config
from openai import OpenAI

class PhotographyAgent:
    def __init__(self, knowledge_file: str = "extracted_photography_knowledge.json"):
        Config.validate_config()
        self.model_name = Config.MODEL_NAME
        self.client = OpenAI(
            base_url=Config.OPENROUTER_BASE_URL,
            api_key=Config.OPENROUTER_API_KEY,
        )
        
        # 添加缓存机制
        self.cache = {}
        self.cache_file = "ai_cache.json"
        self.load_cache()
        
        # 添加消息历史记录
        self.message_history = []
        self.max_history_length = 10  # 保持最近10条消息
        
        # 添加会话状态管理
        self.session_started = False
        self.user_photography_intent = None  # 用户想拍摄的内容
        
        # 无需加载额外检测器
        
        # 加载知识库
        self.extracted_knowledge = self.load_extracted_knowledge(knowledge_file)
        print(f"已加载 {len(self.extracted_knowledge)} 个精简知识点")
    
    def load_cache(self):
        """加载缓存"""
        try:
            if os.path.exists(self.cache_file):
                with open(self.cache_file, 'r', encoding='utf-8') as f:
                    self.cache = json.load(f)
                print(f"已加载 {len(self.cache)} 条缓存记录")
        except Exception as e:
            print(f"缓存加载失败: {e}")
            self.cache = {}
    
    def save_cache(self):
        """保存缓存"""
        try:
            # 只保留最近100条缓存
            if len(self.cache) > 100:
                # 删除最旧的缓存
                oldest_keys = sorted(self.cache.keys(), key=lambda k: self.cache[k].get('timestamp', 0))[:len(self.cache) - 100]
                for key in oldest_keys:
                    del self.cache[key]
            
            with open(self.cache_file, 'w', encoding='utf-8') as f:
                json.dump(self.cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"缓存保存失败: {e}")
    
    def get_cache_key(self, image_path: str, analysis: dict) -> str:
        """生成缓存键"""
        try:
            # 基于图片文件大小和修改时间生成键
            stat = os.stat(image_path)
            key_data = f"{stat.st_size}_{stat.st_mtime}_{analysis.get('brightness', 0):.1f}_{analysis.get('is_level', True)}"
            return hashlib.md5(key_data.encode()).hexdigest()
        except:
            return hashlib.md5(image_path.encode()).hexdigest()
    
    def get_cached_result(self, cache_key: str):
        """获取缓存结果"""
        if cache_key in self.cache:
            cached_data = self.cache[cache_key]
            # 检查缓存是否过期（24小时）
            import time
            if time.time() - cached_data.get('timestamp', 0) < 86400:
                print(f"使用缓存结果")
                return cached_data.get('result')
        return None
    
    def set_cached_result(self, cache_key: str, result):
        """设置缓存结果"""
        import time
        self.cache[cache_key] = {
            'result': result,
            'timestamp': time.time()
        }
    
    def add_to_message_history(self, role: str, content: str, image_data: str = None):
        """添加消息到历史记录"""
        message = {"role": role}
        
        if role == "user" and image_data:
            # 用户消息包含图片
            message["content"] = [
                {"type": "text", "text": content},
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
            ]
        else:
            # 普通文本消息
            message["content"] = content
        
        self.message_history.append(message)
        
        # 限制历史记录长度
        if len(self.message_history) > self.max_history_length:
            self.message_history = self.message_history[-self.max_history_length:]
        
        print(f"添加消息到历史 (角色: {role}, 历史长度: {len(self.message_history)})")
    
    def clear_message_history(self):
        """清空消息历史记录"""
        self.message_history = []
        self.session_started = False
        self.user_photography_intent = None
        print("已清空消息历史记录和会话状态")
    
    def get_message_history_summary(self):
        """获取消息历史记录摘要"""
        return {
            "total_messages": len(self.message_history),
            "messages_preview": [
                {
                    "role": msg["role"],
                    "has_image": isinstance(msg.get("content"), list) and any(
                        item.get("type") == "image_url" for item in msg.get("content", [])
                    ),
                    "text_preview": (
                        msg["content"][:50] + "..." if isinstance(msg["content"], str) and len(msg["content"]) > 50
                        else (
                            msg["content"][0]["text"][:50] + "..." if isinstance(msg.get("content"), list) and len(msg["content"]) > 0 and "text" in msg["content"][0] and len(msg["content"][0]["text"]) > 50
                            else (
                                msg["content"][0]["text"] if isinstance(msg.get("content"), list) and len(msg["content"]) > 0 and "text" in msg["content"][0]
                                else msg["content"] if isinstance(msg["content"], str)
                                else "No text content"
                            )
                        )
                    )
                }
                for msg in self.message_history[-5:]  # 显示最后5条消息
            ]
        }
    
    def start_conversation(self):
        """开始新的拍摄会话"""
        if not self.session_started:
            self.session_started = True
            self.clear_message_history()
            
            # 添加初始对话
            greeting_message = """你好！我是你的AI摄影助手 📸

在开始拍摄之前，请告诉我：你想拍摄什么内容呢？

比如：
🌅 风景照片（日出、山景、海景等）
👤 人像照片（朋友、家人、自拍等）  
🍕 美食照片（餐厅菜品、家常菜等）
🏗️ 建筑照片（古建筑、现代建筑等）
🌸 花草照片（公园、花园等）
🐱 宠物照片
📚 产品照片（物品展示等）

或者其他任何你想拍的内容！了解你的拍摄意图后，我可以提供更精准的构图和拍摄建议。"""

            self.add_to_message_history("assistant", greeting_message)
            print("已开始新的拍摄会话")
            return greeting_message
        else:
            return "会话已经开始，可以直接告诉我你想拍摄什么！"
    
    def set_photography_intent(self, intent: str):
        """设置用户的拍摄意图"""
        self.user_photography_intent = intent
        self.add_to_message_history("user", f"我想拍摄：{intent}")
        
        # AI确认并提供预期指导
        confirmation_message = f"""很好！我了解你想拍摄 **{intent}** 📸

现在请把相机对准你想拍的场景，我会实时分析画面并提供专业的拍摄建议，包括：
• 构图调整
• 角度优化  
• 位置移动
• 光线利用

开始拍摄吧！我会根据你的拍摄意图给出最合适的建议。"""

        self.add_to_message_history("assistant", confirmation_message)
        print(f"用户拍摄意图已设置: {intent}")
        return confirmation_message
    
    def load_extracted_knowledge(self, knowledge_file: str) -> Dict[str, str]:
        """加载预处理的精简知识库"""
        try:
            # 尝试多个可能的路径
            possible_paths = [
                knowledge_file,  # 当前目录
                os.path.join('..', knowledge_file),  # 父目录
                os.path.join(os.path.dirname(__file__), knowledge_file),  # agent文件同级目录
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    print(f"找到知识库文件: {path}")
                    with open(path, 'r', encoding='utf-8') as f:
                        knowledge = json.load(f)
                    return knowledge
            
            print(f"知识库文件不存在，尝试了以下路径:")
            for path in possible_paths:
                print(f"   - {path}")
            return {}
        except Exception as e:
            print(f"加载知识库失败: {e}")
            return {}
    
    def analyze_image(self, image_path):
        """分析图像：精确水平检测 + 基础信息"""
        try:
            # 读取图片
            image = cv2.imread(image_path)
            if image is None:
                return {'error': '无法读取图片'}
            
            height, width = image.shape[:2]
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # 基础信息
            brightness = np.mean(gray)
            
            # 🔧 精确的水平检测
            level_info = self._detect_horizon_level_precise(gray, width, height)
            
            return {
                'width': int(width),  # 确保是Python int
                'height': int(height),  # 确保是Python int
                'brightness': float(round(brightness, 1)),  # 确保是Python float
                'brightness_level': str(self._categorize_brightness(brightness)),  # 确保是Python str
                
                # 精确的水平检测结果
                'is_level': level_info['is_level'],
                'tilt_angle': level_info['tilt_angle'],
                'tilt_direction': level_info['tilt_direction'],
                'level_confidence': level_info['confidence']
            }
            
        except Exception as e:
            return {'error': f'图片分析失败: {str(e)}'}
    
    def _detect_horizon_level_precise(self, gray_image, width, height):
        """精确的水平检测（OpenCV算法）"""
        try:
            # 边缘检测
            edges = cv2.Canny(gray_image, 50, 150, apertureSize=3)
            
            # 霍夫线变换
            lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=min(width, height)//4)
            
            if lines is None:
                return {'is_level': True, 'tilt_angle': 0, 'tilt_direction': 'level', 'confidence': 0.3}
            
            # 收集水平线角度
            horizontal_angles = []
            for line in lines:
                rho, theta = line[0]
                angle_deg = math.degrees(theta)
                
                # 只考虑接近水平的线条
                if angle_deg < 30 or angle_deg > 150:
                    if angle_deg > 150:
                        angle_deg = angle_deg - 180
                    horizontal_angles.append(angle_deg)
            
            if not horizontal_angles:
                return {'is_level': True, 'tilt_angle': 0, 'tilt_direction': 'level', 'confidence': 0.3}
            
            # 计算平均倾斜角度
            avg_angle = np.mean(horizontal_angles)
            tolerance = 2.0
            is_level = abs(avg_angle) <= tolerance
            
            # 确定倾斜方向
            if avg_angle > tolerance:
                direction = 'right_high'  # 右边高
            elif avg_angle < -tolerance:
                direction = 'left_high'   # 左边高
            else:
                direction = 'level'
            
            confidence = min(len(horizontal_angles) / 10.0, 1.0)
            
            return {
                'is_level': bool(is_level),  # 确保是Python bool
                'tilt_angle': float(round(abs(avg_angle), 1)),  # 确保是Python float
                'tilt_direction': str(direction),  # 确保是Python str
                'confidence': float(round(confidence, 2))  # 确保是Python float
            }
            
        except Exception as e:
            return {'is_level': True, 'tilt_angle': 0, 'tilt_direction': 'level', 'confidence': 0.1}
    

    def _categorize_brightness(self, brightness):
        """亮度分类"""
        if brightness < 50:
            return "昏暗"
        elif brightness < 120:
            return "适中"
        else:
            return "明亮"
    

    
    def get_guidance(self, image_path: str) -> str:
        """获取拍摄指导（返回JSON格式）"""
        try:
            # 分析图片
            analysis = self.analyze_image(image_path)
            
            if 'error' in analysis:
                return json.dumps({
                    "error": f"分析失败: {analysis['error']}",
                    "suggestions": []
                }, ensure_ascii=False, indent=2)
            
            # 🎯 双重水平检测策略
            opencv_detected_tilt = not analysis.get('is_level', True)
            tilt_angle = analysis.get('tilt_angle', 0)
            tilt_direction = analysis.get('tilt_direction', 'level')
            
            suggestions = []
            
            if opencv_detected_tilt:
                # 策略1: OpenCV检测到明显倾斜 - 优先级最高，直接使用
                print(f"OpenCV检测到倾斜({tilt_direction}, {tilt_angle}度) - 优先采用")
                
                # 添加水平校正建议
                level_suggestion = self._create_level_correction_suggestion(tilt_direction)
                suggestions.append(level_suggestion)
                
                # 其他建议由AI生成（不涉及水平）
                ai_suggestions = self._get_ai_suggestions_json(image_path, analysis)
                suggestions.extend(ai_suggestions[:4])  # 最多4条，总共5条
                
            else:
                # 策略2: OpenCV认为水平 - 让AI二次检查
                print(f"OpenCV认为水平，AI二次检查中...")
                ai_level_result = self._ai_check_level_only(image_path, analysis)
                
                if not ai_level_result['is_level']:
                    # AI检测到倾斜 - 第一条手势校正 + 4条其他建议
                    print(f"AI检测到倾斜({ai_level_result['direction']}) - 采用AI结果")
                    
                    # 添加水平校正建议
                    level_suggestion = self._create_level_correction_suggestion(ai_level_result['direction'])
                    suggestions.append(level_suggestion)
                    
                    # 其他建议由AI生成（不涉及水平）
                    ai_suggestions = self._get_ai_suggestions_json(image_path, analysis)
                    suggestions.extend(ai_suggestions[:4])  # 最多4条，总共5条
                else:
                    # AI确认水平 - 5条不涉及水平的建议
                    print(f"AI确认画面水平")
                    ai_suggestions = self._get_ai_suggestions_json(image_path, analysis)
                    suggestions = ai_suggestions[:5]
            
            # 确保每个建议都有正确的step编号
            for i, suggestion in enumerate(suggestions):
                suggestion['step'] = i + 1
            
            # 返回JSON格式（转换numpy类型为Python原生类型）
            result = {
                "suggestions": suggestions[:5],  # 确保最多5条建议
                "analysis": {
                    "is_level": bool(analysis.get('is_level', True)),  # 确保是Python bool
                    "tilt_angle": float(analysis.get('tilt_angle', 0)),  # 确保是Python float
                    "brightness": str(analysis.get('brightness_level', 'N/A'))  # 确保是Python str
                }
            }
            
            return json.dumps(result, ensure_ascii=False, indent=2)
            
        except Exception as e:
            return json.dumps({
                "error": f"处理失败: {str(e)}",
                "suggestions": []
            }, ensure_ascii=False, indent=2)
    
    def _get_ai_suggestions_excluding_level(self, image_path: str, analysis: Dict) -> List[str]:
        """获取AI建议，但明确排除水平相关的建议"""
        try:
            # 处理图片大小
            processed_image_path = self.resize_image_if_needed(image_path)
            
            # 编码图片
            image_base64 = self.encode_image_to_base64(processed_image_path)
            
            # 创建prompt（明确排除水平问题）
            prompt = self._create_non_level_prompt(analysis)
            
            # 调用AI模型
            ai_response = self.call_minimax_api(prompt, image_base64)
            
            if ai_response:
                # 解析AI响应，提取建议
                lines = ai_response.strip().split('\n')
                suggestions = []
                for line in lines:
                    line = line.strip()
                    if line and any(line.startswith(str(i)+'.') for i in range(1, 6)):
                        # 移除编号
                        suggestion = line.split('.', 1)[1].strip() if '.' in line else line
                        suggestions.append(suggestion)
                return suggestions
            else:
                return self._get_fallback_non_level_suggestions(analysis)
                
        except Exception as e:
            print(f"获取AI建议失败: {e}")
            return self._get_fallback_non_level_suggestions(analysis)
    
    def _get_ai_suggestions_with_level_check(self, image_path: str, analysis: Dict) -> List[str]:
        """AI建议（包含水平二次检查）"""
        try:
            # 处理图片大小
            processed_image_path = self.resize_image_if_needed(image_path)
            
            # 编码图片
            image_base64 = self.encode_image_to_base64(processed_image_path)
            
            # 创建包含水平检查的prompt
            prompt = self._create_level_check_prompt(analysis)
            
            # 调用AI模型
            ai_response = self.call_minimax_api(prompt, image_base64)
            
            if ai_response:
                # 解析AI响应，提取建议
                lines = ai_response.strip().split('\n')
                suggestions = []
                for line in lines:
                    line = line.strip()
                    if line and any(line.startswith(str(i)+'.') for i in range(1, 6)):
                        # 移除编号
                        suggestion = line.split('.', 1)[1].strip() if '.' in line else line
                        suggestions.append(suggestion)
                return suggestions
            else:
                return self._get_fallback_with_level_check(analysis)
                
        except Exception as e:
            print(f"获取AI建议失败: {e}")
            return self._get_fallback_with_level_check(analysis)
    
    def _create_non_level_prompt(self, analysis: Dict) -> str:
        """创建不涉及水平问题的prompt（注入摄影知识）"""
        brightness = analysis['brightness_level']
        
        # 注入相关的摄影知识
        knowledge_context = self._get_relevant_knowledge()
        
        # 添加用户拍摄意图上下文
        intent_context = ""
        intent_requirement = ""
        if self.user_photography_intent:
            intent_context = f"""
用户拍摄意图: {self.user_photography_intent}
请根据用户想拍摄的内容类型，提供针对性的专业建议。考虑该拍摄主题的特殊要求和最佳实践。"""
            intent_requirement = f"""

🎯 CRITICAL: 用户要拍摄{self.user_photography_intent}！你必须基于这个具体目标分析画面并提供专业建议：

拍摄{self.user_photography_intent}的专业要求：
"""

            # Add specific requirements based on photography type
            if "人像" in self.user_photography_intent or "肖像" in self.user_photography_intent:
                intent_requirement += """
- 人物要占据画面主要位置，背景要简洁
- 相机高度应与眼部平齐或略低（显得亲切自然）
- 避开背景中的干扰元素（电线杆、垃圾桶等）
- 寻找柔和的光线，避免强烈阴影
- 建议动作必须针对人像构图优化！"""

            elif "风景" in self.user_photography_intent or "景观" in self.user_photography_intent:
                intent_requirement += """
- 地平线要水平，天空与地面比例要合理
- 寻找前景、中景、背景的层次感
- 包含引导线条或有趣的前景元素
- 考虑黄金分割构图原则
- 建议动作必须针对风景构图优化！"""

            elif "美食" in self.user_photography_intent or "食物" in self.user_photography_intent:
                intent_requirement += f"""
- 采用45度俯拍角度，展现食物的立体感和层次
- 避免手机阴影遮挡食物
- 靠近拍摄突出食物质感和细节
- 简化背景，让食物成为唯一焦点
- 寻找均匀自然光，避免闪光灯

🔥 每个action必须包含"食物"或"美食"字样！强制模板：
- "蹲下45度俯拍，让食物更有立体感"
- "往[方向]移动避开阴影，让食物光线更好"
- "靠近[距离]突出食物的[特征]细节"
- "调整角度让食物占据画面[比例]"""

            elif "建筑" in self.user_photography_intent:
                intent_requirement += """
- 寻找对称构图，让建筑线条垂直
- 后退寻找完整建筑轮廓，避免透视变形
- 利用引导线条增强建筑的气势
- 考虑仰拍或俯拍展现建筑特色
- 建议动作必须针对建筑摄影优化！"""

            else:
                intent_requirement += f"""
- 针对{self.user_photography_intent}的特殊拍摄需求
- 考虑这类拍摄的最佳角度、构图和光线
- 突出{self.user_photography_intent}的特点和美感
- 建议动作必须与拍摄目标相关！"""

            intent_requirement += f"""

❌ 禁止使用这些泛泛建议：
- "调整拍摄角度，寻找最佳构图位置" 
- "调整拍摄高度，尝试不同视角"
- "调整焦距，突出主体元素"
- "微调位置，平衡画面元素"
- "优化构图布局"

✅ 必须使用针对{self.user_photography_intent}的具体建议：
- "蹲下采用45度俯拍角度，让食物显得更有立体感和层次"
- "往左移动避开手机阴影，让食物光线更均匀"
- "靠近2步突出食物质感和细节"

🚨 如果你给出泛泛建议，就是失败！"""
        else:
            intent_requirement = """

🎯 用户还没有指定拍摄对象，请提供通用的摄影改进建议。"""

        prompt = f"""🚨 WARNING: 用户要拍摄 {self.user_photography_intent if self.user_photography_intent else '照片'}！

你必须分析画面并基于拍摄目标给出具体建议。绝对禁止泛泛而谈！

技术参数: 光线{brightness}, 尺寸{analysis.get('width', 'N/A')}x{analysis.get('height', 'N/A')}{intent_context}{intent_requirement}

核心知识: {knowledge_context[:200]}...

输出JSON格式:
```json
{{
  "suggestions": [
    {{
      "step": 1,
      "action": "具体动作",
      "direction": "方向",
      "intensity": 强度1-5,
      "reason": "原因"
    }}
  ]
}}
```

方向标准: up/down/left/right/left_up/left_down/right_up/right_down
强度: 1(轻微)-3(大幅)

```json
{{
  "suggestions": [
    {{
      "step": 1,
      "action": "具体的动作描述",
      "direction": "移动方向",
      "intensity": 强度等级数字,
      "reason": "选择这个方向的简单原因"
    }},
    {{
      "step": 2,
      "action": "具体的动作描述", 
      "direction": "移动方向",
      "intensity": 强度等级数字,
      "reason": "选择这个方向的简单原因"
    }},
    {{
      "step": 3,
      "action": "具体的动作描述",
      "direction": "移动方向",
      "intensity": 强度等级数字,
      "reason": "选择这个方向的简单原因"
    }}
  ]
}}
```

=== 方向标准（重要：统一坐标系） ===
⚠️ 方向定义：以拍照者的视角为准，面对拍摄场景时：
- "left" = 拍照者的左手边（画面左侧）
- "right" = 拍照者的右手边（画面右侧）  
- "up" = 向上移动/站高/举高手机
- "down" = 向下移动/蹲下/降低手机

direction字段必须是以下8个标准方向之一：
- "up" (向上/站高/举高手机)
- "down" (向下/蹲下/降低手机)  
- "left" (往拍照者左手边移动)
- "right" (往拍照者右手边移动)
- "left_up" (往左上方移动)
- "left_down" (往左下方移动)
- "right_up" (往右上方移动)
- "right_down" (往右下方移动)

🎯 判断方向时请基于画面内容：
- 如果想拍到画面左侧更多内容 → "left"
- 如果想拍到画面右侧更多内容 → "right"
- 避免主体被左边物体遮挡 → "right" 
- 避免主体被右边物体遮挡 → "left"

=== 强度等级 ===
intensity字段必须是1-5的整数，表示动作幅度：
- 1: 轻微调整 (稍微、一点点)
- 2: 小幅调整 (一点、1步)
- 3: 中等调整 (2-3步、适中距离)
- 4: 较大调整 (4-5步、较大幅度)
- 5: 大幅调整 (很多步、大幅度移动)

=== 内容要求 ===
- 不要涉及画面水平问题（其他系统会处理）
- 基于专业摄影知识，但用最简单的话表达
- action要具体描述："往左走2步找到更好角度"、"蹲下来从低角度拍摄"
- 用大白话："放大"/"缩小"（不说焦距）
- 每个action要实用且易执行
- 🚨 CRITICAL: 每个建议必须针对用户的拍摄目标，不能是通用建议！
- 🚨 根据拍摄对象提供专业的构图、角度、光线建议！

⚠️ 方向判断关键原则：
- 仔细观察画面内容和构图需求
- 基于"拍照者视角"给出移动方向
- 如果画面右侧有更好的景色，建议"right"（往右移动）
- 如果画面左侧有更好的景色，建议"left"（往左移动）
- 如果主体被左侧物体遮挡，建议"right"（往右移动避开遮挡）
- 方向要与实际改善画面的逻辑一致
- 在reason字段中简单说明为什么选择这个方向（如："避开遮挡"、"包含更多景色"、"改善构图"）

只返回JSON格式，不要其他内容。"""
        return prompt
    
    def _get_relevant_knowledge(self) -> str:
        """获取相关的摄影知识点"""
        if not self.extracted_knowledge:
            return "暂无专业知识库支持"
        
        # 选择一些通用的、有指导价值的知识点
        relevant_keys = [
            key for key in self.extracted_knowledge.keys() 
            if any(keyword in key for keyword in [
                '构图', '光线', '角度', '人像', '风景', '色彩', '技巧', 
                '拍摄', '摄影', '视角', '背景', '前景', '对比', '层次'
            ])
        ]
        
        # 随机选择3-5个相关知识点
        import random
        selected_keys = random.sample(relevant_keys, min(5, len(relevant_keys))) if relevant_keys else list(self.extracted_knowledge.keys())[:5]
        
        knowledge_text = ""
        for key in selected_keys:
            knowledge_text += f"• {self.extracted_knowledge[key]}\n"
        
        return knowledge_text.strip() if knowledge_text else "使用基础摄影原理指导"
    
    def _ai_check_level_only(self, image_path: str, analysis: Dict) -> Dict:
        """AI专门检查水平状态，只返回True/False和方向"""
        try:
            prompt = self._create_level_check_only_prompt(analysis)
            
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user", 
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                            }
                        ]
                    }
                ],
                max_tokens=10,  # 只需要一个词，大幅减少token消耗
                temperature=0.1  # 降低随机性，确保回答稳定一致
            )
            
            result = response.choices[0].message.content.strip().lower()
            print(f"AI水平检测原始回答: '{result}'")
            
            # 优化的解析逻辑 - 更精确的关键词匹配
            if any(keyword in result for keyword in ['水平', '平稳', '平', 'level', '正常', '不倾斜']):
                print("AI判断: 画面水平")
                return {'is_level': True, 'direction': 'level'}
            elif any(keyword in result for keyword in ['左边高', '左高', '左倾', '左侧高', 'left_high', '左边']):
                print("AI判断: 左边高，建议右手抬起")
                return {'is_level': False, 'direction': 'left_high'}
            elif any(keyword in result for keyword in ['右边高', '右高', '右倾', '右侧高', 'right_high', '右边']):
                print("AI判断: 右边高，建议左手抬起")
                return {'is_level': False, 'direction': 'right_high'}
            else:
                print(f"⚠️ AI回答格式异常，默认判断为轻微倾斜: '{result}'")
                # 默认认为有轻微倾斜，交由用户判断
                return {'is_level': False, 'direction': 'unknown'}
                
        except Exception as e:
            print(f"AI水平检测失败: {e}")
            return {'is_level': True, 'direction': 'level'}  # 默认认为水平
    
    def _create_level_check_only_prompt(self, analysis: Dict) -> str:
        """创建专门用于水平检查的prompt（基于专业摄影知识）"""
        
        # 获取水平检测相关的专业知识
        level_knowledge = self._get_level_detection_knowledge()
        
        prompt = f"""你是专业的摄影技术分析师，需要基于专业知识快速准确判断照片水平状态。

=== 专业知识基础 ===
你是一个专业的摄影师，你要通过照片的全局来判断这个图片的水平与否，可以参考一些知识：{level_knowledge}

=== 水平检测专业方法 ===
1. **参考线法**：想象画面上有九宫格辅助线，检查水平参考线是否与画面边缘平行
2. **对称性检查**：观察画面左右两侧的视觉重量是否平衡，倾斜会破坏对称感
3. **边缘对比法**：重点关注画面顶部和底部边缘线，忽略物体本身的倾斜
4. **视觉重心法**：检查画面的视觉重心是否稳定，不向某一侧倾斜

=== 当前图片数据 ===
- 图片尺寸: {analysis.get('width', 'N/A')} x {analysis.get('height', 'N/A')}

=== 判断任务 ===
运用上述专业方法，重点检查：
• 画面整体的水平基准线（不是物体）
• 画面的视觉平衡感和稳定性
• 左右两侧是否存在明显的高度差异

请严格按照以下格式回答（只能是这三个词之一）：
• "水平" - 画面整体平稳，无明显倾斜
• "左边高" - 画面左侧相对较高，需要右手抬起校正  
• "右边高" - 画面右侧相对较高，需要左手抬起校正

只回答一个词，不要任何解释。"""
        return prompt
    
    def _get_level_detection_knowledge(self) -> str:
        """获取水平检测相关的专业知识"""
        if not self.extracted_knowledge:
            return "基于摄影构图和视觉平衡原理"
        
        # 选择与水平、构图、视觉平衡相关的知识点
        relevant_keys = [
            key for key in self.extracted_knowledge.keys() 
            if any(keyword in key for keyword in [
                '水平', '构图', '稳定', '平衡', '对称', '辅助线', '参考线',
                '视觉', '倾斜', '横平竖直', '视角', '重心'
            ])
        ]
        
        # 优先选择最相关的知识点
        priority_keywords = ['水平', '辅助线', '对称', '稳定', '构图']
        selected_keys = []
        
        for keyword in priority_keywords:
            for key in relevant_keys:
                if keyword in key and key not in selected_keys:
                    selected_keys.append(key)
                    if len(selected_keys) >= 4:  # 限制数量保持prompt简洁
                        break
            if len(selected_keys) >= 4:
                break
        
        # 如果还不够，添加其他相关知识
        if len(selected_keys) < 4:
            for key in relevant_keys:
                if key not in selected_keys:
                    selected_keys.append(key)
                    if len(selected_keys) >= 4:
                        break
        
        knowledge_text = ""
        for key in selected_keys:
            knowledge_text += f"• {self.extracted_knowledge[key]}\n"
        
        return knowledge_text.strip() if knowledge_text else "• 水平拍摄避免歪斜，提升画面稳定性\n• 参考线帮助判断画面是否横平竖直\n• 对称构图不会出现左右倾斜问题\n• 视觉平衡感是判断水平的重要依据"

    def _create_level_check_prompt(self, analysis: Dict) -> str:
        """创建包含水平二次检查的prompt"""
        brightness = analysis['brightness_level']

        prompt = f"""你是手机拍照教练，用最简单的话教用户拍照。

当前光线: {brightness}

仪器显示照片基本是平的，但请你再仔细看看照片，检查是不是真的平。

请给出5个简单易懂的拍照建议：

1. [简单动作]
2. [简单动作]
3. [简单动作]
4. [简单动作]
5. [简单动作]

要求：
- 先看照片是不是真的平，如果歪了：
  * 如果左边高，说"右手抬起来"
  * 如果右边高，说"左手抬起来"
- 用最简单的话，像教小朋友一样
- 说具体方向："往左走2步"、"往右走1步"、"蹲下来"、"站高一点"
- 不要说"焦距"，要说"放大"或"缩小"
- 不要说专业词汇，要说大白话

只返回5条简单指令，不要其他内容。"""
        return prompt
    
    def _get_fallback_non_level_suggestions(self, analysis: Dict) -> List[str]:
        """生成不涉及水平的后备建议"""
        suggestions = [
            "往左边或往右边走2步",
            "蹲下来一点，或者站高一点",
            "手机稍微往上抬，或者往下压一点",
            "拿稳手机，深呼吸再拍"
        ]
        
        # 根据光线调整
        if analysis['brightness_level'] == '昏暗':
            suggestions[3] = "走到亮一点的地方"
        
        return suggestions
    
    def _get_fallback_with_level_check(self, analysis: Dict) -> List[str]:
        """生成包含水平检查的后备建议"""
        suggestions = [
            "看看屏幕，照片是不是拍歪了",
            "往左边或往右边走2步",
            "蹲下来一点，或者站高一点",
            "拿稳手机，深呼吸再拍",
            "看看光线好不好，走到亮一点的地方"
        ]
        
        # 根据光线调整
        if analysis['brightness_level'] == '昏暗':
            suggestions[4] = "太暗了，走到亮一点的地方"
        
        return suggestions
    
    def resize_image_if_needed(self, image_path: str) -> str:
        """如果需要，调整图片大小"""
        try:
            with Image.open(image_path) as img:
                # 更激进的压缩策略
                max_size = (1280, 720)  # 降低分辨率以加快传输
                if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
                    img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    resized_path = f"temp_resized_{os.path.basename(image_path)}"
                    img.save(resized_path, quality=75, optimize=True)  # 降低质量以减小文件大小
                    return resized_path
                return image_path
        except Exception:
            return image_path
    
    def encode_image_to_base64(self, image_path: str) -> str:
        """将图片编码为base64"""
        try:
            with open(image_path, 'rb') as f:
                return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            raise Exception(f"图片编码失败: {e}")
    
    def call_minimax_api(self, prompt: str, image_base64: str) -> str:
        """调用Minimax API"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"}
                            }
                        ]
                    }
                ],
                max_tokens=Config.MAX_TOKENS,
                temperature=Config.TEMPERATURE,
                extra_headers={
                    "HTTP-Referer": Config.SITE_URL,
                    "X-Title": Config.SITE_NAME,
                }
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            print(f"API调用异常: {e}")
            return None
    
    def _create_level_correction_suggestion(self, tilt_direction: str) -> dict:
        """创建水平校正建议"""
        if tilt_direction == 'right_high':
            return {
                "step": 1,
                "action": "左手抬高一点，把手机拿平，照片拍歪了",
                "direction": "left_up",
                "intensity": 2,
                "reason": "校正右边高的倾斜"
            }
        elif tilt_direction == 'left_high':
            return {
                "step": 1,
                "action": "右手抬高一点，把手机拿平，照片拍歪了", 
                "direction": "right_up",
                "intensity": 2,
                "reason": "校正左边高的倾斜"
            }
        else:
            return {
                "step": 1,
                "action": "调整手机角度，让画面保持水平",
                "direction": "up",
                "intensity": 2,
                "reason": "保持画面水平"
            }
    
    def _get_ai_suggestions_json(self, image_path: str, analysis: dict) -> list:
        """获取AI建议并解析为JSON格式"""
        try:
            # 检查缓存
            cache_key = self.get_cache_key(image_path, analysis)
            cached_result = self.get_cached_result(cache_key)
            if cached_result:
                return cached_result
            
            prompt = self._create_non_level_prompt(analysis)
            
            with open(image_path, 'rb') as f:
                image_data = f.read()
            
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
            # 构建包含历史记录的消息数组
            messages = self.message_history.copy()  # 复制历史消息
            
            # 🚨 Add explicit system message for context
            if self.user_photography_intent:
                system_message = {
                    "role": "system", 
                    "content": f"你是专业摄影师。用户正在拍摄{self.user_photography_intent}。你的任务是分析画面并给出4个具体的、针对{self.user_photography_intent}的专业建议。绝对禁止给出通用建议。每个建议必须明确说明为什么这个动作对拍摄{self.user_photography_intent}有帮助。"
                }
                messages.append(system_message)
            
            # 添加当前用户消息
            current_message = {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                    }
                ]
            }
            messages.append(current_message)
            
            print(f"使用消息历史: {len(self.message_history)} 条历史消息 + 1 条新消息")
            
            # 🐛 DEBUG: Print full prompt being sent to LLM
            print("=" * 80)
            print("🤖 FULL PROMPT SENT TO LLM:")
            print("=" * 80)
            print(prompt)
            print("=" * 80)
            if self.user_photography_intent:
                print(f"📸 USER PHOTOGRAPHY INTENT: {self.user_photography_intent}")
                print("=" * 80)
            
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                max_tokens=350,  # 减少token数量
                temperature=0.7,  # 提高创造性
                timeout=10  # 减少超时时间
            )
            
            response_text = response.choices[0].message.content.strip()
            print(f"🤖 AI原始响应: {response_text[:200]}...")
            
            # 🐛 DEBUG: Print full LLM response
            print("=" * 80)
            print("🤖 FULL LLM RESPONSE:")
            print("=" * 80)
            print(response_text)
            print("=" * 80)
            
            # 🐛 DEBUG: Check if user intent is referenced in response
            if self.user_photography_intent and response_text:
                intent_mentioned = self.user_photography_intent in response_text
                print(f"🎯 USER INTENT REFERENCED IN RESPONSE: {intent_mentioned}")
                if not intent_mentioned:
                    print(f"⚠️  WARNING: User intent '{self.user_photography_intent}' NOT found in LLM response!")
                print("=" * 80)
            
            # 尝试解析JSON
            try:
                # 提取JSON部分（可能包含```json```标记）
                json_text = self._extract_json_from_response(response_text)
                ai_data = json.loads(json_text)
                
                if 'suggestions' in ai_data and isinstance(ai_data['suggestions'], list):
                    # 验证和标准化方向和强度
                    validated_suggestions = []
                    for suggestion in ai_data['suggestions']:
                        if isinstance(suggestion, dict) and 'action' in suggestion and 'direction' in suggestion:
                            validated_direction = self._validate_direction(suggestion['direction'])
                            validated_intensity = self._validate_intensity(suggestion.get('intensity', 3))
                            validated_suggestions.append({
                                "step": suggestion.get('step', len(validated_suggestions) + 1),
                                "action": suggestion['action'],
                                "direction": validated_direction,
                                "intensity": validated_intensity,
                                "reason": suggestion.get('reason', '改善画面效果')
                            })
                    
                    # 🐛 DEBUG: Validate each suggestion references user intent
                    if self.user_photography_intent:
                        print("=" * 80)
                        print("🔍 VALIDATING SUGGESTIONS REFERENCE USER INTENT:")
                        print("=" * 80)
                        for i, suggestion in enumerate(validated_suggestions, 1):
                            action_has_intent = self.user_photography_intent in suggestion.get('action', '')
                            reason_has_intent = self.user_photography_intent in suggestion.get('reason', '')
                            has_intent = action_has_intent or reason_has_intent
                            
                            print(f"建议 {i}:")
                            print(f"  Action: {suggestion.get('action', 'N/A')}")
                            print(f"  Reason: {suggestion.get('reason', 'N/A')}")
                            print(f"  🎯 References '{self.user_photography_intent}': {has_intent}")
                            if not has_intent:
                                print(f"  ⚠️  WARNING: Suggestion {i} does NOT reference user intent!")
                            print()
                        print("=" * 80)
                    
                    # 添加消息到历史记录
                    self.add_to_message_history("user", prompt, base64_image)
                    self.add_to_message_history("assistant", response_text)
                    
                    # 缓存结果
                    self.set_cached_result(cache_key, validated_suggestions)
                    return validated_suggestions
                
            except json.JSONDecodeError as e:
                print(f"⚠️ JSON解析失败: {e}")
                print(f"原始响应: {response_text}")
                
                # 检查是否是AI拒绝响应
                if "sorry" in response_text.lower() or "can't help" in response_text.lower():
                    print("🤖 AI拒绝了请求，使用默认建议")
                    fallback_result = self._get_fallback_suggestions()
                else:
                    # 降级处理：尝试从文本中提取建议
                    fallback_result = self._parse_text_to_suggestions(response_text)
                
                # 添加消息到历史记录（即使解析失败）
                self.add_to_message_history("user", prompt, base64_image)
                self.add_to_message_history("assistant", response_text)
                
                self.set_cached_result(cache_key, fallback_result)
                return fallback_result
                
        except Exception as e:
            print(f"❌ AI建议获取失败: {e}")
            
            # 如果是网络错误，尝试重试一次
            if "timeout" in str(e).lower() or "connection" in str(e).lower():
                print("🔄 检测到网络问题，尝试重试...")
                try:
                    response = self.client.chat.completions.create(
                        model=self.model_name,
                        messages=[
                            {
                                "role": "user",
                                "content": [
                                    {"type": "text", "text": prompt},
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                                    }
                                ]
                            }
                        ],
                        max_tokens=600,
                        temperature=0.7,
                        timeout=20  # 增加超时时间
                    )
                    
                    response_text = response.choices[0].message.content.strip()
                    print(f"🤖 重试成功，AI原始响应: {response_text[:200]}...")
                    
                    # 尝试解析JSON
                    try:
                        json_text = self._extract_json_from_response(response_text)
                        ai_data = json.loads(json_text)
                        
                        if 'suggestions' in ai_data and isinstance(ai_data['suggestions'], list):
                            validated_suggestions = []
                            for suggestion in ai_data['suggestions']:
                                if isinstance(suggestion, dict) and 'action' in suggestion and 'direction' in suggestion:
                                    validated_suggestions.append({
                                        "step": suggestion.get('step', len(validated_suggestions) + 1),
                                        "action": suggestion['action'],
                                        "direction": self._validate_direction(suggestion['direction']),
                                        "intensity": self._validate_intensity(suggestion.get('intensity', 3)),
                                        "reason": suggestion.get('reason', '基于画面分析')
                                    })
                            
                            if validated_suggestions:
                                # 添加消息到历史记录（重试成功）
                                self.add_to_message_history("user", prompt, base64_image)
                                self.add_to_message_history("assistant", response_text)
                                
                                self.set_cached_result(cache_key, validated_suggestions)
                                return validated_suggestions
                    except:
                        pass
                except Exception as retry_error:
                    print(f"❌ 重试也失败了: {retry_error}")
        
        # 返回默认建议
        fallback_result = self._get_fallback_suggestions()
        self.set_cached_result(cache_key, fallback_result)
        return fallback_result
    
    def _extract_json_from_response(self, response_text: str) -> str:
        """从AI响应中提取JSON部分"""
        # 移除```json```标记
        if '```json' in response_text:
            start = response_text.find('```json') + 7
            end = response_text.find('```', start)
            if end != -1:
                return response_text[start:end].strip()
        elif '```' in response_text:
            start = response_text.find('```') + 3
            end = response_text.find('```', start)
            if end != -1:
                return response_text[start:end].strip()
        
        # 尝试找到JSON对象
        start = response_text.find('{')
        end = response_text.rfind('}')
        if start != -1 and end != -1 and end > start:
            return response_text[start:end+1]
        
        return response_text.strip()
    
    def _validate_direction(self, direction: str) -> str:
        """验证并标准化方向"""
        valid_directions = ['up', 'down', 'left', 'right', 'left_up', 'left_down', 'right_up', 'right_down']
        
        direction = direction.lower().strip()
        
        if direction in valid_directions:
            return direction
        
        # 映射一些常见的错误格式
        direction_mapping = {
            'upward': 'up', 'upwards': 'up', '上': 'up', '向上': 'up',
            'downward': 'down', 'downwards': 'down', '下': 'down', '向下': 'down',
            'leftward': 'left', 'leftwards': 'left', '左': 'left', '向左': 'left',
            'rightward': 'right', 'rightwards': 'right', '右': 'right', '向右': 'right',
            'left-up': 'left_up', 'leftup': 'left_up', '左上': 'left_up',
            'left-down': 'left_down', 'leftdown': 'left_down', '左下': 'left_down',
            'right-up': 'right_up', 'rightup': 'right_up', '右上': 'right_up',
            'right-down': 'right_down', 'rightdown': 'right_down'
        }
        
        return direction_mapping.get(direction, 'up')  # 默认返回'up'
    
    def _validate_intensity(self, intensity) -> int:
        """验证并标准化强度值"""
        try:
            intensity_val = int(intensity)
            # 确保在1-5范围内
            if 1 <= intensity_val <= 5:
                return intensity_val
            else:
                return 3  # 默认中等强度
        except (ValueError, TypeError):
            return 3  # 默认中等强度
    
    def _parse_text_to_suggestions(self, text: str) -> list:
        """将文本格式的建议转换为JSON格式（降级处理）"""
        suggestions = []
        lines = text.split('\n')
        
        for i, line in enumerate(lines):
            line = line.strip()
            if line and (line[0].isdigit() or '.' in line[:3]):
                # 提取动作描述
                action = line
                if '. ' in action:
                    action = action.split('. ', 1)[1]
                
                # 简单的方向推断
                direction = 'up'  # 默认方向
                if any(word in action.lower() for word in ['左', 'left', '往左']):
                    direction = 'left'
                elif any(word in action.lower() for word in ['右', 'right', '往右']):
                    direction = 'right'
                elif any(word in action.lower() for word in ['蹲', 'down', '降低', '向下']):
                    direction = 'down'
                elif any(word in action.lower() for word in ['站', 'up', '举高', '向上']):
                    direction = 'up'
                
                # 简单的强度推断
                intensity = 3  # 默认中等强度
                action_lower = action.lower()
                if any(word in action_lower for word in ['稍微', '一点点', '轻微']):
                    intensity = 1
                elif any(word in action_lower for word in ['一点', '1步', '小幅']):
                    intensity = 2
                elif any(word in action_lower for word in ['2步', '3步', '几步']):
                    intensity = 3
                elif any(word in action_lower for word in ['4步', '5步', '较大', '多']):
                    intensity = 4
                elif any(word in action_lower for word in ['很多', '大幅', '大量', '很大']):
                    intensity = 5
                
                suggestions.append({
                    "step": len(suggestions) + 1,
                    "action": action,
                    "direction": direction,
                    "intensity": intensity,
                    "reason": "基于动作描述推断"
                })
                
                if len(suggestions) >= 4:  # 最多4条建议
                    break
        
        return suggestions
    
    def _get_fallback_suggestions(self) -> list:
        """获取默认建议（当AI失败时）"""
        return [
            {
                "step": 1,
                "action": "调整拍摄角度，寻找最佳构图位置",
                "direction": "left",
                "intensity": 3,
                "reason": "优化构图布局"
            },
            {
                "step": 2,
                "action": "调整拍摄高度，尝试不同视角",
                "direction": "down",
                "intensity": 2,
                "reason": "增加画面层次感"
            },
            {
                "step": 3,
                "action": "调整焦距，突出主体元素",
                "direction": "up",
                "intensity": 2,
                "reason": "增强主体表现力"
            },
            {
                "step": 4,
                "action": "微调位置，平衡画面元素",
                "direction": "right",
                "intensity": 2,
                "reason": "完善整体构图"
            }
        ]

def main():
    """测试摄影agent"""
    import sys
    
    # 解析命令行参数
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
    else:
        image_path = "test.jpg"  # 默认图片
    
    print("🎯 手机摄影Agent演示")
    print("特点: OpenCV精确水平检测 + AI视觉理解")
    print("="*60)
    
    agent = PhotographyAgent()
    
    if os.path.exists(image_path):
        print(f"\n📸 分析测试图片: {image_path}")
        guidance = agent.get_guidance(image_path)
        print(f"\n💡 拍摄建议:")
        print(guidance)
        
        print(f"\n🔧 技术说明:")
        analysis = agent.analyze_image(image_path)
        if not analysis.get('is_level', True):
            tilt_direction = analysis.get('tilt_direction', 'level')
            tilt_angle = analysis.get('tilt_angle', 0)
            print(f"- OpenCV检测: {tilt_direction}（{tilt_angle}度）")
            if tilt_direction == 'left_high':
                print("- 正确指令: 右手抬起来（左边高需要抬右手）")
            elif tilt_direction == 'right_high':
                print("- 正确指令: 左手抬起来（右边高需要抬左手）")
        else:
            print("- OpenCV认为基本水平，AI进行二次检查")
    else:
        print(f"❌ 测试图片 {image_path} 不存在")
        print(f"💡 使用方法: python photography_agent.py [图片路径]")
        print(f"💡 示例: python photography_agent.py my_photo.jpg")

if __name__ == "__main__":
    main() 