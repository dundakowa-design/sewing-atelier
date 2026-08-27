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

// Модальное окно политики конфиденциальности
const privacyModal = document.querySelector("#privacy-modal");
const privacyTrigger = document.querySelector("#privacy-trigger");
const privacyClose = privacyModal?.querySelector(".modal-close");

if (privacyModal && privacyTrigger) {
  const openPrivacyModal = () => {
    privacyModal.showModal();
    document.body.classList.add("modal-open");
  };

  const closePrivacyModal = () => {
    privacyModal.close();
  };

  // Ссылка ведёт на /privacy как рабочий вариант без JS; при включённом JS
  // открываем то же содержимое в модалке, не покидая страницу.
  privacyTrigger.addEventListener("click", (event) => {
    event.preventDefault();
    openPrivacyModal();
  });

  privacyClose?.addEventListener("click", closePrivacyModal);

  // Закрытие по клику на затемнённый фон вокруг окна
  privacyModal.addEventListener("click", (event) => {
    const rect = privacyModal.getBoundingClientRect();
    const clickedInside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!clickedInside) {
      closePrivacyModal();
    }
  });

  // Esc закрывает <dialog> нативно; здесь только снимаем блокировку скролла
  privacyModal.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
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

// Поле «Имя»: только кириллица, пробел и дефис
const NAME_ALLOWED_CHARS = /[^а-яёА-ЯЁ\s-]/g;
const NAME_MAX_WORD_LENGTH = 15;

function countNameLetters(value) {
  const matches = value.match(/[а-яёА-ЯЁ]/g);
  return matches ? matches.length : 0;
}

function isNameInputValid(input) {
  return countNameLetters(input.value) >= 2;
}

function sanitizeName(value) {
  // Только кириллица, пробел и дефис — латиница и все прочие символы вырезаются
  let cleaned = value.replace(NAME_ALLOWED_CHARS, "");

  // Не больше двух одинаковых букв подряд («аа» можно, «ааа» схлопывается до «аа»)
  cleaned = cleaned.replace(/([а-яёА-ЯЁ])\1{2,}/gi, "$1$1");

  // Каждое слово (между пробелами) не длиннее 15 символов
  cleaned = cleaned
    .split(" ")
    .map((word) => word.slice(0, NAME_MAX_WORD_LENGTH))
    .join(" ");

  return cleaned;
}

