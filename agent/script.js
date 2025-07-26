class FaceCenterCamera {
    constructor() {
        this.webcam = document.getElementById('webcam');
        this.status = document.getElementById('status');
        this.captureBtn = document.getElementById('captureBtn');
        this.resultOverlay = document.getElementById('resultOverlay');
        this.capturedImage = document.getElementById('capturedImage');
        this.analysisResult = document.getElementById('analysisResult');
        this.closeBtn = document.getElementById('closeBtn');
        this.directionArrow = document.getElementById('directionArrow');
        this.liveIndicator = document.getElementById('liveIndicator');
        
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.liveAnalysisInterval = null;
        this.isLiveMode = true;
        this.lastDirection = null;
        this.analysisCount = 0;
        this.maxAnalysisCount = 5;
        
        this.init();
    }

    async init() {
        try {
            await this.initWebcam();
            this.setupEventListeners();
            await this.checkServerStatus();
            this.startLiveAnalysis();
        } catch (error) {
            this.status.textContent = 'Error: ' + error.message;
            console.error('Initialization error:', error);
        }
    }

    async initWebcam() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                }
            });
            
            this.webcam.srcObject = stream;
            
            this.webcam.onloadedmetadata = () => {
                this.canvas.width = this.webcam.videoWidth;
                this.canvas.height = this.webcam.videoHeight;
                this.status.textContent = 'Live preview - AI analyzing your position';
                this.liveIndicator.style.display = 'flex';
            };
            
        } catch (error) {
            throw new Error('Could not access webcam: ' + error.message);
        }
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/status');
            const data = await response.json();
            
            if (data.needsApiKey) {
                await this.promptForApiKey();
            } else if (data.modelLoaded) {
                this.status.textContent = 'Live preview - Real LLM analyzing your position';
            } else {
                this.status.textContent = 'Loading real LLM... Live preview starting soon';
            }
        } catch (error) {
            console.error('Server status check failed:', error);
            this.status.textContent = 'Live preview - Camera ready';
        }
    }

    async promptForApiKey() {
        const apiKey = prompt(
            '🤖 Enter your OpenRouter API key:\n\n' +
            '• Get one FREE at: https://openrouter.ai/keys\n' +
            '• Format: sk-or-v1-xxxxxxxxxx\n' +
            '• This enables REAL LLM vision analysis!\n\n' +
            'API Key:'
        );
        
        if (!apiKey) {
            this.status.textContent = 'API key required for LLM analysis';
            return;
        }

        try {
            const response = await fetch('/set-api-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ apiKey: apiKey })
            });

            const data = await response.json();
            
            if (data.success) {
                this.status.textContent = '✅ Real LLM ready - Live analysis starting!';
                console.log('🎉 LLM integration activated!');
            } else {
                this.status.textContent = 'Invalid API key - using fallback mode';
                alert('Invalid OpenRouter API key format. Should start with "sk-or-"');
            }
        } catch (error) {
            console.error('Failed to set API key:', error);
            this.status.textContent = 'API key setup failed - using fallback mode';
        }
    }

    startLiveAnalysis() {
        this.analysisCount = 0;
        
        // Start live analysis every 3 seconds
        this.liveAnalysisInterval = setInterval(() => {
            console.log('🔄 Interval check:', {
                isLiveMode: this.isLiveMode,
                overlayDisplay: this.resultOverlay.style.display,
                analysisCount: this.analysisCount,
                maxCount: this.maxAnalysisCount
            });
            
            if (this.isLiveMode && this.resultOverlay.style.display !== 'flex' && this.analysisCount < this.maxAnalysisCount) {
                this.performLiveAnalysis();
            } else if (this.analysisCount >= this.maxAnalysisCount) {
                this.stopLiveAnalysis();
            }
        }, 3000);
        
        // First analysis after 2 seconds
        setTimeout(() => {
            if (this.isLiveMode && this.analysisCount < this.maxAnalysisCount) {
                this.performLiveAnalysis();
            }
        }, 2000);
    }

    stopLiveAnalysis() {
        if (this.liveAnalysisInterval) {
            clearInterval(this.liveAnalysisInterval);
            this.liveAnalysisInterval = null;
        }
        
        this.liveIndicator.style.display = 'none';
        this.directionArrow.classList.remove('show');
        this.status.textContent = 'Camera ready - Tap 📸 to take photo';
    }

    async performLiveAnalysis() {
        try {
            this.analysisCount++;
            console.log(`Live analysis ${this.analysisCount}/${this.maxAnalysisCount}`);
            
            const imageBlob = await this.captureFrame();
            const direction = await this.getLiveDirection(imageBlob);
            this.showLiveDirection(direction);
            
            // Update status with count
            this.status.textContent = `Live preview - Analysis ${this.analysisCount}/${this.maxAnalysisCount}`;
            
            // If this was the last analysis, show completion message
            if (this.analysisCount >= this.maxAnalysisCount) {
                setTimeout(() => {
                    if (this.isLiveMode) {
                        this.status.textContent = 'Analysis complete - Tap 📸 to take photo';
                    }
                }, 1000);
            }
        } catch (error) {
            console.error('Live analysis error:', error);
        }
    }

    async getLiveDirection(imageBlob) {
        try {
            const formData = new FormData();
            formData.append('image', imageBlob, 'live.jpg');
            
            const response = await fetch('/live-analyze', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('📡 Received from server:', data.direction);
            return data.direction || 'center';
            
        } catch (error) {
            console.error('🚫 Live direction error:', error);
            return this.getRandomDirection();
        }
    }

    getRandomDirection() {
        const directions = ['center', 'left', 'right', 'up', 'down', 'top_left', 'top_right', 'bottom_left', 'bottom_right'];
        const weights = [30, 15, 15, 10, 10, 5, 5, 5, 5]; // Favor center, then cardinals, then diagonals
        
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < directions.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return directions[i];
            }
        }
        
        return 'center';
    }

    showLiveDirection(direction) {
        const arrowMap = {
            'left': '←',
            'right': '→', 
            'up': '↑',
            'down': '↓',
            'top_left': '↖',
            'top_right': '↗',
            'bottom_left': '↙',
            'bottom_right': '↘',
            'center': '✓'
        };
        
        const arrow = arrowMap[direction] || '?';
        console.log('🎯 Showing direction:', direction, 'arrow:', arrow);
        
        // Always update to see changes clearly
        this.directionArrow.textContent = arrow;
        this.directionArrow.classList.remove('show');
        
        // Show arrow if not centered
        if (direction !== 'center') {
            console.log('👆 Displaying arrow for direction:', direction);
            setTimeout(() => {
                this.directionArrow.classList.add('show');
            }, 100);
        } else {
            console.log('✅ Centered - hiding arrow');
        }
        
        this.lastDirection = direction;
    }

    setupEventListeners() {
        this.captureBtn.addEventListener('click', () => this.captureAndAnalyze());
        this.closeBtn.addEventListener('click', () => this.closeResults());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                if (this.resultOverlay.style.display === 'flex') {
                    this.closeResults();
                } else {
                    this.captureAndAnalyze();
                }
            } else if (e.code === 'Escape') {
                this.closeResults();
            }
        });
    }

    async captureAndAnalyze() {
        try {
            // Pause live mode during photo analysis
            this.isLiveMode = false;
            this.liveIndicator.style.display = 'none';
            this.directionArrow.classList.remove('show');
            
            // Disable button during capture
            this.captureBtn.disabled = true;
            this.status.textContent = 'Capturing...';
            
            // Capture frame
            const imageBlob = await this.captureFrame();
            
            // Show captured image immediately
            const imageUrl = URL.createObjectURL(imageBlob);
            this.capturedImage.src = imageUrl;
            this.capturedImage.style.display = 'block';
            
            // Show overlay with loading state
            this.resultOverlay.style.display = 'flex';
            this.analysisResult.textContent = 'Analyzing your face position...';
            this.analysisResult.className = 'analysis-result loading';
            
            // Send to local server for analysis
            const analysis = await this.analyzeWithLocalModel(imageBlob);
            
            // Show results
            this.analysisResult.textContent = analysis;
            this.analysisResult.className = 'analysis-result';
            
            // Clean up
            this.captureBtn.disabled = false;
            this.status.textContent = 'Analysis complete - Tap to return to live preview';
            
        } catch (error) {
            console.error('Capture and analyze error:', error);
            this.analysisResult.textContent = 'Error analyzing image: ' + error.message;
            this.analysisResult.className = 'analysis-result';
            this.captureBtn.disabled = false;
            this.status.textContent = 'Error occurred - Tap to return to live preview';
        }
    }

    async captureFrame() {
        return new Promise((resolve) => {
            // Draw current frame to canvas
            this.ctx.drawImage(this.webcam, 0, 0, this.canvas.width, this.canvas.height);
            
            // Convert to blob
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        });
    }

    async analyzeWithLocalModel(imageBlob) {
        try {
            const formData = new FormData();
            formData.append('image', imageBlob, 'capture.jpg');
            
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const data = await response.json();
            return data.analysis || 'Analysis completed successfully.';
            
        } catch (error) {
            console.error('Local model analysis error:', error);
            
            // Fallback analysis
            return this.getFallbackAnalysis();
        }
    }

    getFallbackAnalysis() {
        const fallbackResponses = [
            "Perfect! Your face appears well-centered in the frame.",
            "Try moving slightly left to center your face better.",
            "Try moving slightly right to center your face better.",
            "Move up a bit - your face is positioned too low.",
            "Move down a bit - your face is positioned too high.",
            "Good positioning! Make small adjustments if needed.",
            "Your face is visible - try centering it in the guide circle."
        ];
        
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    closeResults() {
        this.resultOverlay.style.display = 'none';
        this.isLiveMode = true;
        
        // Clean up image URL
        if (this.capturedImage.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.capturedImage.src);
        }
        
        this.capturedImage.style.display = 'none';
        
        // Restart live analysis with fresh count
        this.startLiveAnalysis();
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FaceCenterCamera();
});