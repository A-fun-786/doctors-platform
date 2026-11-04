import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.schemas.pharmacy import (
    MedicineItemCreateRequest,
    MedicineItemUpdateRequest,
    MedicineItemResponse,
    MedicineItemListResponse,
    StockAdjustmentRequest,
    MedicineOrderStatusUpdateRequest,
    MedicineOrderResponse,
    MedicineOrderListResponse,
    PharmacyStatsResponse,
)
from app.services import pharmacy_service

router = APIRouter(prefix="/doctor/pharmacy", tags=["pharmacy"])


@router.get("/stats", response_model=PharmacyStatsResponse, summary="Get Pharmacy & Inventory Statistics")
def get_stats(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> PharmacyStatsResponse:
    """Retrieve aggregate counts for medicines, inventory status, and pending orders."""
    return pharmacy_service.get_pharmacy_stats(doctor_id=current_doctor.id, db=db)


@router.get("/medicines", response_model=MedicineItemListResponse, summary="List Medicines")
def list_medicines(
    search: Optional[str] = Query(None, description="Search by name, generic name, category, or SKU"),
    category: Optional[str] = Query(None, description="Filter by category"),
    status: Optional[str] = Query(None, description="Filter by status (in_stock, low_stock, out_of_stock, expiring_soon, expired)"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemListResponse:
    """List medicines in the doctor's inventory with optional search and filters."""
    return pharmacy_service.list_medicines(
        doctor_id=current_doctor.id,
        search=search,
        category=category,
        status_filter=status,
        db=db,
    )


@router.post(
    "/medicines",
    response_model=MedicineItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add Medicine to Inventory",
)
def create_medicine(
    payload: MedicineItemCreateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemResponse:
    """Add a new medicine to practice inventory."""
    return pharmacy_service.create_medicine(
        doctor_id=current_doctor.id,
        payload=payload,
        db=db,
    )


@router.get(
    "/medicines/{item_id}",
    response_model=MedicineItemResponse,
    summary="Get Medicine Details",
)
def get_medicine(
    item_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemResponse:
    """Get medicine item details by ID."""
    item = pharmacy_service.get_medicine(doctor_id=current_doctor.id, item_id=item_id, db=db)
    return pharmacy_service._enrich_medicine_response(item)


@router.put(
    "/medicines/{item_id}",
    response_model=MedicineItemResponse,
    summary="Update Medicine",
)
def update_medicine(
    item_id: uuid.UUID,
    payload: MedicineItemUpdateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemResponse:
    """Update medicine properties, pricing, or thresholds."""
    return pharmacy_service.update_medicine(
        doctor_id=current_doctor.id,
        item_id=item_id,
        payload=payload,
        db=db,
    )


@router.delete(
    "/medicines/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Medicine",
)
def delete_medicine(
    item_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """Remove a medicine from inventory."""
    pharmacy_service.delete_medicine(
        doctor_id=current_doctor.id,
        item_id=item_id,
        db=db,
    )
    return None


@router.post(
    "/medicines/{item_id}/adjust-stock",
    response_model=MedicineItemResponse,
    summary="Adjust Medicine Stock",
)
def adjust_stock(
    item_id: uuid.UUID,
    payload: StockAdjustmentRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemResponse:
    """Adjust stock quantity (+ addition or - reduction)."""
    return pharmacy_service.adjust_stock(
        doctor_id=current_doctor.id,
        item_id=item_id,
        adjustment=payload.adjustment,
        db=db,
    )


@router.get(
    "/orders",
    response_model=MedicineOrderListResponse,
    summary="List Patient Medicine Orders",
)
def list_orders(
    status: Optional[str] = Query(None, description="Filter by status (received, processing, dispensed, completed, cancelled)"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineOrderListResponse:
    """List medicine and prescription refill orders received from patients."""
    return pharmacy_service.list_orders(
        doctor_id=current_doctor.id,
        status_filter=status,
        db=db,
    )


@router.patch(
    "/orders/{order_id}/status",
    response_model=MedicineOrderResponse,
    summary="Update Medicine Order Status",
)
def update_order_status(
    order_id: uuid.UUID,
    payload: MedicineOrderStatusUpdateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineOrderResponse:
    """Update order status (received, processing, dispensed, completed, cancelled) and fulfillment notes."""
    return pharmacy_service.update_order_status(
        doctor_id=current_doctor.id,
        order_id=order_id,
        payload=payload,
        db=db,
    )


@router.post(
    "/seed-samples",
    response_model=MedicineItemListResponse,
    summary="Seed Sample Medicines",
)
def seed_sample_medicines(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> MedicineItemListResponse:
    """Convenience endpoint to seed typical clinic essential medicines if inventory is empty."""
    existing = pharmacy_service.list_medicines(doctor_id=current_doctor.id, db=db)
    if existing.total > 0:
        return existing

    from datetime import date, timedelta
    today = date.today()

    sample_items = [
        MedicineItemCreateRequest(
            name="Amoxicillin 500mg",
            generic_name="Amoxicillin Trihydrate",
            category="Antibiotics",
            dosage_form="Capsule",
            strength="500 mg",
            sku="AMX-500",
            batch_number="B2026-01",
            stock_quantity=120,
            min_stock_alert=25,
            unit_price=12.50,
            expiry_date=today + timedelta(days=365),
            manufacturer="GlaxoSmithKline",
            description="Broad-spectrum beta-lactam antibiotic for bacterial infections.",
        ),
        MedicineItemCreateRequest(
            name="Paracetamol 650mg (Dolo)",
            generic_name="Acetaminophen",
            category="Analgesics & Pain",
            dosage_form="Tablet",
            strength="650 mg",
            sku="PARA-650",
            batch_number="B2026-08",
            stock_quantity=250,
            min_stock_alert=30,
            unit_price=3.50,
            expiry_date=today + timedelta(days=500),
            manufacturer="Micro Labs",
            description="Antipyretic and analgesic for fever and mild to moderate pain.",
        ),
        MedicineItemCreateRequest(
            name="Azithromycin 500mg",
            generic_name="Azithromycin",
            category="Antibiotics",
            dosage_form="Tablet",
            strength="500 mg",
            sku="AZI-500",
            batch_number="B2026-11",
            stock_quantity=8,  # low stock alert
            min_stock_alert=15,
            unit_price=22.00,
            expiry_date=today + timedelta(days=20),  # expiring soon!
            manufacturer="Pfizer",
            description="Macrolide antibiotic for respiratory and skin infections.",
        ),
        MedicineItemCreateRequest(
            name="Metformin 500mg",
            generic_name="Metformin HCl",
            category="Diabetes & Endocrine",
            dosage_form="Tablet",
            strength="500 mg",
            sku="MET-500",
            batch_number="B2025-99",
            stock_quantity=0,  # out of stock
            min_stock_alert=20,
            unit_price=5.00,
            expiry_date=today + timedelta(days=180),
            manufacturer="Sun Pharma",
            description="First-line medication for type 2 diabetes blood glucose regulation.",
        ),
        MedicineItemCreateRequest(
            name="Cetirizine 10mg",
            generic_name="Cetirizine Dihydrochloride",
            category="Antihistamines & Allergy",
            dosage_form="Tablet",
            strength="10 mg",
            sku="CET-10",
            batch_number="B2026-44",
            stock_quantity=95,
            min_stock_alert=20,
            unit_price=4.00,
            expiry_date=today + timedelta(days=400),
            manufacturer="Cipla",
            description="Second-generation antihistamine for allergic rhinitis and urticaria.",
        ),
        MedicineItemCreateRequest(
            name="Omeprazole 20mg",
            generic_name="Omeprazole",
            category="Gastrointestinal",
            dosage_form="Capsule",
            strength="20 mg",
            sku="OMP-20",
            batch_number="B2026-62",
            stock_quantity=80,
            min_stock_alert=15,
            unit_price=8.20,
            expiry_date=today + timedelta(days=300),
            manufacturer="AstraZeneca",
            description="Proton pump inhibitor (PPI) for gastric acid suppression and GERD.",
        ),
    ]

    for sample in sample_items:
        pharmacy_service.create_medicine(doctor_id=current_doctor.id, payload=sample, db=db)

    return pharmacy_service.list_medicines(doctor_id=current_doctor.id, db=db)

