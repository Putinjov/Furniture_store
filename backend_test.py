#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Test configuration
BACKEND_URL = "https://retail-desk-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@store.com"
ADMIN_PASSWORD = "admin123"

def test_authentication():
    """Test login and get authentication token"""
    print("🔐 Testing Authentication...")
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
    
    if response.status_code == 200:
        token = response.json()["access_token"]
        user_info = response.json()["user"]
        print(f"✅ Login successful - User: {user_info['name']} ({user_info['role']})")
        return token
    else:
        print(f"❌ Login failed: {response.status_code} - {response.text}")
        return None

def test_pagination_endpoint(endpoint_path, token, expected_items=None, endpoint_name=""):
    """Test pagination on a specific endpoint"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n📊 Testing {endpoint_name} Pagination...")
    
    results = {
        "default": {"status": False, "count": 0, "error": None},
        "limit_2": {"status": False, "count": 0, "error": None},
        "skip_2_limit_2": {"status": False, "count": 0, "error": None}
    }
    
    # Test 1: Default parameters (no skip/limit)
    try:
        response = requests.get(f"{BACKEND_URL}{endpoint_path}", headers=headers)
        if response.status_code == 200:
            data = response.json()
            results["default"]["status"] = True
            results["default"]["count"] = len(data)
            print(f"  ✅ Default query: {len(data)} items")
        else:
            results["default"]["error"] = f"Status {response.status_code}: {response.text[:100]}"
            print(f"  ❌ Default query failed: {response.status_code}")
    except Exception as e:
        results["default"]["error"] = str(e)
        print(f"  ❌ Default query exception: {e}")
    
    # Test 2: With limit=2
    try:
        response = requests.get(f"{BACKEND_URL}{endpoint_path}?skip=0&limit=2", headers=headers)
        if response.status_code == 200:
            data = response.json()
            results["limit_2"]["status"] = True
            results["limit_2"]["count"] = len(data)
            if len(data) <= 2:
                print(f"  ✅ Limit 2 query: {len(data)} items (≤2 as expected)")
            else:
                print(f"  ⚠️  Limit 2 query: {len(data)} items (>2, limit not working)")
        else:
            results["limit_2"]["error"] = f"Status {response.status_code}: {response.text[:100]}"
            print(f"  ❌ Limit 2 query failed: {response.status_code}")
    except Exception as e:
        results["limit_2"]["error"] = str(e)
        print(f"  ❌ Limit 2 query exception: {e}")
    
    # Test 3: With skip=2&limit=2 (offset test)
    try:
        response = requests.get(f"{BACKEND_URL}{endpoint_path}?skip=2&limit=2", headers=headers)
        if response.status_code == 200:
            data = response.json()
            results["skip_2_limit_2"]["status"] = True
            results["skip_2_limit_2"]["count"] = len(data)
            if len(data) <= 2:
                print(f"  ✅ Skip 2 Limit 2 query: {len(data)} items (≤2 as expected)")
            else:
                print(f"  ⚠️  Skip 2 Limit 2 query: {len(data)} items (>2, limit not working)")
        else:
            results["skip_2_limit_2"]["error"] = f"Status {response.status_code}: {response.text[:100]}"
            print(f"  ❌ Skip 2 Limit 2 query failed: {response.status_code}")
    except Exception as e:
        results["skip_2_limit_2"]["error"] = str(e)
        print(f"  ❌ Skip 2 Limit 2 query exception: {e}")
    
    return results

def create_test_data(token):
    """Create enough test data to properly test pagination"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n🏗️  Setting up test data for pagination...")
    
    # Create categories first (needed for products)
    categories_created = 0
    category_names = ["Living Room", "Bedroom", "Kitchen", "Office", "Outdoor", "Storage"]
    
    for name in category_names:
        try:
            category_data = {
                "name": name,
                "description": f"{name} furniture and accessories"
            }
            response = requests.post(f"{BACKEND_URL}/categories", json=category_data, headers=headers)
            if response.status_code == 200:
                categories_created += 1
        except Exception:
            pass
    
    print(f"  📂 Categories setup: {categories_created} categories")
    
    # Get first category for products
    try:
        response = requests.get(f"{BACKEND_URL}/categories", headers=headers)
        if response.status_code == 200 and response.json():
            first_category_id = response.json()[0]["id"]
        else:
            print("  ❌ No categories found for product creation")
            return
    except Exception:
        print("  ❌ Failed to get categories")
        return
    
    # Create products
    products_created = 0
    product_names = ["Sofa Set", "Coffee Table", "Dining Table", "Office Chair", "Bookshelf", "Wardrobe", "Bed Frame", "Nightstand"]
    
    for i, name in enumerate(product_names):
        try:
            product_data = {
                "name": name,
                "description": f"Premium {name.lower()} for your home",
                "category_id": first_category_id,
                "price": 299.99 + (i * 100),
                "cost": 199.99 + (i * 50),
                "stock_quantity": 5 + i,
                "status": "in_stock"
            }
            response = requests.post(f"{BACKEND_URL}/products", json=product_data, headers=headers)
            if response.status_code == 200:
                products_created += 1
        except Exception:
            pass
    
    print(f"  🛏️  Products setup: {products_created} products")
    
    # Create users
    users_created = 0
    user_data_list = [
        {"email": "seller1@store.com", "name": "Maria Gonzalez", "password": "seller123", "role": "seller"},
        {"email": "seller2@store.com", "name": "John Smith", "password": "seller123", "role": "seller"},
        {"email": "driver1@store.com", "name": "Carlos Rodriguez", "password": "driver123", "role": "driver"},
        {"email": "driver2@store.com", "name": "Ahmed Ali", "password": "driver123", "role": "driver"},
        {"email": "manager1@store.com", "name": "Sarah Wilson", "password": "manager123", "role": "manager"},
    ]
    
    for user_data in user_data_list:
        try:
            response = requests.post(f"{BACKEND_URL}/users", json=user_data, headers=headers)
            if response.status_code == 200:
                users_created += 1
        except Exception:
            pass
    
    print(f"  👥 Users setup: {users_created} users")
    
    # Create orders (need products first)
    try:
        response = requests.get(f"{BACKEND_URL}/products?limit=3", headers=headers)
        if response.status_code == 200 and response.json():
            products = response.json()[:3]  # Get first 3 products
            
            orders_created = 0
            for i in range(6):  # Create 6 orders for testing
                try:
                    order_data = {
                        "customer": {
                            "name": f"Customer {i+1}",
                            "phone": f"+353871234{i:03d}",
                            "email": f"customer{i+1}@example.com",
                            "address": f"{i+1} Test Street, Dublin, Ireland"
                        },
                        "items": [
                            {
                                "product_id": products[i % len(products)]["id"],
                                "product_name": products[i % len(products)]["name"],
                                "quantity": 1 + (i % 2),
                                "unit_price": products[i % len(products)]["price"],
                                "total_price": products[i % len(products)]["price"] * (1 + (i % 2))
                            }
                        ],
                        "services": [],
                        "discount_percent": 0,
                        "payment_status": "unpaid",
                        "amount_paid": 0
                    }
                    response = requests.post(f"{BACKEND_URL}/orders", json=order_data, headers=headers)
                    if response.status_code == 200:
                        orders_created += 1
                except Exception:
                    pass
            
            print(f"  🛒 Orders setup: {orders_created} orders")
        else:
            print("  ❌ No products available for order creation")
    except Exception:
        print("  ❌ Failed to create orders")

