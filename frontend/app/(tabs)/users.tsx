import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { Badge } from '../../src/components/Badge';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import api from '../../src/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function UsersScreen() {
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);
  const isLoadingRef = useRef(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('seller');

  const fetchUsers = useCallback(async (skip: number = 0, isRefresh: boolean = false) => {
    if (isLoadingRef.current && !isRefresh) return;

    isLoadingRef.current = true;
    if (skip > 0) setLoadingMore(true);

    try {
      const response = await api.get(`/users?skip=${skip}&limit=${PAGE_SIZE}`);
      const newUsers = response.data;

      if (newUsers.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (isRefresh || skip === 0) {
        setUsers(newUsers);
        skipRef.current = newUsers.length;
      } else {
        setUsers(prev => [...prev, ...newUsers]);
        skipRef.current += newUsers.length;
      }
    } catch (error) {
      console.error('Fetch users error:', error);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchUsers(0, true);
  }, [fetchUsers]);

  const onRefresh = async () => {
    setRefreshing(true);
    skipRef.current = 0;
    setHasMore(true);
    await fetchUsers(0, true);
    setRefreshing(false);
  };

  const loadMoreUsers = () => {
    if (!loadingMore && hasMore && !isLoadingRef.current) {
      fetchUsers(skipRef.current);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('seller');
    setEditingUser(null);
  };

  const openModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormName(user.name);
      setFormEmail(user.email);
      setFormRole(user.role);
      setFormPassword('');
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      Alert.alert('Error', 'Name and email are required');
      return;
    }

    if (!editingUser && !formPassword.trim()) {
      Alert.alert('Error', 'Password is required for new users');
      return;
    }

    setLoading(true);
    try {
      if (editingUser) {
        const updateData: any = {
          name: formName,
          role: formRole,
        };
        if (formPassword.trim()) {
          updateData.password = formPassword;
        }
        await api.put(`/users/${editingUser.id}`, updateData);
      } else {
        await api.post('/users', {
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole,
        });
      }

      Alert.alert('Success', `User ${editingUser ? 'updated' : 'created'} successfully`);
      setShowModal(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.put(`/users/${user.id}`, { is_active: !user.is_active });
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update user');
    }
  };

  const handleDelete = async (user: User) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete ${user.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${user.id}`);
              onRefresh();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete user');
            }
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'owner': return colors.owner;
      case 'manager': return colors.manager;
      case 'seller': return colors.seller;
      case 'driver': return colors.driver;
      default: return colors.secondary;
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner': return 'info';
      case 'manager': return 'info';
      case 'seller': return 'success';
      case 'driver': return 'warning';
      default: return 'default';
    }
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
  };

  const renderUser = ({ item }: { item: User }) => (
    <Card onPress={() => openModal(item)}>
      <View style={styles.userHeader}>
        <View style={[styles.avatar, { backgroundColor: getRoleColor(item.role) + '20' }]}>
          <Text style={[styles.avatarText, { color: getRoleColor(item.role) }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <Badge
          text={item.role.toUpperCase()}
          variant={getRoleBadgeVariant(item.role) as any}
        />
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity
          style={[styles.actionChip, item.is_active ? styles.activeChip : styles.inactiveChip]}
          onPress={() => handleToggleActive(item)}
        >
          <Ionicons
            name={item.is_active ? 'checkmark-circle' : 'close-circle'}
            size={16}
            color={item.is_active ? colors.success : colors.danger}
          />
          <Text style={[styles.actionChipText, { color: item.is_active ? colors.success : colors.danger }]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteChip}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={16} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Users</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={loadMoreUsers}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No users yet</Text>
          </View>
        }
      />

      {/* Add/Edit User Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingUser ? 'Edit User' : 'Add User'}</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={styles.modalContent}>
              <Input
                label="Name"
                value={formName}
                onChangeText={setFormName}
                placeholder="Enter name"
              />
              <Input
                label="Email"
                value={formEmail}
                onChangeText={setFormEmail}
                placeholder="Enter email"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!editingUser}
              />
              <Input
                label={editingUser ? 'New Password (leave blank to keep)' : 'Password'}
                value={formPassword}
                onChangeText={setFormPassword}
                placeholder="Enter password"
                secureTextEntry
              />

              <Text style={styles.label}>Role</Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={formRole}
                  onValueChange={setFormRole}
                  style={styles.picker}
                >
                  <Picker.Item label="Owner" value="owner" />
                  <Picker.Item label="Manager" value="manager" />
                  <Picker.Item label="Seller" value="seller" />
                  <Picker.Item label="Driver" value="driver" />
                </Picker>
              </View>

              <Button title="Save" onPress={handleSave} loading={loading} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { fontSize: fontSize.xxl, fontWeight: '700', color: colors.text },
  addButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { padding: spacing.md },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: fontSize.lg, fontWeight: '700' },
  userInfo: { flex: 1 },
  userName: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  userEmail: { fontSize: fontSize.sm, color: colors.textSecondary },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    gap: spacing.xs,
  },
  activeChip: { backgroundColor: colors.success + '15' },
  inactiveChip: { backgroundColor: colors.danger + '15' },
  actionChipText: { fontSize: fontSize.sm, fontWeight: '500' },
  deleteChip: {
    padding: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.danger + '15',
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.md },
  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', color: colors.text },
  modalContent: { padding: spacing.md },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  picker: { height: 50 },
  loadingFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
