import asyncio
import importlib.util
import os
import sys
from pathlib import Path

import pytest
from fastapi import HTTPException


SERVER_PATH = Path(__file__).resolve().parents[1] / "backend" / "server.py"
BACKEND_DIR = str(SERVER_PATH.parent)


def load_server_module():
    os.environ["MONGODB_URI"] = "mongodb://localhost:27017"
    os.environ["JWT_SECRET"] = "test-secret"

    module_name = "server_for_object_id_tests"
    if module_name in sys.modules:
        del sys.modules[module_name]

    if BACKEND_DIR not in sys.path:
        sys.path.insert(0, BACKEND_DIR)

    spec = importlib.util.spec_from_file_location(module_name, SERVER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("method_name", "arg_name"),
    [
        ("get_user", "user_id"),
        ("delete_category", "category_id"),
        ("get_product", "product_id"),
        ("get_order", "order_id"),
    ],
)
def test_invalid_object_id_returns_400(method_name, arg_name):
    server = load_server_module()
    method = getattr(server, method_name)

    kwargs = {arg_name: "invalid-object-id", "current_user": {"role": "owner"}}

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(method(**kwargs))

    assert exc_info.value.status_code == 400
    assert f"Invalid {arg_name}" in exc_info.value.detail
