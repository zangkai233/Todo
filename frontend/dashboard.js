const API_BASE_URL = "http://127.0.0.1:8000";

const token = localStorage.getItem("token");

const welcomeText = document.getElementById("welcomeText");
const userIdText = document.getElementById("userId");
const usernameText = document.getElementById("username");
const emailText = document.getElementById("email");
const logoutBtn = document.getElementById("logoutBtn");
const todoForm = document.getElementById("todoForm");
const todoInput = document.getElementById("todoInput");
const categoryInput = document.getElementById("categoryInput");
const tagsInput = document.getElementById("tagsInput");
const dueDateInput = document.getElementById("dueDateInput");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const categoryFilter = document.getElementById("categoryFilter");
const tagFilter = document.getElementById("tagFilter");
const dueFilter = document.getElementById("dueFilter");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const todoMessage = document.getElementById("todoMessage");
const todoList = document.getElementById("todoList");
const todoSummary = document.getElementById("todoSummary");
const activeFilterText = document.getElementById("activeFilterText");
const openCount = document.getElementById("openCount");
const doneCount = document.getElementById("doneCount");
const dueSoonCount = document.getElementById("dueSoonCount");

let allTodos = [];

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
            localStorage.removeItem("token");
            localStorage.removeItem("username");
            window.location.href = "index.html";
            return;
        }

        welcomeText.textContent = `Welcome back, ${data.username}.`;
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

function splitTags(tags) {
    if (!tags) {
        return [];
    }

    return tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
}

function normalizeTags(tags) {
    const seenTags = new Set();
    const cleanTags = [];

    splitTags(tags).forEach((tag) => {
        const tagKey = tag.toLowerCase();

        if (!seenTags.has(tagKey)) {
            seenTags.add(tagKey);
            cleanTags.push(tag);
        }
    });

    return cleanTags.join(", ");
}

function normalizeTodo(todo) {
    return {
        ...todo,
        category: todo.category || "",
        tags: todo.tags || "",
        due_date: todo.due_date || null
    };
}

function parseDate(value) {
    if (!value) {
        return null;
    }

    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function startOfToday() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function daysFromToday(value) {
    const dueDate = parseDate(value);

    if (!dueDate) {
        return null;
    }

    const diff = dueDate.getTime() - startOfToday().getTime();
    return Math.round(diff / 86400000);
}

function getDueState(todo) {
    const days = daysFromToday(todo.due_date);

    if (days === null) {
        return "none";
    }

    if (!todo.completed && days < 0) {
        return "overdue";
    }

    if (days === 0) {
        return "today";
    }

    if (!todo.completed && days <= 7) {
        return "soon";
    }

    return "scheduled";
}

function formatDueDate(todo) {
    const dueDate = parseDate(todo.due_date);

    if (!dueDate) {
        return "No date";
    }

    const state = getDueState(todo);
    const formattedDate = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric"
    }).format(dueDate);

    if (state === "overdue") {
        return `Overdue ${formattedDate}`;
    }

    if (state === "today") {
        return "Today";
    }

    return formattedDate;
}

function updateStats() {
    const openTodos = allTodos.filter((todo) => !todo.completed);
    const doneTodos = allTodos.filter((todo) => todo.completed);
    const dueSoonTodos = allTodos.filter((todo) => {
        const state = getDueState(todo);
        return state === "today" || state === "soon" || state === "overdue";
    });

    openCount.textContent = openTodos.length;
    doneCount.textContent = doneTodos.length;
    dueSoonCount.textContent = dueSoonTodos.length;
}

function buildSelectOptions(selectElement, values, defaultLabel) {
    const currentValue = selectElement.value;
    selectElement.innerHTML = "";

    const defaultOption = document.createElement("option");
    defaultOption.value = "all";
    defaultOption.textContent = defaultLabel;
    selectElement.appendChild(defaultOption);

    values.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        selectElement.appendChild(option);
    });

    if (currentValue === "all" || values.includes(currentValue)) {
        selectElement.value = currentValue;
    }
}

function updateFilterOptions() {
    const categories = [...new Set(allTodos.map((todo) => todo.category).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b));
    const tags = [...new Set(allTodos.flatMap((todo) => splitTags(todo.tags)))]
        .sort((a, b) => a.localeCompare(b));

    buildSelectOptions(categoryFilter, categories, "All categories");
    buildSelectOptions(tagFilter, tags, "All tags");
}

function matchesDueFilter(todo, filterValue) {
    const state = getDueState(todo);

    if (filterValue === "overdue") {
        return state === "overdue";
    }

    if (filterValue === "today") {
        return state === "today";
    }

    if (filterValue === "week") {
        return state === "today" || state === "soon";
    }

    if (filterValue === "no-date") {
        return state === "none";
    }

    return true;
}

function getFilteredTodos() {
    const searchTerm = searchInput.value.trim().toLowerCase();

    return allTodos.filter((todo) => {
        if (statusFilter.value === "open" && todo.completed) {
            return false;
        }

        if (statusFilter.value === "done" && !todo.completed) {
            return false;
        }

        if (categoryFilter.value !== "all" && todo.category !== categoryFilter.value) {
            return false;
        }

        if (tagFilter.value !== "all" && !splitTags(todo.tags).includes(tagFilter.value)) {
            return false;
        }

        if (!matchesDueFilter(todo, dueFilter.value)) {
            return false;
        }

        if (!searchTerm) {
            return true;
        }

        const searchableText = `${todo.title} ${todo.category} ${todo.tags}`.toLowerCase();
        return searchableText.includes(searchTerm);
    });
}

