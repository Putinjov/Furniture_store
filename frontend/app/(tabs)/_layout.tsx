import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/constants/theme';

export default function TabLayout() {
  const { user } = useAuthStore();
  const role = user?.role;

  const getTabIcon = (name: string, focused: boolean) => {
    const iconMap: Record<string, any> = {
      index: focused ? 'home' : 'home-outline',
      orders: focused ? 'receipt' : 'receipt-outline',
      products: focused ? 'cube' : 'cube-outline',
      users: focused ? 'people' : 'people-outline',
      deliveries: focused ? 'car' : 'car-outline',
      profile: focused ? 'person' : 'person-outline',
    };
    return iconMap[name] || 'ellipse';
  };

  // Hide tabs based on role
  const shouldShowTab = (tabName: string): boolean => {
    if (!role) return false;
    
    switch (tabName) {
      case 'index': return true; // Dashboard for all
      case 'orders': return role !== 'driver';
      case 'products': return role !== 'driver';
      case 'users': return role === 'owner';
      case 'deliveries': return role === 'driver' || role === 'owner' || role === 'manager';
      case 'profile': return true;
      default: return true;
    }
  };

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <Ionicons name={getTabIcon(route.name, focused)} size={size} color={color} />
        ),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          href: shouldShowTab('index') ? '/(tabs)' : null,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          href: shouldShowTab('orders') ? '/(tabs)/orders' : null,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          href: shouldShowTab('products') ? '/(tabs)/products' : null,
        }}
      />
      <Tabs.Screen
        name="deliveries"
        options={{
          title: 'Deliveries',
          href: shouldShowTab('deliveries') ? '/(tabs)/deliveries' : null,
        }}
      />
      <Tabs.Screen
        name="users"
        options={{
          title: 'Users',
          href: shouldShowTab('users') ? '/(tabs)/users' : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          href: shouldShowTab('profile') ? '/(tabs)/profile' : null,
        }}
      />
    </Tabs>
  );
}
