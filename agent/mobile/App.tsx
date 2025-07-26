import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  Dimensions,
  StatusBar,
  PermissionsAndroid,
  Platform,
} from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface AnalysisResult {
  direction: string;
  instruction: string;
}

const FaceCenterApp: React.FC = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [currentDirection, setCurrentDirection] = useState<string>('center');
  const [currentInstruction, setCurrentInstruction] = useState<string>('Position your face in the center');
  const [isLiveMode, setIsLiveMode] = useState(false);
  
  const analysisInterval = useRef<NodeJS.Timeout | null>(null);
  const maxAnalysisCount = 5;
  const serverUrl = 'http://localhost:3000'; // Update with your server IP for device testing

  useEffect(() => {
    requestCameraPermission();
    return () => {
      if (analysisInterval.current) {
        clearInterval(analysisInterval.current);
      }
    };
  }, []);

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access to analyze face positioning',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } catch (err) {
        console.warn(err);
        setHasPermission(false);
      }
    } else {
      // iOS permissions handled automatically
      setHasPermission(true);
    }
  };

  const startLiveAnalysis = () => {
    setAnalysisCount(0);
    setIsLiveMode(true);
    setCurrentInstruction('Starting live analysis...');
    
    // First analysis after 2 seconds
    setTimeout(() => {
      if (isLiveMode) {
        performAnalysis();
      }
    }, 2000);
    
    // Continue every 3 seconds
    analysisInterval.current = setInterval(() => {
      if (isLiveMode && analysisCount < maxAnalysisCount) {
        performAnalysis();
      } else if (analysisCount >= maxAnalysisCount) {
        stopLiveAnalysis();
      }
    }, 3000);
  };

  const stopLiveAnalysis = () => {
    setIsLiveMode(false);
    if (analysisInterval.current) {
      clearInterval(analysisInterval.current);
      analysisInterval.current = null;
    }
    setCurrentInstruction('Analysis complete - Tap camera to analyze again');
  };

  const performAnalysis = async () => {
    if (isAnalyzing) return;
    
    setIsAnalyzing(true);
    setAnalysisCount(prev => prev + 1);
    
    try {
      // In a real implementation, you'd capture the current frame
      // and send it to your server for analysis
      const mockAnalysis = await simulateAnalysis();
      
      setCurrentDirection(mockAnalysis.direction);
      setCurrentInstruction(mockAnalysis.instruction);
      
    } catch (error) {
      console.error('Analysis error:', error);
      setCurrentInstruction('Analysis failed - Try again');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Mock analysis function - replace with actual server call
  const simulateAnalysis = async (): Promise<AnalysisResult> => {
    // Simulate server call delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const directions = [
      { direction: 'center', instruction: '✓ Perfect! Your face is centered' },
      { direction: 'left', instruction: '← Move phone left (or move your hand right)' },
      { direction: 'right', instruction: '→ Move phone right (or move your hand left)' },
      { direction: 'up', instruction: '↑ Move phone up (or tilt phone down)' },
      { direction: 'down', instruction: '↓ Move phone down (or tilt phone up)' },
      { direction: 'top_left', instruction: '↖ Move phone up-left' },
      { direction: 'top_right', instruction: '↗ Move phone up-right' },
      { direction: 'bottom_left', instruction: '↙ Move phone down-left' },
      { direction: 'bottom_right', instruction: '↘ Move phone down-right' },
    ];
    
    const randomIndex = Math.floor(Math.random() * directions.length);
    return directions[randomIndex];
  };

  const getArrowForDirection = (direction: string): string => {
    const arrowMap: { [key: string]: string } = {
      'left': '←',
      'right': '→',
      'up': '↑',
      'down': '↓',
      'top_left': '↖',
      'top_right': '↗',
      'bottom_left': '↙',
      'bottom_right': '↘',
      'center': '✓',
    };
    return arrowMap[direction] || '?';
  };

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.permissionText}>Camera permission required</Text>
        <TouchableOpacity 
          style={styles.button} 
          onPress={requestCameraPermission}
        >
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Mock Camera View */}
      <View style={styles.cameraView}>
        <Text style={styles.cameraPlaceholder}>📱 Camera View</Text>
        <Text style={styles.cameraNote}>
          (Install react-native-vision-camera for real camera)
        </Text>
      </View>
      
      {/* Direction Arrow Overlay */}
      {currentDirection !== 'center' && (
        <View style={styles.arrowOverlay}>
          <Text style={styles.directionArrow}>
            {getArrowForDirection(currentDirection)}
          </Text>
        </View>
      )}
      
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {isLiveMode ? `Live Analysis ${analysisCount}/${maxAnalysisCount}` : 'Ready'}
        </Text>
        {isLiveMode && (
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
      </View>
      
      {/* Instruction Text */}
      <View style={styles.instructionContainer}>
        <Text style={styles.instructionText}>
          {currentInstruction}
        </Text>
      </View>
      
      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, styles.captureButton]}
          onPress={performAnalysis}
          disabled={isAnalyzing}
        >
          <Text style={styles.captureIcon}>📸</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.controlButton}
          onPress={isLiveMode ? stopLiveAnalysis : startLiveAnalysis}
        >
          <Text style={styles.buttonText}>
            {isLiveMode ? 'Stop Live' : 'Start Live'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraView: {
    flex: 1,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraPlaceholder: {
    color: '#888',
    fontSize: 24,
    marginBottom: 10,
  },
  cameraNote: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    margin: 20,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    margin: 20,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  arrowOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -50 }, { translateY: -50 }],
    zIndex: 10,
  },
  directionArrow: {
    fontSize: 80,
    color: 'rgba(255, 255, 255, 0.9)',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  statusBar: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
    borderRadius: 20,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 20,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'white',
    marginRight: 8,
  },
  liveText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    zIndex: 15,
  },
  instructionText: {
    color: 'white',
    fontSize: 18,
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 15,
    borderRadius: 15,
    fontWeight: '600',
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    zIndex: 20,
  },
  controlButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 15,
    borderRadius: 25,
    minWidth: 60,
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  captureIcon: {
    fontSize: 30,
  },
});

export default FaceCenterApp;