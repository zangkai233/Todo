from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
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

Base.metadata.create_all(bind=engine)


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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Todo).filter(Todo.owner_id == current_user.id).order_by(Todo.id.desc()).all()


@app.post("/todos", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(
    todo: TodoCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    title = todo.title.strip()

    if not title:
        raise HTTPException(status_code=400, detail="Todo title is required")

    new_todo = Todo(title=title, owner_id=current_user.id)

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

    if todo_update.completed is not None:
        db_todo.completed = todo_update.completed

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
