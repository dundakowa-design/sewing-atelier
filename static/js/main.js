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
const orderForm = document.querySelector("#order-form");
const formStatus = document.querySelector("#form-status");

if (orderForm) {
  orderForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const submitBtn = orderForm.querySelector("button[type='submit']");
    const formData = new FormData(orderForm);

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
        orderForm.reset();
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
