import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, fontSize } from '../../src/constants/theme';

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  const performLogout = async () => {
    await logout();
    router.replace('/');
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const confirmed = window.confirm('Are you sure you want to logout?');
      if (!confirmed) {
        return;
      }
      performLogout();
      return;
    }

    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: performLogout,
        },
      ]
    );
  };

  const getRoleColor = () => {
    switch (user?.role) {
      case 'owner': return colors.owner;
      case 'manager': return colors.manager;
      case 'seller': return colors.seller;
      case 'driver': return colors.driver;
      default: return colors.primary;
    }
  };

  const getRoleDescription = () => {
    switch (user?.role) {
      case 'owner':
        return 'Full system access including user management, reports, and settings.';
      case 'manager':
        return 'Manage orders, inventory, and oversee seller activities.';
      case 'seller':
        return 'Create orders, manage sales, and assist customers.';
      case 'driver':
        return 'Handle deliveries and update delivery status.';
      default:
        return '';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: getRoleColor() + '20' }]}>
            <Text style={[styles.avatarText, { color: getRoleColor() }]}>
              {user?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor() }]}>
            <Text style={styles.roleText}>
              {user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}
            </Text>
          </View>
        </View>

        <Card title="Role Permissions">
          <Text style={styles.permissionText}>{getRoleDescription()}</Text>
        </Card>

        <Card title="Account Information">
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Name</Text>
              <Text style={styles.infoValue}>{user?.name}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Member Since</Text>
              <Text style={styles.infoValue}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
              </Text>
            </View>
          </View>
        </Card>

        <Card title="App Information">
          <View style={styles.infoRow}>
            <Ionicons name="storefront-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>App Name</Text>
              <Text style={styles.infoValue}>Furniture Store Manager</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="code-outline" size={20} color={colors.textSecondary} />
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
          </View>
        </Card>

        <Button
          title="Logout"
          onPress={handleLogout}
          variant="danger"
          icon={<Ionicons name="log-out-outline" size={20} color="#fff" />}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingVertical: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: { fontSize: 32, fontWeight: '700' },
  userName: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.xs },
  roleBadge: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  roleText: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },
  permissionText: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  infoContent: { marginLeft: spacing.md, flex: 1 },
  infoLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  infoValue: { fontSize: fontSize.md, color: colors.text, fontWeight: '500' },
});
