const API_BASE_URL = "http://127.0.0.1:8000";

const token = localStorage.getItem("token");

const welcomeText = document.getElementById("welcomeText");
const userIdText = document.getElementById("userId");
const usernameText = document.getElementById("username");
const emailText = document.getElementById("email");
const logoutBtn = document.getElementById("logoutBtn");
const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const todoMessage = document.getElementById("todoMessage");
const todoList = document.getElementById("todoList");
const todoSummary = document.getElementById("todoSummary");

// 如果没有 token，说明没登录，直接赶回首页
if (!token) {
    window.location.href = "index.html";
}

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_BASE_URL}/me`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();

        if (!response.ok) {
            // token 错了或者过期了
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            window.location.href = "index.html";
            return;
        }

        welcomeText.textContent = `Welcome back, ${data.username}!`;
        userIdText.textContent = data.id;
        usernameText.textContent = data.username;
        emailText.textContent = data.email;

    } catch (error) {
        console.error(error);
        welcomeText.textContent = "Failed to load user info.";
    }
}

async function requestTodos(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            ...options.headers
        }
    });

    if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("token");
        localStorage.removeItem("username");
        window.location.href = "login.html";
        return null;
    }

    return response;
}

function setTodoMessage(message, isError = false) {
    todoMessage.textContent = message;
    todoMessage.className = isError ? "error-text" : "";
}

function renderTodos(todos) {
    todoList.innerHTML = "";

    const doneCount = todos.filter((todo) => todo.completed).length;
    const openCount = todos.length - doneCount;
    todoSummary.textContent = `${openCount} open / ${doneCount} done`;

    if (todos.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "todo-empty";
        emptyItem.textContent = "Your list is clear.";
        todoList.appendChild(emptyItem);
        return;
    }

    todos.forEach((todo) => {
        const item = document.createElement("li");
        item.className = todo.completed ? "todo-item completed" : "todo-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = todo.completed;
        checkbox.addEventListener("change", () => {
            updateTodo(todo.id, { completed: checkbox.checked });
        });

        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.value = todo.title;
        titleInput.className = "todo-title";
        titleInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                titleInput.blur();
            }
        });
        titleInput.addEventListener("blur", () => {
            const nextTitle = titleInput.value.trim();

            if (!nextTitle) {
                titleInput.value = todo.title;
                setTodoMessage("Todo title cannot be empty.", true);
                return;
            }

            if (nextTitle !== todo.title) {
                updateTodo(todo.id, { title: nextTitle });
            }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-todo";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
            deleteTodo(todo.id);
        });

        item.appendChild(checkbox);
        item.appendChild(titleInput);
        item.appendChild(deleteBtn);
        todoList.appendChild(item);
    });
}

async function loadTodos() {
    try {
        const response = await requestTodos("/todos");

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setTodoMessage(data.detail || "Failed to load todos.", true);
            return;
        }

        setTodoMessage("");
        renderTodos(data);
    } catch (error) {
        console.error(error);
        setTodoMessage("Network error while loading todos.", true);
    }
}

async function addTodo(title) {
    try {
        const response = await requestTodos("/todos", {
            method: "POST",
            body: JSON.stringify({ title: title })
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setTodoMessage(data.detail || "Failed to add todo.", true);
            return;
        }

        todoInput.value = "";
        await loadTodos();
    } catch (error) {
        console.error(error);
        setTodoMessage("Network error while adding todo.", true);
    }
}

async function updateTodo(todoId, changes) {
    try {
        const response = await requestTodos(`/todos/${todoId}`, {
            method: "PUT",
            body: JSON.stringify(changes)
        });

        if (!response) {
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            setTodoMessage(data.detail || "Failed to update todo.", true);
            await loadTodos();
            return;
        }

        await loadTodos();
    } catch (error) {
        console.error(error);
        setTodoMessage("Network error while updating todo.", true);
    }
}

async function deleteTodo(todoId) {
    try {
        const response = await requestTodos(`/todos/${todoId}`, {
            method: "DELETE"
        });

        if (!response) {
            return;
        }

        if (!response.ok) {
            const data = await response.json();
            setTodoMessage(data.detail || "Failed to delete todo.", true);
            return;
        }

        await loadTodos();
    } catch (error) {
        console.error(error);
        setTodoMessage("Network error while deleting todo.", true);
    }
}

todoForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const title = todoInput.value.trim();

    if (!title) {
        setTodoMessage("Please enter a todo.", true);
        return;
    }

    addTodo(title);
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    window.location.href = "login.html";
});

loadCurrentUser();
loadTodos();
