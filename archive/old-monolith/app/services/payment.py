import razorpay
from app.core.config import settings
from app.core.logging import logger
import hmac
import hashlib

class PaymentService:
    def __init__(self):
        self.client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

    def create_verification_order(self, hospital_id: str, amount: int = 100): # amount in paise
        """Creates a Razorpay order for the ₹1 verification fee."""
        try:
            data = {
                "amount": amount,
                "currency": "INR",
                "receipt": f"hosp_verify_{hospital_id}",
                "notes": {
                    "hospital_id": hospital_id,
                    "type": "verification_fee"
                }
            }
            order = self.client.order.create(data=data)
            return order
        except Exception as e:
            logger.error(f"RAZORPAY_ORDER_ERROR: {str(e)}")
            return None

    def verify_payment_signature(self, razorpay_order_id: str, razorpay_payment_id: str, razorpay_signature: str):
        """Verifies the Razorpay signature for security."""
        try:
            params_dict = {
                'razorpay_order_id': razorpay_order_id,
                'razorpay_payment_id': razorpay_payment_id,
                'razorpay_signature': razorpay_signature
            }
            self.client.utility.verify_payment_signature(params_dict)
            return True
        except Exception as e:
            logger.error(f"RAZORPAY_SIGNATURE_ERROR: {str(e)}")
            return False

payment_service = PaymentService()
