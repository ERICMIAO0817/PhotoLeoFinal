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

interface ApiError {
  status: string;
  message: string;
  timestamp: string;
}

class PhotographyApiService {
  private baseUrl: string;
  private isProcessing: boolean = false;

  constructor(baseUrl?: string) {
    // Use localhost for API base URL
    this.baseUrl = baseUrl || 'http://localhost:5002';
  }

  /**
   * Check if the API server is running and healthy
   */
  async checkHealth(): Promise<boolean> {
    console.log(`🔍 Starting health check for: ${this.baseUrl}/api/health`);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/health`, {
        method: 'GET',
      });
      
      console.log(`📡 Health check response: status=${response.status}, ok=${response.ok}`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📡 API Health Check Data:', data);
        const isHealthy = data.status === 'ok';
        console.log(`🏥 Health status: ${isHealthy ? 'HEALTHY ✅' : 'UNHEALTHY ❌'}`);
        return isHealthy;
      }
      
      console.log('❌ Health check failed: response not ok');
      return false;
    } catch (error) {
      console.error('❌ API Health Check Failed:', error);
      return false;
    }
  }

  /**
   * Analyze an image and get photography guidance
   */
  async analyzeImage(imageBlob: Blob): Promise<PhotographyGuidanceResponse | null> {
    console.log('🎯 analyzeImage() called with blob size:', imageBlob.size, 'bytes');
    
    if (this.isProcessing) {
      console.log('⏳ API call already in progress, skipping...');
      return null;
    }

    console.log('✅ Setting isProcessing = true, proceeding with API call...');
    this.isProcessing = true;
    this.logToApiHistory('processing', 'Starting camera frame analysis');
    
    try {
      const formData = new FormData();
      formData.append('image', imageBlob, `camera-frame-${Date.now()}.jpg`);
      
      console.log('📤 Sending image to API...', {
        size: `${(imageBlob.size / 1024).toFixed(1)}KB`,
        timestamp: new Date().toISOString()
      });

      const response = await fetch(`${this.baseUrl}/api/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json() as ApiError;
        console.error('❌ API Error Response:', errorData);
        this.logToApiHistory('error', `HTTP ${response.status}: ${errorData.message}`);
        return null;
      }

      const result = await response.json() as PhotographyGuidanceResponse;
      console.log('✅ API Response received:', {
        status: result.status,
        suggestionsCount: result.data?.suggestions?.length || 0,
        timestamp: result.timestamp
      });

