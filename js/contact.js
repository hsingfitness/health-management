/* =========================================================
   Health Management — Contact Form
   Submits to the FastAPI backend, which emails the message
   to the site owner's inbox via Gmail SMTP.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const contactForm = document.querySelector("#contact-form");
    if (!contactForm) return;

    const LANG_KEY = "hm_lang";
    const STRINGS = {
        fillRequired: { zh: "请填写所有必填字段。", ja: "必須項目をすべて入力してください。", ko: "필수 항목을 모두 입력해 주세요." },
        invalidEmail: { zh: "请输入有效的电子邮箱地址。", ja: "有効なメールアドレスを入力してください。", ko: "유효한 이메일 주소를 입력해 주세요." },
        sendingBtn: { zh: "发送中…", ja: "送信中…", ko: "전송 중…" },
        sendingMsg: { zh: "正在发送消息…", ja: "メッセージを送信しています…", ko: "메시지를 보내는 중…" },
        success: { zh: "消息已发送！我们会尽快回复您。", ja: "メッセージを送信しました。追ってご連絡いたします。", ko: "메시지가 전송되었습니다! 곧 답변드리겠습니다." },
        genericError: { zh: "发送消息时出现问题。", ja: "メッセージの送信中に問題が発生しました。", ko: "메시지 전송 중 문제가 발생했습니다." },
        unreachable: {
            zh: "目前无法连接到服务器。后端可能尚未部署 — 请稍后再试。",
            ja: "現在サーバーに接続できません。バックエンドがまだデプロイされていない可能性があります。しばらくしてから再度お試しください。",
            ko: "지금은 서버에 연결할 수 없습니다. 백엔드가 아직 배포되지 않았을 수 있습니다 — 나중에 다시 시도해 주세요."
        }
    };

    function currentLang() {
        try {
            return window.localStorage.getItem(LANG_KEY) || "en";
        } catch (err) {
            return "en";
        }
    }

    function t(key, fallback) {
        const lang = currentLang();
        const entry = STRINGS[key];
        return entry && entry[lang] ? entry[lang] : fallback;
    }

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
            showMessage(t("fillRequired", "Please complete all required fields."), "error");
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email.value.trim())) {
            showMessage(t("invalidEmail", "Please enter a valid email address."), "error");
            return;
        }

        const submitBtn = contactForm.querySelector("button[type=submit]");
        const originalLabel = submitBtn ? submitBtn.innerHTML : null;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = t("sendingBtn", "Sending…");
        }

        showMessage(t("sendingMsg", "Sending message…"), "pending");

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
                let detail = t("genericError", "Something went wrong sending your message.");
                try {
                    const data = await response.json();
                    if (data && data.detail) detail = data.detail;
                } catch (e) {
                    /* no JSON body */
                }
                throw new Error(detail);
            }

            showMessage(t("success", "Message sent! We'll get back to you soon."), "success");
            contactForm.reset();
        } catch (err) {
            const msg =
                err.message === "Failed to fetch"
                    ? t("unreachable", "Can't reach the server right now. The backend may not be deployed yet — please try again later.")
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
