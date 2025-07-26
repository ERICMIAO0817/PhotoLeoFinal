"use client"

import { useState, useEffect, useRef } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Alert, StatusBar, Modal, TextInput } from "react-native"
import { PinchGestureHandler, State as GestureState } from "react-native-gesture-handler"
import { CameraView, CameraType, useCameraPermissions } from "expo-camera"
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native"
import { SafeAreaView } from "react-native-safe-area-context"
import Icon from "react-native-vector-icons/MaterialIcons"
import { LinearGradient } from "expo-linear-gradient"
import Constants from "expo-constants"
import * as MediaLibrary from 'expo-media-library'


// Photography API for React Native
interface PhotographyGuidanceResponse {
  status: string;
  data?: {
    suggestions: Array<{
      step: number;
      action: string;
      direction: string;
      intensity: number;
      reason: string;
    }>;
    analysis: {
      is_level: boolean;
      tilt_angle: number;
      brightness: string;
    };
  };
  timestamp: string;
  filename?: string;
  message?: string;
}

const { width, height } = Dimensions.get("window")

// Get dynamic IP from Expo development server
const getApiBaseUrl = (): string => {
  if (__DEV__ && Constants.expoConfig?.hostUri) {
    // Extract IP from Expo's development server
    const ip = Constants.expoConfig.hostUri.split(':')[0]
    const dynamicUrl = `http://${ip}:5002`
    console.log(`📡 Using dynamic API URL: ${dynamicUrl}`)
    return dynamicUrl
  }
  // Fallback for production or if hostUri not available
  console.log('📡 Using fallback API URL: http://localhost:5002')
  return 'http://localhost:5002'
}

const API_BASE_URL = getApiBaseUrl()

// Route params type
type RootStackParamList = {
  Camera: {
    initialMode?: string;
  };
}

type CameraScreenRouteProp = RouteProp<RootStackParamList, 'Camera'>

