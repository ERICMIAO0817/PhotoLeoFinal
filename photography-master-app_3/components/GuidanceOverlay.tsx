import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Speech from 'expo-speech';

// Map direction to visual elements
const directionMap: Record<string, { 
  icon: string; 
  color: string; 
  label: string; 
  ttsText: string;
  animation: 'pulse' | 'bounce' | 'slide';
}> = {
  up: { 
    icon: 'arrow-up', 
    color: '#10B981', 
    label: '向上移动', 
    ttsText: '向上移动手机',
    animation: 'bounce'
  },
  down: { 
    icon: 'arrow-down', 
    color: '#10B981', 
    label: '向下移动', 
    ttsText: '向下移动手机',
    animation: 'bounce'
  },
  left: { 
    icon: 'arrow-left', 
    color: '#3B82F6', 
    label: '向左移动', 
    ttsText: '向左移动手机',
    animation: 'slide'
  },
  right: { 
    icon: 'arrow-right', 
    color: '#3B82F6', 
    label: '向右移动', 
    ttsText: '向右移动手机',
    animation: 'slide'
  },
  left_up: { 
    icon: 'arrow-top-left', 
    color: '#8B5CF6', 
    label: '左上方', 
    ttsText: '向左上方移动',
    animation: 'pulse'
  },
  left_down: { 
    icon: 'arrow-bottom-left', 
    color: '#8B5CF6', 
    label: '左下方', 
    ttsText: '向左下方移动',
    animation: 'pulse'
  },
  right_up: { 
    icon: 'arrow-top-right', 
    color: '#8B5CF6', 
    label: '右上方', 
    ttsText: '向右上方移动',
    animation: 'pulse'
  },
  right_down: { 
    icon: 'arrow-bottom-right', 
    color: '#8B5CF6', 
    label: '右下方', 
    ttsText: '向右下方移动',
    animation: 'pulse'
  },
  zoom_in: { 
    icon: 'magnify-plus', 
    color: '#F59E0B', 
    label: '放大', 
    ttsText: '放大画面',
    animation: 'pulse'
  },
  zoom_out: { 
    icon: 'magnify-minus', 
    color: '#F59E0B', 
    label: '缩小', 
    ttsText: '缩小画面',
    animation: 'pulse'
  },
};

interface Suggestion {
  step: number;
  action: string;
  direction: string;
  intensity: number;
  reason: string;
}

interface GuidanceOverlayProps {
  suggestions: Suggestion[];
}

const GuidanceOverlay: React.FC<GuidanceOverlayProps> = ({ suggestions }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];

  // Debug what suggestions we're receiving
  useEffect(() => {
    console.log(`🎯 GuidanceOverlay received suggestions:`, {
      count: suggestions?.length || 0,
      suggestions: suggestions?.map(s => ({ direction: s.direction, action: s.action })) || []
    });
  }, [suggestions]);

  // Show only one suggestion at a time
  const currentSuggestion = suggestions && suggestions.length > 0 ? suggestions[currentIndex] : null;

  useEffect(() => {
    if (currentSuggestion) {
      // Speak the suggestion
      Speech.speak(currentSuggestion.action, {
        language: 'zh-CN',
        pitch: 1.0,
        rate: 0.8,
      });

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-advance to next suggestion after 4 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.8,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          setCurrentIndex((prev) => (prev + 1) % suggestions.length);
        });
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [currentSuggestion, suggestions?.length]);

  if (!currentSuggestion) return null;

  const dir = directionMap[currentSuggestion.direction] || directionMap['up'];

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <Animated.View 
        style={[
          styles.suggestion,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: dir.color + '20' }]}>
          <Icon
            name={dir.icon}
            size={64}
            color={dir.color}
          />
        </View>
        <Text style={[styles.label, { color: dir.color }]}>{dir.label}</Text>
        <Text style={styles.action}>{currentSuggestion.action}</Text>
        <Text style={styles.reason}>{currentSuggestion.reason}</Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none',
  },
  suggestion: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 20,
    padding: 20,
    minWidth: 200,
    maxWidth: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  action: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 22,
  },
  reason: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default GuidanceOverlay; 