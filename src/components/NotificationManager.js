const ICONS = {
  success: "i-check",
  error:   "i-alert",
  warning: "i-alert",
  info:    "i-info",
};

let stack = null;

function getStack() {
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    stack.setAttribute("aria-live", "polite");
    stack.setAttribute("aria-atomic", "false");
    document.body.appendChild(stack);
  }
  return stack;
}

export function showToast(message, type = "info", duration = 4000) {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", type === "error" ? "alert" : "status");

  const iconWrap = document.createElement("span");
  iconWrap.className = "toast__icon";
  iconWrap.setAttribute("aria-hidden", "true");
  iconWrap.innerHTML = `<svg><use href="#${ICONS[type] ?? ICONS.info}"/></svg>`;

  const text = document.createElement("span");
  text.className = "toast__message";
  text.textContent = message;

  toast.append(iconWrap, text);
  getStack().appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("toast--visible"));

  setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, duration);
}
