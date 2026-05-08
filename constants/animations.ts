import { Animated } from 'react-native';

// Premium Motion System - Cinematic Transitions
export const LuxuryAnimations = {
  // Fade In
  fadeIn: (duration: number = 300) => ({
    opacity: Animated.timing(
      new Animated.Value(0),
      {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }
    ),
  }),

  // Fade Out
  fadeOut: (duration: number = 300) => ({
    opacity: Animated.timing(
      new Animated.Value(1),
      {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }
    ),
  }),

  // Slide Up
  slideUp: (duration: number = 400) => ({
    translateY: Animated.timing(
      new Animated.Value(50),
      {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }
    ),
  }),

  // Slide Down
  slideDown: (duration: number = 400) => ({
    translateY: Animated.timing(
      new Animated.Value(-50),
      {
        toValue: 0,
        duration,
        useNativeDriver: true,
      }
    ),
  }),

  // Scale In
  scaleIn: (duration: number = 300) => ({
    scale: Animated.spring(
      new Animated.Value(0.9),
      {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }
    ),
  }),

  // Scale Out
  scaleOut: (duration: number = 300) => ({
    scale: Animated.timing(
      new Animated.Value(1),
      {
        toValue: 0.9,
        duration,
        useNativeDriver: true,
      }
    ),
  }),

  // Staggered Children Animation
  staggeredChildren: (delay: number = 100) => ({
    delay,
  }),

  // Parallax Scroll
  parallaxScroll: (scrollY: Animated.Value, inputRange: number[], outputRange: number[]) => {
    return scrollY.interpolate({
      inputRange,
      outputRange,
      extrapolate: 'clamp',
    });
  },

  // Floating Animation
  floating: (duration: number = 2000) => ({
    translateY: Animated.loop(
      Animated.sequence([
        Animated.timing(
          new Animated.Value(0),
          {
            toValue: -10,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
        Animated.timing(
          new Animated.Value(-10),
          {
            toValue: 0,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
      ])
    ),
  }),

  // Pulse Animation
  pulse: (duration: number = 1500) => ({
    scale: Animated.loop(
      Animated.sequence([
        Animated.timing(
          new Animated.Value(1),
          {
            toValue: 1.05,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
        Animated.timing(
          new Animated.Value(1.05),
          {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
      ])
    ),
  }),

  // Shimmer Effect
  shimmer: (duration: number = 2000) => ({
    opacity: Animated.loop(
      Animated.sequence([
        Animated.timing(
          new Animated.Value(0.5),
          {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
        Animated.timing(
          new Animated.Value(1),
          {
            toValue: 0.5,
            duration: duration / 2,
            useNativeDriver: true,
          }
        ),
      ])
    ),
  }),
};

// Animation Timing Presets
export const AnimationTiming = {
  fast: 200,
  normal: 300,
  slow: 500,
  cinematic: 800,
};

// Easing Functions
export const AnimationEasing = {
  easeIn: (t: number) => t * t,
  easeOut: (t: number) => t * (2 - t),
  easeInOut: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
};
