import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/authStore';
import { Card } from '../../src/components/Card';
import { colors, spacing, fontSize } from '../../src/constants/theme';
import api from '../../src/api/client';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockProducts: number;
  totalProducts: number;
  totalUsers: number;
  pendingDeliveries: number;
}

export default function DashboardScreen() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    lowStockProducts: 0,
    totalProducts: 0,
    totalUsers: 0,
    pendingDeliveries: 0,
  });
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        api.get('/orders'),
        api.get('/products'),
      ]);

      const orders = ordersRes.data;
      const products = productsRes.data;

      const totalRevenue = orders.reduce((sum: number, o: any) => 
        o.status === 'completed' ? sum + o.total : sum, 0);
      const pendingOrders = orders.filter((o: any) => 
        ['new', 'awaiting_stock', 'ready'].includes(o.status)).length;
      const lowStockProducts = products.filter((p: any) => 
        p.stock_quantity <= p.low_stock_threshold).length;
      const pendingDeliveries = orders.filter((o: any) => 
        o.status === 'in_delivery').length;

      let totalUsers = 0;
      if (user?.role === 'owner' || user?.role === 'manager') {
        try {
          const usersRes = await api.get('/users');
          totalUsers = usersRes.data.length;
        } catch {}
      }

      setStats({
        totalOrders: orders.length,
        totalRevenue,
        pendingOrders,
        lowStockProducts,
        totalProducts: products.length,
        totalUsers,
        pendingDeliveries,
      });
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    }
  };

  const fetchDriverDashboard = async () => {
    try {
      const deliveriesRes = await api.get('/deliveries');
      const deliveries = deliveriesRes.data;
      
      setStats({
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        lowStockProducts: 0,
        totalProducts: 0,
        totalUsers: 0,
        pendingDeliveries: deliveries.filter((d: any) => 
          ['pending', 'in_delivery'].includes(d.status)).length,
      });
    } catch (error) {
      console.error('Driver dashboard fetch error:', error);
    }
  };

  useEffect(() => {
    if (user?.role === 'driver') {
      fetchDriverDashboard();
    } else {
      fetchDashboardData();
    }
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (user?.role === 'driver') {
      await fetchDriverDashboard();
    } else {
      await fetchDashboardData();
    }
    setRefreshing(false);
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

  const StatCard = ({ icon, title, value, color, onPress }: any) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );

  // Driver Dashboard
  if (user?.role === 'driver') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.greeting}>Hello,</Text>
              <Text style={styles.userName}>{user?.name}</Text>
            </View>
            <View style={[styles.roleBadge, { backgroundColor: getRoleColor() }]}>
              <Text style={styles.roleText}>Driver</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatCard
              icon="car"
              title="Pending Deliveries"
              value={stats.pendingDeliveries}
              color={colors.warning}
              onPress={() => router.push('/(tabs)/deliveries')}
            />
          </View>

          <Card title="Quick Actions">
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/deliveries')}
            >
              <Ionicons name="list" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>View My Deliveries</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Owner/Manager/Seller Dashboard
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: getRoleColor() }]}>
            <Text style={styles.roleText}>{user?.role?.charAt(0).toUpperCase()}{user?.role?.slice(1)}</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="receipt"
            title="Total Orders"
            value={stats.totalOrders}
            color={colors.primary}
            onPress={() => router.push('/(tabs)/orders')}
          />
          {(user?.role === 'owner' || user?.role === 'manager') && (
            <StatCard
              icon="cash"
              title="Revenue"
              value={`€${stats.totalRevenue.toFixed(0)}`}
              color={colors.success}
            />
          )}
          <StatCard
            icon="time"
            title="Pending"
            value={stats.pendingOrders}
            color={colors.warning}
            onPress={() => router.push('/(tabs)/orders')}
          />
          <StatCard
            icon="alert-circle"
            title="Low Stock"
            value={stats.lowStockProducts}
            color={colors.danger}
            onPress={() => router.push('/(tabs)/products')}
          />
        </View>

        <Card title="Quick Actions">
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/orders')}
          >
            <Ionicons name="add-circle" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Create New Order</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            onPress={() => router.push('/(tabs)/products')}
          >
            <Ionicons name="cube" size={20} color={colors.primary} />
            <Text style={styles.quickActionText}>Manage Products</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          {(user?.role === 'owner' || user?.role === 'manager') && (
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => router.push('/(tabs)/deliveries')}
            >
              <Ionicons name="car" size={20} color={colors.primary} />
              <Text style={styles.quickActionText}>View Deliveries</Text>
              <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text,
  },
  roleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  roleText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
    color: colors.text,
  },
  statTitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  quickActionText: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.text,
    marginLeft: spacing.md,
  },
});
