const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const replyText = document.getElementById("replyText");

const API_URL = "http://127.0.0.1:8000";


// 查：加载所有 Todo
async function loadTodos() {
  try {
    const response = await fetch(`${API_URL}/todos`);
    const data = await response.json();

    replyText.innerHTML = "";

    if (data.todos.length === 0) {
      replyText.innerHTML = `<p class="empty-text">暂无 Todo，先添加一个吧</p>`;
      return;
    }

    data.todos.forEach((todo) => {
      const todoItem = document.createElement("div");

      todoItem.className = "todo-item";

      todoItem.innerHTML = `
        <p class="todo-title">
          ${todo.id}. ${todo.title}
          <span class="todo-status">
            ${todo.completed ? "✅ 已完成" : "❌ 未完成"}
          </span>
        </p>

        <div class="button-row">
          <button class="complete-btn" onclick="completeTodo(${todo.id}, '${todo.title}')">
            完成
          </button>

          <button class="edit-btn" onclick="editTodo(${todo.id}, '${todo.title}', ${todo.completed})">
            修改
          </button>

          <button class="delete-btn" onclick="deleteTodo(${todo.id})">
            删除
          </button>
        </div>
      `;

      replyText.appendChild(todoItem);
    });
  } catch (error) {
    console.error(error);
    replyText.textContent = "加载 Todo 失败，请检查后端是否启动";
  }
}


// 增：添加 Todo
sendBtn.addEventListener("click", async () => {
  const title = messageInput.value;

  if (!title.trim()) {
    replyText.textContent = "请输入 Todo 内容";
    return;
  }

  try {
    await fetch(`${API_URL}/todos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: title
      })
    });

    messageInput.value = "";

    await loadTodos();
  } catch (error) {
    console.error(error);
    replyText.textContent = "创建 Todo 失败，请检查后端是否启动";
  }
});


// 改：标记 Todo 为完成
async function completeTodo(id, title) {
  try {
    await fetch(`${API_URL}/todos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: title,
        completed: true
      })
    });

    await loadTodos();
  } catch (error) {
    console.error(error);
    replyText.textContent = "更新 Todo 失败";
  }
}


// 改：修改 Todo 标题
async function editTodo(id, oldTitle, completed) {
  const newTitle = prompt("请输入新的 Todo 内容：", oldTitle);

  if (newTitle === null) {
    return;
  }

  if (!newTitle.trim()) {
    alert("Todo 内容不能为空");
    return;
  }

  try {
    await fetch(`${API_URL}/todos/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        title: newTitle,
        completed: completed
      })
    });

    await loadTodos();
  } catch (error) {
    console.error(error);
    replyText.textContent = "修改 Todo 失败";
  }
}


// 删：删除 Todo
async function deleteTodo(id) {
  try {
    await fetch(`${API_URL}/todos/${id}`, {
      method: "DELETE"
    });

    await loadTodos();
  } catch (error) {
    console.error(error);
    replyText.textContent = "删除 Todo 失败";
  }
}


// 页面一打开就自动加载 Todo
loadTodos();