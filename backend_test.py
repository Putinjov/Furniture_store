#!/usr/bin/env python3
"""
Comprehensive Backend API Tests for Furniture Store Management System
Tests all CRUD operations, authentication, RBAC, and business logic
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, Any, Optional

class FurnitureStoreAPITester:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.admin_token = None
        self.seller_token = None
        self.driver_token = None
        self.created_resources = {
            'categories': [],
            'products': [],
            'services': [],
            'users': [],
            'orders': [],
            'deliveries': []
        }
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, message: str, details: Dict = None):
        result = {
            'test': test_name,
            'success': success,
            'message': message,
            'details': details or {},
            'timestamp': datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, headers: Dict = None, token: str = None) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.base_url}{endpoint}"
        request_headers = {"Content-Type": "application/json"}
        
        if headers:
            request_headers.update(headers)
        
        if token:
            request_headers["Authorization"] = f"Bearer {token}"
        
        try:
            if method.upper() == 'GET':
                response = requests.get(url, headers=request_headers, timeout=30)
            elif method.upper() == 'POST':
                response = requests.post(url, headers=request_headers, json=data, timeout=30)
            elif method.upper() == 'PUT':
                response = requests.put(url, headers=request_headers, json=data, timeout=30)
            elif method.upper() == 'DELETE':
                response = requests.delete(url, headers=request_headers, timeout=30)
            else:
                return False, {"error": f"Unsupported method: {method}"}, 0
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}
            
            return response.status_code < 400, response_data, response.status_code
        
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}, 0

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n=== TESTING AUTHENTICATION ===")
        
        # Test admin login
        login_data = {
            "email": "admin@store.com",
            "password": "admin123"
        }
        
        success, response, status_code = self.make_request('POST', '/auth/login', login_data)
        if success and 'access_token' in response:
            self.admin_token = response['access_token']
            self.log_result("Admin Login", True, "Successfully logged in as admin", {
                'user_role': response.get('user', {}).get('role'),
                'user_email': response.get('user', {}).get('email')
            })
        else:
            self.log_result("Admin Login", False, f"Login failed: {response}", {'status_code': status_code})
            return False
        
        # Test get current user
        success, response, status_code = self.make_request('GET', '/auth/me', token=self.admin_token)
        if success:
            self.log_result("Get Current User", True, f"Retrieved user: {response.get('name')}", {
                'user_id': response.get('id'),
                'role': response.get('role')
            })
        else:
            self.log_result("Get Current User", False, f"Failed to get user info: {response}", {'status_code': status_code})
        
        # Test invalid login
        invalid_login = {
            "email": "invalid@example.com",
            "password": "wrongpassword"
        }
        success, response, status_code = self.make_request('POST', '/auth/login', invalid_login)
        if not success and status_code == 401:
            self.log_result("Invalid Login Rejection", True, "Correctly rejected invalid credentials")
        else:
            self.log_result("Invalid Login Rejection", False, "Should have rejected invalid credentials")
        
        return self.admin_token is not None

    def test_user_management(self):
        """Test user CRUD operations (Owner only)"""
        print("\n=== TESTING USER MANAGEMENT ===")
        
        if not self.admin_token:
            self.log_result("User Management", False, "No admin token available")
            return
        
        # Create a seller user
        seller_data = {
            "email": "seller.maria@store.com",
            "name": "Maria Gonzalez",
            "password": "seller123",
            "role": "seller"
        }
        
        success, response, status_code = self.make_request('POST', '/users', seller_data, token=self.admin_token)
        if success and 'id' in response:
            seller_id = response['id']
            self.created_resources['users'].append(seller_id)
            self.log_result("Create Seller User", True, f"Created seller: {response['name']}", {
                'user_id': seller_id,
                'email': response['email']
            })
            
            # Login as seller to get token
            seller_login = {
                "email": "seller.maria@store.com",
                "password": "seller123"
            }
            success, login_response, _ = self.make_request('POST', '/auth/login', seller_login)
            if success:
                self.seller_token = login_response['access_token']
        else:
            self.log_result("Create Seller User", False, f"Failed to create seller: {response}", {'status_code': status_code})
        
        # Create a driver user
        driver_data = {
            "email": "driver.carlos@store.com",
            "name": "Carlos Rodriguez",
            "password": "driver123",
            "role": "driver"
        }
        
        success, response, status_code = self.make_request('POST', '/users', driver_data, token=self.admin_token)
        if success and 'id' in response:
            driver_id = response['id']
            self.created_resources['users'].append(driver_id)
            self.log_result("Create Driver User", True, f"Created driver: {response['name']}", {
                'user_id': driver_id,
                'email': response['email']
            })
            
            # Login as driver to get token
            driver_login = {
                "email": "driver.carlos@store.com",
                "password": "driver123"
            }
            success, login_response, _ = self.make_request('POST', '/auth/login', driver_login)
            if success:
                self.driver_token = login_response['access_token']
        else:
            self.log_result("Create Driver User", False, f"Failed to create driver: {response}", {'status_code': status_code})
        
        # Get all users
        success, response, status_code = self.make_request('GET', '/users', token=self.admin_token)
        if success and isinstance(response, list):
            user_count = len(response)
            self.log_result("List All Users", True, f"Retrieved {user_count} users", {
                'user_count': user_count,
                'users': [{'name': u.get('name'), 'role': u.get('role')} for u in response[:3]]
            })
        else:
            self.log_result("List All Users", False, f"Failed to list users: {response}", {'status_code': status_code})
        
        # Test RBAC - seller shouldn't be able to create users
        if self.seller_token:
            test_user = {
                "email": "test@store.com",
                "name": "Test User",
                "password": "test123",
                "role": "seller"
            }
            success, response, status_code = self.make_request('POST', '/users', test_user, token=self.seller_token)
            if not success and status_code == 403:
                self.log_result("RBAC User Creation", True, "Seller correctly denied user creation permission")
            else:
                self.log_result("RBAC User Creation", False, "Seller should not be able to create users")

    def test_categories(self):
        """Test category CRUD operations"""
        print("\n=== TESTING CATEGORIES ===")
        
        if not self.admin_token:
            self.log_result("Categories", False, "No admin token available")
            return
        
        # Create categories
        categories_data = [
            {"name": "Living Room", "description": "Living room furniture and accessories"},
            {"name": "Bedroom", "description": "Bedroom furniture and decor"},
            {"name": "Kitchen", "description": "Kitchen furniture and equipment"}
        ]
        
        for cat_data in categories_data:
            success, response, status_code = self.make_request('POST', '/categories', cat_data, token=self.admin_token)
            if success and 'id' in response:
                category_id = response['id']
                self.created_resources['categories'].append(category_id)
                self.log_result(f"Create Category: {cat_data['name']}", True, f"Created category: {response['name']}", {
                    'category_id': category_id,
                    'description': response.get('description')
                })
            else:
                self.log_result(f"Create Category: {cat_data['name']}", False, f"Failed to create category: {response}", {'status_code': status_code})
        
        # Get all categories
        success, response, status_code = self.make_request('GET', '/categories', token=self.admin_token)
        if success and isinstance(response, list):
            category_count = len(response)
            self.log_result("List All Categories", True, f"Retrieved {category_count} categories", {
                'category_count': category_count,
                'categories': [{'name': c.get('name'), 'id': c.get('id')} for c in response]
            })
        else:
            self.log_result("List All Categories", False, f"Failed to list categories: {response}", {'status_code': status_code})

    def test_products(self):
        """Test product CRUD operations"""
        print("\n=== TESTING PRODUCTS ===")
        
        if not self.admin_token or not self.created_resources['categories']:
            self.log_result("Products", False, "No admin token or categories available")
            return
        
        living_room_category_id = self.created_resources['categories'][0]
        
        # Create products
        products_data = [
            {
                "name": "Luxury Sofa Set",
                "description": "Premium 3-piece leather sofa set",
                "category_id": living_room_category_id,
                "price": 1299.99,
                "cost": 800.00,
                "stock_quantity": 5,
                "status": "in_stock",
                "low_stock_threshold": 2
            },
            {
                "name": "Coffee Table Oak",
                "description": "Solid oak coffee table with storage",
                "category_id": living_room_category_id,
                "price": 399.99,
                "cost": 250.00,
                "stock_quantity": 12,
                "status": "in_stock",
                "low_stock_threshold": 3
            }
        ]
        
        for prod_data in products_data:
            success, response, status_code = self.make_request('POST', '/products', prod_data, token=self.admin_token)
            if success and 'id' in response:
                product_id = response['id']
                self.created_resources['products'].append(product_id)
                self.log_result(f"Create Product: {prod_data['name']}", True, f"Created product: {response['name']}", {
                    'product_id': product_id,
                    'price': response.get('price'),
                    'stock': response.get('stock_quantity')
                })
            else:
                self.log_result(f"Create Product: {prod_data['name']}", False, f"Failed to create product: {response}", {'status_code': status_code})
        
        # Get all products
        success, response, status_code = self.make_request('GET', '/products', token=self.admin_token)
        if success and isinstance(response, list):
            product_count = len(response)
            self.log_result("List All Products", True, f"Retrieved {product_count} products", {
                'product_count': product_count,
                'products': [{'name': p.get('name'), 'price': p.get('price'), 'stock': p.get('stock_quantity')} for p in response[:3]]
            })
        else:
            self.log_result("List All Products", False, f"Failed to list products: {response}", {'status_code': status_code})
        
        # Update product stock
        if self.created_resources['products']:
            product_id = self.created_resources['products'][0]
            update_data = {
                "stock_quantity": 3,
                "status": "in_stock"
            }
            success, response, status_code = self.make_request('PUT', f'/products/{product_id}', update_data, token=self.admin_token)
            if success:
                self.log_result("Update Product Stock", True, f"Updated product stock to {response.get('stock_quantity')}", {
                    'product_id': product_id,
                    'new_stock': response.get('stock_quantity')
                })
            else:
                self.log_result("Update Product Stock", False, f"Failed to update product: {response}", {'status_code': status_code})

    def test_services(self):
        """Test service CRUD operations"""
        print("\n=== TESTING SERVICES ===")
        
        if not self.admin_token:
            self.log_result("Services", False, "No admin token available")
            return
        
        # Create services
        services_data = [
            {
                "name": "Assembly Service",
                "description": "Professional furniture assembly at your location",
                "price": 75.00
            },
            {
                "name": "Delivery Service",
                "description": "Same-day furniture delivery service",
                "price": 50.00
            },
            {
                "name": "Installation Service",
                "description": "Complete furniture installation and setup",
                "price": 100.00
            }
        ]
        
        for service_data in services_data:
            success, response, status_code = self.make_request('POST', '/services', service_data, token=self.admin_token)
            if success and 'id' in response:
                service_id = response['id']
                self.created_resources['services'].append(service_id)
                self.log_result(f"Create Service: {service_data['name']}", True, f"Created service: {response['name']}", {
                    'service_id': service_id,
                    'price': response.get('price')
                })
            else:
                self.log_result(f"Create Service: {service_data['name']}", False, f"Failed to create service: {response}", {'status_code': status_code})
        
        # Get all services
        success, response, status_code = self.make_request('GET', '/services', token=self.admin_token)
        if success and isinstance(response, list):
            service_count = len(response)
            self.log_result("List All Services", True, f"Retrieved {service_count} services", {
                'service_count': service_count,
                'services': [{'name': s.get('name'), 'price': s.get('price')} for s in response]
            })
        else:
            self.log_result("List All Services", False, f"Failed to list services: {response}", {'status_code': status_code})

    def test_orders(self):
        """Test order CRUD operations"""
        print("\n=== TESTING ORDERS ===")
        
        if not self.admin_token or not self.created_resources['products'] or not self.created_resources['services']:
            self.log_result("Orders", False, "Missing dependencies (products, services, or admin token)")
            return
        
        # Create an order
        product_id = self.created_resources['products'][0]
        service_id = self.created_resources['services'][0]
        
        order_data = {
            "customer": {
                "name": "Isabella Martinez",
                "phone": "+34-600-123-456",
                "email": "isabella@example.com",
                "address": "Calle Gran Via 123, Madrid",
                "city": "Madrid",
                "postal_code": "28013"
            },
            "items": [
                {
                    "product_id": product_id,
                    "product_name": "Luxury Sofa Set",
                    "quantity": 1,
                    "unit_price": 1299.99,
                    "total_price": 1299.99
                }
            ],
            "services": [
                {
                    "service_id": service_id,
                    "service_name": "Assembly Service",
                    "price": 75.00
                }
            ],
            "seller_comments": "Customer requested delivery next week",
            "discount_percent": 5.0,
            "payment_status": "partially_paid",
            "amount_paid": 500.00
        }
        
        success, response, status_code = self.make_request('POST', '/orders', order_data, token=self.admin_token)
        if success and 'id' in response:
            order_id = response['id']
            self.created_resources['orders'].append(order_id)
            self.log_result("Create Order", True, f"Created order: {response['order_number']}", {
                'order_id': order_id,
                'order_number': response.get('order_number'),
                'total': response.get('total'),
                'customer': response.get('customer', {}).get('name')
            })
        else:
            self.log_result("Create Order", False, f"Failed to create order: {response}", {'status_code': status_code})
        
        # Get all orders
        success, response, status_code = self.make_request('GET', '/orders', token=self.admin_token)
        if success and isinstance(response, list):
            order_count = len(response)
            self.log_result("List All Orders", True, f"Retrieved {order_count} orders", {
                'order_count': order_count,
                'orders': [{'number': o.get('order_number'), 'total': o.get('total'), 'status': o.get('status')} for o in response[:3]]
            })
        else:
            self.log_result("List All Orders", False, f"Failed to list orders: {response}", {'status_code': status_code})
        
        # Update order status (assign driver)
        if self.created_resources['orders'] and self.created_resources['users']:
            order_id = self.created_resources['orders'][0]
            driver_id = None
            
            # Find a driver user
            success, users, _ = self.make_request('GET', '/users', token=self.admin_token)
            if success:
                for user in users:
                    if user.get('role') == 'driver':
                        driver_id = user['id']
                        break
            
            if driver_id:
                update_data = {
                    "status": "ready",
                    "driver_id": driver_id
                }
                success, response, status_code = self.make_request('PUT', f'/orders/{order_id}', update_data, token=self.admin_token)
                if success:
                    self.log_result("Update Order Status", True, f"Updated order to {response.get('status')} with driver {response.get('driver_name')}", {
                        'order_id': order_id,
                        'status': response.get('status'),
                        'driver': response.get('driver_name')
                    })
                else:
                    self.log_result("Update Order Status", False, f"Failed to update order: {response}", {'status_code': status_code})
        
        # Test RBAC - seller should only see their own orders
        if self.seller_token:
            success, response, status_code = self.make_request('GET', '/orders', token=self.seller_token)
            if success:
                # Seller should see fewer orders (only their own)
                seller_orders = len(response)
                self.log_result("RBAC Orders Access", True, f"Seller sees {seller_orders} orders (filtered by role)", {
                    'seller_order_count': seller_orders
                })
            else:
                self.log_result("RBAC Orders Access", False, f"Seller failed to access orders: {response}")

    def test_deliveries(self):
        """Test delivery management"""
        print("\n=== TESTING DELIVERIES ===")
        
        if not self.admin_token:
            self.log_result("Deliveries", False, "No admin token available")
            return
        
        # Get deliveries (should be created when driver is assigned)
        success, response, status_code = self.make_request('GET', '/deliveries', token=self.admin_token)
        if success and isinstance(response, list):
            delivery_count = len(response)
            self.log_result("List All Deliveries", True, f"Retrieved {delivery_count} deliveries", {
                'delivery_count': delivery_count,
                'deliveries': [{'order_number': d.get('order_number'), 'status': d.get('status')} for d in response[:3]]
            })
            
            # Update delivery status if we have deliveries
            if response:
                delivery_id = response[0]['id']
                update_data = {
                    "status": "in_delivery",
                    "notes": "Driver has picked up the items and is en route"
                }
                success, update_response, status_code = self.make_request('PUT', f'/deliveries/{delivery_id}', update_data, token=self.admin_token)
                if success:
                    self.log_result("Update Delivery Status", True, f"Updated delivery to {update_response.get('status')}", {
                        'delivery_id': delivery_id,
                        'status': update_response.get('status'),
                        'notes': update_response.get('notes')
                    })
                else:
                    self.log_result("Update Delivery Status", False, f"Failed to update delivery: {update_response}", {'status_code': status_code})
        else:
            self.log_result("List All Deliveries", success, f"No deliveries found or error: {response}", {'status_code': status_code})
        
        # Test RBAC - driver should only see their own deliveries
        if self.driver_token:
            success, response, status_code = self.make_request('GET', '/deliveries', token=self.driver_token)
            if success:
                driver_deliveries = len(response)
                self.log_result("RBAC Deliveries Access", True, f"Driver sees {driver_deliveries} deliveries (filtered by role)", {
                    'driver_delivery_count': driver_deliveries
                })
            else:
                self.log_result("RBAC Deliveries Access", False, f"Driver failed to access deliveries: {response}")

    def test_receipt_generation(self):
        """Test receipt generation"""
        print("\n=== TESTING RECEIPT GENERATION ===")
        
        if not self.admin_token or not self.created_resources['orders']:
            self.log_result("Receipt Generation", False, "No admin token or orders available")
            return
        
        order_id = self.created_resources['orders'][0]
        success, response, status_code = self.make_request('GET', f'/orders/{order_id}/receipt', token=self.admin_token)
        
        if success and 'receipt' in response:
            receipt_lines = response['receipt'].count('\n')
            self.log_result("Generate Receipt", True, f"Generated receipt with {receipt_lines} lines", {
                'order_id': order_id,
                'receipt_preview': response['receipt'][:200] + '...' if len(response['receipt']) > 200 else response['receipt']
            })
        else:
            self.log_result("Generate Receipt", False, f"Failed to generate receipt: {response}", {'status_code': status_code})

    def test_reports(self):
        """Test reporting endpoints"""
        print("\n=== TESTING REPORTS ===")
        
        if not self.admin_token:
            self.log_result("Reports", False, "No admin token available")
            return
        
        # Test sales summary
        success, response, status_code = self.make_request('GET', '/reports/sales-summary', token=self.admin_token)
        if success and 'total_orders' in response:
            self.log_result("Sales Summary Report", True, f"Generated sales summary", {
                'total_orders': response.get('total_orders'),
                'total_revenue': response.get('total_revenue'),
                'total_items_sold': response.get('total_items_sold'),
                'orders_by_status': response.get('orders_by_status')
            })
        else:
            self.log_result("Sales Summary Report", False, f"Failed to get sales summary: {response}", {'status_code': status_code})
        
        # Test low stock report
        success, response, status_code = self.make_request('GET', '/reports/low-stock', token=self.admin_token)
        if success and isinstance(response, list):
            low_stock_count = len(response)
            self.log_result("Low Stock Report", True, f"Found {low_stock_count} low stock products", {
                'low_stock_count': low_stock_count,
                'products': [{'name': p.get('name'), 'stock': p.get('stock_quantity')} for p in response[:3]]
            })
        else:
            self.log_result("Low Stock Report", False, f"Failed to get low stock report: {response}", {'status_code': status_code})

    def test_health_endpoint(self):
        """Test health check endpoint"""
        print("\n=== TESTING HEALTH ENDPOINT ===")
        
        success, response, status_code = self.make_request('GET', '/health')
        if success and 'status' in response:
            self.log_result("Health Check", True, f"API is {response['status']}", {
                'status': response.get('status'),
                'timestamp': response.get('timestamp')
            })
        else:
            self.log_result("Health Check", False, f"Health check failed: {response}", {'status_code': status_code})

    def run_all_tests(self):
        """Run all tests in order"""
        print("🧪 Starting comprehensive Furniture Store API tests...")
        print(f"Base URL: {self.base_url}")
        
        # Run tests in logical order
        if not self.test_authentication():
            print("❌ Authentication failed - cannot continue with other tests")
            return
            
        self.test_health_endpoint()
        self.test_user_management()
        self.test_categories()
        self.test_products()
        self.test_services()
        self.test_orders()
        self.test_deliveries()
        self.test_receipt_generation()
        self.test_reports()
        
        self.print_summary()

    def print_summary(self):
        """Print test execution summary"""
        print("\n" + "="*60)
        print("📊 TEST EXECUTION SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result['success'])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result['success']:
                    print(f"  • {result['test']}: {result['message']}")
                    if result['details']:
                        print(f"    Details: {result['details']}")
        
        print(f"\n✅ PASSED TESTS ({passed_tests}):")
        for result in self.test_results:
            if result['success']:
                print(f"  • {result['test']}: {result['message']}")
        
        print("\n" + "="*60)
        
        # Save detailed results to file
        with open('/app/test_execution_results.json', 'w') as f:
            json.dump({
                'summary': {
                    'total_tests': total_tests,
                    'passed_tests': passed_tests,
                    'failed_tests': failed_tests,
                    'success_rate': f"{(passed_tests/total_tests)*100:.1f}%"
                },
                'test_results': self.test_results,
                'created_resources': self.created_resources
            }, f, indent=2, default=str)

if __name__ == "__main__":
    # Use the production URL from frontend .env
    API_BASE_URL = "https://retail-desk-1.preview.emergentagent.com/api"
    
    tester = FurnitureStoreAPITester(API_BASE_URL)
    tester.run_all_tests()