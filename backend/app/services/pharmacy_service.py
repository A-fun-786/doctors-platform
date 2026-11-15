import uuid
from datetime import date, datetime, timedelta
from typing import Optional, List
from fastapi import HTTPException, status
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session

from app.models.pharmacy import MedicineItem, MedicineOrder, MedicineWishlistItem
from app.models.tenant import Tenant
from app.schemas.pharmacy import (
    MedicineItemCreateRequest,
    MedicineItemUpdateRequest,
    MedicineItemResponse,
    MedicineItemListResponse,
    MedicineOrderStatusUpdateRequest,
    MedicineOrderResponse,
    MedicineOrderListResponse,
    PharmacyStatsResponse,
    MedicineWishlistItemCreateRequest,
    MedicineWishlistItemUpdateRequest,
    MedicineWishlistItemResponse,
    MedicineWishlistListResponse,
)


def _enrich_medicine_response(item: MedicineItem) -> MedicineItemResponse:
    today = date.today()
    is_expiring_soon = False
    is_expired = False
    if item.expiry_date:
        if item.expiry_date < today:
            is_expired = True
        elif item.expiry_date <= today + timedelta(days=30):
            is_expiring_soon = True

    calculated_status = item.calculate_status()
    if item.status != calculated_status:
        item.status = calculated_status

    return MedicineItemResponse(
        id=item.id,
        doctor_id=item.doctor_id,
        tenant_id=item.tenant_id,
        name=item.name,
        generic_name=item.generic_name,
        category=item.category,
        dosage_form=item.dosage_form,
        strength=item.strength,
        sku=item.sku,
        batch_number=item.batch_number,
        stock_quantity=item.stock_quantity,
        min_stock_alert=item.min_stock_alert,
        purchase_price=getattr(item, "purchase_price", 0.0) or 0.0,
        unit_price=item.unit_price,
        expiry_date=item.expiry_date,
        manufacturer=item.manufacturer,
        description=item.description,
        status=item.status,
        is_expiring_soon=is_expiring_soon,
        is_expired=is_expired,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def list_medicines(
    doctor_id: uuid.UUID,
    search: Optional[str] = None,
    category: Optional[str] = None,
    status_filter: Optional[str] = None,
    db: Session = None,
) -> MedicineItemListResponse:
    query = select(MedicineItem).where(MedicineItem.doctor_id == doctor_id)

    if category and category.lower() != "all":
        query = query.where(MedicineItem.category == category)

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                MedicineItem.name.ilike(search_pattern),
                MedicineItem.generic_name.ilike(search_pattern),
                MedicineItem.sku.ilike(search_pattern),
                MedicineItem.category.ilike(search_pattern),
            )
        )

    items = db.scalars(query.order_by(MedicineItem.name.asc())).all()
    today = date.today()

    enriched_items: List[MedicineItemResponse] = []
    for item in items:
        resp = _enrich_medicine_response(item)

        if status_filter and status_filter.lower() != "all":
            if status_filter == "expiring_soon" and not resp.is_expiring_soon:
                continue
            elif status_filter == "expired" and not resp.is_expired:
                continue
            elif status_filter in ("in_stock", "low_stock", "out_of_stock") and resp.status != status_filter:
                continue

        enriched_items.append(resp)

    return MedicineItemListResponse(items=enriched_items, total=len(enriched_items))


def create_medicine(
    doctor_id: uuid.UUID,
    payload: MedicineItemCreateRequest,
    db: Session,
) -> MedicineItemResponse:
    # Find associated tenant
    tenant = db.scalar(select(Tenant).where(Tenant.doctor_id == doctor_id))
    tenant_id = tenant.id if tenant else None

    item = MedicineItem(
        doctor_id=doctor_id,
        tenant_id=tenant_id,
        name=payload.name.strip(),
        generic_name=payload.generic_name.strip() if payload.generic_name else None,
        category=payload.category.strip() if payload.category else "General",
        dosage_form=payload.dosage_form.strip() if payload.dosage_form else "Tablet",
        strength=payload.strength.strip() if payload.strength else None,
        sku=payload.sku.strip() if payload.sku else None,
        batch_number=payload.batch_number.strip() if payload.batch_number else None,
        stock_quantity=payload.stock_quantity,
        min_stock_alert=payload.min_stock_alert,
        purchase_price=payload.purchase_price if payload.purchase_price is not None else 0.0,
        unit_price=payload.unit_price,
        expiry_date=payload.expiry_date,
        manufacturer=payload.manufacturer.strip() if payload.manufacturer else None,
        description=payload.description.strip() if payload.description else None,
    )
    item.status = item.calculate_status()

    db.add(item)
    db.commit()
    db.refresh(item)
    return _enrich_medicine_response(item)


