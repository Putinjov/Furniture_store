import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, fontSize } from '../constants/theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface BadgeProps {
  text: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export const Badge: React.FC<BadgeProps> = ({ text, variant = 'default', style }) => {
  const variantStyles = {
    default: { backgroundColor: colors.border, color: colors.text },
    success: { backgroundColor: '#D1FAE5', color: '#065F46' },
    warning: { backgroundColor: '#FEF3C7', color: '#92400E' },
    danger: { backgroundColor: '#FEE2E2', color: '#991B1B' },
    info: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  };

  return (
    <View style={[styles.badge, { backgroundColor: variantStyles[variant].backgroundColor }, style]}>
      <Text style={[styles.text, { color: variantStyles[variant].color }]}>{text}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
