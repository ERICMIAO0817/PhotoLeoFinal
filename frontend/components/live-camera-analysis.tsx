"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Camera, CameraOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Target, Loader2 } from "lucide-react"

interface AnalysisResult {
  direction: string
  instruction: string
  platform: string
  timestamp: string
  analysis: {
    face_detected: boolean
    confidence: number
    recommended_action: string
    detailed_instruction: string
  }
}

export function LiveCameraAnalysis() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [analysisCount, setAnalysisCount] = useState(0)
  const [debugLog, setDebugLog] = useState<string[]>([])

  const API_BASE_URL = 'http://localhost:3001'

  const startCamera = useCallback(async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 }, 
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsStreaming(true)
        console.log('📹 Camera started successfully')
      }
    } catch (err) {
      setError('无法访问摄像头: ' + (err as Error).message)
      console.error('Camera error:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      videoRef.current.srcObject = null
      setIsStreaming(false)
      setAnalysisResult(null)
      console.log('📹 Camera stopped')
    }
  }, [])

  const addDebugLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    const logEntry = `[${timestamp}] ${message}`
    setDebugLog(prev => [...prev.slice(-4), logEntry]) // Keep last 5 entries
    console.log(logEntry)
  }, [])

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) return

    setIsAnalyzing(true)
    setError(null)
    addDebugLog('🔄 Starting analysis...')

    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('无法获取canvas上下文')
      }

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw current frame
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      addDebugLog(`📷 Captured frame: ${canvas.width}x${canvas.height}`)

      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/jpeg', 0.8)
      })

      // Send to backend API
      const formData = new FormData()
      formData.append('image', blob, 'camera_frame.jpg')

      addDebugLog('📡 Sending frame to /api/analysis...')
      const startTime = Date.now()
      const response = await fetch(`${API_BASE_URL}/api/analysis`, {
        method: 'POST',
        body: formData,
      })

      const responseTime = Date.now() - startTime
      addDebugLog(`⏱️ API response: ${response.status} (${responseTime}ms)`)

      if (!response.ok) {
        throw new Error(`服务器错误: ${response.statusText}`)
      }

      const result: AnalysisResult = await response.json()
      addDebugLog(`✅ Result: ${result.direction} - ${result.instruction}`)
      
      setAnalysisResult(result)
      setAnalysisCount(prev => prev + 1)

    } catch (err) {
      const errorMsg = '分析失败: ' + (err as Error).message
      setError(errorMsg)
      addDebugLog(`❌ Error: ${(err as Error).message}`)
    } finally {
      setIsAnalyzing(false)
    }
  }, [isStreaming, addDebugLog])

  // Auto-analysis every 3 seconds when streaming
  useEffect(() => {
    if (!isStreaming) return

    const interval = setInterval(() => {
      if (!isAnalyzing) {
        captureAndAnalyze()
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isStreaming, isAnalyzing, captureAndAnalyze])

  const getDirectionArrow = (direction: string) => {
    const arrowStyle = "w-8 h-8 text-blue-500 animate-pulse"
    
    switch (direction) {
      case 'up':
        return <ArrowUp className={arrowStyle} />
      case 'down':
        return <ArrowDown className={arrowStyle} />
      case 'left':
        return <ArrowLeft className={arrowStyle} />
      case 'right':
        return <ArrowRight className={arrowStyle} />
      case 'center':
        return <Target className="w-8 h-8 text-green-500 animate-pulse" />
      default:
        return <Target className="w-8 h-8 text-gray-400" />
    }
  }

  const getDirectionColor = (direction: string) => {
    switch (direction) {
      case 'center':
        return 'text-green-500 bg-green-50 border-green-200'
      case 'up':
      case 'down':
      case 'left':
      case 'right':
        return 'text-blue-500 bg-blue-50 border-blue-200'
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6 relative">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            实时摄像头分析
            {analysisCount > 0 && (
              <span className="text-sm font-normal text-gray-500">
                (已分析 {analysisCount} 次)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Camera Controls */}
          <div className="flex gap-2">
            {!isStreaming ? (
              <Button onClick={startCamera} className="flex items-center gap-2">
                <Camera className="w-4 h-4" />
                开启摄像头
              </Button>
            ) : (
              <>
                <Button onClick={stopCamera} variant="destructive" className="flex items-center gap-2">
                  <CameraOff className="w-4 h-4" />
                  关闭摄像头
                </Button>
                <Button 
                  onClick={captureAndAnalyze} 
                  disabled={isAnalyzing}
                  className="flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Target className="w-4 h-4" />
                  )}
                  {isAnalyzing ? '分析中...' : '立即分析'}
                </Button>
              </>
            )}
          </div>

          {/* Video Feed */}
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="w-full h-auto max-h-96 object-cover"
              playsInline
              muted
            />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="flex items-center gap-2 text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>AI 分析中...</span>
                </div>
              </div>
            )}
          </div>

          {/* Hidden Canvas for Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Error Display */}
          {error && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          {/* Analysis Results */}
          {analysisResult && (
            <Card className={`border-2 ${getDirectionColor(analysisResult.direction)}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getDirectionArrow(analysisResult.direction)}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {analysisResult.direction === 'center' ? '完美居中!' : '调整建议'}
                      </h3>
                      <p className="text-sm text-gray-600">
                        平台: {analysisResult.platform} | 
                        置信度: {Math.round(analysisResult.analysis.confidence * 100)}%
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-lg font-medium">
                    {analysisResult.instruction}
                  </p>
                  <p className="text-sm text-gray-600">
                    推荐动作: {analysisResult.analysis.recommended_action}
                  </p>
                  <p className="text-xs text-gray-500">
                    分析时间: {new Date(analysisResult.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Instructions */}
          <div className="text-sm text-gray-600 space-y-1">
            <p><strong>使用说明:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>点击"开启摄像头"允许浏览器访问您的摄像头</li>
              <li>系统将每3秒自动分析一次您的面部位置</li>
              <li>根据箭头指示调整您的位置以获得最佳构图</li>
              <li>绿色目标图标表示您的面部已完美居中</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Floating Debug Overlay */}
      {debugLog.length > 0 && (
        <div className="fixed top-4 right-4 z-50 bg-black bg-opacity-80 text-white p-3 rounded-lg text-xs font-mono max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-green-400">🔍 Live Debug</span>
            <button 
              onClick={() => setDebugLog([])}
              className="text-gray-400 hover:text-white text-xs"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {debugLog.map((log, index) => (
              <div key={index} className="text-xs leading-tight">
                {log}
              </div>
            ))}
          </div>
          {analysisResult && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-yellow-400 font-semibold">Latest Result:</div>
              <div className="text-green-400">Direction: {analysisResult.direction}</div>
              <div className="text-blue-400">Platform: {analysisResult.platform}</div>
              <div className="text-gray-300">Count: {analysisCount}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}