#!/usr/bin/env python3
"""
Network Diagnostic Script for Photography AI API
Helps diagnose connection issues between React Native app and API server
"""

import socket
import subprocess
import sys
import requests
import json
from datetime import datetime

def get_local_ip():
    """Get the local IP address of this machine"""
    try:
        # Connect to a remote server to get local IP
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        return local_ip
    except Exception:
        return None

def get_network_interfaces():
    """Get all network interfaces and their IP addresses"""
    interfaces = {}
    try:
        if sys.platform == "darwin":  # macOS
            result = subprocess.run(['ifconfig'], capture_output=True, text=True)
            lines = result.stdout.split('\n')
            current_interface = None
            
            for line in lines:
                if line and not line.startswith('\t') and not line.startswith(' '):
                    current_interface = line.split(':')[0]
                    interfaces[current_interface] = []
                elif 'inet ' in line and current_interface:
                    parts = line.strip().split()
                    for i, part in enumerate(parts):
                        if part == 'inet' and i + 1 < len(parts):
                            ip = parts[i + 1]
                            if ip != '127.0.0.1':
                                interfaces[current_interface].append(ip)
                            break
        
        # Clean up empty interfaces
        interfaces = {k: v for k, v in interfaces.items() if v}
        return interfaces
    except Exception as e:
        print(f"❌ Error getting network interfaces: {e}")
        return {}

def check_port_open(ip, port):
    """Check if a port is open on the given IP"""
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(3)
        result = sock.connect_ex((ip, port))
        sock.close()
        return result == 0
    except Exception:
        return False

def test_api_endpoint(ip, port):
    """Test the API health endpoint"""
    try:
        url = f"http://{ip}:{port}/api/health"
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return True, data
        else:
            return False, f"HTTP {response.status_code}"
    except Exception as e:
        return False, str(e)

def main():
    print("🔍 PHOTOGRAPHY AI API - NETWORK DIAGNOSTIC")
    print("=" * 60)
    print(f"📅 Scan Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Get local IP
    local_ip = get_local_ip()
    print(f"🌐 Primary Local IP: {local_ip or 'Unable to detect'}")
    
    # Get all network interfaces
    print("\n📡 Network Interfaces:")
    interfaces = get_network_interfaces()
    
    if not interfaces:
        print("❌ No network interfaces found")
        return 1
    
    api_port = 5002
    working_ips = []
    
    for interface, ips in interfaces.items():
        print(f"\n  🔌 {interface}:")
        for ip in ips:
            print(f"    📍 {ip}")
            
            # Check if port is open
            port_open = check_port_open(ip, api_port)
            print(f"      🚪 Port {api_port}: {'✅ OPEN' if port_open else '❌ CLOSED'}")
            
            if port_open:
                # Test API endpoint
                api_working, result = test_api_endpoint(ip, api_port)
                if api_working:
                    print(f"      🎯 API Health: ✅ WORKING")
                    print(f"      📋 Response: {result}")
                    working_ips.append(ip)
                else:
                    print(f"      🎯 API Health: ❌ FAILED ({result})")
            else:
                print(f"      🎯 API Health: ⏸️  SKIPPED (port closed)")
    
    print("\n" + "=" * 60)
    print("📊 DIAGNOSTIC SUMMARY")
    print("=" * 60)
    
    if working_ips:
        print(f"✅ API SERVER IS ACCESSIBLE!")
        print(f"📱 React Native app should use one of these IPs:")
        for ip in working_ips:
            print(f"   🎯 http://{ip}:{api_port}")
        
        print(f"\n🔧 CONFIGURATION:")
        print(f"   In your React Native code, set:")
        print(f"   const API_BASE_URL = 'http://{working_ips[0]}:{api_port}'")
        
        # Test with curl
        print(f"\n🧪 TEST WITH CURL:")
        print(f"   curl -X GET http://{working_ips[0]}:{api_port}/api/health")
        
    else:
        print("❌ API SERVER NOT ACCESSIBLE!")
        print("\n🔧 TROUBLESHOOTING STEPS:")
        print("   1. Make sure API server is running:")
        print("      cd api && python api_server.py")
        print("   2. Check firewall settings")
        print("   3. Verify Python dependencies are installed")
        print("   4. Check if port 5002 is available")
        
        # Check if anything is running on port 5002
        try:
            result = subprocess.run(['lsof', '-i', f':{api_port}'], 
                                  capture_output=True, text=True)
            if result.stdout:
                print(f"\n📋 Processes using port {api_port}:")
                print(result.stdout)
            else:
                print(f"\n⚠️  No process found running on port {api_port}")
        except Exception:
            pass
    
    print("\n" + "=" * 60)
    return 0 if working_ips else 1

if __name__ == "__main__":
    sys.exit(main()) 