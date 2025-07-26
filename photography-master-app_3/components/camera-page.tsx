"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { X, MoreHorizontal } from "lucide-react"
import { photographyApi } from "@/lib/photography-api"

interface CameraPageProps {
  onClose: () => void
  initialMode?: string
}

export function CameraPage({ onClose, initialMode = "自动" }: CameraPageProps) {
  const [aspectRatio, setAspectRatio] = useState("3:4")
  const [activeMode, setActiveMode] = useState(initialMode)
  const [isBackCamera, setIsBackCamera] = useState(true)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAspectRatios, setShowAspectRatios] = useState(false)
  const aspectRatios = ["3:4", "1:1", "9:16", "全屏"]
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [flashMode, setFlashMode] = useState<"off" | "on" | "auto">("off")
  const [gridLines, setGridLines] = useState(false)
  const [burstMode, setBurstMode] = useState(false)
  const [showGuidanceDetails, setShowGuidanceDetails] = useState(false)
  const [focalLength, setFocalLength] = useState("1x")
  const [zoomLevel, setZoomLevel] = useState(1)
  const [supportedZoomRange, setSupportedZoomRange] = useState({ min: 1, max: 5 })
  const [availableFocalLengths, setAvailableFocalLengths] = useState(["1x"])
  
  // API Integration State
  const [isApiConnected, setIsApiConnected] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)
  const [currentGuidance, setCurrentGuidance] = useState<any>(null)
  const [isAiEnabled, setIsAiEnabled] = useState(true)

  // Log initial AI state
  useEffect(() => {
    console.log(`🔄 CAMERA PAGE INITIALIZED - AI is ${isAiEnabled ? 'ENABLED' : 'DISABLED'} by default`)
  }, [])

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const pinchStartDistance = useRef<number>(0)
  const lastZoomLevel = useRef<number>(1)
  const stopAnalysisRef = useRef<(() => void) | null>(null)

  const modes = ["自定义", "自动", "风景", "人像", "美食"]
  const defaultFocalLengths = ["0.5x", "1x", "3.2x", "5x"]

  // Helper function for direction emojis
  const getDirectionEmoji = (direction: string): string => {
    const directionMap: { [key: string]: string } = {
      'up': '⬆️',
      'down': '⬇️', 
      'left': '⬅️',
      'right': '➡️',
      'left_up': '↖️',
      'left_down': '↙️',
      'right_up': '↗️',
      'right_down': '↘️'
    };
    
    return directionMap[direction] || '🔄';
  }

  // Check API health and start periodic analysis
  const checkApiAndStartAnalysis = async () => {
    // Don't start analysis if AI is disabled
    if (!isAiEnabled) {
      console.log('AI is disabled - skipping analysis')
      return
    }

    console.log('====================================================')
    console.log('PHOTOGRAPHY APP - API CONNECTION STARTING')
    console.log('====================================================')
    console.log('Checking API server connection at localhost:5002...')
    
    const isHealthy = await photographyApi.checkHealth()
    
    setIsApiConnected(isHealthy)
    
    if (isHealthy && videoRef.current) {
      console.log('SUCCESS: API server connected and ready!')
      console.log('Starting live camera frame analysis...')
      console.log('Analysis interval: Every 3 seconds')
      setIsAnalyzing(true)
      
      // Start periodic analysis every 3 seconds for more responsive feedback
      const stopAnalysis = photographyApi.startPeriodicAnalysis(videoRef.current, 3000, (guidance) => {
        setCurrentGuidance(guidance)
        setLastAnalysisTime(new Date())
      })
      stopAnalysisRef.current = stopAnalysis
      
      // Update last analysis time when analysis starts
      setLastAnalysisTime(new Date())
      
      // Log session start with emphasis
      console.log('LIVE PROCESSING ACTIVE - Camera frames will be sent to API every 3 seconds')
      console.log('Check your API server logs to see incoming requests')
      console.log('====================================================')
    } else {
      console.log('FAILED: API server not available')
      console.log('Make sure your API server is running on localhost:5002')
      console.log('Expected API endpoints:')
      console.log('   - GET  /api/health')
      console.log('   - POST /api/analyze')
      console.log('====================================================')
      
      // Retry connection after 10 seconds only if AI is still enabled
      setTimeout(() => {
        if (videoRef.current && !stopAnalysisRef.current && isAiEnabled) {
          console.log('RETRYING API connection in 10 seconds...')
          checkApiAndStartAnalysis()
        }
      }, 10000)
    }
  }

  // Stop periodic analysis
  const stopPeriodicAnalysis = () => {
    if (stopAnalysisRef.current) {
      stopAnalysisRef.current()
      stopAnalysisRef.current = null
      setIsAnalyzing(false)
      console.log('Stopped periodic analysis')
    }
  }

  // 计算两点之间的距离（用于手势缩放）
  const getDistance = (touches: TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  // 处理触摸开始
  const handleTouchStart = (e: React.TouchEvent) => {
    console.log("Touch start:", e.touches.length)
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches)
      pinchStartDistance.current = distance
      lastZoomLevel.current = zoomLevel
      console.log("Pinch started:", distance, "zoom:", zoomLevel)
    }
  }

  // 处理触摸移动（缩放）
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchStartDistance.current > 0) {
      const currentDistance = getDistance(e.touches)
      const scale = currentDistance / pinchStartDistance.current
      const rawZoom = lastZoomLevel.current * scale
      const newZoom = Math.max(supportedZoomRange.min, Math.min(supportedZoomRange.max, rawZoom))
      
      console.log("Pinch zoom:", { currentDistance, scale, rawZoom, newZoom, min: supportedZoomRange.min, max: supportedZoomRange.max })
      
      // 应用硬件缩放（如果支持）
      applyZoom(newZoom)
      setZoomLevel(newZoom)
      
      // 更新对应的焦距显示
      if (availableFocalLengths.length > 0) {
        const closestFocal = availableFocalLengths.reduce((prev, curr) => {
          const prevDiff = Math.abs(parseFloat(prev.replace('x', '')) - newZoom)
          const currDiff = Math.abs(parseFloat(curr.replace('x', '')) - newZoom)
          return currDiff < prevDiff ? curr : prev
        })
        setFocalLength(closestFocal)
      }
    }
  }

  // 处理触摸结束
  const handleTouchEnd = () => {
    pinchStartDistance.current = 0
  }

  // 应用缩放到摄像头
  const applyZoom = async (zoom: number) => {
    // Just update the state - React will handle the CSS transform
    // No need for complex hardware zoom detection on mobile web
    console.log(`Setting zoom to: ${zoom}x`)
  }

  // 检测设备支持的缩放范围
  const detectZoomCapabilities = async (stream: MediaStream) => {
    try {
      const track = stream.getVideoTracks()[0]
      if (track && track.getCapabilities) {
        const capabilities = track.getCapabilities()
        console.log("Camera capabilities:", capabilities)
        
        if (capabilities.zoom) {
          const minZoom = capabilities.zoom.min || 1
          const maxZoom = capabilities.zoom.max || 5
          setSupportedZoomRange({ min: minZoom, max: maxZoom })
          
          // 强制重置到最小缩放级别
          try {
            await track.applyConstraints({
              advanced: [{ zoom: minZoom }]
            })
            console.log(`Reset camera to minimum zoom: ${minZoom}x`)
          } catch (resetError) {
            console.warn("Failed to reset zoom:", resetError)
          }
          
          // 根据支持的缩放范围生成焦距选项
          const focal = []
          if (minZoom <= 0.5) focal.push("0.5x")
          focal.push("1x")
          if (maxZoom >= 2) focal.push("2x")
          if (maxZoom >= 3.2) focal.push("3.2x")
          if (maxZoom >= 5) focal.push("5x")
          setAvailableFocalLengths(focal)
          
          // 设置合理的默认缩放级别
          setZoomLevel(Math.max(minZoom, 1))
          setFocalLength("1x")
          
          console.log(`Camera zoom range: ${minZoom}x - ${maxZoom}x, set to ${Math.max(minZoom, 1)}x`)
        } else {
          // 如果不支持硬件缩放，使用数字缩放
          setAvailableFocalLengths(["0.5x", "1x", "2x", "3x"])
          setZoomLevel(1)
          setFocalLength("1x")
          console.log("No hardware zoom support, using digital zoom")
        }
      }
    } catch (error) {
      console.warn("Could not detect zoom capabilities:", error)
      setAvailableFocalLengths(["1x", "2x", "3x"])
      setZoomLevel(1)
      setFocalLength("1x")
    }
  }

  // 根据焦距设置缩放级别
  const handleFocalLengthChange = (length: string) => {
    setFocalLength(length)
    const zoomValue = parseFloat(length.replace('x', ''))
    const constrainedZoom = Math.max(supportedZoomRange.min, Math.min(supportedZoomRange.max, zoomValue))
    applyZoom(constrainedZoom)
    setZoomLevel(constrainedZoom)
  }

  // 启动摄像头
  const startCamera = async (facingMode: "user" | "environment" = "environment") => {
    try {
      // 停止之前的流
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
      
      // 重置缩放状态
      setZoomLevel(1)
      setFocalLength("1x")
      setSupportedZoomRange({ min: 1, max: 5 })

      // 首先尝试更具体的约束
      let constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
        },
        audio: false,
      }

      let stream: MediaStream

      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (err) {
        console.warn("Failed with ideal constraints, trying basic constraints:", err)
        // 如果失败，尝试更基本的约束
        constraints = {
          video: {
            facingMode: facingMode,
          },
          audio: false,
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch (err2) {
          console.warn("Failed with facingMode, trying without facingMode:", err2)
          // 最后尝试最基本的约束
          constraints = {
            video: true,
            audio: false,
          }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
        }
      }

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // 检测缩放能力并重置缩放
      await detectZoomCapabilities(stream)
      
      // 确保视频元素也被重置
      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${zoomLevel})`
      }

      setHasPermission(true)
      setError(null)
      
      // Only start API analysis if AI is enabled
      if (isAiEnabled) {
        console.log('📱 Camera ready - AI is enabled, starting analysis...')
        setTimeout(() => {
          checkApiAndStartAnalysis()
        }, 1000)
      } else {
        console.log('📱 Camera ready - AI is disabled, skipping analysis')
      }
    } catch (err) {
      console.error("Error accessing camera:", err)
      setHasPermission(false)
      if (err instanceof Error) {
        if (err.name === "NotAllowedError") {
          setError("摄像头权限被拒绝，请允许访问摄像头")
        } else if (err.name === "NotFoundError") {
          setError("未找到摄像头设备")
        } else if (err.name === "NotReadableError") {
          setError("摄像头被其他应用占用")
        } else {
          setError(`摄像头错误: ${err.message}`)
        }
      } else {
        setError("无法访问摄像头")
      }
    }
  }

  // 切换前后摄像头
  const toggleCamera = () => {
    const newFacingMode = isBackCamera ? "user" : "environment"
    setIsBackCamera(!isBackCamera)
    startCamera(newFacingMode)
  }

  // 拍照功能
  const takePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      if (context) {
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)

        // 转换为blob并下载（实际应用中可能需要保存到相册）
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const a = document.createElement("a")
              a.href = url
              a.download = `photo_${Date.now()}.jpg`
              a.click()
              URL.revokeObjectURL(url)
            }
          },
          "image/jpeg",
          0.9,
        )
      }
    }
  }

  // Toggle AI analysis
  const toggleAi = () => {
    console.log(`🔘 AI TOGGLE CLICKED - Current state: ${isAiEnabled ? 'ENABLED' : 'DISABLED'}`)
    const newAiEnabled = !isAiEnabled
    setIsAiEnabled(newAiEnabled)
    console.log(`🔄 AI STATE CHANGED - New state: ${newAiEnabled ? 'ENABLED' : 'DISABLED'}`)
    
    if (newAiEnabled) {
      console.log('🔆 AI ENABLED - Starting analysis...')
      console.log(`📹 Camera ready: ${!!videoRef.current}, Permission: ${hasPermission}`)
      // Start analysis if camera is ready
      if (videoRef.current && hasPermission) {
        setTimeout(() => {
          checkApiAndStartAnalysis()
        }, 500)
      }
    } else {
      console.log('🔕 AI DISABLED - Stopping analysis...')
      stopPeriodicAnalysis()
      setCurrentGuidance(null) // Clear any existing guidance
      setIsApiConnected(false) // Reset connection status
    }
  }

  // Effect to handle AI state changes
  useEffect(() => {
    if (isAiEnabled && videoRef.current && hasPermission) {
      console.log('🔄 AI enabled - checking if analysis should start...')
      // Only start if not already analyzing
      if (!stopAnalysisRef.current) {
        setTimeout(() => {
          checkApiAndStartAnalysis()
        }, 1000)
      }
    }
  }, [isAiEnabled, hasPermission])

  // 在组件挂载时启动摄像头
  useEffect(() => {
    // 检查浏览器是否支持getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasPermission(false)
      setError("您的浏览器不支持摄像头功能")
      return
    }

    startCamera("environment")

    // 清理函数
    return () => {
      stopPeriodicAnalysis()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // 处理关闭
  const handleClose = () => {
    // Stop API analysis
    stopPeriodicAnalysis()
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center justify-between px-4 py-4 pt-12">
          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-white hover:bg-white/20 rounded-full"
            onClick={handleClose}
          >
            <X className="w-6 h-6" />
          </Button>

          {/* Center Controls */}
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 text-white hover:bg-white/20 rounded-full"
              onClick={toggleCamera}
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                              />
            </svg>
          </Button>

          <Button
              variant="ghost"
              size="sm"
              className="px-3 py-1 text-white hover:bg-white/20 rounded-full"
              onClick={() => {
                setShowAspectRatios(!showAspectRatios)
                setShowMoreOptions(false) // 关闭更多选项
              }}
            >
              <span className="text-white font-medium text-lg">{aspectRatio}</span>
            </Button>
            {/* Aspect Ratio Selection */}
            {showAspectRatios && (
              <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-xl p-3 z-30 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center space-x-4">
                  {aspectRatios.map((ratio) => (
                    <Button
                      key={ratio}
                      variant="ghost"
                      size="sm"
                      className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
                        aspectRatio === ratio
                          ? "bg-white/20 text-white font-medium"
                          : "text-white/70 hover:text-white hover:bg-white/10"
                      }`}
                      onClick={() => {
                        setAspectRatio(ratio)
                        setShowAspectRatios(false)
                      }}
                    >
                      <span className="text-sm font-medium">{ratio}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* More Options */}
          <Button
            variant="ghost"
            size="sm"
            className="p-2 text-white hover:bg-white/20 rounded-full"
            onClick={() => {
              setShowMoreOptions(!showMoreOptions)
              setShowAspectRatios(false) // 关闭比例选项
            }}
          >
            <MoreHorizontal className="w-6 h-6" />
          </Button>
          {/* More Options Toolbar */}
          {showMoreOptions && (
            <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-sm rounded-xl p-3 z-30 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center space-x-4">
                {/* Flash */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
                    flashMode !== "off" ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => {
                    const modes: ("off" | "on" | "auto")[] = ["off", "on", "auto"]
                    const currentIndex = modes.indexOf(flashMode)
                    const nextMode = modes[(currentIndex + 1) % modes.length]
                    setFlashMode(nextMode)
                  }}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span className="text-xs font-medium">
                    {flashMode === "off" ? "关闭" : flashMode === "on" ? "开启" : "自动"}
                  </span>
                </Button>

                {/* Grid Lines */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
                    gridLines ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setGridLines(!gridLines)}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h18v18H3V3z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 3v18M15 3v18M3 9h18M3 15h18"
                    />
                  </svg>
                  <span className="text-xs font-medium">网格</span>
                </Button>

                {/* Burst Mode */}
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center p-3 rounded-lg transition-all duration-200 ${
                    burstMode ? "bg-white/20 text-white" : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                  onClick={() => setBurstMode(!burstMode)}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                    <circle cx="8" cy="8" r="2" strokeWidth={1.5} opacity="0.6" />
                    <circle cx="16" cy="8" r="2" strokeWidth={1.5} opacity="0.6" />
                    <circle cx="8" cy="16" r="2" strokeWidth={1.5} opacity="0.6" />
                    <circle cx="16" cy="16" r="2" strokeWidth={1.5} opacity="0.6" />
                  </svg>
                  <span className="text-xs font-medium">连拍</span>
                </Button>

                {/* All Settings */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex flex-col items-center p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200"
                  onClick={() => {
                    // 这里可以打开设置页面
                    console.log("打开全部设置")
                  }}
                >
                  <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 1v6m0 6v6m11-7h-6m-6 0H1m15.5-3.5L19 4l-2.5 2.5M6.5 17.5L4 20l2.5-2.5m0-11L4 4l2.5 2.5M17.5 17.5L20 20l-2.5-2.5"
                    />
                  </svg>
                  <span className="text-xs font-medium">设置</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Camera Viewfinder */}
      <div
        className="absolute inset-0"
        onClick={() => {
          setShowAspectRatios(false)
          setShowMoreOptions(false)
        }}
      >
        {hasPermission === null && (
          <div className="flex items-center justify-center h-full bg-black">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>正在启动摄像头...</p>
            </div>
          </div>
        )}

        {hasPermission === false && (
          <div className="flex items-center justify-center h-full bg-black">
            <div className="text-white text-center px-6">
              <p className="mb-4">无法访问摄像头</p>
              <p className="text-sm text-gray-400 mb-4">{error}</p>
              <Button
                onClick={() => startCamera(isBackCamera ? "environment" : "user")}
                className="bg-white text-black hover:bg-gray-200"
              >
                重试
              </Button>
            </div>
          </div>
        )}

        {hasPermission && (
          <div className="relative w-full h-full">
            <video 
              ref={videoRef} 
              className="w-full h-full object-cover" 
              autoPlay 
              playsInline 
              muted 
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center' }}
            />
            {/* Invisible touch overlay for gesture detection */}
            <div 
              className="absolute inset-0 bg-transparent"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{ touchAction: 'none' }}
            />
            {/* Visual Guidance Overlay System */}
            {currentGuidance && currentGuidance.suggestions && isAiEnabled && (
              <>
                {/* Primary Directional Indicators */}
                {currentGuidance.suggestions.slice(0, 1).map((suggestion: any, index: number) => {
                  const intensity = suggestion.intensity || 3;
                  const direction = suggestion.direction;
                  const opacity = Math.min(0.4 + (intensity * 0.15), 0.9);
                  const size = Math.min(40 + (intensity * 8), 64);
                  
                  // Position calculations for edge indicators
                  const getIndicatorPosition = (dir: string) => {
                    switch(dir) {
                      case 'up': return 'top-8 left-1/2 transform -translate-x-1/2';
                      case 'down': return 'bottom-24 left-1/2 transform -translate-x-1/2';
                      case 'left': return 'top-1/2 left-8 transform -translate-y-1/2';
                      case 'right': return 'top-1/2 right-8 transform -translate-y-1/2';
                      case 'left_up': return 'top-8 left-8';
                      case 'right_up': return 'top-8 right-8';
                      case 'left_down': return 'bottom-24 left-8';
                      case 'right_down': return 'bottom-24 right-8';
                      default: return 'top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2';
                    }
                  };
                  
                  return (
                    <div key={index} className={`absolute ${getIndicatorPosition(direction)} pointer-events-none z-30`}>
                      {/* Main Direction Arrow */}
                      <div 
                        className="relative flex items-center justify-center animate-pulse"
                        style={{ 
                          width: `${size}px`, 
                          height: `${size}px`,
                          opacity: opacity
                        }}
                      >
                        {/* Outer Glow Ring */}
                        <div className={`absolute inset-0 rounded-full border-4 ${
                          intensity >= 4 ? 'border-red-400 shadow-lg shadow-red-400/30' :
                          intensity >= 3 ? 'border-yellow-400 shadow-lg shadow-yellow-400/30' :
                          'border-blue-400 shadow-lg shadow-blue-400/30'
                        } animate-ping`} />
                        
                        {/* Arrow Icon */}
                        <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full ${
                          intensity >= 4 ? 'bg-red-500/90' :
                          intensity >= 3 ? 'bg-yellow-500/90' :
                          'bg-blue-500/90'
                        } backdrop-blur-sm`}>
                          {/* SVG Arrow based on direction */}
                          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                            {direction === 'up' && <path d="M12 2l8 8h-6v12h-4V10H4l8-8z" />}
                            {direction === 'down' && <path d="M12 22l-8-8h6V2h4v12h6l-8 8z" />}
                            {direction === 'left' && <path d="M2 12l8-8v6h12v4H10v6l-8-8z" />}
                            {direction === 'right' && <path d="M22 12l-8 8v-6H2v-4h12V4l8 8z" />}
                            {direction === 'left_up' && <path d="M8 2H2v6l4-4 8 8 4-4-8-8 4-4z" />}
                            {direction === 'right_up' && <path d="M16 2h6v6l-4-4-8 8-4-4 8-8-4-4z" />}
                            {direction === 'left_down' && <path d="M8 22H2v-6l4 4 8-8 4 4-8 8-4 4z" />}
                            {direction === 'right_down' && <path d="M16 22h6v-6l-4 4-8-8-4 4 8 8 4 4z" />}
                          </svg>
                        </div>
                        
                        {/* Intensity Indicator Dots */}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <div
                              key={i}
                              className={`w-1.5 h-1.5 rounded-full ${
                                i < intensity ? 
                                  (intensity >= 4 ? 'bg-red-400' : 
                                   intensity >= 3 ? 'bg-yellow-400' : 'bg-blue-400') :
                                  'bg-white/20'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Tilt Correction Indicator */}
                {currentGuidance.analysis && !currentGuidance.analysis.is_level && currentGuidance.analysis.tilt_angle > 2 && (
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30">
                    <div className="relative">
                      {/* Horizon Line Indicator */}
                      <div className="relative w-40 h-20 flex items-center justify-center">
                        {/* Current Horizon (Tilted) */}
                        <div 
                          className="absolute w-32 h-0.5 bg-red-400/80 shadow-lg shadow-red-400/30"
                          style={{ 
                            transform: `rotate(${currentGuidance.analysis.tilt_angle}deg)`,
                            transformOrigin: 'center'
                          }}
                        />
                        
                        {/* Target Horizon (Level) */}
                        <div className="absolute w-32 h-0.5 bg-green-400/60" />
                        
                        {/* Rotation Arrow */}
                        <div className={`absolute ${currentGuidance.analysis.tilt_angle > 0 ? '-top-8 -right-6' : '-top-8 -left-6'}`}>
                          <div className="w-10 h-10 bg-yellow-500/90 rounded-full flex items-center justify-center backdrop-blur-sm animate-bounce">
                            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                              {currentGuidance.analysis.tilt_angle > 0 ? (
                                <path d="M12 6v6l4-4-4-4zm6.5 5.5L17 10l1.5-1.5L20 10l-1.5 1.5zM12 18l-4-4h8l-4 4zm-6.5-6.5L4 10l1.5-1.5L7 10l-1.5 1.5z" />
                              ) : (
                                <path d="M12 6v6l-4-4 4-4zm-6.5 5.5L7 10 5.5 8.5 4 10l1.5 1.5zM12 18l4-4H8l4 4zm6.5-6.5L20 10l-1.5-1.5L17 10l1.5 1.5z" />
                              )}
                            </svg>
                          </div>
                        </div>
                        
                        {/* Angle Display */}
                        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/80 px-2 py-1 rounded text-white text-xs font-medium">
                          {Math.abs(currentGuidance.analysis.tilt_angle).toFixed(1)}°
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Rule of Thirds Grid Enhancement */}
                {currentGuidance.suggestions.some((s: any) => s.action.toLowerCase().includes('composition') || s.action.toLowerCase().includes('frame')) && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      {/* Enhanced Grid Lines */}
                      <line x1="33.33" y1="0" x2="33.33" y2="100" stroke="#fbbf24" strokeWidth="0.3" opacity="0.8" strokeDasharray="2,2" />
                      <line x1="66.66" y1="0" x2="66.66" y2="100" stroke="#fbbf24" strokeWidth="0.3" opacity="0.8" strokeDasharray="2,2" />
                      <line x1="0" y1="33.33" x2="100" y2="33.33" stroke="#fbbf24" strokeWidth="0.3" opacity="0.8" strokeDasharray="2,2" />
                      <line x1="0" y1="66.66" x2="100" y2="66.66" stroke="#fbbf24" strokeWidth="0.3" opacity="0.8" strokeDasharray="2,2" />
                      
                      {/* Golden Points Indicators */}
                      <circle cx="33.33" cy="33.33" r="1" fill="#fbbf24" opacity="0.9" />
                      <circle cx="66.66" cy="33.33" r="1" fill="#fbbf24" opacity="0.9" />
                      <circle cx="33.33" cy="66.66" r="1" fill="#fbbf24" opacity="0.9" />
                      <circle cx="66.66" cy="66.66" r="1" fill="#fbbf24" opacity="0.9" />
                    </svg>
                  </div>
                )}
                
                {/* Subject Positioning Indicator */}
                {currentGuidance.suggestions.filter((s: any) => s.action.toLowerCase().includes('move')).slice(0, 1).map((suggestion: any, index: number) => (
                  <div key={`subject-${index}`} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-20">
                    {/* Subject Frame */}
                    <div className="relative w-32 h-40 border-2 border-dashed border-blue-400/60 rounded-lg">
                      {/* Current Position Indicator */}
                      <div className="absolute w-4 h-4 bg-red-400 rounded-full top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      
                      {/* Target Position */}
                      <div className={`absolute w-4 h-4 border-2 border-green-400 rounded-full animate-bounce ${
                        suggestion.direction.includes('left') ? 'left-2' :
                        suggestion.direction.includes('right') ? 'right-2' :
                        'left-1/2 transform -translate-x-1/2'
                      } ${
                        suggestion.direction.includes('up') ? 'top-2' :
                        suggestion.direction.includes('down') ? 'bottom-2' :
                        'top-1/2 transform -translate-y-1/2'
                      }`} />
                      
                      {/* Movement Path */}
                      <svg className="absolute inset-0 w-full h-full">
                        <path 
                          d={`M ${suggestion.direction.includes('left') ? '24' : suggestion.direction.includes('right') ? '8' : '16'} 20 Q 16 16 ${suggestion.direction.includes('left') ? '8' : suggestion.direction.includes('right') ? '24' : '16'} ${suggestion.direction.includes('up') ? '8' : suggestion.direction.includes('down') ? '32' : '20'}`}
                          stroke="#60a5fa" 
                          strokeWidth="2" 
                          fill="none" 
                          strokeDasharray="4,4"
                          className="animate-pulse"
                        />
                        {/* Arrow at target */}
                        <polygon 
                          points={`${suggestion.direction.includes('left') ? '6,8 10,6 10,10' : suggestion.direction.includes('right') ? '26,8 22,6 22,10' : '14,6 18,8 14,10'}`}
                          fill="#10b981" 
                          className="animate-bounce"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
                
                {/* Compact Text Guidance - Only for high priority suggestions */}
                {currentGuidance.suggestions.filter((s: any) => s.intensity >= 4).slice(0, 1).map((suggestion: any, index: number) => (
                  <div key={`text-${index}`} className="absolute bottom-32 left-1/2 transform -translate-x-1/2 pointer-events-none z-30">
                    <div className="bg-red-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg border border-red-400/50 animate-pulse">
                      <div className="flex items-center space-x-2">
                        <span className="text-lg">{getDirectionEmoji(suggestion.direction)}</span>
                        <span>{suggestion.action}</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Guidance Details Toggle */}
                <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-30">
                  <button
                    onClick={() => setShowGuidanceDetails(!showGuidanceDetails)}
                    className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-medium border border-white/20 transition-all duration-200"
                  >
                    {showGuidanceDetails ? '👁️ Hide Details' : '👁️ Show Details'} ({currentGuidance.suggestions.length})
                  </button>
                </div>
                
                {/* Detailed Guidance Panel */}
                {showGuidanceDetails && (
                  <div className="absolute top-12 left-4 right-4 z-30 max-w-sm mx-auto">
                    <div className="bg-black/85 backdrop-blur-md text-white p-4 rounded-xl border border-white/20 shadow-2xl">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-yellow-400 flex items-center">
                          <span className="mr-2">📷</span>
                          AI Photography Guide
                        </h3>
                        <button 
                          onClick={() => setShowGuidanceDetails(false)}
                          className="text-white/60 hover:text-white text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                      
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {currentGuidance.suggestions.map((suggestion: any, index: number) => (
                          <div key={index} className="flex items-start space-x-3 p-2 rounded-lg bg-white/5 border border-white/10">
                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-xs ${suggestion.intensity >= 4 ? 'bg-red-500' : suggestion.intensity >= 3 ? 'bg-yellow-500' : 'bg-blue-500'}`}>
                              {suggestion.step || index + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-white mb-1 flex items-center">
                                <span className="mr-2">{getDirectionEmoji(suggestion.direction)}</span>
                                <span className="truncate">{suggestion.action}</span>
                              </div>
                              <div className="text-white/70 text-xs leading-relaxed">
                                {suggestion.reason}
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center">
                                  <span className="text-orange-400 text-xs mr-2">Priority:</span>
                                  <div className="flex space-x-0.5">
                                    {[...Array(5)].map((_, i) => (
                                      <div
                                        key={i}
                                        className={`w-1.5 h-3 rounded-full ${i < (suggestion.intensity || 3) ? (suggestion.intensity >= 4 ? 'bg-red-400' : suggestion.intensity >= 3 ? 'bg-yellow-400' : 'bg-blue-400') : 'bg-white/20'}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${suggestion.intensity >= 4 ? 'bg-red-500/20 text-red-300' : suggestion.intensity >= 3 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'}`}>
                                  {suggestion.intensity >= 4 ? 'Critical' : suggestion.intensity >= 3 ? 'Important' : 'Helpful'}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {currentGuidance.analysis && (
                        <div className="mt-4 pt-3 border-t border-white/20">
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="text-center">
                              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${currentGuidance.analysis.is_level ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                {currentGuidance.analysis.is_level ? '✓' : '⚖'}
                              </div>
                              <div className="text-white/70">Level</div>
                              <div className={currentGuidance.analysis.is_level ? 'text-green-400' : 'text-red-400'}>
                                {currentGuidance.analysis.is_level ? 'Good' : `${currentGuidance.analysis.tilt_angle}°`}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 ${currentGuidance.analysis.brightness === 'good' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                🔆
                              </div>
                              <div className="text-white/70">Light</div>
                              <div className={currentGuidance.analysis.brightness === 'good' ? 'text-green-400' : 'text-yellow-400'}>
                                {currentGuidance.analysis.brightness === 'good' ? 'Good' : 
                                 currentGuidance.analysis.brightness === 'too_dark' ? 'Dark' : 'Bright'}
                              </div>
                            </div>
                            <div className="text-center">
                              <div className="w-8 h-8 mx-auto rounded-full flex items-center justify-center mb-1 bg-blue-500/20 text-blue-400">
                                📐
                              </div>
                              <div className="text-white/70">Comp</div>
                              <div className="text-blue-400">
                                {currentGuidance.suggestions.length} tips
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Debug info */}
            <div className="absolute bottom-4 left-4 bg-black/70 text-white p-2 rounded text-xs">
              State: {zoomLevel.toFixed(1)}x<br/>
              Range: {supportedZoomRange.min}-{supportedZoomRange.max}<br/>
              Focal: {focalLength}
            </div>
            
            {/* API Status Indicator - Enhanced */}
            <div className="absolute top-4 right-4 bg-black/80 text-white p-3 rounded-lg text-xs border-2 border-yellow-400">
              <div className="text-center mb-2">
                <span className="text-yellow-400 font-bold">LIVE API</span>
              </div>
              <div className="flex items-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${isApiConnected && isAiEnabled ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span className="font-semibold">
                  {!isAiEnabled ? 'DISABLED' : isApiConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>
              {isAnalyzing && isAiEnabled && (
                <div className="flex items-center space-x-1 mb-2">
                  <div className="animate-spin w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-blue-400 font-bold">PROCESSING...</span>
                </div>
              )}
              {lastAnalysisTime && isAiEnabled && (
                <div className="text-gray-300 text-center">
                  Last: {lastAnalysisTime.toLocaleTimeString()}
                </div>
              )}
              <div className="text-center mt-2 text-yellow-300 text-xs">
                localhost:5002
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Focus Indicator with Smart Positioning */}
        {hasPermission && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Dynamic Focus Ring - Adapts based on guidance */}
            <div className={`border-2 rounded-full transition-all duration-300 ${
              currentGuidance && currentGuidance.suggestions && isAiEnabled ?
                'w-32 h-32 border-yellow-400/70 animate-pulse shadow-lg shadow-yellow-400/20' :
                'w-24 h-24 border-white/50 animate-pulse'
            }`}>
              {/* Focus Point Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-white/80"></div>
                <div className="w-0.5 h-6 bg-white/80 absolute"></div>
              </div>
              
              {/* Smart Subject Detection Hint */}
              {currentGuidance && currentGuidance.suggestions && isAiEnabled && (
                <div className="absolute -bottom-10 left-1/2 transform -translate-x-1/2 bg-black/70 px-3 py-1 rounded text-white text-xs backdrop-blur-sm">
                  AI Focus Active
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Brightness Adjustment Indicator */}
        {currentGuidance && currentGuidance.analysis && isAiEnabled && (
          <div className="absolute top-1/2 left-4 transform -translate-y-1/2 pointer-events-none z-20">
            {currentGuidance.analysis.brightness !== 'good' && (
              <div className="flex flex-col items-center space-y-2">
                {/* Brightness Meter */}
                <div className="w-6 h-32 bg-black/60 rounded-full border border-white/30 backdrop-blur-sm p-1">
                  <div className="relative h-full">
                    {/* Current Brightness Level */}
                    <div 
                      className={`absolute bottom-0 left-0 right-0 rounded-full transition-all duration-500 ${
                        currentGuidance.analysis.brightness === 'too_dark' ? 'bg-blue-400 h-1/4' :
                        currentGuidance.analysis.brightness === 'too_bright' ? 'bg-yellow-400 h-3/4' :
                        'bg-green-400 h-1/2'
                      }`}
                    />
                    
                    {/* Target Level Indicator */}
                    <div className="absolute w-full h-0.5 bg-green-400 top-1/2 transform -translate-y-1/2" />
                    
                    {/* Adjustment Arrow */}
                    <div className={`absolute right-2 transition-all duration-300 ${
                      currentGuidance.analysis.brightness === 'too_dark' ? 'top-1/4 animate-bounce' :
                      currentGuidance.analysis.brightness === 'too_bright' ? 'bottom-1/4 animate-bounce' :
                      'top-1/2 transform -translate-y-1/2'
                    }`}>
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                        {currentGuidance.analysis.brightness === 'too_dark' ? (
                          <path d="M12 2l8 8h-6v12h-4V10H4l8-8z" />
                        ) : currentGuidance.analysis.brightness === 'too_bright' ? (
                          <path d="M12 22l-8-8h6V2h4v12h6l-8 8z" />
                        ) : (
                          <circle cx="12" cy="12" r="3" />
                        )}
                      </svg>
                    </div>
                  </div>
                </div>
                
                {/* Brightness Icon */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  currentGuidance.analysis.brightness === 'too_dark' ? 'bg-blue-500/80' :
                  currentGuidance.analysis.brightness === 'too_bright' ? 'bg-yellow-500/80' :
                  'bg-green-500/80'
                } backdrop-blur-sm`}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    {currentGuidance.analysis.brightness === 'too_dark' ? (
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    ) : (
                      <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                    )}
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Distance/Zoom Guidance */}
        {currentGuidance && currentGuidance.suggestions && isAiEnabled && currentGuidance.suggestions.some((s: any) => s.action.toLowerCase().includes('closer') || s.action.toLowerCase().includes('back')) && (
          <div className="absolute bottom-1/3 right-4 pointer-events-none z-20">
            <div className="flex flex-col items-center space-y-3">
              {currentGuidance.suggestions.filter((s: any) => s.action.toLowerCase().includes('closer') || s.action.toLowerCase().includes('back')).slice(0, 1).map((suggestion: any, index: number) => (
                <div key={index} className="flex flex-col items-center">
                  {/* Zoom Direction Indicator */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm border-2 animate-pulse ${
                    suggestion.action.toLowerCase().includes('closer') ?
                      'bg-green-500/80 border-green-400' :
                      'bg-blue-500/80 border-blue-400'
                  }`}>
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      {suggestion.action.toLowerCase().includes('closer') ? (
                        // Zoom In Icon
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                      ) : (
                        // Zoom Out Icon
                        <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM7 9h5v1H7z" />
                      )}
                    </svg>
                  </div>
                  
                  {/* Action Text */}
                  <div className="mt-2 bg-black/70 px-2 py-1 rounded text-white text-xs backdrop-blur-sm">
                    {suggestion.action.toLowerCase().includes('closer') ? 'Get Closer' : 'Move Back'}
                  </div>
                  
                  {/* Distance Indicator */}
                  <div className="mt-1 flex space-x-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-3 ${
                          suggestion.action.toLowerCase().includes('closer') ?
                            (i < suggestion.intensity ? 'bg-green-400' : 'bg-white/20') :
                            (i < suggestion.intensity ? 'bg-blue-400' : 'bg-white/20')
                        }`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Zoom Level Indicator */}
        {hasPermission && zoomLevel !== 1 && (
          <div className="absolute top-1/2 right-4 transform -translate-y-1/2 pointer-events-none z-10">
            <div className="flex flex-col items-center space-y-2">
              {/* Zoom Level Display */}
              <div className="bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 border border-white/20">
                <span className="text-white text-sm font-bold">{zoomLevel.toFixed(1)}×</span>
              </div>
              
              {/* Zoom Range Visualization */}
              <div className="w-2 h-20 bg-black/60 rounded-full border border-white/30 p-0.5">
                <div 
                  className="w-full bg-yellow-400 rounded-full transition-all duration-300"
                  style={{ 
                    height: `${((zoomLevel - supportedZoomRange.min) / (supportedZoomRange.max - supportedZoomRange.min)) * 100}%`,
                    marginTop: 'auto'
                  }}
                />
                
                {/* Zoom Level Markers */}
                <div className="absolute right-3 top-0 h-full flex flex-col justify-between text-white text-xs">
                  <span className="transform -translate-y-1">{supportedZoomRange.max}×</span>
                  <span className="transform translate-y-1">{supportedZoomRange.min}×</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Enhanced Grid Lines with Smart Guidance */}
        {hasPermission && (gridLines || (currentGuidance && currentGuidance.suggestions && isAiEnabled)) && (
          <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              {/* Adaptive Grid Opacity based on AI guidance */}
              <defs>
                <pattern id="smartGrid" width="33.33" height="33.33" patternUnits="userSpaceOnUse">
                  <path
                    d="M 33.33 0 L 33.33 33.33 M 0 33.33 L 33.33 33.33"
                    fill="none"
                    stroke={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "#fbbf24" : "white"}
                    strokeWidth="0.2"
                    opacity={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "0.8" : "0.4"}
                  />
                </pattern>
              </defs>
              
              {/* Main Grid */}
              <rect width="100" height="100" fill="url(#smartGrid)" />
              
              {/* Rule of Thirds Lines */}
              <line 
                x1="33.33" y1="0" x2="33.33" y2="100" 
                stroke={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "#fbbf24" : "white"} 
                strokeWidth="0.3" 
                opacity={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "0.9" : "0.5"}
                strokeDasharray={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "3,2" : "none"}
              />
              <line 
                x1="66.66" y1="0" x2="66.66" y2="100" 
                stroke={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "#fbbf24" : "white"} 
                strokeWidth="0.3" 
                opacity={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "0.9" : "0.5"}
                strokeDasharray={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "3,2" : "none"}
              />
              <line 
                x1="0" y1="33.33" x2="100" y2="33.33" 
                stroke={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "#fbbf24" : "white"} 
                strokeWidth="0.3" 
                opacity={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "0.9" : "0.5"}
                strokeDasharray={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "3,2" : "none"}
              />
              <line 
                x1="0" y1="66.66" x2="100" y2="66.66" 
                stroke={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "#fbbf24" : "white"} 
                strokeWidth="0.3" 
                opacity={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "0.9" : "0.5"}
                strokeDasharray={currentGuidance && currentGuidance.suggestions && isAiEnabled ? "3,2" : "none"}
              />
              
              {/* Sweet Spots for AI Guidance */}
              {currentGuidance && currentGuidance.suggestions && isAiEnabled && (
                <>
                  <circle cx="33.33" cy="33.33" r="1.5" fill="#fbbf24" opacity="0.8" className="animate-pulse" />
                  <circle cx="66.66" cy="33.33" r="1.5" fill="#fbbf24" opacity="0.8" className="animate-pulse" />
                  <circle cx="33.33" cy="66.66" r="1.5" fill="#fbbf24" opacity="0.8" className="animate-pulse" />
                  <circle cx="66.66" cy="66.66" r="1.5" fill="#fbbf24" opacity="0.8" className="animate-pulse" />
                  
                  {/* Center Focus Point */}
                  <circle cx="50" cy="50" r="0.8" fill="#10b981" opacity="0.6" />
                </>
              )}
            </svg>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 to-transparent pb-8">
        {/* Focal Length Selection */}
        <div className="flex justify-center space-x-8 mb-4 px-4">
          {availableFocalLengths.map((length) => (
            <Button
              key={length}
              variant="ghost"
              size="sm"
              className={`px-3 py-1 rounded-full transition-all duration-200 ${
                focalLength === length
                  ? "bg-white text-black font-semibold text-lg"
                  : "text-white/70 hover:text-white hover:bg-white/10 text-base"
              }`}
              onClick={() => handleFocalLengthChange(length)}
            >
              {length}
            </Button>
          ))}
        </div>

        {/* Mode Selection */}
        <div className="flex justify-center space-x-6 mb-8 px-4">
          {modes.map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              className={`px-4 py-2 rounded-full transition-all duration-200 ${
                activeMode === mode
                  ? "bg-white text-black font-medium"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              onClick={() => setActiveMode(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>

        {/* Shutter Button */}
        <div className="flex justify-center items-center space-x-8 mb-8">
          {/* Voice Chat Button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20 transition-all duration-200 hover:scale-110 active:scale-95"
          >
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </Button>

          {/* Main Shutter Button - 恢复原来的空心圆环设计 */}
          <Button
            className="w-20 h-20 rounded-full bg-transparent border-4 border-red-500 hover:border-red-400 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-50"
            onClick={takePhoto}
            disabled={!hasPermission}
          />

          {/* Enhanced AI Assistant Toggle with Feedback */}
          <div className="flex flex-col items-center relative">
            <Button
              variant="ghost"
              size="sm"
              className={`w-14 h-14 rounded-full backdrop-blur-sm border-2 transition-all duration-300 hover:scale-105 active:scale-100 relative overflow-hidden ${
                isAiEnabled 
                  ? 'bg-gradient-to-br from-yellow-400/30 to-orange-400/30 border-yellow-400 shadow-lg shadow-yellow-400/20' 
                  : 'bg-gray-600/30 border-gray-500 shadow-none'
              }`}
              onClick={toggleAi}
            >
              {/* Active AI Pulse Animation */}
              {isAiEnabled && (
                <>
                  <div className="absolute inset-0 rounded-full bg-yellow-400/20 animate-pulse"></div>
                  <div className="absolute inset-0 rounded-full border-2 border-yellow-400/50 animate-ping"></div>
                </>
              )}
              
              {/* AI Processing Indicator */}
              {isAnalyzing && isAiEnabled && (
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400/20 to-green-400/20 animate-spin" style={{ animationDuration: '2s' }}></div>
              )}
              
              <img
                src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/000-DvnwPZFzPFVIZxJsHQeldGPXnmYKLB.png"
                alt="Lion Assistant"
                className={`w-8 h-8 rounded-full object-cover transition-all duration-300 relative z-10 ${
                  isAiEnabled ? 'opacity-100 brightness-110' : 'opacity-50 grayscale'
                } ${
                  isAnalyzing && isAiEnabled ? 'animate-bounce' : ''
                }`}
              />
              
              {/* Connection Status Dot */}
              <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-black transition-all duration-300 ${
                !isAiEnabled ? 'bg-gray-500' :
                isApiConnected ? 'bg-green-400 animate-pulse' : 'bg-red-500'
              }`}></div>
            </Button>
            
            {/* Enhanced AI Status Display */}
            <div className="flex flex-col items-center mt-1">
              <span className={`text-xs font-bold transition-colors duration-300 ${
                isAiEnabled ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                AI {isAiEnabled ? 'ON' : 'OFF'}
              </span>
              
              {/* Analysis Status */}
              {isAiEnabled && (
                <span className={`text-xs transition-colors duration-300 ${
                  isAnalyzing ? 'text-blue-400 animate-pulse' : 
                  isApiConnected ? 'text-green-400' : 'text-red-400'
                }`}>
                  {isAnalyzing ? 'Analyzing...' : 
                   isApiConnected ? 'Ready' : 'Offline'}
                </span>
              )}
            </div>
            
            {/* Guidance Count Badge */}
            {currentGuidance && currentGuidance.suggestions && isAiEnabled && currentGuidance.suggestions.length > 0 && (
              <div className="absolute -top-2 -left-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center border-2 border-black animate-pulse">
                <span className="text-white text-xs font-bold">{currentGuidance.suggestions.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
