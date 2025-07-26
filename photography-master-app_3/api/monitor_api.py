#!/usr/bin/env python3
"""
API监控脚本
监控摄影指导API的运行状态
"""

import requests
import time
import json
from datetime import datetime, timedelta
import sys

class APIMonitor:
    def __init__(self, base_url="http://localhost:5002"):
        self.base_url = base_url
        self.connection_stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'last_success_time': None,
            'last_failure_time': None,
            'consecutive_failures': 0
        }
    
    def log_request(self, success, response_time=None):
        """记录请求结果"""
        timestamp = datetime.now()
        self.connection_stats['total_requests'] += 1
        
        if success:
            self.connection_stats['successful_requests'] += 1
            self.connection_stats['last_success_time'] = timestamp
            self.connection_stats['consecutive_failures'] = 0
            status_emoji = "SUCCESS"
        else:
            self.connection_stats['failed_requests'] += 1
            self.connection_stats['last_failure_time'] = timestamp
            self.connection_stats['consecutive_failures'] += 1
            status_emoji = "FAILED"
        
        print(f"[{timestamp.strftime('%H:%M:%S')}] {status_emoji} - Response time: {response_time:.2f}s")
    
    def check_health(self):
        """检查API健康状态"""
        try:
            start_time = time.time()
            response = requests.get(f"{self.base_url}/api/health", timeout=5)
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                self.log_request(True, response_time)
                return True
            else:
                self.log_request(False, response_time)
                return False
        except Exception as e:
            self.log_request(False, 0)
            return False
    
    def test_analyze_endpoint(self):
        """测试分析接口"""
        try:
            # 创建测试图片
            from PIL import Image
            import io
            
            img = Image.new('RGB', (50, 50), color='red')
            img_buffer = io.BytesIO()
            img.save(img_buffer, format='JPEG')
            img_buffer.seek(0)
            
            start_time = time.time()
            response = requests.post(
                f"{self.base_url}/api/analyze",
                files={'image': ('test.jpg', img_buffer.getvalue(), 'image/jpeg')},
                timeout=30
            )
            response_time = time.time() - start_time
            
            if response.status_code == 200:
                self.log_request(True, response_time)
                return True
            else:
                self.log_request(False, response_time)
                return False
        except ImportError:
            print("PIL not available - skipping analyze endpoint test")
            return True
        except Exception as e:
            self.log_request(False, 0)
            return False
    
    def print_stats(self):
        """打印统计信息"""
        stats = self.connection_stats
        print("\n" + "="*50)
        print("CONNECTION STATISTICS")
        print("="*50)
        print(f"Total requests: {stats['total_requests']}")
        print(f"Successful: {stats['successful_requests']} ({stats['successful_requests']/max(stats['total_requests'],1)*100:.1f}%)")
        print(f"Failed: {stats['failed_requests']} ({stats['failed_requests']/max(stats['total_requests'],1)*100:.1f}%)")
        print(f"Consecutive failures: {stats['consecutive_failures']}")
        
        if stats['last_success_time']:
            print(f"Last success: {stats['last_success_time'].strftime('%H:%M:%S')}")
        else:
            print("Last success: Never")
            
        if stats['last_failure_time']:
            print(f"Last failure: {stats['last_failure_time'].strftime('%H:%M:%S')}")
        else:
            print("Last failure: Never")
    
    def monitor(self, interval=30, max_failures=5):
        """主监控循环"""
        print(f"Starting API monitoring...")
        print(f"Target: {self.base_url}")
        print(f"Check interval: {interval} seconds")
        print(f"Max consecutive failures: {max_failures}")
        print("="*50)
        
        while True:
            try:
                # 检查健康状态
                health_ok = self.check_health()
                
                # 如果健康检查失败，尝试分析接口
                if not health_ok:
                    print("Health check failed, testing analyze endpoint...")
                    analyze_ok = self.test_analyze_endpoint()
                    if not analyze_ok:
                        print("Both health check and analyze endpoint failed")
                
                # 检查连续失败次数
                if self.connection_stats['consecutive_failures'] >= max_failures:
                    print(f"WARNING: {max_failures} consecutive failures detected!")
                    print("API may be down or experiencing issues")
                
                # 打印统计信息
                self.print_stats()
                
                # 等待下次检查
                print(f"\nNext check in {interval} seconds...")
                time.sleep(interval)
                
            except KeyboardInterrupt:
                print("\nMonitoring stopped by user")
                break
            except Exception as e:
                print(f"Monitoring error: {e}")
                time.sleep(interval)

def main():
    """主函数"""
    print("PHOTOGRAPHY API MONITOR")
    print("="*50)
    
    # 检查API是否可访问
    monitor = APIMonitor()
    try:
        if monitor.check_health():
            print("API server is running and accessible")
        else:
            print(f"API server not accessible")
            return 1
    except Exception as e:
        print(f"API server not accessible: {e}")
        return 1
    
    # 开始监控
    try:
        monitor.monitor(interval=30, max_failures=3)
    except KeyboardInterrupt:
        print("\nMonitoring stopped")
    
    return 0

if __name__ == "__main__":
    sys.exit(main()) 