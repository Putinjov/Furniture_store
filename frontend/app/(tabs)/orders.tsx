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
  TextInput,
  ActivityIndicator,
  Share,
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

interface PaymentRecord {
  id: string;
  amount: number;
  payment_type: string;
  notes?: string;
  recorded_by_name: string;
  recorded_at: string;
}

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
    service_type: string;
    base_price: number;
    calculated_price: number;
    quantity: number;
  }>;
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  total: number;
  status: string;
  payment_status: string;
  amount_paid: number;
  payments: PaymentRecord[];
  seller_name: string;
  seller_comments?: string;
  driver_id?: string;
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
  description?: string;
  service_type: string;
  base_price: number;
}

interface Driver {
  id: string;
  name: string;
}

interface PaymentTypeOption {
  value: string;
  label: string;
  icon: string;
}

interface SelectedService {
  service: Service;
  quantity: number;
}

const PAGE_SIZE = 20;

export default function OrdersScreen() {
  const { user } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeOption[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [chosenDriverId, setChosenDriverId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Pagination state
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreOrders, setHasMoreOrders] = useState(true);
  const skipRef = useRef(0);
  const isLoadingRef = useRef(false);

  // Create order form state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<{product: Product, quantity: number}[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [discount, setDiscount] = useState('0');
  const [comments, setComments] = useState('');
  
  // Payment at order creation
  const [initialPaymentAmount, setInitialPaymentAmount] = useState('');
  const [initialPaymentType, setInitialPaymentType] = useState<string | null>(null);

  // Payment form state (for existing orders)
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');

  const fetchStaticData = useCallback(async () => {
    try {
      const [productsRes, servicesRes, paymentTypesRes] = await Promise.all([
        api.get('/products'),
        api.get('/services'),
        api.get('/payment-types'),
      ]);
      setProducts(productsRes.data);
      setServices(servicesRes.data);
      setPaymentTypes(paymentTypesRes.data);

      if (user?.role === 'owner' || user?.role === 'manager') {
        try {
          const driversRes = await api.get('/drivers');
          setDrivers(driversRes.data);
        } catch {}
      }
    } catch (error) {
      console.error('Fetch static data error:', error);
    }
  }, [user]);

  const fetchOrders = useCallback(async (skip: number = 0, isRefresh: boolean = false) => {
    if (isLoadingRef.current && !isRefresh) return;
    
    isLoadingRef.current = true;
    if (skip > 0) setLoadingMore(true);

    try {
      const response = await api.get(`/orders?skip=${skip}&limit=${PAGE_SIZE}`);
      const newOrders = response.data;

      if (newOrders.length < PAGE_SIZE) {
        setHasMoreOrders(false);
      }

      if (isRefresh || skip === 0) {
        setOrders(newOrders);
        skipRef.current = newOrders.length;
      } else {
        setOrders(prev => [...prev, ...newOrders]);
        skipRef.current += newOrders.length;
      }
    } catch (error) {
      console.error('Fetch orders error:', error);
    } finally {
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    fetchStaticData();
    fetchOrders(0, true);
  }, [fetchStaticData, fetchOrders]);

  const onRefresh = async () => {
    setRefreshing(true);
    skipRef.current = 0;
    setHasMoreOrders(true);
    await fetchOrders(0, true);
    setRefreshing(false);
  };

  const loadMoreOrders = () => {
    if (!loadingMore && hasMoreOrders && !isLoadingRef.current) {
      fetchOrders(skipRef.current);
    }
  };

  const resetForm = () => {
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setSelectedProducts([]);
    setSelectedServices([]);
    setDiscount('0');
    setComments('');
    setInitialPaymentAmount('');
    setInitialPaymentType(null);
  };

  const resetPaymentForm = () => {
    setPaymentAmount('');
    setPaymentType(null);
    setPaymentNotes('');
  };

  // Calculate assembly price based on total items
  const calculateAssemblyPrice = (totalItems: number): number => {
    if (totalItems <= 0) return 0;
    const groups = Math.floor((totalItems - 1) / 3);
    return 50 * Math.pow(2, groups);
  };

  // Calculate total service price
  const calculateServicePrice = (service: Service, totalItems: number, quantity: number): number => {
    if (service.service_type === 'assembly') {
      return calculateAssemblyPrice(totalItems);
    }
    return service.base_price * quantity;
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

    // Validate payment if amount entered
    const paymentAmt = parseFloat(initialPaymentAmount);
    if (initialPaymentAmount && !isNaN(paymentAmt) && paymentAmt > 0 && !initialPaymentType) {
      Alert.alert('Error', 'Please select a payment type');
      return;
    }

    setLoading(true);
    try {
      const totalItems = selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0);
      
      let amountPaid = 0;
      if (initialPaymentAmount && !isNaN(paymentAmt) && paymentAmt > 0 && initialPaymentType) {
        amountPaid = paymentAmt;
      }
      
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
        services: selectedServices.map(ss => ({
          service_id: ss.service.id,
          service_name: ss.service.name,
          service_type: ss.service.service_type,
          base_price: ss.service.base_price,
          calculated_price: calculateServicePrice(ss.service, totalItems, ss.quantity),
          quantity: ss.quantity,
        })),
        discount_percent: parseFloat(discount) || 0,
        seller_comments: comments,
        payment_status: "unpaid",
        amount_paid: 0,
      };

      const response = await api.post('/orders', orderData);
      const newOrderId = response.data.id;
      
      // If payment was made, record it
      if (amountPaid > 0 && initialPaymentType) {
        await api.post(`/orders/${newOrderId}/payments`, {
          amount: amountPaid,
          payment_type: initialPaymentType,
          notes: 'Payment at order creation',
        });
      }
      
      Alert.alert('Success', 'Order created successfully');
      setShowCreateModal(false);
      resetForm();
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!selectedOrder) return;
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
      const response = await api.post(`/orders/${selectedOrder.id}/payments`, {
        amount: amount,
        payment_type: paymentType,
        notes: paymentNotes || undefined,
      });
      
      setSelectedOrder(response.data);
      Alert.alert('Success', 'Payment recorded successfully');
      setShowPaymentModal(false);
      resetPaymentForm();
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.put(`/orders/${orderId}`, { status: newStatus });
      onRefresh();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? {...prev, status: newStatus} : null);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update status');
    }
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    try {
      const response = await api.put(`/orders/${orderId}`, { driver_id: driverId, status: 'in_delivery' });
      setSelectedOrder(response.data);
      setChosenDriverId(driverId);
      Alert.alert('Success', 'Driver assigned successfully');
      onRefresh();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to assign driver');
    }
  };

  const handlePrintReceipt = async (orderId: string) => {
    try {
      const response = await api.get(`/orders/${orderId}/receipt`);
      const receipt = response.data.receipt as string;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const printWindow = window.open('', '_blank', 'width=600,height=800');
        if (printWindow) {
          printWindow.document.write(`<pre style="font-family: monospace; white-space: pre-wrap;">${receipt}</pre>`);
          printWindow.document.close();
          printWindow.focus();
          printWindow.print();
          return;
        }
      }

      await Share.share({ message: receipt });
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to generate receipt');
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
    const existing = selectedServices.find(ss => ss.service.id === service.id);
    if (existing) {
      setSelectedServices(prev => prev.filter(ss => ss.service.id !== service.id));
    } else {
      setSelectedServices(prev => [...prev, { service, quantity: 1 }]);
    }
  };

  const updateServiceQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(prev =>
      prev.map(ss =>
        ss.service.id === serviceId
          ? { ...ss, quantity: Math.max(1, ss.quantity + delta) }
          : ss
      )
    );
  };

  // Toggle payment type selection (can uncheck)
  const togglePaymentType = (type: string, isInitial: boolean = false) => {
    if (isInitial) {
      setInitialPaymentType(prev => prev === type ? null : type);
    } else {
      setPaymentType(prev => prev === type ? null : type);
    }
  };

  const calculateTotal = () => {
    const productsTotal = selectedProducts.reduce((sum, sp) => sum + sp.product.price * sp.quantity, 0);
    const totalItems = selectedProducts.reduce((sum, sp) => sum + sp.quantity, 0);
    
    const servicesTotal = selectedServices.reduce((sum, ss) => {
      return sum + calculateServicePrice(ss.service, totalItems, ss.quantity);
    }, 0);
    
    const subtotal = productsTotal + servicesTotal;
    const discountAmount = subtotal * (parseFloat(discount) || 0) / 100;
    return subtotal - discountAmount;
  };

  const getServicePriceDisplay = (service: Service) => {
    if (service.service_type === 'assembly') {
      return '€50+ (based on items)';
    }
    if (service.base_price === 0) {
      return 'FREE';
    }
    const isTakeaway = service.service_type.startsWith('takeaway');
    return `€${service.base_price}${isTakeaway ? '/each' : ''}`;
  };

  const getPaymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      contactless: 'Contactless',
      phone: 'Phone',
      humm: 'Humm',
      refund: 'Refund',
    };
    return labels[type] || type;
  };

  const getPaymentTypeIcon = (type: string): any => {
    const icons: Record<string, string> = {
      cash: 'cash',
      card: 'card',
      contactless: 'phone-portrait',
      phone: 'call',
      humm: 'time',
      refund: 'arrow-undo',
    };
    return icons[type] || 'cash';
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <Card
      onPress={() => {
        setSelectedOrder(item);
        setChosenDriverId(item.driver_id || null);
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

  // Group services by type for better UX
  const assemblyServices = services.filter(s => s.service_type === 'assembly');
  const deliveryServices = services.filter(s => s.service_type === 'delivery');
  const takeawayServices = services.filter(s => s.service_type.startsWith('takeaway'));
  
  // Filter payment types for order creation (exclude refund)
  const createOrderPaymentTypes = paymentTypes.filter(t => t.value !== 'refund');

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
        onEndReached={loadMoreOrders}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
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

              {/* Assembly Service */}
              {assemblyServices.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Assembly Service</Text>
                  <Text style={styles.sectionHint}>€50 for first 3 pieces, doubles for each additional 3</Text>
                  <View style={styles.servicesGrid}>
                    {assemblyServices.map(service => (
                      <TouchableOpacity
                        key={service.id}
                        style={[
                          styles.serviceChip,
                          selectedServices.find(ss => ss.service.id === service.id) && styles.serviceChipSelected,
                        ]}
                        onPress={() => toggleService(service)}
                      >
                        <Text style={styles.serviceChipText}>{service.name}</Text>
                        <Text style={styles.serviceChipPrice}>
                          {selectedProducts.length > 0 
                            ? `€${calculateAssemblyPrice(selectedProducts.reduce((s, p) => s + p.quantity, 0))}`
                            : '€50+'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Delivery Service */}
              {deliveryServices.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Delivery</Text>
                  <View style={styles.servicesGrid}>
                    {deliveryServices.map(service => (
                      <TouchableOpacity
                        key={service.id}
                        style={[
                          styles.serviceChip,
                          selectedServices.find(ss => ss.service.id === service.id) && styles.serviceChipSelected,
                        ]}
                        onPress={() => toggleService(service)}
                      >
                        <Text style={styles.serviceChipText}>{service.name}</Text>
                        <Text style={styles.serviceChipPrice}>{getServicePriceDisplay(service)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Takeaway Services */}
              {takeawayServices.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Take Away Old Furniture</Text>
                  <View style={styles.servicesGrid}>
                    {takeawayServices.map(service => {
                      const selected = selectedServices.find(ss => ss.service.id === service.id);
                      return (
                        <View key={service.id} style={styles.takeawayRow}>
                          <TouchableOpacity
                            style={[
                              styles.serviceChip,
                              styles.takeawayChip,
                              selected && styles.serviceChipSelected,
                            ]}
                            onPress={() => toggleService(service)}
                          >
                            <Text style={styles.serviceChipText}>{service.name}</Text>
                            <Text style={styles.serviceChipPrice}>€{service.base_price}/each</Text>
                          </TouchableOpacity>
                          {selected && (
                            <View style={styles.quantityControl}>
                              <TouchableOpacity 
                                style={styles.qtyBtn}
                                onPress={() => updateServiceQuantity(service.id, -1)}
                              >
                                <Ionicons name="remove" size={16} color={colors.primary} />
                              </TouchableOpacity>
                              <Text style={styles.qtyText}>{selected.quantity}</Text>
                              <TouchableOpacity 
                                style={styles.qtyBtn}
                                onPress={() => updateServiceQuantity(service.id, 1)}
                              >
                                <Ionicons name="add" size={16} color={colors.primary} />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </View>
                </>
              )}

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
                <View style={styles.totalRow}>
                  <Text style={styles.paymentSummaryLabel}>Subtotal:</Text>
                  <Text style={styles.paymentSummaryValue}>
                    €{(selectedProducts.reduce((sum, sp) => sum + sp.product.price * sp.quantity, 0) +
                      selectedServices.reduce((sum, ss) => {
                        const totalItems = selectedProducts.reduce((itemsSum, sp) => itemsSum + sp.quantity, 0);
                        return sum + calculateServicePrice(ss.service, totalItems, ss.quantity);
                      }, 0)).toFixed(2)}
                  </Text>
                </View>
                {(parseFloat(discount) || 0) > 0 && (
                  <View style={styles.totalRow}>
                    <Text style={styles.paymentSummaryLabel}>Discount ({parseFloat(discount) || 0}%):</Text>
                    <Text style={[styles.paymentSummaryValue, { color: colors.success }]}>
                      -€{(((selectedProducts.reduce((sum, sp) => sum + sp.product.price * sp.quantity, 0) +
                        selectedServices.reduce((sum, ss) => {
                          const totalItems = selectedProducts.reduce((itemsSum, sp) => itemsSum + sp.quantity, 0);
                          return sum + calculateServicePrice(ss.service, totalItems, ss.quantity);
                        }, 0)) * (parseFloat(discount) || 0)) / 100).toFixed(2)}
                    </Text>
                  </View>
                )}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total:</Text>
                  <Text style={styles.totalValue}>€{calculateTotal().toFixed(2)}</Text>
                </View>
              </View>

              {/* Payment Section for Order Creation */}
              <View style={styles.paymentCreateSection}>
                <Text style={styles.sectionTitle}>Record Payment (Optional)</Text>
                <Text style={styles.sectionHint}>Record initial payment when creating order</Text>
                
                <Text style={styles.paymentInputLabel}>Amount (€)</Text>
                <TextInput
                  style={styles.paymentInput}
                  value={initialPaymentAmount}
                  onChangeText={setInitialPaymentAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                />

                <Text style={styles.paymentInputLabel}>Payment Type (tap to select/unselect)</Text>
                <View style={styles.paymentTypesGrid}>
                  {createOrderPaymentTypes.map(type => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.paymentTypeChip,
                        initialPaymentType === type.value && styles.paymentTypeChipSelected,
                      ]}
                      onPress={() => togglePaymentType(type.value, true)}
                    >
                      <Ionicons 
                        name={type.icon as any} 
                        size={18} 
                        color={initialPaymentType === type.value ? '#fff' : colors.text} 
                      />
                      <Text style={[
                        styles.paymentTypeText,
                        initialPaymentType === type.value && styles.paymentTypeTextSelected,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                      <Text style={styles.itemName}>
                        {service.service_name}
                        {service.quantity > 1 ? ` x${service.quantity}` : ''}
                      </Text>
                      <Text style={styles.itemQty}>Service</Text>
                      <Text style={styles.itemPrice}>€{service.calculated_price.toFixed(2)}</Text>
                    </View>
                  ))}
                  <View style={styles.totalRow}>
                    <Text style={styles.paymentSummaryLabel}>Subtotal</Text>
                    <Text style={styles.paymentSummaryValue}>€{selectedOrder.subtotal.toFixed(2)}</Text>
                  </View>
                  {selectedOrder.discount_percent > 0 && (
                    <View style={styles.totalRow}>
                      <Text style={styles.paymentSummaryLabel}>Discount ({selectedOrder.discount_percent}%):</Text>
                      <Text style={[styles.paymentSummaryValue, { color: colors.success }]}>
                        -€{selectedOrder.discount_amount.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total</Text>
                    <Text style={styles.totalValue}>€{selectedOrder.total.toFixed(2)}</Text>
                  </View>
                </Card>

                {/* Payment Summary */}
                <Card title="Payment">
                  <View style={styles.paymentSummary}>
                    <View style={styles.paymentSummaryRow}>
                      <Text style={styles.paymentSummaryLabel}>Total:</Text>
                      <Text style={styles.paymentSummaryValue}>€{selectedOrder.total.toFixed(2)}</Text>
                    </View>
                    <View style={styles.paymentSummaryRow}>
                      <Text style={styles.paymentSummaryLabel}>Paid:</Text>
                      <Text style={[styles.paymentSummaryValue, { color: colors.success }]}>
                        €{selectedOrder.amount_paid.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.paymentSummaryRow}>
                      <Text style={styles.paymentSummaryLabel}>Balance:</Text>
                      <Text style={[
                        styles.paymentSummaryValue, 
                        { color: selectedOrder.total - selectedOrder.amount_paid > 0 ? colors.danger : colors.success }
                      ]}>
                        €{Math.max(0, selectedOrder.total - selectedOrder.amount_paid).toFixed(2)}
                      </Text>
                    </View>
                  </View>

                  {/* Payment History */}
                  {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                    <View style={styles.paymentHistory}>
                      <Text style={styles.paymentHistoryTitle}>Payment History</Text>
                      {selectedOrder.payments.map((payment, idx) => (
                        <View key={idx} style={styles.paymentHistoryItem}>
                          <View style={styles.paymentHistoryLeft}>
                            <Ionicons 
                              name={getPaymentTypeIcon(payment.payment_type)} 
                              size={16} 
                              color={payment.payment_type === 'refund' ? colors.danger : colors.success} 
                            />
                            <Text style={styles.paymentHistoryType}>
                              {getPaymentTypeLabel(payment.payment_type)}
                            </Text>
                          </View>
                          <Text style={[
                            styles.paymentHistoryAmount,
                            { color: payment.payment_type === 'refund' ? colors.danger : colors.success }
                          ]}>
                            {payment.payment_type === 'refund' ? '-' : '+'}€{payment.amount.toFixed(2)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Add Payment Button */}
                  {selectedOrder.status !== 'cancelled' && selectedOrder.status !== 'completed' && (
                    <Button
                      title="Record Payment"
                      onPress={() => setShowPaymentModal(true)}
                      variant="success"
                      icon={<Ionicons name="card" size={20} color="#fff" />}
                      style={{ marginTop: spacing.md }}
                    />
                  )}
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
                      {selectedOrder.status === 'ready' && drivers.length > 0 && !selectedOrder.driver_id && (
                        <View style={styles.driverSelect}>
                          <Text style={styles.driverLabel}>Assign Driver:</Text>
                          {drivers.map(driver => (
                            <TouchableOpacity
                              key={driver.id}
                              style={[styles.driverOption, chosenDriverId === driver.id && styles.driverOptionSelected]}
                              onPress={() => setChosenDriverId(driver.id)}
                            >
                              <Ionicons name="person" size={16} color={colors.primary} />
                              <Text style={styles.driverName}>{driver.name}</Text>
                            </TouchableOpacity>
                          ))}
                          <Button
                            title="Confirm Driver"
                            onPress={() => chosenDriverId && handleAssignDriver(selectedOrder.id, chosenDriverId)}
                            disabled={!chosenDriverId}
                            style={styles.actionButton}
                          />
                        </View>
                      )}
                      {selectedOrder.driver_name && (
                        <Text style={styles.detailText}>Assigned Driver: {selectedOrder.driver_name}</Text>
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

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={styles.paymentModalOverlay}>
          <View style={styles.paymentModalContent}>
            <View style={styles.paymentModalHeader}>
              <Text style={styles.paymentModalTitle}>Record Payment</Text>
              <TouchableOpacity onPress={() => { setShowPaymentModal(false); resetPaymentForm(); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentModalBody}>
              {selectedOrder && (
                <View style={styles.paymentBalanceInfo}>
                  <Text style={styles.paymentBalanceLabel}>Balance Due:</Text>
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

              <Text style={styles.paymentInputLabel}>Payment Type (tap to select/unselect)</Text>
              <View style={styles.paymentTypesGrid}>
                {paymentTypes.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.paymentTypeChip,
                      paymentType === type.value && styles.paymentTypeChipSelected,
                      type.value === 'refund' && styles.paymentTypeRefund,
                      type.value === 'refund' && paymentType === type.value && styles.paymentTypeRefundSelected,
                    ]}
                    onPress={() => togglePaymentType(type.value, false)}
                  >
                    <Ionicons 
                      name={type.icon as any} 
                      size={18} 
                      color={paymentType === type.value ? '#fff' : type.value === 'refund' ? colors.danger : colors.text} 
                    />
                    <Text style={[
                      styles.paymentTypeText,
                      paymentType === type.value && styles.paymentTypeTextSelected,
                      type.value === 'refund' && paymentType !== type.value && styles.paymentTypeRefundText,
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
                title={paymentType === 'refund' ? 'Process Refund' : 'Record Payment'}
                onPress={handleAddPayment}
                loading={loading}
                variant={paymentType === 'refund' ? 'danger' : 'success'}
                disabled={!paymentType}
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
  sectionHint: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
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
    minWidth: 100,
  },
  serviceChipSelected: { borderColor: colors.success, backgroundColor: colors.success + '10' },
  serviceChipText: { fontSize: fontSize.sm, color: colors.text },
  serviceChipPrice: { fontSize: fontSize.xs, color: colors.success, fontWeight: '600' },
  takeawayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: spacing.sm,
  },
  takeawayChip: {
    flex: 1,
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  qtyBtn: {
    padding: spacing.xs,
  },
  qtyText: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
  totalSection: {
    gap: spacing.xs,
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
    borderWidth: 1,
    borderColor: colors.border,
  },
  driverOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  driverName: { marginLeft: spacing.sm, fontSize: fontSize.md, color: colors.text },
  // Payment styles
  paymentCreateSection: {
    backgroundColor: colors.success + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.success + '30',
  },
  paymentSummary: {
    backgroundColor: colors.divider,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  paymentSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  paymentSummaryLabel: { fontSize: fontSize.md, color: colors.textSecondary },
  paymentSummaryValue: { fontSize: fontSize.md, fontWeight: '600', color: colors.text },
  paymentHistory: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  paymentHistoryTitle: { fontSize: fontSize.sm, fontWeight: '600', color: colors.text, marginBottom: spacing.sm },
  paymentHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  paymentHistoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  paymentHistoryType: { fontSize: fontSize.sm, color: colors.text },
  paymentHistoryAmount: { fontSize: fontSize.sm, fontWeight: '600' },
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
    maxHeight: '80%',
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
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  paymentBalanceLabel: { fontSize: fontSize.md, color: colors.text },
  paymentBalanceValue: { fontSize: fontSize.xl, fontWeight: '700', color: colors.primary },
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
    height: 80,
    textAlignVertical: 'top',
    fontSize: fontSize.md,
  },
  paymentTypesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  paymentTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paymentTypeChipSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  paymentTypeRefund: {
    borderColor: colors.danger,
  },
  paymentTypeRefundSelected: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  paymentTypeText: { fontSize: fontSize.sm, color: colors.text },
  paymentTypeTextSelected: { color: '#fff' },
  paymentTypeRefundText: { color: colors.danger },
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
