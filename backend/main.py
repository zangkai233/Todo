from datetime import date, timedelta

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import and_, inspect, or_, text
from sqlalchemy.orm import Session

from database import engine, get_db
from models import Base, Todo, User
from schemas import TodoCreate, TodoResponse, TodoUpdate, UserRegister, UserLogin, UserResponse
from auth import hash_password, verify_password, create_access_token, decode_access_token


app = FastAPI()

security = HTTPBearer()

origins = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ensure_todo_columns():
    inspector = inspect(engine)

    if "todos" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("todos")}
    statements = []

    if "category" not in columns:
        statements.append("ALTER TABLE todos ADD COLUMN category VARCHAR(60) NOT NULL DEFAULT ''")

    if "tags" not in columns:
        statements.append("ALTER TABLE todos ADD COLUMN tags VARCHAR(300) NOT NULL DEFAULT ''")

    if "due_date" not in columns:
        statements.append("ALTER TABLE todos ADD COLUMN due_date DATE NULL")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""

    return value.strip()


def normalize_tags(value: str | None) -> str:
    raw_tags = normalize_text(value)

    if not raw_tags:
        return ""

    seen_tags = set()
    tags = []

    for tag in raw_tags.split(","):
        clean_tag = tag.strip()
        tag_key = clean_tag.lower()

        if clean_tag and tag_key not in seen_tags:
            seen_tags.add(tag_key)
            tags.append(clean_tag)

    return ", ".join(tags)


Base.metadata.create_all(bind=engine)
ensure_todo_columns()


@app.get("/")
def home():
    return {"message": "FastAPI database backend is running"}


@app.post("/register", response_model=UserResponse)
def register(user: UserRegister, db: Session = Depends(get_db)):
    existing_user = db.query(User).filter(User.email == user.email).first()

    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(
        data={
            "sub": str(db_user.id),
            "email": db_user.email
        }
    )

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": db_user.id,
            "username": db_user.username,
            "email": db_user.email
        }
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),

    db: Session = Depends(get_db)

):

    token = credentials.credentials

    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user_id = payload.get("sub")

    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    db_user = db.query(User).filter(User.id == int(user_id)).first()

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    return db_user


@app.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/todos", response_model=list[TodoResponse])
def get_todos(
    q: str | None = Query(default=None, max_length=120),
    status_filter: str = Query(default="all", alias="status"),
    category: str | None = Query(default=None, max_length=60),
    tag: str | None = Query(default=None, max_length=60),
    due: str = Query(default="all"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(Todo).filter(Todo.owner_id == current_user.id)

    if status_filter == "open":
        query = query.filter(Todo.completed.is_(False))
    elif status_filter == "done":
        query = query.filter(Todo.completed.is_(True))
    elif status_filter != "all":
        raise HTTPException(status_code=400, detail="Invalid status filter")

    search_term = normalize_text(q)

    if search_term:
        search_pattern = f"%{search_term}%"
        query = query.filter(
            or_(
                Todo.title.ilike(search_pattern),
                Todo.category.ilike(search_pattern),
                Todo.tags.ilike(search_pattern)
            )
        )

    category_filter = normalize_text(category)

    if category_filter:
        query = query.filter(Todo.category.ilike(category_filter))

    tag_filter = normalize_text(tag)

    if tag_filter:
        query = query.filter(Todo.tags.ilike(f"%{tag_filter}%"))

    today = date.today()

    if due == "overdue":
        query = query.filter(
            Todo.completed.is_(False),
            Todo.due_date.is_not(None),
            Todo.due_date < today
        )
    elif due == "today":
        query = query.filter(Todo.due_date == today)
    elif due == "week":
        query = query.filter(
            and_(
                Todo.due_date.is_not(None),
                Todo.due_date >= today,
                Todo.due_date <= today + timedelta(days=7)
            )
        )
    elif due == "no-date":
        query = query.filter(Todo.due_date.is_(None))
    elif due != "all":
        raise HTTPException(status_code=400, detail="Invalid due date filter")

    return query.order_by(
        Todo.completed.asc(),
        Todo.due_date.is_(None).asc(),
        Todo.due_date.asc(),
        Todo.id.desc()
    ).all()


@app.post("/todos", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo: TodoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    title = todo.title.strip()

    if not title:
        raise HTTPException(status_code=400, detail="Todo title is required")

    new_todo = Todo(
        title=title,
        category=normalize_text(todo.category),
        tags=normalize_tags(todo.tags),
        due_date=todo.due_date,
        owner_id=current_user.id
    )

    db.add(new_todo)
    db.commit()
    db.refresh(new_todo)

    return new_todo


@app.put("/todos/{todo_id}", response_model=TodoResponse)
def update_todo(
    todo_id: int,
    todo_update: TodoUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.owner_id == current_user.id
    ).first()

    if db_todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")

    if todo_update.title is not None:
        title = todo_update.title.strip()

        if not title:
            raise HTTPException(status_code=400, detail="Todo title is required")

        db_todo.title = title

    if "completed" in todo_update.model_fields_set and todo_update.completed is not None:
        db_todo.completed = todo_update.completed

    if "category" in todo_update.model_fields_set:
        db_todo.category = normalize_text(todo_update.category)

    if "tags" in todo_update.model_fields_set:
        db_todo.tags = normalize_tags(todo_update.tags)

    if "due_date" in todo_update.model_fields_set:
        db_todo.due_date = todo_update.due_date

    db.commit()
    db.refresh(db_todo)

    return db_todo


@app.delete("/todos/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db_todo = db.query(Todo).filter(
        Todo.id == todo_id,
        Todo.owner_id == current_user.id
    ).first()

    if db_todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")

    db.delete(db_todo)
    db.commit()