def get_medicine(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session,
) -> MedicineItem:
    item = db.scalar(
        select(MedicineItem).where(
            MedicineItem.id == item_id,
            MedicineItem.doctor_id == doctor_id,
        )
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine inventory item not found.",
        )
    return item


def update_medicine(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: MedicineItemUpdateRequest,
    db: Session,
) -> MedicineItemResponse:
    item = get_medicine(doctor_id, item_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if isinstance(val, str):
            setattr(item, field, val.strip())
        else:
            setattr(item, field, val)

    item.status = item.calculate_status()

    db.commit()
    db.refresh(item)
    return _enrich_medicine_response(item)


def delete_medicine(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session,
) -> None:
    item = get_medicine(doctor_id, item_id, db)
    db.delete(item)
    db.commit()


def adjust_stock(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    adjustment: int,
    db: Session,
) -> MedicineItemResponse:
    item = get_medicine(doctor_id, item_id, db)
    new_qty = item.stock_quantity + adjustment
    if new_qty < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reduce stock by {abs(adjustment)}. Current stock is only {item.stock_quantity}.",
        )
    item.stock_quantity = new_qty
    item.status = item.calculate_status()

    db.commit()
    db.refresh(item)
    return _enrich_medicine_response(item)


def list_orders(
    doctor_id: uuid.UUID,
    status_filter: Optional[str] = None,
    db: Session = None,
) -> MedicineOrderListResponse:
    query = select(MedicineOrder).where(MedicineOrder.doctor_id == doctor_id)

    if status_filter and status_filter.lower() != "all":
        query = query.where(MedicineOrder.status == status_filter.lower())

    orders = db.scalars(query.order_by(MedicineOrder.created_at.desc())).all()
    resp_orders = [MedicineOrderResponse.model_validate(o) for o in orders]
    return MedicineOrderListResponse(orders=resp_orders, total=len(resp_orders))


def update_order_status(
    doctor_id: uuid.UUID,
    order_id: uuid.UUID,
    payload: MedicineOrderStatusUpdateRequest,
    db: Session,
) -> MedicineOrderResponse:
    order = db.scalar(
        select(MedicineOrder).where(
            MedicineOrder.id == order_id,
            MedicineOrder.doctor_id == doctor_id,
        )
    )
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Medicine order not found.",
        )

    order.status = payload.status
    if payload.doctor_notes is not None:
        order.doctor_notes = payload.doctor_notes
    if payload.total_price is not None:
        order.total_price = payload.total_price

    db.commit()
    db.refresh(order)
    return MedicineOrderResponse.model_validate(order)


def create_public_order(
    tenant: Tenant,
    patient_name: str,
    patient_phone: str,
    delivery_address: str,
    medicines_text: str,
    db: Session,
) -> MedicineOrder:
    order_number = f"MED-{uuid.uuid4().hex[:8].upper()}"
    order = MedicineOrder(
        doctor_id=tenant.doctor_id,
        tenant_id=tenant.id,
        order_number=order_number,
        patient_name=patient_name.strip(),
        patient_phone=patient_phone.strip(),
        delivery_address=delivery_address.strip(),
        medicines_text=medicines_text.strip(),
        status="received",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def get_pharmacy_stats(doctor_id: uuid.UUID, db: Session) -> PharmacyStatsResponse:
    items = db.scalars(select(MedicineItem).where(MedicineItem.doctor_id == doctor_id)).all()
    today = date.today()

    total_medicines = len(items)
    total_units_in_stock = sum(max(0, item.stock_quantity) for item in items)
    in_stock_count = sum(1 for item in items if item.stock_quantity > item.min_stock_alert)
    low_stock_count = sum(1 for item in items if 0 < item.stock_quantity <= item.min_stock_alert)
    out_of_stock_count = sum(1 for item in items if item.stock_quantity <= 0)
    expiring_soon_count = sum(
        1 for item in items
        if item.expiry_date and today <= item.expiry_date <= today + timedelta(days=30)
    )

    pending_orders_count = db.scalar(
        select(func.count(MedicineOrder.id)).where(
            MedicineOrder.doctor_id == doctor_id,
            MedicineOrder.status.in_(["received", "processing"]),
        )
    ) or 0

    total_orders_count = db.scalar(
        select(func.count(MedicineOrder.id)).where(
            MedicineOrder.doctor_id == doctor_id,
        )
    ) or 0

    wishlist_count = db.scalar(
        select(func.count(MedicineWishlistItem.id)).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            MedicineWishlistItem.status == "requested",
        )
    ) or 0

    return PharmacyStatsResponse(
        total_medicines=total_medicines,
        total_units_in_stock=total_units_in_stock,
        in_stock_count=in_stock_count,
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count,
        expiring_soon_count=expiring_soon_count,
        pending_orders_count=pending_orders_count,
        total_orders_count=total_orders_count,
        wishlist_count=wishlist_count,
    )


