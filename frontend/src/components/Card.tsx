import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { radius, spacing } from '../theme/colors';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  padding?: number;
}

export const Card: React.FC<Props> = ({ children, style, testID, padding = spacing.lg }) => {
  const { theme } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, padding },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
  },
});
