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

// Отправка формы заявки на /order
function bindOrderForm(form) {
  const formStatus = form.querySelector(".form-status");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

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
