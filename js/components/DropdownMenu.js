export class DropdownMenu {
    constructor(el, options = {}) {
        this.el = el;
        this.menuButton = this.el.querySelector(".drop-down__btn");
        this.itemList = this.el.querySelector(".drop-down__items");
        this.onSelect = options.onSelect || (() => { });

        this.menuButton.addEventListener("click", (e) => this.handleMenuClick(e));
        this.el.setAttribute('aria-expanded', 'false');
    }

    toggle(forceClose = false) {
        const isExpanded = this.el.getAttribute('aria-expanded') === 'true';
        if (forceClose || isExpanded) {
            this.el.setAttribute('aria-expanded', 'false');
        } else {
            this.el.setAttribute('aria-expanded', 'true');
        }
    }

    handleMenuClick(e) {
        e.stopPropagation();
        this.toggle();
    }

    handleItemClick(target) {
        const value = target.getAttribute('data-value');
        if (value) {
            const textHolder = this.menuButton.querySelector('span');
            if (textHolder) textHolder.textContent = target.textContent;
            this.onSelect(value);
            this.updateSelected(value);
            this.toggle(true);
        }
    }

    updateSelected(selectedValue) {
        this.itemList.querySelectorAll('.drop-down__item').forEach(item => {
            item.classList.toggle('drop-down__item--selected', item.getAttribute('data-value') === selectedValue);
        });
    }
}