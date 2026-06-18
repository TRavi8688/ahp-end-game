# backend/shared/upi.py
# Generates UPI intent deep links. No money handled by Hospyn.
# Format follows NPCI UPI deep link spec.

from urllib.parse import urlencode, quote


def generate_upi_link(
    vpa:        str,
    payee_name: str,
    amount:     float,
    note:       str,
    txn_ref:    str,
    currency:   str = "INR",
) -> str:
    """
    Returns a upi://pay deep link that opens GPay / PhonePe / Paytm on mobile.
    On desktop the frontend should render this as a QR code for the patient to scan.

    Parameters:
        vpa:        UPI Virtual Payment Address of the pharmacy/lab partner
        payee_name: Display name shown in UPI app
        amount:     Rupee amount (will be formatted to 2 decimal places)
        note:       Transaction note shown in UPI app
        txn_ref:    Unique reference — used for webhook matching
        currency:   Always INR for India
    """
    if not vpa or "@" not in vpa:
        raise ValueError(f"Invalid UPI VPA: {vpa!r}")
    if amount <= 0:
        raise ValueError(f"Amount must be positive: {amount}")

    params = {
        "pa": vpa,
        "pn": payee_name,
        "am": f"{amount:.2f}",
        "cu": currency,
        "tn": note[:50],   # UPI note max 50 chars
        "tr": txn_ref,
    }
    return "upi://pay?" + urlencode(params, quote_via=quote)


def generate_upi_qr_payload(vpa: str, payee_name: str, amount: float, txn_ref: str) -> str:
    """
    Returns the string to encode into a QR code for desktop display.
    Same as UPI deep link but used as QR content.
    """
    return generate_upi_link(
        vpa=vpa,
        payee_name=payee_name,
        amount=amount,
        note=f"Hospyn payment {txn_ref}",
        txn_ref=txn_ref,
    )
