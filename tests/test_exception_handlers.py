import sys
from pathlib import Path

from fastapi import HTTPException
from fastapi.exceptions import RequestValidationError

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from exception_handlers import http_error_payload, unexpected_error_payload, validation_error_payload


def test_validation_error_response_shape():
    exc = RequestValidationError([
        {"type": "int_parsing", "loc": ("path", "value"), "msg": "Input should be a valid integer", "input": "abc"}
    ])

    payload = validation_error_payload(exc)

    assert payload["error"]["type"] == "validation_error"
    assert payload["error"]["message"] == "Request validation failed"
    assert isinstance(payload["error"]["details"], list)


def test_http_exception_response_shape():
    payload = http_error_payload(HTTPException(status_code=404, detail='Not found'))

    assert payload == {"error": {"type": "http_error", "message": "Not found"}}


def test_unexpected_exception_response_shape():
    assert unexpected_error_payload() == {
        "error": {
            "type": "internal_server_error",
            "message": "An unexpected error occurred",
        }
    }
