const API_BASE_URL = "http://127.0.0.1:8000";

const registerBtn = document.getElementById("registerBtn");
const loginBtn = document.getElementById("loginBtn");

registerBtn.addEventListener("click", async () => {
    const username = document.getElementById("registerUsername").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;

    const resultText = document.getElementById("registerResult");

    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username: username,
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            resultText.textContent = data.detail || "Register failed";
            return;
        }

        resultText.textContent = `Registered successfully: ${data.username}. You can now login.`;
    } catch (error) {
        resultText.textContent = "Network error";
        console.error(error);
    }
});


loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value;
    const password = document.getElementById("loginPassword").value;

    const resultText = document.getElementById("loginResult");

    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            resultText.textContent = data.detail || "Login failed";
            return;
        }

        // 保存 JWT token
        localStorage.setItem("token", data.access_token);

        // 可选：保存用户名
        localStorage.setItem("username", data.user.username);

        // 登录成功后跳转到 dashboard 页面
        window.location.href = "dashboard.html";

    } catch (error) {
        resultText.textContent = "Network error";
        console.error(error);
    }
});