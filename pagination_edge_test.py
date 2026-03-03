#!/usr/bin/env python3

import requests
import json
from datetime import datetime

# Test configuration
BACKEND_URL = "https://retail-desk-1.preview.emergentagent.com/api"
ADMIN_EMAIL = "admin@store.com"
ADMIN_PASSWORD = "admin123"

def get_auth_token():
    """Get authentication token"""
    login_data = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    response = requests.post(f"{BACKEND_URL}/auth/login", json=login_data)
    if response.status_code == 200:
        return response.json()["access_token"]
    return None

def test_edge_cases():
    """Test edge cases for pagination"""
    print("🔍 Testing Pagination Edge Cases")
    print("=" * 40)
    
    token = get_auth_token()
    if not token:
        print("❌ Authentication failed")
        return
        
    headers = {"Authorization": f"Bearer {token}"}
    
    # Test cases with different limits and offsets
    test_cases = [
        # (endpoint, params, description)
        ("/orders", "skip=0&limit=1", "Single item limit"),
        ("/products", "skip=5&limit=3", "Skip some items"),
        ("/services", "skip=10&limit=5", "Skip beyond available items"),
        ("/users", "limit=100", "Large limit (should use default 100)"),
        ("/orders", "skip=100", "Skip beyond all items"),
        ("/products", "skip=0&limit=0", "Zero limit"),
        ("/services", "skip=-1&limit=5", "Negative skip"),
        ("/users", "skip=0&limit=-1", "Negative limit"),
    ]
    
    for endpoint, params, description in test_cases:
        try:
            response = requests.get(f"{BACKEND_URL}{endpoint}?{params}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ {description}: {len(data)} items returned")
                
                # Check if limit was respected (for positive limits)
                if "limit=" in params:
                    limit_str = params.split("limit=")[1].split("&")[0]
                    if limit_str.isdigit():
                        limit = int(limit_str)
                        if limit > 0 and len(data) > limit:
                            print(f"  ⚠️  Expected max {limit} items, got {len(data)}")
                        
            else:
                print(f"❌ {description}: HTTP {response.status_code}")
        except Exception as e:
            print(f"❌ {description}: Exception - {e}")
    
    # Test without authentication
    print("\n🔒 Testing Pagination Without Authentication")
    try:
        response = requests.get(f"{BACKEND_URL}/orders?skip=0&limit=5")
        if response.status_code == 401:
            print("✅ Properly rejected unauthenticated request")
        else:
            print(f"⚠️  Unexpected response for unauthenticated request: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception testing unauthenticated request: {e}")
    
    # Test data consistency - verify skip/offset works correctly
    print("\n🔄 Testing Pagination Consistency")
    try:
        # Get first 3 items
        response1 = requests.get(f"{BACKEND_URL}/products?skip=0&limit=3", headers=headers)
        # Get next 3 items  
        response2 = requests.get(f"{BACKEND_URL}/products?skip=3&limit=3", headers=headers)
        
        if response1.status_code == 200 and response2.status_code == 200:
            data1 = response1.json()
            data2 = response2.json()
            
            # Check for ID overlap (shouldn't have duplicates)
            ids1 = {item["id"] for item in data1}
            ids2 = {item["id"] for item in data2}
            overlap = ids1.intersection(ids2)
            
            if not overlap:
                print(f"✅ No duplicate items between pages: {len(data1)} + {len(data2)} items")
            else:
                print(f"⚠️  Found {len(overlap)} duplicate items between pages")
        else:
            print("❌ Failed to test pagination consistency")
    except Exception as e:
        print(f"❌ Exception testing pagination consistency: {e}")

if __name__ == "__main__":
    test_edge_cases()