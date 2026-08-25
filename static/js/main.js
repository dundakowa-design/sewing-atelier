// Мобильное меню
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");
const navOverlay = document.querySelector(".nav-overlay");

if (navToggle && nav && navOverlay) {
  const closeMenu = () => {
    nav.classList.remove("nav--open");
    navOverlay.classList.remove("nav-overlay--open");
    navToggle.setAttribute("aria-expanded", "false");
    document.body.classList.remove("nav-locked");
  };

  const openMenu = () => {
    nav.classList.add("nav--open");
    navOverlay.classList.add("nav-overlay--open");
    navToggle.setAttribute("aria-expanded", "true");
    document.body.classList.add("nav-locked");
  };

  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.contains("nav--open");
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  navOverlay.addEventListener("click", closeMenu);

  nav.querySelectorAll(".nav-link, .nav-cta").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

// Маска телефона: +7 (___) ___-__-__
function formatPhoneDigits(digits) {
  let result = "+7";
  if (digits.length > 0) result += " (" + digits.slice(0, 3);
  if (digits.length >= 3) result += ")";
  if (digits.length >= 4) result += " " + digits.slice(3, 6);
  if (digits.length >= 7) result += "-" + digits.slice(6, 8);
  if (digits.length >= 9) result += "-" + digits.slice(8, 10);
  return result;
}

function extractPhoneDigits(rawValue) {
  // Сначала убираем наш собственный префикс "+7"/"7", чтобы не спутать
  // его с восьмёркой/семёркой, которую по привычке допечатал пользователь.
  const rest = rawValue.replace(/^\+?7/, "");
  let digits = rest.replace(/\D/g, "");
  if (digits.startsWith("8") || digits.startsWith("7")) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
}

function isPhoneInputComplete(input) {
  return extractPhoneDigits(input.value).length === 10;
}

function initPhoneMask(input) {
  input.addEventListener("focus", () => {
    if (input.value === "") {
      input.value = "+7 ";
    }
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  });

  input.addEventListener("input", () => {
    const digits = extractPhoneDigits(input.value);
    input.value = digits.length > 0 ? formatPhoneDigits(digits) : "+7 ";
    input.classList.remove("field-invalid");
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  });

  input.addEventListener("blur", () => {
    const digits = extractPhoneDigits(input.value);
    if (digits.length === 0) {
      input.value = "";
      input.classList.remove("field-invalid");
    } else if (digits.length < 10) {
      input.classList.add("field-invalid");
    } else {
      input.classList.remove("field-invalid");
    }
  });
}

document.querySelectorAll('input[type="tel"]').forEach(initPhoneMask);

// Поле «Имя»: только буквы, пробел и дефис
const NAME_ALLOWED_CHARS = /[^a-zA-Zа-яёА-ЯЁ\s-]/g;

function countNameLetters(value) {
  const matches = value.match(/[a-zA-Zа-яёА-ЯЁ]/g);
  return matches ? matches.length : 0;
}

function isNameInputValid(input) {
  return countNameLetters(input.value) >= 2;
}

function initNameInput(input) {
  input.addEventListener("input", () => {
    const cleaned = input.value.replace(NAME_ALLOWED_CHARS, "");
    if (cleaned !== input.value) {
      const removedBeforeCursor = input.value.length - cleaned.length;
      const pos = Math.max(0, input.selectionStart - removedBeforeCursor);
      input.value = cleaned;
      input.setSelectionRange(pos, pos);
    }
    input.classList.remove("field-invalid");
  });

  input.addEventListener("blur", () => {
    if (input.value.trim() === "") {
      input.classList.remove("field-invalid");
    } else if (!isNameInputValid(input)) {
      input.classList.add("field-invalid");
    } else {
      input.classList.remove("field-invalid");
    }
  });
}

document.querySelectorAll('input[name="name"]').forEach(initNameInput);

// Отправка формы заявки на /order
function bindOrderForm(form) {
  const formStatus = form.querySelector(".form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const honeypot = form.querySelector('[name="confirm_email_check"]');
    if (honeypot && honeypot.value !== "") {
      console.error("Форма отклонена: заполнено honeypot-поле (похоже на спам-бота).");
      return;
    }

    const nameInput = form.querySelector('input[name="name"]');
    if (nameInput) {
      nameInput.value = nameInput.value.trim();
    }
    if (nameInput && !isNameInputValid(nameInput)) {
      nameInput.classList.add("field-invalid");
      nameInput.focus();
      formStatus.textContent = "Введите имя — минимум 2 буквы.";
      formStatus.dataset.state = "error";
      return;
    }

    const phoneInput = form.querySelector('input[type="tel"]');
    if (phoneInput && !isPhoneInputComplete(phoneInput)) {
      phoneInput.classList.add("field-invalid");
      phoneInput.focus();
      formStatus.textContent = "Проверьте номер телефона — введите его полностью.";
      formStatus.dataset.state = "error";
      return;
    }

    const submitBtn = form.querySelector("button[type='submit']");
    const formData = new FormData(form);

    submitBtn.disabled = true;
    formStatus.textContent = "Отправляем заявку…";
    formStatus.dataset.state = "";

    try {
      const response = await fetch("/order", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        formStatus.textContent = "Заявка отправлена. Мы перезвоним в течение дня.";
        formStatus.dataset.state = "success";
        form.reset();
      } else {
        formStatus.textContent = "Не удалось отправить заявку. Попробуйте ещё раз.";
        formStatus.dataset.state = "error";
      }
    } catch (error) {
      formStatus.textContent = "Нет соединения с сервером. Попробуйте позже.";
      formStatus.dataset.state = "error";
    } finally {
      submitBtn.disabled = false;
    }
  });
}

