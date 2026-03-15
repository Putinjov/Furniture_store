from bson import ObjectId
from fastapi import HTTPException


def parse_object_id(value: str, field_name: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}: must be a valid ObjectId")
    return ObjectId(value)
