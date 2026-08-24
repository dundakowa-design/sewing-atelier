// Мобильное меню
const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".nav");

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("nav--open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll(".nav-link, .nav-cta").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("nav--open");
      navToggle.setAttribute("aria-expanded", "false");
    });
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
