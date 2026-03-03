from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timedelta
import jwt
from passlib.context import CryptContext
from bson import ObjectId
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'furniture_store')]

# Create the main app
app = FastAPI(title="Furniture Store Management API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Security
security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.environ.get("SECRET_KEY", "furniture-store-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ================== ENUMS ==================

class UserRole(str, Enum):
    OWNER = "owner"
    MANAGER = "manager"
    SELLER = "seller"
    DRIVER = "driver"

class ProductStatus(str, Enum):
    IN_STOCK = "in_stock"
    OUT_OF_STOCK = "out_of_stock"
    EXPECTED_SOON = "expected_soon"
    PRE_ORDER = "pre_order"

class OrderStatus(str, Enum):
    NEW = "new"
    AWAITING_STOCK = "awaiting_stock"
    READY = "ready"
    IN_DELIVERY = "in_delivery"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class PaymentStatus(str, Enum):
    UNPAID = "unpaid"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"

class DeliveryStatus(str, Enum):
    PENDING = "pending"
    IN_DELIVERY = "in_delivery"
    DELIVERED = "delivered"
    FAILED = "failed"

class PaymentType(str, Enum):
    CASH = "cash"
    CARD = "card"
    CONTACTLESS = "contactless"  # Apple Pay, Google Pay
    PHONE = "phone"  # Payment over phone
    HUMM = "humm"  # Buy now pay later
    REFUND = "refund"

# ================== PYDANTIC MODELS ==================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole
    is_active: bool = True

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    is_active: bool
    created_at: datetime

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Category Models
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryResponse(CategoryBase):
    id: str
    created_at: datetime

# Product Models
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    category_id: str
    price: float
    cost: float
    stock_quantity: int = 0
    status: ProductStatus = ProductStatus.IN_STOCK
    expected_restock_date: Optional[datetime] = None
    low_stock_threshold: int = 5

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[str] = None
    price: Optional[float] = None
    cost: Optional[float] = None
    stock_quantity: Optional[int] = None
    status: Optional[ProductStatus] = None
    expected_restock_date: Optional[datetime] = None
    low_stock_threshold: Optional[int] = None

class ProductResponse(ProductBase):
    id: str
    category_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Service Types Enum
class ServiceType(str, Enum):
    ASSEMBLY = "assembly"
    DELIVERY = "delivery"
    TAKEAWAY_MATTRESS_SMALL = "takeaway_mattress_small"
    TAKEAWAY_MATTRESS_BIG = "takeaway_mattress_big"
    TAKEAWAY_SOFA = "takeaway_sofa"

class DeliveryZone(str, Enum):
    LOCAL = "local"
    MEDIUM = "medium"  # up to 80km
    FAR = "far"  # beyond 80km

# Service Models
class ServiceBase(BaseModel):
    name: str
    description: Optional[str] = None
    service_type: ServiceType
    base_price: float

class ServiceCreate(ServiceBase):
    pass

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None

class ServiceResponse(ServiceBase):
    id: str
    created_at: datetime

# Order Item Models
class OrderItem(BaseModel):
    product_id: str
    product_name: str
    quantity: int
    unit_price: float
    total_price: float

class OrderServiceItem(BaseModel):
    service_id: str
    service_name: str
    service_type: str
    base_price: float
    calculated_price: float
    quantity: Optional[int] = 1
    delivery_zone: Optional[str] = None  # For delivery service

# Payment Record Models
class PaymentRecord(BaseModel):
    id: Optional[str] = None
    amount: float
    payment_type: PaymentType
    notes: Optional[str] = None
    recorded_by: Optional[str] = None
    recorded_by_name: Optional[str] = None
    recorded_at: Optional[datetime] = None

class PaymentCreate(BaseModel):
    amount: float
    payment_type: PaymentType
    notes: Optional[str] = None

# Order Models
class CustomerInfo(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    address: str
    city: Optional[str] = None
    postal_code: Optional[str] = None

class OrderCreate(BaseModel):
    customer: CustomerInfo
    items: List[OrderItem]
    services: Optional[List[OrderServiceItem]] = []
    seller_comments: Optional[str] = None
    discount_percent: Optional[float] = 0
    payment_status: PaymentStatus = PaymentStatus.UNPAID
    amount_paid: Optional[float] = 0

class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None
    payment_status: Optional[PaymentStatus] = None
    seller_comments: Optional[str] = None
    amount_paid: Optional[float] = None
    driver_id: Optional[str] = None

class OrderResponse(BaseModel):
    id: str
    order_number: str
    customer: CustomerInfo
    items: List[OrderItem]
    services: List[OrderServiceItem]
    subtotal: float
    discount_percent: float
    discount_amount: float
    total: float
    status: OrderStatus
    payment_status: PaymentStatus
    amount_paid: float
    payments: Optional[List[PaymentRecord]] = []
    seller_id: str
    seller_name: str
    seller_comments: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

# Delivery Models
class DeliveryUpdate(BaseModel):
    status: DeliveryStatus
    notes: Optional[str] = None

class DeliveryResponse(BaseModel):
    id: str
    order_id: str
    order_number: str
    customer_name: str
    customer_phone: str
    customer_address: str
    status: DeliveryStatus
    notes: Optional[str] = None
    assigned_at: datetime
    updated_at: datetime

# Action Log Model
class ActionLog(BaseModel):
    id: str
    user_id: str
    user_name: str
    action: str
    entity_type: str
    entity_id: str
    details: Optional[Dict[str, Any]] = None
    timestamp: datetime

# Analytics Models
class SalesSummary(BaseModel):
    total_orders: int
    total_revenue: float
    total_items_sold: int
    orders_by_status: Dict[str, int]
    payment_summary: Dict[str, int]

# ================== HELPER FUNCTIONS ==================

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("is_active", True):
            raise HTTPException(status_code=401, detail="User account is deactivated")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def require_roles(allowed_roles: List[UserRole]):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        if current_user["role"] not in [r.value for r in allowed_roles]:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return role_checker

async def log_action(user_id: str, user_name: str, action: str, entity_type: str, entity_id: str, details: dict = None):
    log_entry = {
        "_id": ObjectId(),
        "user_id": user_id,
        "user_name": user_name,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details,
        "timestamp": datetime.utcnow()
    }
    await db.action_logs.insert_one(log_entry)

def generate_order_number():
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    random_suffix = str(uuid.uuid4())[:4].upper()
    return f"ORD-{timestamp}-{random_suffix}"

# ================== INITIALIZATION ==================

@app.on_event("startup")
async def startup_event():
    # Create indexes
    await db.users.create_index("email", unique=True)
    await db.products.create_index("category_id")
    await db.orders.create_index("order_number", unique=True)
    await db.orders.create_index("seller_id")
    await db.orders.create_index("driver_id")
    await db.deliveries.create_index("driver_id")
    await db.action_logs.create_index("timestamp")
    
    # Create default super admin if not exists
    existing_admin = await db.users.find_one({"email": "admin@store.com"})
    if not existing_admin:
        admin_user = {
            "_id": ObjectId(),
            "email": "admin@store.com",
            "name": "Super Admin",
            "password": hash_password("admin123"),
            "role": UserRole.OWNER.value,
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(admin_user)
        logger.info("Default super admin created: admin@store.com / admin123")
    
    # Create default services if none exist
    services_count = await db.services.count_documents({})
    if services_count == 0:
        default_services = [
            {
                "_id": ObjectId(),
                "name": "Assembly",
                "description": "Furniture assembly service - €50 for first 3 pieces, doubles for each additional 3 pieces",
                "service_type": ServiceType.ASSEMBLY.value,
                "base_price": 50,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Delivery - Local",
                "description": "Free delivery for local area",
                "service_type": ServiceType.DELIVERY.value,
                "base_price": 0,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Delivery - Up to 80km",
                "description": "Delivery within 80km radius - €50",
                "service_type": ServiceType.DELIVERY.value,
                "base_price": 50,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Delivery - Far (80km+)",
                "description": "Delivery beyond 80km - €80",
                "service_type": ServiceType.DELIVERY.value,
                "base_price": 80,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Take Away - Small Mattress",
                "description": "Old small mattress removal - €40 each",
                "service_type": ServiceType.TAKEAWAY_MATTRESS_SMALL.value,
                "base_price": 40,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Take Away - Big Mattress",
                "description": "Old big mattress removal - €50 each",
                "service_type": ServiceType.TAKEAWAY_MATTRESS_BIG.value,
                "base_price": 50,
                "created_at": datetime.utcnow()
            },
            {
                "_id": ObjectId(),
                "name": "Take Away - Old Sofa",
                "description": "Old sofa removal - €75 each",
                "service_type": ServiceType.TAKEAWAY_SOFA.value,
                "base_price": 75,
                "created_at": datetime.utcnow()
            },
        ]
        await db.services.insert_many(default_services)
        logger.info("Default services created")

    # Cleanup legacy takeaway service entries that should no longer be selectable
    await db.services.delete_many({
        "name": {
            "$in": [
                "Take Away - Contactless",
                "Take Away - Arrange via Phone"
            ]
        }
    })

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# ================== AUTH ROUTES ==================

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="Account is deactivated")
    
    access_token = create_access_token(data={"sub": str(user["_id"]), "role": user["role"]})
    
    await log_action(str(user["_id"]), user["name"], "login", "user", str(user["_id"]))
    
    return TokenResponse(
        access_token=access_token,
        user=UserResponse(
            id=str(user["_id"]),
            email=user["email"],
            name=user["name"],
            role=user["role"],
            is_active=user["is_active"],
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=str(current_user["_id"]),
        email=current_user["email"],
        name=current_user["name"],
        role=current_user["role"],
        is_active=current_user["is_active"],
        created_at=current_user["created_at"]
    )

# ================== USER ROUTES (Owner Only) ==================

@api_router.post("/users", response_model=UserResponse)
async def create_user(user_data: UserCreate, current_user: dict = Depends(require_roles([UserRole.OWNER]))):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = {
        "_id": ObjectId(),
        "email": user_data.email,
        "name": user_data.name,
        "password": hash_password(user_data.password),
        "role": user_data.role.value,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(new_user)
    
    await log_action(str(current_user["_id"]), current_user["name"], "create_user", "user", str(new_user["_id"]), {"email": user_data.email, "role": user_data.role.value})
    
    return UserResponse(
        id=str(new_user["_id"]),
        email=new_user["email"],
        name=new_user["name"],
        role=new_user["role"],
        is_active=new_user["is_active"],
        created_at=new_user["created_at"]
    )

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))
):
    users = await db.users.find({}, {"password": 0}).skip(skip).limit(limit).to_list(limit)
    return [
        UserResponse(
            id=str(u["_id"]),
            email=u["email"],
            name=u["name"],
            role=u["role"],
            is_active=u["is_active"],
            created_at=u["created_at"]
        ) for u in users
    ]

@api_router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER]))):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user["_id"]),
        email=user["email"],
        name=user["name"],
        role=user["role"],
        is_active=user["is_active"],
        created_at=user["created_at"]
    )

