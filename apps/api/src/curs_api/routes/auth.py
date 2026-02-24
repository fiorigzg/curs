from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from curs_api.auth.jwt_tokens import TokenError, decode, make_access, make_refresh
from curs_api.auth.password import hash_password, verify_password
from curs_api.deps import get_current_user
from curs_api.models import User
from curs_api.schemas.auth import (
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    RefreshRequest,
    TokenPair,
    UserOut,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest) -> LoginResponse:
    user = await User.get_or_none(email=body.email.lower())
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_credentials")
    return LoginResponse(
        user=UserOut.model_validate(user),
        access_token=make_access(user.id),
        refresh_token=make_refresh(user.id),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest) -> TokenPair:
    try:
        sub = decode(body.refresh_token, expect_kind="refresh")
        user_id = UUID(sub)
    except (TokenError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc) or "invalid_refresh"
        ) from exc
    user = await User.get_or_none(id=user_id, is_active=True)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="user_not_found")
    return TokenPair(access_token=make_access(user.id), refresh_token=make_refresh(user.id))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(_: User = Depends(get_current_user)) -> None:
    # Stateless JWT — клиент просто выбрасывает токены. Опционально:
    # отзыв через Redis blocklist по jti — добавим, если станет нужно.
    return None


@router.post("/password", status_code=status.HTTP_200_OK)
async def change_password(
    body: PasswordChangeRequest, user: User = Depends(get_current_user)
) -> dict:
    if not verify_password(body.current, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="invalid_current")
    user.password_hash = hash_password(body.new_password)
    await user.save(update_fields=["password_hash", "updated_at"])
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
