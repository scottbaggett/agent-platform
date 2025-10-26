"""
User API routes (Development only).

Endpoints:
- GET /users/me - Get current user info
- POST /users - Create a new user (dev only)
- GET /users - List all users (dev only)
"""

from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from db import get_db, User
from auth import get_current_active_user

router = APIRouter(prefix="/users", tags=["users"])


# --- Request/Response Models ---
class UserCreate(BaseModel):
    """Request model for creating a user."""
    email: str = Field(..., description="User email address")
    username: str = Field(..., min_length=1, max_length=100, description="Username")
    full_name: str = Field(None, max_length=255, description="Full name")


class UserResponse(BaseModel):
    """Response model for a user."""
    id: UUID
    email: str
    username: str
    full_name: str | None
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


# --- Endpoints ---
@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> UserResponse:
    """
    Get current authenticated user information.

    Args:
        current_user: Authenticated user from dependency

    Returns:
        Current user details
    """
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        created_at=current_user.created_at.isoformat()
    )


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user: UserCreate,
    db: AsyncSession = Depends(get_db)
) -> UserResponse:
    """
    Create a new user (Development only - no password).

    Args:
        user: User data
        db: Database session

    Returns:
        Created user

    Raises:
        HTTPException: 400 if email or username already exists
    """
    # Check if email already exists
    email_query = select(User).where(User.email == user.email)
    email_result = await db.execute(email_query)
    if email_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email {user.email} already registered"
        )

    # Check if username already exists
    username_query = select(User).where(User.username == user.username)
    username_result = await db.execute(username_query)
    if username_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username {user.username} already taken"
        )

    # Create user
    new_user = User(
        email=user.email,
        username=user.username,
        full_name=user.full_name,
        is_active=True
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        username=new_user.username,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        created_at=new_user.created_at.isoformat()
    )


@router.get("/", response_model=List[UserResponse])
async def list_users(
    db: AsyncSession = Depends(get_db)
) -> List[UserResponse]:
    """
    List all users (Development only).

    Args:
        db: Database session

    Returns:
        List of all users
    """
    query = select(User).order_by(User.created_at.desc())
    result = await db.execute(query)
    users = result.scalars().all()

    return [
        UserResponse(
            id=u.id,
            email=u.email,
            username=u.username,
            full_name=u.full_name,
            is_active=u.is_active,
            created_at=u.created_at.isoformat()
        )
        for u in users
    ]
