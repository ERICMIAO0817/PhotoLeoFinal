#!/usr/bin/env python3
"""
摄影指导 API 服务器
提供图像分析和摄影建议服务
"""

import os
import sys
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import traceback
import speech_recognition as sr
from gtts import gTTS
import io
import base64

# 添加项目根目录和data目录到Python路径
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)
sys.path.append(os.path.join(current_dir, 'data'))

# 导入摄影代理
try:
    from data.photography_agent import PhotographyAgent
except ImportError:
    try:
        from photography_agent import PhotographyAgent
    except ImportError:
        print("无法导入摄影代理模块")
        sys.exit(1)

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 允许跨域访问

# 全局变量
photography_agent = None

def init_agent():
    """初始化摄影代理"""
    global photography_agent
    try:
        photography_agent = PhotographyAgent()
        return True
    except Exception as e:
        print(f"摄影代理初始化失败: {e}")
        traceback.print_exc()
        return False

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """
    图片分析API
    接收图片文件，返回摄影建议JSON
    """
    print("\n" + "="*60)
    print("NEW CAMERA FRAME ANALYSIS REQUEST")
    print("="*60)
    print(f"Time: {datetime.now().strftime('%H:%M:%S')}")
    print(f"Client IP: {request.remote_addr}")
    print(f"User Agent: {request.headers.get('User-Agent', 'Unknown')[:50]}...")
    
    try:
        # 检查代理是否可用
        if not photography_agent:
            print("ERROR: Photography agent not initialized")
            return jsonify({
                'status': 'error',
                'message': '摄影代理未初始化',
                'timestamp': datetime.now().isoformat()
            }), 500

        # 检查是否有文件上传
        if 'image' not in request.files:
            print("ERROR: No image file in request")
            return jsonify({
                'status': 'error',
                'message': '请上传图片文件',
                'timestamp': datetime.now().isoformat()
            }), 400

        file = request.files['image']
        print(f"File received: {file.filename}")
        print(f"File size: {len(file.read())//1024}KB")
        file.seek(0)  # Reset file pointer after reading size
        
        # 检查文件名
        if file.filename == '':
            print("ERROR: Empty filename")
            return jsonify({
                'status': 'error',
                'message': '未选择文件',
                'timestamp': datetime.now().isoformat()
            }), 400

        # 检查文件类型
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            print(f"ERROR: Unsupported file type: {file.filename}")
            return jsonify({
                'status': 'error',
                'message': '不支持的文件格式，请上传图片文件',
                'timestamp': datetime.now().isoformat()
            }), 400

        print("File validation passed - processing image...")
        
        # 保存临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            print(f"Saving to temporary file: {tmp_file.name}")
            file.save(tmp_file.name)
            
            try:
                print("Calling photography agent for analysis...")
                
                # DEBUG: Show current user intent context
                print("=" * 80)
                print("ANALYZING IMAGE WITH CURRENT CONTEXT:")
                if photography_agent.user_photography_intent:
                    print(f"User Photography Intent: '{photography_agent.user_photography_intent}'")
                    print("Will provide targeted suggestions based on user's stated goal")
                else:
                    print("No specific photography intent set - providing general suggestions")
                print("=" * 80)
                
                start_time = datetime.now()
                
                # 调用摄影代理分析图片
                guidance_json = photography_agent.get_guidance(tmp_file.name)
                
                # Parse the JSON string into a dictionary
                import json
                guidance = json.loads(guidance_json)
                
                end_time = datetime.now()
                processing_time = (end_time - start_time).total_seconds()
                
                print(f"Analysis completed in {processing_time:.2f} seconds")
                print(f"Generated {len(guidance.get('suggestions', []))} suggestions")
                print("Sending response to client...")
                
                # 获取消息历史摘要
                history_summary = photography_agent.get_message_history_summary()
                
                # 返回成功响应
                response = jsonify({
                    'status': 'success',
                    'data': guidance,
                    'message_history': history_summary,
                    'timestamp': datetime.now().isoformat(),
                    'filename': file.filename
                })
                
                print("SUCCESS: Response sent successfully!")
                print("-" * 60)
                return response
                
            finally:
                # 清理临时文件
                try:
                    os.unlink(tmp_file.name)
                    print("Temporary file cleaned up")
                except Exception as cleanup_error:
                    print(f"Warning: Could not clean up temporary file: {cleanup_error}")

    except Exception as e:
        print(f"API错误: {e}")
        traceback.print_exc()
        return jsonify({
            'status': 'error',
            'message': f'服务器内部错误: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    print(f"\nHEALTH CHECK - {datetime.now().strftime('%H:%M:%S')} - Client: {request.remote_addr}")
    agent_status = 'ready' if photography_agent else 'not_initialized'
    print(f"Agent Status: {agent_status}")
    
    return jsonify({
        'status': 'ok',
        'agent_status': agent_status,
        'timestamp': datetime.now().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/info', methods=['GET'])
def api_info():
    """API信息接口"""
    return jsonify({
        'name': '摄影指导API',
        'version': '1.0.0',
        'description': '提供图片分析和摄影建议的API服务',
        'endpoints': {
            '/api/analyze': {
                'method': 'POST',
                'description': '分析图片并返回摄影建议',
                'content_type': 'multipart/form-data',
                'parameters': {
                    'image': '图片文件 (支持: png, jpg, jpeg, gif, bmp, webp)'
                },
                'response': {
                    'status': 'success/error',
                    'data': '摄影建议JSON对象',
                    'timestamp': 'ISO格式时间戳',
                    'filename': '上传的文件名'
                }
            },
            '/api/health': {
                'method': 'GET',
                'description': '健康检查',
                'response': {
                    'status': 'ok',
                    'agent_status': 'ready/not_initialized',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/info': {
                'method': 'GET',
                'description': 'API信息和使用说明'
            },
            '/api/history': {
                'method': 'GET',
                'description': '获取消息历史记录摘要',
                'response': {
                    'status': 'success',
                    'data': '消息历史摘要对象',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/history/clear': {
                'method': 'POST',
                'description': '清空消息历史记录',
                'response': {
                    'status': 'success',
                    'message': '操作结果消息',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/conversation/start': {
                'method': 'POST',
                'description': '开始新的拍摄会话',
                'response': {
                    'status': 'success',
                    'message': '问候消息',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/conversation/intent': {
                'method': 'POST',
                'description': '设置用户拍摄意图',
                'content_type': 'application/json',
                'parameters': {
                    'intent': '用户想拍摄的内容描述'
                },
                'response': {
                    'status': 'success',
                    'message': '确认消息',
                    'intent': '设置的拍摄意图',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/voice/speech-to-text': {
                'method': 'POST',
                'description': '语音转文字',
                'content_type': 'multipart/form-data',
                'parameters': {
                    'audio': '音频文件 (WAV格式)'
                },
                'response': {
                    'status': 'success',
                    'text': '识别的文字内容',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/voice/text-to-speech': {
                'method': 'POST',
                'description': '文字转语音',
                'content_type': 'application/json',
                'parameters': {
                    'text': '要转换的文字内容'
                },
                'response': {
                    'status': 'success',
                    'audio_base64': 'Base64编码的音频数据',
                    'text': '原始文字',
                    'timestamp': 'ISO格式时间戳'
                }
            },
            '/api/voice/conversation': {
                'method': 'POST',
                'description': '完整语音对话流程（语音输入→AI处理→语音输出）',
                'content_type': 'multipart/form-data',
                'parameters': {
                    'audio': '音频文件 (WAV格式)'
                },
                'response': {
                    'status': 'success',
                    'user_text': '用户语音识别结果',
                    'response_text': 'AI回复文字',
                    'audio_base64': 'AI回复的语音数据',
                    'intent_set': '设置的拍摄意图',
                    'timestamp': 'ISO格式时间戳'
                }
            }
        },
        'usage_example': {
            'curl': "curl -X POST -F 'image=@your_photo.jpg' http://localhost:5002/api/analyze",
            'python': """
import requests

with open('your_photo.jpg', 'rb') as f:
    response = requests.post(
        'http://localhost:5002/api/analyze',
        files={'image': f}
    )
    result = response.json()
    print(result)
            """
        },
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/history', methods=['GET'])
def get_message_history():
    """获取消息历史记录"""
    if not photography_agent:
        return jsonify({
            'status': 'error',
            'message': '摄影代理未初始化',
            'timestamp': datetime.now().isoformat()
        }), 500
    
    history_summary = photography_agent.get_message_history_summary()
    return jsonify({
        'status': 'success',
        'data': history_summary,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/history/clear', methods=['POST'])
def clear_message_history():
    """清空消息历史记录"""
    if not photography_agent:
        return jsonify({
            'status': 'error',
            'message': '摄影代理未初始化',
            'timestamp': datetime.now().isoformat()
        }), 500
    
    photography_agent.clear_message_history()
    return jsonify({
        'status': 'success',
        'message': '消息历史已清空',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/conversation/start', methods=['POST'])
def start_conversation():
    """开始新的拍摄会话"""
    if not photography_agent:
        return jsonify({
            'status': 'error',
            'message': '摄影代理未初始化',
            'timestamp': datetime.now().isoformat()
        }), 500
    
    greeting_message = photography_agent.start_conversation()
    return jsonify({
        'status': 'success',
        'message': greeting_message,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/conversation/intent', methods=['POST'])
def set_photography_intent():
    """设置用户拍摄意图"""
    if not photography_agent:
        return jsonify({
            'status': 'error',
            'message': '摄影代理未初始化',
            'timestamp': datetime.now().isoformat()
        }), 500
    
    try:
        data = request.get_json()
        if not data or 'intent' not in data:
            return jsonify({
                'status': 'error',
                'message': '请提供拍摄意图',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        intent = data['intent'].strip()
        if not intent:
            return jsonify({
                'status': 'error',
                'message': '拍摄意图不能为空',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        # DEBUG: Log intent setting
        print("=" * 80)
        print("SETTING USER PHOTOGRAPHY INTENT:")
        print(f"User Input: '{intent}'")
        print("=" * 80)
        
        confirmation_message = photography_agent.set_photography_intent(intent)
        
        # DEBUG: Confirm intent was set
        print(f"Intent successfully set in agent: '{photography_agent.user_photography_intent}'")
        print("=" * 80)
        
        return jsonify({
            'status': 'success',
            'message': confirmation_message,
            'intent': intent,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"❌ 设置拍摄意图失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'设置拍摄意图失败: {str(e)}',
            'timestamp': datetime.now().isoformat()
                 }), 500

@app.route('/api/voice/speech-to-text', methods=['POST'])
def speech_to_text():
    """语音转文字"""
    if 'audio' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '请上传音频文件',
            'timestamp': datetime.now().isoformat()
        }), 400
    
    audio_file = request.files['audio']
    
    try:
        # 保存临时音频文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
            audio_file.save(tmp_audio.name)
            
            # 使用SpeechRecognition进行语音识别
            recognizer = sr.Recognizer()
            with sr.AudioFile(tmp_audio.name) as source:
                audio_data = recognizer.record(source)
                
            try:
                # 使用Google Speech Recognition (免费)
                text = recognizer.recognize_google(audio_data, language='zh-CN')
                
                # 清理临时文件
                os.unlink(tmp_audio.name)
                
                print(f"🎤 语音识别成功: {text}")
                
                return jsonify({
                    'status': 'success',
                    'text': text,
                    'timestamp': datetime.now().isoformat()
                })
                
            except sr.UnknownValueError:
                os.unlink(tmp_audio.name)
                return jsonify({
                    'status': 'error',
                    'message': '无法识别语音内容',
                    'timestamp': datetime.now().isoformat()
                }), 400
                
            except sr.RequestError as e:
                os.unlink(tmp_audio.name)
                return jsonify({
                    'status': 'error',
                    'message': f'语音识别服务出错: {str(e)}',
                    'timestamp': datetime.now().isoformat()
                }), 500
                
    except Exception as e:
        print(f"语音转文字失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'语音处理失败: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/voice/text-to-speech', methods=['POST'])
def text_to_speech():
    """文字转语音"""
    try:
        data = request.get_json()
        if not data or 'text' not in data:
            return jsonify({
                'status': 'error',
                'message': '请提供要转换的文字',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        text = data['text'].strip()
        if not text:
            return jsonify({
                'status': 'error',
                'message': '文字内容不能为空',
                'timestamp': datetime.now().isoformat()
            }), 400
        
        # 使用gTTS生成语音
        tts = gTTS(text=text, lang='zh', slow=False)
        
        # 创建内存中的音频文件
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        
        # 转换为base64以便JSON传输
        audio_base64 = base64.b64encode(audio_buffer.getvalue()).decode('utf-8')
        
        print(f"文字转语音成功: {text[:50]}...")
        
        return jsonify({
            'status': 'success',
            'audio_base64': audio_base64,
            'text': text,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"文字转语音失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'语音生成失败: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/voice/conversation', methods=['POST'])
def voice_conversation():
    """完整的语音对话流程"""
    if not photography_agent:
        return jsonify({
            'status': 'error',
            'message': '摄影代理未初始化',
            'timestamp': datetime.now().isoformat()
        }), 500
    
    if 'audio' not in request.files:
        return jsonify({
            'status': 'error',
            'message': '请上传音频文件',
            'timestamp': datetime.now().isoformat()
        }), 400
    
    audio_file = request.files['audio']
    
    try:
        # 步骤1: 语音转文字
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
            audio_file.save(tmp_audio.name)
            
            recognizer = sr.Recognizer()
            with sr.AudioFile(tmp_audio.name) as source:
                audio_data = recognizer.record(source)
            
            try:
                user_text = recognizer.recognize_google(audio_data, language='zh-CN')
                print(f"用户语音: {user_text}")
            except sr.UnknownValueError:
                os.unlink(tmp_audio.name)
                return jsonify({
                    'status': 'error',
                    'message': '无法识别语音内容',
                    'timestamp': datetime.now().isoformat()
                }), 400
            except sr.RequestError as e:
                os.unlink(tmp_audio.name)
                return jsonify({
                    'status': 'error',
                    'message': f'语音识别服务出错: {str(e)}',
                    'timestamp': datetime.now().isoformat()
                }), 500
            
            os.unlink(tmp_audio.name)
        
        # 步骤2: 处理用户意图
        response_text = ""
        
        if not photography_agent.session_started:
            # 如果会话未开始，先开始会话
            photography_agent.start_conversation()
            response_text = f"收到您的话：{user_text}。让我为您设置拍摄意图。"
            photography_agent.set_photography_intent(user_text)
        else:
            # 设置拍摄意图
            response_text = photography_agent.set_photography_intent(user_text)
        
        # 步骤3: 文字转语音
        tts = gTTS(text=response_text, lang='zh', slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        audio_base64 = base64.b64encode(audio_buffer.getvalue()).decode('utf-8')
        
        print(f"系统回复: {response_text[:50]}...")
        
        return jsonify({
            'status': 'success',
            'user_text': user_text,
            'response_text': response_text,
            'audio_base64': audio_base64,
            'intent_set': photography_agent.user_photography_intent,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        print(f"语音对话失败: {e}")
        return jsonify({
            'status': 'error',
            'message': f'语音对话处理失败: {str(e)}',
            'timestamp': datetime.now().isoformat()
        }), 500

@app.errorhandler(413)
def request_entity_too_large(error):
    """处理文件过大错误"""
    return jsonify({
        'status': 'error',
        'message': '上传文件过大，请压缩后重试',
        'timestamp': datetime.now().isoformat()
    }), 413

@app.errorhandler(404)
def not_found(error):
    """处理404错误"""
    return jsonify({
        'status': 'error',
        'message': 'API接口不存在',
        'available_endpoints': ['/api/analyze', '/api/health', '/api/info'],
        'timestamp': datetime.now().isoformat()
    }), 404

if __name__ == '__main__':
    print("\n" + "="*70)
    print("PHOTOGRAPHY GUIDANCE API SERVER")
    print("="*70)
    print("Starting at:", datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    print("Initializing photography agent...")
    
    # 初始化摄影代理
    if not init_agent():
        print("FAILED: Unable to initialize photography agent")
        print("Please check your photography_agent.py file")
        sys.exit(1)
    
    print("SUCCESS: Photography agent initialized!")
    print("\nSERVER CONFIGURATION:")
    print("   Address: http://localhost:5002")
    print("   Image Analysis: POST /api/analyze")
    print("   Health Check: GET /api/health")
    print("   API Info: GET /api/info")
    print("   Max Upload Size: 16MB")
    
    print("\nUSAGE EXAMPLES:")
    print("   curl -X POST -F 'image=@photo.jpg' http://localhost:5002/api/analyze")
    print("   curl http://localhost:5002/api/health")
    
    print("\nREADY FOR LIVE CAMERA PROCESSING!")
    print("   Connect your photography app to start receiving frames")
    print("   Watch this terminal for incoming requests")
    print("="*70)
    print("SERVER STARTING...\n")
    
    # 设置文件上传限制 (16MB)
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
    
    # 启动服务器
    app.run(
        host='0.0.0.0',
        port=5002,
        debug=True,
        threaded=True
    )