from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserRegisterRequest, UserLoginRequest, UserResponse, TokenResponse
from app.services.auth_service import hash_password, verify_password, create_access_token
from app.services.audit_service import log_audit
from app.dependencies.auth import get_current_user

router = APIRouter()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new Investigator"
)
def register_user(
    payload: UserRegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Register a new user in the system.

    - All new registrations automatically receive the INVESTIGATOR role.
    - Passwords are securely hashed with bcrypt prior to storage.
    - Password hashes are never returned in responses.
    """
    client_ip = request.client.host if request.client else None

    # Check if username already exists
    existing_user_by_name = db.query(User).filter(User.username == payload.username).first()
    if existing_user_by_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )

    # Check if email already exists
    existing_user_by_email = db.query(User).filter(User.email == payload.email).first()
    if existing_user_by_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Hash the password
    hashed_password = hash_password(payload.password)

    # Create new user with server-assigned INVESTIGATOR role
    new_user = User(
        username=payload.username,
        email=payload.email,
        password_hash=hashed_password,
        role="INVESTIGATOR",
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Record audit log
    log_audit(
        db=db,
        action="USER_REGISTERED",
        user_id=new_user.id,
        username=new_user.username,
        resource_type="user",
        resource_id=new_user.id,
        detail=f"Investigator account registered with email: {new_user.email}",
        ip_address=client_ip
    )

    return new_user


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive JWT token"
)
def login_user(
    payload: UserLoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Authenticate user credentials and issue an access token.

    Security Rules:
    - Verifies password with constant-time bcrypt verification.
    - Returns generic 401 for invalid credentials without revealing whether username exists.
    - Rejects inactive accounts.
    - Records audit logs for success and failure events.
    """
    client_ip = request.client.host if request.client else None
    identifier = payload.username.strip()

    # Query user by username or email (case-insensitive for email)
    user = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier.lower())
    ).first()

    # Generic invalid credentials handling
    if not user or not verify_password(payload.password, user.password_hash):
        log_audit(
            db=db,
            action="LOGIN_FAILED",
            user_id=user.id if user else None,
            username=identifier,
            resource_type="auth",
            detail="Invalid credentials provided",
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if not user.is_active:
        log_audit(
            db=db,
            action="LOGIN_FAILED",
            user_id=user.id,
            username=user.username,
            resource_type="auth",
            detail="Login attempt on deactivated account",
            ip_address=client_ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is deactivated",
            headers={"WWW-Authenticate": "Bearer"}
        )

    # Generate JWT token with string subject
    token_payload = {
        "sub": str(user.id),
        "username": user.username,
        "role": user.role
    }
    access_token = create_access_token(data=token_payload)

    # Record successful login in audit log
    log_audit(
        db=db,
        action="LOGIN_SUCCESS",
        user_id=user.id,
        username=user.username,
        resource_type="auth",
        detail=f"User authenticated successfully as {user.role}",
        ip_address=client_ip
    )

    return TokenResponse(access_token=access_token, token_type="bearer")


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current authenticated user profile"
)
def get_me(
    current_user: User = Depends(get_current_user)
):
    """Return the profile of the currently authenticated user."""
    return current_user
