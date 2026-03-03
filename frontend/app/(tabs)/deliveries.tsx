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
  Linking,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../src/components/Card';
import { Button } from '../../src/components/Button';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
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

interface Order {
  id: string;
  total: number;
  amount_paid: number;
  payment_status: string;
}

interface PaymentTypeOption {
  value: string;
  label: string;
  icon: string;
}

const PAGE_SIZE = 20;

export default function DeliveriesScreen() {
  const { user } = useAuthStore();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState('');
  
  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const skipRef = useRef(0);
  const isLoadingRef = useRef(false);
  
  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const isDriver = user?.role === 'driver';

  const fetchPaymentTypes = useCallback(async () => {
    try {
      const paymentTypesRes = await api.get('/payment-types');
      setPaymentTypes(paymentTypesRes.data);
    } catch (error) {
      console.error('Fetch payment types error:', error);
    }
  }, []);

  const fetchDeliveries = useCallback(async (skip: number = 0, isRefresh: boolean = false) => {
    if (isLoadingRef.current && !isRefresh) return;

    isLoadingRef.current = true;
    if (skip > 0) setLoadingMore(true);

    try {
      const response = await api.get(`/deliveries?skip=${skip}&limit=${PAGE_SIZE}`);
      const newDeliveries = response.data;

      if (newDeliveries.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (isRefresh || skip === 0) {
        setDeliveries(newDeliveries);
        skipRef.current = newDeliveries.length;
      } else {
        setDeliveries(prev => [...prev, ...newDeliveries]);
        skipRef.current += newDeliveries.length;
      }
    } catch (error) {
      console.error('Fetch deliveries error:', error);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchPaymentTypes();
    fetchDeliveries(0, true);
  }, [fetchPaymentTypes, fetchDeliveries]);

  const onRefresh = async () => {
    setRefreshing(true);
    skipRef.current = 0;
    setHasMore(true);
    await fetchDeliveries(0, true);
    setRefreshing(false);
  };

  const loadMoreDeliveries = () => {
    if (!loadingMore && hasMore && !isLoadingRef.current) {
      fetchDeliveries(skipRef.current);
    }
  };

  const fetchOrderDetails = async (orderId: string) => {
    try {
      const response = await api.get(`/orders/${orderId}`);
      setSelectedOrder(response.data);
    } catch (error) {
      console.error('Error fetching order:', error);
    }
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
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentType('');
    setPaymentNotes('');
  };

  const handleAddPayment = async () => {
    if (!selectedDelivery || !selectedOrder) return;
    if (!paymentAmount || !paymentType) {
      Alert.alert('Error', 'Please enter amount and select payment type');
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/orders/${selectedDelivery.order_id}/payments`, {
        amount: amount,
        payment_type: paymentType,
        notes: paymentNotes || undefined,
      });
      
      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      resetPaymentForm();
      
      // Refresh order details
      await fetchOrderDetails(selectedDelivery.order_id);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getPaymentTypeIcon = (type: string): any => {
    const icons: Record<string, string> = {
      cash: 'cash',
      card: 'card',
      contactless: 'phone-portrait',
    };
    return icons[type] || 'cash';
  };

  const renderDelivery = ({ item }: { item: Delivery }) => (
    <Card
      onPress={() => {
        setSelectedDelivery(item);
        setNotes(item.notes || '');
        fetchOrderDetails(item.order_id);
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

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading more...</Text>
      </View>
    );
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
        onEndReached={loadMoreDeliveries}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
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

                {/* Payment Section - Only for drivers */}
                {isDriver && selectedOrder && (
                  <Card title="Payment">
                    <View style={styles.paymentInfo}>
                      <View style={styles.paymentInfoRow}>
                        <Text style={styles.paymentLabel}>Order Total:</Text>
                        <Text style={styles.paymentValue}>€{selectedOrder.total.toFixed(2)}</Text>
                      </View>
                      <View style={styles.paymentInfoRow}>
                        <Text style={styles.paymentLabel}>Already Paid:</Text>
                        <Text style={[styles.paymentValue, { color: colors.success }]}>
                          €{selectedOrder.amount_paid.toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.paymentInfoRow}>
                        <Text style={styles.paymentLabel}>To Collect:</Text>
                        <Text style={[
                          styles.paymentValue, 
                          { color: selectedOrder.total - selectedOrder.amount_paid > 0 ? colors.danger : colors.success }
                        ]}>
                          €{Math.max(0, selectedOrder.total - selectedOrder.amount_paid).toFixed(2)}
                        </Text>
                      </View>
                    </View>
                    
                    {selectedOrder.total - selectedOrder.amount_paid > 0 && (
                      <Button
                        title="Record Payment"
                        onPress={() => setShowPaymentModal(true)}
                        variant="success"
                        icon={<Ionicons name="card" size={20} color="#fff" />}
                        style={{ marginTop: spacing.md }}
                      />
                    )}
                    
                    {selectedOrder.payment_status === 'paid' && (
                      <View style={styles.paidBadge}>
                        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                        <Text style={styles.paidText}>Fully Paid</Text>
                      </View>
                    )}
                  </Card>
                )}

                {isDriver && selectedDelivery.status !== 'delivered' && selectedDelivery.status !== 'failed' && (
                  <Card title="Add Notes">
                    <TouchableOpacity 
                      style={styles.notesInput}
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
                      <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
                      <Text style={styles.notesPlaceholder}>
                        {notes || 'Tap to add notes...'}
                      </Text>
                    </TouchableOpacity>
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

      {/* Payment Modal for Driver */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Collect Payment</Text>
              <TouchableOpacity onPress={() => { setShowPaymentModal(false); resetPaymentForm(); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentModalBody}>
              {selectedOrder && (
                <View style={styles.paymentBalanceInfo}>
                  <Text style={styles.paymentBalanceLabel}>Amount to Collect:</Text>
                  <Text style={styles.paymentBalanceValue}>
                    €{Math.max(0, selectedOrder.total - selectedOrder.amount_paid).toFixed(2)}
                  </Text>
                </View>
              )}

              <Text style={styles.paymentInputLabel}>Amount (€)</Text>
              <TextInput
                style={styles.paymentInput}
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.paymentInputLabel}>Payment Type</Text>
              <View style={styles.paymentTypesGrid}>
                {paymentTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.paymentTypeChip,
                      paymentType === type.value && styles.paymentTypeChipSelected,
                    ]}
                    onPress={() => setPaymentType(type.value)}
                  >
                    <Ionicons 
                      name={getPaymentTypeIcon(type.value)} 
                      size={24} 
                      color={paymentType === type.value ? '#fff' : colors.text} 
                    />
                    <Text style={[
                      styles.paymentTypeText,
                      paymentType === type.value && styles.paymentTypeTextSelected,
                    ]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.paymentInputLabel}>Notes (Optional)</Text>
              <TextInput
                style={[styles.paymentInput, styles.paymentNotesInput]}
                value={paymentNotes}
                onChangeText={setPaymentNotes}
                placeholder="Add notes..."
                placeholderTextColor={colors.textSecondary}
                multiline
              />

              <Button
                title="Confirm Payment"
                onPress={handleAddPayment}
                loading={loading}
                variant="success"
              />
            </View>
          </View>
        </View>
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
  // Payment styles
  paymentInfo: {
    backgroundColor: colors.divider,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  paymentInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  paymentLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  paymentValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  paidBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.success + '15',
    borderRadius: borderRadius.md,
  },
  paidText: { fontSize: fontSize.md, fontWeight: '600', color: colors.success },
  // Payment Modal
  paymentModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  paymentModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '70%',
  },
  paymentModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  paymentModalTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  paymentModalBody: { padding: spacing.md },
  paymentBalanceInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  paymentBalanceLabel: { fontSize: fontSize.md, color: colors.text },
  paymentBalanceValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.success },
  paymentInputLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  paymentInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.lg,
    color: colors.text,
  },
  paymentNotesInput: {
    height: 60,
    textAlignVertical: 'top',
    fontSize: fontSize.md,
  },
  paymentTypesGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentTypeChip: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentTypeChipSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  paymentTypeText: { fontSize: fontSize.sm, color: colors.text, textAlign: 'center' },
  paymentTypeTextSelected: { color: '#fff' },
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
