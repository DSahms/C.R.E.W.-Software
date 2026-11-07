# Plan: Personal To-Do List App (Single HTML File)

## Overview
Build a complete, self-contained browser-based to-do list application in a single `index.html` file. The app will allow users to manage tasks with full CRUD operations, persist data to localStorage, and present a clean responsive UI in a minimalist light theme.

## Files to Create
- `index.html` — The complete application (HTML + embedded CSS + embedded JS)

## Implementation Details

### HTML Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personal To-Do List</title>
  <style>/* embedded CSS */</style>
</head>
<body>
  <main class="container">
    <header>
      <h1>To-Do List</h1>
      <form id="task-form">
        <input type="text" id="task-input" placeholder="Add a new task..." autocomplete="off" required>
        <button type="submit">Add</button>
      </form>
    </header>

    <section id="active-section" class="task-section">
      <h2>Active <span class="count" id="active-count">0</span></h2>
      <ul id="active-list" class="task-list"></ul>
    </section>

    <section id="completed-section" class="task-section">
      <h2>Completed <span class="count" id="completed-count">0</span></h2>
      <ul id="completed-list" class="task-list"></ul>
    </section>
  </main>
  <script>/* embedded JS */</script>
</body>
</html>
```

### Data Model
```javascript
// Task shape stored in localStorage under key 'todo-tasks'
{
  id: string,           // crypto.randomUUID() or timestamp+random
  text: string,         // user-entered task text
  completed: boolean,   // false = active, true = completed
  createdAt: number     // Date.now() for sorting
}
```

### CSS (Minimalist Light Theme)
- **Colors**: White background (`#fff`), light gray borders (`#e0e0e0`), dark text (`#1a1a1a`), muted text (`#666`), accent blue (`#2563eb`) for buttons/links, red (`#dc2626`) for delete
- **Typography**: System font stack, 16px base, generous line-height
- **Spacing**: 8px base unit, consistent padding/margins
- **Responsive**: Single column on mobile (<600px), centered container max-width 560px on desktop
- **Interactive states**: Hover/focus styles for buttons, inputs, task items
- **Task item layout**: Flex row — checkbox, editable text (span), delete button
- **Editing state**: Replace span with `<input>` on double-click, auto-focus, save on Enter/blur

### JavaScript Module (IIFE)
```javascript
(() => {
  // State
  const STORAGE_KEY = 'todo-tasks';
  let tasks = [];

  // DOM refs
  const form = document.getElementById('task-form');
  const input = document.getElementById('task-input');
  const activeList = document.getElementById('active-list');
  const completedList = document.getElementById('completed-list');
  const activeCount = document.getElementById('active-count');
  const completedCount = document.getElementById('completed-count');

  // Init: load from localStorage, render
  function init() {
    load();
    render();
    bindEvents();
  }

  // Persistence
  function load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      tasks = data ? JSON.parse(data) : [];
    } catch { tasks = []; }
  }
  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }

  // Rendering
  function render() {
    const active = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    activeList.innerHTML = active.map(taskHtml).join('');
    completedList.innerHTML = completed.map(taskHtml).join('');
    activeCount.textContent = active.length;
    completedCount.textContent = completed.length;
    bindTaskEvents(); // re-bind for new elements
  }

  function taskHtml(task) {
    return `<li data-id="${task.id}" class="task-item${task.completed ? ' completed' : ''}">
      <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} aria-label="Mark ${task.completed ? 'incomplete' : 'complete'}">
      <span class="task-text">${escapeHtml(task.text)}</span>
      <button class="task-delete" aria-label="Delete task">✕</button>
    </li>`;
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));
  }

  // Event binding
  function bindEvents() {
    form.addEventListener('submit', onAdd);
  }
  function bindTaskEvents() {
    document.querySelectorAll('.task-item').forEach(li => {
      const id = li.dataset.id;
      li.querySelector('.task-checkbox').addEventListener('change', () => onToggle(id));
      li.querySelector('.task-delete').addEventListener('click', () => onDelete(id));
      li.querySelector('.task-text').addEventListener('dblclick', () => onEditStart(li, id));
    });
  }

  // Actions
  function onAdd(e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    tasks.unshift({ id: crypto.randomUUID(), text, completed: false, createdAt: Date.now() });
    input.value = '';
    save(); render();
  }
  function onToggle(id) {
    const task = tasks.find(t => t.id === id);
    if (task) { task.completed = !task.completed; save(); render(); }
  }
  function onDelete(id) {
    tasks = tasks.filter(t => t.id !== id);
    save(); render();
  }
  function onEditStart(li, id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const span = li.querySelector('.task-text');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'task-edit-input';
    input.value = task.text;
    span.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
      const newText = input.value.trim();
      if (newText && newText !== task.text) {
        task.text = newText;
        save();
      }
      render(); // simpler: full re-render; could optimize to replace input with span
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') finish(); });
  }

  init();
})();
```

## Acceptance Criteria Verification
| Criterion | Test Method |
|-----------|-------------|
| Add task via input + button | Open file, type text, click Add → task appears in Active |
| Double-click to edit | Double-click task text → input appears → type → Enter/blur → text updates |
| Checkbox toggles complete | Click checkbox → task moves to Completed section |
| Delete button removes task | Click ✕ → task disappears from both sections and storage |
| Two labeled sections | Verify "Active" and "Completed" headings with counts |
| Data survives reload | Add tasks, refresh page (F5) → tasks still present |
| Responsive layout | Resize browser window / use dev tools device toolbar → no horizontal scroll, readable |
| No network dependencies | Open file via `file://` protocol → all features work |
| Minimalist light theme | Visual inspection — clean, light background, consistent spacing |

## Edge Cases Handled
- Empty input on add: ignored (required attribute + trim check)
- Empty edit: reverts to original text (trim check in finish)
- localStorage unavailable/quota exceeded: try/catch, graceful degradation to in-memory only
- XSS via task text: `escapeHtml()` on render
- Unique IDs: `crypto.randomUUID()` (modern browsers) — fallback to `Date.now() + Math.random()` if needed

## Verification Steps (Builder)
1. Create `index.html` with the above structure
2. Open in browser (double-click or `file://` protocol)
3. Run through each acceptance criterion manually
4. Verify no console errors
5. Confirm `localStorage.getItem('todo-tasks')` updates correctly

## Notes for Builder
- Keep everything in one file — no external CSS/JS files
- Use vanilla JS only (ES6+ features like `const`, arrow functions, template literals, `crypto.randomUUID()` are fine)
- The plan specifies a full re-render on edit for simplicity; acceptable for this scope
- Target: modern browsers (Chrome 80+, Firefox 75+, Safari 14+, Edge 80+)
- No build step, no server needed