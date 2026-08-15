/* =========================================================
   Health Management — Contact Form
   Uses a free mailto link so customer enquiries open in the
   visitor's email app addressed to the site owner's inbox.
========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    const contactForm = document.querySelector("#contact-form");
    if (!contactForm) return;

    const LANG_KEY = "hm_lang";
    const STRINGS = {
        fillRequired: { zh: "请填写所有必填字段。", ja: "必須項目をすべて入力してください。", ko: "필수 항목을 모두 입력해 주세요." },
        invalidEmail: { zh: "请输入有效的电子邮箱地址。", ja: "有効なメールアドレスを入力してください。", ko: "유효한 이메일 주소를 입력해 주세요." },
        openingBtn: { zh: "打开邮箱…", ja: "メールを開いています…", ko: "이메일 앱 여는 중…" },
        openingMsg: { zh: "正在打开您的邮箱应用…", ja: "メールアプリを開いています…", ko: "이메일 앱을 여는 중…" },
        success: { zh: "您的邮箱应用已打开。请点击发送，我们就会收到您的咨询。", ja: "メールアプリが開きました。送信を押すとお問い合わせが届きます。", ko: "이메일 앱이 열렸습니다. 보내기를 누르면 문의가 접수됩니다." }
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
            submitBtn.textContent = t("openingBtn", "Opening email…");
        }

        showMessage(t("openingMsg", "Opening your email app…"), "pending");

        const ownerEmail = contactForm.dataset.recipient || "hsing3644791@gmail.com";
        const mailSubject = (subject.value || "New message from contact form").trim();
        const mailBody = [
            "New customer enquiry from Health Management",
            "",
            "Name: " + name.value.trim(),
            "Email: " + email.value.trim(),
            "Subject: " + mailSubject,
            "",
            "Message:",
            message.value.trim()
        ].join("\n");

        const mailtoUrl =
            "mailto:" + encodeURIComponent(ownerEmail) +
            "?subject=" + encodeURIComponent("[Contact Form] " + mailSubject) +
            "&body=" + encodeURIComponent(mailBody);

        window.location.href = mailtoUrl;
        showMessage(t("success", "Your email app is open. Please press Send so we receive your enquiry."), "success");

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
});
