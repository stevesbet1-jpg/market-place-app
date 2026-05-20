import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  InteractionManager,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SecurePasswordInputRef {
  /** iOS-only: forces the native UITextField to re-render its secure text dots */
  refresh: () => void;
}

interface SecurePasswordInputProps extends Omit<TextInputProps, 'secureTextEntry'> {
  value: string;
  onChangeText: (text: string) => void;
  visible: boolean;
  onToggleVisibility: () => void;
  iconColor?: string;
  wrapperStyle?: ViewStyle;
  inputStyle?: TextStyle;
  toggleStyle?: ViewStyle;
}

/**
 * iOS secureTextEntry refresh fix.
 *
 * Problem: on real iPhones, programmatically changing `value` while
 * secureTextEntry=true does not visually refresh the masked dots.
 *
 * Fix: refresh() blurs, toggles secureTextEntry off→on across multiple
 * frames, clears/restores the value, force-remounts the TextInput via
 * inputKey, then focuses at the end so the dots rebuild correctly.
 */
export const SecurePasswordInput = forwardRef<SecurePasswordInputRef, SecurePasswordInputProps>(
  function SecurePasswordInput(
    {
      value,
      onChangeText,
      visible,
      onToggleVisibility,
      iconColor = '#888',
      wrapperStyle,
      inputStyle,
      toggleStyle,
      placeholder,
      placeholderTextColor,
      autoCapitalize = 'none',
      ...textInputProps
    },
    ref
  ) {
    const inputRef = useRef<TextInput>(null);
    const valueRef = useRef(value);
    valueRef.current = value;

    const [forceReveal, setForceReveal] = useState(false);
    const [inputKey, setInputKey] = useState(0);

    const refresh = useCallback(() => {
      if (Platform.OS !== 'ios') return;

      const current = valueRef.current;
      const isHidden = !visible;

      // 1. Blur so the field stops editing during the swap
      inputRef.current?.blur();

      InteractionManager.runAfterInteractions(() => {
        if (isHidden) {
          // ── Hidden mode: full rebuild sequence ───────────────────────

          // Step A: reveal plain text (forces native UITextField rebuild)
          setForceReveal(true);

          requestAnimationFrame(() => {
            // Step B: clear value while plain
            onChangeText('');

            requestAnimationFrame(() => {
              // Step C: restore value while still plain
              onChangeText(current);

              requestAnimationFrame(() => {
                // Step D: hide again
                setForceReveal(false);

                requestAnimationFrame(() => {
                  // Step E: force-remount the native TextInput
                  setInputKey((k) => k + 1);

                  requestAnimationFrame(() => {
                    // Step F: focus at end so selection is correct
                    inputRef.current?.focus();
                    // iOS selection API isn't always reliable, so blur+focus cycle helps
                    setTimeout(() => {
                      inputRef.current?.blur();
                      requestAnimationFrame(() => {
                        inputRef.current?.focus();
                      });
                    }, 50);
                  });
                });
              });
            });
          });
        } else {
          // ── Visible mode: just clear/restore ──────────────────────
          onChangeText('');
          requestAnimationFrame(() => {
            onChangeText(current);
            inputRef.current?.focus();
          });
        }
      });
    }, [visible, onChangeText]);

    useImperativeHandle(ref, () => ({ refresh }), [refresh]);

    const secureTextEntry = !visible && !forceReveal;

    return (
      <View style={wrapperStyle}>
        <Ionicons
          name="lock-closed-outline"
          size={20}
          color={iconColor}
          style={{ marginRight: 8 }}
        />
        <TextInput
          key={inputKey}
          ref={inputRef}
          style={[{ flex: 1, paddingVertical: 14, fontSize: 16 }, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          {...textInputProps}
        />
        <TouchableOpacity
          onPress={onToggleVisibility}
          activeOpacity={0.7}
          style={[{ marginLeft: 8, padding: 4 }, toggleStyle]}
        >
          <Ionicons
            name={visible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={iconColor}
          />
        </TouchableOpacity>
      </View>
    );
  }
);
