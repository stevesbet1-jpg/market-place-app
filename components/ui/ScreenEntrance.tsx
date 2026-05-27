import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import type { ViewProps } from 'react-native';
import { AnimationTiming } from '../../constants/animations';

interface Props extends ViewProps {
  delay?: number;
}

/**
 * Wraps children in a fade + slide-up entrance animation on mount.
 * Uses AnimationTiming.cinematic (800ms) for a premium feel.
 */
export function ScreenEntrance({ children, delay = 0, style, ...props }: React.PropsWithChildren<Props>) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: AnimationTiming.cinematic,
        useNativeDriver: true,
        delay,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: AnimationTiming.cinematic,
        useNativeDriver: true,
        delay,
      }),
    ]).start();
  }, [fadeAnim, slideAnim, delay]);

  return (
    <Animated.View
      style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }, style]}
      {...props}
    >
      {children}
    </Animated.View>
  );
}
