import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

class Config:
    # OpenRouter API 配置
    OPENROUTER_API_KEY = os.getenv('OPENROUTER_API_KEY')
    OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
    MODEL_NAME = "minimax/minimax-01"  # Minimax-01多模态模型
    
    # 网站信息（用于OpenRouter统计）
    SITE_URL = os.getenv('SITE_URL', 'https://your-app.com')
    SITE_NAME = os.getenv('SITE_NAME', 'Photography Guidance Agent')
    
    # 请求配置
    MAX_TOKENS = 300  # 进一步减少token数量
    TEMPERATURE = 1.0  # 提高创造性，避免过于保守
    
    # Agent 配置
    MAX_ADVICE_ITEMS = 5
    PRIORITY_ADVICE_COUNT = 3
    
    # 图片处理配置
    MAX_IMAGE_SIZE = (1920, 1080)  # 最大图片尺寸
    SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff']
    
    # 响应语言
    RESPONSE_LANGUAGE = "中文"
    
    @classmethod
    def validate_config(cls):
        """验证配置是否完整"""
        if not cls.OPENROUTER_API_KEY:
            raise ValueError("请设置 OPENROUTER_API_KEY 环境变量")
        return True 