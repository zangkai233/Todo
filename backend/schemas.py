from datetime import date

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str

    class Config:
        from_attributes = True


class TodoCreate(BaseModel):
    title: str = Field(..., max_length=200)
    category: str = Field(default="", max_length=60)
    tags: str = Field(default="", max_length=300)
    due_date: date | None = None

    @field_validator("category", "tags", mode="before")
    @classmethod
    def normalize_blank_text(cls, value):
        if value is None:
            return ""

        return str(value).strip()


class TodoUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    completed: bool | None = None
    category: str | None = Field(default=None, max_length=60)
    tags: str | None = Field(default=None, max_length=300)
    due_date: date | None = None

    @field_validator("category", "tags", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        if value is None:
            return None

        return str(value).strip()


class TodoResponse(BaseModel):
    id: int
    title: str
    completed: bool
    category: str
    tags: str
    due_date: date | None
    owner_id: int

    class Config:
        from_attributes = True