def main():
    """Main test function"""
    print("🚀 Starting Backend Pagination Tests")
    print("=" * 50)
    
    # Authenticate
    token = test_authentication()
    if not token:
        print("❌ Authentication failed. Cannot proceed with tests.")
        return
    
    # Create test data
    create_test_data(token)
    
    # Test all pagination endpoints
    endpoints_to_test = [
        ("/orders", "Orders"),
        ("/products", "Products"), 
        ("/services", "Services"),
        ("/users", "Users"),
        ("/deliveries", "Deliveries"),
        ("/categories", "Categories (no pagination needed)")
    ]
    
    all_results = {}
    
    for endpoint_path, endpoint_name in endpoints_to_test:
        results = test_pagination_endpoint(endpoint_path, token, endpoint_name=endpoint_name)
        all_results[endpoint_name] = results
    
    # Summary report
    print("\n" + "=" * 50)
    print("📋 PAGINATION TEST SUMMARY")
    print("=" * 50)
    
    total_tests = 0
    passed_tests = 0
    
    for endpoint_name, results in all_results.items():
        print(f"\n{endpoint_name}:")
        for test_name, result in results.items():
            total_tests += 1
            if result["status"]:
                passed_tests += 1
                print(f"  ✅ {test_name}: PASSED ({result['count']} items)")
            else:
                print(f"  ❌ {test_name}: FAILED - {result['error']}")
    
    print(f"\n📊 Overall Results: {passed_tests}/{total_tests} tests passed")
    
    if passed_tests == total_tests:
        print("🎉 ALL PAGINATION TESTS PASSED!")
    else:
        print(f"⚠️  {total_tests - passed_tests} tests failed - see details above")
    
    # Test specific pagination scenarios
    print("\n" + "=" * 50)
    print("🎯 SPECIFIC PAGINATION SCENARIO TESTS")
    print("=" * 50)
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test the specific scenarios mentioned in the request
    test_scenarios = [
        ("GET /api/orders?skip=0&limit=5", "/orders?skip=0&limit=5"),
        ("GET /api/products?skip=0&limit=5", "/products?skip=0&limit=5"),
        ("GET /api/services?skip=0&limit=5", "/services?skip=0&limit=5"),
        ("GET /api/users?skip=0&limit=5", "/users?skip=0&limit=5"),
        ("GET /api/deliveries?skip=0&limit=5", "/deliveries?skip=0&limit=5")
    ]
    
    for test_name, endpoint in test_scenarios:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                count = len(data)
                if count <= 5:
                    print(f"  ✅ {test_name}: {count} items (≤5 as expected)")
                else:
                    print(f"  ❌ {test_name}: {count} items (>5, pagination not working)")
            else:
                print(f"  ❌ {test_name}: Failed with status {response.status_code}")
        except Exception as e:
            print(f"  ❌ {test_name}: Exception - {e}")

if __name__ == "__main__":
    main()