import asyncio
import importlib.util
import os
import sys
from pathlib import Path


SERVER_PATH = Path(__file__).resolve().parents[1] / "backend" / "server.py"
BACKEND_DIR = str(SERVER_PATH.parent)


class FakeCollection:
    def __init__(self):
        self.create_index_calls = []
        self.find_one_calls = []
        self.insert_one_calls = []
        self.insert_many_calls = []
        self.delete_many_calls = []
        self.count_documents_result = 1

    async def create_index(self, field, unique=False):
        self.create_index_calls.append((field, unique))

    async def find_one(self, query):
        self.find_one_calls.append(query)
        return None

    async def insert_one(self, payload):
        self.insert_one_calls.append(payload)

    async def insert_many(self, payload):
        self.insert_many_calls.append(payload)

    async def count_documents(self, query):
        return self.count_documents_result

    async def delete_many(self, query):
        self.delete_many_calls.append(query)


class FakeDb:
    def __init__(self):
        self.users = FakeCollection()
        self.products = FakeCollection()
        self.orders = FakeCollection()
        self.deliveries = FakeCollection()
        self.action_logs = FakeCollection()
        self.services = FakeCollection()


def load_server_module():
    os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
    os.environ["JWT_SECRET"] = "test-secret"

    module_name = "server_under_test"
    if module_name in sys.modules:
        del sys.modules[module_name]

    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)

    spec = importlib.util.spec_from_file_location(module_name, SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_startup_does_not_auto_create_default_admin():
    server = load_server_module()
    fake_db = FakeDb()
    server.db = fake_db

    asyncio.run(server.startup_event())

    assert fake_db.users.find_one_calls == []
    assert fake_db.users.insert_one_calls == []
