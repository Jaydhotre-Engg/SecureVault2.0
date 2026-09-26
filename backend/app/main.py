from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.models import evidence, user, audit_log, case, custody_event
from app.utils.migrations import run_migrations
from app.routers import evidence as evidence_router
from app.routers import auth as auth_router
from app.routers import users as users_router
from app.routers import case as cases_router
from app.routers import custody as custody_router


# Create initial tables and run idempotent migrations
Base.metadata.create_all(bind=engine)
run_migrations(engine)


app = FastAPI(
    title="SecureVault",
    description="Secure Evidence Management System",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(
    auth_router.router,
    prefix="/api/auth",
    tags=["Authentication"]
)

app.include_router(
    users_router.router,
    prefix="/api/users",
    tags=["Users"]
)

app.include_router(
    evidence_router.router,
    prefix="/api/evidence",
    tags=["Evidence"]
)

app.include_router(
    cases_router.router,
    prefix="/api/cases",
    tags=["Cases"]
)

app.include_router(
    custody_router.router,
    prefix="/api",
    tags=["Custody"]
)

@app.get("/")
def root():
    return {
        "application": "SecureVault",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {
        "status": "healthy"
    }
