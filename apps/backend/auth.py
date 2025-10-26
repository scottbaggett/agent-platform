"""
Authentication utilities for Agent Platform.

Development Mode:
- Uses X-User-ID header to identify users
- No password validation (for local dev only)
- Falls back to default dev user if header missing

Production Mode (TODO):
- JWT token validation
- OAuth integration
- Proper password hashing
"""

import os
from typing import Optional
from uuid import UUID
from fastapi import Header, HTTPException, status, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db import get_db, User

# Development user ID (matches migration)
DEV_USER_ID = UUID("00000000-0000-0000-0000-000000000001")

# Check if we're in development mode
IS_DEV_MODE = os.getenv("ENV", "development") == "development"


async def get_current_user(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current authenticated user.

    Development Mode:
    - Checks X-User-ID header
    - Falls back to dev user if header missing
    - Creates user if ID provided but doesn't exist

    Production Mode (TODO):
    - Validate JWT token
    - Extract user ID from token
    - Raise 401 if invalid

    Args:
        x_user_id: User ID from X-User-ID header (dev mode)
        db: Database session

    Returns:
        Authenticated User object

    Raises:
        HTTPException: 401 if user not found (production mode)
    """
    # Development mode: Use header or default dev user
    if IS_DEV_MODE:
        user_id = DEV_USER_ID

        # If X-User-ID header provided, try to use it
        if x_user_id:
            try:
                user_id = UUID(x_user_id)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid X-User-ID header: must be a valid UUID"
                )

        # Fetch user from database
        query = select(User).where(User.id == user_id)
        result = await db.execute(query)
        user = result.scalar_one_or_none()

        if not user:
            # In dev mode, auto-create user if doesn't exist
            if x_user_id:
                user = User(
                    id=user_id,
                    email=f"user-{user_id}@localhost",
                    username=f"user-{str(user_id)[:8]}",
                    full_name="Auto-created Dev User"
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Default dev user not found. Run migrations."
                )

        return user

    # Production mode: TODO - Validate JWT token
    else:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Production authentication not yet implemented. Set ENV=development for dev mode."
        )


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get current user and verify they are active.

    Args:
        current_user: User from get_current_user dependency

    Returns:
        Active User object

    Raises:
        HTTPException: 403 if user is inactive
    """
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return current_user
