import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def validation_error_payload(exc: RequestValidationError) -> dict:
    return {
        "error": {
            "type": "validation_error",
            "message": "Request validation failed",
            "details": exc.errors(),
        }
    }


def http_error_payload(exc: HTTPException) -> dict:
    return {
        "error": {
            "type": "http_error",
            "message": exc.detail,
        }
    }


def unexpected_error_payload() -> dict:
    return {
        "error": {
            "type": "internal_server_error",
            "message": "An unexpected error occurred",
        }
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content=validation_error_payload(exc))

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(status_code=exc.status_code, content=http_error_payload(exc))

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(status_code=500, content=unexpected_error_payload())
