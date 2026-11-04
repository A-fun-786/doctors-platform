from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from pydantic import BaseModel


class PaymentInitiateResult(BaseModel):
    success: bool
    gateway: str
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    status: str = "success"
    message: Optional[str] = None


class PaymentProvider(ABC):
    """Abstract payment gateway provider interface."""

    @abstractmethod
    def initiate_payment(
        self,
        amount_paise: int,
        invoice_number: str,
        customer_info: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> PaymentInitiateResult:
        """Create or process a payment transaction."""
        pass


class ManualPaymentProvider(PaymentProvider):
    """Handles on-premise manual payments: Cash, direct UPI scan, clinic card terminal POS, cheque."""

    def initiate_payment(
        self,
        amount_paise: int,
        invoice_number: str,
        customer_info: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> PaymentInitiateResult:
        return PaymentInitiateResult(
            success=True,
            gateway="manual",
            status="success",
            message=f"Manual payment of {amount_paise} paise recorded for {invoice_number}",
        )


class RazorpayPaymentProvider(PaymentProvider):
    """Pluggable Razorpay Online Gateway adapter (ready for webhook & order creation)."""

    def __init__(self, key_id: Optional[str] = None, key_secret: Optional[str] = None):
        self.key_id = key_id
        self.key_secret = key_secret

    def initiate_payment(
        self,
        amount_paise: int,
        invoice_number: str,
        customer_info: Dict[str, Any],
        idempotency_key: Optional[str] = None,
    ) -> PaymentInitiateResult:
        # Gateway order creation stub for Razorpay API
        return PaymentInitiateResult(
            success=True,
            gateway="razorpay",
            gateway_order_id=f"order_{invoice_number}",
            status="pending",
            message="Razorpay order initiated. Awaiting webhook/client signature callback.",
        )


def get_payment_provider(gateway_name: Optional[str] = "manual") -> PaymentProvider:
    """Factory to retrieve payment provider instance."""
    if gateway_name and gateway_name.lower() == "razorpay":
        return RazorpayPaymentProvider()
    return ManualPaymentProvider()

