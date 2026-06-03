"""
Generate Self-Signed TLS Certificates for Development.

Uses python 'cryptography' library to generate self-signed SSL certificate
and private key, saving them to './nginx/certs/selfsigned.crt' and 'selfsigned.key'.
This script is cross-platform and has no external dependencies beyond 'cryptography'.
"""
import datetime
import os
import sys

try:
    from cryptography import x509
    from cryptography.x509.oid import NameOID
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives import serialization
except ImportError:
    print("Error: 'cryptography' package is required to run this script.")
    print("Install it with: pip install cryptography")
    sys.exit(1)


def generate_dev_certs(output_dir: str = "nginx/certs") -> None:
    os.makedirs(output_dir, exist_ok=True)
    cert_path = os.path.join(output_dir, "selfsigned.crt")
    key_path = os.path.join(output_dir, "selfsigned.key")

    print(f"Generating self-signed certificate in: {output_dir}...")

    # Generate private key
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    # Generate self-signed certificate
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, "US"),
        x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, "California"),
        x509.NameAttribute(NameOID.LOCALITY_NAME, "San Francisco"),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Hospyn Dev"),
        x509.NameAttribute(NameOID.COMMON_NAME, "localhost"),
    ])

    utc_now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(utc_now - datetime.timedelta(days=1))
        .not_valid_after(utc_now + datetime.timedelta(days=365))
        .add_extension(
            x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.DNSName("127.0.0.1")]),
            critical=False,
        )
        .sign(private_key, hashes.SHA256())
    )

    # Save private key
    with open(key_path, "wb") as f:
        f.write(
            private_key.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.TraditionalOpenSSL,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )

    # Save certificate
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.PEM))

    print("SUCCESS: Self-signed certificates successfully generated:")
    print(f"  - Private Key: {key_path}")
    print(f"  - Certificate: {cert_path}")


if __name__ == "__main__":
    generate_dev_certs()
