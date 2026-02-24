from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

# Простой email-pattern без EmailStr (он отвергает .local и другие нестандартные TLD).
_EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=255, pattern=_EMAIL_PATTERN)
    password: str = Field(min_length=1)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(alias="refreshToken")

    model_config = {"populate_by_name": True}


class PasswordChangeRequest(BaseModel):
    current: str
    new_password: str = Field(min_length=8, max_length=255, alias="new")

    model_config = {"populate_by_name": True}


class UserOut(BaseModel):
    id: UUID
    email: str
    display_name: str = Field(alias="displayName")
    created_at: datetime = Field(alias="createdAt")

    model_config = {"from_attributes": True, "populate_by_name": True}


class TokenPair(BaseModel):
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")
    token_type: str = Field(default="bearer", alias="tokenType")

    model_config = {"populate_by_name": True}


class LoginResponse(BaseModel):
    user: UserOut
    access_token: str = Field(alias="accessToken")
    refresh_token: str = Field(alias="refreshToken")

    model_config = {"populate_by_name": True}
