/* =========================================================
   Health Management — Contact Form
   Submits to the FastAPI backend, which emails the message
   to the site owner's inbox via Gmail SMTP.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const contactForm = document.querySelector("#contact-form");
    if (!contactForm) return;

    function showMessage(text, type) {
        let messageBox = contactForm.querySelector(".form-message");
        if (!messageBox) {
            messageBox = document.createElement("div");
            messageBox.className = "form-message";
            contactForm.appendChild(messageBox);
        }
        messageBox.textContent = text;
        messageBox.className = "form-message " + type;
    }

    contactForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const name = document.getElementById("name");
        const email = document.getElementById("email");
        const subject = document.getElementById("subject");
        const message = document.getElementById("message");

        if (
            name.value.trim() === "" ||
            email.value.trim() === "" ||
            message.value.trim() === ""
        ) {
            showMessage("Please complete all required fields.", "error");
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.value.trim())) {
            showMessage("Please enter a valid email address.", "error");
            return;
        }

        const submitBtn = contactForm.querySelector("button[type=submit]");
        const originalLabel = submitBtn ? submitBtn.innerHTML : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Sending…";
        }

        showMessage("Sending message…", "pending");

        try {
            const response = await fetch(API_BASE + "/contact", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.value.trim(),
                    email: email.value.trim(),
                    subject: (subject.value || "New message from contact form").trim(),
                    message: message.value.trim()
                })
            });

            if (!response.ok) {
                let detail = "Something went wrong sending your message.";
                try {
                    const data = await response.json();
                    if (data && data.detail) detail = data.detail;
                } catch (e) {
                    /* no JSON body */
                }
                throw new Error(detail);
            }

            showMessage("Message sent! We'll get back to you soon.", "success");
            contactForm.reset();
        } catch (err) {
            const msg =
                err.message === "Failed to fetch"
                    ? "Can't reach the server right now. The backend may not be deployed yet — please try again later."
                    : err.message;
            showMessage(msg, "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }
        }
    });
});
