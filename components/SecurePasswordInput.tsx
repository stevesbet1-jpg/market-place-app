import React, { forwardRef, useImperativeHandle, useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Platform,
  type TextInputProps,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface SecurePasswordInputRef {
  /**
   * iOS-only: forces the native UITextField to re-render its secure text dots.
   * Pass the new value directly so the component never reads stale state.
   */
  refresh: (forcedValue?: string) => void;
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
 * Fix: refresh(forcedValue) focuses the field and temporarily reveals
 * plain text. A useEffect watches the value prop; once it matches the
 * target, it toggles secureTextEntry back on. Because each transition
 * is committed to native before the next, the UITextField reliably
 * re-masks the new text with dots.
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
    const [forceReveal, setForceReveal] = useState(false);
    const [pendingRefresh, setPendingRefresh] = useState<{ target: string } | null>(null);

    useEffect(() => {
      if (!pendingRefresh || Platform.OS !== 'ios') return;

      if (value === pendingRefresh.target) {
        // Parent value has caught up — hide again so iOS re-masks
        setForceReveal(false);
        setPendingRefresh(null);
        return;
      }

      // Fallback: auto-reset if value never catches up within 500 ms
      const timeout = setTimeout(() => {
        setForceReveal(false);
        setPendingRefresh(null);
      }, 500);
      return () => clearTimeout(timeout);
    }, [value, pendingRefresh]);

    const refresh = useCallback(
      (forcedValue?: string) => {
        if (Platform.OS !== 'ios') return;

        const target = forcedValue !== undefined ? forcedValue : value;

        if (visible) {
          // Already visible — just focus so the new value is shown
          inputRef.current?.focus();
          return;
        }

        // Hidden mode: reveal, then wait for the value prop to catch up
        inputRef.current?.focus();
        setForceReveal(true);
        setPendingRefresh({ target });
      },
      [visible, value]
    );

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
