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
  /** Current value */
  value: string;
  /** Callback when text changes */
  onChangeText: (text: string) => void;
  /** Whether the password is currently visible in plain text */
  visible: boolean;
  /** Toggle visibility callback */
  onToggleVisibility: () => void;
  /** Color for the lock and eye icons */
  iconColor?: string;
  /** Style for the outer flex-row wrapper */
  wrapperStyle?: ViewStyle;
  /** Style for the TextInput itself */
  inputStyle?: TextStyle;
  /** Style for the eye toggle hit area */
  toggleStyle?: ViewStyle;
}

/**
 * Production-safe iOS secureTextEntry refresh fix.
 *
 * Problem: on real iPhones, programmatically changing `value` while
 * `secureTextEntry={true}` does not visually refresh the masked dots
 * because the native UITextField text storage gets out of sync.
 *
 * Fix: `refresh()` uses InteractionManager + blur, temporarily toggles
 * secureTextEntry off→on, and performs a micro clear/restore of the
 * value to force the native layer to rebuild its text storage.
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

    // Temporary override that briefly forces secureTextEntry=false on iOS during refresh()
    const [forceReveal, setForceReveal] = useState(false);

    const refresh = useCallback(() => {
      if (Platform.OS !== 'ios') return;

      // Blur first so the field is not actively editing during the swap
      inputRef.current?.blur();

      InteractionManager.runAfterInteractions(() => {
        // Step 1: briefly disable secure text entry → forces native rebuild
        setForceReveal(true);

        setTimeout(() => {
          // Step 2: re-enable secure text entry
          setForceReveal(false);

          // Step 3: micro clear/restore to guarantee the native buffer syncs
          const current = value;
          if (current.length > 0) {
            onChangeText('');
            requestAnimationFrame(() => {
              onChangeText(current);
            });
          }
        }, 60);
      });
    }, [value, onChangeText]);

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
