"""
In-memory caching layer for public slot queries and request idempotency.
Uses TTLCache with configurable sizes and expiration.
"""
import uuid
from datetime import date
from typing import Any, Dict, List, Optional
from cachetools import TTLCache

# Cache for public slot availability: 60 seconds TTL, up to 2048 doctor-date combinations
_slot_cache: TTLCache = TTLCache(maxsize=2048, ttl=60)

# Cache for appointment idempotency keys: 300 seconds (5 mins) TTL, up to 2048 requests
_idempotency_cache: TTLCache = TTLCache(maxsize=2048, ttl=300)


def get_cached_slots(doctor_id: uuid.UUID, query_date: date) -> Optional[List[Dict[str, str]]]:
    """Retrieve cached public slots if present."""
    key = f"{doctor_id}:{query_date.isoformat()}"
    return _slot_cache.get(key)


def set_cached_slots(doctor_id: uuid.UUID, query_date: date, slots: List[Dict[str, str]]) -> None:
    """Store generated slots in the cache."""
    key = f"{doctor_id}:{query_date.isoformat()}"
    _slot_cache[key] = slots


def invalidate_slot_cache(doctor_id: Optional[uuid.UUID] = None) -> None:
    """
    Invalidate slot cache.
    If doctor_id is specified, removes all keys matching that doctor_id.
    Otherwise clears the entire slot cache.
    """
    if doctor_id is None:
        _slot_cache.clear()
        return

    prefix = f"{doctor_id}:"
    keys_to_delete = [k for k in _slot_cache.keys() if k.startswith(prefix)]
    for k in keys_to_delete:
        _slot_cache.pop(k, None)


def get_idempotency_result(cache_key: str) -> Optional[Any]:
    """Retrieve cached response for an idempotency key."""
    return _idempotency_cache.get(cache_key)


def set_idempotency_result(cache_key: str, result: Any) -> None:
    """Store response for an idempotency key."""
    _idempotency_cache[cache_key] = result


def clear_all_caches() -> None:
    """Clear all in-memory caches (useful for test resets)."""
    _slot_cache.clear()
    _idempotency_cache.clear()