document.querySelectorAll(".contact-form, .modal-form").forEach(bindOrderForm);

// Модальное окно заявки
const contactModal = document.querySelector("#contact-modal");
const modalTriggers = document.querySelectorAll(".js-open-modal");
const modalClose = contactModal?.querySelector(".modal-close");

if (contactModal) {
  const openModal = () => {
    contactModal.showModal();
    document.body.classList.add("modal-open");
  };

  const closeModal = () => {
    contactModal.close();
  };

  modalTriggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      openModal();
    });
  });

  modalClose?.addEventListener("click", closeModal);

  // Закрытие по клику на затемнённый фон вокруг карточки
  contactModal.addEventListener("click", (event) => {
    const rect = contactModal.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside) {
      closeModal();
    }
  });

  // Esc закрывает <dialog> нативно; здесь только снимаем блокировку скролла
  contactModal.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });
}

// Табы услуг: «Для себя» / «Для бизнеса»
const serviceTabs = document.querySelectorAll(".service-tab");

serviceTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const targetId = tab.getAttribute("aria-controls");

    serviceTabs.forEach((otherTab) => {
      const isActive = otherTab === tab;
      otherTab.setAttribute("aria-selected", String(isActive));
      otherTab.tabIndex = isActive ? 0 : -1;
    });

    document.querySelectorAll(".service-grid[role='tabpanel']").forEach((panel) => {
      panel.hidden = panel.id !== targetId;
    });
  });
});

// Слайдер «Наш цех»: точки-индикаторы на мобильных
const galleryGrid = document.querySelector(".gallery-grid");
const galleryDots = document.querySelectorAll(".gallery-dot");

if (galleryGrid && galleryDots.length) {
  const galleryItems = galleryGrid.querySelectorAll(".gallery-item");

  const updateActiveDot = () => {
    let activeIndex = 0;
    let minDistance = Infinity;

    galleryItems.forEach((item, index) => {
      const distance = Math.abs(item.offsetLeft - galleryGrid.scrollLeft);
      if (distance < minDistance) {
        minDistance = distance;
        activeIndex = index;
      }
    });

    galleryDots.forEach((dot, index) => {
      dot.classList.toggle("gallery-dot--active", index === activeIndex);
    });
  };

  galleryGrid.addEventListener(
    "scroll",
    () => window.requestAnimationFrame(updateActiveDot),
    { passive: true }
  );

  galleryDots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      galleryItems[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
    });
  });

  updateActiveDot();
}