function initNameInput(input) {
  input.addEventListener("input", () => {
    const cleaned = sanitizeName(input.value);
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

// Отправка формы заявки на /api/submit (Vercel Serverless Function -> Telegram)
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
    const payload = Object.fromEntries(formData.entries());

    submitBtn.disabled = true;
    formStatus.textContent = "Отправляем заявку…";
    formStatus.dataset.state = "";

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        formStatus.textContent = "Заявка отправлена. Мы перезвоним в течение дня.";
        formStatus.dataset.state = "success";
        form.reset();

        // form.reset() не трогает обычный <p> — сводку калькулятора прячем вручную
        const calcDisplay = form.querySelector("#calc-summary-display");
        if (calcDisplay) {
          calcDisplay.textContent = "";
          calcDisplay.hidden = true;
        }
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

document.querySelectorAll(".contact-form").forEach(bindOrderForm);

// Кнопки-приглашения ведут на единственную форму заявки внизу страницы (#contact).
// Переход по ссылке — обычный, браузер сам плавно проскроллит (scroll-behavior: smooth в reset.css);
// здесь только через паузу ставим фокус в первое поле, чтобы можно было сразу печатать.
document.querySelectorAll(".js-focus-contact-form").forEach((trigger) => {
  trigger.addEventListener("click", () => {
    window.setTimeout(() => {
      document.querySelector("#order-form input[name='name']")?.focus();
    }, 500);
  });
});

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

// Калькулятор стоимости пошива
const calcSection = document.querySelector("#calculator");

if (calcSection) {
  const modeButtons = calcSection.querySelectorAll(".calc-mode .service-tab");
  const modeHintEl = calcSection.querySelector("#calc-mode-hint");
  const productButtons = calcSection.querySelectorAll(".calc-product");
  const qtySlider = calcSection.querySelector("#calc-qty");
  const qtyValueEl = calcSection.querySelector("#calc-qty-value");
  const discountHintEl = calcSection.querySelector("#calc-discount-hint");
  const patternsCheckbox = calcSection.querySelector("#calc-patterns");
  const brandingCheckbox = calcSection.querySelector("#calc-branding");
  const totalEl = calcSection.querySelector("#calc-total");
  const unitPriceEl = calcSection.querySelector("#calc-unit-price");
  const ctaBtn = calcSection.querySelector("#calc-cta");

  const rub = new Intl.NumberFormat("ru-RU");

  const MODE_HINTS = {
    single: "Пошив от 1 шт — подходит для себя или на подарок.",
    wholesale: "Мелкосерийное производство — минимальный тираж 20 шт.",
  };

  const getSelectedProduct = () => {
    const active = calcSection.querySelector('.calc-product[aria-pressed="true"]');
    return { name: active.dataset.name, price: Number(active.dataset.price) };
  };

  const getDiscountMultiplier = (qty) => {
    if (qty > 500) return 0.85;
    if (qty > 100) return 0.9;
    return 1;
  };

  const updateDiscountHint = (qty) => {
    if (qty > 500) {
      discountHintEl.textContent = "Скидка 15% — тираж больше 500 шт.";
    } else if (qty > 100) {
      discountHintEl.textContent = "Скидка 10% — тираж от 101 до 500 шт.";
    } else {
      discountHintEl.textContent = "Базовая цена — скидка начинается со 101 шт.";
    }
  };

  const calculate = () => {
    const product = getSelectedProduct();
    const qty = Number(qtySlider.value);

    qtyValueEl.textContent = qty + " шт";
    updateDiscountHint(qty);

    const unitBase = product.price + (brandingCheckbox.checked ? 100 : 0);
    const unitPrice = Math.round(unitBase * getDiscountMultiplier(qty));
    const total = unitPrice * qty + (patternsCheckbox.checked ? 3000 : 0);

    totalEl.textContent = rub.format(total) + " ₽";
    unitPriceEl.textContent = rub.format(unitPrice) + " ₽";

    return { product, qty, unitPrice, total };
  };

  productButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      productButtons.forEach((otherBtn) => otherBtn.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      calculate();
    });
  });

  // Формат заказа переключает минимум тиража: штучно — от 1 шт,
  // оптовая партия — от 20 шт (правило из блока «Услуги»). Скидки от 101/500 шт не меняются.
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((otherBtn) => otherBtn.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");

      const minQty = Number(btn.dataset.minQty);
      qtySlider.min = minQty;
      if (Number(qtySlider.value) < minQty) {
        qtySlider.value = minQty;
      }

      modeHintEl.textContent = MODE_HINTS[btn.dataset.mode] || "";
      calculate();
    });
  });

  qtySlider.addEventListener("input", calculate);
  patternsCheckbox.addEventListener("change", calculate);
  brandingCheckbox.addEventListener("change", calculate);

  ctaBtn.addEventListener("click", () => {
    const { product, qty, unitPrice, total } = calculate();

    const parts = [`Расчёт с сайта: ${product.name}`, `тираж ${qty} шт.`];
    if (patternsCheckbox.checked) parts.push("разработка лекал с нуля");
    if (brandingCheckbox.checked) parts.push("брендирование/вышивка");
    parts.push(`партия ≈ ${rub.format(total)} ₽ (${rub.format(unitPrice)} ₽/шт)`);
    const summary = parts.join(", ");

    const calcField = document.querySelector("#calc-field-summary");
    const calcDisplay = document.querySelector("#calc-summary-display");
    if (calcField) calcField.value = summary;
    if (calcDisplay) {
      calcDisplay.textContent = summary;
      calcDisplay.hidden = false;
    }

    // Отдельные структурированные поля — чтобы бэкенд не парсил текстовую сводку регуляркой,
    // а писал в Google Таблицу и Telegram уже готовые значения.
    const productField = document.querySelector("#calc-field-product");
    const qtyField = document.querySelector("#calc-field-qty");
    const totalField = document.querySelector("#calc-field-total");
    if (productField) productField.value = product.name;
    if (qtyField) qtyField.value = String(qty);
    if (totalField) totalField.value = String(total);

    // У calc-cta нет href — плавный переход к форме и фокус на первое поле делаем сами.
    document.querySelector("#contact")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      document.querySelector("#order-form input[name='name']")?.focus();
    }, 500);
  });

  calculate();
}

// Кнопка "Оформить в Telegram": сперва пробуем deep-link tg://, который сразу
// открывает приложение. Если за 1.5с страница не потеряла фокус (значит,
// приложение не установлено и переход не сработал) — уходим на веб-ссылку.
const telegramCta = document.querySelector("#telegram-cta");

if (telegramCta) {
  telegramCta.addEventListener("click", (event) => {
    const deepLink = telegramCta.getAttribute("href");
    const fallbackUrl = telegramCta.dataset.telegramFallback;
    if (!fallbackUrl) return;

    event.preventDefault();

    const fallbackTimer = window.setTimeout(() => {
      window.location.href = fallbackUrl;
    }, 1500);

    const cancelFallback = () => window.clearTimeout(fallbackTimer);
    window.addEventListener("blur", cancelFallback, { once: true });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelFallback();
    }, { once: true });

    window.location.href = deepLink;
  });
}
