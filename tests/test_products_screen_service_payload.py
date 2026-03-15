from pathlib import Path


PRODUCTS_SCREEN = Path('frontend/app/(tabs)/products.tsx').read_text()


def test_service_payload_uses_backend_schema_fields():
    assert 'service_type: formServiceType' in PRODUCTS_SCREEN
    assert 'base_price: parseFloat(formPrice) || 0' in PRODUCTS_SCREEN
    service_payload_start = PRODUCTS_SCREEN.index("} else if (modalType === 'service') {")
    service_payload_end = PRODUCTS_SCREEN.index("      } else {", service_payload_start)
    service_payload_block = PRODUCTS_SCREEN[service_payload_start:service_payload_end]
    assert "\n          price: parseFloat(formPrice) || 0,\n" not in service_payload_block


def test_service_edit_modal_reads_base_price():
    assert 'setFormPrice(item.base_price.toString())' in PRODUCTS_SCREEN


def test_category_delete_uses_categories_endpoint():
    assert "category: 'categories'" in PRODUCTS_SCREEN
    assert 'api.delete(`/${endpoint}/${id}`)' in PRODUCTS_SCREEN
