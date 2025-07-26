#!/usr/bin/env python3
"""
摄影指导 API 启动脚本
简化启动过程，自动处理配置和环境
"""

import os
import sys
import subprocess
import time

def check_python_version():
    """检查Python版本"""
    if sys.version_info < (3, 8):
        print("需要Python 3.8或更高版本")
        print(f"当前版本: {sys.version}")
        return False
    print(f"Python版本检查通过: {sys.version}")
    return True

def check_dependencies():
    """检查依赖是否安装"""
    required_imports = {
        'flask': 'flask',
        'flask-cors': 'flask_cors', 
        'openai': 'openai',
        'pillow': 'PIL',
        'opencv-python': 'cv2'
    }
    
    missing_packages = []
    for package_name, import_name in required_imports.items():
        try:
            __import__(import_name)
        except ImportError:
            missing_packages.append(package_name)
    
    if missing_packages:
        print(f"缺少依赖包: {', '.join(missing_packages)}")
        print("请运行: pip install -r requirements.txt")
        return False
    
    print("所有依赖包已安装")
    return True

def check_api_key():
    """检查API密钥"""
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print("未设置OPENAI_API_KEY环境变量")
        print("请设置您的OpenAI API密钥:")
        print("export OPENAI_API_KEY=your_api_key_here")
        print("或者在.env文件中设置")
        return False
    
    print("OpenAI API密钥已设置")
    return True

def create_env_template():
    """创建.env模板文件"""
    env_file = '.env'
    if not os.path.exists(env_file):
        with open(env_file, 'w') as f:
            f.write("""# OpenAI API配置
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=minimax-01

# 服务器配置
API_PORT=5002
API_HOST=0.0.0.0
""")
        print(f"已创建.env模板文件: {env_file}")
        print("请编辑此文件并设置您的API密钥")

def main():
    """主函数"""
    print("摄影指导 API 启动器")
    print("=" * 50)
    
    # 检查Python版本
    if not check_python_version():
        return 1
    
    # 检查依赖
    if not check_dependencies():
        return 1
    
    # 检查API密钥
    if not check_api_key():
        create_env_template()
        print("\n请设置API密钥后重新运行此脚本")
        return 1
    
    # 检查必要文件
    required_files = [
        'api_server.py',
        'data/config.py',
        'data/photography_agent.py',
        'extracted_photography_knowledge.json'
    ]
    
    for file in required_files:
        if not os.path.exists(file):
            print(f"缺少必要文件: {file}")
            return 1
    
    print("所有文件检查通过")
    
    # 启动API服务器
    print("\n启动API服务器...")
    print("服务将在 http://localhost:5002 启动")
    print("API文档: http://localhost:5002/api/health")
    print("按 Ctrl+C 停止服务")
    
    try:
        # 启动服务器
        os.system('python api_server.py')
    except KeyboardInterrupt:
        print("\n服务器已停止")
    except Exception as e:
        print(f"启动失败: {e}")
        return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 