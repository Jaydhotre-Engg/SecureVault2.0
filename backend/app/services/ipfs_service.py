import os
import requests
from dotenv import load_dotenv

load_dotenv()

def upload_to_pinata(file_data: bytes, filename: str) -> str:
    """
    Upload an already encrypted artifact to Pinata IPFS.
    Return the IPFS CID.
    """
    pinata_jwt = os.getenv("PINATA_JWT")
    if not pinata_jwt:
        raise ValueError("Pinata API configuration error. PINATA_JWT is not set in .env")

    headers = {
        "Authorization": f"Bearer {pinata_jwt}"
    }

    files = {
        "file": (filename, file_data)
    }

    # PinFileToIPFS endpoint
    url = "https://api.pinata.cloud/pinning/pinFileToIPFS"

    try:
        response = requests.post(url, headers=headers, files=files)
    except requests.exceptions.RequestException as e:
        raise RuntimeError(f"Failed to connect to Pinata API: {str(e)}")

    if response.status_code == 200:
        return response.json().get("IpfsHash")
    else:
        raise RuntimeError(f"Pinata IPFS upload failed: {response.text}")

def download_from_ipfs(cid: str) -> bytes:
    """
    Retrieve an artifact from IPFS via a public gateway using its CID.
    """
    gateways = [
        f"https://gateway.pinata.cloud/ipfs/{cid}",
        f"https://dweb.link/ipfs/{cid}",
        f"https://ipfs.io/ipfs/{cid}"
    ]

    errors = []
    for url in gateways:
        try:
            response = requests.get(url, timeout=30)
            if response.status_code == 200:
                return response.content
            else:
                err_msg = f"{url} returned HTTP {response.status_code}"
                # optionally trim response.text to prevent huge error strings
                errors.append(err_msg + f": {response.text[:100]}")
        except requests.exceptions.RequestException as e:
            errors.append(f"{url} raised {type(e).__name__}")

    error_summary = " | ".join(errors)
    raise RuntimeError(f"Failed to retrieve CID {cid} from all gateways. Errors: {error_summary}")