def list_wishlist_items(
    doctor_id: uuid.UUID,
    db: Session,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
) -> MedicineWishlistListResponse:
    """Lists unlisted medicines requested by patients, ordered by highest patient demand."""
    query = select(MedicineWishlistItem).where(MedicineWishlistItem.doctor_id == doctor_id)

    if status_filter and status_filter != "all":
        query = query.where(MedicineWishlistItem.status == status_filter)

    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            or_(
                MedicineWishlistItem.name.ilike(s),
                MedicineWishlistItem.generic_name.ilike(s),
                MedicineWishlistItem.notes.ilike(s),
            )
        )

    query = query.order_by(
        MedicineWishlistItem.request_count.desc(),
        MedicineWishlistItem.last_requested_at.desc(),
    )
    items = db.scalars(query).all()
    return MedicineWishlistListResponse(
        items=[MedicineWishlistItemResponse.model_validate(item) for item in items],
        total=len(items),
    )


def create_or_increment_wishlist_item(
    doctor_id: uuid.UUID,
    payload: MedicineWishlistItemCreateRequest,
    db: Session,
) -> MedicineWishlistItemResponse:
    """Creates a new wishlist item, or auto-increments request count if already tracked for this clinic."""
    cleaned_name = payload.name.strip()

    # Check if this medicine has already been requested (case-insensitive) and not yet converted
    existing = db.scalar(
        select(MedicineWishlistItem).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            func.lower(MedicineWishlistItem.name) == cleaned_name.lower(),
            MedicineWishlistItem.status != "converted",
        )
    )

    if existing:
        existing.request_count += 1
        existing.last_requested_at = datetime.utcnow()
        if payload.notes and payload.notes.strip():
            note_line = payload.notes.strip()
            if existing.notes:
                existing.notes = f"{existing.notes}\n• {note_line}"
            else:
                existing.notes = note_line
        db.commit()
        db.refresh(existing)
        return MedicineWishlistItemResponse.model_validate(existing)

    tenant_id = db.scalar(select(Tenant.id).where(Tenant.doctor_id == doctor_id))
    new_item = MedicineWishlistItem(
        doctor_id=doctor_id,
        tenant_id=tenant_id,
        name=cleaned_name,
        generic_name=payload.generic_name.strip() if payload.generic_name else None,
        category=payload.category,
        dosage_form=payload.dosage_form,
        strength=payload.strength.strip() if payload.strength else None,
        notes=payload.notes.strip() if payload.notes else None,
        request_count=1,
        status="requested",
        last_requested_at=datetime.utcnow(),
    )
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return MedicineWishlistItemResponse.model_validate(new_item)


def increment_wishlist_item(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session,
) -> MedicineWishlistItemResponse:
    """Increments the patient demand counter by 1."""
    item = db.scalar(
        select(MedicineWishlistItem).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            MedicineWishlistItem.id == item_id,
        )
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist medicine item not found.",
        )

    item.request_count += 1
    item.last_requested_at = datetime.utcnow()
    db.commit()
    db.refresh(item)
    return MedicineWishlistItemResponse.model_validate(item)


def update_wishlist_item(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    payload: MedicineWishlistItemUpdateRequest,
    db: Session,
) -> MedicineWishlistItemResponse:
    """Updates notes, status, or details of a wishlist item."""
    item = db.scalar(
        select(MedicineWishlistItem).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            MedicineWishlistItem.id == item_id,
        )
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist medicine item not found.",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        if isinstance(val, str):
            setattr(item, field, val.strip())
        else:
            setattr(item, field, val)

    db.commit()
    db.refresh(item)
    return MedicineWishlistItemResponse.model_validate(item)


def delete_wishlist_item(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    db: Session,
) -> None:
    """Deletes a wishlist item."""
    item = db.scalar(
        select(MedicineWishlistItem).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            MedicineWishlistItem.id == item_id,
        )
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist medicine item not found.",
        )

    db.delete(item)
    db.commit()


def convert_wishlist_item(
    doctor_id: uuid.UUID,
    item_id: uuid.UUID,
    medicine_id: uuid.UUID,
    db: Session,
) -> MedicineWishlistItemResponse:
    """Marks a wishlist item as graduated/converted into live inventory."""
    item = db.scalar(
        select(MedicineWishlistItem).where(
            MedicineWishlistItem.doctor_id == doctor_id,
            MedicineWishlistItem.id == item_id,
        )
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Wishlist medicine item not found.",
        )

    item.status = "converted"
    item.converted_medicine_id = medicine_id
    db.commit()
    db.refresh(item)
    return MedicineWishlistItemResponse.model_validate(item)


