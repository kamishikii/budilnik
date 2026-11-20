
// Подставляет картинки из папки icons/.
// Если файла нет — показывает запасной символ, приложение всё равно работает.
const Icons = {
  html(name, fallback) {
    return `<span class="ico">
      <img src="icons/${name}.png" alt="" onerror="this.remove()">
      <span class="ico-fallback">${fallback}</span>
    </span>`;
  },
  // заполняет все статичные кнопки с атрибутом data-icon
  fillStatic() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      el.innerHTML = this.html(el.dataset.icon, el.dataset.fallback || '•');
    });
  }
};
