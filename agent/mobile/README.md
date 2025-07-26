# Face Center Camera - React Native Mobile App

📱 Mobile version of Face Center Camera with phone/hand positioning instructions.

## 🚨 Important Note

This is a **basic React Native structure** with the core mobile app logic. To run this on an actual device, you'll need to:

1. **Use Expo** (recommended for quick testing)
2. **Or complete the React Native setup** with proper build tools

## 🚀 Quick Start with Expo (Recommended)

```bash
# Install Expo CLI
npm install -g @expo/cli

# Create new Expo project
npx create-expo-app FaceCenterMobile --template blank-typescript

# Copy our App.tsx into the Expo project
# Then install camera package:
npx expo install expo-camera

# Start development server
npx expo start
```

## 📱 Key Features

**Mobile-Specific Instructions:**
- "Move phone left (or move your hand right)"
- "Move phone up (or tilt phone down)"
- "Move phone up-left" (diagonal directions)

**UI Features:**
- Full-screen camera interface
- Touch-optimized controls
- Live analysis mode (5 checks max)
- Directional arrows: ← → ↑ ↓ ↖ ↗ ↙ ↘
- Mobile-specific positioning guidance

## 🔧 Server Integration

The server at `http://localhost:3000` already supports mobile context:

**Auto-Detection:**
- Detects mobile via User-Agent
- Returns mobile-specific instructions
- Same LLM analysis with phone/hand context

**Example Response:**
```json
{
  "direction": "left",
  "instruction": "← Move phone left (or move your hand right)",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## 📝 Manual Setup (Advanced)

If you want to set up React Native manually:

```bash
# Install React Native CLI
npm install -g react-native-cli

# Setup development environment
# Follow: https://reactnative.dev/docs/environment-setup

# Install dependencies
cd mobile
npm install

# Install camera package
npm install react-native-vision-camera
cd ios && pod install && cd .. # iOS only

# Run the app
npm run ios     # iOS
npm run android # Android
```

## 🎯 Testing

**With Expo (Easy):**
1. Install Expo Go app on your phone
2. Scan QR code from `expo start`
3. Test the mobile interface

**With Device (Advanced):**
1. Connect phone via USB
2. Enable developer mode
3. Run `npm run ios` or `npm run android`

## ⚙️ Configuration

Update server URL for device testing:

```typescript
// In App.tsx
const serverUrl = 'http://YOUR_COMPUTER_IP:3000';
```

Replace `YOUR_COMPUTER_IP` with your computer's IP address (not localhost).

## 📋 Current Status

✅ **Mobile app structure** with React Native
✅ **Touch-optimized UI** with camera controls  
✅ **Server integration** ready for mobile context
✅ **Mobile-specific instructions** for phone positioning
✅ **Live analysis mode** with directional arrows

🔄 **Next Steps:**
- Add real camera integration (expo-camera or react-native-vision-camera)
- Implement actual server communication
- Test on physical devices

The core mobile logic is complete - just needs camera integration for full functionality! 📱🎉