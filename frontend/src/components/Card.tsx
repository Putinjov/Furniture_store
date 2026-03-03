import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius } from '../constants/theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ children, title, onPress, style }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  
  return (
    <Wrapper style={[styles.card, style]} onPress={onPress} activeOpacity={0.8}>
      {title && <Text style={styles.title}>{title}</Text>}
      {children}
    </Wrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
});
