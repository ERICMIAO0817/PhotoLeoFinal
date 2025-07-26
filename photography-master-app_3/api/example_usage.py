#!/usr/bin/env python3
"""
摄影智能引导 API 使用示例
展示如何调用API进行图片分析
"""

import requests
import json
import base64
from PIL import Image
import io

# API配置
API_BASE_URL = "http://localhost:5002"

def analyze_image_json(image_path, prompt="分析这张照片的构图和光线"):
    """
    使用JSON格式分析图片
    
    Args:
        image_path (str): 图片文件路径
        prompt (str): 分析提示词
    
    Returns:
        dict: API响应结果
    """
    # 读取图片并转换为base64
    with open(image_path, 'rb') as f:
        image_data = f.read()
    
    image_base64 = base64.b64encode(image_data).decode('utf-8')
    
    # 构建请求
    payload = {
        "image": f"data:image/jpeg;base64,{image_base64}",
        "prompt": prompt
    }
    
    # 发送请求
    response = requests.post(
        f"{API_BASE_URL}/api/analyze",
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=30
    )
    
    return response.json()

def analyze_image_formdata(image_path, prompt="分析这张照片的构图和光线"):
    """
    使用FormData格式分析图片
    
    Args:
        image_path (str): 图片文件路径
        prompt (str): 分析提示词
    
    Returns:
        dict: API响应结果
    """
    # 准备文件和数据
    with open(image_path, 'rb') as f:
        files = {
            'image': (image_path, f.read(), 'image/jpeg')
        }
    
    data = {
        'prompt': prompt
    }
    
    # 发送请求
    response = requests.post(
        f"{API_BASE_URL}/api/analyze",
        files=files,
        data=data,
        timeout=30
    )
    
    return response.json()

def print_analysis_result(result):
    """打印分析结果"""
    if result.get('status') == 'success':
        guidance = result.get('guidance', {})
        steps = guidance.get('steps', [])
        summary = guidance.get('summary', '')
        
        print("🎯 分析结果:")
        print(f"📝 总结: {summary}")
        print(f"📊 处理时间: {result.get('processing_time', 'N/A')}秒")
        print(f"🔢 建议步骤数: {len(steps)}")
        
        print("\n📋 详细建议:")
        for i, step in enumerate(steps, 1):
            print(f"  {i}. {step.get('action', '')}")
            print(f"     {step.get('description', '')}")
    else:
        print(f"❌ 分析失败: {result.get('message', '未知错误')}")

def main():
    """主函数 - 使用示例"""
    print("📸 摄影智能引导 API 使用示例")
    print("=" * 50)
    
    # 检查API是否运行
    try:
        health_response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
        if health_response.status_code != 200:
            print("❌ API服务器未运行")
            print("请先启动API服务器: python api_server.py")
            return
    except:
        print("❌ 无法连接到API服务器")
        print("请先启动API服务器: python api_server.py")
        return
    
    print("✅ API服务器运行正常")
    
    # 示例1: 使用JSON格式分析
    print("\n🔍 示例1: JSON格式分析")
    print("-" * 30)
    
    # 这里需要替换为实际的图片路径
    image_path = "your_photo.jpg"  # 请替换为实际图片路径
    
    if not os.path.exists(image_path):
        print(f"⚠️ 图片文件不存在: {image_path}")
        print("请将图片文件放在当前目录，并修改image_path变量")
        return
    
    try:
        result = analyze_image_json(image_path, "分析这张照片的构图、光线和色彩")
        print_analysis_result(result)
    except Exception as e:
        print(f"❌ JSON分析失败: {e}")
    
    # 示例2: 使用FormData格式分析
    print("\n🔍 示例2: FormData格式分析")
    print("-" * 30)
    
    try:
        result = analyze_image_formdata(image_path, "分析这张照片的构图、光线和色彩")
        print_analysis_result(result)
    except Exception as e:
        print(f"❌ FormData分析失败: {e}")
    
    # 示例3: 批量分析
    print("\n🔍 示例3: 批量分析")
    print("-" * 30)
    
    prompts = [
        "分析这张照片的构图",
        "分析这张照片的光线",
        "分析这张照片的色彩搭配"
    ]
    
    for i, prompt in enumerate(prompts, 1):
        print(f"\n📸 分析 {i}: {prompt}")
        try:
            result = analyze_image_json(image_path, prompt)
            if result.get('status') == 'success':
                guidance = result.get('guidance', {})
                summary = guidance.get('summary', '')
                print(f"  结果: {summary}")
            else:
                print(f"  失败: {result.get('message', '未知错误')}")
        except Exception as e:
            print(f"  异常: {e}")

if __name__ == "__main__":
    import os
    main() 