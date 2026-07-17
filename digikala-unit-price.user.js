// ==UserScript==
// @name         Digikala Unit Price Injector
// @namespace    https://github.com/toorajam/digikala-unit-price-injector
// @version      2026-07-17
// @description  Calculates and injects the price per unit for bundled products on Digikala.com (Supports PDP and compound word numbers)
// @author       You
// @match        *://*.digikala.com/*
// @match        *://digikala.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=digikala.com
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Log initialization to ensure the script is loaded
    console.log("[Digikala Script] Script injected and running!");

    /**
     * Converts Persian digits and decimal separators to English format for calculation.
     * @param {string} str - The input string containing Persian digits.
     * @returns {string} The normalized string with English digits.
     */
    const toEnglishDigits = (str) => {
        return str.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/٫/g, '.');
    };

    /**
     * Converts English digits back to Persian digits for UI presentation.
     * @param {string|number} str - The input containing English digits.
     * @returns {string} The string with Persian digits.
     */
    const toPersianDigits = (str) => {
        return str.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);
    };

    /**
     * Formats a number with commas for thousands separators and converts to Persian digits.
     * @param {number|string} num - The number to format.
     * @returns {string} The formatted Persian number string.
     */
    const formatNumber = (num) => {
        return toPersianDigits(num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","));
    };

    // Dictionary mapping raw Persian unit words to their standardized forms
    const unitMap = {
        'گیگابایت': 'گیگابایت', 'ترابایت': 'ترابایت',
        'گرم': 'گرم', 'گرمی': 'گرم',
        'عدد': 'عدد', 'عددی': 'عدد', 'دانه': 'عدد', 'تایی': 'عدد', 'بسته': 'بسته',
        'لیتر': 'لیتر', 'لیتری': 'لیتر',
        'میلی لیتر': 'میلی‌لیتر', 'میلی لیتری': 'میلی‌لیتر', 'میلی‌لیتر': 'میلی‌لیتر', 'میلی‌لیتری': 'میلی‌لیتر',
        'کیلوگرم': 'کیلوگرم', 'کیلوگرمی': 'کیلوگرم', 'کیلو': 'کیلوگرم', 'کیلویی': 'کیلوگرم',
        'متر': 'متر', 'متری': 'متر',
        'سانتی متر': 'سانتی‌متر', 'سانتی متری': 'سانتی‌متر', 'سانتی‌متر': 'سانتی‌متر',
        'سی سی': 'سی‌سی', 'سی‌سی': 'سی‌سی'
    };

    // Dictionary mapping Persian number words to their numeric integer/float equivalents
    const persianWordsMap = {
        'نیم': 0.5,
        'یک': 1, 'دو': 2, 'سه': 3, 'چهار': 4, 'پنج': 5, 'شش': 6, 'شیش': 6, 'هفت': 7, 'هشت': 8, 'نه': 9,
        'ده': 10, 'یازده': 11, 'دوازده': 12, 'سیزده': 13, 'چهارده': 14, 'پانزده': 15, 'شانزده': 16, 'هفده': 17, 'هجده': 18, 'نوزده': 19,
        'بیست': 20, 'سی': 30, 'چهل': 40, 'پنجاه': 50, 'شصت': 60, 'هفتاد': 70, 'هشتاد': 80, 'نود': 90,
        'صد': 100, 'دویست': 200, 'سیصد': 300, 'چهارصد': 400, 'پانصد': 500, 'ششصد': 600, 'هفتصد': 700, 'هشتصد': 800, 'نهصد': 900
    };

    /**
     * Converts a string of Persian compound number words into an integer.
     * Example: "صد و بیست و دو" -> 122
     * @param {string} wordsStr - The compound Persian word string.
     * @returns {number} The calculated numeric value.
     */
    const wordsToNumber = (wordsStr) => {
        const tokens = wordsStr.trim().split(/\s+و\s+|\s+/);
        let total = 0;
        let current = 0;

        for (const token of tokens) {
            if (token === 'هزار') {
                total += (current === 0 ? 1 : current) * 1000;
                current = 0;
            } else if (persianWordsMap[token] !== undefined) {
                current += persianWordsMap[token];
            }
        }
        return total + current;
    };

    // Construct a dynamic regular expression for finding quantities and units in text
    const unitsPattern = Object.keys(unitMap).join('|');
    const numWordsList = Object.keys(persianWordsMap).concat(['هزار']);
    const wordsPattern = `(?:(?:${numWordsList.join('|')})(?:\\s+و\\s+|\\s+)?)+`;

    // Regex matches either digits (e.g., "50" or "۵۰") or words (e.g., "پنجاه"), followed by a known unit
    const regexPattern = new RegExp(`([۰-۹0-9]+(?:[\\.\\٫][۰-۹0-9]+)?|${wordsPattern})\\s*(${unitsPattern})`, 'g');

    /**
     * Extracts quantity/unit from the title, calculates unit price, and injects the UI element.
     * @param {string} titleText - The raw product title text.
     * @param {HTMLElement} priceEl - The DOM element containing the total price.
     * @param {HTMLElement} containerToInjectAfter - The DOM element after which the unit price UI will be inserted.
     */
    const extractAndInject = (titleText, priceEl, containerToInjectAfter) => {
        // Find all matches in the title, use the last match to avoid false positives in brand names
        const matches = [...titleText.matchAll(regexPattern)];

        if (matches.length > 0) {
            const match = matches[matches.length - 1];
            const rawCountStr = match[1].trim();

            let count;
            // Parse count based on whether it is numerical digits or Persian words
            if (/[۰-۹0-9]/.test(rawCountStr)) {
                count = parseFloat(toEnglishDigits(rawCountStr));
            } else {
                count = wordsToNumber(rawCountStr);
            }

            const rawUnit = match[2];
            const cleanUnit = unitMap[rawUnit] || 'عدد';

            // Only proceed if a valid multi-pack or specific unit type is detected
            if (count > 0 && (count > 1 || cleanUnit !== 'عدد')) {
                const priceText = toEnglishDigits(priceEl.textContent).replace(/,/g, '');
                const totalPrice = parseInt(priceText, 10);

                if (!isNaN(totalPrice)) {
                    // Calculate the unit price
                    const unitPrice = Math.round(totalPrice / count);

                    // Create the injection container
                    const unitDiv = document.createElement('div');
                    unitDiv.className = 'custom-unit-price';
                    unitDiv.style.fontSize = '12px';
                    unitDiv.style.color = '#00a049'; // Standard Digikala green
                    unitDiv.style.marginTop = '4px';
                    unitDiv.style.marginBottom = '14px';
                    unitDiv.style.fontWeight = 'bold';
                    unitDiv.style.display = 'flex';
                    unitDiv.style.justifyContent = 'flex-end';
                    unitDiv.style.width = '100%';

                    unitDiv.textContent = `(قیمت هر ${cleanUnit} ${formatNumber(unitPrice)} تومان)`;

                    // Inject the calculated UI element into the DOM
                    containerToInjectAfter.insertAdjacentElement('afterend', unitDiv);
                }
            }
        }
    };

    /**
     * Scans for product cards (PLP - Product Listing Pages) and applies the injection logic.
     */
    const processCards = () => {
        // Select cards that haven't been processed yet
        const cards = document.querySelectorAll('[data-testid="product-card"]:not([data-unit-injected])');
        cards.forEach((card) => {
            // Mark as processed to prevent duplicate processing
            card.setAttribute('data-unit-injected', 'true');

            const titleEl = card.querySelector('h3.styles_VerticalProductCard__productTitle__IPQub') || card.querySelector('h3');
            const priceEl = card.querySelector('[data-testid="price-final"]');

            if (!titleEl || !priceEl) return;

            // Inject after the grandparent element of the price to align properly beneath the price block
            if (priceEl.parentElement && priceEl.parentElement.parentElement) {
                extractAndInject(titleEl.textContent, priceEl, priceEl.parentElement.parentElement);
            }
        });
    };

    /**
     * Scans the Product Detail Page (PDP) and applies the injection logic.
     */
    const processPDP = () => {
        // Prevent multiple injections on the PDP
        if (document.querySelector('.custom-unit-price.pdp-injected')) return;

        const titleEl = document.querySelector('h1[data-testid="pdp-title"]');
        const priceEl = document.querySelector('[data-testid="buy-box"] [data-testid="price-final"]');

        if (!titleEl || !priceEl) return;

        // Traverse the DOM to find the ideal flex container parent to inject below
        const priceContainer = priceEl.closest('[data-theme-animation="price-container"]')?.parentElement?.parentElement || priceEl.parentElement;

        if (priceContainer) {
            extractAndInject(titleEl.textContent, priceEl, priceContainer);

            // Explicitly mark the newly injected PDP element to prevent re-injections during DOM mutations
            const injectedEl = priceContainer.nextElementSibling;
            if (injectedEl && injectedEl.classList.contains('custom-unit-price')) {
                injectedEl.classList.add('pdp-injected');
            }
        }
    };

    /**
     * Set up a MutationObserver to detect DOM changes (useful for SPAs and lazy-loaded items).
     */
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        // Check if any new nodes were added to the DOM
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                shouldProcess = true;
                break;
            }
        }

        // Batch the processing using requestAnimationFrame for better performance
        if (shouldProcess) {
            window.requestAnimationFrame(() => {
                processCards();
                processPDP();
            });
        }
    });

    // Start observing the document body for changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Execute the initial run for already rendered elements
    processCards();
    processPDP();
})();
