import os
import uuid
import warnings

STORAGE_DIR = "storage"
os.makedirs(STORAGE_DIR, exist_ok=True)


def save_encrypted_file(
    encrypted_data: bytes,
    original_filename: str
):
    """
    [DEPRECATED - Phase 2D]
    Save encrypted evidence to secure storage.
    This module is retained for backward compatibility or rollout safety,
    but should no longer be used as IPFS is the primary storage backend.
    """
    warnings.warn(
        "save_encrypted_file is deprecated in Phase 2D. "
        "Use IPFS storage mechanisms instead.",
        DeprecationWarning,
        stacklevel=2,
    )

    file_id = str(uuid.uuid4())

    encrypted_filename = f"{file_id}_{original_filename}.enc"

    file_path = os.path.join(
        STORAGE_DIR,
        encrypted_filename
    )

    with open(file_path, "wb") as file:
        file.write(encrypted_data)

    return file_path