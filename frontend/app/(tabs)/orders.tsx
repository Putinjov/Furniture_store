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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import api from '../../src/api/client';

interface Order {
  id: string;
  order_number: string;
  customer: {
    name: string;
    phone: string;
    address: string;
  };
  items: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  services: Array<{
    service_id: string;
    service_name: string;
    price: number;
  }>;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  status: string;
  payment_status: string;
  amount_paid: number;
  seller_name: string;
  seller_comments?: string;
  driver_name?: string;
  created_at: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
  stock_quantity: number;
  status: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

interface Driver {
  id: string;
  name: string;
}

export default function OrdersScreen() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  // Create order form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{product: Product, quantity: number}[]>([]);
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [discount, setDiscount] = useState('0');
  const [comments, setComments] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [ordersRes, productsRes, servicesRes] = await Promise.all([
        api.get('/orders'),
        api.get('/products'),
        api.get('/services'),
      ]);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
      setServices(servicesRes.data);

      if (user?.role === 'owner' || user?.role === 'manager') {
        try {
          const driversRes = await api.get('/users/drivers');
          setDrivers(driversRes.data);
        } catch {}
      }
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setSelectedProducts([]);
    setSelectedServices([]);
    setDiscount('0');
    setComments('');
  };

  const handleCreateOrder = async () => {
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      Alert.alert('Error', 'Please fill in all customer details');
      return;
    }
    if (selectedProducts.length === 0) {
      Alert.alert('Error', 'Please add at least one product');
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        customer: {
          name: customerName,
          phone: customerPhone,
          address: customerAddress,
        },
        items: selectedProducts.map(sp => ({
          product_id: sp.product.id,
          product_name: sp.product.name,
          quantity: sp.quantity,
          unit_price: sp.product.price,
          total_price: sp.product.price * sp.quantity,
        })),
        services: selectedServices.map(s => ({
          service_id: s.id,
          service_name: s.name,
          price: s.price,
        })),
        discount_percent: parseFloat(discount) || 0,
        seller_comments: comments,
        payment_status: 'unpaid',
        amount_paid: 0,
      };

      await api.post('/orders', orderData);
      Alert.alert('Success', 'Order created successfully');
      setShowCreateModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      fetchData();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? {...prev, status: newStatus} : null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      await api.put(`/orders/${orderId}`, { driver_id: driverId, status: 'in_delivery' });
      Alert.alert('Success', 'Driver assigned successfully');
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign driver');
    }
  };

  const handlePrintReceipt = async (orderId: string) => {
    try {
      const response = await api.get(`/orders/${orderId}/receipt`);
      Alert.alert('Receipt', response.data.receipt);
    } catch (error) {
      Alert.alert('Error', 'Failed to generate receipt');
    }
  };

  const addProduct = (product: Product) => {
    const existing = selectedProducts.find(sp => sp.product.id === product.id);
    if (existing) {
      setSelectedProducts(prev =>
        prev.map(sp =>
          sp.product.id === product.id ? { ...sp, quantity: sp.quantity + 1 } : sp
        )
      );
    } else {
      setSelectedProducts(prev => [...prev, { product, quantity: 1 }]);
    }
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts(prev => prev.filter(sp => sp.product.id !== productId));
  };

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.id === service.id)) {
      setSelectedServices(prev => prev.filter(s => s.id !== service.id));
    } else {
      setSelectedServices(prev => [...prev, service]);
    }
  };

  const calculateTotal = () => {
    const productsTotal = selectedProducts.reduce((sum, sp) => sum + sp.product.price * sp.quantity, 0);
    const servicesTotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
    const subtotal = productsTotal + servicesTotal;
    const discountAmount = subtotal * (parseFloat(discount) || 0) / 100;
    return subtotal - discountAmount;
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <Card
      onPress={() => {
        setSelectedOrder(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>{item.order_number}</Text>
        <StatusBadge status={item.status} type="order" />
      </View>
      <Text style={styles.customerName}>{item.customer.name}</Text>
      <View style={styles.orderMeta}>
        <Text style={styles.orderDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <Text style={styles.orderTotal}>€{item.total.toFixed(2)}</Text>
      </View>
      <View style={styles.paymentRow}>
        <StatusBadge status={item.payment_status} type="payment" />
        <Text style={styles.sellerName}>by {item.seller_name}</Text>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No orders yet</Text>
          </View>
        }
      />

      {/* Create Order Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Order</Text>
            <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Customer Information</Text>
              <Input label="Name" value={customerName} onChangeText={setCustomerName} placeholder="Customer name" />
              <Input label="Phone" value={customerPhone} onChangeText={setCustomerPhone} placeholder="Phone number" keyboardType="phone-pad" />
              <Input label="Address" value={customerAddress} onChangeText={setCustomerAddress} placeholder="Delivery address" multiline />

              <Text style={styles.sectionTitle}>Products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
                {products.map(product => (
                  <TouchableOpacity
                    key={product.id}
                    style={[
                      styles.productChip,
                      selectedProducts.find(sp => sp.product.id === product.id) && styles.productChipSelected,
                    ]}
                    onPress={() => addProduct(product)}
                  >
                    <Text style={styles.productChipText}>{product.name}</Text>
                    <Text style={styles.productChipPrice}>€{product.price}</Text>
                    {product.stock_quantity <= 0 && <Text style={styles.outOfStock}>Pre-order</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedProducts.length > 0 && (
                <View style={styles.selectedItems}>
                  {selectedProducts.map(sp => (
                    <View key={sp.product.id} style={styles.selectedItem}>
                      <Text style={styles.selectedItemText}>
                        {sp.product.name} x{sp.quantity}
                      </Text>
                      <Text style={styles.selectedItemPrice}>
                        €{(sp.product.price * sp.quantity).toFixed(2)}
                      </Text>
                      <TouchableOpacity onPress={() => removeProduct(sp.product.id)}>
                        <Ionicons name="close-circle" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              <Text style={styles.sectionTitle}>Services (Optional)</Text>
              <View style={styles.servicesGrid}>
                {services.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceChip,
                      selectedServices.find(s => s.id === service.id) && styles.serviceChipSelected,
                    ]}
                    onPress={() => toggleService(service)}
                  >
                    <Text style={styles.serviceChipText}>{service.name}</Text>
                    <Text style={styles.serviceChipPrice}>€{service.price}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Discount %"
                value={discount}
                onChangeText={setDiscount}
                keyboardType="numeric"
                placeholder="0"
              />

              <Input
                label="Internal Comments"
                value={comments}
                onChangeText={setComments}
                placeholder="Notes for internal use"
                multiline
              />

              <View style={styles.totalSection}>
                <Text style={styles.totalLabel}>Total:</Text>
                <Text style={styles.totalValue}>€{calculateTotal().toFixed(2)}</Text>
              </View>

              <Button title="Create Order" onPress={handleCreateOrder} loading={loading} />
              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Order Detail Modal */}
      <Modal visible={showDetailModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedOrder?.order_number}</Text>
            <TouchableOpacity onPress={() => setShowDetailModal(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent}>
            {selectedOrder && (
              <>
                <View style={styles.detailSection}>
                  <View style={styles.statusRow}>
                    <StatusBadge status={selectedOrder.status} type="order" />
                    <StatusBadge status={selectedOrder.payment_status} type="payment" />
                  </View>
                </View>

                <Card title="Customer">
                  <Text style={styles.detailText}>{selectedOrder.customer.name}</Text>
                  <Text style={styles.detailText}>{selectedOrder.customer.phone}</Text>
                  <Text style={styles.detailText}>{selectedOrder.customer.address}</Text>
                </Card>

                <Card title="Items">
                  {selectedOrder.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.product_name}</Text>
                      <Text style={styles.itemQty}>x{item.quantity}</Text>
                      <Text style={styles.itemPrice}>€{item.total_price.toFixed(2)}</Text>
                    </View>
                  ))}
                  {selectedOrder.services.map((service, idx) => (
                    <View key={`service-${idx}`} style={styles.itemRow}>
                      <Text style={styles.itemName}>{service.service_name}</Text>
                      <Text style={styles.itemQty}>Service</Text>
                      <Text style={styles.itemPrice}>€{service.price.toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>€{selectedOrder.total.toFixed(2)}</Text>
                  </View>
                </Card>

                {selectedOrder.seller_comments && (
                  <Card title="Seller Comments">
                    <Text style={styles.detailText}>{selectedOrder.seller_comments}</Text>
                  </Card>
                )}

                {(user?.role === 'owner' || user?.role === 'manager') && (
                  <Card title="Actions">
                    <View style={styles.actionButtons}>
                      {selectedOrder.status === 'new' && (
                        <Button
                          title="Mark Ready"
                          onPress={() => handleUpdateStatus(selectedOrder.id, 'ready')}
                          variant="success"
                          style={styles.actionButton}
                        />
                      )}
                      {selectedOrder.status === 'ready' && drivers.length > 0 && (
                        <View style={styles.driverSelect}>
                          <Text style={styles.driverLabel}>Assign Driver:</Text>
                          {drivers.map(driver => (
                            <TouchableOpacity
                              key={driver.id}
                              style={styles.driverOption}
                              onPress={() => handleAssignDriver(selectedOrder.id, driver.id)}
                            >
                              <Ionicons name="person" size={16} color={colors.primary} />
                              <Text style={styles.driverName}>{driver.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                        <Button
                          title="Cancel Order"
                          onPress={() => handleUpdateStatus(selectedOrder.id, 'cancelled')}
                          variant="danger"
                          style={styles.actionButton}
                        />
                      )}
                    </View>
                  </Card>
                )}

                <Button
                  title="Print Receipt"
                  onPress={() => handlePrintReceipt(selectedOrder.id)}
                  variant="secondary"
                  icon={<Ionicons name="print" size={20} color="#fff" />}
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
  addButton: {
    backgroundColor: colors.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { padding: spacing.md },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  orderNumber: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  customerName: { fontSize: fontSize.lg, fontWeight: '500', color: colors.text, marginBottom: spacing.xs },
  orderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: { fontSize: fontSize.sm, color: colors.textSecondary },
  orderTotal: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sellerName: { fontSize: fontSize.sm, color: colors.textSecondary },
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
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  productScroll: { marginBottom: spacing.md },
  productChip: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  productChipSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  productChipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text },
  productChipPrice: { fontSize: fontSize.sm, color: colors.primary, fontWeight: '600' },
  outOfStock: { fontSize: fontSize.xs, color: colors.warning },
  selectedItems: { marginBottom: spacing.md },
  selectedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  selectedItemText: { flex: 1, fontSize: fontSize.sm, color: colors.text },
  selectedItemPrice: { fontSize: fontSize.sm, fontWeight: '600', color: colors.primary, marginRight: spacing.sm },
  servicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  serviceChip: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  serviceChipSelected: { borderColor: colors.success, backgroundColor: colors.success + '10' },
  serviceChipText: { fontSize: fontSize.sm, color: colors.text },
  serviceChipPrice: { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  detailSection: { marginBottom: spacing.md },
  statusRow: { flexDirection: 'row', gap: spacing.sm },
  detailText: { fontSize: fontSize.md, color: colors.text, marginBottom: spacing.xs },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  itemName: { flex: 1, fontSize: fontSize.md, color: colors.text },
  itemQty: { fontSize: fontSize.sm, color: colors.textSecondary, marginRight: spacing.md },
  itemPrice: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  totalLabel: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  totalValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
  actionButtons: { gap: spacing.sm },
  actionButton: { marginBottom: spacing.sm },
  driverSelect: { marginBottom: spacing.md },
  driverLabel: { fontSize: fontSize.sm, fontWeight: '500', color: colors.text, marginBottom: spacing.sm },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.divider,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  driverName: { marginLeft: spacing.sm, fontSize: fontSize.md, color: colors.text },
});
