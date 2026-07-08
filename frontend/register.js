const API_BASE_URL = "http://127.0.0.1:8000";

const registerBtn = document.getElementById("registerBtn");

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

        resultText.textContent = "Registered successfully. Redirecting to login...";

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1000);

    } catch (error) {
        resultText.textContent = "Network error";
        console.error(error);
    }
});