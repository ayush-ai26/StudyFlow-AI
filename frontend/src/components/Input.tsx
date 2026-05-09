import React from 'react';
import { TextInput, StyleSheet, View, Text, TextInputProps } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

interface Props extends TextInputProps {
  label?: string;
  testID?: string;
}

export const Input: React.FC<Props> = ({ label, testID, style, ...rest }) => {
  const { theme } = useTheme();
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      {label ? <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text> : null}
      <TextInput
        testID={testID}
        placeholderTextColor={theme.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            backgroundColor: theme.surfaceElevated,
            color: theme.textMain,
            borderColor: focused ? theme.primary : 'transparent',
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontFamily: 'Manrope_500Medium',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    height: 48,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    fontSize: 16,
    fontFamily: 'Manrope_400Regular',
    borderWidth: 1,
  },
});
