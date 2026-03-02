import React, { useEffect, useState, useCallback } from 'react';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, fontSize } from '../../src/constants/theme';
import api from '../../src/api/client';

interface Delivery {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  status: string;
  notes?: string;
  assigned_at: string;
  updated_at: string;
}

export default function DeliveriesScreen() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');

  const isDriver = user?.role === 'driver';

  const fetchDeliveries = useCallback(async () => {
    try {
      const response = await api.get('/deliveries');
      setDeliveries(response.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDeliveries();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedDelivery) return;

    setLoading(true);
    try {
      await api.put(`/deliveries/${selectedDelivery.id}`, {
        status: newStatus,
        notes: notes || undefined,
      });
      Alert.alert('Success', 'Delivery status updated');
      setSelectedDelivery(prev => prev ? { ...prev, status: newStatus, notes } : null);
      fetchDeliveries();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <Card
      onPress={() => {
        setSelectedDelivery(item);
        setNotes(item.notes || '');
        setShowDetailModal(true);
      }}
    >
      <View style={styles.deliveryHeader}>
        <Text style={styles.orderNumber}>{item.order_number}</Text>
        <StatusBadge status={item.status} type="delivery" />
      </View>
      <Text style={styles.customerName}>{item.customer_name}</Text>
      <View style={styles.infoRow}>
        <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText}>{item.customer_phone}</Text>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
        <Text style={styles.infoText} numberOfLines={2}>{item.customer_address}</Text>
      </View>
      <Text style={styles.dateText}>
        Assigned: {new Date(item.assigned_at).toLocaleDateString()}
      </Text>
    </Card>
  );

  const getStatusActions = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending':
        return [{ status: 'in_delivery', label: 'Start Delivery', variant: 'primary' as const }];
      case 'in_delivery':
        return [
          { status: 'delivered', label: 'Mark Delivered', variant: 'success' as const },
          { status: 'failed', label: 'Mark Failed', variant: 'danger' as const },
        ];
      default:
        return [];
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Deliveries</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {deliveries.filter(d => ['pending', 'in_delivery'].includes(d.status)).length} Active
          </Text>
        </View>
      </View>

      <FlatList
        data={deliveries}
        renderItem={renderDelivery}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              {isDriver ? 'No deliveries assigned to you' : 'No deliveries yet'}
            </Text>
          </View>
        }
      />

      {/* Delivery Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Delivery Details</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedDelivery && (
              <>
                <View style={styles.statusSection}>
                  <StatusBadge status={selectedDelivery.status} type="delivery" />
                </View>

                <Card title="Order">
                  <Text style={styles.detailValue}>{selectedDelivery.order_number}</Text>
                </Card>

                <Card title="Customer">
                  <Text style={styles.customerDetailName}>{selectedDelivery.customer_name}</Text>
                  <TouchableOpacity
                    style={styles.phoneRow}
                    onPress={() => callCustomer(selectedDelivery.customer_phone)}
                  >
                    <Ionicons name="call" size={20} color={colors.primary} />
                    <Text style={styles.phoneText}>{selectedDelivery.customer_phone}</Text>
                  </TouchableOpacity>
                </Card>

                <Card title="Delivery Address">
                  <Text style={styles.addressText}>{selectedDelivery.customer_address}</Text>
                </Card>

                {isDriver && selectedDelivery.status !== 'delivered' && selectedDelivery.status !== 'failed' && (
                  <Card title="Add Notes">
                    <View style={styles.notesInput}>
                      <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                      <Text
                        style={styles.notesPlaceholder}
                        onPress={() => {
                          Alert.prompt(
                            'Delivery Notes',
                            'Add any notes about this delivery',
                            (text) => setNotes(text),
                            'plain-text',
                            notes
                          );
                        }}
                      >
                        {notes || 'Tap to add notes...'}
                      </Text>
                    </View>
                  </Card>
                )}

                {selectedDelivery.notes && (
                  <Card title="Notes">
                    <Text style={styles.notesText}>{selectedDelivery.notes}</Text>
                  </Card>
                )}

                {isDriver && (
                  <View style={styles.actionButtons}>
                    {getStatusActions(selectedDelivery.status).map((action) => (
                      <Button
                        key={action.status}
                        title={action.label}
                        onPress={() => handleUpdateStatus(action.status)}
                        variant={action.variant}
                        loading={loading}
                        style={styles.actionButton}
                      />
                    ))}
                  </View>
                )}

                <Button
                  title="Call Customer"
                  onPress={() => callCustomer(selectedDelivery.customer_phone)}
                  variant="secondary"
                  icon={<Ionicons name="call" size={20} color="#fff" />}
                />
              </>
            )}
          </ScrollView>
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
  badge: {
    backgroundColor: colors.warning + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  badgeText: { color: colors.warning, fontWeight: '600', fontSize: fontSize.sm },
  listContent: { padding: spacing.md },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderNumber: { fontSize: fontSize.md, fontWeight: '600', color: colors.primary },
  customerName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  infoText: { flex: 1, fontSize: fontSize.sm, color: colors.textSecondary },
  dateText: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: spacing.sm },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { fontSize: fontSize.md, color: colors.textSecondary, marginTop: spacing.md, textAlign: 'center' },
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
  statusSection: { marginBottom: spacing.md },
  detailValue: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  customerDetailName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary + '10',
    borderRadius: 8,
  },
  phoneText: { fontSize: fontSize.md, color: colors.primary, fontWeight: '500' },
  addressText: { fontSize: fontSize.md, color: colors.text, lineHeight: 22 },
  notesInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.divider,
    borderRadius: 8,
  },
  notesPlaceholder: { flex: 1, fontSize: fontSize.md, color: colors.textSecondary },
  notesText: { fontSize: fontSize.md, color: colors.text },
  actionButtons: { marginBottom: spacing.md },
  actionButton: { marginBottom: spacing.sm },
});
