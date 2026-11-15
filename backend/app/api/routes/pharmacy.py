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

