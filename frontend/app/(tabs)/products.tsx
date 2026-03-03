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
import { Picker } from '@react-native-picker/picker';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Card } from '../../src/components/Card';
import { StatusBadge } from '../../src/components/StatusBadge';
import { useAuthStore } from '../../src/store/authStore';
import { colors, spacing, fontSize, borderRadius } from '../../src/constants/theme';
import api from '../../src/api/client';

interface Category {
  id: string;
  name: string;
  description?: string;
}

interface Product {
  id: string;
  name: string;
  description?: string;
  category_id: string;
  category_name?: string;
  price: number;
  cost: number;
  stock_quantity: number;
  status: string;
  expected_restock_date?: string;
  low_stock_threshold: number;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  service_type: string;
  base_price: number;
}

export default function ProductsScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'products' | 'services' | 'categories'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'product' | 'service' | 'category'>('product');
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formCost, setFormCost] = useState('');
  const [formStock, setFormStock] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formStatus, setFormStatus] = useState('in_stock');
  const [formThreshold, setFormThreshold] = useState('5');

  const canEdit = user?.role === 'owner' || user?.role === 'manager';

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, servicesRes, categoriesRes] = await Promise.all([
        api.get('/products'),
        api.get('/services'),
        api.get('/categories'),
      ]);
      setProducts(productsRes.data);
      setServices(servicesRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPrice('');
    setFormCost('');
    setFormStock('');
    setFormCategory('');
    setFormStatus('in_stock');
    setFormThreshold('5');
    setEditingItem(null);
  };

  const openModal = (type: 'product' | 'service' | 'category', item?: any) => {
    setModalType(type);
    if (item) {
      setEditingItem(item);
      setFormName(item.name);
      setFormDescription(item.description || '');
      if (type === 'product') {
        setFormPrice(item.price.toString());
        setFormCost(item.cost.toString());
        setFormStock(item.stock_quantity.toString());
        setFormCategory(item.category_id);
        setFormStatus(item.status);
        setFormThreshold(item.low_stock_threshold.toString());
      } else if (type === 'service') {
        setFormPrice(item.price.toString());
      }
    } else {
      resetForm();
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      if (modalType === 'product') {
        if (!formCategory) {
          Alert.alert('Error', 'Please select a category');
          setLoading(false);
          return;
        }
        const data = {
          name: formName,
          description: formDescription,
          category_id: formCategory,
          price: parseFloat(formPrice) || 0,
          cost: parseFloat(formCost) || 0,
          stock_quantity: parseInt(formStock) || 0,
          status: formStatus,
          low_stock_threshold: parseInt(formThreshold) || 5,
        };
        if (editingItem) {
          await api.put(`/products/${editingItem.id}`, data);
        } else {
          await api.post('/products', data);
        }
      } else if (modalType === 'service') {
        const data = {
          name: formName,
          description: formDescription,
          price: parseFloat(formPrice) || 0,
        };
        if (editingItem) {
          await api.put(`/services/${editingItem.id}`, data);
        } else {
          await api.post('/services', data);
        }
      } else {
        const data = { name: formName, description: formDescription };
        if (editingItem) {
          await api.put(`/categories/${editingItem.id}`, data);
        } else {
          await api.post('/categories', data);
        }
      }

      Alert.alert('Success', `${modalType.charAt(0).toUpperCase() + modalType.slice(1)} saved successfully`);
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (type: string, id: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to delete this ${type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/${type}s/${id}`);
              fetchData();
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <Card onPress={canEdit ? () => openModal('product', item) : undefined}>
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{item.name}</Text>
        <StatusBadge status={item.status} type="product" />
      </View>
      <Text style={styles.categoryText}>{item.category_name}</Text>
      <View style={styles.productMeta}>
        <Text style={styles.productPrice}>€{item.price.toFixed(2)}</Text>
        <Text style={[
          styles.stockText,
          item.stock_quantity <= item.low_stock_threshold && styles.lowStock
        ]}>
          Stock: {item.stock_quantity}
        </Text>
      </View>
      {canEdit && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete('product', item.id)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      )}
    </Card>
  );

  const renderService = ({ item }: { item: Service }) => {
    const getServiceTypeLabel = (type: string) => {
      switch(type) {
        case 'assembly': return 'Assembly';
        case 'delivery': return 'Delivery';
        case 'takeaway_mattress_small': return 'Takeaway - Small Mattress';
        case 'takeaway_mattress_big': return 'Takeaway - Big Mattress';
        case 'takeaway_sofa': return 'Takeaway - Sofa';
        default: return type;
      }
    };
    
    const getPriceDisplay = () => {
      if (item.service_type === 'assembly') {
        return '€50+ (based on items)';
      }
      if (item.base_price === 0) {
        return 'FREE';
      }
      return `€${item.base_price.toFixed(2)}`;
    };
    
    return (
      <Card>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.serviceType}>{getServiceTypeLabel(item.service_type)}</Text>
        {item.description && <Text style={styles.descText}>{item.description}</Text>}
        <Text style={styles.productPrice}>{getPriceDisplay()}</Text>
      </Card>
    );
  };

  const renderCategory = ({ item }: { item: Category }) => (
    <Card onPress={canEdit ? () => openModal('category', item) : undefined}>
      <Text style={styles.productName}>{item.name}</Text>
      {item.description && <Text style={styles.descText}>{item.description}</Text>}
      {canEdit && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete('categor', item.id)}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      )}
    </Card>
  );

  const getModalTitle = () => {
    const action = editingItem ? 'Edit' : 'Add';
    return `${action} ${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory</Text>
        {canEdit && (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => openModal(activeTab === 'categories' ? 'category' : activeTab === 'services' ? 'service' : 'product')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.tabs}>
        {['products', 'services', 'categories'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={activeTab === 'products' ? products : activeTab === 'services' ? services : categories}
        renderItem={activeTab === 'products' ? renderProduct : activeTab === 'services' ? renderService : renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyText}>No {activeTab} yet</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{getModalTitle()}</Text>
            <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView style={styles.modalContent}>
              <Input label="Name" value={formName} onChangeText={setFormName} placeholder="Enter name" />
              <Input
                label="Description"
                value={formDescription}
                onChangeText={setFormDescription}
                placeholder="Enter description"
                multiline
              />

              {(modalType === 'product' || modalType === 'service') && (
                <Input
                  label="Price (€)"
                  value={formPrice}
                  onChangeText={setFormPrice}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              )}

              {modalType === 'product' && (
                <>
                  <Input
                    label="Cost (€)"
                    value={formCost}
                    onChangeText={setFormCost}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                  <Input
                    label="Stock Quantity"
                    value={formStock}
                    onChangeText={setFormStock}
                    placeholder="0"
                    keyboardType="number-pad"
                  />
                  <Input
                    label="Low Stock Threshold"
                    value={formThreshold}
                    onChangeText={setFormThreshold}
                    placeholder="5"
                    keyboardType="number-pad"
                  />

                  <Text style={styles.label}>Category</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formCategory}
                      onValueChange={setFormCategory}
                      style={styles.picker}
                    >
                      <Picker.Item label="Select category..." value="" />
                      {categories.map((cat) => (
                        <Picker.Item key={cat.id} label={cat.name} value={cat.id} />
                      ))}
                    </Picker>
                  </View>

                  <Text style={styles.label}>Status</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={formStatus}
                      onValueChange={setFormStatus}
                      style={styles.picker}
                    >
                      <Picker.Item label="In Stock" value="in_stock" />
                      <Picker.Item label="Out of Stock" value="out_of_stock" />
                      <Picker.Item label="Expected Soon" value="expected_soon" />
                      <Picker.Item label="Pre-order" value="pre_order" />
                    </Picker>
                  </View>
                </>
              )}

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
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.border,
  },
  activeTab: { borderBottomColor: colors.primary },
  tabText: { fontSize: fontSize.md, color: colors.textSecondary },
  activeTabText: { color: colors.primary, fontWeight: '600' },
  listContent: { padding: spacing.md },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  productName: { fontSize: fontSize.lg, fontWeight: '600', color: colors.text },
  categoryText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  serviceType: { fontSize: fontSize.sm, color: colors.success, marginBottom: spacing.xs, fontWeight: '500' },
  descText: { fontSize: fontSize.sm, color: colors.textSecondary, marginVertical: spacing.xs },
  productMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productPrice: { fontSize: fontSize.lg, fontWeight: '700', color: colors.primary },
  stockText: { fontSize: fontSize.sm, color: colors.textSecondary },
  lowStock: { color: colors.danger, fontWeight: '600' },
  deleteButton: { position: 'absolute', top: spacing.md, right: spacing.md },
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
    marginTop: spacing.sm,
  },
  pickerContainer: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  picker: { height: 50 },
});
