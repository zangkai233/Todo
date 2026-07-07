from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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


class TodoCreate(BaseModel):
    title: str


class TodoUpdate(BaseModel):
    title: str
    completed: bool


todos = []
next_id = 1


@app.get("/")
def home():
    return {"message": "FastAPI Todo API is running"}


# 查：获取所有 Todo
@app.get("/todos")
def get_todos():
    return {
        "todos": todos
    }


# 增：创建 Todo
@app.post("/todos")
def create_todo(todo: TodoCreate):
    global next_id

    new_todo = {
        "id": next_id,
        "title": todo.title,
        "completed": False
    }

    todos.append(new_todo)
    next_id += 1

    return {
        "message": "Todo created",
        "todo": new_todo
    }


# 改：修改 Todo
@app.put("/todos/{todo_id}")
def update_todo(todo_id: int, todo: TodoUpdate):
    for item in todos:
        if item["id"] == todo_id:
            item["title"] = todo.title
            item["completed"] = todo.completed

            return {
                "message": "Todo updated",
                "todo": item
            }

    return {
        "error": "Todo not found"
    }


# 删：删除 Todo
@app.delete("/todos/{todo_id}")
def delete_todo(todo_id: int):
    for item in todos:
        if item["id"] == todo_id:
            todos.remove(item)

            return {
                "message": "Todo deleted",
                "todo": item
            }

    return {
        "error": "Todo not found"
    }