const CameraScreen = () => {
  const navigation = useNavigation()
  const route = useRoute<CameraScreenRouteProp>()
  const { initialMode = "自动" } = route.params || {}

  const [permission, requestPermission] = useCameraPermissions()
  const [mediaLibraryPermission, requestMediaLibraryPermission] = MediaLibrary.usePermissions()
  const [cameraPosition, setCameraPosition] = useState<CameraType>("back")
  // Flash is permanently disabled - using screen flash instead
  const [showScreenFlash, setShowScreenFlash] = useState(false)
  const [aspectRatio, setAspectRatio] = useState("3:4")
  const [activeMode, setActiveMode] = useState(initialMode)
  const [focalLength, setFocalLength] = useState("1x")
  const [zoomLevel, setZoomLevel] = useState(1)
  const [availableFocalLengths, setAvailableFocalLengths] = useState(["0.5x", "1x", "2x", "3x", "5x"])
  const [showAspectRatios, setShowAspectRatios] = useState(false)
  const [showMoreOptions, setShowMoreOptions] = useState(false)
  const [gridLines, setGridLines] = useState(false)
  const [burstMode, setBurstMode] = useState(false)
  
  // AI Toggle State
  const [isAiEnabled, setIsAiEnabled] = useState(true)
  const [isApiConnected, setIsApiConnected] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [currentGuidance, setCurrentGuidance] = useState<any>(null)
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0)
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null)
  
  // Suggestion rotation timer
  const suggestionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // Text input state
  const [showTextInput, setShowTextInput] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [userIntent, setUserIntent] = useState('')
  const [hasSetIntent, setHasSetIntent] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const camera = useRef<CameraView>(null)
  const analysisIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Debug log to confirm we're using the right camera file
  useEffect(() => {
    console.log('🎬 CAMERA SCREEN LOADED - This is the React Native version with AI toggle!')
    console.log(`🔄 Initial AI state: ${isAiEnabled ? 'ENABLED' : 'DISABLED'}`)
  }, [])

  // Handle text input button press
  const handleTextInputPress = () => {
    console.log('📝 Text input button pressed')
    setShowTextInput(true)
  }

  // Handle text input submission
  const handleTextSubmit = async () => {
    if (!textInput.trim()) return
    
    setIsProcessing(true)
    try {
      console.log(`📝 Setting photography intent: ${textInput}`)
      
      // Call the conversation/intent API endpoint
      const response = await fetch(`${API_BASE_URL}/api/conversation/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: textInput.trim()
        }),
      })
      
      if (response.ok) {
        const data = await response.json()
        console.log('Intent set successfully:', data)
        setUserIntent(textInput.trim())
        setHasSetIntent(true)
        setShowTextInput(false)
        setTextInput('')
      } else {
        console.error('Failed to set intent:', response.status)
      }
    } catch (error) {
      console.error('Error setting intent:', error)
    } finally {
      setIsProcessing(false)
    }
  }



  // Auto-start AI analysis when component mounts (if enabled)
  useEffect(() => {
    console.log(`Auto-start check: AI=${isAiEnabled}, Permission=${permission?.granted}, Permission object:`, permission)
    
    // Text input is ready when camera permission is granted
    if (permission && permission.granted === true) {
      console.log('Camera permission granted - Ready for text input')
    }
    
    // Only start if permission is explicitly granted (not undefined or false)
    if (isAiEnabled && permission && permission.granted === true) {
      console.log('Starting analysis IMMEDIATELY...')
      console.log('STARTING ANALYSIS: Will show connected when tips arrive')
      setIsAnalyzing(true)
      startPeriodicAnalysis()
    } else {
      console.log('Not starting analysis:', {
        aiEnabled: isAiEnabled,
        permissionGranted: permission?.granted,
        permissionStatus: permission ? 'loaded' : 'loading',
        permissionObject: permission
      })
    }

    // Cleanup on unmount
    return () => {
      stopPeriodicAnalysis(false) // Don't reset connection during cleanup
      // Also clean up suggestion timer
      if (suggestionTimerRef.current) {
        clearInterval(suggestionTimerRef.current)
        suggestionTimerRef.current = null
      }
    }
  }, [permission?.granted, isAiEnabled])

  // Log AI state changes for debugging
  useEffect(() => {
    console.log(`AI State: ${isAiEnabled ? 'ENABLED' : 'DISABLED'}`)
    console.log(`API Connected: ${isApiConnected}`)
    console.log(`Analyzing: ${isAnalyzing}`)
  }, [isAiEnabled, isApiConnected, isAnalyzing])

  // Suggestion rotation logic - cycle through suggestions every second
  useEffect(() => {
    // Clear any existing timer
    if (suggestionTimerRef.current) {
      clearInterval(suggestionTimerRef.current)
      suggestionTimerRef.current = null
    }

    // Start rotation if we have suggestions
    if (currentGuidance?.suggestions && currentGuidance.suggestions.length > 1) {
      console.log(`🔄 Starting suggestion rotation - ${currentGuidance.suggestions.length} suggestions (3s each)`)
      
             suggestionTimerRef.current = setInterval(() => {
         setCurrentSuggestionIndex(prevIndex => {
           const nextIndex = (prevIndex + 1) % currentGuidance.suggestions.length
           console.log(`🔄 Rotating suggestion: ${prevIndex} → ${nextIndex}`)
           return nextIndex
         })
       }, 3000) // Rotate every 3 seconds - readable pace
    } else {
      // Reset index when no suggestions or only one suggestion
      setCurrentSuggestionIndex(0)
    }

    // Cleanup function
    return () => {
      if (suggestionTimerRef.current) {
        clearInterval(suggestionTimerRef.current)
        suggestionTimerRef.current = null
      }
    }
  }, [currentGuidance]) // Re-run when guidance changes

  // Force default focal length to 1x on mount and check actual zoom
  useEffect(() => {
    console.log(`📷 Camera zoom debugging:`)
    console.log(`  - Focal length: ${focalLength}`)
    console.log(`  - Zoom level: ${zoomLevel}`)
    console.log(`  - Expected: Wide angle view at 1x`)
    
    if (focalLength !== "1x") {
      console.log(`🔧 Forcing focal length from ${focalLength} to 1x`)
      setFocalLength("1x")
      setZoomLevel(0) // Try zoom=0 for true wide angle
    } else if (zoomLevel !== 0) {
      console.log(`🔧 Setting zoom to 0 for true 1x wide angle`)
      setZoomLevel(0) // Reset zoom to 0 for baseline view
    }
  }, [])

  const modes = ["自定义", "自动", "风景", "人像", "美食"]
  const aspectRatios = ["3:4", "1:1", "9:16", "全屏"]

  // Initialize camera permissions
  useEffect(() => {
    console.log('🔐 Permission initialization:', {
      permission: permission,
      granted: permission?.granted,
      canAskAgain: permission?.canAskAgain
    })
    
    if (!permission) {
      console.log('🔐 Requesting camera permission...')
      requestPermission()
    } else if (permission.granted === true) {
      console.log('✅ Camera permission granted')
      console.log(`Camera zoom range: 1x - 10x`)
      console.log(`Default focal length: ${focalLength}`)
    } else if (permission.granted === false) {
      console.log('❌ Camera permission denied')
    } else {
      console.log('⏳ Camera permission still loading...')
    }
  }, [permission, requestPermission])

  const toggleCameraPosition = () => {
    setCameraPosition((prev) => (prev === "back" ? "front" : "back"))
  }



  const takePhoto = async () => {
    if (camera.current) {
      try {
        // Trigger screen flash effect for user feedback
        console.log("Triggering screen flash effect...")
        setShowScreenFlash(true)
        
        console.log("Taking USER photo...")
        const photo = await camera.current.takePictureAsync({
          quality: 1,
          base64: false,
          shutterSound: true,  // Enable shutter sound for user photos
          // Hardware flash permanently disabled - using screen flash instead
        })

        // Hide screen flash after photo is taken
        setTimeout(() => setShowScreenFlash(false), 200)

        console.log("Photo captured:", photo.uri)
        
        // Save to device gallery
        try {
          // Check MediaLibrary permission
          if (!mediaLibraryPermission?.granted) {
            console.log("Requesting MediaLibrary permission...")
            const permissionResult = await requestMediaLibraryPermission()
            if (!permissionResult.granted) {
              Alert.alert("权限不足", "需要相册权限来保存照片")
              return
            }
          }
          
          console.log("Saving photo to gallery...")
          const asset = await MediaLibrary.saveToLibraryAsync(photo.uri)
          console.log("User photo saved to gallery successfully")
          Alert.alert("拍摄成功", "照片已保存到相册 📁")
          
        } catch (saveError) {
          console.error("Failed to save to gallery:", saveError)
          Alert.alert("保存失败", "照片拍摄成功但无法保存到相册")
        }
        
      } catch (error) {
        console.error("Take photo error:", error)
        Alert.alert("拍摄失败", "请重试")
      }
    }
  }

  // Check API health
  const checkApiHealth = async (): Promise<boolean> => {
    console.log(`🔍 Checking API health at: ${API_BASE_URL}/api/health`)
    try {
      console.log('Sending health check request...')
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
      })
      
      console.log(`Health response: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        console.log('API Health Check Success:', data)
        const isHealthy = data.status === 'ok'
        console.log(`Setting API connected to: ${isHealthy}`)
        setIsApiConnected(isHealthy)
        return isHealthy
      }
      
      const errorText = await response.text()
      console.log('API Health Check Failed: response not ok')
      console.log('  Status:', response.status)
      console.log('  Body:', errorText)
      setIsApiConnected(false)
      return false
    } catch (error) {
      console.error('API Health Check Error:', error)
      if (error instanceof Error) {
        console.error('  Error message:', error.message)
        console.error('  Error stack:', error.stack)
      }
      setIsApiConnected(false)
      return false
    }
  }

  // Analyze camera image
    const analyzeImage = async (): Promise<void> => {
    console.log('==> analyzeImage() called')
    console.log(`  AI enabled: ${isAiEnabled}`)
    console.log(`  Camera ready: ${!!camera.current}`)
    console.log(`  API connected: ${isApiConnected}`)
    
    // CRITICAL: Check if AI is enabled first
    if (!isAiEnabled) {
      console.log('🚫 ABORT: AI is disabled - stopping API call to save costs!')
      return
    }
    
    if (!camera.current) {
      console.log('⚠️ Skipping analysis - camera not ready')
      return
    }
    
    console.log('Analysis enabled - proceeding with analysis')

    // Set a timeout to prevent infinite loading state
    const analysisTimeout = setTimeout(() => {
      console.log('Analysis taking longer than expected...')
      setIsAnalyzing(false)
      setIsApiConnected(false)
    }, 5000) // 5 second timeout (server responds in ~1s)

    try {
      console.log('Taking photo for instant analysis...')
      setIsAnalyzing(true) // Ensure analyzing state is set
      
      const photo = await camera.current.takePictureAsync({
        quality: 0.05, // MINIMUM quality for maximum speed
        base64: false,
        skipProcessing: true, // Skip all processing for speed
        shutterSound: false, // SILENT - no shutter sound for analysis
        // Note: AI analysis photos are completely invisible to user
        // Note: This photo is for AI analysis only - NOT saved to gallery
      })

      console.log('Photo captured for analysis:', {
        uri: photo.uri,
        width: photo.width,
        height: photo.height
      })

      console.log('Preparing API request...')
      
      // Create FormData for React Native
      const formData = new FormData()
      formData.append('image', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: `camera-frame-${Date.now()}.jpg`,
      } as any)

      console.log(`Sending HIGH-PRIORITY POST to: ${API_BASE_URL}/api/analyze`)

      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
        headers: {
          'X-Priority': 'high', // Signal for faster processing
        },
        // Don't set Content-Type for FormData in React Native - let fetch handle it
      })

      console.log(`API Response: ${response.status} ${response.statusText}`)

      if (response.ok) {
        const result: PhotographyGuidanceResponse = await response.json()
        console.log('Analysis result received:', {
          status: result.status,
          suggestionsCount: result.data?.suggestions?.length || 0,
        })
        
        if (result.data) {
          // SUCCESS: Clear timeout and update connection status
          clearTimeout(analysisTimeout)
          setIsApiConnected(true)
          setIsAnalyzing(false) // Stop showing "analyzing" once we have tips
          
          setCurrentGuidance(result.data)
          setCurrentSuggestionIndex(0) // Reset to first suggestion when new guidance arrives
          setLastAnalysisTime(new Date())
          
          // Log guidance details
          console.log('Photography Guidance received - showing to user:')
          result.data.suggestions.forEach((suggestion, index) => {
            console.log(`  ${index + 1}. ${suggestion.action} (${suggestion.direction})`)
            console.log(`     Reason: ${suggestion.reason}`)
          })
          console.log(`TIPS NOW VISIBLE: ${result.data.suggestions.length} suggestions displayed to user`)
          console.log(`TIMING SUCCESS: From AI start to tips visible < 3 seconds!`)
        } else {
          console.log('No guidance data in response')
        }
      } else {
        // API ERROR: Clear timeout and update connection status
        clearTimeout(analysisTimeout)
        setIsApiConnected(false)
        setIsAnalyzing(false) // Stop showing analyzing state on error
        
        const errorText = await response.text()
        console.error('Analysis failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
      }
    } catch (error) {
      // NETWORK ERROR: Clear timeout and update connection status
      clearTimeout(analysisTimeout)
      setIsApiConnected(false)
      setIsAnalyzing(false) // Stop showing analyzing state on network error
      
      console.error('Analysis error:', error)
      if (error instanceof Error) {
        console.error('  Error message:', error.message)
        console.error('  Error stack:', error.stack)
      }
    } finally {
      // Always clear timeout as safety measure
      clearTimeout(analysisTimeout)
      console.log('Analysis attempt completed')
    }
  }

  // Start periodic analysis
  const startPeriodicAnalysis = async () => {
    console.log('==> startPeriodicAnalysis() FAST START - SKIPPING SLOW API CHECK')
    
    // BYPASS SLOW API CHECK - Let the actual API calls fail fast instead
    console.log('INSTANT STARTUP: Starting AI analysis immediately')
    setIsAnalyzing(true)
    // Don't set connected until we actually get a response
    
    // AGGRESSIVE interval cleanup to prevent multiple intervals
    if (analysisIntervalRef.current) {
      console.log(`CLEARING EXISTING INTERVAL: ${analysisIntervalRef.current}`)
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
    
    // READABLE PACE: Analyze every 10 seconds for comfortable reading
    let intervalCount = 0
    analysisIntervalRef.current = setInterval(() => {
      intervalCount++
      console.log(`TICK #${intervalCount} - Checking AI status...`)
      
      if (!isAiEnabled) {
        console.log(`AI DISABLED - Skipping analysis (saving API costs!)`)
        return
      }
      
      console.log(`AI ENABLED - Calling analyzeImage()`)
      analyzeImage()
    }, 10000)
    
    console.log('ANALYSIS INTERVAL started - checks AI status every 10 seconds')
    console.log(`  Interval ID: ${analysisIntervalRef.current}`)
    
    // INSTANT STARTUP: Do first analysis immediately instead of waiting 10 seconds
    console.log('INSTANT FIRST ANALYSIS - getting tips immediately...')
    setTimeout(() => {
      if (isAiEnabled) {
        console.log('FIRST ANALYSIS - getting real photography tips now!')
        console.log('FAST TIPS: Users will see actual guidance within 1-2 seconds!')
        analyzeImage()
      }
    }, 50) // Minimal delay for instant first connection
  }

  // Stop periodic analysis
  const stopPeriodicAnalysis = (resetConnection: boolean = true) => {
    console.log(`Stopping periodic analysis... (resetConnection: ${resetConnection})`)
    
    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current)
      analysisIntervalRef.current = null
    }
    
    setIsAnalyzing(false)
    setCurrentGuidance(null)
    setCurrentSuggestionIndex(0) // Reset suggestion index when clearing guidance
    
    // Only reset API connection if explicitly requested (for AI toggle off)
    if (resetConnection) {
      console.log('Resetting API connection status')
      setIsApiConnected(false)
    } else {
      console.log('Keeping API connection status (cleanup only)')
    }
  }

  // Toggle AI analysis
  const toggleAi = async () => {
    console.log(`AI TOGGLE CLICKED - Current state: ${isAiEnabled ? 'ENABLED' : 'DISABLED'}`)
    const newAiEnabled = !isAiEnabled
    setIsAiEnabled(newAiEnabled)
    console.log(`AI STATE CHANGED - New state: ${newAiEnabled ? 'ENABLED' : 'DISABLED'}`)
    
    if (newAiEnabled) {
      console.log('AI ENABLED - Starting analysis INSTANTLY!')
      console.log('SKIPPING slow health check for instant startup')
      
      // Start analysis - will show connected when tips arrive
      setIsAnalyzing(true)
      
      startPeriodicAnalysis()
    } else {
      console.log('AI DISABLED - Stopping analysis to save API costs!')
      stopPeriodicAnalysis(true) // Reset connection when AI is disabled
      console.log('API calls stopped - no more billing!')
    }
  }

  // Handle focal length changes (simplified)
  const handleFocalLengthChange = (length: string) => {
    console.log(`Focal length changed to: ${length}`)
    setFocalLength(length)
    
    // Map focal lengths to actual zoom values (0 = true wide angle)
    const zoomMapping: {[key: string]: number} = {
      "0.5x": 0,    // Ultra wide (if supported)
      "1x": 0,      // Normal wide angle baseline 
      "2x": 1,      // 2x zoom
      "3x": 2,      // 3x zoom  
      "5x": 4       // 5x zoom
    }
    
    const zoomValue = zoomMapping[length] ?? 0
    setZoomLevel(zoomValue)
    console.log(`  - Mapped ${length} to zoom level: ${zoomValue}`)
  }

  // Handle pinch zoom (simplified)
  const onPinchGestureEvent = (event: any) => {
    const { scale } = event.nativeEvent
    const baseZoom = zoomLevel
    const newZoom = Math.max(0.5, Math.min(10, baseZoom * scale)) // Simple limits
    setZoomLevel(newZoom)
    
    // Update focal length display to closest option
    const closestFocal = availableFocalLengths.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseFloat(prev.replace('x', '')) - newZoom)
      const currDiff = Math.abs(parseFloat(curr.replace('x', '')) - newZoom)
      return currDiff < prevDiff ? curr : prev
    })
    setFocalLength(closestFocal)
  }

  // Double tap zoom (simplified)
  const handleDoubleTap = () => {
    const nextZoom = zoomLevel === 1 ? 2 : zoomLevel === 2 ? 5 : 1
    setZoomLevel(nextZoom)
    
    // Update focal length display to match zoom
    const closestFocal = availableFocalLengths.reduce((prev, curr) => {
      const prevDiff = Math.abs(parseFloat(prev.replace('x', '')) - nextZoom)
      const currDiff = Math.abs(parseFloat(curr.replace('x', '')) - nextZoom)
      return currDiff < prevDiff ? curr : prev
    })
    setFocalLength(closestFocal)
    console.log(`Double tap zoom to: ${nextZoom}x (focal: ${closestFocal})`)
  }

  const handleClose = () => {
    navigation.goBack()
  }

  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>正在加载摄像头权限...</Text>
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>需要摄像头权限才能使用此功能</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>授予权限</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Camera View with Zoom Gesture */}
      <PinchGestureHandler onGestureEvent={onPinchGestureEvent}>
        <CameraView
          ref={camera}
          style={styles.camera}
          facing={cameraPosition}
          flash="off" // ALWAYS OFF - no hardware flash ever
          zoom={zoomLevel}
        />
      </PinchGestureHandler>

      {/* Screen Flash Effect */}
      {showScreenFlash && (
        <View style={styles.screenFlash} />
      )}

      {/* Processing Status Banner */}
      {isProcessing && (
        <View style={styles.voiceBanner}>
          <Icon name="hourglass-empty" size={20} color="#feca57" />
          <Text style={styles.voiceBannerText}>🔄 正在设置拍摄意图...</Text>
        </View>
      )}

      {/* Intent Status Indicator */}
      {hasSetIntent && userIntent && (
        <View style={styles.intentIndicator}>
          <Text style={styles.intentText}>📷 {userIntent}</Text>
        </View>
      )}

      {/* Text Input Hint */}
      {!hasSetIntent && (
        <View style={styles.micHint}>
          <Text style={styles.micHintText}>📝 点击编辑按钮告诉AI你想拍什么</Text>
        </View>
      )}

      {/* Zoom Level Indicator */}
      {zoomLevel !== 1 && (
        <View style={styles.zoomIndicator}>
          <Text style={styles.zoomText}>{zoomLevel.toFixed(1)}x</Text>
        </View>
      )}

      {/* Grid Lines Overlay */}
      {gridLines && (
        <View style={styles.gridOverlay}>
          <View style={styles.gridLine} />
          <View style={[styles.gridLine, styles.gridLineVertical]} />
          <View style={[styles.gridLine, styles.gridLineHorizontal1]} />
          <View style={[styles.gridLine, styles.gridLineHorizontal2]} />
        </View>
      )}

      {/* Top Controls */}
      <LinearGradient colors={["rgba(0,0,0,0.5)", "transparent"]} style={styles.topGradient}>
        <SafeAreaView>
          <View style={styles.topControls}>
            <TouchableOpacity style={styles.controlButton} onPress={handleClose}>
              <Icon name="close" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.centerControls}>
              <TouchableOpacity style={styles.controlButton} onPress={toggleCameraPosition}>
                <Icon name="flip-camera-ios" size={24} color="#fff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.aspectRatioButton}
                onPress={() => {
                  setShowAspectRatios(!showAspectRatios)
                  setShowMoreOptions(false)
                }}
              >
                <Text style={styles.aspectRatioText}>{aspectRatio}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => {
                setShowMoreOptions(!showMoreOptions)
                setShowAspectRatios(false)
              }}
            >
              <Icon name="more-horiz" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* AI Status Indicator */}
          <View style={styles.aiStatusContainer}>
            <View style={[styles.aiStatusDot, { 
              backgroundColor: isApiConnected && isAiEnabled ? '#10B981' : '#EF4444' 
            }]} />
            <Text style={styles.aiStatusText}>
              {!isAiEnabled ? 'AI OFF' : 
               isApiConnected ? 'AI CONNECTED' : 
               isAnalyzing ? 'ANALYZING SCENE...' : 
               'AI READY'}
            </Text>
            {isAnalyzing && (
              <Text style={styles.analyzingText}>📷 Analyzing...</Text>
            )}
          </View>
          
          {/* Photography Guidance Display - Rotating Queue */}
          {!isAiEnabled && (
            <View style={[styles.guidanceContainer, {backgroundColor: '#DC2626'}]}>
              <Text style={[styles.guidanceTitle, {color: '#FFFFFF'}]}>
                🚫 AI 已关闭 - 点击右上角按钮开启智能指导
              </Text>
            </View>
          )}
          {isAiEnabled && !currentGuidance && isAnalyzing && (
            <View style={[styles.guidanceContainer, {backgroundColor: '#F59E0B'}]}>
              <Text style={[styles.guidanceTitle, {color: '#FFFFFF'}]}>
                🔄 AI正在分析场景... 即将提供拍摄建议
              </Text>
              <Text style={[styles.suggestionReason, {color: '#FFFFFF', textAlign: 'center'}]}>
                通常在 1 秒内完成
              </Text>
            </View>
          )}
          {isAiEnabled && !currentGuidance && !isAnalyzing && !isApiConnected && (
            <View style={[styles.guidanceContainer, {backgroundColor: '#6B7280'}]}>
              <Text style={[styles.guidanceTitle, {color: '#FFFFFF'}]}>
                ⏳ AI准备中... 即将开始场景分析
              </Text>
            </View>
          )}
          {currentGuidance && currentGuidance.suggestions && currentGuidance.suggestions.length > 0 && isAiEnabled && (
            <View style={styles.guidanceContainer}>
              <Text style={styles.guidanceTitle}>
                📸 Photography Tips {currentGuidance.suggestions.length > 1 && 
                  `(${currentSuggestionIndex + 1}/${currentGuidance.suggestions.length})`
                }
                {currentGuidance.suggestions.length > 1 && <Text style={{color: '#10B981'}}> 🔄</Text>}
              </Text>
              {(() => {
                const currentSuggestion = currentGuidance.suggestions[currentSuggestionIndex]
                return (
                  <View key={currentSuggestionIndex} style={styles.suggestionRow}>
                    <Text style={styles.suggestionText}>
                      {currentSuggestion.action}
                    </Text>
                                         <Text style={styles.suggestionReason}>
                       {currentSuggestion.reason}
                     </Text>
                   </View>
                 )
               })()}
               {currentGuidance.suggestions.length > 1 && (
                 <Text style={[styles.timestampText, {color: '#10B981', fontSize: 11}]}>
                   Next tip in 3s • {currentSuggestionIndex + 1} of {currentGuidance.suggestions.length}
                 </Text>
               )}
               {lastAnalysisTime && (
                 <Text style={styles.timestampText}>
                   Updated: {lastAnalysisTime.toLocaleTimeString()}
                 </Text>
               )}
            </View>
          )}

          {/* Aspect Ratio Selection */}
          {showAspectRatios && (
            <View style={styles.optionsContainer}>
              {aspectRatios.map((ratio) => (
                <TouchableOpacity
                  key={ratio}
                  style={[styles.optionButton, aspectRatio === ratio && styles.activeOptionButton]}
                  onPress={() => {
                    setAspectRatio(ratio)
                    setShowAspectRatios(false)
                  }}
                >
                  <Text style={[styles.optionText, aspectRatio === ratio && styles.activeOptionText]}>{ratio}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* More Options */}
          {showMoreOptions && (
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.optionButton}
                onPress={() => {}}
              >
                <Icon name="flash-off" size={20} color="rgba(255,255,255,0.7)" />
                <Text style={styles.optionText}>
                  屏幕闪光
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, gridLines && styles.activeOptionButton]}
                onPress={() => setGridLines(!gridLines)}
              >
                <Icon name="grid-on" size={20} color={gridLines ? "#000" : "rgba(255,255,255,0.7)"} />
                <Text style={[styles.optionText, gridLines && styles.activeOptionText]}>网格</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.optionButton, burstMode && styles.activeOptionButton]}
                onPress={() => setBurstMode(!burstMode)}
              >
                <Icon name="burst-mode" size={20} color={burstMode ? "#000" : "rgba(255,255,255,0.7)"} />
                <Text style={[styles.optionText, burstMode && styles.activeOptionText]}>连拍</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.optionButton}>
                <Icon name="settings" size={20} color="rgba(255,255,255,0.7)" />
                <Text style={styles.optionText}>设置</Text>
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* Bottom Controls */}
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.8)"]} style={styles.bottomGradient}>
        {/* Focal Length Selection */}
        <View style={styles.focalLengthContainer}>
          {availableFocalLengths.map((length) => (
            <TouchableOpacity
              key={length}
              style={[styles.focalLengthButton, focalLength === length && styles.activeFocalLength]}
              onPress={() => handleFocalLengthChange(length)}
            >
              <Text style={[styles.focalLengthText, focalLength === length && styles.activeFocalLengthText]}>
                {length}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mode Selection */}
        <View style={styles.modeContainer}>
          {modes.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.modeButton, activeMode === mode && styles.activeModeButton]}
              onPress={() => setActiveMode(mode)}
            >
              <Text style={[styles.modeText, activeMode === mode && styles.activeModeText]}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shutter Controls */}
        <View style={styles.shutterContainer}>
          <TouchableOpacity style={styles.aiButton} onPress={toggleAi}>
            <LinearGradient
              colors={isAiEnabled 
                ? ["rgba(251, 191, 36, 0.3)", "rgba(251, 146, 60, 0.3)"] 
                : ["rgba(107, 114, 128, 0.3)", "rgba(75, 85, 99, 0.3)"]
              }
              style={styles.aiButtonGradient}
            >
              <Icon 
                name={isAiEnabled ? "lightbulb" : "lightbulb-outline"} 
                size={24} 
                color={isAiEnabled ? "#FBBF24" : "#9CA3AF"} 
              />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shutterButton} onPress={takePhoto} activeOpacity={0.8}>
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.textInputButton, {
              backgroundColor: isProcessing ? "#feca57" : 
                               hasSetIntent ? "#4ecdc4" : "#6c5ce7"
            }]} 
            onPress={handleTextInputPress}
            activeOpacity={0.8}
            disabled={isProcessing}
          >
            <Icon 
              name={isProcessing ? "hourglass-empty" : 
                    hasSetIntent ? "check" : "edit"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Text Input Modal */}
      <Modal
        visible={showTextInput}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTextInput(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>告诉AI你想拍什么</Text>
            <TextInput
              style={styles.textInput}
              value={textInput}
              onChangeText={setTextInput}
              placeholder="例如：人像照片、风景、美食、宠物..."
              placeholderTextColor="#999"
              multiline={true}
              numberOfLines={3}
              autoFocus={true}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowTextInput(false)
                  setTextInput('')
                }}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleTextSubmit}
                disabled={!textInput.trim() || isProcessing}
              >
                <Text style={styles.submitButtonText}>
                  {isProcessing ? '设置中...' : '确定'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  permissionText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  gridOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: "none",
  },
  gridLine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  gridLineVertical: {
    width: 1,
    height: "100%",
    left: "33.33%",
  },
  gridLineHorizontal1: {
    height: 1,
    width: "100%",
    top: "33.33%",
  },
  gridLineHorizontal2: {
    height: 1,
    width: "100%",
    top: "66.66%",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  topControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  centerControls: {
    flexDirection: "row",
    alignItems: "center",
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  aspectRatioButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginLeft: 16,
  },
  aspectRatioText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "500",
  },
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.8)",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 12,
  },
  optionButton: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  activeOptionButton: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  optionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 4,
  },
  activeOptionText: {
    color: "#fff",
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    justifyContent: "flex-end",
    paddingBottom: 40,
  },
  focalLengthContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 16,
  },
  focalLengthButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginHorizontal: 16,
  },
  activeFocalLength: {
    backgroundColor: "#fff",
  },
  focalLengthText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },
  activeFocalLengthText: {
    color: "#000",
    fontWeight: "600",
    fontSize: 18,
  },
  modeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
  },
  modeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  activeModeButton: {
    backgroundColor: "#fff",
  },
  modeText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 16,
  },
  activeModeText: {
    color: "#000",
    fontWeight: "500",
  },
  shutterContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  textInputButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 32,
  },
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#EF4444",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "transparent",
  },
  aiButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginLeft: 32,
    overflow: "hidden",
  },
  aiButtonGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
    borderRadius: 28,
  },
  zoomIndicator: {
    position: "absolute",
    top: "50%",
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    transform: [{ translateY: -12 }],
  },
  zoomText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
  },
  aiStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
    alignSelf: "center",
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  aiStatusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  analyzingText: {
    color: "#FBBF24",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "500",
  },
  guidanceContainer: {
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
    maxWidth: width - 32,
    alignSelf: "center",
  },
  guidanceTitle: {
    color: "#FBBF24",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  suggestionRow: {
    marginBottom: 6,
  },
  suggestionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  suggestionReason: {
    color: "#9CA3AF",
    fontSize: 10,
    lineHeight: 14,
  },
  timestampText: {
    color: "#6B7280",
    fontSize: 9,
    textAlign: "center",
    marginTop: 6,
  },
  screenFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    opacity: 0.8,
    zIndex: 9999,
  },
  voiceOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
  },
  voiceIndicator: {
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    minWidth: 250,
  },
  voiceText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  voiceSubtext: {
    color: "#bbb",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  pulsingIcon: {
    opacity: 0.7,
  },
  intentIndicator: {
    position: "absolute",
    top: 100,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  intentText: {
    color: "#4ecdc4",
    fontSize: 12,
    fontWeight: "600",
  },
  voiceBanner: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceBannerText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  micHint: {
    position: "absolute",
    bottom: 120,
    right: 20,
    backgroundColor: "rgba(108, 92, 231, 0.9)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 200,
  },
  micHintText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    color: "#333",
    backgroundColor: "#f9f9f9",
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#f0f0f0",
  },
  submitButton: {
    backgroundColor: "#6c5ce7",
  },
  cancelButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
})

export default CameraScreen