function updateActiveFilterText(visibleCount) {
    const activeFilters = [];

    if (searchInput.value.trim()) {
        activeFilters.push(`Search: ${searchInput.value.trim()}`);
    }

    if (statusFilter.value !== "all") {
        activeFilters.push(statusFilter.options[statusFilter.selectedIndex].textContent);
    }

    if (categoryFilter.value !== "all") {
        activeFilters.push(categoryFilter.value);
    }

    if (tagFilter.value !== "all") {
        activeFilters.push(`#${tagFilter.value}`);
    }

    if (dueFilter.value !== "all") {
        activeFilters.push(dueFilter.options[dueFilter.selectedIndex].textContent);
    }

    activeFilterText.textContent = activeFilters.length ? activeFilters.join(" / ") : "All tasks";
    todoSummary.textContent = `${visibleCount} shown`;
}

function createMetaInput({ value, placeholder, className, type = "text", onSave }) {
    const input = document.createElement("input");
    input.type = type;
    input.value = value || "";
    input.placeholder = placeholder;
    input.className = className;

    if (type === "date") {
        input.addEventListener("change", () => {
            onSave(input.value || null);
        });
        return input;
    }

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            input.blur();
        }

        if (event.key === "Escape") {
            input.value = value || "";
            input.blur();
        }
    });

    input.addEventListener("blur", () => {
        const nextValue = input.value.trim();

        if (nextValue !== (value || "")) {
            onSave(nextValue);
        }
    });

    return input;
}

function renderTodos() {
    todoList.innerHTML = "";

    const visibleTodos = getFilteredTodos();
    updateActiveFilterText(visibleTodos.length);

    if (visibleTodos.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "todo-empty";
        emptyItem.textContent = allTodos.length === 0 ? "Your list is clear." : "No tasks match.";
        todoList.appendChild(emptyItem);
        return;
    }

    visibleTodos.forEach((todo) => {
        const item = document.createElement("li");
        const dueState = getDueState(todo);
        item.className = `todo-item ${todo.completed ? "completed" : ""} due-${dueState}`;

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "todo-check";
        checkbox.checked = todo.completed;
        checkbox.addEventListener("change", () => {
            updateTodo(todo.id, { completed: checkbox.checked });
        });

        const content = document.createElement("div");
        content.className = "todo-content";

        const titleInput = createMetaInput({
            value: todo.title,
            placeholder: "Todo",
            className: "todo-title",
            onSave: (nextTitle) => {
                if (!nextTitle) {
                    titleInput.value = todo.title;
                    setTodoMessage("Todo title cannot be empty.", true);
                    return;
                }

                updateTodo(todo.id, { title: nextTitle });
            }
        });

        const metaEditor = document.createElement("div");
        metaEditor.className = "todo-meta-editor";

        const categoryEditor = createMetaInput({
            value: todo.category,
            placeholder: "Category",
            className: "todo-meta-input",
            onSave: (nextCategory) => updateTodo(todo.id, { category: nextCategory })
        });

        const tagsEditor = createMetaInput({
            value: todo.tags,
            placeholder: "Tags",
            className: "todo-meta-input",
            onSave: (nextTags) => updateTodo(todo.id, { tags: normalizeTags(nextTags) })
        });

        const dueEditor = createMetaInput({
            value: todo.due_date,
            placeholder: "Due date",
            className: "todo-meta-input",
            type: "date",
            onSave: (nextDueDate) => updateTodo(todo.id, { due_date: nextDueDate })
        });

        const dueBadge = document.createElement("span");
        dueBadge.className = `due-badge due-${dueState}`;
        dueBadge.textContent = formatDueDate(todo);

        metaEditor.appendChild(categoryEditor);
        metaEditor.appendChild(tagsEditor);
        metaEditor.appendChild(dueEditor);
        metaEditor.appendChild(dueBadge);

        content.appendChild(titleInput);
        content.appendChild(metaEditor);

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "delete-todo";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", () => {
            deleteTodo(todo.id);
        });

        item.appendChild(checkbox);
        item.appendChild(content);
        item.appendChild(deleteBtn);
        todoList.appendChild(item);
    });
}

function renderDashboard() {
    updateStats();
    updateFilterOptions();
    renderTodos();
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

        allTodos = data.map(normalizeTodo);
        setTodoMessage("");
        renderDashboard();
    } catch (error) {
        console.error(error);
        setTodoMessage("Network error while loading todos.", true);
    }
}

async function addTodo() {
    const title = todoInput.value.trim();

    if (!title) {
        setTodoMessage("Please enter a todo.", true);
        return;
    }

    const payload = {
        title,
        category: categoryInput.value.trim(),
        tags: normalizeTags(tagsInput.value),
        due_date: dueDateInput.value || null
    };

    try {
        const response = await requestTodos("/todos", {
            method: "POST",
            body: JSON.stringify(payload)
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
        categoryInput.value = "";
        tagsInput.value = "";
        dueDateInput.value = "";
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
    addTodo();
});

[searchInput, statusFilter, categoryFilter, tagFilter, dueFilter].forEach((control) => {
    control.addEventListener("input", renderTodos);
    control.addEventListener("change", renderTodos);
});

clearFiltersBtn.addEventListener("click", () => {
    searchInput.value = "";
    statusFilter.value = "all";
    categoryFilter.value = "all";
    tagFilter.value = "all";
    dueFilter.value = "all";
    renderTodos();
});

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    window.location.href = "login.html";
});

loadCurrentUser();
loadTodos();
