const API_BASE_URL = "http://127.0.0.1:8000";

const token = localStorage.getItem("token");

const welcomeText = document.getElementById("welcomeText");
const userIdText = document.getElementById("userId");
const usernameText = document.getElementById("username");
const emailText = document.getElementById("email");
const logoutBtn = document.getElementById("logoutBtn");

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

logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");

    window.location.href = "login.html";
});

loadCurrentUser();