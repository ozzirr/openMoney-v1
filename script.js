document.addEventListener("DOMContentLoaded", () => {
  const menuBtn = document.querySelector(".mobile-menu-btn");
  const navLinks = document.querySelector(".nav-links");
  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("open");
    });
  }

  const carousel = document.getElementById("hero-carousel");
  if (carousel) {
    const slides = Array.from(carousel.querySelectorAll(".carousel-slide"));
    const indicators = Array.from(carousel.querySelectorAll(".indicator"));
    let index = 0;

    const showSlide = (next) => {
      slides.forEach((slide, i) => slide.classList.toggle("active", i === next));
      indicators.forEach((dot, i) => dot.classList.toggle("active", i === next));
      index = next;
    };

    indicators.forEach((dot, i) => {
      dot.addEventListener("click", () => showSlide(i));
    });

    setInterval(() => {
      showSlide((index + 1) % slides.length);
    }, 4500);
  }
});
