#!/usr/bin/env python3
"""
摄影指导 API 测试脚本
测试API的各项功能
"""

import requests
import json
import sys
from PIL import Image
import io

def test_health_check():
    """测试健康检查接口"""
    try:
        response = requests.get('http://localhost:5002/api/health')
        if response.status_code == 200:
            data = response.json()
            print(f"健康检查成功: {data['message']}")
            return True
        else:
            print(f"健康检查失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"健康检查异常: {e}")
        return False

def test_image_analysis():
    """测试图片分析接口"""
    # 创建一个测试图片
    img = Image.new('RGB', (100, 100), color='red')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG')
    img_buffer.seek(0)
    
    print("测试图片创建成功")
    
    # 测试JSON格式
    try:
        response = requests.post(
            'http://localhost:5002/api/analyze',
            files={'image': ('test.jpg', img_buffer.getvalue(), 'image/jpeg')}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("JSON分析成功")
            print(f"处理时间: {data.get('processing_time', 'N/A')}秒")
            return True
        else:
            print(f"JSON分析失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"JSON分析异常: {e}")
        return False

def test_formdata_analysis():
    """测试FormData格式的图片分析"""
    # 重新创建测试图片
    img = Image.new('RGB', (100, 100), color='blue')
    img_buffer = io.BytesIO()
    img.save(img_buffer, format='JPEG')
    img_buffer.seek(0)
    
    try:
        response = requests.post(
            'http://localhost:5002/api/analyze',
            files={'image': ('test.jpg', img_buffer.getvalue(), 'image/jpeg')}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("FormData分析成功")
            print(f"处理时间: {data.get('processing_time', 'N/A')}秒")
            return True
        else:
            print(f"FormData分析失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"FormData分析异常: {e}")
        return False

def test_error_handling():
    """测试错误处理"""
    # 测试无效JSON
    try:
        response = requests.post(
            'http://localhost:5002/api/analyze',
            data='invalid json',
            headers={'Content-Type': 'application/json'}
        )
        if response.status_code == 400:
            print("无效JSON错误处理正确")
            return True
        else:
            print(f"无效JSON测试失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"无效JSON测试异常: {e}")
        return False
    
    # 测试无效图片数据
    try:
        response = requests.post(
            'http://localhost:5002/api/analyze',
            files={'image': ('test.txt', b'invalid image data', 'text/plain')}
        )
        if response.status_code == 400:
            print("无效图片数据错误处理正确")
            return True
        else:
            print(f"无效图片数据测试失败: {response.status_code}")
            return False
    except Exception as e:
        print(f"无效图片数据测试异常: {e}")
        return False

def main():
    """主测试函数"""
    print("摄影指导 API 测试")
    print("=" * 50)
    
    # 检查API服务器是否运行
    if not test_health_check():
        print("\nAPI服务器未运行或无法访问")
        print("请先启动API服务器: python api_server.py")
        return 1
    
    tests = [
        ("健康检查", test_health_check),
        ("图片分析(JSON)", test_image_analysis),
        ("图片分析(FormData)", test_formdata_analysis),
        ("错误处理", test_error_handling)
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"\n--- 测试: {test_name} ---")
        try:
            if test_func():
                passed += 1
        except Exception as e:
            print(f"{test_name}测试异常: {e}")
    
    print(f"\n测试结果: {passed}/{total} 通过")
    
    if passed == total:
        print("所有测试通过!")
        return 0
    else:
        print("部分测试失败")
        return 1

if __name__ == "__main__":
    sys.exit(main()) 