@api_router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(user_id: str, user_data: UserUpdate, current_user: dict = Depends(require_roles([UserRole.OWNER]))):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {k: v for k, v in user_data.dict().items() if v is not None}
    if "password" in update_data:
        update_data["password"] = hash_password(update_data["password"])
    if "role" in update_data:
        update_data["role"] = update_data["role"].value
    
    if update_data:
        await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    
    await log_action(str(current_user["_id"]), current_user["name"], "update_user", "user", user_id, update_data)
    
    updated_user = await db.users.find_one({"_id": ObjectId(user_id)})
    return UserResponse(
        id=str(updated_user["_id"]),
        email=updated_user["email"],
        name=updated_user["name"],
        role=updated_user["role"],
        is_active=updated_user["is_active"],
        created_at=updated_user["created_at"]
    )

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER]))):
    if str(current_user["_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    await log_action(str(current_user["_id"]), current_user["name"], "delete_user", "user", user_id)
    
    return {"message": "User deleted successfully"}

# ================== CATEGORY ROUTES ==================

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(category_data: CategoryCreate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    new_category = {
        "_id": ObjectId(),
        "name": category_data.name,
        "description": category_data.description,
        "created_at": datetime.utcnow()
    }
    await db.categories.insert_one(new_category)
    
    await log_action(str(current_user["_id"]), current_user["name"], "create_category", "category", str(new_category["_id"]))
    
    return CategoryResponse(
        id=str(new_category["_id"]),
        name=new_category["name"],
        description=new_category["description"],
        created_at=new_category["created_at"]
    )

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    categories = await db.categories.find().skip(skip).limit(limit).to_list(limit)
    return [
        CategoryResponse(
            id=str(c["_id"]),
            name=c["name"],
            description=c.get("description"),
            created_at=c["created_at"]
        ) for c in categories
    ]

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, category_data: CategoryCreate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    result = await db.categories.update_one(
        {"_id": ObjectId(category_id)},
        {"$set": {"name": category_data.name, "description": category_data.description}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = await db.categories.find_one({"_id": ObjectId(category_id)})
    return CategoryResponse(
        id=str(category["_id"]),
        name=category["name"],
        description=category.get("description"),
        created_at=category["created_at"]
    )

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    # Check if products use this category
    products_count = await db.products.count_documents({"category_id": category_id})
    if products_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {products_count} products")
    
    result = await db.categories.delete_one({"_id": ObjectId(category_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {"message": "Category deleted successfully"}

# ================== PRODUCT ROUTES ==================

@api_router.post("/products", response_model=ProductResponse)
async def create_product(product_data: ProductCreate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    # Verify category exists
    category = await db.categories.find_one({"_id": ObjectId(product_data.category_id)})
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    now = datetime.utcnow()
    new_product = {
        "_id": ObjectId(),
        **product_data.dict(),
        "status": product_data.status.value,
        "created_at": now,
        "updated_at": now
    }
    await db.products.insert_one(new_product)
    
    await log_action(str(current_user["_id"]), current_user["name"], "create_product", "product", str(new_product["_id"]))
    
    return ProductResponse(
        id=str(new_product["_id"]),
        **{k: v for k, v in new_product.items() if k not in ["_id", "created_at", "updated_at"]},
        category_name=category["name"],
        created_at=new_product["created_at"],
        updated_at=new_product["updated_at"]
    )

@api_router.get("/products", response_model=List[ProductResponse])
async def get_products(
    category_id: Optional[str] = None,
    status: Optional[ProductStatus] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if status:
        query["status"] = status.value
    
    products = await db.products.find(query).skip(skip).limit(limit).to_list(limit)
    
    # Get category names
    category_ids = list(set(p["category_id"] for p in products))
    categories = await db.categories.find({"_id": {"$in": [ObjectId(cid) for cid in category_ids]}}).to_list(100)
    category_map = {str(c["_id"]): c["name"] for c in categories}
    
    return [
        ProductResponse(
            id=str(p["_id"]),
            name=p["name"],
            description=p.get("description"),
            category_id=p["category_id"],
            category_name=category_map.get(p["category_id"]),
            price=p["price"],
            cost=p["cost"],
            stock_quantity=p["stock_quantity"],
            status=p["status"],
            expected_restock_date=p.get("expected_restock_date"),
            low_stock_threshold=p.get("low_stock_threshold", 5),
            created_at=p["created_at"],
            updated_at=p["updated_at"]
        ) for p in products
    ]

@api_router.get("/products/{product_id}", response_model=ProductResponse)
async def get_product(product_id: str, current_user: dict = Depends(get_current_user)):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    category = await db.categories.find_one({"_id": ObjectId(product["category_id"])})
    
    return ProductResponse(
        id=str(product["_id"]),
        name=product["name"],
        description=product.get("description"),
        category_id=product["category_id"],
        category_name=category["name"] if category else None,
        price=product["price"],
        cost=product["cost"],
        stock_quantity=product["stock_quantity"],
        status=product["status"],
        expected_restock_date=product.get("expected_restock_date"),
        low_stock_threshold=product.get("low_stock_threshold", 5),
        created_at=product["created_at"],
        updated_at=product["updated_at"]
    )

@api_router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(product_id: str, product_data: ProductUpdate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    product = await db.products.find_one({"_id": ObjectId(product_id)})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = {k: v for k, v in product_data.dict().items() if v is not None}
    if "status" in update_data:
        update_data["status"] = update_data["status"].value
    update_data["updated_at"] = datetime.utcnow()
    
    await db.products.update_one({"_id": ObjectId(product_id)}, {"$set": update_data})
    
    await log_action(str(current_user["_id"]), current_user["name"], "update_product", "product", product_id, update_data)
    
    return await get_product(product_id, current_user)

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    result = await db.products.delete_one({"_id": ObjectId(product_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await log_action(str(current_user["_id"]), current_user["name"], "delete_product", "product", product_id)
    
    return {"message": "Product deleted successfully"}

# ================== SERVICE ROUTES ==================

@api_router.post("/services", response_model=ServiceResponse)
async def create_service(service_data: ServiceCreate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    new_service = {
        "_id": ObjectId(),
        "name": service_data.name,
        "description": service_data.description,
        "service_type": service_data.service_type.value,
        "base_price": service_data.base_price,
        "created_at": datetime.utcnow()
    }
    await db.services.insert_one(new_service)
    
    return ServiceResponse(
        id=str(new_service["_id"]),
        name=new_service["name"],
        description=new_service.get("description"),
        service_type=new_service["service_type"],
        base_price=new_service["base_price"],
        created_at=new_service["created_at"]
    )

@api_router.get("/services", response_model=List[ServiceResponse])
async def get_services(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    services = await db.services.find().skip(skip).limit(limit).to_list(limit)
    return [
        ServiceResponse(
            id=str(s["_id"]),
            name=s["name"],
            description=s.get("description"),
            service_type=s.get("service_type", "assembly"),
            base_price=s.get("base_price", s.get("price", 0)),
            created_at=s["created_at"]
        ) for s in services
    ]

@api_router.put("/services/{service_id}", response_model=ServiceResponse)
async def update_service(service_id: str, service_data: ServiceUpdate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    update_data = {k: v for k, v in service_data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.services.update_one({"_id": ObjectId(service_id)}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    service = await db.services.find_one({"_id": ObjectId(service_id)})
    return ServiceResponse(
        id=str(service["_id"]),
        name=service["name"],
        description=service.get("description"),
        service_type=service.get("service_type", "assembly"),
        base_price=service.get("base_price", service.get("price", 0)),
        created_at=service["created_at"]
    )

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    result = await db.services.delete_one({"_id": ObjectId(service_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted successfully"}

# Helper to calculate service price based on order
def calculate_service_price(service_type: str, base_price: float, total_items: int, delivery_zone: str = "local", quantity: int = 1) -> float:
    """Calculate service price based on type and order details"""
    if service_type == ServiceType.ASSEMBLY.value:
        # €50 for first 3 items, doubles for each additional 3
        if total_items <= 0:
            return 0
        groups = (total_items - 1) // 3  # How many complete groups of 3
        price = base_price * (2 ** groups)
        return price
    
    elif service_type == ServiceType.DELIVERY.value:
        # Free for local, €50 for medium (80km), €80 for far
        if delivery_zone == "local":
            return 0
        elif delivery_zone == "medium":
            return 50
        else:  # far
            return 80
    
    elif service_type in [ServiceType.TAKEAWAY_MATTRESS_SMALL.value, 
                          ServiceType.TAKEAWAY_MATTRESS_BIG.value,
                          ServiceType.TAKEAWAY_SOFA.value]:
        # Per item pricing
        return base_price * quantity
    
    return base_price

# ================== ORDER ROUTES ==================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order_data: OrderCreate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER, UserRole.SELLER]))):
    # Calculate totals
    subtotal = sum(item.total_price for item in order_data.items)
    total_items = sum(item.quantity for item in order_data.items)
    
    # Process services with calculated prices
    processed_services = []
    services_total = 0
    
    if order_data.services:
        for service in order_data.services:
            # Get service type info
            service_doc = await db.services.find_one({"_id": ObjectId(service.service_id)})
            if service_doc:
                service_type = service_doc.get("service_type", "assembly")
                base_price = service_doc.get("base_price", service.base_price)
                
                # Calculate price based on service type
                if service_type == ServiceType.ASSEMBLY.value:
                    calculated_price = calculate_service_price(service_type, base_price, total_items, quantity=1)
                elif service_type == ServiceType.DELIVERY.value:
                    # Use the delivery zone from service selection
                    calculated_price = base_price  # Already set correctly in frontend
                else:
                    # Takeaway services - price per item
                    calculated_price = base_price * (service.quantity or 1)
                
                processed_services.append({
                    "service_id": service.service_id,
                    "service_name": service.service_name,
                    "service_type": service_type,
                    "base_price": base_price,
                    "calculated_price": calculated_price,
                    "quantity": service.quantity or 1,
                    "delivery_zone": service.delivery_zone
                })
                services_total += calculated_price
    
    subtotal += services_total
    
    discount_amount = subtotal * (order_data.discount_percent / 100)
    total = subtotal - discount_amount
    
    # Check and update stock
    has_stock_issues = False
    for item in order_data.items:
        product = await db.products.find_one({"_id": ObjectId(item.product_id)})
        if product:
            new_quantity = product["stock_quantity"] - item.quantity
            if new_quantity < 0:
                has_stock_issues = True
                new_quantity = 0
                status = ProductStatus.OUT_OF_STOCK.value
            elif new_quantity <= product.get("low_stock_threshold", 5):
                status = ProductStatus.EXPECTED_SOON.value
            else:
                status = product["status"]
            
            await db.products.update_one(
                {"_id": ObjectId(item.product_id)},
                {"$set": {"stock_quantity": new_quantity, "status": status, "updated_at": datetime.utcnow()}}
            )
    
    now = datetime.utcnow()
    order_status = OrderStatus.AWAITING_STOCK.value if has_stock_issues else OrderStatus.NEW.value
    
    new_order = {
        "_id": ObjectId(),
        "order_number": generate_order_number(),
        "customer": order_data.customer.dict(),
        "items": [item.dict() for item in order_data.items],
        "services": processed_services,
        "subtotal": subtotal,
        "discount_percent": order_data.discount_percent,
        "discount_amount": discount_amount,
        "total": total,
        "status": order_status,
        "payment_status": order_data.payment_status.value,
        "amount_paid": order_data.amount_paid or 0,
        "payments": [],
        "seller_id": str(current_user["_id"]),
        "seller_name": current_user["name"],
        "seller_comments": order_data.seller_comments,
        "driver_id": None,
        "driver_name": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.orders.insert_one(new_order)
    
    await log_action(str(current_user["_id"]), current_user["name"], "create_order", "order", str(new_order["_id"]), {"order_number": new_order["order_number"], "total": total})
    
    return OrderResponse(
        id=str(new_order["_id"]),
        order_number=new_order["order_number"],
        customer=CustomerInfo(**new_order["customer"]),
        items=[OrderItem(**item) for item in new_order["items"]],
        services=[OrderServiceItem(**s) for s in new_order["services"]],
        subtotal=new_order["subtotal"],
        discount_percent=new_order["discount_percent"],
        discount_amount=new_order["discount_amount"],
        total=new_order["total"],
        status=new_order["status"],
        payment_status=new_order["payment_status"],
        amount_paid=new_order["amount_paid"],
        payments=[],
        seller_id=new_order["seller_id"],
        seller_name=new_order["seller_name"],
        seller_comments=new_order["seller_comments"],
        driver_id=new_order["driver_id"],
        driver_name=new_order["driver_name"],
        created_at=new_order["created_at"],
        updated_at=new_order["updated_at"]
    )

def normalize_service(s: dict) -> dict:
    """Convert old service format to new format for backward compatibility"""
    if "calculated_price" not in s:
        # Old format - convert to new
        return {
            "service_id": s.get("service_id", ""),
            "service_name": s.get("service_name", ""),
            "service_type": s.get("service_type", "assembly"),
            "base_price": s.get("price", s.get("base_price", 0)),
            "calculated_price": s.get("price", s.get("base_price", 0)),
            "quantity": s.get("quantity", 1),
            "delivery_zone": s.get("delivery_zone")
        }
    return s

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[OrderStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    seller_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Sellers can only see their own orders
    if current_user["role"] == UserRole.SELLER.value:
        query["seller_id"] = str(current_user["_id"])
    elif seller_id:
        query["seller_id"] = seller_id
    
    if status:
        query["status"] = status.value
    if payment_status:
        query["payment_status"] = payment_status.value
    
    orders = await db.orders.find(query).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [
        OrderResponse(
            id=str(o["_id"]),
            order_number=o["order_number"],
            customer=CustomerInfo(**o["customer"]),
            items=[OrderItem(**item) for item in o["items"]],
            services=[OrderServiceItem(**normalize_service(s)) for s in o.get("services", [])],
            subtotal=o["subtotal"],
            discount_percent=o["discount_percent"],
            discount_amount=o["discount_amount"],
            total=o["total"],
            status=o["status"],
            payment_status=o["payment_status"],
            amount_paid=o["amount_paid"],
            payments=[PaymentRecord(**p) for p in o.get("payments", [])],
            seller_id=o["seller_id"],
            seller_name=o["seller_name"],
            seller_comments=o.get("seller_comments"),
            driver_id=o.get("driver_id"),
            driver_name=o.get("driver_name"),
            created_at=o["created_at"],
            updated_at=o["updated_at"]
        ) for o in orders
    ]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Sellers can only see their own orders
    if current_user["role"] == UserRole.SELLER.value and order["seller_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return OrderResponse(
        id=str(order["_id"]),
        order_number=order["order_number"],
        customer=CustomerInfo(**order["customer"]),
        items=[OrderItem(**item) for item in order["items"]],
        services=[OrderServiceItem(**normalize_service(s)) for s in order.get("services", [])],
        subtotal=order["subtotal"],
        discount_percent=order["discount_percent"],
        discount_amount=order["discount_amount"],
        total=order["total"],
        status=order["status"],
        payment_status=order["payment_status"],
        amount_paid=order["amount_paid"],
        payments=[PaymentRecord(**p) for p in order.get("payments", [])],
        seller_id=order["seller_id"],
        seller_name=order["seller_name"],
        seller_comments=order.get("seller_comments"),
        driver_id=order.get("driver_id"),
        driver_name=order.get("driver_name"),
        created_at=order["created_at"],
        updated_at=order["updated_at"]
    )

@api_router.put("/orders/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, order_data: OrderUpdate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER, UserRole.SELLER]))):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Sellers can only update comments on their own orders
    if current_user["role"] == UserRole.SELLER.value:
        if order["seller_id"] != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Access denied")
        allowed_updates = {"seller_comments"}
        update_data = {k: v for k, v in order_data.dict().items() if v is not None and k in allowed_updates}
    else:
        update_data = {k: v for k, v in order_data.dict().items() if v is not None}
        if "status" in update_data:
            update_data["status"] = update_data["status"].value
        if "payment_status" in update_data:
            update_data["payment_status"] = update_data["payment_status"].value
        
        # If assigning driver, get driver name
        if "driver_id" in update_data and update_data["driver_id"]:
            driver = await db.users.find_one({"_id": ObjectId(update_data["driver_id"])})
            if driver:
                update_data["driver_name"] = driver["name"]
                # Create delivery record
                existing_delivery = await db.deliveries.find_one({"order_id": order_id})
                if not existing_delivery:
                    delivery = {
                        "_id": ObjectId(),
                        "order_id": order_id,
                        "order_number": order["order_number"],
                        "driver_id": update_data["driver_id"],
                        "customer_name": order["customer"]["name"],
                        "customer_phone": order["customer"]["phone"],
                        "customer_address": order["customer"]["address"],
                        "status": DeliveryStatus.PENDING.value,
                        "notes": None,
                        "assigned_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow()
                    }
                    await db.deliveries.insert_one(delivery)
    
    update_data["updated_at"] = datetime.utcnow()
    
    await db.orders.update_one({"_id": ObjectId(order_id)}, {"$set": update_data})
    
    await log_action(str(current_user["_id"]), current_user["name"], "update_order", "order", order_id, update_data)
    
    return await get_order(order_id, current_user)

@api_router.delete("/orders/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(require_roles([UserRole.OWNER]))):
    result = await db.orders.delete_one({"_id": ObjectId(order_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Delete associated delivery
    await db.deliveries.delete_one({"order_id": order_id})
    
    await log_action(str(current_user["_id"]), current_user["name"], "delete_order", "order", order_id)
    
    return {"message": "Order deleted successfully"}

# ================== PAYMENT ROUTES ==================

@api_router.post("/orders/{order_id}/payments", response_model=OrderResponse)
async def add_payment(order_id: str, payment_data: PaymentCreate, current_user: dict = Depends(get_current_user)):
    """Add a payment to an order. All roles can add payments but with different options."""
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.get("status") in [OrderStatus.CANCELLED.value, OrderStatus.COMPLETED.value]:
        raise HTTPException(status_code=400, detail="Cannot record payment for cancelled or completed orders")
    
    role = current_user["role"]
    
    # Drivers can only mark as paid (no refunds, limited payment types)
    if role == UserRole.DRIVER.value:
        # Drivers can only update deliveries assigned to them
        if order.get("driver_id") != str(current_user["_id"]):
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Drivers cannot do refunds
        if payment_data.payment_type == PaymentType.REFUND:
            raise HTTPException(status_code=403, detail="Drivers cannot process refunds")
        
        # Drivers can only use: cash, card, contactless
        allowed_driver_types = [PaymentType.CASH, PaymentType.CARD, PaymentType.CONTACTLESS]
        if payment_data.payment_type not in allowed_driver_types:
            raise HTTPException(status_code=403, detail="Invalid payment type for driver")
    
    # Sellers can do everything except refunds (only managers/owners can refund)
    if role == UserRole.SELLER.value:
        if payment_data.payment_type == PaymentType.REFUND:
            raise HTTPException(status_code=403, detail="Only managers or owners can process refunds")
    
    # Create payment record
    payment_record = {
        "id": str(ObjectId()),
        "amount": payment_data.amount,
        "payment_type": payment_data.payment_type.value,
        "notes": payment_data.notes,
        "recorded_by": str(current_user["_id"]),
        "recorded_by_name": current_user["name"],
        "recorded_at": datetime.utcnow()
    }
    
    # Calculate new amount paid
    current_payments = order.get("payments", [])
    current_payments.append(payment_record)
    
    # For refunds, subtract from total paid
    if payment_data.payment_type == PaymentType.REFUND:
        new_amount_paid = order["amount_paid"] - abs(payment_data.amount)
    else:
        new_amount_paid = order["amount_paid"] + payment_data.amount
    
    # Determine payment status
    if new_amount_paid <= 0:
        new_payment_status = PaymentStatus.UNPAID.value
    elif new_amount_paid >= order["total"]:
        new_payment_status = PaymentStatus.PAID.value
    else:
        new_payment_status = PaymentStatus.PARTIALLY_PAID.value
    
    # Update order
    await db.orders.update_one(
        {"_id": ObjectId(order_id)},
        {
            "$set": {
                "payments": current_payments,
                "amount_paid": max(0, new_amount_paid),
                "payment_status": new_payment_status,
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    await log_action(
        str(current_user["_id"]), 
        current_user["name"], 
        "add_payment", 
        "order", 
        order_id, 
        {"amount": payment_data.amount, "type": payment_data.payment_type.value}
    )
    
    # Return updated order
    updated_order = await db.orders.find_one({"_id": ObjectId(order_id)})
    return OrderResponse(
        id=str(updated_order["_id"]),
        order_number=updated_order["order_number"],
        customer=CustomerInfo(**updated_order["customer"]),
        items=[OrderItem(**item) for item in updated_order["items"]],
        services=[OrderServiceItem(**normalize_service(s)) for s in updated_order.get("services", [])],
        subtotal=updated_order["subtotal"],
        discount_percent=updated_order["discount_percent"],
        discount_amount=updated_order["discount_amount"],
        total=updated_order["total"],
        status=updated_order["status"],
        payment_status=updated_order["payment_status"],
        amount_paid=updated_order["amount_paid"],
        payments=[PaymentRecord(**p) for p in updated_order.get("payments", [])],
        seller_id=updated_order["seller_id"],
        seller_name=updated_order["seller_name"],
        seller_comments=updated_order.get("seller_comments"),
        driver_id=updated_order.get("driver_id"),
        driver_name=updated_order.get("driver_name"),
        created_at=updated_order["created_at"],
        updated_at=updated_order["updated_at"]
    )

@api_router.get("/payment-types")
async def get_payment_types(current_user: dict = Depends(get_current_user)):
    """Get available payment types based on user role"""
    role = current_user["role"]
    
    all_types = [
        {"value": "cash", "label": "Cash", "icon": "cash"},
        {"value": "card", "label": "Card (with data)", "icon": "card"},
        {"value": "contactless", "label": "Contactless / Apple Pay / Google Pay", "icon": "phone-portrait"},
        {"value": "phone", "label": "Payment over Phone", "icon": "call"},
        {"value": "humm", "label": "Humm (Buy Now Pay Later)", "icon": "time"},
        {"value": "refund", "label": "Refund", "icon": "arrow-undo"},
    ]
    
    if role == UserRole.DRIVER.value:
        # Drivers can only use: cash, card, contactless
        return [t for t in all_types if t["value"] in ["cash", "card", "contactless"]]
    elif role == UserRole.SELLER.value:
        # Sellers can use all except refund
        return [t for t in all_types if t["value"] != "refund"]
    else:
        # Managers and owners can use all payment types
        return all_types

# ================== DELIVERY ROUTES (Driver) ==================

@api_router.get("/deliveries", response_model=List[DeliveryResponse])
async def get_deliveries(
    skip: int = 0,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    
    # Drivers can only see their own deliveries
    if current_user["role"] == UserRole.DRIVER.value:
        query["driver_id"] = str(current_user["_id"])
    
    deliveries = await db.deliveries.find(query).sort("assigned_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return [
        DeliveryResponse(
            id=str(d["_id"]),
            order_id=d["order_id"],
            order_number=d["order_number"],
            customer_name=d["customer_name"],
            customer_phone=d["customer_phone"],
            customer_address=d["customer_address"],
            status=d["status"],
            notes=d.get("notes"),
            assigned_at=d["assigned_at"],
            updated_at=d["updated_at"]
        ) for d in deliveries
    ]

@api_router.put("/deliveries/{delivery_id}", response_model=DeliveryResponse)
async def update_delivery(delivery_id: str, delivery_data: DeliveryUpdate, current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER, UserRole.DRIVER]))):
    delivery = await db.deliveries.find_one({"_id": ObjectId(delivery_id)})
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    
    # Drivers can only update their own deliveries
    if current_user["role"] == UserRole.DRIVER.value and delivery["driver_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Access denied")
    
    update_data = {
        "status": delivery_data.status.value,
        "updated_at": datetime.utcnow()
    }
    if delivery_data.notes:
        update_data["notes"] = delivery_data.notes
    
    await db.deliveries.update_one({"_id": ObjectId(delivery_id)}, {"$set": update_data})
    
    # Update order status based on delivery status
    order_status_map = {
        DeliveryStatus.IN_DELIVERY.value: OrderStatus.IN_DELIVERY.value,
        DeliveryStatus.DELIVERED.value: OrderStatus.COMPLETED.value,
        DeliveryStatus.FAILED.value: OrderStatus.READY.value
    }
    
    if delivery_data.status.value in order_status_map:
        await db.orders.update_one(
            {"_id": ObjectId(delivery["order_id"])},
            {"$set": {"status": order_status_map[delivery_data.status.value], "updated_at": datetime.utcnow()}}
        )
    
    await log_action(str(current_user["_id"]), current_user["name"], "update_delivery", "delivery", delivery_id, update_data)
    
    updated = await db.deliveries.find_one({"_id": ObjectId(delivery_id)})
    return DeliveryResponse(
        id=str(updated["_id"]),
        order_id=updated["order_id"],
        order_number=updated["order_number"],
        customer_name=updated["customer_name"],
        customer_phone=updated["customer_phone"],
        customer_address=updated["customer_address"],
        status=updated["status"],
        notes=updated.get("notes"),
        assigned_at=updated["assigned_at"],
        updated_at=updated["updated_at"]
    )

# ================== REPORTS & ANALYTICS ==================

@api_router.get("/reports/sales-summary", response_model=SalesSummary)
async def get_sales_summary(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))
):
    query = {}
    if start_date:
        query["created_at"] = {"$gte": start_date}
    if end_date:
        if "created_at" in query:
            query["created_at"]["$lte"] = end_date
        else:
            query["created_at"] = {"$lte": end_date}
    
    orders = await db.orders.find(query).to_list(10000)
    
    total_orders = len(orders)
    total_revenue = sum(o["total"] for o in orders)
    total_items_sold = sum(sum(item["quantity"] for item in o["items"]) for o in orders)
    
    orders_by_status = {}
    payment_summary = {}
    
    for o in orders:
        status = o["status"]
        orders_by_status[status] = orders_by_status.get(status, 0) + 1
        
        payment = o["payment_status"]
        payment_summary[payment] = payment_summary.get(payment, 0) + 1
    
    return SalesSummary(
        total_orders=total_orders,
        total_revenue=total_revenue,
        total_items_sold=total_items_sold,
        orders_by_status=orders_by_status,
        payment_summary=payment_summary
    )

@api_router.get("/reports/low-stock")
async def get_low_stock_products(current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    products = await db.products.find({
        "$expr": {"$lte": ["$stock_quantity", "$low_stock_threshold"]}
    }).to_list(1000)
    
    category_ids = list(set(p["category_id"] for p in products))
    categories = await db.categories.find({"_id": {"$in": [ObjectId(cid) for cid in category_ids]}}).to_list(100)
    category_map = {str(c["_id"]): c["name"] for c in categories}
    
    return [
        ProductResponse(
            id=str(p["_id"]),
            name=p["name"],
            description=p.get("description"),
            category_id=p["category_id"],
            category_name=category_map.get(p["category_id"]),
            price=p["price"],
            cost=p["cost"],
            stock_quantity=p["stock_quantity"],
            status=p["status"],
            expected_restock_date=p.get("expected_restock_date"),
            low_stock_threshold=p.get("low_stock_threshold", 5),
            created_at=p["created_at"],
            updated_at=p["updated_at"]
        ) for p in products
    ]

@api_router.get("/reports/action-logs", response_model=List[ActionLog])
async def get_action_logs(
    limit: int = 100,
    current_user: dict = Depends(require_roles([UserRole.OWNER]))
):
    logs = await db.action_logs.find().sort("timestamp", -1).limit(limit).to_list(limit)
    return [
        ActionLog(
            id=str(l["_id"]),
            user_id=l["user_id"],
            user_name=l["user_name"],
            action=l["action"],
            entity_type=l["entity_type"],
            entity_id=l["entity_id"],
            details=l.get("details"),
            timestamp=l["timestamp"]
        ) for l in logs
    ]

# Receipt generation endpoint
@api_router.get("/orders/{order_id}/receipt")
async def get_order_receipt(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"_id": ObjectId(order_id)})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Generate simple text receipt
    receipt_lines = [
        "=" * 40,
        "         FURNITURE STORE",
        "=" * 40,
        f"Order #: {order['order_number']}",
        f"Date: {order['created_at'].strftime('%Y-%m-%d %H:%M')}",
        f"Seller: {order['seller_name']}",
        "-" * 40,
        "CUSTOMER:",
        f"  {order['customer']['name']}",
        f"  {order['customer']['phone']}",
        f"  {order['customer']['address']}",
        "-" * 40,
        "ITEMS:",
    ]
    
    for item in order["items"]:
        receipt_lines.append(f"  {item['product_name']}")
        receipt_lines.append(f"    {item['quantity']} x €{item['unit_price']:.2f} = €{item['total_price']:.2f}")
    
    if order.get("services"):
        receipt_lines.append("-" * 40)
        receipt_lines.append("SERVICES:")
        for service in order["services"]:
            # Handle both old and new service format
            service_price = service.get('calculated_price', service.get('price', 0))
            qty = service.get('quantity', 1)
            service_name = service.get('service_name', 'Service')
            if qty > 1:
                receipt_lines.append(f"  {service_name} x{qty}: €{service_price:.2f}")
            else:
                receipt_lines.append(f"  {service_name}: €{service_price:.2f}")
    
    receipt_lines.extend([
        "-" * 40,
        f"Subtotal: €{order['subtotal']:.2f}",
    ])
    
    if order["discount_percent"] > 0:
        receipt_lines.append(f"Discount ({order['discount_percent']}%): -€{order['discount_amount']:.2f}")
    
    receipt_lines.extend([
        f"TOTAL: €{order['total']:.2f}",
        "-" * 40,
        f"Payment Status: {order['payment_status'].upper()}",
        f"Amount Paid: €{order['amount_paid']:.2f}",
        f"Balance Due: €{max(0, order['total'] - order['amount_paid']):.2f}",
        "=" * 40,
        "Thank you for your purchase!",
        "=" * 40,
    ])
    
    return {"receipt": "\n".join(receipt_lines)}

# Get drivers list for assignment
@api_router.get("/drivers", response_model=List[UserResponse])
async def get_drivers(current_user: dict = Depends(require_roles([UserRole.OWNER, UserRole.MANAGER]))):
    drivers = await db.users.find({"role": UserRole.DRIVER.value, "is_active": True}).to_list(100)
    return [
        UserResponse(
            id=str(d["_id"]),
            email=d["email"],
            name=d["name"],
            role=d["role"],
            is_active=d["is_active"],
            created_at=d["created_at"]
        ) for d in drivers
    ]

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
