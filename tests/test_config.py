import importlib.util
import os
import sys
from pathlib import Path

import pytest


CONFIG_PATH = Path(__file__).resolve().parents[1] / "backend" / "config.py"


def load_config_module():
    module_name = "backend_config_under_test"
    if module_name in sys.modules:
        del sys.modules[module_name]

    spec = importlib.util.spec_from_file_location(module_name, CONFIG_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def test_settings_raises_when_jwt_secret_missing(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.delenv("JWT_SECRET", raising=False)

    with pytest.raises(RuntimeError, match="JWT_SECRET is not set"):
        load_config_module()


def test_settings_loads_explicit_jwt_secret(monkeypatch):
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.setenv("JWT_SECRET", "super-secret-value")

    module = load_config_module()

    assert module.settings.jwt_secret == "super-secret-value"
