import cv2
import numpy as np
from PIL import Image
from PIL.ExifTags import TAGS

class SimpleImageAnalyzer:
    """
    简化图片分析器 - 只提供基础参数，让AI自己判断
    移除场景检测和人脸检测，专注核心功能
    """
    
    def __init__(self):
        pass  # 不需要加载任何检测器
    
    def analyze_image_simple(self, image_path):
        """简化的图片分析，只提取基础可靠参数"""
        try:
            # 读取图片
            image = cv2.imread(image_path)
            if image is None:
                return {'error': '无法读取图片'}
            
            pil_image = Image.open(image_path)
            
            # 基础信息
            height, width = image.shape[:2]
            orientation = "横向" if width > height else "竖向" if height > width else "正方形"
            
            # 基础光线分析
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            brightness = np.mean(gray)
            contrast = np.std(gray)
            
            # 基础色彩分析
            hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
            saturation_mean = np.mean(hsv[:, :, 1])
            
            # 清晰度分析
            sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()
            
            # 简化的EXIF
            exif_info = self._get_basic_exif(pil_image)
            
            return {
                # 基础信息
                'width': width,
                'height': height, 
                'orientation': orientation,
                
                # 光线信息
                'brightness': round(brightness, 1),
                'brightness_level': self._categorize_brightness(brightness),
                'contrast': round(contrast, 1),
                'contrast_level': self._categorize_contrast(contrast),
                
                # 质量信息
                'sharpness': round(sharpness, 3),
                'sharpness_level': self._categorize_sharpness(sharpness),
                'saturation': round(saturation_mean, 1),
                'saturation_level': self._categorize_saturation(saturation_mean),
                
                # EXIF
                'exif': exif_info
            }
            
        except Exception as e:
            return {'error': f'图片分析失败: {str(e)}'}
    
    def _get_basic_exif(self, pil_image):
        """获取基本EXIF信息"""
        try:
            exif_dict = pil_image.getexif()
            if exif_dict:
                exif_info = {}
                for tag_id, value in exif_dict.items():
                    tag = TAGS.get(tag_id, tag_id)
                    if tag in ['Make', 'Model', 'DateTime', 'ExposureTime', 'FNumber', 'ISO']:
                        exif_info[tag] = str(value)
                return exif_info
            return {}
        except:
            return {}
    
    def _categorize_brightness(self, brightness):
        """亮度分类"""
        if brightness < 50:
            return "昏暗"
        elif brightness < 120:
            return "适中"
        else:
            return "明亮"
    
    def _categorize_contrast(self, contrast):
        """对比度分类"""
        if contrast < 30:
            return "低"
        elif contrast < 60:
            return "中"
        else:
            return "高"
    
    def _categorize_sharpness(self, sharpness):
        """清晰度分类"""
        if sharpness < 100:
            return "模糊"
        elif sharpness < 300:
            return "一般"
        else:
            return "清晰"
    
    def _categorize_saturation(self, saturation):
        """饱和度分类"""
        if saturation < 80:
            return "低饱和度"
        elif saturation < 150:
            return "中饱和度"
        else:
            return "高饱和度"
    
 