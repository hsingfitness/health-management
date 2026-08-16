/* =========================================================
   Health Management — Contact Form
   Sends customer enquiries through Web3Forms,
   which forwards the message to the site owner's Gmail inbox.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const contactForm = document.querySelector("#contact-form");
    if (!contactForm) return;

    const LANG_KEY = "hm_lang";
    const STRINGS = {
        fillRequired: { zh: "请填写所有必填字段。", ja: "必須項目をすべて入力してください。", ko: "필수 항목을 모두 입력해 주세요." },
        invalidEmail: { zh: "请输入有效的电子邮箱地址。", ja: "有効なメールアドレスを入力してください。", ko: "유효한 이메일 주소를 입력해 주세요." },
        sendingBtn: { zh: "正在发送…", ja: "送信中…", ko: "보내는 중…" },
        sendingMsg: { zh: "正在发送您的消息…", ja: "メッセージを送信しています…", ko: "메시지를 보내는 중…" },
        success: { zh: "谢谢！您的消息已发送，我们会尽快回复。", ja: "ありがとうございます。メッセージを送信しました。できるだけ早く返信します。", ko: "감사합니다! 메시지가 전송되었습니다. 최대한 빨리 답변드리겠습니다." },
        serverUnavailable: { zh: "现在无法连接消息服务。请稍后再试。", ja: "現在メッセージサービスに接続できません。後でもう一度お試しください。", ko: "지금 메시지 서비스에 연결할 수 없습니다. 나중에 다시 시도해 주세요." },
        missingAccessKey: { zh: "请先配置 Web3Forms access key。", ja: "先に Web3Forms access key を設定してください。", ko: "먼저 Web3Forms access key를 설정해 주세요." },
        sendFailed: { zh: "现在无法发送消息。请稍后再试。", ja: "現在メッセージを送信できません。後でもう一度お試しください。", ko: "지금 메시지를 보낼 수 없습니다. 나중에 다시 시도해 주세요." }
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

    function formatErrorDetail(detail) {
        if (typeof detail === "string") return detail;
        if (Array.isArray(detail)) {
            return detail
                .map(function (item) { return item && item.msg ? item.msg : ""; })
                .filter(Boolean)
                .join(" ");
        }
        return "";
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

        showMessage(t("sendingMsg", "Sending your message…"), "pending");

        try {
            const accessKey = contactForm.querySelector("input[name=access_key]");
            if (!accessKey || accessKey.value === "YOUR_ACCESS_KEY_HERE") {
                throw new Error(t("missingAccessKey", "Please configure the Web3Forms access key first."));
            }

            const formData = new FormData(contactForm);
            formData.set("subject", (subject.value || "New message from contact form").trim());

            const response = await fetch(contactForm.action, {
                method: "POST",
                headers: { "Accept": "application/json" },
                body: formData
            });

            let data = null;
            try {
                data = await response.json();
            } catch (err) {
                /* successful contact requests return no JSON body */
            }

            if (!response.ok) {
                throw new Error(formatErrorDetail(data && data.detail) || t("sendFailed", "Couldn't send your message right now. Please try again later."));
            }

            contactForm.reset();
            showMessage(t("success", "Thank you! Your message has been sent, and we'll reply as soon as possible."), "success");
        } catch (err) {
            const networkMessage = err.message === "Failed to fetch"
                ? t("serverUnavailable", "Can't reach the message service right now. Please try again later.")
                : err.message;
            showMessage(networkMessage || t("sendFailed", "Couldn't send your message right now. Please try again later."), "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }
        }
    });
});
