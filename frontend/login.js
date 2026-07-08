const API_BASE_URL = "http://127.0.0.1:8000";

const loginBtn = document.getElementById("loginBtn");

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

        localStorage.setItem("token", data.access_token);
        localStorage.setItem("username", data.user.username);

        window.location.href = "dashboard.html";

    } catch (error) {
        resultText.textContent = "Network error";
        console.error(error);
    }
});