      return result;
    } catch (error) {
      console.error('❌ API Call Failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logToApiHistory('error', `Network error: ${errorMessage}`);
      return null;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Format and log the guidance response in a readable way
   */
  logGuidanceResponse(response: PhotographyGuidanceResponse): void {
    // Always log the API interaction for monitoring
    console.log(`🔗 API Call: ${new Date().toISOString()} - Status: ${response.status}`);
    
    if (response.status !== 'success' || !response.data) {
      console.log('⚠️ No guidance data received', response.message || '');
      this.logToApiHistory('error', response.message || 'No guidance data');
      return;
    }

    const { data } = response;
    
    console.log('\n🎯 === PHOTOGRAPHY GUIDANCE ===');
    console.log(`📊 Analysis: Level=${data.analysis.is_level}, Tilt=${data.analysis.tilt_angle}°, Brightness=${data.analysis.brightness}`);
    console.log('💡 Suggestions:');
    
    data.suggestions.forEach((suggestion, index) => {
      const directionEmoji = this.getDirectionEmoji(suggestion.direction);
      const intensityBars = '█'.repeat(suggestion.intensity);
      
      console.log(`  ${index + 1}. ${directionEmoji} ${suggestion.action}`);
      console.log(`     Direction: ${suggestion.direction} | Intensity: ${intensityBars} (${suggestion.intensity}/5)`);
      console.log(`     Reason: ${suggestion.reason}`);
      console.log('');
    });
    
    console.log(`⏱️ Received at: ${new Date(response.timestamp).toLocaleTimeString()}`);
    console.log('🎯 ===========================\n');
    
    // Log successful analysis to history
    this.logToApiHistory('success', `${data.suggestions.length} suggestions provided`);
  }

  /**
   * Log API interactions to a persistent history for monitoring
   */
  private logToApiHistory(status: 'success' | 'error' | 'processing', message: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      status,
      message,
      sessionId: this.getSessionId()
    };
    
    try {
      const existingLogs = JSON.parse(localStorage.getItem('photography_api_logs') || '[]');
      existingLogs.push(logEntry);
      
      // Keep only last 100 entries to prevent storage bloat
      if (existingLogs.length > 100) {
        existingLogs.splice(0, existingLogs.length - 100);
      }
      
      localStorage.setItem('photography_api_logs', JSON.stringify(existingLogs));
      console.log('📋 API Log saved:', logEntry);
    } catch (error) {
      console.warn('⚠️ Could not save API log:', error);
    }
  }

  /**
   * Get or create a session ID for tracking
   */
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('photography_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      sessionStorage.setItem('photography_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Get API interaction history
   */
  getApiLogs(): Array<{timestamp: string, status: string, message: string, sessionId: string}> {
    try {
      return JSON.parse(localStorage.getItem('photography_api_logs') || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear API logs
   */
  clearApiLogs(): void {
    localStorage.removeItem('photography_api_logs');
    console.log('🗑️ API logs cleared');
  }

  /**
   * Get emoji representation for movement directions
   */
  private getDirectionEmoji(direction: string): string {
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

  /**
   * Start periodic analysis of camera feed
   */
  startPeriodicAnalysis(videoElement: HTMLVideoElement, intervalMs: number = 5000, onGuidanceReceived?: (guidance: any) => void): () => void {
    let intervalId: number;
    let frameCount = 0;
    
    const analyze = async () => {
      try {
        frameCount++;
        console.log(`\n🔄 FRAME ANALYSIS #${frameCount} - ${new Date().toLocaleTimeString()}`);
        
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
          console.log('📹 Camera not ready yet, skipping frame...');
          return;
        }

        console.log(`📏 Frame size: ${videoElement.videoWidth}x${videoElement.videoHeight}`);
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
          console.error('❌ Could not get canvas context');
          return;
        }

        // Set canvas size to match video
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        
        // Draw current video frame to canvas
        context.drawImage(videoElement, 0, 0);
        console.log('🖼️  Frame captured and drawn to canvas');
        
        // Convert to blob
        console.log('🔄 Converting canvas to blob...');
        canvas.toBlob(async (blob) => {
          if (blob) {
            console.log(`📦 Frame converted to blob: ${(blob.size / 1024).toFixed(1)}KB`);
            console.log('📤 SENDING TO API SERVER...');
            
            const response = await this.analyzeImage(blob);
            if (response) {
              this.logGuidanceResponse(response);
              // Pass guidance data to callback if provided
              if (onGuidanceReceived && response.data) {
                onGuidanceReceived(response.data);
              }
            } else {
              console.log('❌ No response from API - check server logs');
            }
            
            console.log('─'.repeat(60));
          } else {
            console.error('❌ Failed to convert canvas to blob!');
          }
        }, 'image/jpeg', 0.8);
        
      } catch (error) {
        console.error('❌ Error in periodic analysis:', error);
      }
    };

    // Start the interval
    console.log(`🔄 STARTING PERIODIC ANALYSIS: Every ${intervalMs/1000} seconds`);
    console.log('🎥 Video element ready, analysis loop starting...');
    intervalId = setInterval(analyze, intervalMs);
    
    // Return cleanup function
    return () => {
      console.log('🛑 STOPPING PERIODIC ANALYSIS');
      console.log(`📊 Total frames processed: ${frameCount}`);
      clearInterval(intervalId);
    };
  }
}

export const photographyApi = new PhotographyApiService();
export type { PhotographyGuidanceResponse, ApiError }; 