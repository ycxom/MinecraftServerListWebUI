import { InteractiveGlass } from './InteractiveGlass.js';

export class DropdownMenu {
    constructor(el, options = {}) {
        this.el = el;
        this.menuButton = this.el.querySelector(".drop-down__btn");
        this.itemList = this.el.querySelector(".drop-down__items");
        this.onSelect = options.onSelect || (() => {});
        this.glassInstance = null;

        // Bind 'this' context for event handlers
        this.handleMenuClick = this.handleMenuClick.bind(this);
        this.handleItemClick = this.handleItemClick.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);

        // *** THE FIX ***
        // Listeners are now fully managed by the component itself.
        this.menuButton.addEventListener("click", this.handleMenuClick);
        this.itemList.addEventListener("click", this.handleItemClick);
        this.el.setAttribute('aria-expanded', 'false');
    }

    toggle(forceClose = false) {
        const isExpanded = this.el.getAttribute('aria-expanded') === 'true';
        if (forceClose || isExpanded) {
            this.el.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', this.handleOutsideClick);
        } else {
            this.el.setAttribute('aria-expanded', 'true');
            if (!this.glassInstance) {
                this.itemList.classList.add('interactive-glass');
                this.glassInstance = new InteractiveGlass(this.itemList);
            }
            // Use a timeout to prevent the outside click listener from firing immediately
            setTimeout(() => {
                document.addEventListener('click', this.handleOutsideClick);
            }, 0);
        }
    }

    handleMenuClick(e) {
        e.stopPropagation();
        this.toggle();
    }

    // This function now correctly receives the browser's event object 'e'.
    handleItemClick(e) {
        // e.target is the actual element that was clicked inside the list.
        const target = e.target.closest('.drop-down__item');
        if (!target) return; // Exit if the click wasn't on an item.

        const value = target.getAttribute('data-value');
        if (value) {
            const textHolder = this.menuButton.querySelector('span');
            if (textHolder) textHolder.textContent = target.textContent;
            this.onSelect(value);
            this.updateSelected(value);
            this.toggle(true); // Force close after selection.
        }
    }

    handleOutsideClick(e) {
        if (!this.el.contains(e.target)) {
            this.toggle(true);
        }
    }

    updateSelected(selectedValue) {
        this.itemList.querySelectorAll('.drop-down__item').forEach(item => {
            item.classList.toggle('drop-down__item--selected', item.getAttribute('data-value') === selectedValue);
        });
    }

    destroy() {
        this.menuButton.removeEventListener("click", this.handleMenuClick);
        this.itemList.removeEventListener("click", this.handleItemClick);
        document.removeEventListener('click', this.handleOutsideClick);
        if (this.glassInstance) {
            this.glassInstance.destroy();
        }
    }
}